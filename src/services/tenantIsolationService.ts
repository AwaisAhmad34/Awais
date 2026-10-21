/**
 * Multi-Campus Backend Service Module: Tenant Isolation & Campus Permission Engine
 * 
 * Enforces strict multi-tenant isolation by:
 * 1. Automatically appending a 'client_id' filter to every database query.
 * 2. Validating that the currently authenticated user has the necessary permissions
 *    for the requested 'campus_id' (including main campus vs sub-campus hierarchy).
 * 3. Enforcing this across all CRUD operations on:
 *    - Vouchers (BPV, BRV, CPV, CRV, JV)
 *    - Users & Role Assignments
 *    - Financial Records (Ledgers, Petty Cash, Reconciliations, Budget Variances)
 * 4. Providing Platform Site Admin & Multi-Campus Management Hub with full controls
 *    to manage financial reports permissions (which reports show to which clients).
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// INTERFACES & TYPES
// ----------------------------------------------------------------------------

export type PermissionLevel =
  | 'level_1_platform_super_admin'
  | 'level_2_client_super_admin'
  | 'level_3_main_campus_admin'
  | 'level_4_sub_campus_admin'
  | 'level_5_departmental_staff';

export interface TenantContext {
  clientId: string;
  userId: string;
  userName: string;
  userRole: string;
  permissionLevel: PermissionLevel;
  campusId?: string | null; // Assigned primary campus ('all' for root admins)
  delegatedCampusIds?: string[]; // Sub-campuses under supervision
  isPlatformAdmin: boolean;
  isClientAdmin: boolean;
  ipOrOrigin?: string;
}

export interface CampusNode {
  id: string;
  code: string;
  name: string;
  clientId: string;
  isMainCampus?: boolean;
  parentCampusId?: string | null;
  status: 'active' | 'inactive';
}

export type CrudAction = 'create' | 'read' | 'update' | 'delete' | 'list';

export interface CampusPermissionResult {
  allowed: boolean;
  reason?: string;
  authorizedCampusIds: string[];
}

export interface IsolatedDatabaseQuery<T = any> {
  collectionName: string;
  clientId: string;
  campusIdFilter?: string | string[];
  filters: Record<string, any>;
  params?: T;
}

// ----------------------------------------------------------------------------
// FINANCIAL REPORTS CATALOG & CLIENT PERMISSION MODEL
// ----------------------------------------------------------------------------

export interface FinancialReportDefinition {
  key: string;
  title: string;
  shortTitle: string;
  category: 'Financial Statements' | 'Ledgers & Daybooks' | 'Executive & Board' | 'Audits & Controls' | 'Petty Cash & Imprest';
  description: string;
  defaultAllowedRoles: PermissionLevel[];
  sensitivityTier: 'standard' | 'confidential' | 'executive_board';
  supportsConsolidated: boolean;
  supportedExportFormats: ('pdf' | 'excel' | 'print')[];
}

export interface ClientReportPermission {
  clientId: string;
  reportKey: string;
  reportTitle: string;
  category: string;
  enabled: boolean;
  minimumRole: PermissionLevel;
  allowCrossCampusConsolidated: boolean;
  sensitivityTier: 'standard' | 'confidential' | 'executive_board';
  allowedExportFormats: ('pdf' | 'excel' | 'print')[];
  customNotes?: string;
  updatedAt: string;
  updatedBy: string;
}

// Master Platform Financial Reports Catalog (15 Core & Extended Financial Reports)
export const PLATFORM_FINANCIAL_REPORTS_CATALOG: FinancialReportDefinition[] = [
  {
    key: 'format_1_main',
    title: 'Format 1: Institutional Standard Financial Suite',
    shortTitle: '1. Institutional Master Suite',
    category: 'Financial Statements',
    description: 'Master accounting report containing All Account Ledgers, 8-Column Trial Balance, Income Statement, Balance Sheet, and Statutory Signature Matrix.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_2_executive_board',
    title: 'Format 2: Executive Board & Trustee Financial Digest',
    shortTitle: '2. Executive Board Summary',
    category: 'Executive & Board',
    description: 'High-level executive CFO presentation featuring Surplus/Deficit KPIs, Revenue vs Expense Ratios, and Strategic Financial Health Indicators.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin'],
    sensitivityTier: 'executive_board',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'print'],
  },
  {
    key: 'format_3_daily_daybook',
    title: 'Format 3: Chronological Daily Daybook & Cash/Bank Scroll',
    shortTitle: '3. Daily Daybook Scroll',
    category: 'Ledgers & Daybooks',
    description: 'Continuous date-ordered transaction log of every posted voucher entry with opening, transaction movements, and running net balances.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin', 'level_5_departmental_staff'],
    sensitivityTier: 'standard',
    supportsConsolidated: false,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_4_t_account',
    title: 'Format 4: Classic Horizontal Two-Sided T-Account Ledger',
    shortTitle: '4. T-Account (Dr | Cr Split)',
    category: 'Ledgers & Daybooks',
    description: 'Traditional side-by-side debit (left) and credit (right) presentation per Chart of Accounts head for forensic audit verification.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_5_10col_worksheet',
    title: 'Format 5: 10-Column Extended Accounting Worksheet',
    shortTitle: '5. 10-Col Worksheet',
    category: 'Financial Statements',
    description: 'Complete unadjusted trial balance, year-end adjustments, adjusted trial balance, income statement, and balance sheet reconciliation columns.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'confidential',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel'],
  },
  {
    key: 'format_6_monthly_matrix',
    title: 'Format 6: 12-Month Comparative Expense Matrix',
    shortTitle: '6. Monthly Matrix (Jan-Dec)',
    category: 'Financial Statements',
    description: 'Monthly columnar table showing Jan through Dec spending trends across account heads and campus operational centers.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_7_voucher_books',
    title: 'Format 7: Specialized 5-Voucher Day Books (BPV/BRV/CPV/CRV/JV)',
    shortTitle: '7. 5-Voucher Day Books',
    category: 'Ledgers & Daybooks',
    description: 'Tabular registers dedicated separately to Bank Payment (BPV), Bank Receipt (BRV), Cash Payment (CPV), Cash Receipt (CRV), and Journal Vouchers (JV).',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin', 'level_5_departmental_staff'],
    sensitivityTier: 'standard',
    supportsConsolidated: false,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_8_campus_columnar',
    title: 'Format 8: Cross-Campus Side-by-Side Columnar Comparative Ledger',
    shortTitle: '8. Cross-Campus Columnar',
    category: 'Financial Statements',
    description: 'Multi-campus comparative matrix comparing each branch side-by-side with combined network totals and variance indicators.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'confidential',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_9_expense_pettycash',
    title: 'Format 9: Petty Cash Utilization & Imprest Reconciliations',
    shortTitle: '9. Petty Cash Utilization',
    category: 'Petty Cash & Imprest',
    description: 'Disbursement category breakdowns, replenishment frequency, physical cash reconciliations, and cash float threshold compliance.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin', 'level_5_departmental_staff'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'format_10_audit_certificate',
    title: 'Format 10: Statutory Compliance & Forensic Audit Certificate',
    shortTitle: '10. Forensic Audit Certificate',
    category: 'Audits & Controls',
    description: 'Official auditor sign-off packet with SHA-256 cryptographic hashes, balance sheet certification, debit/credit invariant proofs, and anomaly scan.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin'],
    sensitivityTier: 'executive_board',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'print'],
  },
  {
    key: 'ext_trial_balance_6col',
    title: '6-Column Summary Trial Balance',
    shortTitle: 'Trial Balance (6-Col)',
    category: 'Financial Statements',
    description: 'Standard 6-column trial balance showing Opening Balance, Period Transactions (Dr/Cr), and Closing Balance per Account Head.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'ext_balance_sheet_detailed',
    title: 'Detailed Institutional Balance Sheet',
    shortTitle: 'Balance Sheet',
    category: 'Financial Statements',
    description: 'Formal statement of financial position: Current & Non-Current Assets, Liabilities, and Institutional Capital/Equity.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'confidential',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'ext_profit_loss_statement',
    title: 'Comprehensive Income Statement / Profit & Loss',
    shortTitle: 'Income Statement (P&L)',
    category: 'Financial Statements',
    description: 'Operating Revenues (Fee collections, grants) versus Operating Expenses (Salaries, utilities, maintenance) yielding Net Surplus/Deficit.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'confidential',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
  {
    key: 'ext_cash_flow_statement',
    title: 'Statement of Cash Flows (Operating, Investing, Financing)',
    shortTitle: 'Cash Flow Statement',
    category: 'Financial Statements',
    description: 'Analysis of physical cash inflows and outflows across operating, capital procurement, and banking activities.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin'],
    sensitivityTier: 'confidential',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel'],
  },
  {
    key: 'ext_campus_budget_variance',
    title: 'Campus Budget vs Actual Operational Variance Report',
    shortTitle: 'Budget Variance Analysis',
    category: 'Financial Statements',
    description: 'Allocated campus budget lines compared against actual posted vouchers with variance percentages and overrun alerts.',
    defaultAllowedRoles: ['level_1_platform_super_admin', 'level_2_client_super_admin', 'level_3_main_campus_admin', 'level_4_sub_campus_admin'],
    sensitivityTier: 'standard',
    supportsConsolidated: true,
    supportedExportFormats: ['pdf', 'excel', 'print'],
  },
];

// Default demo clients and campuses for in-memory and backend isolation
export const DEFAULT_TENANT_CAMPUSES: CampusNode[] = [
  { id: 'campus-khiali', code: 'A+ KHL-MAIN', name: 'Khiali Main Campus Complex', clientId: 'client-aplus', isMainCampus: true, parentCampusId: null, status: 'active' },
  { id: 'campus-peoples', code: 'A+ PC-02', name: "Peoples Colony Campus", clientId: 'client-aplus', isMainCampus: false, parentCampusId: 'campus-khiali', status: 'active' },
  { id: 'campus-dc', code: 'A+ DC-03', name: 'DC Colony Satellite Branch', clientId: 'client-aplus', isMainCampus: false, parentCampusId: 'campus-khiali', status: 'active' },
  { id: 'campus-beacon-main', code: 'BCEG-MAIN', name: 'Beacon Crest Civil Lines Main', clientId: 'client-beaconcrest', isMainCampus: true, parentCampusId: null, status: 'active' },
  { id: 'campus-beacon-sub1', code: 'BCEG-S1', name: 'Beacon Crest Model Town Branch', clientId: 'client-beaconcrest', isMainCampus: false, parentCampusId: 'campus-beacon-main', status: 'active' },
  { id: 'campus-crescent-main', code: 'CHA-01', name: 'Crescent Horizon Central Campus', clientId: 'client-crescent', isMainCampus: true, parentCampusId: null, status: 'active' },
];

const REPORT_PERMISSIONS_STORAGE_KEY = 'aplus_client_financial_reports_permissions_v1';

// ----------------------------------------------------------------------------
// CLIENT REPORT PERMISSIONS INITIALIZER & STORE
// ----------------------------------------------------------------------------

export function generateDefaultClientReportPermissions(clientId: string): ClientReportPermission[] {
  const isEnterprise = clientId === 'client-aplus';
  const now = new Date().toISOString();

  return PLATFORM_FINANCIAL_REPORTS_CATALOG.map((def) => {
    // If enterprise tier client, all reports enabled by default.
    // Otherwise, sensitive reports can be configured by Platform Site Admin.
    const isEnabled = isEnterprise ? true : def.sensitivityTier !== 'executive_board';
    return {
      clientId,
      reportKey: def.key,
      reportTitle: def.title,
      category: def.category,
      enabled: isEnabled,
      minimumRole: def.defaultAllowedRoles[def.defaultAllowedRoles.length - 1] || 'level_3_main_campus_admin',
      allowCrossCampusConsolidated: def.supportsConsolidated,
      sensitivityTier: def.sensitivityTier,
      allowedExportFormats: [...def.supportedExportFormats],
      customNotes: `Default policy for ${clientId}`,
      updatedAt: now,
      updatedBy: 'Platform Site Administrator',
    };
  });
}

let serverInMemoryReportPermissions: Record<string, ClientReportPermission[]> = {
  'client-aplus': generateDefaultClientReportPermissions('client-aplus'),
  'client-beaconcrest': generateDefaultClientReportPermissions('client-beaconcrest'),
};

export function getStoredClientReportPermissions(): Record<string, ClientReportPermission[]> {
  if (typeof window === 'undefined') {
    return serverInMemoryReportPermissions;
  }

  try {
    const raw = localStorage.getItem(REPORT_PERMISSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}

  const initial: Record<string, ClientReportPermission[]> = {
    'client-aplus': generateDefaultClientReportPermissions('client-aplus'),
    'client-beaconcrest': generateDefaultClientReportPermissions('client-beaconcrest'),
  };
  saveStoredClientReportPermissions(initial);
  return initial;
}

export function saveStoredClientReportPermissions(perms: Record<string, ClientReportPermission[]>): void {
  serverInMemoryReportPermissions = perms;
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPORT_PERMISSIONS_STORAGE_KEY, JSON.stringify(perms));
  } catch {}
}

export async function syncClientReportPermissionsToCloud(
  perms: Record<string, ClientReportPermission[]>
): Promise<void> {
  saveStoredClientReportPermissions(perms);
  try {
    await setDoc(
      doc(db, 'system_state', 'client_report_permissions'),
      {
        permissionsByClient: perms,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Platform Site Admin',
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[TenantIsolation] Cloud sync of report permissions deferred:', err);
  }
}

export async function fetchClientReportPermissionsFromCloud(): Promise<Record<string, ClientReportPermission[]>> {
  try {
    const snap = await getDoc(doc(db, 'system_state', 'client_report_permissions'));
    if (snap.exists() && snap.data()?.permissionsByClient) {
      const cloudPerms = snap.data().permissionsByClient as Record<string, ClientReportPermission[]>;
      saveStoredClientReportPermissions(cloudPerms);
      return cloudPerms;
    }
  } catch {}
  return getStoredClientReportPermissions();
}

// ----------------------------------------------------------------------------
// ERROR CLASS
// ----------------------------------------------------------------------------

export class TenantSecurityError extends Error {
  statusCode: number;
  code: string;
  details: Record<string, any>;

  constructor(message: string, code: string = 'TENANT_ISOLATION_VIOLATION', statusCode: number = 403, details: Record<string, any> = {}) {
    super(message);
    this.name = 'TenantSecurityError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ----------------------------------------------------------------------------
// CAMPUS PERMISSION RESOLUTION ENGINE
// ----------------------------------------------------------------------------

/**
 * Validates that the authenticated user in context has permissions for the requested campus_id.
 * Level 1 Platform Super Admin: All campuses across all clients
 * Level 2 Client Super Admin: All campuses belonging to context.clientId
 * Level 3 Main Campus Admin: Primary campus + child/delegated sub-campuses
 * Level 4/5 Staff: Strictly assigned campus ONLY
 */
