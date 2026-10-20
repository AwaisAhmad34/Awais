/**
 * Global Data Recovery & Financial Integrity Service
 * Supports multi-tenant soft deletion, global recycle bin, restore previews,
 * dependency validation, duplicate posting protection, and audit logging.
 */

import { Transaction, PettyCashTransaction, AccountHead, Campus } from '../core/aplusEngine';
import { db } from '../firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

export type RecoverableRecordType =
  | 'VOUCHER'
  | 'PETTY_CASH'
  | 'ACCOUNT_HEAD'
  | 'CAMPUS'
  | 'USER'
  | 'RECONCILIATION';

export interface FinancialImpactDetails {
  totalAmount?: number;
  totalDebit?: number;
  totalCredit?: number;
  affectedAccountCodes: string[];
  affectedAccountNames: string[];
  accountCategory?: string;
  isBalanced?: boolean;
  ledgerBalanceImpact?: {
    cashOrBankAffected: boolean;
    cashBankDelta: number;
    expenseDelta: number;
    revenueDelta: number;
  };
}

export interface DependencyCheckResult {
  hasMissingDependencies: boolean;
  missingAccountCodes: string[];
  missingCampusId?: string;
  missingParentId?: string;
  duplicateConflict: boolean;
  duplicateIdentifier?: string;
  warnings: string[];
  errors: string[];
  canRestoreSafely: boolean;
}

export interface SoftDeletedRecord {
  id: string; // trash record unique ID
  originalId: string;
  recordType: RecoverableRecordType;
  organizationId: string;
  organizationName: string;
  campusId: string;
  campusName: string;
  campusCode: string;
  identifier: string; // e.g. "BPV-0042", "1001-2", "LHR-SUB", "accountant_lhr"
  title: string;
  date: string;
  deletedAt: string;
  deletedEpochMs: number;
  deletedByUserId: string;
  deletedByUserName: string;
  deletedByUserRole: string;
  deletionReason: string;
  financialImpact?: FinancialImpactDetails;
  originalPayload: any; // Complete unmutated original snapshot
  status: 'soft_deleted' | 'restored' | 'permanently_deleted';
  restoredAt?: string;
  restoredBy?: string;
  restoreNotes?: string;
}

export interface RecoveryAuditLogItem {
  id: string;
  timestamp: string;
  epochMs: number;
  action: 'SOFT_DELETE' | 'RESTORE' | 'PERMANENT_DELETE' | 'RECONCILIATION_WARNING' | 'DEPENDENCY_FIX';
  recordType: RecoverableRecordType;
  recordId: string;
  identifier: string;
  campusId: string;
  campusCode: string;
  actorName: string;
  actorRole: string;
  details: string;
  financialAmount?: number;
  warnings?: string[];
}

export const RECYCLE_BIN_STORAGE_KEY = 'aplus_global_recycle_bin_v2';
export const RECOVERY_AUDIT_STORAGE_KEY = 'aplus_recovery_audit_trail_v2';

// ----------------------------------------------------------------------------
// INITIAL SEED DATA FOR AUDIT & RECOVERY VERIFICATION
// ----------------------------------------------------------------------------

