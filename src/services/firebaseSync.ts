import { getVerifiedProfile } from './secureAuthentication';
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  saveStoredSchoolClients,
  getStoredSchoolClients,
  subscribeSchoolClientsFromCloud,
} from './platformSiteAdminService';
import {
  fetchGlobalUsersFromCloud,
  subscribeToGlobalUsersFromCloud,
  type GlobalUserRecord,
} from './globalUserSyncService';
import {
  RealtimeAutoSyncScheduler,
  type SyncFingerprintInput,
} from './realtimeSyncScheduler';

export type SyncStatus =
  | 'connecting'
  | 'saved_to_cloud'
  | 'saved_locally_pending'
  | 'synchronizing'
  | 'sync_failed'
  | 'conflict'
  | 'connected'
  | 'offline'
  | 'idle'
  | 'error';

export interface CloudSyncStats {
  lastSyncedAt: string | null;
  lastCloudLoadAt?: string | null;
  autoSyncActive?: boolean;
  autoSyncIntervalMs?: number;
  status: SyncStatus;
  message?: string;
  activeTenant?: string;
  activeCampus?: string;
  authenticatedUser?: string;
  offlinePendingCount?: number;
  indexedDbCached?: boolean;
  conflictDetails?: string;
}

type Listener = (stats: CloudSyncStats) => void;
const listeners = new Set<Listener>();

let syncInitialized = false;
let cloudHydrated = false;
let activeUnsubscribers: Unsubscribe[] = [];
let autoSyncEnabled = true;
let syncScheduler: RealtimeAutoSyncScheduler | null = null;
let lastAppliedCloudUpdatedAt = '';
let lastOwnWriteStamp = 0;
let activeTrashIds = new Set<string>();
let instantBroadcastChannel: BroadcastChannel | null = null;

// ============================================================================
// NATIVE INDEXEDDB NAMESPACED OFFLINE CACHE & OUTBOX
// ============================================================================
const IDB_NAME = 'AplusMultiTenantOfflineDB_v2';
const IDB_VERSION = 2;
const IDB_STORE_SNAPSHOTS = 'tenant_snapshots';
const IDB_STORE_OUTBOX = 'offline_outbox';

function openOfflineIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE_SNAPSHOTS)) {
          database.createObjectStore(IDB_STORE_SNAPSHOTS, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(IDB_STORE_OUTBOX)) {
          database.createObjectStore(IDB_STORE_OUTBOX, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function getTenantStorageKey(): string {
  const profile = getVerifiedProfile();
  const userId = profile?.id || 'anon';
  const clientId = profile?.clientId || 'client-aplus';
  return `tenant_cache_${userId}_${clientId}`;
}

export async function saveSnapshotToIndexedDB(
  state: any,
  pendingCloudSync: boolean
): Promise<void> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return;
  const key = getTenantStorageKey();
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(IDB_STORE_SNAPSHOTS);
      store.put({
        key,
        updatedAt: new Date().toISOString(),
        pendingCloudSync,
        state: JSON.parse(JSON.stringify(state ?? {})),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadSnapshotFromIndexedDB(): Promise<{
  state: any;
  pendingCloudSync: boolean;
  updatedAt?: string;
} | null> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return null;
  const key = getTenantStorageKey();
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(IDB_STORE_SNAPSHOTS);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.state) {
          resolve({
            state: req.result.state,
            pendingCloudSync: Boolean(req.result.pendingCloudSync),
            updatedAt: req.result.updatedAt,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Queue an operation in the offline outbox
async function queueOfflineOperation(op: {
  action: 'saveVoucher' | 'deleteVoucher' | 'savePettyCash' | 'deletePettyCash' | 'saveCampus' | 'deleteCampus';
  clientId: string;
  targetId: string;
  path: string;
  payload?: any;
  expectedRevision?: number;
}): Promise<void> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return;
  const id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(IDB_STORE_OUTBOX);
      store.put({
        id,
        ...op,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Drain offline outbox when connection is restored
async function drainOfflineOutbox(): Promise<number> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return 0;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(IDB_STORE_OUTBOX);
      const req = store.getAll();
      req.onsuccess = async () => {
        const ops = req.result || [];
        if (ops.length === 0) {
          resolve(0);
          return;
        }

        notify({
          status: 'synchronizing',
          message: `Synchronizing ${ops.length} queued offline operations to Cloud...`,
        });

        for (const op of ops) {
          try {
            if (op.action === 'saveVoucher' || op.action === 'savePettyCash' || op.action === 'saveCampus') {
              await setDoc(doc(db, op.path), op.payload, { merge: true });
            } else if (op.action === 'deleteVoucher' || op.action === 'deletePettyCash' || op.action === 'deleteCampus') {
              await deleteDoc(doc(db, op.path));
            }
            // Remove from outbox
            const delTx = idb.transaction(IDB_STORE_OUTBOX, 'readwrite');
            delTx.objectStore(IDB_STORE_OUTBOX).delete(op.id);
          } catch (e) {
            console.warn('Failed draining outbox item:', op.id, e);
          }
        }
        resolve(ops.length);
      };
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

let currentStats: CloudSyncStats = {
  lastSyncedAt: null,
  lastCloudLoadAt: null,
  autoSyncActive: true,
  autoSyncIntervalMs: 1000,
  status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connecting',
  message: 'Connecting to Cloud Datastore...',
  offlinePendingCount: 0,
  indexedDbCached: true,
};

function notify(partial: Partial<CloudSyncStats>) {
  const profile = getVerifiedProfile();
  currentStats = {
    ...currentStats,
    activeTenant: profile?.clientId || 'Aplus Network',
    activeCampus: profile?.campusId || 'Central Administration',
    authenticatedUser: profile?.name || profile?.email || 'Authenticated User',
    autoSyncActive: autoSyncEnabled,
    autoSyncIntervalMs: 1000,
    ...partial,
  };
  listeners.forEach((fn) => fn(currentStats));
}

async function hasPendingOutboxOps(): Promise<boolean> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return false;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE_OUTBOX, 'readonly');
      const req = tx.objectStore(IDB_STORE_OUTBOX).count();
      req.onsuccess = () => resolve((req.result || 0) > 0);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function getCombinedSyncSnapshot(): SyncFingerprintInput | null {
  if (typeof window === 'undefined') return null;
  const engineState = window.__APLUS_GET_CURRENT_STATE__?.();
  if (!engineState) return null;
  return {
    ...engineState,
    schoolClients: getStoredSchoolClients(),
  };
}

function broadcastLocalStateUpdate(state: any) {
  try {
    instantBroadcastChannel?.postMessage({
      type: 'STATE_SYNCED',
      updatedAt: new Date().toISOString(),
      voucherCount: state?.transactions?.length || 0,
      campusCount: state?.campuses?.length || 0,
    });
  } catch {}
}

export function subscribeCloudSync(fn: Listener) {
  listeners.add(fn);
  fn(currentStats);
  return () => {
    listeners.delete(fn);
  };
}

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj ?? {}, (key, value) =>
      /^(password|passwordHash|dynamicToken|idToken|refreshToken)$/i.test(key) ? undefined : value
    )
  );
}

function getEffectiveClientId(entity?: any): string {
  if (entity?.clientId) return entity.clientId;
  const profile = getVerifiedProfile();
  if (profile?.clientId) return profile.clientId;
  return 'client-aplus';
}

// ============================================================================
// MAIN CLOUD SYNC INITIALIZATION & REALTIME ENGINE
// ============================================================================
export function initFirebaseCloudSync() {
  window.__APLUS_CLOUD_SYNC__ = {
    // 1. Campus Sync (Tenant-Scoped: organizations/{clientId}/campuses/{campusId})
    async syncCampus(campus: any) {
      if (!campus?.id) return;
      const clientId = getEffectiveClientId(campus);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const path = `organizations/${clientId}/campuses/${String(campus.id)}`;
      const payload = {
        ...sanitizeForFirestore(campus),
        clientId,
        revision: (Number(campus.revision) || 0) + 1,
        updatedAt: new Date().toISOString(),
      };

      if (!isOnline) {
        await queueOfflineOperation({
          action: 'saveCampus',
          clientId,
          targetId: String(campus.id),
          path,
          payload,
        });
        notify({
          status: 'saved_locally_pending',
          message: `Saved locally—pending synchronization (Campus: ${campus.name})`,
        });
        return;
      }

      try {
        notify({ status: 'synchronizing', message: `Synchronizing campus ${campus.name}...` });
        await setDoc(doc(db, path), payload, { merge: true });
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: `Saved to cloud (Campus ${campus.code || campus.name})`,
        });
      } catch (err: any) {
        console.error('Campus sync failure:', err);
        notify({
          status: 'sync_failed',
          message: `Synchronization failed: ${err.message || 'Check Firestore permissions'}`,
        });
      }
    },

    async deleteCampus(campusId: string) {
      if (!campusId) return;
      const clientId = getEffectiveClientId();
      const path = `organizations/${clientId}/campuses/${String(campusId)}`;
      const trashPath = `organizations/${clientId}/trash/${String(campusId)}`;

      try {
        await setDoc(doc(db, trashPath), {
          id: String(campusId),
          collection: 'campuses',
          deletedAt: new Date().toISOString(),
        });
        await deleteDoc(doc(db, path));
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: 'Campus removed and archived to trash in cloud',
        });
      } catch {}
    },

    // 2. Voucher Sync (Tenant-Scoped: organizations/{clientId}/vouchers/{voucherId})
    async syncVoucher(voucher: any) {
      if (!voucher?.id) return;
      const clientId = getEffectiveClientId(voucher);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const path = `organizations/${clientId}/vouchers/${String(voucher.id)}`;
      const newRevision = (Number(voucher.revision) || 0) + 1;
      const payload = {
        ...sanitizeForFirestore(voucher),
        clientId,
        revision: newRevision,
        updatedAt: new Date().toISOString(),
      };

      if (!isOnline) {
        await queueOfflineOperation({
          action: 'saveVoucher',
          clientId,
          targetId: String(voucher.id),
          path,
          payload,
          expectedRevision: voucher.revision,
        });
        notify({
          status: 'saved_locally_pending',
          message: `Saved locally—pending synchronization (Voucher #${voucher.voucherNo || voucher.id})`,
        });
        return;
      }

      try {
        notify({ status: 'synchronizing', message: `Synchronizing voucher ${voucher.voucherNo || voucher.id}...` });

        // Concurrency check if updating existing voucher
        if (voucher.revision) {
          const existingSnap = await getDoc(doc(db, path));
          if (existingSnap.exists()) {
            const remoteRev = Number(existingSnap.data()?.revision) || 0;
            if (remoteRev > voucher.revision) {
              notify({
                status: 'conflict',
                conflictDetails: `Voucher was edited on another terminal (cloud revision: ${remoteRev}, your revision: ${voucher.revision}). Review required.`,
                message: 'Conflict—review required before saving',
              });
              return;
            }
          }
        }

        await setDoc(doc(db, path), payload, { merge: true });
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: `Saved to cloud (Voucher ${voucher.voucherNo || voucher.id})`,
        });
      } catch (err: any) {
        console.error('Voucher sync failure:', err);
        notify({
          status: 'sync_failed',
          message: `Synchronization failed: ${err.message || 'Cloud write rejected'}`,
        });
      }
    },

    async deleteVoucher(voucherId: string) {
      if (!voucherId) return;
      const clientId = getEffectiveClientId();
      const path = `organizations/${clientId}/vouchers/${String(voucherId)}`;
      const trashPath = `organizations/${clientId}/trash/${String(voucherId)}`;

      try {
        await setDoc(doc(db, trashPath), {
          id: String(voucherId),
          collection: 'vouchers',
          deletedAt: new Date().toISOString(),
        });
        await deleteDoc(doc(db, path));
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: `Voucher archived to trash in cloud datastore`,
        });
      } catch {}
    },

    // 3. Petty Cash Sync (Tenant-Scoped: organizations/{clientId}/petty_cash/{id})
    async syncPettyCash(pettyCash: any) {
      if (!pettyCash?.id) return;
      const clientId = getEffectiveClientId(pettyCash);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      const path = `organizations/${clientId}/petty_cash/${String(pettyCash.id)}`;
      const payload = {
        ...sanitizeForFirestore(pettyCash),
        clientId,
        revision: (Number(pettyCash.revision) || 0) + 1,
        updatedAt: new Date().toISOString(),
      };

      if (!isOnline) {
        await queueOfflineOperation({
          action: 'savePettyCash',
          clientId,
          targetId: String(pettyCash.id),
          path,
          payload,
        });
        notify({
          status: 'saved_locally_pending',
          message: `Saved locally—pending synchronization (Petty cash ${pettyCash.voucherNo || pettyCash.id})`,
        });
        return;
      }

      try {
        notify({ status: 'synchronizing', message: `Synchronizing petty cash ${pettyCash.voucherNo || pettyCash.id}...` });
        await setDoc(doc(db, path), payload, { merge: true });
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: `Saved to cloud (Petty cash ${pettyCash.voucherNo || pettyCash.id})`,
        });
      } catch (err: any) {
        console.error('Petty cash sync failure:', err);
        notify({
          status: 'sync_failed',
          message: `Synchronization failed: ${err.message || 'Write rejected'}`,
        });
      }
    },

    async deletePettyCash(pettyCashId: string) {
      if (!pettyCashId) return;
      const clientId = getEffectiveClientId();
      const path = `organizations/${clientId}/petty_cash/${String(pettyCashId)}`;
      const trashPath = `organizations/${clientId}/trash/${String(pettyCashId)}`;

      try {
        await setDoc(doc(db, trashPath), {
          id: String(pettyCashId),
          collection: 'petty_cash',
          deletedAt: new Date().toISOString(),
        });
        await deleteDoc(doc(db, path));
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: new Date().toISOString(),
          message: 'Petty cash archived to trash in cloud',
        });
      } catch {}
    },

    async reconcileBankTx(txId: string, reconciled: boolean) {
      if (!txId) return;
      const clientId = getEffectiveClientId();
      try {
        await setDoc(
          doc(db, `organizations/${clientId}/bank_reconciliations`, String(txId)),
          {
            txId,
            clientId,
            reconciled: Boolean(reconciled),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    },

    async syncActivityLog(log: any) {
      if (!log?.id) return;
      const clientId = getEffectiveClientId(log);
      try {
        await setDoc(
          doc(db, `organizations/${clientId}/audit`, String(log.id)),
          {
            ...sanitizeForFirestore(log),
            clientId,
            timestamp: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    },

    async seedAll(campusesList: any[]) {
      try {
        const clientId = getEffectiveClientId();
        const batch = writeBatch(db);
        let ops = 0;
        for (const c of (campusesList || []).slice(0, 50)) {
          if (c?.id) {
            batch.set(
              doc(db, `organizations/${clientId}/campuses`, String(c.id)),
              { ...sanitizeForFirestore(c), clientId },
              { merge: true }
            );
            ops++;
          }
        }
        if (ops > 0) {
          await batch.commit();
        }
      } catch {}
    },

    // Reactive sub-second global cloud persistence via 1-second RealtimeAutoSyncScheduler
    autoSaveMasterState(state: any) {
      if (!state) return;

      // Save local cache immediately for offline resiliency
      saveSnapshotToIndexedDB(state, typeof navigator !== 'undefined' ? !navigator.onLine : false).catch(() => {});

      const scheduler = ensureAutoSyncScheduler();
      scheduler.markDirty({
        ...state,
        schoolClients: getStoredSchoolClients(),
      });
    },
  };

  if (syncInitialized) return;
  syncInitialized = true;

  // Cross-tab instant synchronization channel (<50ms between browser tabs)
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      instantBroadcastChannel = new BroadcastChannel('aplus_instant_sync_v1');
      instantBroadcastChannel.onmessage = () => {
        if (auth.currentUser && navigator.onLine) {
          void ensureAutoSyncScheduler().pullNow();
        }
      };
    } catch {}
  }

  // Listen for online/offline transitions
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => {
      notify({
        status: 'offline',
        indexedDbCached: true,
        message: 'Campus Network Disconnected — Operating on local cache',
      });
    });

    window.addEventListener('online', async () => {
      notify({
        status: 'synchronizing',
        message: 'Network Restored — Syncing queued operations to Cloud...',
      });
      try {
        const drained = await drainOfflineOutbox();
        await triggerInstantCloudSyncAndLoad();
        notify({
          status: 'saved_to_cloud',
          offlinePendingCount: 0,
          indexedDbCached: true,
          lastSyncedAt: new Date().toISOString(),
          message: `Network Restored — Synced ${drained} queued changes to Cloud`,
        });
      } catch {
        notify({ status: 'saved_to_cloud' });
      }
    });

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && auth.currentUser) {
        void ensureAutoSyncScheduler().tick();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    const handleEntityChangeEvent = () => {
      if (auth.currentUser) {
        const snap = getCombinedSyncSnapshot();
        if (snap) ensureAutoSyncScheduler().markDirty(snap);
      }
    };
    window.addEventListener('aplus-clients-updated', handleEntityChangeEvent);
    window.addEventListener('aplus-global-users-updated', handleEntityChangeEvent);
    window.addEventListener('aplus-force-cloud-sync', () => {
      void triggerInstantCloudSyncAndLoad();
    });
  }

  window.addEventListener('aplus-logout', () => {
    syncScheduler?.stop();
    cleanupSubscriptions();
  });

  window.addEventListener('aplus-verified-login', () => {
    void startCrossBrowserRealtimeSync();
    ensureAutoSyncScheduler().start();
  });

  ensureAutoSyncScheduler().start();

  setTimeout(() => {
    startCrossBrowserRealtimeSync().catch(() => {
      window.__APLUS_MARK_CLOUD_READY__?.();
    });
  }, 100);
}