export function validateCampusPermission(
  context: TenantContext,
  requestedCampusId: string | null | undefined,
  action: CrudAction,
  campuses: CampusNode[] = DEFAULT_TENANT_CAMPUSES
): CampusPermissionResult {
  // 1. Level 1 Platform Super Admin has universal access
  if (
    context.isPlatformAdmin ||
    context.permissionLevel === 'level_1_platform_super_admin' ||
    context.userRole === 'admin' ||
    context.userRole === 'superadmin'
  ) {
    return {
      allowed: true,
      authorizedCampusIds: campuses.map((c) => c.id),
    };
  }

  // Filter campuses to current client
  const clientCampuses = campuses.filter((c) => c.clientId === context.clientId);
  const clientCampusIds = clientCampuses.map((c) => c.id);

  // 2. Level 2 Client Super Admin has access to all campuses in their client organization
  if (
    context.isClientAdmin ||
    context.permissionLevel === 'level_2_client_super_admin'
  ) {
    if (!requestedCampusId || requestedCampusId === 'all') {
      return { allowed: true, authorizedCampusIds: clientCampusIds };
    }
    const isClientCampus = clientCampusIds.includes(requestedCampusId);
    if (!isClientCampus) {
      return {
        allowed: false,
        reason: `Campus permission denied: Campus ID '${requestedCampusId}' does not belong to client '${context.clientId}'. Cross-client access is blocked.`,
        authorizedCampusIds: clientCampusIds,
      };
    }
    return { allowed: true, authorizedCampusIds: clientCampusIds };
  }

  // 3. Level 3 Main Campus Admin
  if (context.permissionLevel === 'level_3_main_campus_admin') {
    const mainCampusId = clientCampusIds.includes(context.campusId || '') ? context.campusId : null;
    const childBranches = clientCampuses.filter((c) => c.parentCampusId === mainCampusId).map((c) => c.id);
    const delegated = (context.delegatedCampusIds || []).filter(id => clientCampusIds.includes(id));
    const authorized = Array.from(new Set([mainCampusId, ...childBranches, ...delegated].filter(Boolean) as string[]));

    if (!requestedCampusId || requestedCampusId === 'all') {
      if (action === 'delete') {
        return {
          allowed: false,
          reason: 'Bulk deletion across all campuses is restricted. Level 3 Admins must delete branch records explicitly per campus.',
          authorizedCampusIds: authorized,
        };
      }
      return { allowed: true, authorizedCampusIds: authorized };
    }

    if (authorized.includes(requestedCampusId)) {
      return { allowed: true, authorizedCampusIds: authorized };
    }

    return {
      allowed: false,
      reason: `Campus permission denied: Level 3 Administrator does not have authority over campus '${requestedCampusId}'. Authorized campuses: [${authorized.join(', ')}].`,
      authorizedCampusIds: authorized,
    };
  }

  // 4. Level 4 Sub-Campus Admin & Level 5 Staff: Strictly assigned campus only
  const assignedCampusId = clientCampusIds.includes(context.campusId || '') ? context.campusId : null;
  const authorized = assignedCampusId ? [assignedCampusId] : [];

  if (!requestedCampusId || requestedCampusId === 'all') {
    if (action === 'read' || action === 'list') {
      // Scoped read only to assigned campus
      return { allowed: true, authorizedCampusIds: authorized };
    }
    return {
      allowed: false,
      reason: `Campus permission denied: Campus staff cannot perform '${action}' on consolidated/all campuses. Must specify assigned campus '${assignedCampusId}'.`,
      authorizedCampusIds: authorized,
    };
  }

  if (requestedCampusId === assignedCampusId) {
    return { allowed: true, authorizedCampusIds: authorized };
  }

  return {
    allowed: false,
    reason: `Campus permission denied: User is assigned strictly to campus '${assignedCampusId}'. Access to campus '${requestedCampusId}' is prohibited.`,
    authorizedCampusIds: authorized,
  };
}

