import { Campus, Transaction, PettyCashTransaction, AccountHead, AuditLogEntry, AppUser } from '../core/aplusEngine';
import { SchoolClientOrganization, ExtendedCampusNode } from './platformSiteAdminService';
import { SubscriptionInvoice } from './billingAndSubscriptionService';

export const SEED_CLIENTS: SchoolClientOrganization[] = [
  {
    id: 'client-aplus',
    name: 'Aplus School System',
    code: 'APLUS',
    tier: 'Professional',
    status: 'active',
    contactPerson: 'Director Finance & Operations',
    contactEmail: 'admin@aplus.edu.pk',
    contactPhone: '+92 300 5551122',
    address: 'Central Campus Complex, Khiali Bypass Road, Gujranwala',
    mainCampusId: 'campus-aplus-main',
    maxCampuses: 8,
    maxUsers: 30,
    billingRenewalDate: '2027-10-31',
    enabledModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
      'docs',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    notes: 'Flagship client institution managing Aplus Main Campus and designated regional sub-campuses.',
  },
  {
    id: 'client-apex',
    name: 'Apex School System',
    code: 'APEX',
    tier: 'Professional',
    status: 'active',
    contactPerson: 'Principal M. Siddique (Apex Main)',
    contactEmail: 'admin@apex.edu.pk',
    contactPhone: '+92 321 7773344',
    address: 'Apex Tower, Main Boulevard, Model Town, Lahore',
    mainCampusId: 'campus-apex-main',
    maxCampuses: 6,
    maxUsers: 20,
    billingRenewalDate: '2027-08-31',
    enabledModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
    ],
    createdAt: '2026-02-15T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    notes: 'Independent educational group with Apex Main Campus and suburban branches. Completely isolated from Aplus data.',
  },
];

export const SEED_MULTI_TENANT_CAMPUSES: ExtendedCampusNode[] = [
  // APLUS SCHOOL SYSTEM
  {
    id: 'campus-aplus-main',
    code: 'APLUS-MAIN',
    name: 'Aplus Main Campus',
    city: 'Gujranwala',
    address: 'Central Complex, Khiali Bypass',
    accountantName: 'Aplus Chief Accountant',
    pettyCashFloat: 100000,
    currentPettyCash: 85000,
    status: 'active',
    isMainCampus: true,
    parentCampusId: null,
    clientId: 'client-aplus',
    loginEnabled: true,
    allowedModules: ['dashboard', 'campuses', 'transaction', 'alltransactions', 'pettycash', 'reports', 'accounts'],
  },
  {
    id: 'campus-aplus-khiali',
    code: 'APLUS-KHIALI',
    name: 'Aplus Khiali Campus',
    city: 'Gujranwala',
    address: 'Khiali City Center',
    accountantName: 'Khiali Branch Accountant',
    pettyCashFloat: 40000,
    currentPettyCash: 32000,
    status: 'active',
    isMainCampus: false,
    parentCampusId: 'campus-aplus-main',
    clientId: 'client-aplus',
    loginEnabled: true,
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'cashreconciliation', 'reports'],
  },
  {
    id: 'campus-aplus-c2',
    code: 'APLUS-C2',
    name: 'Aplus Campus 2',
    city: 'Gujranwala',
    address: 'Civil Lines Road, Gujranwala',
    accountantName: 'Campus 2 Cashier',
    pettyCashFloat: 35000,
    currentPettyCash: 28000,
    status: 'active',
    isMainCampus: false,
    parentCampusId: 'campus-aplus-main',
    clientId: 'client-aplus',
    loginEnabled: true,
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'reports'],
  },
  {
    id: 'campus-aplus-c3',
    code: 'APLUS-C3',
    name: 'Aplus Campus 3',
    city: 'Sialkot',
    address: 'Kashmir Road, Sialkot',
    accountantName: 'Campus 3 Accountant',
    pettyCashFloat: 35000,
    currentPettyCash: 35000,
    status: 'active',
    isMainCampus: false,
    parentCampusId: 'campus-aplus-main',
    clientId: 'client-aplus',
    loginEnabled: true,
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'reports'],
  },

  // APEX SCHOOL SYSTEM (COMPLETELY ISOLATED CLIENT)
  {
    id: 'campus-apex-main',
    code: 'APEX-MAIN',
    name: 'Apex Main Campus',
    city: 'Lahore',
    address: 'Model Town Block C, Lahore',
    accountantName: 'Apex Senior Accountant',
    pettyCashFloat: 80000,
    currentPettyCash: 72000,
    status: 'active',
    isMainCampus: true,
    parentCampusId: null,
    clientId: 'client-apex',
    loginEnabled: true,
    allowedModules: ['dashboard', 'campuses', 'transaction', 'alltransactions', 'pettycash', 'reports', 'accounts'],
  },
  {
    id: 'campus-apex-c2',
    code: 'APEX-C2',
    name: 'Apex Campus 2',
    city: 'Lahore',
    address: 'Gulberg III, Lahore',
    accountantName: 'Apex C2 Accountant',
    pettyCashFloat: 30000,
    currentPettyCash: 25000,
    status: 'active',
    isMainCampus: false,
    parentCampusId: 'campus-apex-main',
    clientId: 'client-apex',
    loginEnabled: true,
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'cashreconciliation', 'reports'],
  },
  {
    id: 'campus-apex-c3',
    code: 'APEX-C3',
    name: 'Apex Campus 3',
    city: 'Faisalabad',
    address: 'Canal Road, Faisalabad',
    accountantName: 'Apex C3 Accountant',
    pettyCashFloat: 30000,
    currentPettyCash: 30000,
    status: 'active',
    isMainCampus: false,
    parentCampusId: 'campus-apex-main',
    clientId: 'client-apex',
    loginEnabled: true,
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'reports'],
  },
];

