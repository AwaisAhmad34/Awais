export interface ReportCategoryDefinition {
  id: string;
  code: string;
  name: string;
  category: 'Financial Core' | 'Cash & Banking' | 'Vouchers & Ledger' | 'Administrative' | 'Governance & Audits';
  description: string;
  defaultAllowed: boolean;
}

export interface GranularReportPermissions {
  canView: boolean;
  canGenerate: boolean;
  canEditSource: boolean;
  canExport: boolean;
  canPrint: boolean;
  canViewAmounts: boolean;
  canViewIndividualTransactions: boolean;
  canViewConsolidatedTotals: boolean;
}

export interface ClientReportAccessMatrix {
  clientId: string;
  clientName: string;
  enabledReportIds: string[];
  reportPermissions: Record<string, Partial<GranularReportPermissions>>;
  updatedAt: string;
  updatedBy: string;
}

export interface CampusReportAccessMatrix {
  campusId: string;
  campusName: string;
  clientId: string;
  enabledReportIds: string[];
  reportPermissions: Record<string, Partial<GranularReportPermissions>>;
  updatedAt: string;
  updatedBy: string;
}

export const REPORT_CATEGORIES_REGISTRY: ReportCategoryDefinition[] = [
  {
    id: 'rep_daily_cashbook',
    code: 'DCB',
    name: 'Daily Cashbook & Safe Reconcile',
    category: 'Cash & Banking',
    description: 'Day-to-day opening and closing physical cashbook statements.',
    defaultAllowed: true,
  },
  {
    id: 'rep_petty_cash',
    code: 'PCR',
    name: 'Petty Cash Float Register',
    category: 'Cash & Banking',
    description: 'Imprest system disbursements, receipts, and cashier balance sheets.',
    defaultAllowed: true,
  },
  {
    id: 'rep_voucher_register',
    code: 'VRG',
    name: 'Official Voucher Register (5 Voucher Types)',
    category: 'Vouchers & Ledger',
    description: 'Complete chronological audit log of BPV, BRV, CPV, CRV, and JV vouchers.',
    defaultAllowed: true,
  },
  {
    id: 'rep_income_expense',
    code: 'IES',
    name: 'Income & Expenditure Statement',
    category: 'Financial Core',
    description: 'Periodic operating surpluses and deficits against approved budgets.',
    defaultAllowed: true,
  },
  {
    id: 'rep_trial_balance',
    code: 'TRB',
    name: 'Trial Balance (Debit & Credit Balancing)',
    category: 'Financial Core',
    description: 'Full ledger balances verifying mathematical debit and credit equilibrium.',
    defaultAllowed: true,
  },
  {
    id: 'rep_general_ledger',
    code: 'GNL',
    name: 'General Ledger Book',
    category: 'Vouchers & Ledger',
    description: 'Complete chronological postings organized by Chart of Accounts ledger code.',
    defaultAllowed: true,
  },
  {
    id: 'rep_account_head_ledger',
    code: 'AHL',
    name: 'Account-Head Sub-Ledger',
    category: 'Vouchers & Ledger',
    description: 'Individual account movement statements for fees, utilities, salaries, and banks.',
    defaultAllowed: true,
  },
  {
    id: 'rep_fee_collection',
    code: 'FCR',
    name: 'Tuition & Fee Collection Summary',
    category: 'Administrative',
    description: 'Student fee generation, collection reconciliation, and receipt audit.',
    defaultAllowed: true,
  },
  {
    id: 'rep_fee_defaulters',
    code: 'FDF',
    name: 'Fee Defaulters & Outstanding Aging',
    category: 'Administrative',
    description: 'Overdue receivables aging breakdown by student and branch class.',
    defaultAllowed: true,
  },
  {
    id: 'rep_campus_financial_summary',
    code: 'CFS',
    name: 'Campus-Wise Financial Comparison',
    category: 'Financial Core',
    description: 'Multi-campus operational comparison for revenue, expenses, and petty float.',
    defaultAllowed: true,
  },
  {
    id: 'rep_monthly_statement',
    code: 'MFS',
    name: 'Monthly Financial Statement',
    category: 'Financial Core',
    description: 'Consolidated end-of-month statements for executive review.',
    defaultAllowed: true,
  },
  {
    id: 'rep_payroll_salary',
    code: 'PSR',
    name: 'Payroll & Faculty Salary Register',
    category: 'Administrative',
    description: 'Staff payroll disbursements, allowances, and tax withholding.',
    defaultAllowed: false,
  },
  {
    id: 'rep_budget_variance',
    code: 'BVA',
    name: 'Budget Versus Actual Variance',
    category: 'Financial Core',
    description: 'Comparative analytics tracking fiscal allocations versus expenditures.',
    defaultAllowed: true,
  },
  {
    id: 'rep_outstanding_payments',
    code: 'OSP',
    name: 'Outstanding Vendor & Operational Payables',
    category: 'Financial Core',
    description: 'Vendor bills pending settlement across bank and cash channels.',
    defaultAllowed: true,
  },
  {
    id: 'rep_deleted_audit',
    code: 'DRA',
    name: 'Deleted-Record Audit & Recovery Log',
    category: 'Governance & Audits',
    description: 'Security log of soft-deleted vouchers, petty cash items, and restorations.',
    defaultAllowed: false, // Platform/Main owner only
  },
  {
    id: 'rep_custom_reports',
    code: 'CST',
    name: 'Custom Parameterized Financial Reports',
    category: 'Governance & Audits',
    description: 'Custom multi-filter report builder with Excel and PDF outputs.',
    defaultAllowed: false,
  },
];

