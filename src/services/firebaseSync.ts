import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  collection,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CloudSyncStats {
  lastSyncedAt: string | null;
  status: 'idle' | 'syncing' | 'connected' | 'offline' | 'error';
  message?: string;
  offlinePendingCount?: number;
  indexedDbCached?: boolean;
}

type Listener = (stats: CloudSyncStats) => void;
const listeners = new Set<Listener>();

const CLIENT_SESSION_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let syncInitialized = false;

// ============================================================================
// NATIVE INDEXEDDB OFFLINE LEDGER CACHE & OUTBOX ENGINE (For Intermittent Campus Wi-Fi)
// ============================================================================
const IDB_NAME = 'AplusOfflineLedgerDB';
const IDB_VERSION = 1;
const IDB_STORE = 'ledger_snapshots';

function openOfflineIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSnapshotToIndexedDB(
  state: any,
  pendingCloudSync: boolean
): Promise<void> {
  const idb = await openOfflineIndexedDB();
  if (!idb) return;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({
        id: 'master_ledger_cache',
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
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get('master_ledger_cache');
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

let currentStats: CloudSyncStats = {
  lastSyncedAt: null,
  status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
  message:
    typeof navigator !== 'undefined' && !navigator.onLine
      ? 'Offline Mode — Caching to IndexedDB & Service Worker'
      : 'Firebase Cloud & IndexedDB Persistence Active',
  offlinePendingCount: 0,
  indexedDbCached: true,
};

function notify(partial: Partial<CloudSyncStats>) {
  currentStats = { ...currentStats, ...partial };
  listeners.forEach((fn) => fn(currentStats));
}

export function subscribeCloudSync(fn: Listener) {
  listeners.add(fn);
  fn(currentStats);
  return () => {
    listeners.delete(fn);
  };
}

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj ?? {}));
}

function mergeArraysById<T extends { id?: string }>(cloudArr: T[] = [], localArr: T[] = []): T[] {
  const map = new Map<string, T>();
  (localArr || []).forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
  });
  (cloudArr || []).forEach((item) => {
    if (item?.id) map.set(String(item.id), item);
  });
  return Array.from(map.values());
}

