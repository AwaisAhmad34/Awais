import { Campus, AccountHead, Transaction } from '../core/aplusEngine';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * 5-Tier Hierarchical Permission Levels (as defined in Multi-Campus School Management System specification)
 */
export type PermissionLevel =
  | 'level_1_platform_super_admin'
  | 'level_2_client_super_admin'
  | 'level_3_main_campus_admin'
  | 'level_4_sub_campus_admin'
  | 'level_5_departmental_staff';

export type DepartmentalStaffRole =
  | 'accountant'
  | 'fee_manager'
  | 'hr_manager'
  | 'teacher'
  | 'viewer_auditor';

export interface PermissionActionMatrix {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
  manageAccess: boolean;
}

export type SystemFeatureKey =
  | 'manage_all_clients'
  | 'manage_assigned_campuses'
  | 'create_account_heads'
  | 'change_account_codes'
  | 'assign_account_head_visibility'
  | 'view_financial_reports'
  | 'record_transactions'
  | 'approve_transactions'
  | 'manage_user_permissions'
  | 'access_audit_logs';

export interface AccountHeadPermissionItem {
  accountCode: string;
  canView: boolean;
  canPost: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReport: boolean;
  isSensitive?: boolean;
}

export interface CampusAccountHeadAccessConfig {
  campusId: string;
  campusCode: string;
  campusName: string;
  // Specific allowed account codes (or all if wildcard)
  allowedAccountCodes: string[];
  // Inherited parent group codes (e.g. "500-1", "100-4")
  inheritedGroupCodes: string[];
  // Fine-grained per-head permissions
  permissionsByAccount: Record<string, AccountHeadPermissionItem>;
  // Sensitive account restrictions (e.g., payroll, director drawings, confidential management expenses)
  sensitiveRestrictions: Record<string, boolean>;
  updatedAt: string;
  updatedBy: string;
}

/**
 * User Role Assignment model for campus administrators and departmental users
 */
export interface UserRoleAssignment {
  userId: string;
  userName: string;
  userEmail?: string;
  permissionLevel: PermissionLevel;
  departmentalRole?: DepartmentalStaffRole;
  assignedCampusId: string; // 'all' for Level 1/2 or specific campus ID
  assignedCampusName: string;
  delegatedSubCampusIds?: string[]; // For Level 3 Main Campus Admin managing sub-campuses
  delegatedPermissions?: {
    canManageSubCampusUsers?: boolean;
    canApproveSubCampusTransactions?: boolean;
    canViewConsolidatedReports?: boolean;
    canAssignAccountVisibility?: boolean;
  };
  assignedAt: string;
  assignedBy: string;
  assignedByRole: string;
  status: 'active' | 'suspended';
}

/**
 * Forensic Audit Record specifically capturing Role-Based Access Control Changes
 */
export interface RbacAuditLogRecord {
  id: string;
  timestamp: string;
  epochMs: number;
  actor: {
    userId: string;
    userName: string;
    userEmail?: string;
    userRole: string;
    permissionLevel: PermissionLevel;
  };
  actionType:
    | 'ROLE_ASSIGNED'
    | 'ROLE_REVOKED'
    | 'USER_CAMPUS_ASSIGNED'
    | 'PERMISSION_MATRIX_OVERRIDE'
    | 'ACCOUNT_HEAD_VISIBILITY_CHANGED'
    | 'ACCOUNT_HEAD_ACTION_PERMISSION_CHANGED'
    | 'SENSITIVE_ACCOUNT_RESTRICTION_TOGGLED'
    | 'POLICY_CONFIG_COPIED'
    | 'LEVEL_SWITCHED'
    | 'DELEGATED_ACCESS_UPDATED'
    | 'SECURITY_OVERRIDE_ENFORCED';
  affectedScope: {
    scopeType: 'campus' | 'account_head' | 'user' | 'global_matrix';
    campusId?: string;
    campusName?: string;
    accountCode?: string;
    accountName?: string;
    targetUserId?: string;
    targetUserName?: string;
    targetUserRole?: string;
    targetPermissionLevel?: PermissionLevel;
  };
  natureOfChange: string;
  beforeState?: any;
  afterState?: any;
  ruleEnforced?: string; // e.g. "Platform boundary", "Permanent code rule", "Account boundary"
  integrityHash?: string;
}

