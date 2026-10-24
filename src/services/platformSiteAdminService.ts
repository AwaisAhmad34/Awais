import { Campus, AccountHead, Transaction } from '../core/aplusEngine';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

export interface SchoolClientOrganization {
  id: string;
  name: string;
  code: string;
  tier: 'Starter' | 'Professional' | 'Enterprise';
  status: 'active' | 'suspended' | 'pending_approval' | 'archived';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  mainCampusId: string;
  maxCampuses: number;
  maxUsers: number;
  billingRenewalDate: string;
  enabledModules: string[];
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface ERPModuleDefinition {
  id: string;
  name: string;
  category: 'Core Financials' | 'Audit & Compliance' | 'Analytics & Operations' | 'Governance & Tools';
  description: string;
  iconName?: string;
  isCore?: boolean;
}

export const PLATFORM_CLIENT_MODULES: ERPModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Executive KPI Dashboard',
    category: 'Core Financials',
    description: 'High-level financial summaries, revenue vs expenditure metrics, and operational cards.',
    isCore: true,
  },
  {
    id: 'transaction',
    name: 'Single Voucher Entry',
    category: 'Core Financials',
    description: 'Create individual Cash and Bank vouchers (BPV, BRV, CPV, CRV, JV) with multi-row double entry.',
  },
  {
    id: 'alltransactions',
    name: 'Transaction Ledger & Approval Queue',
    category: 'Core Financials',
    description: 'Searchable ledger, verification queue, status approvals (Pending, Approved, Posted), and batch actions.',
  },
  {
    id: 'pettycash',
    name: 'Petty Cash Imprest & Float',
    category: 'Core Financials',
    description: 'Petty cash log, imprest float replenishments, expense disbursements, and category vouchers.',
  },
  {
    id: 'accounts',
    name: 'Chart of Accounts (COA)',
    category: 'Core Financials',
    description: 'Hierarchical 4-digit Chart of Accounts, head balances, debit/credit tracking, and ledger codes.',
  },
  {
    id: 'openingbalance',
    name: 'Opening Balances & IAS-1 Balancing',
    category: 'Core Financials',
    description: 'Campus opening ledger balances with automatic IAS-1 compliant equity balancing journal vouchers.',
  },
  {
    id: 'reconciliation',
    name: 'Bank Transaction Reconciliation',
    category: 'Audit & Compliance',
    description: 'Monthly bank statement matching, uncleared cheque audit, and reconciliation status tracking.',
  },
  {
    id: 'cashreconciliation',
    name: '7-Day Physical Cash Audit',
    category: 'Audit & Compliance',
    description: 'Physical vault note denomination counting, safe balance certificates, and 7-day auditor sign-offs.',
  },
  {
    id: 'reports',
    name: 'Multi-Format Financial Reports',
    category: 'Analytics & Operations',
    description: 'Trial Balance, Profit & Loss (P&L), Balance Sheet, Campus Comparisons, and Ledger PDFs.',
  },
  {
    id: 'budget_variance',
    name: 'Budget Planning & Variance Analytics',
    category: 'Analytics & Operations',
    description: 'Campus monthly expense budget limits, real-time variance gauges, and overspend threshold alerts.',
  },
  {
    id: 'ai_suggester',
    name: 'AI Expense Categorization Suggester',
    category: 'Analytics & Operations',
    description: 'Intelligent suggestion of Chart of Accounts categories from transaction narrations and historical trends.',
  },
  {
    id: 'activity',
    name: 'Forensic Audit Trail & Security Logs',
    category: 'Audit & Compliance',
    description: 'Tamper-evident system activity logging, voucher modification histories, and login forensics.',
  },
  {
    id: 'approval_matrix',
    name: 'Configurable Voucher Approval Matrix',
    category: 'Governance & Tools',
    description: 'Custom threshold rules, role-based authorization limits, and dual-sign-off policies.',
  },
  {
    id: 'multischool_admin',
    name: 'Campus Database Credentials Vault',
    category: 'Governance & Tools',
    description: 'Management of campus dynamic passwords, PIN tokens, and direct branch login access.',
  },
  {
    id: 'campuses',
    name: 'Sub-Campus Management & Hierarchy',
    category: 'Governance & Tools',
    description: 'Branch registration, parent-child satellite reporting, and campus-level parameter configuration.',
  },
  {
    id: 'docs',
    name: 'System Manual & SOP Documentation',
    category: 'Governance & Tools',
    description: 'Standard Operating Procedures, role handbooks, and regulatory accounting compliance guidelines.',
  },
];