// ----------------------------------------------------------------------------
// AUTOMATIC QUERY FILTER INJECTION
// ----------------------------------------------------------------------------

/**
 * Intercepts any incoming database query or filter specification, automatically
 * appending 'client_id' and enforcing campus security rules.
 */
export function enforceTenantQueryFilter<T extends Record<string, any>>(
  context: TenantContext,
  collectionName: string,
  rawFilters: T,
  campuses: CampusNode[] = DEFAULT_TENANT_CAMPUSES
): {
  isolatedFilters: T & { client_id: string; campus_id?: any };
  authorizedCampusIds: string[];
} {
  // If non-platform admin, enforce client_id unconditionally
  const enforcedClientId = context.isPlatformAdmin && rawFilters.client_id
    ? rawFilters.client_id
    : context.clientId;

  const requestedCampusId = rawFilters.campusId || rawFilters.campus_id;
  const perm = validateCampusPermission(context, requestedCampusId, 'list', campuses);

  if (!perm.allowed) {
    throw new TenantSecurityError(
      perm.reason || 'Campus permission denied for requested query.',
      'CAMPUS_PERMISSION_DENIED',
      403,
      { collectionName, requestedCampusId, userRole: context.userRole, clientId: context.clientId }
    );
  }

  const isolatedFilters = {
    ...rawFilters,
    client_id: enforcedClientId,
    // If specific campus requested, use it; otherwise scope to authorized campuses
    campus_id: requestedCampusId && requestedCampusId !== 'all'
      ? requestedCampusId
      : { $in: perm.authorizedCampusIds },
  };

  return {
    isolatedFilters,
    authorizedCampusIds: perm.authorizedCampusIds,
  };
}

