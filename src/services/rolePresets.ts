import type { PermissionLevel } from './campusPermissionEngine';

export interface SelectiveRolePreset {
  id: string;
  roleValue: string;
  label: string;
  shortLabel: string;
  permissionLevel: PermissionLevel;
  description: string;
  readOnly: boolean;
  defaultModules: string[];
}

export const SELECTIVE_ROLE_PRESETS: SelectiveRolePreset[] = [
  {
    id: 'platform_super_admin',
    roleValue: 'level_1_platform_super_admin',
    label: 'Platform Super Admin (Full Central Control)',
    shortLabel: 'Platform Super Admin',
    permissionLevel: 'level_1_platform_super_admin',
    description: 'Unrestricted central platform administration across all clients, campuses, users, and modules.',
    readOnly: false,
    defaultModules: ['all'],
  },
  {
    id: 'client_owner',
    roleValue: 'level_2_client_super_admin',
    label: 'School Client / Organization Owner',
    shortLabel: 'Client Owner',
    permissionLevel: 'level_2_client_super_admin',
    description: 'Manages all campuses, sub-branches, users, and reports inside their own organization.',
    readOnly: false,
    defaultModules: ['all'],
  },
  {
    id: 'main_campus_admin',
    roleValue: 'level_3_main_campus_admin',
    label: 'Main Campus Admin / Principal',
    shortLabel: 'Main Campus Admin',
    permissionLevel: 'level_3_main_campus_admin',
    description: 'Oversees assigned main campus and delegated sub-campuses including approvals and ledgers.',
    readOnly: false,
    defaultModules: [
      'dashboard',
      'erp_overview',
      'erp_fees',
      'erp_payroll',
      'erp_procurement',
      'erp_inventory',
      'erp_budgeting',
      'pettycash',
      'transaction',
      'alltransactions',
      'reports',
      'accounts',
      'reconciliation',
      'cashreconciliation',
      'openingbalance',
      'periods',
      'depreciation',
      'activity',
      'docs',
    ],
  },
  {
    id: 'sub_campus_admin',
    roleValue: 'Principal',
    label: 'Sub-Campus Admin / Branch Principal',
    shortLabel: 'Sub-Campus Admin',
    permissionLevel: 'level_4_sub_campus_admin',
    description: 'Manages operations, petty cash, fees, vouchers, and reports for their assigned branch only.',
    readOnly: false,
    defaultModules: [
      'dashboard',
      'erp_overview',
      'erp_fees',
      'erp_inventory',
      'erp_budgeting',
      'pettycash',
      'transaction',
      'alltransactions',
      'reports',
      'accounts',
      'cashreconciliation',
      'activity',
      'docs',
    ],
  },
  {
    id: 'accountant',
    roleValue: 'Accountant',
    label: 'Campus Accountant',
    shortLabel: 'Accountant',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Records vouchers, manages petty cash, reconciles bank/cash ledgers, and views financial reports.',
    readOnly: false,
    defaultModules: [
      'dashboard',
      'erp_overview',
      'erp_fees',
      'erp_payroll',
      'erp_procurement',
      'pettycash',
      'transaction',
      'alltransactions',
      'reports',
      'accounts',
      'reconciliation',
      'cashreconciliation',
      'depreciation',
      'docs',
    ],
  },
  {
    id: 'cashier',
    roleValue: 'Cashier',
    label: 'Petty Cashier / Cash Counter',
    shortLabel: 'Cashier',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Restricted to petty cash disbursements, cash voucher entry, and physical cash reconciliation.',
    readOnly: false,
    defaultModules: ['dashboard', 'pettycash', 'transaction', 'cashreconciliation', 'docs'],
  },
  {
    id: 'fee_manager',
    roleValue: 'Fee Manager',
    label: 'Student Fee & Challan Officer',
    shortLabel: 'Fee Manager',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Focused on Student Fee & Challan ERP, fee receipts (CRV/BRV), and fee collection reports.',
    readOnly: false,
    defaultModules: ['dashboard', 'erp_fees', 'transaction', 'reports', 'docs'],
  },
  {
    id: 'hr_manager',
    roleValue: 'HR Manager',
    label: 'HR & Staff Payroll Officer',
    shortLabel: 'HR Manager',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Focused on HR & Staff Payroll ERP, salary sheets, and salary disbursement reports.',
    readOnly: false,
    defaultModules: ['dashboard', 'erp_payroll', 'transaction', 'reports', 'docs'],
  },
  {
    id: 'auditor',
    roleValue: 'Auditor',
    label: 'Internal Auditor (Read-Only)',
    shortLabel: 'Auditor (Read-Only)',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Read-only review across vouchers, financial reports, COA, reconciliations, and forensic audit logs.',
    readOnly: true,
    defaultModules: [
      'dashboard',
      'alltransactions',
      'reports',
      'accounts',
      'reconciliation',
      'cashreconciliation',
      'activity',
      'docs',
    ],
  },
  {
    id: 'viewer',
    roleValue: 'Viewer',
    label: 'Read-Only Viewer',
    shortLabel: 'Viewer (Read-Only)',
    permissionLevel: 'level_5_departmental_staff',
    description: 'Strictly read-only access to dashboard summaries, financial reports, and system manual.',
    readOnly: true,
    defaultModules: ['dashboard', 'reports', 'docs'],
  },
];

