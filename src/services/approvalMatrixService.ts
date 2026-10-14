import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export type CampusHierarchyTier =
  | 'level_1_platform_admin'
  | 'level_2_client_admin'
  | 'level_3_main_campus'
  | 'level_4_sub_campus'
  | 'level_5_departmental';

export type VoucherTypeCode = 'CPV' | 'CRV' | 'BPV' | 'BRV' | 'JV';

export interface RoleApprovalThreshold {
  roleId: string;
  roleName: string;
  hierarchyTier: CampusHierarchyTier;
  maxVoucherAmount: number;
  maxPettyCashPerVoucher: number;
  allowedVoucherTypes: VoucherTypeCode[];
  canAuthorizeWithoutDualApproval: boolean;
  canApproveCrossCampus: boolean;
  requiresEscalationAboveLimit: boolean;
  notes?: string;
}

export interface ApprovalMatrixConfig {
  id: string;
  systemTitle: string;
  updatedAt: string;
  updatedBy: string;
  enforceStrictLimits: boolean;
  dualApprovalThreshold: number; // Vouchers exceeding this require 2 signatures (e.g. Rs. 50,000)
  dualApprovalRoles: string[]; // Roles permitted to provide secondary sign-off
  escalateToParentCampusAbove: number; // e.g. Rs. 150,000 for sub-campuses
  escalateToSuperAdminAbove: number; // e.g. Rs. 500,000
  preventSelfApproval: boolean; // Creator cannot be approver
  allowBulkApprovalLimit: number; // Max amount per voucher allowed in bulk batches
  hierarchyTierLimits: Record<CampusHierarchyTier, number>;
  roleThresholds: RoleApprovalThreshold[];
  auditLoggingEnabled: boolean;
}

const STORAGE_KEY = 'aplus_approval_matrix_config_v1';
const SUBSCRIBERS = new Set<(cfg: ApprovalMatrixConfig) => void>();

export const DEFAULT_APPROVAL_MATRIX: ApprovalMatrixConfig = {
  id: 'approval_matrix_master',
  systemTitle: 'Multi-Campus Voucher Authorization & Approval Matrix Policy',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Platform Site Administrator',
  enforceStrictLimits: true,
  dualApprovalThreshold: 50000,
  dualApprovalRoles: ['Principal', 'Campus Head', 'Director', 'superadmin', 'admin'],
  escalateToParentCampusAbove: 150000,
  escalateToSuperAdminAbove: 500000,
  preventSelfApproval: true,
  allowBulkApprovalLimit: 100000,
  hierarchyTierLimits: {
    level_1_platform_admin: 100000000, // Unlimited (PKR 100M)
    level_2_client_admin: 2500000,     // PKR 2.5M
    level_3_main_campus: 500000,       // PKR 500,000
    level_4_sub_campus: 150000,        // PKR 150,000
    level_5_departmental: 50000,       // PKR 50,000
  },
  roleThresholds: [
    {
      roleId: 'role_platform_creator',
      roleName: 'Platform Creator / Super Admin',
      hierarchyTier: 'level_1_platform_admin',
      maxVoucherAmount: 100000000,
      maxPettyCashPerVoucher: 1000000,
      allowedVoucherTypes: ['CPV', 'CRV', 'BPV', 'BRV', 'JV'],
      canAuthorizeWithoutDualApproval: true,
      canApproveCrossCampus: true,
      requiresEscalationAboveLimit: false,
      notes: 'Unrestricted central authorization authority across all client campuses',
    },
    {
      roleId: 'role_org_owner',
      roleName: 'School Client / Organization Owner',
      hierarchyTier: 'level_2_client_admin',
      maxVoucherAmount: 2500000,
      maxPettyCashPerVoucher: 250000,
      allowedVoucherTypes: ['CPV', 'CRV', 'BPV', 'BRV', 'JV'],
      canAuthorizeWithoutDualApproval: true,
      canApproveCrossCampus: true,
      requiresEscalationAboveLimit: false,
      notes: 'Authorized for all network campus branches up to Rs. 2.5 Million',
    },
    {
      roleId: 'role_main_campus_director',
      roleName: 'Main Campus Director / Administrator',
      hierarchyTier: 'level_3_main_campus',
      maxVoucherAmount: 500000,
      maxPettyCashPerVoucher: 100000,
      allowedVoucherTypes: ['CPV', 'CRV', 'BPV', 'BRV', 'JV'],
      canAuthorizeWithoutDualApproval: false,
      canApproveCrossCampus: true,
      requiresEscalationAboveLimit: true,
      notes: 'Controls main campus and delegated child sub-campuses up to Rs. 500,000',
    },
    {
      roleId: 'role_sub_campus_principal',
      roleName: 'Sub-Campus Principal / Campus Head',
      hierarchyTier: 'level_4_sub_campus',
      maxVoucherAmount: 150000,
      maxPettyCashPerVoucher: 50000,
      allowedVoucherTypes: ['CPV', 'CRV', 'BPV', 'BRV', 'JV'],
      canAuthorizeWithoutDualApproval: false,
      canApproveCrossCampus: false,
      requiresEscalationAboveLimit: true,
      notes: 'Authorized for own branch operations. Vouchers > Rs. 150,000 escalate to Main Campus',
    },
    {
      roleId: 'role_senior_accountant',
      roleName: 'Campus Senior Accountant',
      hierarchyTier: 'level_5_departmental',
      maxVoucherAmount: 50000,
      maxPettyCashPerVoucher: 25000,
      allowedVoucherTypes: ['CPV', 'CRV', 'BPV', 'BRV', 'JV'],
      canAuthorizeWithoutDualApproval: false,
      canApproveCrossCampus: false,
      requiresEscalationAboveLimit: true,
      notes: 'Daily accounting authorization. Vouchers > Rs. 50,000 require Principal countersignature',
    },
    {
      roleId: 'role_petty_cashier',
      roleName: 'Branch Cashier / Cash Custodian',
      hierarchyTier: 'level_5_departmental',
      maxVoucherAmount: 15000,
      maxPettyCashPerVoucher: 15000,
      allowedVoucherTypes: ['CPV', 'CRV'],
      canAuthorizeWithoutDualApproval: false,
      canApproveCrossCampus: false,
      requiresEscalationAboveLimit: true,
      notes: 'Petty cash disbursement only up to imprest float limit',
    },
    {
      roleId: 'role_auditor_viewer',
      roleName: 'Internal Auditor / Read-Only Viewer',
      hierarchyTier: 'level_5_departmental',
      maxVoucherAmount: 0,
      maxPettyCashPerVoucher: 0,
      allowedVoucherTypes: [],
      canAuthorizeWithoutDualApproval: false,
      canApproveCrossCampus: false,
      requiresEscalationAboveLimit: false,
      notes: 'Read-only access for ledger review and compliance inspection',
    },
  ],
  auditLoggingEnabled: true,
};