// ----------------------------------------------------------------------------
// IN-MEMORY / REPOSITORY CRUD ENGINE WITH TENANT ISOLATION
// ----------------------------------------------------------------------------

/**
 * Mock/Repository state store holding active vouchers, users, and financial records
 * for backend and service modules.
 */
export class TenantIsolatedRepository {
  private vouchers: any[] = [];
  private users: any[] = [];
  private financialRecords: any[] = [];
  private campuses: CampusNode[] = [...DEFAULT_TENANT_CAMPUSES];

  constructor(initialData?: { vouchers?: any[]; users?: any[]; financialRecords?: any[]; campuses?: CampusNode[] }) {
    if (initialData?.campuses) this.campuses = initialData.campuses;
    if (initialData?.vouchers) this.seedVouchers(initialData.vouchers);
    if (initialData?.users) this.seedUsers(initialData.users);
    if (initialData?.financialRecords) this.seedFinancialRecords(initialData.financialRecords);
  }

  public seedVouchers(vouchers: any[]) {
    this.vouchers = vouchers.map((v) => ({
      ...v,
      client_id: v.client_id || v.clientId || 'client-aplus',
      campus_id: v.campus_id || v.campusId || 'campus-khiali',
    }));
  }

  public seedUsers(users: any[]) {
    this.users = users.map((u) => ({
      ...u,
      client_id: u.client_id || u.clientId || 'client-aplus',
      campus_id: u.campus_id || u.campusId || 'campus-khiali',
    }));
  }