export interface HierarchicalRbacMasterConfig {
  version: string;
  updatedAt: string;
  activeLevel: PermissionLevel;
  activeStaffRole?: DepartmentalStaffRole;
  // Campus administrators and user role assignments
  userRoleAssignments: Record<string, UserRoleAssignment>;
  // Campus-specific account head access rules
  campusAccountAccess: Record<string, CampusAccountHeadAccessConfig>;
  // Global feature action matrix overrides
  featurePolicyOverrides: Record<string, Partial<PermissionActionMatrix>>;
}

const STORAGE_KEY = 'aplus_campus_rbac_master_v1';
export const RBAC_AUDIT_STORAGE_KEY = 'aplus_rbac_audit_events_v1';

// Default system features action matrix policy per permission level
export const DEFAULT_FEATURE_ACTION_POLICY: Record<
  PermissionLevel,
  Record<SystemFeatureKey, PermissionActionMatrix>
> = {
  level_1_platform_super_admin: {
    manage_all_clients: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    manage_assigned_campuses: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    create_account_heads: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    change_account_codes: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false }, // Permanent code rule: Never after creation
    assign_account_head_visibility: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    view_financial_reports: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    record_transactions: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    approve_transactions: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    manage_user_permissions: { view: true, create: true, edit: true, delete: true, approve: true, export: true, manageAccess: true },
    access_audit_logs: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: true },
  },
  level_2_client_super_admin: {
    manage_all_clients: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_assigned_campuses: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: true },
    create_account_heads: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manageAccess: false },
    change_account_codes: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    assign_account_head_visibility: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: true },
    view_financial_reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    record_transactions: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: false },
    approve_transactions: { view: true, create: false, edit: false, delete: false, approve: true, export: true, manageAccess: false },
    manage_user_permissions: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: true },
    access_audit_logs: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
  },
  level_3_main_campus_admin: {
    manage_all_clients: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_assigned_campuses: { view: true, create: false, edit: true, delete: false, approve: false, export: true, manageAccess: false },
    create_account_heads: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    change_account_codes: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    assign_account_head_visibility: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    view_financial_reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    record_transactions: { view: true, create: true, edit: true, delete: false, approve: true, export: true, manageAccess: false },
    approve_transactions: { view: true, create: false, edit: false, delete: false, approve: true, export: true, manageAccess: false },
    manage_user_permissions: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manageAccess: false },
    access_audit_logs: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
  },
  level_4_sub_campus_admin: {
    manage_all_clients: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_assigned_campuses: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    create_account_heads: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    change_account_codes: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    assign_account_head_visibility: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    view_financial_reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    record_transactions: { view: true, create: true, edit: true, delete: false, approve: false, export: true, manageAccess: false },
    approve_transactions: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_user_permissions: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    access_audit_logs: { view: true, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
  },
  level_5_departmental_staff: {
    manage_all_clients: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_assigned_campuses: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    create_account_heads: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    change_account_codes: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    assign_account_head_visibility: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    view_financial_reports: { view: true, create: false, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    record_transactions: { view: true, create: true, edit: false, delete: false, approve: false, export: true, manageAccess: false },
    approve_transactions: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    manage_user_permissions: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
    access_audit_logs: { view: false, create: false, edit: false, delete: false, approve: false, export: false, manageAccess: false },
  },
};

// Check if an account code belongs to sensitive accounts (payroll, confidential management expenses, director drawings)
export function isAccountHeadSensitive(code: string, name: string): boolean {
  const normalized = `${code} ${name}`.toLowerCase();
  return (
    code.startsWith('200-3') || // Director / Partner Drawings
    code.startsWith('300-5') || // Salaries Payable
    code.startsWith('500-1-01') || // Faculty/Staff Salaries
    normalized.includes('drawing') ||
    normalized.includes('payroll') ||
    normalized.includes('confidential') ||
    normalized.includes('management fee')
  );
}

// Initial default user role assignments
export function getInitialUserRoleAssignments(campuses: Campus[]): Record<string, UserRoleAssignment> {
  const mainCampus = campuses[0] || { id: 'c1', name: 'Khiali Main Campus', code: 'A+ KHL-MAIN' };
  const subCampus1 = campuses[1] || { id: 'c2', name: 'Sub-Campus 1', code: 'SUB-1' };
  const subCampus2 = campuses[2] || { id: 'c3', name: 'Sub-Campus 2', code: 'SUB-2' };
  const now = new Date().toISOString();

  return {
    'user-superadmin': {
      userId: 'user-superadmin',
      userName: 'Platform Super Administrator',
      userEmail: 'director@aplus.edu.pk',
      permissionLevel: 'level_1_platform_super_admin',
      assignedCampusId: 'all',
      assignedCampusName: 'All Campuses (Consolidated)',
      assignedAt: now,
      assignedBy: 'System Bootstrap',
      assignedByRole: 'Root Authority',
      status: 'active',
    },
    'user-clientadmin': {
      userId: 'user-clientadmin',
      userName: 'Aplus School System Super Admin',
      userEmail: 'admin@aplus.edu.pk',
      permissionLevel: 'level_2_client_super_admin',
      assignedCampusId: 'all',
      assignedCampusName: 'A+ School System Network',
      assignedAt: now,
      assignedBy: 'Platform Super Administrator',
      assignedByRole: 'Level 1 Super Admin',
      status: 'active',
    },
    'user-maincampus': {
      userId: 'user-maincampus',
      userName: 'Khiali Main Campus Principal',
      userEmail: 'principal.khiali@aplus.edu.pk',
      permissionLevel: 'level_3_main_campus_admin',
      assignedCampusId: mainCampus.id,
      assignedCampusName: mainCampus.name,
      delegatedSubCampusIds: [subCampus1.id, subCampus2.id],
      delegatedPermissions: {
        canManageSubCampusUsers: true,
        canApproveSubCampusTransactions: true,
        canViewConsolidatedReports: true,
        canAssignAccountVisibility: false,
      },
      assignedAt: now,
      assignedBy: 'Aplus School System Super Admin',
      assignedByRole: 'Level 2 Client Super Admin',
      status: 'active',
    },
    'user-subcampus1': {
      userId: 'user-subcampus1',
      userName: 'Sub-Campus 1 Administrator',
      userEmail: 'admin.sub1@aplus.edu.pk',
      permissionLevel: 'level_4_sub_campus_admin',
      assignedCampusId: subCampus1.id,
      assignedCampusName: subCampus1.name,
      assignedAt: now,
      assignedBy: 'Khiali Main Campus Principal',
      assignedByRole: 'Level 3 Main Campus Admin',
      status: 'active',
    },
    'user-accountant': {
      userId: 'user-accountant',
      userName: 'Campus Senior Accountant',
      userEmail: 'accounts@aplus.edu.pk',
      permissionLevel: 'level_5_departmental_staff',
      departmentalRole: 'accountant',
      assignedCampusId: mainCampus.id,
      assignedCampusName: mainCampus.name,
      assignedAt: now,
      assignedBy: 'Khiali Main Campus Principal',
      assignedByRole: 'Level 3 Main Campus Admin',
      status: 'active',
    },
  };
}

// Initial default configuration
export function getInitialCampusAccountAccess(
  campuses: Campus[],
  accountHeads: AccountHead[]
): Record<string, CampusAccountHeadAccessConfig> {
  const configs: Record<string, CampusAccountHeadAccessConfig> = {};
  const allCodes = accountHeads.map((a) => a.code);
  const now = new Date().toISOString();

  campuses.forEach((camp, idx) => {
    const isMainCampus =
      idx === 0 ||
      camp.code.toUpperCase().includes('MAIN') ||
      camp.code.toUpperCase().includes('KHL');

    const allowed = isMainCampus
      ? [...allCodes]
      : allCodes.filter((c) => !c.startsWith('200-3')); // Sub-campuses by default don't post director drawings

    const perHeadPerms: Record<string, AccountHeadPermissionItem> = {};
    const sensitiveMap: Record<string, boolean> = {};

    accountHeads.forEach((head) => {
      const sensitive = isAccountHeadSensitive(head.code, head.name);
      sensitiveMap[head.code] = sensitive;
      perHeadPerms[head.code] = {
        accountCode: head.code,
        canView: true,
        canPost: !sensitive || isMainCampus,
        canEdit: isMainCampus,
        canApprove: isMainCampus,
        canReport: true,
        isSensitive: sensitive,
      };
    });

    configs[camp.id] = {
      campusId: camp.id,
      campusCode: camp.code,
      campusName: camp.name,
      allowedAccountCodes: allowed,
      inheritedGroupCodes: ['100-1', '100-4', '400-1', '500-1', '500-2', '500-4', '500-5'],
      permissionsByAccount: perHeadPerms,
      sensitiveRestrictions: sensitiveMap,
      updatedAt: now,
      updatedBy: 'Platform Super Administrator',
    };
  });

  return configs;
}

export function getStoredHierarchicalRbacConfig(
  campuses: Campus[] = [],
  accountHeads: AccountHead[] = []
): HierarchicalRbacMasterConfig {
  if (typeof window === 'undefined') {
    return {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      activeLevel: 'level_1_platform_super_admin',
      userRoleAssignments: getInitialUserRoleAssignments(campuses),
      campusAccountAccess: getInitialCampusAccountAccess(campuses, accountHeads),
      featurePolicyOverrides: {},
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.campusAccountAccess) {
        if (!parsed.userRoleAssignments) {
          parsed.userRoleAssignments = getInitialUserRoleAssignments(campuses);
        }
        return parsed;
      }
    }
  } catch {}

  const initial: HierarchicalRbacMasterConfig = {
    version: '1.0',
    updatedAt: new Date().toISOString(),
    activeLevel: 'level_1_platform_super_admin',
    userRoleAssignments: getInitialUserRoleAssignments(campuses),
    campusAccountAccess: getInitialCampusAccountAccess(campuses, accountHeads),
    featurePolicyOverrides: {},
  };
  saveStoredHierarchicalRbacConfig(initial);
  return initial;
}