export const SEED_MULTI_TENANT_USERS: AppUser[] = [
  // LEVEL 1: Platform Super Admin — Site Owner
  {
    id: 'user-platform-owner',
    username: 'admin',
    name: 'Platform Super Admin (Site Owner)',
    email: 'siteowner@platform.org',
    role: 'level_1_platform_super_admin',
    status: 'active',
    password: 'admin',
    clientId: null,
    campusId: null,
    permittedCampusIds: ['all'],
    allowedModules: ['all'],
    designation: 'Platform Site Owner',
  },

  // LEVEL 2: Aplus Main Campus Administrator — Client Owner
  {
    id: 'user-aplus-main-admin',
    username: 'aplus_admin',
    name: 'Aplus Main Administrator',
    email: 'admin@aplus.edu.pk',
    role: 'level_2_client_super_admin',
    status: 'active',
    password: 'aplus',
    clientId: 'client-aplus',
    campusId: 'campus-aplus-main',
    permittedCampusIds: [
      'campus-aplus-main',
      'campus-aplus-khiali',
      'campus-aplus-c2',
      'campus-aplus-c3',
    ],
    allowedModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
      'billing',
    ],
    designation: 'Client Owner & Main Campus Admin',
  },

  // LEVEL 3: Aplus Khiali Sub-Campus Administrator
  {
    id: 'user-aplus-khiali-admin',
    username: 'aplus_khiali',
    name: 'Aplus Khiali Accountant',
    email: 'khiali@aplus.edu.pk',
    role: 'level_3_sub_campus_admin',
    status: 'active',
    password: 'khiali',
    clientId: 'client-aplus',
    campusId: 'campus-aplus-khiali',
    permittedCampusIds: ['campus-aplus-khiali'],
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'cashreconciliation', 'reports'],
    designation: 'Sub-Campus Accountant',
  },

  // LEVEL 4: Aplus Campus 2 Staff / Cashier
  {
    id: 'user-aplus-c2-cashier',
    username: 'aplus_cashier',
    name: 'Aplus C2 Cashier',
    email: 'cashier@aplus.edu.pk',
    role: 'cashier',
    status: 'active',
    password: 'cashier',
    clientId: 'client-aplus',
    campusId: 'campus-aplus-c2',
    permittedCampusIds: ['campus-aplus-c2'],
    allowedModules: ['dashboard', 'transaction', 'pettycash'],
    designation: 'Branch Cashier',
  },

  // LEVEL 2: Apex Main Campus Administrator — Client Owner
  {
    id: 'user-apex-main-admin',
    username: 'apex_admin',
    name: 'Apex Main Administrator',
    email: 'admin@apex.edu.pk',
    role: 'level_2_client_super_admin',
    status: 'active',
    password: 'apex',
    clientId: 'client-apex',
    campusId: 'campus-apex-main',
    permittedCampusIds: [
      'campus-apex-main',
      'campus-apex-c2',
      'campus-apex-c3',
    ],
    allowedModules: [
      'dashboard',
      'campuses',
      'transaction',
      'alltransactions',
      'pettycash',
      'cashreconciliation',
      'reports',
      'accounts',
      'reconciliation',
      'activity',
      'billing',
    ],
    designation: 'Apex Client Owner & Main Admin',
  },

  // LEVEL 3: Apex Campus 2 Sub-Campus Administrator
  {
    id: 'user-apex-c2-admin',
    username: 'apex_c2',
    name: 'Apex C2 Administrator',
    email: 'c2@apex.edu.pk',
    role: 'level_3_sub_campus_admin',
    status: 'active',
    password: 'apexc2',
    clientId: 'client-apex',
    campusId: 'campus-apex-c2',
    permittedCampusIds: ['campus-apex-c2'],
    allowedModules: ['dashboard', 'transaction', 'alltransactions', 'pettycash', 'cashreconciliation', 'reports'],
    designation: 'Sub-Campus Admin',
  },
];