  public seedFinancialRecords(records: any[]) {
    this.financialRecords = records.map((r) => ({
      ...r,
      client_id: r.client_id || r.clientId || 'client-aplus',
      campus_id: r.campus_id || r.campusId || 'campus-khiali',
    }));
  }

  // --------------------------------------------------------------------------
  // VOUCHERS CRUD
  // --------------------------------------------------------------------------

  public queryVouchers(context: TenantContext, filters: Record<string, any> = {}): any[] {
    const { isolatedFilters, authorizedCampusIds } = enforceTenantQueryFilter(
      context,
      'vouchers',
      filters,
      this.campuses
    );

    return this.vouchers.filter((v) => {
      // Must match client_id
      if ((!context.isPlatformAdmin || filters.client_id) && v.client_id !== isolatedFilters.client_id) {
        return false;
      }
      // Must belong to authorized campuses
      const campId = v.campus_id || v.campusId;
      if (typeof isolatedFilters.campus_id === 'string') {
        if (campId !== isolatedFilters.campus_id) return false;
      } else if (Array.isArray(authorizedCampusIds)) {
        if (!authorizedCampusIds.includes(campId)) return false;
      }
      // Additional filters
      if (filters.voucherType && v.voucherType !== filters.voucherType) return false;
      if (filters.status && v.status !== filters.status) return false;
      return true;
    });
  }

  public getVoucherById(context: TenantContext, voucherId: string): any {
    const voucher = this.vouchers.find((v) => v.id === voucherId || v.voucherNo === voucherId);
    if (!voucher) return null;

    // Tenant check
    if (voucher.client_id !== context.clientId && !context.isPlatformAdmin) {
      throw new TenantSecurityError(
        `Access denied: Voucher '${voucherId}' belongs to another tenant organization.`,
        'TENANT_ISOLATION_VIOLATION',
        403,
        { voucherId, userClientId: context.clientId, voucherClientId: voucher.client_id }
      );
    }

    // Campus check
    const perm = validateCampusPermission(context, voucher.campus_id || voucher.campusId, 'read', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(
        perm.reason || `Campus permission denied for voucher '${voucherId}'.`,
        'CAMPUS_PERMISSION_DENIED',
        403,
        { voucherId, campusId: voucher.campus_id || voucher.campusId }
      );
    }

    return voucher;
  }

  public createVoucher(context: TenantContext, payload: any): any {
    const targetCampusId = payload.campus_id || payload.campusId;
    if (!targetCampusId) {
      throw new TenantSecurityError('Validation error: campus_id is required.', 'MISSING_CAMPUS_ID', 400);
    }

    const perm = validateCampusPermission(context, targetCampusId, 'create', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(
        perm.reason || `User does not have permission to create vouchers in campus '${targetCampusId}'.`,
        'CAMPUS_PERMISSION_DENIED',
        403,
        { targetCampusId }
      );
    }

    validateVoucherAmounts(payload);
    if (this.vouchers.some(v => v.id === payload.id || (payload.voucherNo && v.voucherNo === payload.voucherNo && v.campus_id === targetCampusId && v.client_id === context.clientId))) {
      throw new TenantSecurityError('Duplicate voucher ID or number.', 'DUPLICATE_VOUCHER', 409);
    }

    // Inforce client_id automatically
    const newVoucher = {
      ...payload,
      id: payload.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client_id: context.clientId,
      campus_id: targetCampusId,
      campusId: targetCampusId,
      createdAt: new Date().toISOString(),
      createdBy: context.userName,
      createdById: context.userId,
    };

    this.vouchers.push(newVoucher);
    return newVoucher;
  }