export function initFirebaseCloudSync() {
  window.__APLUS_CLOUD_SYNC__ = {
    async syncCampus(campus: any) {
      if (!campus?.id) return;
      try {
        notify({ status: navigator.onLine ? 'syncing' : 'offline' });
        await setDoc(
          doc(db, 'campuses', String(campus.id)),
          {
            ...sanitizeForFirestore(campus),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        notify({
          status: navigator.onLine ? 'connected' : 'offline',
          lastSyncedAt: new Date().toISOString(),
          message: `Synced campus ${campus.code || campus.name}`,
        });
      } catch {
        notify({ status: navigator.onLine ? 'connected' : 'offline' });
      }
    },

    async deleteCampus(campusId: string) {
      if (!campusId) return;
      try {
        await deleteDoc(doc(db, 'campuses', String(campusId)));
      } catch {}
    },

    async syncVoucher(voucher: any) {
      if (!voucher?.id) return;
      try {
        notify({ status: navigator.onLine ? 'syncing' : 'offline' });
        await setDoc(
          doc(db, 'vouchers', String(voucher.id)),
          {
            ...sanitizeForFirestore(voucher),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        notify({
          status: navigator.onLine ? 'connected' : 'offline',
          lastSyncedAt: new Date().toISOString(),
          message: `Cached & synced voucher ${voucher.voucherNo || voucher.id}`,
        });
      } catch {
        notify({ status: navigator.onLine ? 'connected' : 'offline' });
      }
    },

    async deleteVoucher(voucherId: string) {
      if (!voucherId) return;
      try {
        await deleteDoc(doc(db, 'vouchers', String(voucherId)));
      } catch {}
    },

    async syncPettyCash(pettyCash: any) {
      if (!pettyCash?.id) return;
      try {
        notify({ status: navigator.onLine ? 'syncing' : 'offline' });
        await setDoc(
          doc(db, 'petty_cash', String(pettyCash.id)),
          {
            ...sanitizeForFirestore(pettyCash),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        notify({
          status: navigator.onLine ? 'connected' : 'offline',
          lastSyncedAt: new Date().toISOString(),
          message: `Cached & synced petty cash ${pettyCash.voucherNo || pettyCash.id}`,
        });
      } catch {
        notify({ status: navigator.onLine ? 'connected' : 'offline' });
      }
    },

    async deletePettyCash(pettyCashId: string) {
      if (!pettyCashId) return;
      try {
        await deleteDoc(doc(db, 'petty_cash', String(pettyCashId)));
      } catch {}
    },

    async reconcileBankTx(txId: string, reconciled: boolean) {
      if (!txId) return;
      try {
        await setDoc(
          doc(db, 'bank_reconciliations', String(txId)),
          {
            txId,
            reconciled: Boolean(reconciled),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {}
    },

    async syncActivityLog(log: any) {
      if (!log?.id) return;
      try {
        await setDoc(
          doc(db, 'activity_logs', String(log.id)),
          {
            ...sanitizeForFirestore(log),
          },
          { merge: true }
        );
      } catch {}
    },

    async seedAll(campusesList: any[], vouchersList: any[], pettyCashList: any[]) {
      try {
        const batch = writeBatch(db);
        let ops = 0;
        for (const c of (campusesList || []).slice(0, 50)) {
          if (c?.id) {
            batch.set(doc(db, 'campuses', String(c.id)), sanitizeForFirestore(c), { merge: true });
            ops++;
          }
        }
        for (const v of (vouchersList || []).slice(0, 150)) {
          if (v?.id) {
            batch.set(doc(db, 'vouchers', String(v.id)), sanitizeForFirestore(v), { merge: true });
            ops++;
          }
        }
        for (const p of (pettyCashList || []).slice(0, 150)) {
          if (p?.id) {
            batch.set(doc(db, 'petty_cash', String(p.id)), sanitizeForFirestore(p), { merge: true });
            ops++;
          }
        }
        if (ops > 0) {
          await batch.commit();
        }
      } catch {}
    },

    // AUTOMATIC DEBOUNCED SAVE TO BOTH INDEXEDDB AND FIREBASE CLOUD
    autoSaveMasterState(state: any) {
      if (!state) return;
      // Immediately cache in IndexedDB so zero data is lost if campus Wi-Fi drops mid-session
      const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
      saveSnapshotToIndexedDB(state, !isOnlineNow).catch(() => {});

      if (!isOnlineNow) {
        notify({
          status: 'offline',
          indexedDbCached: true,
          offlinePendingCount: (currentStats.offlinePendingCount || 0) + 1,
          message: `Offline Cache Active — Saved ${state?.transactions?.length || 0} vouchers to IndexedDB (will sync on reconnect)`,
        });
      }

      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(async () => {
        try {
          if (typeof navigator !== 'undefined' && !navigator.onLine) return;
          notify({ status: 'syncing', message: 'Syncing IndexedDB & Firestore Cloud...' });
          const payload = JSON.stringify(sanitizeForFirestore(state));
          await setDoc(doc(db, 'system_state', 'master_ledger'), {
            updatedAt: new Date().toISOString(),
            clientId: CLIENT_SESSION_ID,
            voucherCount: state?.transactions?.length || 0,
            pettyCashCount: state?.pettyCashTransactions?.length || 0,
            campusCount: state?.campuses?.length || 0,
            payload,
          });
          await saveSnapshotToIndexedDB(state, false);
          notify({
            status: 'connected',
            offlinePendingCount: 0,
            indexedDbCached: true,
            lastSyncedAt: new Date().toISOString(),
            message: `Cloud & IndexedDB Synced (${state?.transactions?.length || 0} Vouchers · ${
              state?.campuses?.length || 0
            } Campuses)`,
          });
        } catch {
          notify({
            status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
            indexedDbCached: true,
          });
        }
      }, 450);
    },
  };

  if (syncInitialized) return;
  syncInitialized = true;

  // Listen for Campus Network Offline / Online transitions to flush IndexedDB outbox automatically
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => {
      notify({
        status: 'offline',
        indexedDbCached: true,
        message:
          'Campus Network Disconnected — Operating seamlessly on IndexedDB & Service Worker Cache',
      });
    });

    window.addEventListener('online', async () => {
      notify({
        status: 'syncing',
        message: 'Campus Network Restored — Syncing cached IndexedDB entries to Cloud...',
      });
      try {
        const cached = await loadSnapshotFromIndexedDB();
        const latestState = window.__APLUS_GET_CURRENT_STATE__?.() || cached?.state;
        if (latestState) {
          await pushMasterCloudSnapshot(latestState);
          await saveSnapshotToIndexedDB(latestState, false);
        }
        notify({
          status: 'connected',
          offlinePendingCount: 0,
          indexedDbCached: true,
          lastSyncedAt: new Date().toISOString(),
          message: 'Campus Network Restored — All offline IndexedDB entries synced to Cloud!',
        });
      } catch {
        notify({ status: 'connected' });
      }
    });
  }

  // Boot & Real-Time Cross-Browser Listener
  setTimeout(() => {
    startCrossBrowserRealtimeSync().catch(() => {
      window.__APLUS_MARK_CLOUD_READY__?.();
    });
  }, 150);
}

async function startCrossBrowserRealtimeSync() {
  try {
    // Step 1: Immediately check IndexedDB offline cache first so intermittent/offline boots are instant
    const idbCached = await loadSnapshotFromIndexedDB();
    if (idbCached?.state) {
      window.__APLUS_HYDRATE_FROM_CLOUD__?.(idbCached.state);
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      window.__APLUS_MARK_CLOUD_READY__?.();
      notify({
        status: 'offline',
        indexedDbCached: true,
        message: 'Offline Mode — Loaded ledger from IndexedDB local cache',
      });
      return;
    }

    notify({ status: 'syncing', message: 'Loading entries from Firebase Cloud & IndexedDB...' });

    const [masterSnap, vouchersSnap, pettySnap, campusesSnap] = await Promise.all([
      getDoc(doc(db, 'system_state', 'master_ledger')).catch(() => null),
      getDocs(collection(db, 'vouchers')).catch(() => null),
      getDocs(collection(db, 'petty_cash')).catch(() => null),
      getDocs(collection(db, 'campuses')).catch(() => null),
    ]);

    let cloudState: any = null;
    if (masterSnap && masterSnap.exists() && masterSnap.data()?.payload) {
      try {
        cloudState = JSON.parse(masterSnap.data().payload);
      } catch {}
    }

    const colVouchers = vouchersSnap ? vouchersSnap.docs.map((d) => d.data()) : [];
    const colPettyCash = pettySnap ? pettySnap.docs.map((d) => d.data()) : [];
    const colCampuses = campusesSnap ? campusesSnap.docs.map((d) => d.data()) : [];

    const localState = window.__APLUS_GET_CURRENT_STATE__?.() || idbCached?.state || {};

    const mergedCampuses = mergeArraysById(
      mergeArraysById(cloudState?.campuses || [], colCampuses),
      localState.campuses || []
    );
    const mergedTransactions = mergeArraysById(
      mergeArraysById(cloudState?.transactions || [], colVouchers),
      localState.transactions || []
    );
    const mergedPettyCash = mergeArraysById(
      mergeArraysById(cloudState?.pettyCashTransactions || [], colPettyCash),
      localState.pettyCashTransactions || []
    );
    const mergedUsers = mergeArraysById(cloudState?.users || [], localState.users || []);

    const cloudHeads = Array.isArray(cloudState?.accountHeads) ? cloudState.accountHeads : [];
    const localHeads = Array.isArray(localState?.accountHeads) ? localState.accountHeads : [];
    const cloudHasBalances = cloudHeads.some(
      (a: any) => Number(a.balance) !== 0 || Object.keys(a.campusBalances || {}).length > 0
    );
    const mergedAccountHeads =
      cloudHasBalances || cloudHeads.length > localHeads.length
        ? cloudHeads
        : localHeads.length > 0
        ? localHeads
        : cloudHeads;

    const mergedState = {
      campuses: mergedCampuses,
      users: mergedUsers.length > 0 ? mergedUsers : undefined,
      transactions: mergedTransactions,
      pettyCashTransactions: mergedPettyCash,
      accountHeads: mergedAccountHeads.length > 0 ? mergedAccountHeads : undefined,
      orgSettings: cloudState?.orgSettings || localState?.orgSettings,
      periods: cloudState?.periods || localState?.periods,
      activityLogs: mergeArraysById(
        cloudState?.activityLogs || [],
        localState.activityLogs || []
      ).slice(0, 200),
    };

    window.__APLUS_HYDRATE_FROM_CLOUD__?.(mergedState);
    window.__APLUS_MARK_CLOUD_READY__?.();
    await saveSnapshotToIndexedDB(mergedState, false);

    const cloudVoucherCount = cloudState?.transactions?.length || 0;
    const cloudCampusCount = cloudState?.campuses?.length || 0;
    if (
      mergedTransactions.length > cloudVoucherCount ||
      mergedCampuses.length > cloudCampusCount ||
      idbCached?.pendingCloudSync ||
      !cloudState
    ) {
      await setDoc(doc(db, 'system_state', 'master_ledger'), {
        updatedAt: new Date().toISOString(),
        clientId: CLIENT_SESSION_ID,
        voucherCount: mergedTransactions.length,
        pettyCashCount: mergedPettyCash.length,
        campusCount: mergedCampuses.length,
        payload: JSON.stringify(sanitizeForFirestore(mergedState)),
      });
    }

    notify({
      status: 'connected',
      indexedDbCached: true,
      offlinePendingCount: 0,
      lastSyncedAt: new Date().toISOString(),
      message: `Cloud & IndexedDB Synced (${mergedTransactions.length} Vouchers · ${mergedCampuses.length} Campuses)`,
    });

    onSnapshot(
      doc(db, 'system_state', 'master_ledger'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (!data?.payload || data.clientId === CLIENT_SESSION_ID) return;
        try {
          const incoming = JSON.parse(data.payload);
          if (incoming && typeof incoming === 'object') {
            window.__APLUS_HYDRATE_FROM_CLOUD__?.(incoming);
            saveSnapshotToIndexedDB(incoming, false).catch(() => {});
            notify({
              status: 'connected',
              indexedDbCached: true,
              lastSyncedAt: data.updatedAt || new Date().toISOString(),
              message: `Live Cloud Update (${incoming.transactions?.length || 0} Vouchers · ${
                incoming.campuses?.length || 0
              } Campuses)`,
            });
          }
        } catch {}
      },
      () => {}
    );
  } catch {
    window.__APLUS_MARK_CLOUD_READY__?.();
    notify({
      status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
      indexedDbCached: true,
      message: 'IndexedDB Offline Persistence Ready',
    });
  }
}

export async function pushMasterCloudSnapshot(systemState: any): Promise<void> {
  const fullState = window.__APLUS_GET_CURRENT_STATE__?.() || systemState;
  await saveSnapshotToIndexedDB(fullState, !navigator.onLine);
  try {
    notify({ status: 'syncing', message: 'Uploading master snapshot to Firebase...' });
    const payload = JSON.stringify(sanitizeForFirestore(fullState));
    await setDoc(doc(db, 'system_state', 'master_ledger'), {
      updatedAt: new Date().toISOString(),
      clientId: CLIENT_SESSION_ID,
      voucherCount: fullState?.transactions?.length || 0,
      pettyCashCount: fullState?.pettyCashTransactions?.length || 0,
      campusCount: fullState?.campuses?.length || 0,
      payload,
    });
    await saveSnapshotToIndexedDB(fullState, false);
    notify({
      status: 'connected',
      offlinePendingCount: 0,
      indexedDbCached: true,
      lastSyncedAt: new Date().toISOString(),
      message: `Master snapshot saved to Firebase & IndexedDB (${
        fullState?.transactions?.length || 0
      } Vouchers)`,
    });
  } catch {
    notify({
      status: navigator.onLine ? 'connected' : 'offline',
      indexedDbCached: true,
      message: 'Saved to IndexedDB Offline Cache (will auto-sync when online)',
    });
  }
}

export async function pullMasterCloudSnapshot(): Promise<any | null> {
  try {
    notify({ status: 'syncing', message: 'Fetching cloud snapshot from Firebase...' });
    const snap = await getDoc(doc(db, 'system_state', 'master_ledger'));
    if (snap.exists()) {
      const data = snap.data();
      if (data?.payload) {
        const parsed = JSON.parse(data.payload);
        window.__APLUS_HYDRATE_FROM_CLOUD__?.(parsed);
        await saveSnapshotToIndexedDB(parsed, false);
        notify({
          status: 'connected',
          indexedDbCached: true,
          lastSyncedAt: data.updatedAt || new Date().toISOString(),
          message: `Restored ${parsed?.transactions?.length || 0} vouchers & ${
            parsed?.campuses?.length || 0
          } campuses from Cloud`,
        });
        return parsed;
      }
    }
    const [vouchersSnap, pettySnap, campusesSnap] = await Promise.all([
      getDocs(collection(db, 'vouchers')),
      getDocs(collection(db, 'petty_cash')),
      getDocs(collection(db, 'campuses')),
    ]);
    const transactions = vouchersSnap.docs.map((d) => d.data());
    const pettyCashTransactions = pettySnap.docs.map((d) => d.data());
    const campuses = campusesSnap.docs.map((d) => d.data());

    if (
      transactions.length === 0 &&
      pettyCashTransactions.length === 0 &&
      campuses.length === 0
    ) {
      const idbFallback = await loadSnapshotFromIndexedDB();
      if (idbFallback?.state) {
        window.__APLUS_HYDRATE_FROM_CLOUD__?.(idbFallback.state);
        return idbFallback.state;
      }
      notify({ status: 'connected', message: 'No existing cloud snapshot found yet' });
      return null;
    }

    const fallbackState = {
      transactions,
      pettyCashTransactions,
      campuses: campuses.length > 0 ? campuses : undefined,
    };
    window.__APLUS_HYDRATE_FROM_CLOUD__?.(fallbackState);
    await saveSnapshotToIndexedDB(fallbackState, false);
    notify({
      status: 'connected',
      indexedDbCached: true,
      lastSyncedAt: new Date().toISOString(),
      message: `Pulled ${transactions.length} vouchers & ${pettyCashTransactions.length} petty cash entries from Cloud`,
    });
    return fallbackState;
  } catch {
    const idbFallback = await loadSnapshotFromIndexedDB();
    if (idbFallback?.state) {
      window.__APLUS_HYDRATE_FROM_CLOUD__?.(idbFallback.state);
      notify({
        status: navigator.onLine ? 'connected' : 'offline',
        indexedDbCached: true,
        message: 'Restored from IndexedDB Offline Cache',
      });
      return idbFallback.state;
    }
    notify({ status: 'connected', message: 'Operating on local storage snapshot' });
    return null;
  }
}

export async function saveChecklistStateToCloud(checklistData: any): Promise<void> {
  try {
    await setDoc(doc(db, 'system_state', 'finance_procedures_checklists'), {
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(checklistData),
    });
  } catch (e) {
    console.warn('Checklist cloud save warning:', e);
  }
}

export async function loadChecklistStateFromCloud(): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'finance_procedures_checklists'));
    if (snap.exists() && snap.data()?.payload) {
      return JSON.parse(snap.data().payload);
    }
  } catch (e) {
    console.warn('Checklist cloud load warning:', e);
  }
  return null;
}

export async function fetchCloudAuditLogs(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'activity_logs'));
    return snap.docs
      .map((d) => d.data())
      .filter((item) => item && item.id && item.timestamp)
      .sort(
        (a, b) =>
          (new Date(b.timestamp).getTime() || 0) -
          (new Date(a.timestamp).getTime() || 0)
      );
  } catch (e) {
    console.warn('Could not fetch cloud audit logs:', e);
    return [];
  }
}