async function flushMasterSnapshotToCloud(state: any): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (!auth.currentUser) return;

  await drainOfflineOutbox().catch(() => 0);

  const clientId = getEffectiveClientId();
  const profile = getVerifiedProfile();
  const nowIso = new Date().toISOString();
  lastOwnWriteStamp = Date.now();
  lastAppliedCloudUpdatedAt = nowIso;

  const sanitizedState = {
    clientId,
    updatedAt: nowIso,
    updatedBy: profile?.username || profile?.email || 'authenticated_user',
    voucherCount: state?.transactions?.length || 0,
    campusCount: state?.campuses?.length || 0,
    pettyCashCount: state?.pettyCashTransactions?.length || 0,
    accountHeadCount: state?.accountHeads?.length || 0,
    transactions: sanitizeForFirestore(state?.transactions || []),
    campuses: sanitizeForFirestore(state?.campuses || []),
    pettyCashTransactions: sanitizeForFirestore(state?.pettyCashTransactions || []),
    accountHeads: sanitizeForFirestore(state?.accountHeads || []),
    orgSettings: sanitizeForFirestore(state?.orgSettings || {}),
    periods: sanitizeForFirestore(state?.periods || []),
  };

  // 1. Authoritative Cloud Master Snapshot
  await setDoc(
    doc(db, 'organizations', clientId, 'snapshots', 'live_state'),
    sanitizedState,
    { merge: true }
  );

  // 2. Organization root heartbeat
  await setDoc(
    doc(db, 'organizations', clientId),
    {
      id: clientId,
      status: 'active',
      migrationStatus: 'ready',
      lastActivityAt: nowIso,
      voucherCount: state?.transactions?.length || 0,
      campusCount: state?.campuses?.length || 0,
      updatedAt: nowIso,
    },
    { merge: true }
  );

  // 3. Incrementally mirror entities into tenant subcollections
  try {
    const batch = writeBatch(db);
    let opCount = 0;

    for (const v of (state?.transactions || []).slice(0, 40)) {
      if (v?.id && opCount < 60) {
        batch.set(
          doc(db, 'organizations', clientId, 'vouchers', String(v.id)),
          { ...sanitizeForFirestore(v), clientId, updatedAt: nowIso },
          { merge: true }
        );
        opCount++;
      }
    }

    for (const p of (state?.pettyCashTransactions || []).slice(0, 25)) {
      if (p?.id && opCount < 90) {
        batch.set(
          doc(db, 'organizations', clientId, 'petty_cash', String(p.id)),
          { ...sanitizeForFirestore(p), clientId, updatedAt: nowIso },
          { merge: true }
        );
        opCount++;
      }
    }

    for (const c of (state?.campuses || []).slice(0, 20)) {
      if (c?.id && opCount < 115) {
        batch.set(
          doc(db, 'organizations', clientId, 'campuses', String(c.id)),
          { ...sanitizeForFirestore(c), clientId, updatedAt: nowIso },
          { merge: true }
        );
        opCount++;
      }
    }

    for (const a of (state?.accountHeads || []).slice(0, 35)) {
      if (a?.id && opCount < 155) {
        batch.set(
          doc(db, 'organizations', clientId, 'account_heads', String(a.id)),
          { ...sanitizeForFirestore(a), clientId, updatedAt: nowIso },
          { merge: true }
        );
        opCount++;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
  } catch {}

  await saveSnapshotToIndexedDB(state, false);
  broadcastLocalStateUpdate(state);

  notify({
    status: 'saved_to_cloud',
    offlinePendingCount: 0,
    indexedDbCached: true,
    lastSyncedAt: nowIso,
    message: `Auto-synced to cloud (${state?.transactions?.length || 0} vouchers · ${
      state?.campuses?.length || 0
    } campuses)`,
  });
}

async function pullDeltaCloudUpdate(): Promise<void> {
  if (!auth.currentUser || !cloudHydrated) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, 'organizations', clientId, 'snapshots', 'live_state'));
    const nowIso = new Date().toISOString();
    if (!snap.exists()) {
      notify({ lastCloudLoadAt: nowIso });
      return;
    }

    const data = snap.data();
    const remoteUpdatedAt = String(data?.updatedAt || '');
    const withinOwnEchoWindow = Date.now() - lastOwnWriteStamp < 1200;

    if (
      remoteUpdatedAt &&
      remoteUpdatedAt !== lastAppliedCloudUpdatedAt &&
      remoteUpdatedAt > lastAppliedCloudUpdatedAt &&
      !withinOwnEchoWindow
    ) {
      const cur = window.__APLUS_GET_CURRENT_STATE__?.();
      if (cur) {
        lastAppliedCloudUpdatedAt = remoteUpdatedAt;
        const hydrated = {
          ...cur,
          transactions: Array.isArray(data.transactions) ? data.transactions : cur.transactions,
          campuses: Array.isArray(data.campuses) ? data.campuses : cur.campuses,
          pettyCashTransactions: Array.isArray(data.pettyCashTransactions)
            ? data.pettyCashTransactions
            : cur.pettyCashTransactions,
          accountHeads:
            Array.isArray(data.accountHeads) && data.accountHeads.length > 0
              ? data.accountHeads
              : cur.accountHeads,
          orgSettings: data.orgSettings || cur.orgSettings,
          periods: Array.isArray(data.periods) && data.periods.length > 0 ? data.periods : cur.periods,
        };
        window.__APLUS_HYDRATE_FROM_CLOUD__?.(hydrated);
        syncScheduler?.markHydratedFromCloud({
          ...hydrated,
          schoolClients: getStoredSchoolClients(),
        });
        await saveSnapshotToIndexedDB(hydrated, false);
        notify({
          status: 'saved_to_cloud',
          lastSyncedAt: nowIso,
          lastCloudLoadAt: nowIso,
          message: `Auto-loaded latest cloud update (${hydrated.transactions?.length || 0} vouchers)`,
        });
        return;
      }
    }

    notify({ lastCloudLoadAt: nowIso });
  } catch (err: any) {
    console.warn('[AutoSync] Delta load check notice:', err?.message);
  }
}