  public updateVoucher(context: TenantContext, voucherId: string, updates: any): any {
    const existing = this.getVoucherById(context, voucherId);
    if (!existing) {
      throw new TenantSecurityError(`Voucher '${voucherId}' not found.`, 'NOT_FOUND', 404);
    }

    const perm = validateCampusPermission(context, existing.campus_id || existing.campusId, 'update', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(
        perm.reason || `User does not have permission to update vouchers in campus '${existing.campus_id}'.`,
        'CAMPUS_PERMISSION_DENIED',
        403
      );
    }

    assertImmutableRecord(existing, updates);
    validateVoucherAmounts({ ...existing, ...updates });
    // Prevent changing client_id or transferring across tenants
    if (updates.client_id && updates.client_id !== existing.client_id) {
      throw new TenantSecurityError('Immutable field violation: client_id cannot be altered.', 'IMMUTABLE_TENANT_FIELD', 400);
    }

    const updated = {
      ...existing,
      ...updates,
      client_id: existing.client_id, // locked
      updatedAt: new Date().toISOString(),
      updatedBy: context.userName,
    };

    const idx = this.vouchers.findIndex((v) => v.id === existing.id);
    this.vouchers[idx] = updated;
    return updated;
  }

  public deleteVoucher(context: TenantContext, voucherId: string, reason?: string): { success: boolean; id: string } {
    const existing = this.getVoucherById(context, voucherId);
    if (!existing) {
      throw new TenantSecurityError(`Voucher '${voucherId}' not found.`, 'NOT_FOUND', 404);
    }

    const perm = validateCampusPermission(context, existing.campus_id || existing.campusId, 'delete', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(
        perm.reason || `User does not have permission to delete vouchers in campus '${existing.campus_id}'.`,
        'CAMPUS_PERMISSION_DENIED',
        403
      );
    }

    this.vouchers = this.vouchers.filter((v) => v.id !== existing.id);
    return { success: true, id: existing.id };
  }

  // --------------------------------------------------------------------------
  // USERS CRUD
  // --------------------------------------------------------------------------

  public queryUsers(context: TenantContext, filters: Record<string, any> = {}): any[] {
    const { isolatedFilters, authorizedCampusIds } = enforceTenantQueryFilter(
      context,
      'users',
      filters,
      this.campuses
    );

    return this.users.filter((u) => {
      if ((!context.isPlatformAdmin || filters.client_id) && u.client_id !== isolatedFilters.client_id) {
        return false;
      }
      const campId = u.campus_id || u.campusId;
      if (typeof isolatedFilters.campus_id === 'string' && campId !== isolatedFilters.campus_id) return false;
      if (campId && campId !== 'all') {
        if (!authorizedCampusIds.includes(campId)) return false;
      }
      return true;
    });
  }

  public createUser(context: TenantContext, payload: any): any {
    // Account provisioning is restricted to platform/client administrators.
    if (!context.isPlatformAdmin && !context.isClientAdmin) {
      throw new TenantSecurityError('Access denied: Staff members cannot create users.', 'UNAUTHORIZED_USER_CREATION', 403);
    }

    const targetCampusId = payload.campus_id || payload.campusId || context.campusId || 'all';
    if (targetCampusId !== 'all') {
      const perm = validateCampusPermission(context, targetCampusId, 'create', this.campuses);
      if (!perm.allowed) {
        throw new TenantSecurityError(perm.reason || 'Cannot create user for unauthorized campus.', 'CAMPUS_PERMISSION_DENIED', 403);
      }
    }

    // Prevent privilege escalation: client admins cannot create platform super admins
    if (payload.permissionLevel === 'level_1_platform_super_admin' && !context.isPlatformAdmin) {
      throw new TenantSecurityError('Privilege escalation blocked: Only Platform Super Admin can create Level 1 admins.', 'PRIVILEGE_ESCALATION', 403);
    }

    validateUserAuthority(context, payload);
    const newUser = {
      ...payload,
      id: payload.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client_id: context.clientId,
      campus_id: targetCampusId,
      campusId: targetCampusId,
      createdAt: new Date().toISOString(),
      createdBy: context.userName,
    };

    this.users.push(newUser);
    return newUser;
  }

  public updateUser(context: TenantContext, userId: string, updates: any): any {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new TenantSecurityError(`User '${userId}' not found.`, 'NOT_FOUND', 404);

    if (user.client_id !== context.clientId && !context.isPlatformAdmin) {
      throw new TenantSecurityError('Cross-tenant user modification blocked.', 'TENANT_ISOLATION_VIOLATION', 403);
    }

    const perm = validateCampusPermission(context, user.campus_id || user.campusId, 'update', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(perm.reason || 'User campus permission denied.', 'CAMPUS_PERMISSION_DENIED', 403);
    }

    assertImmutableRecord(user, updates);
    validateUserAuthority(context, { ...user, ...updates });
    const updated = {
      ...user,
      ...updates,
      client_id: user.client_id, // immutable
      updatedAt: new Date().toISOString(),
    };
    const idx = this.users.findIndex((u) => u.id === user.id);
    this.users[idx] = updated;
    return updated;
  }

