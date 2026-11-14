import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { AccountHead, Campus } from '../core/aplusEngine';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';
import {
  getStoredSchoolClients,
  saveStoredSchoolClients,
  syncSchoolClientsToCloud,
  type SchoolClientOrganization,
} from './platformSiteAdminService';
import { getVerifiedProfile } from './secureAuthentication';
import { clearAllRecentVoucherSearches } from './recentSearchesIndexedDb';
import {
  OFFICIAL_157_CHART_OF_ACCOUNTS,
  mergeOfficial157ChartOfAccounts,
  buildZeroedOfficial157ChartOfAccounts,
} from '../data/officialChartOfAccounts157';

export const ACCOUNT_HEADS_STORAGE_KEY = 'ams_account_heads_v8_157_grouped_coa';

export const OPERATIONAL_LOCAL_STORAGE_KEYS = [
  'ams_transactions_v5_clean',
  'ams_petty_cash_v5_clean',
  'ams_activity_logs_v5_clean',
  'ams_reconciled_bank_tx_v5',
  'ams_read_notifications_v5',
  'ams_dismissed_notifications_v5',
  'ams_backup_snapshots_v1',
  'ams_last_automatic_ledger_backup',
  'aplus_modern_erp_suite_zero_scratch_v1',
  'aplus_global_recycle_bin_v2',
  'aplus_recovery_audit_trail_v2',
  'aplus_campus_login_activities_v2',
  'aplus_platform_security_audit_logs_v1',
  'ams_deleted_account_heads_bin',
  'ams_transactions_v4',
  'ams_transactions_v3',
  'ams_transactions_v2',
  'ams_petty_cash_v2',
];

export interface ZeroDataResetReport {
  executedAt: string;
  dataResetEpoch: number;
  organizationsPreserved: number;
  mainCampusesPreserved: number;
  globalUsersPreserved: number;
  accountHeadsImported: number;
  subCampusesDeleted: number;
  vouchersDeleted: number;
  pettyCashDeleted: number;
  trashDeleted: number;
  auditsDeleted: number;
  reconciliationsDeleted: number;
  collectionsCleared: string[];
}

export interface Import157CoaResult {
  totalOfficial: number;
  added: number;
  updated: number;
  headsCount: number;
  syncedOrganizations: number;
  heads: AccountHead[];
}

function isPermissionError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return code === 'permission-denied' || msg.includes('Missing or insufficient permissions');
}

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj ?? {}, (key, value) =>
      /^(password|passwordHash|dynamicToken|idToken|refreshToken)$/i.test(key) ? undefined : value
    )
  );
}

/**
 * Pure helper: collects all unique organization IDs across client registry, campuses, and active profile.
 */
export function collectAllTargetOrganizationIds(
  clients: SchoolClientOrganization[] = [],
  campuses: Campus[] = [],
  activeClientId?: string | null
): string[] {
  const ids = new Set<string>(['client-aplus']);
  if (activeClientId && activeClientId.trim()) {
    ids.add(activeClientId.trim());
  }
  for (const c of clients || []) {
    if (c?.id && String(c.id).trim()) {
      ids.add(String(c.id).trim());
    }
  }
  for (const camp of campuses || []) {
    const cid = (camp as any)?.clientId;
    if (cid && String(cid).trim()) {
      ids.add(String(cid).trim());
    }
  }
  return Array.from(ids);
}

/**
 * Pure helper: determines whether a campus node is a Main Campus (MUST be preserved on selective wipe).
 * Sub-campuses always have a non-empty parentCampusId and are not flagged isMainCampus.
 */
export function isPreservedMainCampus(
  campus: Partial<Campus> & { isMainCampus?: boolean; parentCampusId?: string | null },
  clients: SchoolClientOrganization[] = []
): boolean {
  if (!campus || !campus.id) return false;
  if ((clients || []).some((cl) => cl?.mainCampusId && cl.mainCampusId === campus.id)) {
    return true;
  }
  if (campus.isMainCampus === true) {
    return true;
  }
  return !campus.parentCampusId || campus.parentCampusId === 'none';
}