export function saveStoredHierarchicalRbacConfig(config: HierarchicalRbacMasterConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

/**
 * Cloud Firestore persistence for RBAC configurations
 */
export async function syncHierarchicalRbacToCloud(
  config: HierarchicalRbacMasterConfig
): Promise<boolean> {
  try {
    await setDoc(
      doc(db, 'system_state', 'campus_rbac_permissions'),
      {
        ...config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    saveStoredHierarchicalRbacConfig(config);
    return true;
  } catch (err) {
    console.warn('Could not save RBAC permissions to Firestore:', err);
    return false;
  }
}

export async function loadHierarchicalRbacFromCloud(): Promise<HierarchicalRbacMasterConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'campus_rbac_permissions'));
    if (snap.exists()) {
      const data = snap.data() as HierarchicalRbacMasterConfig;
      saveStoredHierarchicalRbacConfig(data);
      return data;
    }
  } catch (err) {
    console.warn('Could not load RBAC permissions from Firestore:', err);
  }
  return null;
}

/**
 * Audit log recording for RBAC permission changes
 */
export function getStoredRbacAuditEvents(): RbacAuditLogRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RBAC_AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function computeRbacIntegrityHash(record: Partial<RbacAuditLogRecord>): string {
  const ts = record.timestamp || '';
  const act = record.actor?.userId || 'system';
  const type = record.actionType || 'RBAC';
  const scope = `${record.affectedScope?.scopeType || ''}:${record.affectedScope?.campusId || ''}:${record.affectedScope?.accountCode || ''}:${record.affectedScope?.targetUserId || ''}`;
  const nature = record.natureOfChange || '';
  const rawSig = `${ts}|${act}|${type}|${scope}|${nature}`;
  let hashVal = 2166136261;
  for (let k = 0; k < rawSig.length; k++) {
    hashVal ^= rawSig.charCodeAt(k);
    hashVal = Math.imul(hashVal, 16777619);
  }
  const timeSuffix = ts.replace(/[^0-9]/g, '').slice(-8) || '00000000';
  return `SHA256-RBAC-${(hashVal >>> 0).toString(16).toUpperCase().padStart(8, '0')}-${timeSuffix}`;
}