  public deleteUser(context: TenantContext, userId: string): { success: boolean; id: string } {
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new TenantSecurityError(`User '${userId}' not found.`, 'NOT_FOUND', 404);

    if (user.client_id !== context.clientId && !context.isPlatformAdmin) {
      throw new TenantSecurityError('Cross-tenant user deletion blocked.', 'TENANT_ISOLATION_VIOLATION', 403);
    }

    const perm = validateCampusPermission(context, user.campus_id || user.campusId, 'delete', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(perm.reason || 'User campus permission denied.', 'CAMPUS_PERMISSION_DENIED', 403);
    }

    this.users = this.users.filter((u) => u.id !== user.id);
    return { success: true, id: user.id };
  }

  // --------------------------------------------------------------------------
  // FINANCIAL RECORDS CRUD (Petty Cash, Reconciliations, Ledger Balances)
  // --------------------------------------------------------------------------

  public queryFinancialRecords(context: TenantContext, recordType?: string, filters: Record<string, any> = {}): any[] {
    const { isolatedFilters, authorizedCampusIds } = enforceTenantQueryFilter(
      context,
      'financial_records',
      filters,
      this.campuses
    );

    return this.financialRecords.filter((r) => {
      if ((!context.isPlatformAdmin || filters.client_id) && r.client_id !== isolatedFilters.client_id) {
        return false;
      }
      if (typeof isolatedFilters.campus_id === 'string' && (r.campus_id || r.campusId) !== isolatedFilters.campus_id) return false;
      if (recordType && r.recordType !== recordType) return false;
      const campId = r.campus_id || r.campusId;
      if (!authorizedCampusIds.includes(campId)) return false;
      return true;
    });
  }