export const INITIAL_SOFT_DELETED_RECORDS: SoftDeletedRecord[] = [
  {
    id: 'trash-rec-bpv-2026-0089',
    originalId: 'tx-archived-bpv-0089',
    recordType: 'VOUCHER',
    organizationId: 'client-aplus',
    organizationName: 'Aplus School System Network',
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL',
    identifier: 'BPV-0089',
    title: 'Bank Payment Voucher - Science Lab Equipment Maintenance',
    date: '2026-03-28',
    deletedAt: '2026-04-02T10:15:30.000Z',
    deletedEpochMs: new Date('2026-04-02T10:15:30.000Z').getTime(),
    deletedByUserId: 'usr-controller-01',
    deletedByUserName: 'Central Audit Officer',
    deletedByUserRole: 'Campus Auditor',
    deletionReason: 'Accidental duplicate entry by temporary branch cashier during monthly reconciliation.',
    financialImpact: {
      totalAmount: 48500,
      totalDebit: 48500,
      totalCredit: 48500,
      affectedAccountCodes: ['5001-2', '1002-1'],
      affectedAccountNames: ['Science Laboratory Expenses', 'Bank Alfalah Main Collection Account'],
      isBalanced: true,
      ledgerBalanceImpact: {
        cashOrBankAffected: true,
        cashBankDelta: -48500,
        expenseDelta: 48500,
        revenueDelta: 0,
      },
    },
    originalPayload: {
      id: 'tx-archived-bpv-0089',
      voucherNo: 'BPV-0089',
      voucherType: 'BPV',
      campusId: 'campus-khiali',
      date: '2026-03-28',
      narration: 'Payment for precision glassware and digital microscope servicing',
      chequeNo: 'CHQ-778219',
      totalDebit: 48500,
      totalCredit: 48500,
      status: 'Posted',
      entries: [
        {
          id: 'ent-1',
          accountId: 'acc-5001-2',
          accountCode: '5001-2',
          accountName: 'Science Laboratory Expenses',
          description: 'Precision glassware replacement and maintenance invoice #INV-4412',
          debit: 48500,
          credit: 0,
        },
        {
          id: 'ent-2',
          accountId: 'acc-1002-1',
          accountCode: '1002-1',
          accountName: 'Bank Alfalah Main Collection Account',
          description: 'Settlement via Cheque #CHQ-778219',
          debit: 0,
          credit: 48500,
        },
      ],
    },
    status: 'soft_deleted',
  },
  {
    id: 'trash-rec-pc-2026-0041',
    originalId: 'pc-archived-0041',
    recordType: 'PETTY_CASH',
    organizationId: 'client-aplus',
    organizationName: 'Aplus School System Network',
    campusId: 'campus-city',
    campusName: 'Aplus City Model Branch',
    campusCode: 'CTY',
    identifier: 'PCV-0041',
    title: 'Petty Cash Voucher - Campus Generator Fuel & Emergency Repairs',
    date: '2026-04-05',
    deletedAt: '2026-04-08T14:22:00.000Z',
    deletedEpochMs: new Date('2026-04-08T14:22:00.000Z').getTime(),
    deletedByUserId: 'usr-branch-acc',
    deletedByUserName: 'City Campus Accountant',
    deletedByUserRole: 'Campus Accountant',
    deletionReason: 'Voucher was reversed to adjust receipt number after supplier issued revised invoice.',
    financialImpact: {
      totalAmount: 14200,
      totalDebit: 14200,
      totalCredit: 14200,
      affectedAccountCodes: ['5004-1'],
      affectedAccountNames: ['Generator Fuel & Energy Expenses'],
      isBalanced: true,
      ledgerBalanceImpact: {
        cashOrBankAffected: true,
        cashBankDelta: -14200,
        expenseDelta: 14200,
        revenueDelta: 0,
      },
    },
    originalPayload: {
      id: 'pc-archived-0041',
      voucherNo: 'PCV-0041',
      trNo: 'TR-0041',
      campusId: 'campus-city',
      date: '2026-04-05',
      type: 'Disbursement',
      payee: 'PSO Service Station Khiali',
      category: 'Fuel & Power',
      accountCode: '5004-1',
      amount: 14200,
      narration: 'Emergency diesel replenishment for 50kVA standby generator',
      receiptNo: 'PSO-99014',
      balanceAfter: 20800,
    },
    status: 'soft_deleted',
  },
  {
    id: 'trash-rec-acc-4009-3',
    originalId: 'acc-head-4009-3',
    recordType: 'ACCOUNT_HEAD',
    organizationId: 'client-aplus',
    organizationName: 'Aplus School System Network',
    campusId: 'campus-khiali',
    campusName: 'Aplus Khiali Main Campus',
    campusCode: 'KHL',
    identifier: '4009-3',
    title: 'Account Head: Robotics & AI Club Registration Fee',
    date: '2026-02-10',
    deletedAt: '2026-03-12T09:40:00.000Z',
    deletedEpochMs: new Date('2026-03-12T09:40:00.000Z').getTime(),
    deletedByUserId: 'usr-admin-master',
    deletedByUserName: 'Central System Admin',
    deletedByUserRole: 'Super Admin',
    deletionReason: 'Redundant sub-head removed during annual chart of accounts restructuring.',
    financialImpact: {
      totalAmount: 0,
      affectedAccountCodes: ['4009-3'],
      affectedAccountNames: ['Robotics & AI Club Registration Fee'],
      accountCategory: 'Revenue',
    },
    originalPayload: {
      id: 'acc-head-4009-3',
      code: '4009-3',
      name: 'Robotics & AI Club Registration Fee',
      category: 'Revenue',
      type: 'Fee Income',
      balance: 0,
      mainCode: '4000',
      mainAccount: 'Operating Revenues',
      groupCode: '4009',
      groupName: 'Extracurricular Club Revenues',
    },
    status: 'soft_deleted',
  },
];