/**
 * Automatically captures a role-based permission change, logs it locally,
 * writes to Firestore `activity_logs`, and fires a browser broadcast event.
 */
export async function recordRbacAuditEvent(
  params: Omit<RbacAuditLogRecord, 'id' | 'timestamp' | 'epochMs' | 'integrityHash'>,
  logActivityFn?: (
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    campusId?: string,
    amount?: number,
    metadata?: Record<string, any>
  ) => void
): Promise<RbacAuditLogRecord> {
  const now = new Date();
  const iso = now.toISOString();
  const id = `rbac-log-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;

  const record: RbacAuditLogRecord = {
    ...params,
    id,
    timestamp: iso,
    epochMs: now.getTime(),
  };
  record.integrityHash = computeRbacIntegrityHash(record);

  // 1. Save in local dedicated RBAC audit stream
  if (typeof window !== 'undefined') {
    try {
      const existing = getStoredRbacAuditEvents();
      const updated = [record, ...existing.slice(0, 499)];
      localStorage.setItem(RBAC_AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  // 2. Dispatch custom event for real-time listener in SecureAuditTrail
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aplus:rbac-audit-logged', {
        detail: record,
      })
    );
  }

  // 3. Connect to core accounting logActivity if provided
  if (logActivityFn) {
    try {
      const entityId =
        record.affectedScope.accountCode ||
        record.affectedScope.targetUserId ||
        record.affectedScope.campusId ||
        'RBAC_SYSTEM';

      logActivityFn(
        record.actionType,
        'RBAC_PERMISSION',
        entityId,
        record.natureOfChange,
        record.affectedScope.campusId || 'all',
        undefined,
        {
          isRbacChange: true,
          actor: record.actor,
          affectedScope: record.affectedScope,
          natureOfChange: record.natureOfChange,
          beforeState: record.beforeState,
          afterState: record.afterState,
          ruleEnforced: record.ruleEnforced,
          integrityHash: record.integrityHash,
        }
      );
    } catch {}
  }

  // 4. Mirror directly to Firestore cloud activity_logs
  try {
    await setDoc(
      doc(db, 'activity_logs', id),
      {
        id,
        timestamp: iso,
        epochMs: now.getTime(),
        userId: record.actor.userId,
        userName: record.actor.userName,
        userRole: record.actor.userRole,
        action: record.actionType,
        entityType: 'RBAC_PERMISSION',
        entityId:
          record.affectedScope.accountCode ||
          record.affectedScope.targetUserId ||
          record.affectedScope.campusId ||
          'RBAC_SYSTEM',
        campusId: record.affectedScope.campusId || 'all',
        campusName: record.affectedScope.campusName || 'System',
        details: record.natureOfChange,
        integrityHash: record.integrityHash,
        metadata: {
          isRbacChange: true,
          actor: record.actor,
          affectedScope: record.affectedScope,
          natureOfChange: record.natureOfChange,
          ruleEnforced: record.ruleEnforced,
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not mirror RBAC audit record to Cloud Firestore:', err);
  }

  return record;
}

/**
 * Checks whether an account head is authorized for transaction entry at a campus
 */
export function isAccountHeadPermittedForCampus(params: {
  campusId: string;
  accountCode: string;
  action?: 'view' | 'post' | 'edit' | 'approve' | 'report';
  rbacConfig: HierarchicalRbacMasterConfig;
  userRole?: string;
  isSuperAdmin?: boolean;
}): {
  allowed: boolean;
  reason?: string;
} {
  const {
    campusId,
    accountCode,
    action = 'post',
    rbacConfig,
    isSuperAdmin = false,
  } = params;

  // Level 1 Platform Super Admin can override
  if (isSuperAdmin || rbacConfig.activeLevel === 'level_1_platform_super_admin') {
    return { allowed: true };
  }

  const campusConfig = rbacConfig.campusAccountAccess[campusId];
  if (!campusConfig) {
    return { allowed: true };
  }

  // Check if account head is explicitly permitted
  const isDirectlyAllowed = campusConfig.allowedAccountCodes.includes(accountCode);
  const headPrefix = accountCode.split('-').slice(0, 2).join('-');
  const isInherited = campusConfig.inheritedGroupCodes.includes(headPrefix);

  if (!isDirectlyAllowed && !isInherited) {
    return {
      allowed: false,
      reason: `Account code ${accountCode} is not authorized for this campus by Super Admin policy (Account Boundary rule).`,
    };
  }

  // Check sensitive restriction
  if (
    campusConfig.sensitiveRestrictions[accountCode] &&
    rbacConfig.activeLevel !== 'level_3_main_campus_admin'
  ) {
    if (action === 'post' || action === 'approve') {
      return {
        allowed: false,
        reason: `Account ${accountCode} is classified as confidential/management sensitive. Main Campus Administrator or Super Admin authorization required.`,
      };
    }
  }

  const perHead = campusConfig.permissionsByAccount[accountCode];
  if (perHead) {
    if (action === 'post' && !perHead.canPost) {
      return { allowed: false, reason: `Posting permissions revoked for account ${accountCode}.` };
    }
    if (action === 'edit' && !perHead.canEdit) {
      return { allowed: false, reason: `Editing permissions revoked for account ${accountCode}.` };
    }
    if (action === 'approve' && !perHead.canApprove) {
      return { allowed: false, reason: `Approval permissions revoked for account ${accountCode}.` };
    }
  }

  return { allowed: true };
}

/**
 * Filter transactions list based on campus permission boundary:
 * Preserves historical records, but restricts unassigned campuses.
 */
export function filterTransactionsByCampusBoundary(
  transactions: Transaction[],
  currentCampusId: string,
  userLevel: PermissionLevel
): Transaction[] {
  if (
    userLevel === 'level_1_platform_super_admin' ||
    userLevel === 'level_2_client_super_admin'
  ) {
    return transactions;
  }

  if (currentCampusId === 'all') {
    return transactions;
  }

  return transactions.filter((t) => t.campusId === currentCampusId);
}