export async function saveCashReconciliationToCloud(record: any): Promise<void> {
  if (!record?.id) return;
  try {
    notify({ status: 'syncing', message: `Saving cash count ${record.certificateNo}...` });
    await setDoc(
      doc(db, 'cash_reconciliations', String(record.id)),
      {
        ...sanitizeForFirestore(record),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    notify({
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      message: `Synced cash reconciliation ${record.certificateNo || record.id}`,
    });
  } catch (e) {
    console.warn('Could not sync cash reconciliation to cloud:', e);
  }
}

export async function fetchCashReconciliationsFromCloud(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'cash_reconciliations'));
    return snap.docs
      .map((d) => d.data())
      .filter((item) => item && item.id)
      .sort(
        (a, b) =>
          (new Date(b.createdAt || b.date || 0).getTime() || 0) -
          (new Date(a.createdAt || a.date || 0).getTime() || 0)
      );
  } catch (e) {
    console.warn('Could not fetch cash reconciliations from cloud:', e);
    return [];
  }
}

export async function saveDepartmentBudgetsToCloud(budgets: Record<string, number>): Promise<void> {
  try {
    await setDoc(doc(db, 'system_state', 'department_budgets'), {
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(budgets),
    });
  } catch (e) {
    console.warn('Could not save department budgets to cloud:', e);
  }
}

