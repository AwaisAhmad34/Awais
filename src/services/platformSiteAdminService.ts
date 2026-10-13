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

export const INITIAL_SCHOOL_CLIENTS: SchoolClientOrganization[] = [
  {
    id: 'client-aplus',
    name: 'Aplus School System Network',
    code: 'APLUS',
    tier: 'Enterprise',
    status: 'active',
    contactPerson: 'Director Administration',
    contactEmail: 'director@aplus.edu.pk',
    contactPhone: '+92 300 1234567',
    address: 'Central Campus Complex, Khiali Bypass Road, Gujranwala',
    mainCampusId: 'campus-khiali',
    maxCampuses: 12,
    maxUsers: 50,
    billingRenewalDate: '2027-12-31',
    enabledModules: [
      'dashboard',
      'campuses',
      'multischool_admin',
      'transaction',
      'alltransactions',
      'pettycash',
      'erp_overview',
      'reports',
      'accounts',
      'reconciliation',
      'cashreconciliation',
      'activity',
      'docs',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    notes: 'Flagship client institution with four-voucher & imprest petty cash workflow.',
  },
  {
    id: 'client-beaconcrest',
    name: 'Beacon Crest Education Group',
    code: 'BCEG',
    tier: 'Professional',
    status: 'active',
    contactPerson: 'Mr. Tariq Mehmood (CFO)',
    contactEmail: 'cfo@beaconcrest.edu.pk',
    contactPhone: '+92 321 9876543',
    address: 'City Campus Tower, Civil Lines, Gujranwala',
    mainCampusId: 'campus-beacon-main',
    maxCampuses: 6,
    maxUsers: 25,
    billingRenewalDate: '2027-06-30',
    enabledModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
    ],
    createdAt: '2026-03-15T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    notes: 'Secondary educational group client with 3 regional branches.',
  },
];

// ----------------------------------------------------------------------------
// CLIENTS PERSISTENCE & CLOUD SYNC
// ----------------------------------------------------------------------------

export function getStoredSchoolClients(): SchoolClientOrganization[] {
  try {
    if (typeof window === 'undefined') return INITIAL_SCHOOL_CLIENTS;
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (!raw) {
      saveStoredSchoolClients(INITIAL_SCHOOL_CLIENTS);
      return INITIAL_SCHOOL_CLIENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SCHOOL_CLIENTS;
  } catch {
    return INITIAL_SCHOOL_CLIENTS;
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