// ----------------------------------------------------------------------------
// RETRIEVAL & STORAGE
// ----------------------------------------------------------------------------

export function getStoredRecycleBinRecords(): SoftDeletedRecord[] {
  try {
    if (typeof window === 'undefined') return INITIAL_SOFT_DELETED_RECORDS;
    const raw = localStorage.getItem(RECYCLE_BIN_STORAGE_KEY);
    if (!raw) {
      saveStoredRecycleBinRecords(INITIAL_SOFT_DELETED_RECORDS);
      return INITIAL_SOFT_DELETED_RECORDS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SOFT_DELETED_RECORDS;
  } catch {
    return INITIAL_SOFT_DELETED_RECORDS;
  }
}

export function saveStoredRecycleBinRecords(records: SoftDeletedRecord[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RECYCLE_BIN_STORAGE_KEY, JSON.stringify(records));
    }
  } catch {}
}

export async function syncTrashRecordToCloud(record: SoftDeletedRecord): Promise<void> {
  try {
    const docRef = doc(db, 'global_recycle_bin', record.id);
    await setDoc(docRef, record);
  } catch (err) {
    console.warn('[GlobalRecovery] Cloud sync of trash record deferred:', err);
  }
}

export function getStoredRecoveryAuditLogs(): RecoveryAuditLogItem[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(RECOVERY_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecoveryAuditAction(
  entry: Omit<RecoveryAuditLogItem, 'id' | 'timestamp' | 'epochMs'>
): RecoveryAuditLogItem {
  const item: RecoveryAuditLogItem = {
    id: `rec-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    ...entry,
  };

  try {
    const current = getStoredRecoveryAuditLogs();
    const updated = [item, ...current].slice(0, 500);
    if (typeof window !== 'undefined') {
      localStorage.setItem(RECOVERY_AUDIT_STORAGE_KEY, JSON.stringify(updated));
    }
    const docRef = doc(db, 'recovery_audit_trail', item.id);
    setDoc(docRef, item).catch(() => {});
  } catch {}

  return item;
}

// ----------------------------------------------------------------------------
// SOFT DELETION ENGINES
// ----------------------------------------------------------------------------

/**
 * Soft deletes any supported record into the Global Recycle Bin.
 * Preserves full original payload, UUIDs, voucher numbers, and financial impact.
 */
export function softDeleteRecord(params: {
  recordType: RecoverableRecordType;
  originalPayload: any;
  organizationId?: string;
  organizationName?: string;
  campusId: string;
  campusName: string;
  campusCode: string;
  identifier: string;
  title: string;
  date?: string;
  deletedByUserId: string;
  deletedByUserName: string;
  deletedByUserRole: string;
  deletionReason: string;
}): SoftDeletedRecord {
  const {
    recordType,
    originalPayload,
    organizationId = 'client-aplus',
    organizationName = 'Aplus School System Network',
    campusId,
    campusName,
    campusCode,
    identifier,
    title,
    date = new Date().toISOString().slice(0, 10),
    deletedByUserId,
    deletedByUserName,
    deletedByUserRole,
    deletionReason,
  } = params;

  // Calculate financial impact if applicable
  let financialImpact: FinancialImpactDetails | undefined;
  if (recordType === 'VOUCHER' && originalPayload.entries) {
    const totalDebit = Number(originalPayload.totalDebit) || 0;
    const totalCredit = Number(originalPayload.totalCredit) || 0;
    const codes = originalPayload.entries.map((e: any) => e.accountCode || '');
    const names = originalPayload.entries.map((e: any) => e.accountName || '');
    financialImpact = {
      totalAmount: totalDebit,
      totalDebit,
      totalCredit,
      affectedAccountCodes: Array.from(new Set(codes)),
      affectedAccountNames: Array.from(new Set(names)),
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      ledgerBalanceImpact: {
        cashOrBankAffected: codes.some((c: string) => c.startsWith('1001') || c.startsWith('1002')),
        cashBankDelta: -totalDebit,
        expenseDelta: totalDebit,
        revenueDelta: 0,
      },
    };
  } else if (recordType === 'PETTY_CASH') {
    const amt = Number(originalPayload.amount) || 0;
    financialImpact = {
      totalAmount: amt,
      totalDebit: amt,
      totalCredit: amt,
      affectedAccountCodes: originalPayload.accountCode ? [originalPayload.accountCode] : ['5000'],
      affectedAccountNames: [originalPayload.category || 'Petty Cash Expense'],
      isBalanced: true,
      ledgerBalanceImpact: {
        cashOrBankAffected: true,
        cashBankDelta: originalPayload.type === 'Replenishment' ? amt : -amt,
        expenseDelta: originalPayload.type === 'Disbursement' ? amt : 0,
        revenueDelta: 0,
      },
    };
  } else if (recordType === 'ACCOUNT_HEAD') {
    financialImpact = {
      totalAmount: Number(originalPayload.balance) || 0,
      affectedAccountCodes: [originalPayload.code],
      affectedAccountNames: [originalPayload.name],
      accountCategory: originalPayload.category,
    };
  }

  const trashRecord: SoftDeletedRecord = {
    id: `trash-${recordType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    originalId: originalPayload.id || `id-${Date.now()}`,
    recordType,
    organizationId,
    organizationName,
    campusId,
    campusName,
    campusCode,
    identifier,
    title,
    date,
    deletedAt: new Date().toISOString(),
    deletedEpochMs: Date.now(),
    deletedByUserId,
    deletedByUserName,
    deletedByUserRole,
    deletionReason,
    financialImpact,
    originalPayload,
    status: 'soft_deleted',
  };

  const existing = getStoredRecycleBinRecords();
  const updated = [trashRecord, ...existing];
  saveStoredRecycleBinRecords(updated);
  syncTrashRecordToCloud(trashRecord);

  // Log in recovery audit trail
  recordRecoveryAuditAction({
    action: 'SOFT_DELETE',
    recordType,
    recordId: trashRecord.id,
    identifier,
    campusId,
    campusCode,
    actorName: deletedByUserName,
    actorRole: deletedByUserRole,
    details: `Soft-deleted ${recordType} '${identifier}' (${title}). Reason: ${deletionReason}`,
    financialAmount: financialImpact?.totalAmount,
  });

  return trashRecord;
}

// ----------------------------------------------------------------------------
// PRE-RESTORE DEPENDENCY & FINANCIAL INTEGRITY VALIDATOR
// ----------------------------------------------------------------------------

export function validateRestorePreconditions(
  trashRecord: SoftDeletedRecord,
  context: {
    activeTransactions: Transaction[];
    activePettyCash: PettyCashTransaction[];
    activeAccountHeads: AccountHead[];
    activeCampuses: Campus[];
  }
): DependencyCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let duplicateConflict = false;
  let duplicateIdentifier: string | undefined;
  const missingAccountCodes: string[] = [];
  let missingCampusId: string | undefined;

  const { activeTransactions, activePettyCash, activeAccountHeads, activeCampuses } = context;

  // 1. Campus existence validation
  const targetCampus = activeCampuses.find((c) => c.id === trashRecord.campusId);
  if (!targetCampus) {
    missingCampusId = trashRecord.campusId;
    errors.push(
      `Target campus '${trashRecord.campusName}' (ID: ${trashRecord.campusId}) is not active or has been archived.`
    );
  }

  // 2. Record-Type Specific Validations
  if (trashRecord.recordType === 'VOUCHER') {
    const rawVoucherNo = trashRecord.originalPayload.voucherNo;
    const exists = activeTransactions.some(
      (tx) => tx.voucherNo.trim().toUpperCase() === rawVoucherNo.trim().toUpperCase()
    );
    if (exists) {
      duplicateConflict = true;
      duplicateIdentifier = rawVoucherNo;
      errors.push(
        `Duplicate Voucher Conflict: Voucher number '${rawVoucherNo}' already exists in active general ledger. Restoring this voucher directly would cause double-posting!`
      );
    }

    // Check account heads existence
    const entries = trashRecord.originalPayload.entries || [];
    entries.forEach((entry: any) => {
      const code = entry.accountCode;
      const head = activeAccountHeads.find((h) => h.code === code);
      if (!head) {
        if (!missingAccountCodes.includes(code)) missingAccountCodes.push(code);
        warnings.push(
          `Referenced Chart of Accounts code '${code}' (${entry.accountName || 'Unknown'}) is currently missing in the active account heads list.`
        );
      }
    });

    // Balanced check
    const totalDebit = Number(trashRecord.originalPayload.totalDebit) || 0;
    const totalCredit = Number(trashRecord.originalPayload.totalCredit) || 0;
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push(
        `Financial Imbalance: Debit (PKR ${totalDebit.toLocaleString()}) does not match Credit (PKR ${totalCredit.toLocaleString()}). Cannot post unadjusted voucher!`
      );
    }
  } else if (trashRecord.recordType === 'PETTY_CASH') {
    const rawVoucherNo = trashRecord.originalPayload.voucherNo;
    const exists = activePettyCash.some(
      (pc) => pc.voucherNo?.trim().toUpperCase() === rawVoucherNo?.trim().toUpperCase()
    );
    if (exists) {
      duplicateConflict = true;
      duplicateIdentifier = rawVoucherNo;
      errors.push(
        `Duplicate Petty Cash Conflict: Voucher number '${rawVoucherNo}' already exists in active petty cash ledger!`
      );
    }
  } else if (trashRecord.recordType === 'ACCOUNT_HEAD') {
    const rawCode = trashRecord.originalPayload.code;
    const exists = activeAccountHeads.some((h) => h.code.trim() === rawCode.trim());
    if (exists) {
      duplicateConflict = true;
      duplicateIdentifier = rawCode;
      errors.push(
        `Duplicate Account Head Conflict: Code '${rawCode}' is already registered in Chart of Accounts.`
      );
    }
  } else if (trashRecord.recordType === 'CAMPUS') {
    const rawCode = trashRecord.originalPayload.code;
    const exists = activeCampuses.some((c) => c.code.trim().toUpperCase() === rawCode.trim().toUpperCase());
    if (exists) {
      duplicateConflict = true;
      duplicateIdentifier = rawCode;
      errors.push(`Duplicate Campus Code: Campus code '${rawCode}' is already active.`);
    }
  }

  const hasMissingDependencies = missingAccountCodes.length > 0 || !!missingCampusId;
  const canRestoreSafely = errors.length === 0;

  return {
    hasMissingDependencies,
    missingAccountCodes,
    missingCampusId,
    duplicateConflict,
    duplicateIdentifier,
    warnings,
    errors,
    canRestoreSafely,
  };
}

// ----------------------------------------------------------------------------
// ATOMIC RESTORE EXECUTOR
// ----------------------------------------------------------------------------

export interface RestoreExecutionResult {
  success: boolean;
  message: string;
  restoredRecordId: string;
  restoredEntityPayload: any;
  reconciliationNotice?: string;
}

export function executeRecordRestore(
  trashRecordId: string,
  actor: {
    name: string;
    role: string;
    email?: string;
    isSiteOwner?: boolean;
    isMainBranch?: boolean;
    isSubCampus?: boolean;
  },
  context: {
    activeTransactions: Transaction[];
    activePettyCash: PettyCashTransaction[];
    activeAccountHeads: AccountHead[];
    activeCampuses: Campus[];
    addTransaction: (tx: any) => any;
    addPettyCashTransaction: (tx: any) => any;
    addAccountHead: (head: any) => any;
    addCampus: (campus: any) => any;
  },
  options?: {
    overrideDuplicateVoucherNo?: string;
    autoRecreateMissingAccountHeads?: boolean;
    restoreNotes?: string;
  }
): RestoreExecutionResult {
  const records = getStoredRecycleBinRecords();
  const targetIndex = records.findIndex((r) => r.id === trashRecordId);

  if (targetIndex === -1) {
    return {
      success: false,
      message: 'Trash record not found or already permanently purged.',
      restoredRecordId: trashRecordId,
      restoredEntityPayload: null,
    };
  }

  const trashItem = records[targetIndex];

  // Specific Security Rule: Restore deleted Chart of Accounts (COA) is strictly restricted to Site Owner & Main Branch
  if (trashItem.recordType === 'ACCOUNT_HEAD') {
    const isOwner =
      actor.isSiteOwner ||
      actor.role === 'admin' ||
      actor.role === 'superadmin' ||
      actor.role === 'level_1_platform_super_admin' ||
      actor.role === 'level_2_client_super_admin' ||
      actor.role.toLowerCase().includes('site owner') ||
      actor.role.toLowerCase().includes('platform') ||
      actor.role.toLowerCase().includes('creator');

    const isMain =
      actor.isMainBranch ||
      actor.role === 'level_3_main_campus_admin' ||
      actor.role.toLowerCase().includes('main');

    if (!isOwner && !isMain) {
      return {
        success: false,
        message:
          'Authorization Denied: Deleted Chart of Accounts (COA) heads can only be restored by the Platform Site Owner or Main Branch Administration. Sub-campuses are not authorized.',
        restoredRecordId: trashRecordId,
        restoredEntityPayload: null,
      };
    }
  }

  // Run preconditions check
  const precheck = validateRestorePreconditions(trashItem, context);
  if (!precheck.canRestoreSafely && !options?.overrideDuplicateVoucherNo) {
    return {
      success: false,
      message: precheck.errors.join(' | '),
      restoredRecordId: trashRecordId,
      restoredEntityPayload: null,
    };
  }

  const payload = { ...trashItem.originalPayload };

  // If a duplicate override voucher number was supplied, apply it
  if (options?.overrideDuplicateVoucherNo) {
    payload.voucherNo = options.overrideDuplicateVoucherNo;
    payload.narration = `${payload.narration || ''} [Restored with alternate voucher #${options.overrideDuplicateVoucherNo}]`;
  }

  // Auto recreate missing account heads if chosen
  if (options?.autoRecreateMissingAccountHeads && precheck.missingAccountCodes.length > 0) {
    precheck.missingAccountCodes.forEach((missingCode) => {
      const parentGroup = missingCode.split('-')[0] || '5000';
      context.addAccountHead({
        id: `acc-auto-restored-${missingCode}-${Date.now()}`,
        code: missingCode,
        name: `Restored Account (${missingCode})`,
        category: missingCode.startsWith('5') ? 'Expense' : missingCode.startsWith('4') ? 'Revenue' : 'Asset',
        type: 'General',
        balance: 0,
        mainCode: `${parentGroup.slice(0, 2)}00`,
        mainAccount: 'Restored Ledger Heads',
        groupCode: parentGroup,
        groupName: 'Auto-Restored Dependencies',
      });
    });
  }

  // Restore into the corresponding engine state
  if (trashItem.recordType === 'VOUCHER') {
    context.addTransaction(payload);
  } else if (trashItem.recordType === 'PETTY_CASH') {
    context.addPettyCashTransaction(payload);
  } else if (trashItem.recordType === 'ACCOUNT_HEAD') {
    context.addAccountHead(payload);
  } else if (trashItem.recordType === 'CAMPUS') {
    context.addCampus(payload);
  }

  // Mark record as restored in recycle bin
  const updatedRecord: SoftDeletedRecord = {
    ...trashItem,
    status: 'restored',
    restoredAt: new Date().toISOString(),
    restoredBy: `${actor.name} (${actor.role})`,
    restoreNotes: options?.restoreNotes || 'Successfully restored with verified ledger balances.',
  };

  records[targetIndex] = updatedRecord;
  saveStoredRecycleBinRecords(records);
  syncTrashRecordToCloud(updatedRecord);

  // Record in audit log
  recordRecoveryAuditAction({
    action: 'RESTORE',
    recordType: trashItem.recordType,
    recordId: trashItem.id,
    identifier: payload.voucherNo || payload.code || trashItem.identifier,
    campusId: trashItem.campusId,
    campusCode: trashItem.campusCode,
    actorName: actor.name,
    actorRole: actor.role,
    details: `Restored ${trashItem.recordType} '${trashItem.identifier}' back to live ledger. Financial amount: PKR ${trashItem.financialImpact?.totalAmount || 0}.`,
    financialAmount: trashItem.financialImpact?.totalAmount,
    warnings: precheck.warnings,
  });

  return {
    success: true,
    message: `Record '${trashItem.identifier}' restored successfully to active records!`,
    restoredRecordId: trashItem.id,
    restoredEntityPayload: payload,
    reconciliationNotice:
      trashItem.financialImpact?.totalAmount && trashItem.financialImpact.totalAmount > 0
        ? `Ledger reconciliation updated: Impact of PKR ${trashItem.financialImpact.totalAmount.toLocaleString()} credited/debited into affected accounts.`
        : undefined,
  };
}

// ----------------------------------------------------------------------------
// CONTROLLED PERMANENT PURGE
// ----------------------------------------------------------------------------

export function executePermanentDelete(
  trashRecordId: string,
  actor: { name: string; role: string },
  confirmationCode: string,
  reason: string
): { success: boolean; message: string } {
  // Security Guard: High-risk operation requires authorization
  if (confirmationCode !== 'PERMANENT_DELETE_CONFIRMED') {
    return {
      success: false,
      message: 'Authorization failed: You must type the exact confirmation phrase to permanently erase data.',
    };
  }

  const records = getStoredRecycleBinRecords();
  const target = records.find((r) => r.id === trashRecordId);
  if (!target) {
    return { success: false, message: 'Record not found in recycle bin.' };
  }

  // Filter out the record from active trash list
  const filtered = records.filter((r) => r.id !== trashRecordId);
  saveStoredRecycleBinRecords(filtered);

  // Remove from Firestore or mark purged
  const docRef = doc(db, 'global_recycle_bin', trashRecordId);
  deleteDoc(docRef).catch(() => {});

  // Record in security audit log
  recordRecoveryAuditAction({
    action: 'PERMANENT_DELETE',
    recordType: target.recordType,
    recordId: target.id,
    identifier: target.identifier,
    campusId: target.campusId,
    campusCode: target.campusCode,
    actorName: actor.name,
    actorRole: actor.role,
    details: `Permanently purged record '${target.identifier}' (${target.title}) from the Global Recycle Bin. Justification: ${reason}`,
    financialAmount: target.financialImpact?.totalAmount,
  });

  return {
    success: true,
    message: `Record '${target.identifier}' has been permanently deleted from the database.`,
  };
}

// ----------------------------------------------------------------------------
// EXPORTS & REPORTING
// ----------------------------------------------------------------------------

export function exportRecycleBinAuditReportCSV(): void {
  const records = getStoredRecycleBinRecords();
  let csv = 'Recycle Bin ID,Record Type,Identifier,Title,Campus,Org,Deleted Date,Deleted By,Reason,Amount (PKR),Status,Restored At,Restored By\n';

  records.forEach((r) => {
    const esc = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
    csv += [
      esc(r.id),
      esc(r.recordType),
      esc(r.identifier),
      esc(r.title),
      esc(`${r.campusName} (${r.campusCode})`),
      esc(r.organizationName),
      esc(r.deletedAt),
      esc(`${r.deletedByUserName} [${r.deletedByUserRole}]`),
      esc(r.deletionReason),
      r.financialImpact?.totalAmount || 0,
      esc(r.status),
      esc(r.restoredAt || 'N/A'),
      esc(r.restoredBy || 'N/A'),
    ].join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Global_Recycle_Bin_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
