/**
 * Real-Time Auto-Sync & Auto-Load Scheduler
 * Detects local state mutations within 1 second (1000ms cadence + 250ms debounce / 1s maxWait)
 * and coordinates instant cloud push & delta load cycles without overlapping I/O.
 */

export interface SyncFingerprintInput {
  transactions?: any[];
  campuses?: any[];
  pettyCashTransactions?: any[];
  accountHeads?: any[];
  users?: any[];
  orgSettings?: any;
  periods?: any[];
  schoolClients?: any[];
  activityLogs?: any[];
}

export interface AutoSyncSchedulerOptions {
  /** Heartbeat tick interval in ms (default 1000ms = 1 second). */
  tickIntervalMs?: number;
  /** Debounce delay after a change happens (default 250ms for sub-second save). */
  debounceMs?: number;
  /** Maximum delay before flushing continuous rapid changes (default 1000ms). */
  maxWaitMs?: number;
  /** Minimum interval between background cloud freshness checks (default 2000ms). */
  cloudLoadIntervalMs?: number;
  /** Return serialized snapshot to fingerprint. */
  getSnapshot: () => SyncFingerprintInput | null;
  /** Return whether the runtime is eligible to perform network sync (online, authenticated, visible). */
  canSyncNetwork: () => boolean;
  /** Return count of pending offline outbox items if any. */
  hasPendingOutbox?: () => Promise<boolean> | boolean;
  /** Execute cloud push of current dirty snapshot + outbox drain. */
  onFlushChanges: (snapshot: SyncFingerprintInput, fingerprint: string) => Promise<void>;
  /** Execute lightweight cloud freshness check / delta load. */
  onPullLatest: () => Promise<void>;
  /** Optional status callback on each sync/load cycle. */
  onStatusTick?: (info: {
    lastTickAt: number;
    dirty: boolean;
    lastFlushedAt: number | null;
    lastPulledAt: number | null;
  }) => void;
}

/**
 * Computes a deterministic, low-cost structural fingerprint over current tenant state
 * so unmodified data does not trigger redundant Firestore writes.
 */
export function computeSyncFingerprint(input: SyncFingerprintInput | null | undefined): string {
  if (!input || typeof input !== 'object') return 'empty';

  const summarizeArray = (arr: any[] | undefined, fields: (item: any) => string): string => {
    if (!Array.isArray(arr) || arr.length === 0) return '0';
    let acc = `${arr.length}:`;
    const limit = Math.min(arr.length, 250);
    for (let i = 0; i < limit; i++) {
      acc += fields(arr[i]) + '|';
    }
    return acc;
  };

  const txSig = summarizeArray(input.transactions, (v) =>
    `${v?.id || ''}:${v?.voucherNo || ''}:${v?.status || ''}:${v?.totalDebit || 0}:${v?.updatedAt || ''}:${v?.revision || 0}:${v?.entries?.length || 0}`
  );
  const campSig = summarizeArray(input.campuses, (c) =>
    `${c?.id || ''}:${c?.code || ''}:${c?.name || ''}:${c?.status || ''}:${c?.pettyCashFloat || 0}:${c?.currentPettyCash || 0}:${c?.updatedAt || ''}`
  );
  const pcSig = summarizeArray(input.pettyCashTransactions, (p) =>
    `${p?.id || ''}:${p?.voucherNo || ''}:${p?.amount || 0}:${p?.updatedAt || ''}`
  );
  const coaSig = summarizeArray(input.accountHeads, (a) =>
    `${a?.id || ''}:${a?.code || ''}:${a?.name || ''}:${a?.balance || 0}`
  );
  const userSig = summarizeArray(input.users, (u) =>
    `${u?.id || ''}:${u?.username || ''}:${u?.role || ''}:${u?.status || ''}:${u?.clientId || ''}:${u?.campusId || ''}:${u?.updatedAt || ''}`
  );
  const clientSig = summarizeArray(input.schoolClients, (c) =>
    `${c?.id || ''}:${c?.code || ''}:${c?.name || ''}:${c?.status || ''}:${c?.updatedAt || ''}`
  );
  const orgSig = input.orgSettings
    ? `${input.orgSettings.schoolName || ''}:${input.orgSettings.schoolLogo ? '1' : '0'}:${input.orgSettings.currency || ''}`
    : '0';
  const periodSig = summarizeArray(input.periods, (p) => `${p?.id || ''}:${p?.status || ''}`);

  return [txSig, campSig, pcSig, coaSig, userSig, clientSig, orgSig, periodSig].join('||');
}

export class RealtimeAutoSyncScheduler {
  private readonly tickIntervalMs: number;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly cloudLoadIntervalMs: number;
  private readonly options: AutoSyncSchedulerOptions;

  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private firstDirtyAt: number | null = null;
  private lastPushedFingerprint: string = '';
  private lastAppliedCloudFingerprint: string = '';
  private dirty = false;
  private isFlushing = false;
  private isPulling = false;
  private isRunning = false;
  private lastFlushedAt: number | null = null;
  private lastPulledAt: number | null = null;
  private quotaBackoffUntil = 0;