function ensureAutoSyncScheduler(): RealtimeAutoSyncScheduler {
  if (!syncScheduler) {
    syncScheduler = new RealtimeAutoSyncScheduler({
      tickIntervalMs: 1000,
      debounceMs: 250,
      maxWaitMs: 1000,
      cloudLoadIntervalMs: 2000,
      getSnapshot: () => getCombinedSyncSnapshot(),
      canSyncNetwork: () => {
        if (!autoSyncEnabled) return false;
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
        return Boolean(auth.currentUser);
      },
      hasPendingOutbox: hasPendingOutboxOps,
      onFlushChanges: async (snapshot) => {
        await flushMasterSnapshotToCloud(snapshot);
      },
      onPullLatest: async () => {
        await pullDeltaCloudUpdate();
      },
    });
  }
  return syncScheduler;
}

export async function triggerInstantCloudSyncAndLoad(): Promise<void> {
  const scheduler = ensureAutoSyncScheduler();
  await scheduler.flushIfDirty();
  await scheduler.pullNow();
}

export function setAutoSyncEnabled(enabled: boolean): void {
  autoSyncEnabled = enabled;
  const scheduler = ensureAutoSyncScheduler();
  if (enabled) {
    scheduler.start();
    void scheduler.tick();
  } else {
    scheduler.stop();
  }
  notify({ autoSyncActive: enabled });
}