/**
 * Pure helper: keeps only Main Campuses and resets their petty cash balance back to configured float (or 0).
 */
export function filterPreservedMainCampuses(
  campuses: Campus[] = [],
  clients: SchoolClientOrganization[] = []
): Campus[] {
  return (campuses || [])
    .filter((c) => isPreservedMainCampus(c as any, clients))
    .map((c) => ({
      ...c,
      isMainCampus: true,
      parentCampusId: null,
      currentPettyCash: Number((c as any).pettyCashFloat) || 0,
    }));
}

/**
 * Pure helper: resets balances of AccountHead records to 0 while keeping the full Chart of Accounts structure.
 */
export function zeroOutAccountHeads(accountHeads: AccountHead[] = []): AccountHead[] {
  const source =
    Array.isArray(accountHeads) && accountHeads.length > 0
      ? accountHeads
      : OFFICIAL_157_CHART_OF_ACCOUNTS;
  return source.map((h) => ({
    ...h,
    balance: 0,
    openingBalance: 0,
    openingDebit: 0,
    openingCredit: 0,
    campusBalances: {},
    campusDebitBalances: {},
    campusCreditBalances: {},
  })) as AccountHead[];
}

/**
 * Pure helper: builds a clean zero-data live_state snapshot preserving Main Campuses, periods, orgSettings & 157 COA.
 */
export function buildZeroDataLiveSnapshot(params: {
  clientId: string;
  campuses: Campus[];
  accountHeads: AccountHead[];
  periods?: any[];
  orgSettings?: any;
  dataResetEpoch: number;
  nowIso?: string;
}) {
  const nowIso = params.nowIso || new Date().toISOString();
  return {
    clientId: params.clientId,
    updatedAt: nowIso,
    dataResetEpoch: params.dataResetEpoch,
    transactions: [],
    pettyCashTransactions: [],
    campuses: params.campuses,
    accountHeads: params.accountHeads,
    activityLogs: [],
    reconciledBankTxIds: {},
    backupSnapshots: [],
    periods: Array.isArray(params.periods) ? params.periods : [],
    orgSettings: params.orgSettings || {},
  };
}

async function commitBatchedOperations(
  ops: Array<{
    type: 'set' | 'delete';
    ref: DocumentReference;
    data?: any;
    merge?: boolean;
  }>,
  contextPath: string
): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.merge) {
        batch.set(op.ref, op.data, { merge: true });
      } else {
        batch.set(op.ref, op.data);
      }
    }
    try {
      await batch.commit();
    } catch (err: any) {
      if (isPermissionError(err)) {
        handleFirestoreError(
          err,
          chunk[0]?.type === 'delete' ? OperationType.DELETE : OperationType.WRITE,
          contextPath
        );
      }
      throw err;
    }
  }
}

async function deleteAllDocsInSubcollection(path: string): Promise<number> {
  let deletedCount = 0;
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) return 0;
    const ops = snap.docs.map((d) => ({
      type: 'delete' as const,
      ref: d.ref,
    }));
    await commitBatchedOperations(ops, path);
    deletedCount = snap.docs.length;
  } catch (err: any) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
  return deletedCount;
}