  public createFinancialRecord(context: TenantContext, payload: any): any {
    const targetCampusId = payload.campus_id || payload.campusId;
    if (!targetCampusId) throw new TenantSecurityError('campus_id is required.', 'MISSING_CAMPUS_ID', 400);

    const perm = validateCampusPermission(context, targetCampusId, 'create', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(perm.reason || 'Campus permission denied for financial record.', 'CAMPUS_PERMISSION_DENIED', 403);
    }

    const record = {
      ...payload,
      id: payload.id || `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      client_id: context.clientId,
      campus_id: targetCampusId,
      campusId: targetCampusId,
      createdAt: new Date().toISOString(),
      createdBy: context.userName,
    };
    this.financialRecords.push(record);
    return record;
  }

  public updateFinancialRecord(context: TenantContext, recordId: string, updates: any): any {
    const rec = this.financialRecords.find((r) => r.id === recordId);
    if (!rec) throw new TenantSecurityError(`Financial record '${recordId}' not found.`, 'NOT_FOUND', 404);

    if (rec.client_id !== context.clientId && !context.isPlatformAdmin) {
      throw new TenantSecurityError('Cross-tenant financial modification blocked.', 'TENANT_ISOLATION_VIOLATION', 403);
    }

    const perm = validateCampusPermission(context, rec.campus_id || rec.campusId, 'update', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(perm.reason || 'Campus permission denied.', 'CAMPUS_PERMISSION_DENIED', 403);
    }

    assertImmutableRecord(rec, updates);
    const updated = {
      ...rec,
      ...updates,
      client_id: rec.client_id,
      updatedAt: new Date().toISOString(),
    };
    const idx = this.financialRecords.findIndex((r) => r.id === rec.id);
    this.financialRecords[idx] = updated;
    return updated;
  }

  public deleteFinancialRecord(context: TenantContext, recordId: string): { success: boolean; id: string } {
    const rec = this.financialRecords.find((r) => r.id === recordId);
    if (!rec) throw new TenantSecurityError(`Financial record '${recordId}' not found.`, 'NOT_FOUND', 404);

    if (rec.client_id !== context.clientId && !context.isPlatformAdmin) {
      throw new TenantSecurityError('Cross-tenant financial deletion blocked.', 'TENANT_ISOLATION_VIOLATION', 403);
    }

    const perm = validateCampusPermission(context, rec.campus_id || rec.campusId, 'delete', this.campuses);
    if (!perm.allowed) {
      throw new TenantSecurityError(perm.reason || 'Campus permission denied.', 'CAMPUS_PERMISSION_DENIED', 403);
    }

    this.financialRecords = this.financialRecords.filter((r) => r.id !== rec.id);
    return { success: true, id: rec.id };
  }
}

function assertImmutableRecord(existing: any, updates: any) {
  for (const field of ['id', 'client_id', 'clientId', 'campus_id', 'campusId', 'createdAt', 'createdById']) {
    if (Object.prototype.hasOwnProperty.call(updates, field) && updates[field] !== existing[field]) {
      throw new TenantSecurityError(`Immutable field: ${field}.`, 'IMMUTABLE_RECORD_FIELD', 400);
    }
  }
}
function validateUserAuthority(context: TenantContext, payload: any) {
  if (!context.isPlatformAdmin && !context.isClientAdmin) {
    throw new TenantSecurityError('Account administration requires client or platform admin.', 'PRIVILEGE_ESCALATION', 403);
  }
  if (!context.isPlatformAdmin && (
    payload.permissionLevel === 'level_1_platform_super_admin' ||
    ['admin', 'superadmin', 'super_admin', 'level_1_platform_super_admin'].includes(payload.role) ||
    payload.isSuperAdmin === true || payload.isPlatformAdmin === true ||
    (payload.clientId && payload.clientId !== context.clientId)
  )) throw new TenantSecurityError('Privilege escalation blocked.', 'PRIVILEGE_ESCALATION', 403);
  if (Object.prototype.hasOwnProperty.call(payload, 'password')) {
    throw new TenantSecurityError('Provision passwords using Firebase Authentication, not user profiles.', 'PLAINTEXT_PASSWORD_FORBIDDEN', 400);
  }
}
export function validateVoucherAmounts(payload: any) {
  const debit = Number(payload.totalDebit);
  const credit = Number(payload.totalCredit);
  if (![debit, credit].every(Number.isFinite) || debit < 0 || credit < 0 || Math.abs(Math.round(debit * 100) - Math.round(credit * 100)) > 0) {
    throw new TenantSecurityError('Voucher totals must be finite, nonnegative and balanced to the cent.', 'UNBALANCED_VOUCHER', 400);
  }
  if (payload.entries !== undefined) {
    if (!Array.isArray(payload.entries) || payload.entries.length < 2) throw new TenantSecurityError('At least two entries are required.', 'INVALID_ENTRIES', 400);
    let dr = 0, cr = 0;
    for (const entry of payload.entries) {
      const d = Number(entry.debit ?? 0), c = Number(entry.credit ?? 0);
      if (![d, c].every(Number.isFinite) || d < 0 || c < 0 || (d > 0 && c > 0)) throw new TenantSecurityError('Invalid debit/credit entry.', 'INVALID_ENTRIES', 400);
      dr += Math.round(d * 100); cr += Math.round(c * 100);
    }
    if (dr !== cr || dr !== Math.round(debit * 100) || cr !== Math.round(credit * 100)) throw new TenantSecurityError('Entries disagree with voucher totals.', 'UNBALANCED_VOUCHER', 400);
  }
}

// Global Singleton Repository
export const tenantRepository = new TenantIsolatedRepository();

// ----------------------------------------------------------------------------
// FINANCIAL REPORTS PERMISSION ENGINE
// ----------------------------------------------------------------------------

export function validateClientReportAccess(
  context: TenantContext,
  reportKey: string,
  targetCampusId?: string | null,
  isConsolidated: boolean = false,
  allPermissions: Record<string, ClientReportPermission[]> = getStoredClientReportPermissions(),
  campuses: CampusNode[] = DEFAULT_TENANT_CAMPUSES
): { allowed: boolean; reason?: string; permission?: ClientReportPermission } {
  // 1. Level 1 Platform Super Admin can audit any report
  if (context.isPlatformAdmin || context.permissionLevel === 'level_1_platform_super_admin') {
    return { allowed: true };
  }

  // 2. Validate client organization has permission for this report
  const clientPerms = allPermissions[context.clientId] || generateDefaultClientReportPermissions(context.clientId);
  const reportPerm = clientPerms.find((p) => p.reportKey === reportKey);

  if (!reportPerm) {
    return {
      allowed: false,
      reason: `Report '${reportKey}' is not configured in client organization '${context.clientId}'.`,
    };
  }

  if (!reportPerm.enabled) {
    return {
      allowed: false,
      reason: `Access Denied: The financial report '${reportPerm.reportTitle}' is disabled for client organization '${context.clientId}' by Platform Site Admin policy.`,
      permission: reportPerm,
    };
  }

  // 3. Minimum Role Validation
  const roleRank: Record<PermissionLevel, number> = {
    level_1_platform_super_admin: 5,
    level_2_client_super_admin: 4,
    level_3_main_campus_admin: 3,
    level_4_sub_campus_admin: 2,
    level_5_departmental_staff: 1,
  };

  const userRank = roleRank[context.permissionLevel] || 1;
  const reqRank = roleRank[reportPerm.minimumRole] || 3;

  if (userRank < reqRank) {
    return {
      allowed: false,
      reason: `Insufficient privileges: Report '${reportPerm.reportTitle}' requires minimum role level '${reportPerm.minimumRole}'. Authenticated role: '${context.permissionLevel}'.`,
      permission: reportPerm,
    };
  }

  // 4. Consolidated Cross-Campus Check
  if (isConsolidated && !reportPerm.allowCrossCampusConsolidated) {
    return {
      allowed: false,
      reason: `Cross-campus consolidated reporting is restricted for report '${reportPerm.reportTitle}' under current client policy. Please select an individual campus.`,
      permission: reportPerm,
    };
  }

  // 5. Campus Authorization
  if (targetCampusId && targetCampusId !== 'all') {
    const campusCheck = validateCampusPermission(context, targetCampusId, 'read', campuses);
    if (!campusCheck.allowed) {
      return {
        allowed: false,
        reason: campusCheck.reason,
        permission: reportPerm,
      };
    }
  }

  return { allowed: true, permission: reportPerm };
}
