import { Campus, Transaction, PettyCashTransaction, AccountHead, AuditLogEntry, AppUser } from '../core/aplusEngine';
import { SchoolClientOrganization, ExtendedCampusNode } from './platformSiteAdminService';
import { SubscriptionInvoice } from './billingAndSubscriptionService';

export const SEED_CLIENTS: SchoolClientOrganization[] = [];

export const SEED_MULTI_TENANT_CAMPUSES: ExtendedCampusNode[] = [];

export const SEED_MULTI_TENANT_USERS: AppUser[] = [
  // LEVEL 1: Platform Super Admin — Site Owner (Preserved for system administration)
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