const CLIENT_MATRIX_STORAGE_KEY = 'aplus_client_report_matrix_v1';
const CAMPUS_MATRIX_STORAGE_KEY = 'aplus_campus_report_matrix_v1';

export const DEFAULT_GRANULAR_PERMISSIONS: GranularReportPermissions = {
  canView: true,
  canGenerate: true,
  canEditSource: false,
  canExport: true,
  canPrint: true,
  canViewAmounts: true,
  canViewIndividualTransactions: true,
  canViewConsolidatedTotals: true,
};

export function getStoredClientReportMatrices(): Record<string, ClientReportAccessMatrix> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(CLIENT_MATRIX_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveStoredClientReportMatrices(matrices: Record<string, ClientReportAccessMatrix>): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_MATRIX_STORAGE_KEY, JSON.stringify(matrices));
    }
  } catch {}
}

export function getStoredCampusReportMatrices(): Record<string, CampusReportAccessMatrix> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(CAMPUS_MATRIX_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveStoredCampusReportMatrices(matrices: Record<string, CampusReportAccessMatrix>): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CAMPUS_MATRIX_STORAGE_KEY, JSON.stringify(matrices));
    }
  } catch {}
}

/**
 * Get reports enabled by Platform Super Admin for a specific Client
 */
export function getReportsForClient(clientId: string): ReportCategoryDefinition[] {
  const matrices = getStoredClientReportMatrices();
  const matrix = matrices[clientId];
  if (!matrix) {
    // If not customized yet, all defaultAllowed are enabled
    return REPORT_CATEGORIES_REGISTRY.filter((r) => r.defaultAllowed);
  }
  const set = new Set(matrix.enabledReportIds);
  return REPORT_CATEGORIES_REGISTRY.filter((r) => set.has(r.id));
}

/**
 * Save client report access by Platform Super Admin
 */