async function clearIndexedDbStoresAfterReset(hydratedState: any): Promise<void> {
  try {
    await clearAllRecentVoucherSearches();
  } catch {}

  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  await new Promise<void>((resolve) => {
    try {
      const req = window.indexedDB.open('AplusMultiTenantOfflineDB_v2', 2);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains('tenant_snapshots')) {
          database.createObjectStore('tenant_snapshots', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('offline_outbox')) {
          database.createObjectStore('offline_outbox', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        try {
          const database = req.result;
          const profile = getVerifiedProfile();
          const key = `tenant_cache_${profile?.id || 'anon'}_${profile?.clientId || 'client-aplus'}`;
          const tx = database.transaction(['offline_outbox', 'tenant_snapshots'], 'readwrite');
          tx.objectStore('offline_outbox').clear();
          tx.objectStore('tenant_snapshots').put({
            key,
            updatedAt: new Date().toISOString(),
            pendingCloudSync: false,
            state: JSON.parse(JSON.stringify(hydratedState ?? {})),
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function clearOperationalLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const k of OPERATIONAL_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(k);
    }
    const prefixKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ams_petty_cash_draft_')) {
        prefixKeys.push(k);
      }
    }
    for (const k of prefixKeys) {
      localStorage.removeItem(k);
    }
  } catch {}
}

/**
 * Imports and synchronizes all 157 Official Institutional Chart of Accounts heads
 * into both the local engine state and Cloud Firestore (for the active org or all orgs).
 */
export async function importAll157ChartOfAccountsToCloud(options?: {
  clientId?: string;
  includeAllOrganizations?: boolean;
  zeroBalances?: boolean;
  existingAccountHeads?: AccountHead[];
}): Promise<Import157CoaResult> {
  const curState =
    typeof window !== 'undefined' ? window.__APLUS_GET_CURRENT_STATE__?.() : null;
  const baseHeads: AccountHead[] =
    options?.existingAccountHeads ||
    curState?.accountHeads ||
    [];

  const mergedRes = options?.zeroBalances
    ? {
        merged: buildZeroedOfficial157ChartOfAccounts(),
        added: OFFICIAL_157_CHART_OF_ACCOUNTS.length,
        updated: 0,
        totalOfficial: OFFICIAL_157_CHART_OF_ACCOUNTS.length,
      }
    : mergeOfficial157ChartOfAccounts(baseHeads);

  const finalHeads = mergedRes.merged;

  // 1. Update localStorage & React engine immediately
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ACCOUNT_HEADS_STORAGE_KEY, JSON.stringify(finalHeads));
    } catch {}
    if (curState && window.__APLUS_HYDRATE_FROM_CLOUD__) {
      window.__APLUS_HYDRATE_FROM_CLOUD__({
        ...curState,
        accountHeads: finalHeads,
      });
    }
  }

  let syncedOrganizations = 0;

  // 2. Persist all 157 heads to Firestore if authenticated
  if (auth.currentUser) {
    const profile = getVerifiedProfile();
    const clients = getStoredSchoolClients();
    const activeClientId = options?.clientId || profile?.clientId || 'client-aplus';
    const targetOrgs = options?.includeAllOrganizations
      ? collectAllTargetOrganizationIds(clients, curState?.campuses || [], activeClientId)
      : [activeClientId];

    const nowIso = new Date().toISOString();

    for (const orgId of targetOrgs) {
      const subPath = `organizations/${orgId}/account_heads`;
      let orgHeadsToWrite = finalHeads;

      // For other orgs when merging (not zeroing), merge against their existing Firestore COA
      if (orgId !== activeClientId && !options?.zeroBalances) {
        try {
          const existingSnap = await getDocs(collection(db, subPath));
          const existingOrgHeads = existingSnap.docs.map(
            (d) => ({ ...d.data(), id: d.id } as AccountHead)
          );
          orgHeadsToWrite = mergeOfficial157ChartOfAccounts(existingOrgHeads).merged;
        } catch (err: any) {
          if (isPermissionError(err)) {
            handleFirestoreError(err, OperationType.GET, subPath);
          }
        }
      }

      const ops: Array<{
        type: 'set' | 'delete';
        ref: DocumentReference;
        data?: any;
        merge?: boolean;
      }> = orgHeadsToWrite.map((head) => ({
        type: 'set' as const,
        ref: doc(db, 'organizations', orgId, 'account_heads', String(head.id)),
        data: {
          ...sanitizeForFirestore(head),
          clientId: orgId,
          updatedAt: nowIso,
        },
        merge: true,
      }));

      // Also update live_state snapshot so secondary browsers pick it up in <1s
      ops.push({
        type: 'set' as const,
        ref: doc(db, 'organizations', orgId, 'snapshots', 'live_state'),
        data: {
          clientId: orgId,
          accountHeads: sanitizeForFirestore(orgHeadsToWrite),
          coaImportedAt: nowIso,
          updatedAt: nowIso,
        },
        merge: true,
      });

      await commitBatchedOperations(ops, subPath);
      syncedOrganizations++;
    }
  }

  return {
    totalOfficial: OFFICIAL_157_CHART_OF_ACCOUNTS.length,
    added: mergedRes.added,
    updated: mergedRes.updated,
    headsCount: finalHeads.length,
    syncedOrganizations,
    heads: finalHeads,
  };
}

/**
 * Production Zero-Data Selective Reset:
 * Deletes all transactional/demo/operational records (vouchers, petty cash, sub-campuses,
 * trash, audit logs, reconciliations, offline queues, recent search history) while STRICTLY
 * preserving ("ignoring"):
 *  - Organizations (school_clients_registry)
 *  - Main Campuses (campuses with isMainCampus or no parentCampusId)
 *  - Global Users (global_users, login_directory, memberships, ams_users_v5_clean)
 *  - All 157 Official Chart of Accounts (reset to Rs. 0 balances)
 */
export async function wipeOperationalDataPreserveCoreStructure(): Promise<ZeroDataResetReport> {
  const nowIso = new Date().toISOString();
  const dataResetEpoch = Date.now();
  const curState =
    typeof window !== 'undefined' ? window.__APLUS_GET_CURRENT_STATE__?.() || {} : {};
  const clients = getStoredSchoolClients();
  const profile = getVerifiedProfile();
  const activeClientId = profile?.clientId || 'client-aplus';
  const targetOrgIds = collectAllTargetOrganizationIds(
    clients,
    curState?.campuses || [],
    activeClientId
  );

  const zeroedCoa157 = buildZeroedOfficial157ChartOfAccounts();
  const localPreservedMainCampuses = filterPreservedMainCampuses(
    curState?.campuses || [],
    clients
  );

  let vouchersDeleted = 0;
  let pettyCashDeleted = 0;
  let trashDeleted = 0;
  let auditsDeleted = 0;
  let reconciliationsDeleted = 0;
  let subCampusesDeleted = 0;
  let totalMainCampusesPreserved = localPreservedMainCampuses.length;
  const collectionsCleared = new Set<string>();

  if (auth.currentUser) {
    const mainCampusesMap = new Map<string, Campus>();
    for (const mc of localPreservedMainCampuses) {
      mainCampusesMap.set(mc.id, mc);
    }

    for (const orgId of targetOrgIds) {
      // 1. Delete operational subcollections
      vouchersDeleted += await deleteAllDocsInSubcollection(`organizations/${orgId}/vouchers`);
      collectionsCleared.add(`organizations/${orgId}/vouchers`);

      pettyCashDeleted += await deleteAllDocsInSubcollection(`organizations/${orgId}/petty_cash`);
      collectionsCleared.add(`organizations/${orgId}/petty_cash`);

      trashDeleted += await deleteAllDocsInSubcollection(`organizations/${orgId}/trash`);
      collectionsCleared.add(`organizations/${orgId}/trash`);

      auditsDeleted += await deleteAllDocsInSubcollection(`organizations/${orgId}/audit`);
      collectionsCleared.add(`organizations/${orgId}/audit`);

      reconciliationsDeleted += await deleteAllDocsInSubcollection(
        `organizations/${orgId}/bank_reconciliations`
      );
      reconciliationsDeleted += await deleteAllDocsInSubcollection(
        `organizations/${orgId}/cash_reconciliations`
      );
      collectionsCleared.add(`organizations/${orgId}/reconciliations`);

      // Delete operational settings docs (preserve core visibility_config & signatures_config)
      const operationalSettingsIds = [
        'erp_suite_state',
        'department_budgets',
        'checklist_state',
        'recurring_vouchers',
        'disaster_recovery_backup',
      ];
      await commitBatchedOperations(
        operationalSettingsIds.map((docId) => ({
          type: 'delete' as const,
          ref: doc(db, 'organizations', orgId, 'settings', docId),
        })),
        `organizations/${orgId}/settings`
      );

      // 2. Campuses: KEEP Main Campuses (pettyCash reset to float), DELETE Sub-Campuses & sub-campus credentials
      const campusesPath = `organizations/${orgId}/campuses`;
      let orgMainCampuses: Campus[] = [];
      try {
        const campSnap = await getDocs(collection(db, campusesPath));
        const campusOps: Array<{
          type: 'set' | 'delete';
          ref: DocumentReference;
          data?: any;
          merge?: boolean;
        }> = [];
        const credOps: Array<{
          type: 'delete';
          ref: DocumentReference;
        }> = [];

        for (const d of campSnap.docs) {
          const campData = { ...d.data(), id: d.id } as Campus;
          if (isPreservedMainCampus(campData as any, clients)) {
            const cleanMain: Campus = {
              ...campData,
              isMainCampus: true,
              parentCampusId: null,
              currentPettyCash: Number((campData as any).pettyCashFloat) || 0,
            };
            orgMainCampuses.push(cleanMain);
            mainCampusesMap.set(cleanMain.id, cleanMain);
            campusOps.push({
              type: 'set',
              ref: d.ref,
              data: {
                ...sanitizeForFirestore(cleanMain),
                clientId: orgId,
                updatedAt: nowIso,
              },
              merge: true,
            });
          } else {
            subCampusesDeleted++;
            campusOps.push({ type: 'delete', ref: d.ref });
            credOps.push({
              type: 'delete',
              ref: doc(db, 'campus_credentials', d.id),
            });
          }
        }

        if (orgMainCampuses.length === 0) {
          orgMainCampuses = localPreservedMainCampuses.filter(
            (c: any) => !c.clientId || c.clientId === orgId
          );
        }

        if (campusOps.length > 0) {
          await commitBatchedOperations(campusOps, campusesPath);
        }
        if (credOps.length > 0) {
          await commitBatchedOperations(credOps, 'campus_credentials');
        }
      } catch (err: any) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, campusesPath);
        }
      }

      // 3. Re-seed clean 157 Official Chart of Accounts (balance = 0) & remove stale COA docs
      const coaPath = `organizations/${orgId}/account_heads`;
      try {
        const coaSnap = await getDocs(collection(db, coaPath));
        const officialIdSet = new Set(zeroedCoa157.map((h) => String(h.id)));
        const coaOps: Array<{
          type: 'set' | 'delete';
          ref: DocumentReference;
          data?: any;
          merge?: boolean;
        }> = [];

        for (const d of coaSnap.docs) {
          if (!officialIdSet.has(d.id)) {
            coaOps.push({ type: 'delete', ref: d.ref });
          }
        }
        for (const h of zeroedCoa157) {
          coaOps.push({
            type: 'set',
            ref: doc(db, 'organizations', orgId, 'account_heads', String(h.id)),
            data: {
              ...sanitizeForFirestore(h),
              clientId: orgId,
              updatedAt: nowIso,
            },
            merge: false,
          });
        }
        await commitBatchedOperations(coaOps, coaPath);
        collectionsCleared.add(coaPath);
      } catch (err: any) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, coaPath);
        }
      }

      // 4. Write clean zero-data snapshot & reset organization counters
      const orgSnapshot = buildZeroDataLiveSnapshot({
        clientId: orgId,
        campuses: orgMainCampuses,
        accountHeads: zeroedCoa157,
        periods: curState?.periods || [],
        orgSettings: curState?.orgSettings || {},
        dataResetEpoch,
        nowIso,
      });

      await commitBatchedOperations(
        [
          {
            type: 'set',
            ref: doc(db, 'organizations', orgId, 'snapshots', 'live_state'),
            data: sanitizeForFirestore(orgSnapshot),
            merge: false,
          },
          {
            type: 'set',
            ref: doc(db, 'organizations', orgId),
            data: {
              id: orgId,
              voucherCount: 0,
              campusCount: orgMainCampuses.length,
              dataResetEpoch,
              updatedAt: nowIso,
            },
            merge: true,
          },
        ],
        `organizations/${orgId}/snapshots/live_state`
      );
      collectionsCleared.add(`organizations/${orgId}/snapshots/live_state`);
    }

    totalMainCampusesPreserved = Math.max(mainCampusesMap.size, localPreservedMainCampuses.length);

    // 5. Clear top-level operational/trash collections (NEVER touch global_users, login_directory, memberships, system_state, or append-only campus_login_activities)
    for (const topCol of [
      'global_recycle_bin',
      'recovery_audit_trail',
      'platform_security_audits',
    ]) {
      await deleteAllDocsInSubcollection(topCol);
      collectionsCleared.add(topCol);
    }

    // Touch updatedAt on preserved organizations registry without mutating client schema
    if (clients.length > 0) {
      const updatedClients = clients.map((cl) => ({
        ...cl,
        updatedAt: nowIso,
      }));
      saveStoredSchoolClients(updatedClients);
      await syncSchoolClientsToCloud(updatedClients).catch(() => {});
    }
  }

  // 6. Clear operational localStorage & IndexedDB caches while preserving Users, Organizations & Main Campuses
  clearOperationalLocalStorage();

  const preservedUsers = Array.isArray(curState?.users) ? curState.users : [];
  const nextLocalState = {
    ...curState,
    transactions: [],
    pettyCashTransactions: [],
    campuses: localPreservedMainCampuses,
    accountHeads: zeroedCoa157,
    users: preservedUsers,
    activityLogs: [],
    reconciledBankTxIds: {},
    backupSnapshots: [],
    dataResetEpoch,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ACCOUNT_HEADS_STORAGE_KEY, JSON.stringify(zeroedCoa157));
      localStorage.setItem(
        'ams_campuses_v5_clean',
        JSON.stringify(localPreservedMainCampuses)
      );
      localStorage.setItem('ams_current_campus_v5_clean', 'all');
      localStorage.setItem('ams_transactions_v5_clean', '[]');
      localStorage.setItem('ams_petty_cash_v5_clean', '[]');
      localStorage.setItem('ams_activity_logs_v5_clean', '[]');
      localStorage.setItem('ams_reconciled_bank_tx_v5', '{}');
      localStorage.setItem('ams_backup_snapshots_v1', '[]');
    } catch {}

    window.__APLUS_HYDRATE_FROM_CLOUD__?.(nextLocalState);
    try {
      window.dispatchEvent(
        new CustomEvent('aplus-zero-data-reset', { detail: { dataResetEpoch } })
      );
    } catch {}
  }

  await clearIndexedDbStoresAfterReset(nextLocalState);

  return {
    executedAt: nowIso,
    dataResetEpoch,
    organizationsPreserved: clients.length,
    mainCampusesPreserved: totalMainCampusesPreserved,
    globalUsersPreserved: preservedUsers.length,
    accountHeadsImported: zeroedCoa157.length,
    subCampusesDeleted,
    vouchersDeleted,
    pettyCashDeleted,
    trashDeleted,
    auditsDeleted,
    reconciliationsDeleted,
    collectionsCleared: Array.from(collectionsCleared),
  };
}