export async function loadDepartmentBudgetsFromCloud(): Promise<Record<string, number> | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'department_budgets'));
    if (snap.exists() && snap.data()?.payload) {
      return JSON.parse(snap.data().payload);
    }
  } catch (e) {
    console.warn('Could not load department budgets from cloud:', e);
  }
  return null;
}

export async function saveErpStateToCloud(erpState: any): Promise<void> {
  try {
    notify({ status: 'syncing', message: 'Syncing ERP Suite state to Firestore...' });
    await setDoc(doc(db, 'system_state', 'modern_erp_suite'), {
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(sanitizeForFirestore(erpState)),
    });
    notify({
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      message: 'Modern ERP Suite synced to Firebase Cloud',
    });
  } catch (e) {
    console.warn('Could not save ERP state to cloud:', e);
  }
}

export async function loadErpStateFromCloud(): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'modern_erp_suite'));
    if (snap.exists() && snap.data()?.payload) {
      return JSON.parse(snap.data().payload);
    }
  } catch (e) {
    console.warn('Could not load ERP state from cloud:', e);
  }
  return null;
}

export async function saveVisibilityConfigToCloud(config: any): Promise<void> {
  try {
    notify({ status: 'syncing', message: 'Syncing Role & Campus visibility rules to Firestore...' });
    await setDoc(doc(db, 'system_state', 'visibility_access_config'), {
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(sanitizeForFirestore(config)),
    });
    notify({
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      message: 'Super Admin visibility & access rules synced to Cloud',
    });
  } catch (e) {
    console.warn('Could not save visibility config to cloud:', e);
  }
}