export function setClientReportPermissions(
  clientId: string,
  clientName: string,
  enabledReportIds: string[],
  granularPermissions?: Record<string, Partial<GranularReportPermissions>>,
  actorName: string = 'Platform Super Admin'
): void {
  const matrices = getStoredClientReportMatrices();
  matrices[clientId] = {
    clientId,
    clientName,
    enabledReportIds,
    reportPermissions: granularPermissions || matrices[clientId]?.reportPermissions || {},
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
  saveStoredClientReportMatrices(matrices);
}

/**
 * Get reports permitted for a Sub-Campus (strictly constrained by client permissions!)
 */
export function getReportsForCampus(campusId: string, clientId: string): ReportCategoryDefinition[] {
  // First, find what the client is permitted to have
  const clientAllowed = getReportsForClient(clientId);
  const clientAllowedSet = new Set(clientAllowed.map((r) => r.id));

  const campusMatrices = getStoredCampusReportMatrices();
  const campusMatrix = campusMatrices[campusId];

  if (!campusMatrix) {
    // By default, inherits what the client allows (excluding governance/deleted audit)
    return clientAllowed.filter((r) => r.category !== 'Governance & Audits');
  }

  // Must be in BOTH campus enabled list AND client allowed list
  const campusSet = new Set(campusMatrix.enabledReportIds);
  return REPORT_CATEGORIES_REGISTRY.filter((r) => campusSet.has(r.id) && clientAllowedSet.has(r.id));
}

/**
 * Save sub-campus report access by Main Campus Administrator
 * (Automatically strips out any reports not permitted by Platform Admin)
 */
export function setCampusReportPermissions(
  campusId: string,
  campusName: string,
  clientId: string,
  requestedReportIds: string[],
  granularPermissions?: Record<string, Partial<GranularReportPermissions>>,
  actorName: string = 'Main Campus Administrator'
): { success: boolean; allowedCount: number; message: string } {
  const clientAllowed = getReportsForClient(clientId);
  const clientAllowedSet = new Set(clientAllowed.map((r) => r.id));

  // Filter requested IDs to ONLY those allowed by Platform Admin
  const validReportIds = requestedReportIds.filter((id) => clientAllowedSet.has(id));

  const campusMatrices = getStoredCampusReportMatrices();
  campusMatrices[campusId] = {
    campusId,
    campusName,
    clientId,
    enabledReportIds: validReportIds,
    reportPermissions: granularPermissions || campusMatrices[campusId]?.reportPermissions || {},
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
  saveStoredCampusReportMatrices(campusMatrices);

  return {
    success: true,
    allowedCount: validReportIds.length,
    message: `Configured ${validReportIds.length} report categories for ${campusName}.`,
  };
}

/**
 * Check if a user has permission to view, export, or print a specific report
 */
export function checkReportPermission(params: {
  reportId: string;
  userRole: string;
  userClientId?: string | null;
  userCampusId?: string | null;
  permissionType: keyof GranularReportPermissions;
}): boolean {
  const { reportId, userRole, userClientId, userCampusId, permissionType } = params;

  // Level 1: Platform Super Admin has full rights across everything
  if (
    userRole === 'level_1_platform_super_admin' ||
    userRole === 'admin' ||
    userRole === 'superadmin'
  ) {
    return true;
  }

  if (!userClientId) return false;

  // Check client-level permission first
  const clientAllowed = getReportsForClient(userClientId);
  if (!clientAllowed.some((r) => r.id === reportId)) {
    return false;
  }

  // If user is Level 2 Main Campus Administrator, they have access to all client-allowed reports
  if (userRole === 'level_2_client_super_admin') {
    return true;
  }

  // Level 3/4: Check campus-level permission
  if (!userCampusId) return false;
  const campusAllowed = getReportsForCampus(userCampusId, userClientId);
  if (!campusAllowed.some((r) => r.id === reportId)) {
    return false;
  }

  // Check granular permission if configured
  const campusMatrices = getStoredCampusReportMatrices();
  const campusMatrix = campusMatrices[userCampusId];
  if (campusMatrix?.reportPermissions?.[reportId]) {
    const val = campusMatrix.reportPermissions[reportId][permissionType];
    if (val !== undefined) return !!val;
  }

  return DEFAULT_GRANULAR_PERMISSIONS[permissionType] ?? true;
}