export const DEFAULT_CLIENT_MODULES = [
  'dashboard',
  'transaction',
  'alltransactions',
  'pettycash',
  'accounts',
  'openingbalance',
  'reconciliation',
  'cashreconciliation',
  'reports',
  'budget_variance',
  'ai_suggester',
  'activity',
  'approval_matrix',
  'campuses',
  'docs',
];

export interface ExtendedCampusNode extends Campus {
  clientId?: string;
  isMainCampus?: boolean;
  parentCampusId?: string | null;
  delegatedAdminId?: string;
  hierarchyLevel?: number;
}

export interface PlatformSystemSettings {
  platformName: string;
  platformCreatorName: string;
  platformCreatorEmail: string;
  supportEmail: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enforce2FAForAdmins: boolean;
  maxFailedLoginAttempts: number;
  sessionTimeoutMinutes: number;
  allowClientSelfRegistration: boolean;
  defaultClientTier: 'Starter' | 'Professional' | 'Enterprise';
  lastDisasterRecoveryBackupAt: string | null;
  systemVersion: string;
}

export interface PlatformAuditSecurityEvent {
  id: string;
  timestamp: string;
  epochMs: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actorName: string;
  actorRole: string;
  actorEmail?: string;
  category:
    | 'AUTHENTICATION'
    | 'CLIENT_MANAGEMENT'
    | 'CAMPUS_HIERARCHY'
    | 'PERMISSION_CHANGE'
    | 'FINANCIAL_INTEGRITY'
    | 'ACCOUNT_HEAD'
    | 'SECURITY_VIOLATION'
    | 'SYSTEM_SETTINGS';
  action: string;
  targetEntity: string;
  targetId: string;
  details: string;
  ipOrDevice?: string;
}

const CLIENTS_STORAGE_KEY = 'aplus_platform_school_clients_v1';
const SETTINGS_STORAGE_KEY = 'aplus_platform_system_settings_v1';
const PLATFORM_AUDIT_STORAGE_KEY = 'aplus_platform_security_audit_logs_v1';

export const DEFAULT_PLATFORM_SETTINGS: PlatformSystemSettings = {
  platformName: 'Multi-Campus School Management Platform',
  platformCreatorName: 'Platform Site Administrator (Original Creator)',
  platformCreatorEmail: 'creator@siteadmin.internal',
  supportEmail: 'support@aplus.edu.pk',
  maintenanceMode: false,
  maintenanceMessage: 'System is undergoing scheduled security and database maintenance. Please check back shortly.',
  enforce2FAForAdmins: false,
  maxFailedLoginAttempts: 5,
  sessionTimeoutMinutes: 60,
  allowClientSelfRegistration: false,
  defaultClientTier: 'Enterprise',
  lastDisasterRecoveryBackupAt: new Date().toISOString(),
  systemVersion: 'v4.2.0-Enterprise',
};

export const INITIAL_SCHOOL_CLIENTS: SchoolClientOrganization[] = [];

// ----------------------------------------------------------------------------
// CLIENTS PERSISTENCE & CLOUD SYNC
// ----------------------------------------------------------------------------

export function getStoredSchoolClients(): SchoolClientOrganization[] {
  try {
    if (typeof window === 'undefined') return [];
    const isPurged =
      localStorage.getItem('aplus_all_data_purged_production') === 'true' ||
      localStorage.getItem('aplus_dummy_data_purged_v2') === 'true';
    if (isPurged) {
      const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    }
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) {
      saveStoredSchoolClients([]);
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function purgeAllProductionData(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem('aplus_all_data_purged_production', 'true');
    localStorage.setItem('aplus_dummy_data_purged_v2', 'true');
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem('aplus_transactions', JSON.stringify([]));
    localStorage.setItem('aplus_petty_cash', JSON.stringify([]));
    localStorage.setItem('aplus_campuses', JSON.stringify([]));
    localStorage.setItem('aplus_activity_logs', JSON.stringify([]));
    localStorage.setItem(PLATFORM_AUDIT_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem('aplus_global_recycle_bin_v1', JSON.stringify([]));
    localStorage.setItem('aplus_global_recycle_bin_v2', JSON.stringify([]));
    localStorage.setItem('aplus_campus_login_activities_v1', JSON.stringify([]));
    localStorage.removeItem('aplus_current_campus');

    // Keep only the Level 1 Platform Super Admin (Site Owner)
    const superAdminOnly = [
      {
        id: 'user-platform-owner',
        username: 'admin',
        name: 'Platform Super Admin (Site Owner)',
        email: 'siteowner@platform.org',
        role: 'level_1_platform_super_admin',
        isSuperAdmin: true,
        status: 'active',
        password: 'admin',
        clientId: null,
        campusId: 'all',
        permittedCampusIds: ['all'],
        allowedModules: ['all'],
        designation: 'Platform Site Owner',
      },
    ];
    localStorage.setItem('ams_users_v5_clean', JSON.stringify(superAdminOnly));
    localStorage.setItem('aplus_users', JSON.stringify(superAdminOnly));
  } catch (err) {
    console.error('Failed to purge production data:', err);
  }
}

export function saveStoredSchoolClients(clients: SchoolClientOrganization[]): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    }
  } catch {}
}