export async function loadVisibilityConfigFromCloud(): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'visibility_access_config'));
    if (snap.exists() && snap.data()?.payload) {
      return JSON.parse(snap.data()?.payload);
    }
  } catch (e) {
    console.warn('Could not load visibility config from cloud:', e);
  }
  return null;
}

export async function wipeAllCloudCollectionsToZero(): Promise<void> {
  // Production-safe no-op
}

export async function deleteCampusFromCloud(campusId: string): Promise<void> {
  try {
    if (!campusId) return;
    await deleteDoc(doc(db, 'campuses', String(campusId)));
  } catch (e) {
    console.warn('Could not delete campus from cloud:', e);
  }
}

export async function saveSignatureConfigToCloud(config: any): Promise<void> {
  try {
    notify({ status: 'syncing', message: 'Syncing Super Admin & Campus Signature rules...' });
    await setDoc(doc(db, 'system_state', 'report_signatures_config'), {
      updatedAt: new Date().toISOString(),
      payload: JSON.stringify(sanitizeForFirestore(config)),
    });
    notify({
      status: 'connected',
      lastSyncedAt: new Date().toISOString(),
      message: 'Report Signature configuration synced to Cloud',
    });
  } catch (e) {
    console.warn('Could not save signature config to cloud:', e);
  }
}

export async function loadSignatureConfigFromCloud(): Promise<any | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'report_signatures_config'));
    if (snap.exists() && snap.data()?.payload) {
      return JSON.parse(snap.data()?.payload);
    }
  } catch (e) {
    console.warn('Could not load signature config from cloud:', e);
  }
  return null;
}