export const SYSTEM_SELECTIVE_MODULE_LIST: Array<{
  id: string;
  label: string;
  category: 'Daily Operations' | 'Dynamic School ERP' | 'Ledgers & Statements' | 'Administration & System';
}> = [
  { id: 'dashboard', label: 'Executive Dashboard & Daily Cash Summary', category: 'Daily Operations' },
  { id: 'pettycash', label: 'Petty Cash Management', category: 'Daily Operations' },
  { id: 'transaction', label: 'Voucher Entry (BPV / BRV / CPV / CRV / JV)', category: 'Daily Operations' },
  { id: 'alltransactions', label: 'Voucher Register & Bulk Approval', category: 'Daily Operations' },
  { id: 'erp_overview', label: '360° ERP Command Center', category: 'Dynamic School ERP' },
  { id: 'erp_fees', label: 'Student Fee & Challan ERP', category: 'Dynamic School ERP' },
  { id: 'erp_payroll', label: 'HR & Staff Payroll ERP', category: 'Dynamic School ERP' },
  { id: 'erp_procurement', label: 'Procurement & Purchase Orders', category: 'Dynamic School ERP' },
  { id: 'erp_inventory', label: 'Inventory & Campus Store', category: 'Dynamic School ERP' },
  { id: 'erp_budgeting', label: 'Campus Budgeting & Variance', category: 'Dynamic School ERP' },
  { id: 'reports', label: 'Financial Reports & Trial Balance', category: 'Ledgers & Statements' },
  { id: 'accounts', label: 'Chart of Accounts (COA)', category: 'Ledgers & Statements' },
  { id: 'reconciliation', label: 'Bank Reconciliation', category: 'Ledgers & Statements' },
  { id: 'cashreconciliation', label: 'Physical Cash Reconciliation', category: 'Ledgers & Statements' },
  { id: 'openingbalance', label: 'Opening Balances Setup', category: 'Ledgers & Statements' },
  { id: 'periods', label: 'Accounting Periods & Fiscal Close', category: 'Ledgers & Statements' },
  { id: 'depreciation', label: 'Asset Depreciation Register', category: 'Ledgers & Statements' },
  { id: 'activity', label: 'Forensic Audit Trail & Activity Log', category: 'Administration & System' },
  { id: 'docs', label: 'System Manual & Procedures', category: 'Administration & System' },
];

export function isLevel1SuperAdminUser(user: any): boolean {
  if (!user) return false;
  return Boolean(
    user.isSuperAdmin === true ||
      user.role === 'super_admin' ||
      user.role === 'level_1_platform_super_admin' ||
      user.permissionLevel === 'level_1_platform_super_admin'
  );
}

export function isUserReadOnlyRole(user: any): boolean {
  if (!user) return true;
  if (isLevel1SuperAdminUser(user)) return false;
  if (user.readOnly === true) return true;
  const r = String(user.role || user.departmentalRole || '').trim().toLowerCase();
  return r === 'auditor' || r === 'viewer' || r === 'viewer_auditor' || r === 'read_only';
}

export function getPresetForRole(permissionLevel?: string, role?: string): SelectiveRolePreset | undefined {
  const normRole = String(role || '').trim().toLowerCase();
  const normLevel = String(permissionLevel || '').trim().toLowerCase();

  if (normLevel === 'level_1_platform_super_admin' || normRole === 'super_admin' || normRole === 'level_1_platform_super_admin') {
    return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'platform_super_admin');
  }
  if (normLevel === 'level_2_client_super_admin' || normLevel === 'level_2_client_admin' || normRole === 'level_2_client_super_admin') {
    return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'client_owner');
  }

  if (normRole.includes('cashier')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'cashier');
  if (normRole.includes('auditor')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'auditor');
  if (normRole.includes('viewer')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'viewer');
  if (normRole.includes('fee')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'fee_manager');
  if (normRole.includes('hr') || normRole.includes('payroll')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'hr_manager');
  if (normRole.includes('accountant')) return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'accountant');

  if (normLevel === 'level_3_main_campus_admin' || normRole === 'level_3_main_campus_admin') {
    return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'main_campus_admin');
  }
  if (
    normLevel === 'level_4_sub_campus_admin' ||
    normLevel === 'level_3_sub_campus_admin' ||
    normRole === 'principal' ||
    normRole === 'admin' ||
    normRole === 'campus_admin'
  ) {
    return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'sub_campus_admin');
  }

  return SELECTIVE_ROLE_PRESETS.find((p) => p.id === 'accountant');
}

export function getDefaultModulesForRole(permissionLevel?: string, role?: string): string[] {
  const preset = getPresetForRole(permissionLevel, role);
  return preset ? [...preset.defaultModules] : ['dashboard', 'pettycash', 'transaction', 'reports', 'docs'];
}

export function isUserPermittedForModule(
  moduleId: string,
  user: any,
  fallbackProfileModules?: string[] | null
): boolean {
  if (!user) return false;
  if (isLevel1SuperAdminUser(user)) return true;

  if (moduleId === 'campuses') {
    return (
      user.permissionLevel === 'level_2_client_super_admin' ||
      user.role === 'level_2_client_super_admin' ||
      (Array.isArray(user.allowedModules) && user.allowedModules.includes('campuses'))
    );
  }

  // If the user was explicitly granted a selective module list (i.e. not ['all']), enforce it strictly
  if (Array.isArray(user.allowedModules) && user.allowedModules.length > 0 && !user.allowedModules.includes('all')) {
    return user.allowedModules.includes(moduleId);
  }

  // Read-only users without explicit module list default to their read-only preset modules
  if (isUserReadOnlyRole(user)) {
    return getDefaultModulesForRole(user.permissionLevel, user.role).includes(moduleId);
  }

  if (Array.isArray(fallbackProfileModules)) {
    return fallbackProfileModules.includes(moduleId);
  }

  return getDefaultModulesForRole(user.permissionLevel, user.role).includes(moduleId);
}