/**
 * Filter campuses strictly according to authenticated user's organization and permissions
 */
export function filterCampusesForUser(allCampuses: Campus[], user: AppUser | null | undefined): Campus[] {
  if (!user) return [];

  // Level 1: Platform Super Admin sees all
  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin' ||
    (user.role === 'superadmin' && (!user.clientId || !user.campusId))
  ) {
    return allCampuses;
  }

  // Level 2: Client Owner (Main Campus Admin)
  if (user.role === 'level_2_client_super_admin' && user.clientId) {
    return allCampuses.filter((c) => {
      // Must belong to user's client
      if (c.clientId && c.clientId !== user.clientId) return false;
      if (!c.clientId && user.clientId !== 'client-aplus') return false;

      // Sub-campus of own main campus, or explicitly delegated
      const isOwnMain = c.id === user.campusId;
      const isSubOfMain = c.parentCampusId === user.campusId;
      const isPermitted = (user.permittedCampusIds || []).includes(c.id);

      return isOwnMain || isSubOfMain || isPermitted;
    });
  }

  // Level 3 & 4: Sub-Campus Admin / Staff
  const allowedSet = new Set(user.permittedCampusIds || [user.campusId].filter(Boolean));
  return allCampuses.filter((c) => {
    // Strict client isolation check
    if (user.clientId && c.clientId && c.clientId !== user.clientId) return false;
    return allowedSet.has(c.id) || c.id === user.campusId;
  });
}

/**
 * Filter transactions strictly according to authenticated user
 * Aplus NEVER sees Apex transactions; Apex NEVER sees Aplus transactions!
 */
export function filterTransactionsForUser(
  allTransactions: Transaction[],
  user: AppUser | null | undefined,
  allCampuses: Campus[]
): Transaction[] {
  if (!user) return [];

  // Level 1: Platform Super Admin
  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin' ||
    (user.role === 'superadmin' && !user.clientId)
  ) {
    return allTransactions;
  }

  const authorizedCampuses = filterCampusesForUser(allCampuses, user);
  const authorizedCampusIds = new Set(authorizedCampuses.map((c) => c.id));

  return allTransactions.filter((tx) => {
    // If transaction has explicit clientId, must match user.clientId
    if (user.clientId && tx.clientId && tx.clientId !== user.clientId) {
      return false;
    }
    return authorizedCampusIds.has(tx.campusId);
  });
}