function cleanupSubscriptions() {
  activeUnsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  activeUnsubscribers = [];
}

/**
 * Starts real-time subscriptions and loads authoritative global cloud records for active tenant.
 */
async function startCrossBrowserRealtimeSync() {
  cleanupSubscriptions();
  notify({ status: 'connecting', message: 'Connecting to Authoritative Cloud Datastore...' });

  try {
    // 1. Initial local cache check for instant render
    const idbCached = await loadSnapshotFromIndexedDB();
    if (idbCached?.state) {
      window.__APLUS_HYDRATE_FROM_CLOUD__?.(idbCached.state);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      window.__APLUS_MARK_CLOUD_READY__?.();
      notify({
        status: 'offline',
        indexedDbCached: true,
        message: 'Offline Mode — Operating on local offline cache',
      });
      return;
    }

    if (!auth.currentUser) {
      window.__APLUS_MARK_CLOUD_READY__?.();
      notify({
        status: 'idle',
        indexedDbCached: true,
        message: 'Portal secured. Please sign in with registered institutional credentials to connect.',
      });
      return;
    }

    const profile = getVerifiedProfile();
    const clientId = profile?.clientId || 'client-aplus';

    notify({ status: 'synchronizing', message: `Loading global records for ${clientId}...` });

    // Ensure organization root document exists
    try {
      await setDoc(
        doc(db, 'organizations', clientId),
        {
          id: clientId,
          status: 'active',
          migrationStatus: 'ready',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {}

    // Load active school clients registry
    try {
      const clientsSnap = await getDoc(doc(db, 'system_state', 'school_clients_registry'));
      if (clientsSnap.exists() && Array.isArray(clientsSnap.data()?.clients)) {
        saveStoredSchoolClients(clientsSnap.data().clients);
      }
    } catch {}

    // 2. Fetch authoritative master live snapshot, subcollections, AND global_users for this client
    const [liveSnapDoc, vouchersSnap, pettySnap, campusesSnap, coaSnap, trashSnap, cloudGlobalUsers] = await Promise.all([
      getDoc(doc(db, 'organizations', clientId, 'snapshots', 'live_state')),
      getDocs(collection(db, 'organizations', clientId, 'vouchers')),
      getDocs(collection(db, 'organizations', clientId, 'petty_cash')),
      getDocs(collection(db, 'organizations', clientId, 'campuses')),
      getDocs(collection(db, 'organizations', clientId, 'account_heads')),
      getDocs(collection(db, 'organizations', clientId, 'trash')),
      fetchGlobalUsersFromCloud(),
    ]);

    activeTrashIds = new Set(trashSnap.docs.map((d) => d.id));
    const cloudMasterData = liveSnapDoc.exists() ? liveSnapDoc.data() : null;
    if (cloudMasterData?.updatedAt) {
      lastAppliedCloudUpdatedAt = String(cloudMasterData.updatedAt);
    }

    const cloudVouchers = vouchersSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((v: any) => !activeTrashIds.has(v.id) && !v.deletedAt);

    const cloudPettyCash = pettySnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((p: any) => !activeTrashIds.has(p.id) && !p.deletedAt);

    const cloudCampuses = campusesSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((c: any) => !activeTrashIds.has(c.id));

    const cloudCOA = coaSnap.docs
      .map((d) => ({ ...d.data(), id: d.id }))
      .filter((a: any) => !activeTrashIds.has(a.id));

    const localState = window.__APLUS_GET_CURRENT_STATE__?.() || idbCached?.state || {};

    // Cloud is authoritative over browser cache
    const finalCampuses = cloudCampuses.length > 0
      ? cloudCampuses
      : Array.isArray(cloudMasterData?.campuses) && cloudMasterData.campuses.length > 0
      ? cloudMasterData.campuses
      : localState.campuses || [];

    const finalTransactions = cloudVouchers.length > 0
      ? cloudVouchers
      : Array.isArray(cloudMasterData?.transactions)
      ? cloudMasterData.transactions
      : localState.transactions || [];

    const finalPettyCash = cloudPettyCash.length > 0
      ? cloudPettyCash
      : Array.isArray(cloudMasterData?.pettyCashTransactions)
      ? cloudMasterData.pettyCashTransactions
      : localState.pettyCashTransactions || [];

    const finalCOA = cloudCOA.length > 0
      ? cloudCOA
      : Array.isArray(cloudMasterData?.accountHeads) && cloudMasterData.accountHeads.length > 0
      ? cloudMasterData.accountHeads
      : localState.accountHeads || [];

    const finalUsers = mergeUsersWithCloud(cloudGlobalUsers, localState.users || []);

    const finalState = {
      ...localState,
      campuses: finalCampuses,
      transactions: finalTransactions,
      pettyCashTransactions: finalPettyCash,
      accountHeads: finalCOA,
      users: finalUsers,
      orgSettings: cloudMasterData?.orgSettings || localState.orgSettings,
      periods: cloudMasterData?.periods || localState.periods,
    };

    window.__APLUS_HYDRATE_FROM_CLOUD__?.(finalState);
    syncLocalUsersCache(finalUsers);
    await saveSnapshotToIndexedDB(finalState, false);

    cloudHydrated = true;
    window.__APLUS_MARK_CLOUD_READY__?.();
    ensureAutoSyncScheduler().markHydratedFromCloud({
      ...finalState,
      schoolClients: getStoredSchoolClients(),
    });
    ensureAutoSyncScheduler().start();

    notify({
      status: 'saved_to_cloud',
      lastSyncedAt: new Date().toISOString(),
      lastCloudLoadAt: new Date().toISOString(),
      offlinePendingCount: 0,
      indexedDbCached: true,
      message: `Auto-Sync Active (1s) · ${finalTransactions.length} vouchers · ${finalCampuses.length} campuses · ${finalUsers.length} users`,
    });

    // 3. REAL-TIME ON-SNAPSHOT LISTENERS for cross-device & cross-terminal synchronization (<1s)
    // 3A. Live Trash Listener so deleted records stay deleted across all sessions
    const unsubTrash = onSnapshot(
      collection(db, 'organizations', clientId, 'trash'),
      (snap) => {
        activeTrashIds = new Set(snap.docs.map((d) => d.id));
      },
      (err) => console.warn('Trash onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubTrash);

    // 3B. Master Live Snapshot Listener
    const unsubMaster = onSnapshot(
      doc(db, 'organizations', clientId, 'snapshots', 'live_state'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data) return;
        // Skip echo of our own immediate local write
        if (
          Date.now() - lastOwnWriteStamp < 1200 &&
          data.updatedAt === lastAppliedCloudUpdatedAt
        ) {
          return;
        }
        if (data.updatedAt) {
          lastAppliedCloudUpdatedAt = String(data.updatedAt);
        }
        const cur = window.__APLUS_GET_CURRENT_STATE__?.();
        if (cur) {
          const nextState = {
            ...cur,
            transactions: Array.isArray(data.transactions) ? data.transactions : cur.transactions,
            campuses: Array.isArray(data.campuses) ? data.campuses : cur.campuses,
            pettyCashTransactions: Array.isArray(data.pettyCashTransactions)
              ? data.pettyCashTransactions
              : cur.pettyCashTransactions,
            accountHeads:
              Array.isArray(data.accountHeads) && data.accountHeads.length > 0
                ? data.accountHeads
                : cur.accountHeads,
            orgSettings: data.orgSettings || cur.orgSettings,
            periods: Array.isArray(data.periods) && data.periods.length > 0 ? data.periods : cur.periods,
          };
          window.__APLUS_HYDRATE_FROM_CLOUD__?.(nextState);
          syncScheduler?.markHydratedFromCloud({
            ...nextState,
            schoolClients: getStoredSchoolClients(),
          });
          notify({
            status: 'saved_to_cloud',
            lastSyncedAt: new Date().toISOString(),
            lastCloudLoadAt: new Date().toISOString(),
            message: 'Realtime update loaded from cloud datastore',
          });
        }
      },
      (err) => console.warn('Master onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubMaster);

    // 3C. Vouchers Real-Time Listener (including last-item deletion)
    const unsubVouchers = onSnapshot(
      collection(db, 'organizations', clientId, 'vouchers'),
      (snap) => {
        const updated = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((v: any) => !activeTrashIds.has(v.id) && !v.deletedAt);
        const hasRemovals = snap.docChanges().some((c) => c.type === 'removed');
        if (updated.length > 0 || hasRemovals) {
          const cur = window.__APLUS_GET_CURRENT_STATE__?.();
          if (cur) {
            const next = { ...cur, transactions: updated };
            window.__APLUS_HYDRATE_FROM_CLOUD__?.(next);
            syncScheduler?.markHydratedFromCloud({ ...next, schoolClients: getStoredSchoolClients() });
            notify({
              status: 'saved_to_cloud',
              lastSyncedAt: new Date().toISOString(),
              lastCloudLoadAt: new Date().toISOString(),
              message: `Realtime sync: ${updated.length} vouchers loaded`,
            });
          }
        }
      },
      (err) => console.warn('Vouchers onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubVouchers);

    // 3D. Petty Cash Real-Time Listener (including last-item deletion)
    const unsubPetty = onSnapshot(
      collection(db, 'organizations', clientId, 'petty_cash'),
      (snap) => {
        const updated = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((p: any) => !activeTrashIds.has(p.id) && !p.deletedAt);
        const hasRemovals = snap.docChanges().some((c) => c.type === 'removed');
        if (updated.length > 0 || hasRemovals) {
          const cur = window.__APLUS_GET_CURRENT_STATE__?.();
          if (cur) {
            const next = { ...cur, pettyCashTransactions: updated };
            window.__APLUS_HYDRATE_FROM_CLOUD__?.(next);
            syncScheduler?.markHydratedFromCloud({ ...next, schoolClients: getStoredSchoolClients() });
          }
        }
      },
      (err) => console.warn('Petty cash onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubPetty);

    // 3E. Campuses Real-Time Listener (including last-item deletion)
    const unsubCampuses = onSnapshot(
      collection(db, 'organizations', clientId, 'campuses'),
      (snap) => {
        const updated = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((c: any) => !activeTrashIds.has(c.id));
        const hasRemovals = snap.docChanges().some((c) => c.type === 'removed');
        if (updated.length > 0 || hasRemovals) {
          const cur = window.__APLUS_GET_CURRENT_STATE__?.();
          if (cur) {
            const next = { ...cur, campuses: updated };
            window.__APLUS_HYDRATE_FROM_CLOUD__?.(next);
            syncScheduler?.markHydratedFromCloud({ ...next, schoolClients: getStoredSchoolClients() });
          }
        }
      },
      (err) => console.warn('Campuses onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubCampuses);

    // 3F. Chart of Accounts Real-Time Listener
    const unsubCOA = onSnapshot(
      collection(db, 'organizations', clientId, 'account_heads'),
      (snap) => {
        const updated = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((a: any) => !activeTrashIds.has(a.id));
        const hasRemovals = snap.docChanges().some((c) => c.type === 'removed');
        if (updated.length > 0 || hasRemovals) {
          const cur = window.__APLUS_GET_CURRENT_STATE__?.();
          if (cur) {
            const next = { ...cur, accountHeads: updated };
            window.__APLUS_HYDRATE_FROM_CLOUD__?.(next);
            syncScheduler?.markHydratedFromCloud({ ...next, schoolClients: getStoredSchoolClients() });
          }
        }
      },
      (err) => console.warn('COA onSnapshot notice:', err.message)
    );
    activeUnsubscribers.push(unsubCOA);

    // 3G. Global School Clients Registry Real-Time Listener
    const unsubClients = subscribeSchoolClientsFromCloud(() => {
      notify({ lastCloudLoadAt: new Date().toISOString() });
    });
    activeUnsubscribers.push(unsubClients);

    // 3H. Global Users Real-Time Listener (syncs logins live across browsers)
    const unsubGlobalUsers = subscribeToGlobalUsersFromCloud((cloudList) => {
      const cur = window.__APLUS_GET_CURRENT_STATE__?.();
      const merged = mergeUsersWithCloud(cloudList, cur?.users || []);
      syncLocalUsersCache(merged);
      if (cur && cloudList.length > 0) {
        window.__APLUS_HYDRATE_FROM_CLOUD__?.({ ...cur, users: merged });
      }
      notify({ lastCloudLoadAt: new Date().toISOString() });
    });
    activeUnsubscribers.push(unsubGlobalUsers);

  } catch (err: any) {
    console.error('Realtime sync initiation error:', err);
    window.__APLUS_MARK_CLOUD_READY__?.();
    notify({
      status: 'sync_failed',
      message: `Synchronization failed: ${err.message || 'Cannot load tenant cloud records'}`,
    });
  }
}

function mergeUsersWithCloud(cloudUsers: GlobalUserRecord[], localUsers: any[]): any[] {
  if (!cloudUsers || cloudUsers.length === 0) {
    return Array.isArray(localUsers) ? localUsers : [];
  }
  const byId = new Map<string, any>();
  for (const cu of cloudUsers) {
    if (cu?.id) byId.set(cu.id, cu);
  }
  // Ensure currently logged-in root owner stays present if not yet uploaded
  for (const lu of localUsers || []) {
    if (
      lu?.id &&
      (lu.id === 'user-platform-owner' || lu.id === 'usr-admin' || lu.username === 'admin') &&
      !byId.has(lu.id)
    ) {
      byId.set(lu.id, lu);
    }
  }
  return Array.from(byId.values());
}

function syncLocalUsersCache(usersList: any[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const clean = (usersList || []).map((u) => {
      const copy = { ...u };
      delete copy.password;
      return copy;
    });
    localStorage.setItem('ams_users_v5_clean', JSON.stringify(clean));
  } catch {}
}

// ============================================================================
// COMPATIBILITY HELPERS FOR EXISTING APP CALLS
// ============================================================================

export async function pushMasterCloudSnapshot(systemState: any): Promise<void> {
  const fullState = window.__APLUS_GET_CURRENT_STATE__?.() || systemState;
  await saveSnapshotToIndexedDB(fullState, !navigator.onLine);
  const clientId = getEffectiveClientId();

  try {
    notify({ status: 'synchronizing', message: 'Saving master records to Cloud...' });
    const batch = writeBatch(db);

    // Save campuses
    for (const c of (fullState?.campuses || []).slice(0, 30)) {
      if (c?.id) {
        batch.set(
          doc(db, `organizations/${clientId}/campuses`, String(c.id)),
          { ...sanitizeForFirestore(c), clientId },
          { merge: true }
        );
      }
    }

    // Save vouchers
    for (const v of (fullState?.transactions || []).slice(0, 50)) {
      if (v?.id) {
        batch.set(
          doc(db, `organizations/${clientId}/vouchers`, String(v.id)),
          { ...sanitizeForFirestore(v), clientId },
          { merge: true }
        );
      }
    }

    await batch.commit();
    await saveSnapshotToIndexedDB(fullState, false);

    notify({
      status: 'saved_to_cloud',
      lastSyncedAt: new Date().toISOString(),
      message: `Saved to cloud (${fullState?.transactions?.length || 0} Vouchers)`,
    });
  } catch (err: any) {
    notify({
      status: 'sync_failed',
      message: `Synchronization failed: ${err.message || 'Batch commit failed'}`,
    });
  }
}

export async function pullMasterCloudSnapshot(): Promise<any | null> {
  await startCrossBrowserRealtimeSync();
  return window.__APLUS_GET_CURRENT_STATE__?.() || null;
}

export async function saveChecklistStateToCloud(checklistData: any): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'checklist_state'),
      { data: sanitizeForFirestore(checklistData), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadChecklistStateFromCloud(): Promise<any | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'checklist_state'));
    return snap.exists() ? snap.data()?.data : null;
  } catch {
    return null;
  }
}

export async function fetchCloudAuditLogs(): Promise<any[]> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDocs(collection(db, `organizations/${clientId}/audit`));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    return [];
  }
}

export async function saveCashReconciliationToCloud(record: any): Promise<void> {
  if (!record?.id) return;
  const clientId = getEffectiveClientId(record);
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/cash_reconciliations`, String(record.id)),
      { ...sanitizeForFirestore(record), clientId, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function fetchCashReconciliationsFromCloud(): Promise<any[]> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDocs(collection(db, `organizations/${clientId}/cash_reconciliations`));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    return [];
  }
}

export async function saveDepartmentBudgetsToCloud(budgets: Record<string, number>): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'department_budgets'),
      { budgets: sanitizeForFirestore(budgets), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadDepartmentBudgetsFromCloud(): Promise<Record<string, number> | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'department_budgets'));
    return snap.exists() ? snap.data()?.budgets : null;
  } catch {
    return null;
  }
}

export async function saveErpStateToCloud(erpState: any): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'erp_suite_state'),
      { state: sanitizeForFirestore(erpState), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadErpStateFromCloud(): Promise<any | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'erp_suite_state'));
    return snap.exists() ? snap.data()?.state : null;
  } catch {
    return null;
  }
}

export async function saveVisibilityConfigToCloud(config: any): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'visibility_config'),
      { config: sanitizeForFirestore(config), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadVisibilityConfigFromCloud(): Promise<any | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'visibility_config'));
    return snap.exists() ? snap.data()?.config : null;
  } catch {
    return null;
  }
}

export async function wipeAllCloudCollectionsToZero(): Promise<void> {
  // Non-destructive safe guard: clearing cloud records is disabled in production
  console.warn('wipeAllCloudCollectionsToZero prevented by durable production safeguard.');
}

export async function deleteCampusFromCloud(campusId: string): Promise<void> {
  if (window.__APLUS_CLOUD_SYNC__?.deleteCampus) {
    await window.__APLUS_CLOUD_SYNC__.deleteCampus(campusId);
  }
}

export async function saveSignatureConfigToCloud(config: any): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'signatures_config'),
      { config: sanitizeForFirestore(config), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadSignatureConfigFromCloud(): Promise<any | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'signatures_config'));
    return snap.exists() ? snap.data()?.config : null;
  } catch {
    return null;
  }
}

export async function saveRecurringVouchersToCloud(data: any): Promise<void> {
  const clientId = getEffectiveClientId();
  try {
    await setDoc(
      doc(db, `organizations/${clientId}/settings`, 'recurring_vouchers'),
      { data: sanitizeForFirestore(data), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadRecurringVouchersFromCloud(): Promise<any | null> {
  const clientId = getEffectiveClientId();
  try {
    const snap = await getDoc(doc(db, `organizations/${clientId}/settings`, 'recurring_vouchers'));
    return snap.exists() ? snap.data()?.data : null;
  } catch {
    return null;
  }
}

export async function saveMultiSchoolRegistryToCloud(data: any): Promise<void> {
  try {
    await setDoc(
      doc(db, 'system_state', 'school_clients_registry'),
      { clients: sanitizeForFirestore(data), updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {}
}

export async function loadMultiSchoolRegistryFromCloud(): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'school_clients_registry'));
    return snap.exists() ? snap.data()?.clients : null;
  } catch {
    return null;
  }
}

export async function syncVoucher(voucher: any): Promise<void> {
  if (window.__APLUS_CLOUD_SYNC__?.syncVoucher) {
    await window.__APLUS_CLOUD_SYNC__.syncVoucher(voucher);
    return;
  }
  if (!voucher?.id) return;
  const clientId = getEffectiveClientId(voucher);
  const path = `organizations/${clientId}/vouchers/${String(voucher.id)}`;
  await setDoc(doc(db, path), {
    ...sanitizeForFirestore(voucher),
    clientId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export function autoSaveMasterState(state: any): void {
  if (window.__APLUS_CLOUD_SYNC__?.autoSaveMasterState) {
    window.__APLUS_CLOUD_SYNC__.autoSaveMasterState(state);
    return;
  }
  pushMasterCloudSnapshot(state).catch(() => {});
}