  constructor(options: AutoSyncSchedulerOptions) {
    this.options = options;
    this.tickIntervalMs = options.tickIntervalMs ?? 1000;
    this.debounceMs = options.debounceMs ?? 250;
    this.maxWaitMs = options.maxWaitMs ?? 1000;
    this.cloudLoadIntervalMs = options.cloudLoadIntervalMs ?? 2000;
  }

  /** Seeds baseline fingerprint right after cloud hydration so hydrated data isn't immediately re-pushed. */
  public markHydratedFromCloud(snapshot: SyncFingerprintInput | null): void {
    const fp = computeSyncFingerprint(snapshot);
    this.lastAppliedCloudFingerprint = fp;
    this.lastPushedFingerprint = fp;
    this.dirty = false;
    this.firstDirtyAt = null;
    this.lastPulledAt = Date.now();
  }

  /** Marks state as dirty and schedules a sub-second debounced flush capped by maxWaitMs (1s). */
  public markDirty(snapshot?: SyncFingerprintInput | null): void {
    const snap = snapshot ?? this.options.getSnapshot();
    const fp = computeSyncFingerprint(snap);
    if (fp === this.lastAppliedCloudFingerprint && fp === this.lastPushedFingerprint) {
      return;
    }

    this.dirty = true;
    const now = Date.now();
    if (this.firstDirtyAt === null) {
      this.firstDirtyAt = now;
    }

    // Enforce maxWaitMs so continuous rapid edits still flush within <= 1 second
    if (now - this.firstDirtyAt >= this.maxWaitMs) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      void this.flushIfDirty();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flushIfDirty();
    }, this.debounceMs);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalTimer = setInterval(() => {
      void this.tick();
    }, this.tickIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Single 1-second heartbeat cycle: detects dirty state, flushes within <=1s, and triggers delta load every 2s. */
  public async tick(now: number = Date.now()): Promise<void> {
    if (!this.options.canSyncNetwork()) {
      return;
    }
    if (now < this.quotaBackoffUntil) {
      return;
    }

    const snap = this.options.getSnapshot();
    if (snap) {
      const fp = computeSyncFingerprint(snap);
      if (fp !== this.lastPushedFingerprint && fp !== this.lastAppliedCloudFingerprint) {
        this.dirty = true;
        if (this.firstDirtyAt === null) this.firstDirtyAt = now;
      }
    }

    let pendingOutbox = false;
    if (this.options.hasPendingOutbox) {
      try {
        pendingOutbox = Boolean(await this.options.hasPendingOutbox());
      } catch {
        pendingOutbox = false;
      }
    }

    if (this.dirty || pendingOutbox) {
      await this.flushIfDirty();
    }

    // Periodic cloud delta check every cloudLoadIntervalMs (default 2000ms)
    if (
      !this.isPulling &&
      (this.lastPulledAt === null || now - this.lastPulledAt >= this.cloudLoadIntervalMs)
    ) {
      await this.pullNow(now);
    }

    this.options.onStatusTick?.({
      lastTickAt: now,
      dirty: this.dirty,
      lastFlushedAt: this.lastFlushedAt,
      lastPulledAt: this.lastPulledAt,
    });
  }

  public async flushIfDirty(): Promise<boolean> {
    if (this.isFlushing || !this.options.canSyncNetwork()) return false;
    if (Date.now() < this.quotaBackoffUntil) return false;

    const snap = this.options.getSnapshot();
    if (!snap) return false;
    const fp = computeSyncFingerprint(snap);

    let pendingOutbox = false;
    if (this.options.hasPendingOutbox) {
      try {
        pendingOutbox = Boolean(await this.options.hasPendingOutbox());
      } catch {}
    }

    if (!this.dirty && !pendingOutbox && fp === this.lastPushedFingerprint) {
      return false;
    }

    this.isFlushing = true;
    try {
      await this.options.onFlushChanges(snap, fp);
      this.lastPushedFingerprint = fp;
      this.dirty = false;
      this.firstDirtyAt = null;
      this.lastFlushedAt = Date.now();
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('resource-exhausted')) {
        this.quotaBackoffUntil = Date.now() + 60000;
      }
      return false;
    } finally {
      this.isFlushing = false;
    }
  }

  public async pullNow(now: number = Date.now()): Promise<boolean> {
    if (this.isPulling || !this.options.canSyncNetwork()) return false;
    if (now < this.quotaBackoffUntil) return false;

    this.isPulling = true;
    try {
      await this.options.onPullLatest();
      this.lastPulledAt = Date.now();
      return true;
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('quota') || msg.includes('resource-exhausted')) {
        this.quotaBackoffUntil = Date.now() + 60000;
      }
      return false;
    } finally {
      this.isPulling = false;
    }
  }

  public getDebugState() {
    return {
      isRunning: this.isRunning,
      dirty: this.dirty,
      isFlushing: this.isFlushing,
      isPulling: this.isPulling,
      lastFlushedAt: this.lastFlushedAt,
      lastPulledAt: this.lastPulledAt,
    };
  }
}