/**
 * Filter petty cash transactions strictly according to authenticated user
 */
export function filterPettyCashForUser(
  allPettyCash: PettyCashTransaction[],
  user: AppUser | null | undefined,
  allCampuses: Campus[]
): PettyCashTransaction[] {
  if (!user) return [];

  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin' ||
    (user.role === 'superadmin' && !user.clientId)
  ) {
    return allPettyCash;
  }

  const authorizedCampuses = filterCampusesForUser(allCampuses, user);
  const authorizedCampusIds = new Set(authorizedCampuses.map((c) => c.id));

  return allPettyCash.filter((pt) => {
    if (user.clientId && pt.clientId && pt.clientId !== user.clientId) {
      return false;
    }
    return authorizedCampusIds.has(pt.campusId);
  });
}

/**
 * Filter invoices strictly according to authenticated user
 */
export function filterInvoicesForUser(
  allInvoices: SubscriptionInvoice[],
  user: AppUser | null | undefined
): SubscriptionInvoice[] {
  if (!user) return [];

  // Level 1: Platform Super Admin sees all invoices
  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin' ||
    (user.role === 'superadmin' && !user.clientId)
  ) {
    return allInvoices;
  }

  // Level 2: Main Campus Admin sees only their own client invoices
  if (user.clientId) {
    return allInvoices.filter((inv) => inv.clientId === user.clientId);
  }

  return [];
}

/**
 * Filter audit logs strictly according to authenticated user
 */
export function filterAuditLogsForUser(
  allLogs: AuditLogEntry[],
  user: AppUser | null | undefined,
  allCampuses: Campus[]
): AuditLogEntry[] {
  if (!user) return [];

  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin' ||
    (user.role === 'superadmin' && !user.clientId)
  ) {
    return allLogs;
  }

  const authorizedCampuses = filterCampusesForUser(allCampuses, user);
  const authorizedCampusIds = new Set(authorizedCampuses.map((c) => c.id));

  return allLogs.filter((log) => {
    if (user.clientId && log.clientId && log.clientId !== user.clientId) {
      return false;
    }
    return authorizedCampusIds.has(log.campusId) || log.campusId === 'all';
  });
}

/**
 * Check if Main Campus Administrator is allowed to create a new sub-campus
 * (Validates subscription maximum campus limit)
 */
export function validateCampusCreationLimit(params: {
  user: AppUser;
  client: SchoolClientOrganization;
  currentCampuses: Campus[];
}): { allowed: boolean; currentCount: number; maxLimit: number; message: string } {
  const { user, client, currentCampuses } = params;

  if (
    user.role === 'level_1_platform_super_admin' ||
    user.role === 'admin'
  ) {
    return {
      allowed: true,
      currentCount: currentCampuses.length,
      maxLimit: 999,
      message: 'Platform Super Admin has unlimited campus creation clearance.',
    };
  }

  // Count existing campuses for this client
  const clientCampuses = currentCampuses.filter(
    (c) => c.clientId === client.id || (!c.clientId && client.id === 'client-aplus')
  );

  const currentCount = clientCampuses.length;
  const maxLimit = client.maxCampuses || 8;

  if (currentCount >= maxLimit) {
    return {
      allowed: false,
      currentCount,
      maxLimit,
      message: `Subscription Campus Limit Reached (${currentCount}/${maxLimit} registered). Please contact Platform Administration to upgrade your subscription tier before registering additional sub-campuses.`,
    };
  }

  return {
    allowed: true,
    currentCount,
    maxLimit,
    message: `Campus creation allowed (${currentCount}/${maxLimit} registered).`,
  };
}