let cachedMatrix: ApprovalMatrixConfig | null = null;

export function getStoredApprovalMatrixConfig(): ApprovalMatrixConfig {
  if (cachedMatrix !== null) return cachedMatrix;
  if (typeof window === 'undefined') return DEFAULT_APPROVAL_MATRIX;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.roleThresholds)) {
        const resolved: ApprovalMatrixConfig = { ...DEFAULT_APPROVAL_MATRIX, ...parsed };
        cachedMatrix = resolved;
        return resolved;
      }
    }
  } catch {}

  cachedMatrix = DEFAULT_APPROVAL_MATRIX;
  return DEFAULT_APPROVAL_MATRIX;
}

export function saveStoredApprovalMatrixConfig(
  config: ApprovalMatrixConfig,
  notify: boolean = true
): void {
  cachedMatrix = config;
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (notify) {
      SUBSCRIBERS.forEach((cb) => {
        try {
          cb(config);
        } catch {}
      });
    }
  } catch {}
}

export async function syncApprovalMatrixToCloud(config: ApprovalMatrixConfig): Promise<boolean> {
  saveStoredApprovalMatrixConfig(config, true);
  try {
    const ref = doc(db, 'system_configs', 'approval_matrix');
    await setDoc(ref, {
      ...config,
      syncedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('Could not sync approval matrix to cloud Firestore:', err);
    return false;
  }
}

export function subscribeApprovalMatrixConfig(
  callback: (cfg: ApprovalMatrixConfig) => void
): () => void {
  SUBSCRIBERS.add(callback);
  callback(getStoredApprovalMatrixConfig());

  // Listen to Firestore updates in real-time
  let unsubscribeFirestore: (() => void) | null = null;
  try {
    const ref = doc(db, 'system_configs', 'approval_matrix');
    unsubscribeFirestore = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const remote = snap.data() as ApprovalMatrixConfig;
          if (remote && Array.isArray(remote.roleThresholds)) {
            saveStoredApprovalMatrixConfig(remote, false);
            callback(remote);
          }
        }
      },
      (err) => {
        console.warn('Approval matrix Firestore subscription warning:', err);
      }
    );
  } catch {}

  return () => {
    SUBSCRIBERS.delete(callback);
    if (unsubscribeFirestore) unsubscribeFirestore();
  };
}

export interface EvaluationResult {
  isAuthorized: boolean;
  requiresDualApproval: boolean;
  requiresEscalation: boolean;
  escalationTarget?: string;
  reason: string;
  maxAuthorizedAmount: number;
  excessAmount: number;
}