export async function syncSchoolClientsToCloud(clients: SchoolClientOrganization[]): Promise<void> {
  try {
    saveStoredSchoolClients(clients);
    const docRef = doc(db, 'system_state', 'school_clients_registry');
    await setDoc(docRef, {
      clients,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Site Admin',
    });
  } catch (err) {
    console.warn('[SiteAdmin] Cloud sync of clients deferred:', err);
  }
}

export async function fetchSchoolClientsFromCloud(): Promise<SchoolClientOrganization[]> {
  try {
    const docRef = doc(db, 'system_state', 'school_clients_registry');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().clients) {
      const cloudClients = snap.data().clients as SchoolClientOrganization[];
      saveStoredSchoolClients(cloudClients);
      return cloudClients;
    }
  } catch {}
  return getStoredSchoolClients();
}

// ----------------------------------------------------------------------------
// PLATFORM SETTINGS PERSISTENCE
// ----------------------------------------------------------------------------

export function getStoredPlatformSettings(): PlatformSystemSettings {
  try {
    if (typeof window === 'undefined') return DEFAULT_PLATFORM_SETTINGS;
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      saveStoredPlatformSettings(DEFAULT_PLATFORM_SETTINGS);
      return DEFAULT_PLATFORM_SETTINGS;
    }
    return { ...DEFAULT_PLATFORM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export function saveStoredPlatformSettings(settings: PlatformSystemSettings): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {}
}

export async function syncPlatformSettingsToCloud(settings: PlatformSystemSettings): Promise<void> {
  try {
    saveStoredPlatformSettings(settings);
    const docRef = doc(db, 'system_state', 'platform_settings');
    await setDoc(docRef, {
      settings,
      updatedAt: new Date().toISOString(),
    });
  } catch {}
}

// ----------------------------------------------------------------------------
// SECURITY & AUDIT EVENT RECORDER
// ----------------------------------------------------------------------------

export function getStoredPlatformAuditLogs(): PlatformAuditSecurityEvent[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(PLATFORM_AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordSiteAdminSecurityEvent(
  params: Omit<PlatformAuditSecurityEvent, 'id' | 'timestamp' | 'epochMs'>
): PlatformAuditSecurityEvent {
  const newEvent: PlatformAuditSecurityEvent = {
    id: `audit-sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    epochMs: Date.now(),
    ...params,
  };

  try {
    const existing = getStoredPlatformAuditLogs();
    const updated = [newEvent, ...existing].slice(0, 500); // keep last 500
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLATFORM_AUDIT_STORAGE_KEY, JSON.stringify(updated));
    }

    // Sync to Firestore in background
    const docRef = doc(db, 'platform_security_audits', newEvent.id);
    setDoc(docRef, newEvent).catch(() => {});
  } catch {}

  return newEvent;
}

// ----------------------------------------------------------------------------
// HIERARCHY VALIDATION (Prevents circular references & invalid parent-child links)
// ----------------------------------------------------------------------------

export function validateCampusHierarchy(
  campuses: ExtendedCampusNode[],
  targetCampusId: string,
  proposedParentId: string | null | undefined
): { isValid: boolean; error?: string } {
  if (!proposedParentId || proposedParentId === '' || proposedParentId === 'none') {
    return { isValid: true };
  }

  // Flaw Check 1: A campus cannot be its own parent
  if (targetCampusId === proposedParentId) {
    return {
      isValid: false,
      error: 'Self-parenting violation: A campus cannot be configured as its own parent.',
    };
  }

  // Flaw Check 2: Check if parent exists
  const parentCampus = campuses.find((c) => c.id === proposedParentId);
  if (!parentCampus) {
    return {
      isValid: false,
      error: 'Invalid hierarchy: The specified parent campus does not exist.',
    };
  }

  // Flaw Check 3: Circular dependency detection (Cycle check: A -> B -> A)
  let currentParentId: string | null | undefined = parentCampus.parentCampusId;
  const visited = new Set<string>([targetCampusId, proposedParentId]);
  let depth = 0;

  while (currentParentId && currentParentId !== 'none' && depth < 20) {
    depth++;
    if (currentParentId === targetCampusId) {
      return {
        isValid: false,
        error: `Circular hierarchy loop detected: Campus '${parentCampus.name}' is already a descendant of this campus. Setting this relationship would cause an infinite loop.`,
      };
    }
    if (visited.has(currentParentId)) {
      return {
        isValid: false,
        error: 'Circular dependency chain detected in campus hierarchy tree.',
      };
    }
    visited.add(currentParentId);
    const nextParent = campuses.find((c) => c.id === currentParentId);
    currentParentId = nextParent?.parentCampusId;
  }

  return { isValid: true };
}

// ----------------------------------------------------------------------------
// ACCOUNT-HEAD CODE GENERATOR & REFERENCE PROTECTION
// ----------------------------------------------------------------------------

/**
 * Checks whether an account code is locked because existing vouchers reference it.
 * Referenced accounts MUST NOT be deleted or have their codes renamed.
 */
export function isAccountCodeReferencedInTransactions(
  accountCode: string,
  transactions: Transaction[]
): { isReferenced: boolean; usageCount: number; sampleVoucherNo?: string } {
  let usageCount = 0;
  let sampleVoucherNo: string | undefined;

  for (const tx of transactions) {
    for (const ent of tx.entries || []) {
      if (ent.accountCode === accountCode) {
        usageCount++;
        if (!sampleVoucherNo) sampleVoucherNo = tx.voucherNo;
      }
    }
  }

  return {
    isReferenced: usageCount > 0,
    usageCount,
    sampleVoucherNo,
  };
}

/**
 * Generates the next child account head code following the 1001 -> 1001-1, 1001-2 standard.
 */
export function generateNextChildAccountCode(
  parentCode: string,
  existingHeads: AccountHead[]
): string {
  const cleanParent = parentCode.trim();
  const childPrefix = `${cleanParent}-`;

  // Find all existing child codes starting with parentCode-
  const existingChildNumbers = existingHeads
    .map((h) => h.code)
    .filter((code) => code.startsWith(childPrefix))
    .map((code) => {
      const suffix = code.slice(childPrefix.length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? 0 : num;
    });

  const nextSeq = existingChildNumbers.length > 0 ? Math.max(...existingChildNumbers) + 1 : 1;
  return `${cleanParent}-${nextSeq}`;
}

// ----------------------------------------------------------------------------
// CROSS-CAMPUS DATA ISOLATION & PERMISSION AUDIT
// ----------------------------------------------------------------------------

export interface CampusDataScope {
  userLevel: string;
  isPlatformAdmin: boolean;
  isClientAdmin: boolean;
  authorizedCampusIds: string[];
  scopeLabel: string;
}

export function resolveUserCampusDataScope(
  userRole: string | undefined,
  assignedCampusId: string | undefined,
  delegatedSubCampusIds: string[] | undefined,
  allCampuses: Campus[]
): CampusDataScope {
  const isPlatformAdmin =
    userRole === 'admin' ||
    userRole === 'level_1_platform_super_admin' ||
    userRole === 'superadmin';

  const isClientAdmin = userRole === 'level_2_client_super_admin';

  if (isPlatformAdmin) {
    return {
      userLevel: 'Level 1 Platform Admin',
      isPlatformAdmin: true,
      isClientAdmin: false,
      authorizedCampusIds: allCampuses.map((c) => c.id),
      scopeLabel: 'Platform-Wide (All Clients & Campuses)',
    };
  }

  if (isClientAdmin) {
    return {
      userLevel: 'Level 2 Client Organization Admin',
      isPlatformAdmin: false,
      isClientAdmin: true,
      authorizedCampusIds: allCampuses.map((c) => c.id),
      scopeLabel: 'Client Organization (Authorized Campuses Only)',
    };
  }

  // Level 3 Main Campus Admin
  const baseId = assignedCampusId || allCampuses[0]?.id || 'campus-main';
  const delegated = delegatedSubCampusIds || [];
  const authorized = Array.from(new Set([baseId, ...delegated]));

  const campusNames = allCampuses
    .filter((c) => authorized.includes(c.id))
    .map((c) => c.name)
    .join(', ');

  return {
    userLevel: delegated.length > 0 ? 'Level 3 Main Campus Admin' : 'Level 4/5 Campus Staff',
    isPlatformAdmin: false,
    isClientAdmin: false,
    authorizedCampusIds: authorized,
    scopeLabel: `Campus Scope: ${campusNames || 'Assigned Branch Only'}`,
  };
}