export function evaluateVoucherApprovalAuthorization(params: {
  amount: number;
  voucherType: VoucherTypeCode;
  userRole?: string;
  permissionLevel?: string;
  isSuperAdmin?: boolean;
  voucherCreator?: string;
  currentUserUsername?: string;
  isMainCampus?: boolean;
}): EvaluationResult {
  const matrix = getStoredApprovalMatrixConfig();
  const {
    amount,
    voucherType,
    userRole = 'Accountant',
    permissionLevel = 'level_4_sub_campus_admin',
    isSuperAdmin = false,
    voucherCreator,
    currentUserUsername,
    isMainCampus = false,
  } = params;

  // Level 1 Super Administrator Override
  if (isSuperAdmin || permissionLevel === 'level_1_platform_super_admin') {
    return {
      isAuthorized: true,
      requiresDualApproval: false,
      requiresEscalation: false,
      reason: 'Approved: Platform Super Administrator possesses unrestricted authorization clearance.',
      maxAuthorizedAmount: 100000000,
      excessAmount: 0,
    };
  }

  // Check Self-Approval prevention
  if (
    matrix.preventSelfApproval &&
    voucherCreator &&
    currentUserUsername &&
    voucherCreator.toLowerCase() === currentUserUsername.toLowerCase()
  ) {
    return {
      isAuthorized: false,
      requiresDualApproval: true,
      requiresEscalation: false,
      reason: 'Segregation of Duties Violation: You created this voucher. Another authorized officer must approve it.',
      maxAuthorizedAmount: 0,
      excessAmount: amount,
    };
  }

  // Determine Hierarchy Limit based on campus level
  const effectiveTier: CampusHierarchyTier =
    permissionLevel === 'level_2_client_admin'
      ? 'level_2_client_admin'
      : permissionLevel === 'level_3_main_campus_admin' || isMainCampus
      ? 'level_3_main_campus'
      : permissionLevel === 'level_4_sub_campus_admin'
      ? 'level_4_sub_campus'
      : 'level_5_departmental';

  const tierMax = matrix.hierarchyTierLimits[effectiveTier] ?? 50000;

  // Match role threshold
  const matchedRole = matrix.roleThresholds.find((r) => {
    const roleId = r.roleId.toLowerCase();
    const roleName = r.roleName.toLowerCase();
    const target = userRole.toLowerCase();
    return roleId.includes(target) || roleName.includes(target) || target.includes(r.roleName.toLowerCase());
  }) || matrix.roleThresholds.find((r) => r.hierarchyTier === effectiveTier) || matrix.roleThresholds[4];

  // Specific voucher type check
  if (!matchedRole.allowedVoucherTypes.includes(voucherType)) {
    return {
      isAuthorized: false,
      requiresDualApproval: false,
      requiresEscalation: true,
      escalationTarget: 'Main Campus Director or Super Admin',
      reason: `Authorization Restricted: Your role profile is not authorized to approve ${voucherType} vouchers.`,
      maxAuthorizedAmount: 0,
      excessAmount: amount,
    };
  }

  const effectiveMaxLimit = Math.min(tierMax, matchedRole.maxVoucherAmount);
  const requiresDual = amount > matrix.dualApprovalThreshold && !matchedRole.canAuthorizeWithoutDualApproval;

  if (amount > effectiveMaxLimit) {
    const excess = amount - effectiveMaxLimit;
    const escalationTarget =
      effectiveTier === 'level_4_sub_campus'
        ? 'Main Campus Administrator'
        : 'Platform Super Administrator';

    return {
      isAuthorized: false,
      requiresDualApproval: requiresDual,
      requiresEscalation: true,
      escalationTarget,
      reason: `Threshold Exceeded: Voucher amount (Rs. ${amount.toLocaleString()}) exceeds your authorized limit of Rs. ${effectiveMaxLimit.toLocaleString()}. Escalated to ${escalationTarget}.`,
      maxAuthorizedAmount: effectiveMaxLimit,
      excessAmount: excess,
    };
  }

  return {
    isAuthorized: true,
    requiresDualApproval: requiresDual,
    requiresEscalation: false,
    reason: requiresDual
      ? `Authorized with Dual Sign-off: Amount exceeds Rs. ${matrix.dualApprovalThreshold.toLocaleString()}. Requires countersignature by Campus Principal/Director.`
      : `Authorized: Voucher amount within authorized clearance limit of Rs. ${effectiveMaxLimit.toLocaleString()}.`,
    maxAuthorizedAmount: effectiveMaxLimit,
    excessAmount: 0,
  };
}
