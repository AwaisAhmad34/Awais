export const SITE_OWNER_GOVERNANCE_STORAGE_KEY =
  'aplus_site_owner_governance_v1';

export interface PettyCashCampusUsageMetric {
  campusId: string;
  campusCode: string;
  campusName: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  historicalMonthlyAvgPKR: number;
  currentMonthSpendPKR: number;
  lastMonthSpendPKR: number;
  threeMonthHistoryPKR: [number, number, number];
  customThresholdPct?: number;
  acknowledgedByAdmin?: boolean;
  pettyCashFrozenByAlert?: boolean;
}

export interface PettyCashAlertEvaluation extends PettyCashCampusUsageMetric {
  variancePKR: number;
  variancePct: number;
  effectiveThresholdPct: number;
  severity: 'CRITICAL' | 'WARNING' | 'NORMAL';
  alertMessage: string;
}

export type ThemeModeOption = 'light' | 'dark';

export type ColorSchemeVariationId =
  | 'royal_indigo'
  | 'emerald_islamic'
  | 'crimson_oxford'
  | 'sapphire_modern'
  | 'imperial_purple'
  | 'obsidian_bronze';

export interface ColorSchemeVariationDef {
  id: ColorSchemeVariationId;
  name: string;
  tagline: string;
  primaryHex: string;
  primaryHoverHex: string;
  accentHex: string;
  headerBgHex: string;
  softBgHex: string;
  borderHex: string;
}

export const COLOR_SCHEME_VARIATIONS: ColorSchemeVariationDef[] = [
  {
    id: 'royal_indigo',
    name: '1. Royal Indigo & Sovereign Gold',
    tagline: 'Executive Navy/Indigo with Warm Amber Accents',
    primaryHex: '#4f46e5',
    primaryHoverHex: '#4338ca',
    accentHex: '#f59e0b',
    headerBgHex: '#0f172a',
    softBgHex: '#eef2ff',
    borderHex: '#6366f1',
  },
  {
    id: 'emerald_islamic',
    name: '2. Emerald Sovereign & Jade',
    tagline: 'Academy Emerald Green with Gold Highlights',
    primaryHex: '#059669',
    primaryHoverHex: '#047857',
    accentHex: '#d97706',
    headerBgHex: '#064e3b',
    softBgHex: '#ecfdf5',
    borderHex: '#10b981',
  },
  {
    id: 'crimson_oxford',
    name: '3. Oxford Crimson & Slate',
    tagline: 'Heritage University Crimson with Deep Slate',
    primaryHex: '#dc2626',
    primaryHoverHex: '#b91c1c',
    accentHex: '#f59e0b',
    headerBgHex: '#450a0a',
    softBgHex: '#fef2f2',
    borderHex: '#ef4444',
  },
  {
    id: 'sapphire_modern',
    name: '4. Cyber Sapphire & Teal',
    tagline: 'Modern Enterprise Sky/Sapphire Blue with Cyan',
    primaryHex: '#0284c7',
    primaryHoverHex: '#0369a1',
    accentHex: '#14b8a6',
    headerBgHex: '#082f49',
    softBgHex: '#f0f9ff',
    borderHex: '#0ea5e9',
  },
  {
    id: 'imperial_purple',
    name: '5. Imperial Plum & Violet',
    tagline: 'Chancellery Violet with Rose Gold Accents',
    primaryHex: '#7c3aed',
    primaryHoverHex: '#6d28d9',
    accentHex: '#ec4899',
    headerBgHex: '#2e1065',
    softBgHex: '#f5f3ff',
    borderHex: '#8b5cf6',
  },
  {
    id: 'obsidian_bronze',
    name: '6. Obsidian Charcoal & Warm Bronze',
    tagline: 'High-Contrast Executive Graphite & Bronze',
    primaryHex: '#334155',
    primaryHoverHex: '#1e293b',
    accentHex: '#ea580c',
    headerBgHex: '#090d16',
    softBgHex: '#f8fafc',
    borderHex: '#64748b',
  },
];

export interface ClientDeepControlProfile {
  organizationId: string;
  themeMode: ThemeModeOption;
  colorSchemeId: ColorSchemeVariationId;
  customPrimaryHex?: string;
  customAccentHex?: string;
  lockClientThemeOverride: boolean;
  allowQrCodeVerification: boolean;
  allowVoucherQrCode: boolean;
  allowReportQrCode: boolean;
  allowChallanQrCode: boolean;
  allowedReports: string[]; // IDs from ALL_18_REPORT_DEFINITIONS
  allowedModules: string[]; // IDs from ALL_16_CLIENT_MODULES
  allowedDashboardCharts: string[]; // IDs from ALL_8_DASHBOARD_CHARTS
}

export interface SiteOwnerGovernanceState {
  siteOwnerMasterThemeMode: ThemeModeOption;
  siteOwnerMasterColorSchemeId: ColorSchemeVariationId;
  globalWarningThresholdPct: number; // default 20% above historical monthly avg
  globalCriticalThresholdPct: number; // default 35% above historical monthly avg
  autoNotifySiteAdminOnExceed: boolean;
  autoFreezePettyCashOnCritical: boolean;
  campusPettyCashMetrics: PettyCashCampusUsageMetric[];
  clientControls: Record<string, ClientDeepControlProfile>;
}

export const ALL_18_REPORT_DEFINITIONS: {
  id: string;
  title: string;
  category: 'Core Ledger' | 'Financial Statements' | 'Campus & ERP' | 'Audit';
}[] = [
  { id: 'trial_balance', title: '1. Trial Balance (2/4/6 Column)', category: 'Core Ledger' },
  { id: 'income_statement', title: '2. Income & Expenditure (P&L)', category: 'Financial Statements' },
  { id: 'balance_sheet', title: '3. Statement of Financial Position (Balance Sheet)', category: 'Financial Statements' },
  { id: 'cash_flow', title: '4. Cash Flow Statement (Direct/Indirect)', category: 'Financial Statements' },
  { id: 'general_ledger', title: '5. General Ledger Account Statement', category: 'Core Ledger' },
  { id: 'day_book', title: '6. Daily Cash & Bank Day Book', category: 'Core Ledger' },
  { id: 'petty_cash_register', title: '7. Imprest Petty Cash Register', category: 'Campus & ERP' },
  { id: 'bank_reconciliation', title: '8. Bank Reconciliation Statement', category: 'Core Ledger' },
  { id: 'campus_comparison', title: '9. Multi-Campus Comparative Matrix', category: 'Campus & ERP' },
  { id: 'monthly_expense_matrix', title: '10. 12-Month Expense Trend Matrix', category: 'Financial Statements' },
  { id: 'fee_collection_register', title: '11. Student Fee Collection & Arrears Report', category: 'Campus & ERP' },
  { id: 'payroll_sheet', title: '12. Staff Payroll & Tax Deduction Sheet', category: 'Campus & ERP' },
  { id: 'fixed_asset_schedule', title: '13. Fixed Assets & Depreciation Schedule', category: 'Financial Statements' },
  { id: 'receipts_and_payments', title: '14. Receipts & Payments Account', category: 'Financial Statements' },
  { id: 'budget_variance_report', title: '15. Budget vs Actual Variance Report', category: 'Audit' },
  { id: 'vendor_payable_aging', title: '16. Vendor & Accounts Payable Aging', category: 'Campus & ERP' },
  { id: 'immutable_audit_trail', title: '17. Cryptographic Audit Trail Log', category: 'Audit' },
  { id: 'executive_kpi_ratios', title: '18. Executive Financial Health & Ratios', category: 'Audit' },
];

export const ALL_16_CLIENT_MODULES: {
  id: string;
  title: string;
  group: 'Core Accounting' | 'Controls & Audit' | 'School ERP';
}[] = [
  { id: 'dashboard', title: 'Executive Dashboard', group: 'Core Accounting' },
  { id: 'transaction', title: 'Voucher Entry (BPV/BRV/CPV/CRV/JV)', group: 'Core Accounting' },
  { id: 'voucheraudit', title: 'Voucher Audit & Verification', group: 'Controls & Audit' },
  { id: 'pettycash', title: 'Imprest Petty Cash Management', group: 'Core Accounting' },
  { id: 'reports', title: 'Financial Reports Hub', group: 'Core Accounting' },
  { id: 'coa', title: 'Chart of Accounts (5-Level)', group: 'Core Accounting' },
  { id: 'bankrec', title: 'Bank Reconciliation', group: 'Controls & Audit' },
  { id: 'openingbalance', title: 'Opening Balances', group: 'Core Accounting' },
  { id: 'periods', title: 'Accounting Periods Lock', group: 'Controls & Audit' },
  { id: 'depreciation', title: 'Fixed Asset Depreciation', group: 'School ERP' },
  { id: 'campuses', title: 'Campus Branches View', group: 'School ERP' },
  { id: 'cashreconciliation', title: '7-Day Physical Cash Count', group: 'Controls & Audit' },
  { id: 'recurringvouchers', title: 'Recurring Auto-Vouchers', group: 'School ERP' },
  { id: 'modernerp', title: '360° Student Fee & Payroll ERP', group: 'School ERP' },
  { id: 'suggestions', title: 'Financial Health & Insights', group: 'Controls & Audit' },
  { id: 'activitylog', title: 'Immutable Activity Log', group: 'Controls & Audit' },
];

export const ALL_8_DASHBOARD_CHARTS: {
  id: string;
  title: string;
  description: string;
}[] = [
  {
    id: 'chart_rev_vs_exp',
    title: '1. Revenue vs Expense Monthly Bar/Area Chart',
    description: 'Displays monthly institutional fee inflows vs operating expenses.',
  },
  {
    id: 'chart_petty_cash_pie',
    title: '2. Petty Cash Category Analytics Chart',
    description: 'Donut & bar breakdown of campus petty cash spending by category.',
  },
  {
    id: 'chart_budget_variance',
    title: '3. Budget vs Actual Variance Progress Chart',
    description: 'Tracks departmental budget utilization and overrun alerts.',
  },
  {
    id: 'chart_campus_comparison',
    title: '4. Multi-Campus Financial Performance Chart',
    description: 'Side-by-side surplus/deficit comparison across campuses.',
  },
  {
    id: 'chart_cash_liquidity',
    title: '5. Cash & Bank Liquidity Position KPI Cards',
    description: 'Real-time cash-in-hand, bank balances, and imprest float cards.',
  },
  {
    id: 'chart_7day_cash_status',
    title: '6. 7-Day Mandatory Cash Verification Status Banner',
    description: 'Shows physical cash count compliance and countdown timer.',
  },
  {
    id: 'chart_voucher_pipeline',
    title: '7. Voucher Approval & Posting Pipeline Chart',
    description: 'Breakdown of Draft, Pending, Verified, and Posted vouchers.',
  },
  {
    id: 'chart_financial_health_score',
    title: '8. Institutional Financial Health & Ratio Gauge',
    description: 'Liquidity ratio, expense-to-revenue ratio, and surplus index.',
  },
];

const DEFAULT_PETTY_CASH_METRICS: PettyCashCampusUsageMetric[] = [
  {
    campusId: 'tcamp-aplus-main-1',
    campusCode: 'CVT-MAIN',
    campusName: 'A+ Central Model Main Campus (Lahore)',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'A+ School System',
    historicalMonthlyAvgPKR: 85000,
    currentMonthSpendPKR: 134500, // +58.2% spike -> CRITICAL ALERT!
    lastMonthSpendPKR: 88000,
    threeMonthHistoryPKR: [82000, 85000, 88000],
    acknowledgedByAdmin: false,
    pettyCashFrozenByAlert: false,
  },
  {
    campusId: 'tcamp-aplus-sub-1',
    campusCode: 'CVT-SUB-JR',
    campusName: 'A+ Junior & Montessori Wing (Sub-Campus)',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'A+ School System',
    historicalMonthlyAvgPKR: 45000,
    currentMonthSpendPKR: 57600, // +28.0% -> WARNING ALERT!
    lastMonthSpendPKR: 46500,
    threeMonthHistoryPKR: [43500, 45000, 46500],
    acknowledgedByAdmin: false,
    pettyCashFrozenByAlert: false,
  },
  {
    campusId: 'tcamp-apex-main-1',
    campusCode: 'APEX-ISB-MAIN',
    campusName: 'Apex Islamabad Main Campus',
    organizationId: 'inst-apex-college',
    organizationCode: 'ORG-APEX-002',
    organizationName: 'Apex Science & Commerce Institute',
    historicalMonthlyAvgPKR: 110000,
    currentMonthSpendPKR: 162800, // +48.0% -> CRITICAL ALERT!
    lastMonthSpendPKR: 112000,
    threeMonthHistoryPKR: [108000, 110000, 112000],
    acknowledgedByAdmin: false,
    pettyCashFrozenByAlert: false,
  },
  {
    campusId: 'tcamp-alhuda-main-1',
    campusCode: 'ALHUDA-FSD-01',
    campusName: 'Al-Huda Peoples Colony Main Campus',
    organizationId: 'inst-alhuda-academy',
    organizationCode: 'ORG-ALHUDA-003',
    organizationName: 'Al-Huda Islamic & Science Academy',
    historicalMonthlyAvgPKR: 60000,
    currentMonthSpendPKR: 54000, // -10.0% -> NORMAL
    lastMonthSpendPKR: 59000,
    threeMonthHistoryPKR: [61000, 60000, 59000],
    acknowledgedByAdmin: false,
    pettyCashFrozenByAlert: false,
  },
];

export function createDefaultClientControlProfile(
  organizationId: string,
  preset: 'FULL' | 'STANDARD' | 'RESTRICTED' = 'FULL'
): ClientDeepControlProfile {
  const allReports = ALL_18_REPORT_DEFINITIONS.map((r) => r.id);
  const allModules = ALL_16_CLIENT_MODULES.map((m) => m.id);
  const allCharts = ALL_8_DASHBOARD_CHARTS.map((c) => c.id);

  if (preset === 'RESTRICTED') {
    return {
      organizationId,
      themeMode: 'dark',
      colorSchemeId: 'crimson_oxford',
      lockClientThemeOverride: true,
      allowQrCodeVerification: false,
      allowVoucherQrCode: false,
      allowReportQrCode: false,
      allowChallanQrCode: false,
      allowedReports: allReports.slice(0, 5),
      allowedModules: ['dashboard', 'reports', 'coa'],
      allowedDashboardCharts: allCharts.slice(0, 2),
    };
  }

  if (preset === 'STANDARD') {
    return {
      organizationId,
      themeMode: 'light',
      colorSchemeId: 'emerald_islamic',
      lockClientThemeOverride: false,
      allowQrCodeVerification: true,
      allowVoucherQrCode: true,
      allowReportQrCode: true,
      allowChallanQrCode: true,
      allowedReports: allReports.slice(0, 12),
      allowedModules: allModules.slice(0, 12),
      allowedDashboardCharts: allCharts.slice(0, 6),
    };
  }

  return {
    organizationId,
    themeMode: 'light',
    colorSchemeId: 'royal_indigo',
    lockClientThemeOverride: false,
    allowQrCodeVerification: true,
    allowVoucherQrCode: true,
    allowReportQrCode: true,
    allowChallanQrCode: true,
    allowedReports: allReports,
    allowedModules: allModules,
    allowedDashboardCharts: allCharts,
  };
}

const DEFAULT_GOVERNANCE_STATE: SiteOwnerGovernanceState = {
  siteOwnerMasterThemeMode: 'light',
  siteOwnerMasterColorSchemeId: 'royal_indigo',
  globalWarningThresholdPct: 20,
  globalCriticalThresholdPct: 35,
  autoNotifySiteAdminOnExceed: true,
  autoFreezePettyCashOnCritical: false,
  campusPettyCashMetrics: DEFAULT_PETTY_CASH_METRICS,
  clientControls: {
    'inst-aplus-main': createDefaultClientControlProfile('inst-aplus-main', 'FULL'),
    'inst-apex-college': createDefaultClientControlProfile(
      'inst-apex-college',
      'STANDARD'
    ),
    'inst-alhuda-academy': createDefaultClientControlProfile(
      'inst-alhuda-academy',
      'RESTRICTED'
    ),
  },
};

export function getStoredSiteOwnerGovernance(): SiteOwnerGovernanceState {
  try {
    const raw = localStorage.getItem(SITE_OWNER_GOVERNANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_GOVERNANCE_STATE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_GOVERNANCE_STATE,
      ...parsed,
      campusPettyCashMetrics: Array.isArray(parsed.campusPettyCashMetrics)
        ? parsed.campusPettyCashMetrics
        : DEFAULT_PETTY_CASH_METRICS,
      clientControls: {
        ...DEFAULT_GOVERNANCE_STATE.clientControls,
        ...(parsed.clientControls || {}),
      },
    };
  } catch {
    return DEFAULT_GOVERNANCE_STATE;
  }
}

export function saveStoredSiteOwnerGovernance(
  state: SiteOwnerGovernanceState
): void {
  try {
    localStorage.setItem(
      SITE_OWNER_GOVERNANCE_STORAGE_KEY,
      JSON.stringify(state)
    );
    window.dispatchEvent(
      new CustomEvent('aplus-site-owner-governance-updated', { detail: state })
    );
  } catch (err) {
    console.warn('Failed to save site owner governance state:', err);
  }
}

export function subscribeSiteOwnerGovernance(
  callback: (state: SiteOwnerGovernanceState) => void
): () => void {
  const handler = () => callback(getStoredSiteOwnerGovernance());
  window.addEventListener('aplus-site-owner-governance-updated', handler);
  return () =>
    window.removeEventListener('aplus-site-owner-governance-updated', handler);
}

export function evaluateCampusPettyCashAlerts(
  state: SiteOwnerGovernanceState
): PettyCashAlertEvaluation[] {
  return state.campusPettyCashMetrics.map((m) => {
    const avg = Math.max(1, m.historicalMonthlyAvgPKR);
    const variancePKR = m.currentMonthSpendPKR - avg;
    const variancePct = Number(((variancePKR / avg) * 100).toFixed(1));
    const effectiveThresholdPct =
      typeof m.customThresholdPct === 'number'
        ? m.customThresholdPct
        : state.globalWarningThresholdPct;

    let severity: 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL';
    if (variancePct >= state.globalCriticalThresholdPct) {
      severity = 'CRITICAL';
    } else if (variancePct >= effectiveThresholdPct) {
      severity = 'WARNING';
    }

    const alertMessage =
      severity === 'CRITICAL'
        ? `CRITICAL SPIKE (+${variancePct}%): ${m.campusName} spent PKR ${m.currentMonthSpendPKR.toLocaleString()} vs historical monthly average PKR ${m.historicalMonthlyAvgPKR.toLocaleString()} (exceeds +${state.globalCriticalThresholdPct}% critical threshold).`
        : severity === 'WARNING'
        ? `HIGH USAGE WARNING (+${variancePct}%): ${m.campusName} spent PKR ${m.currentMonthSpendPKR.toLocaleString()} vs historical monthly average PKR ${m.historicalMonthlyAvgPKR.toLocaleString()} (exceeds +${effectiveThresholdPct}% threshold).`
        : `Within normal monthly threshold (${variancePct >= 0 ? '+' : ''}${variancePct}%).`;

    return {
      ...m,
      variancePKR,
      variancePct,
      effectiveThresholdPct,
      severity,
      alertMessage,
    };
  });
}

export function applySiteOwnerThemeAndColorScheme(
  state: SiteOwnerGovernanceState,
  activeOrganizationId: string,
  isSiteOwnerMode: boolean
): {
  activeThemeMode: ThemeModeOption;
  activeScheme: ColorSchemeVariationDef;
  effectivePrimaryHex: string;
  effectiveAccentHex: string;
} {
  const clientCtrl =
    state.clientControls[activeOrganizationId] ||
    createDefaultClientControlProfile(activeOrganizationId, 'FULL');

  const activeThemeMode: ThemeModeOption = isSiteOwnerMode
    ? state.siteOwnerMasterThemeMode || 'light'
    : clientCtrl.themeMode || 'light';

  const schemeId: ColorSchemeVariationId = isSiteOwnerMode
    ? state.siteOwnerMasterColorSchemeId || 'royal_indigo'
    : clientCtrl.colorSchemeId || 'royal_indigo';

  const activeScheme =
    COLOR_SCHEME_VARIATIONS.find((s) => s.id === schemeId) ||
    COLOR_SCHEME_VARIATIONS[0];

  const effectivePrimaryHex =
    (!isSiteOwnerMode && clientCtrl.customPrimaryHex) ||
    activeScheme.primaryHex;
  const effectiveAccentHex =
    (!isSiteOwnerMode && clientCtrl.customAccentHex) || activeScheme.accentHex;

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-theme-mode', activeThemeMode);
    root.setAttribute('data-color-scheme', activeScheme.id);

    let styleEl = document.getElementById(
      'aplus-site-owner-theme-vars'
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'aplus-site-owner-theme-vars';
      document.head.appendChild(styleEl);
    }

    const darkRules =
      activeThemeMode === 'dark'
        ? `
      html[data-theme-mode="dark"] body,
      html[data-theme-mode="dark"] .bg-slate-100,
      html[data-theme-mode="dark"] .bg-slate-50 {
        background-color: #0b1120 !important;
        color: #f1f5f9 !important;
      }
      html[data-theme-mode="dark"] .bg-white {
        background-color: #111827 !important;
        color: #f8fafc !important;
        border-color: #334155 !important;
      }
      html[data-theme-mode="dark"] .text-slate-900,
      html[data-theme-mode="dark"] .text-slate-800,
      html[data-theme-mode="dark"] .text-slate-700 {
        color: #f1f5f9 !important;
      }
      html[data-theme-mode="dark"] .text-slate-600,
      html[data-theme-mode="dark"] .text-slate-500 {
        color: #94a3b8 !important;
      }
      html[data-theme-mode="dark"] input,
      html[data-theme-mode="dark"] select,
      html[data-theme-mode="dark"] textarea {
        background-color: #1e293b !important;
        color: #f8fafc !important;
        border-color: #475569 !important;
      }
      html[data-theme-mode="dark"] table th {
        background-color: #1e293b !important;
        color: #e2e8f0 !important;
        border-color: #334155 !important;
      }
      html[data-theme-mode="dark"] table td {
        border-color: #334155 !important;
      }
    `
        : '';

    styleEl.textContent = `
      :root {
        --aplus-primary: ${effectivePrimaryHex};
        --aplus-primary-hover: ${activeScheme.primaryHoverHex};
        --aplus-accent: ${effectiveAccentHex};
        --aplus-header-bg: ${activeScheme.headerBgHex};
        --aplus-soft-bg: ${activeScheme.softBgHex};
        --aplus-scheme-border: ${activeScheme.borderHex};
      }
      .bg-indigo-600 {
        background-color: var(--aplus-primary) !important;
      }
      .hover\\:bg-indigo-700:hover {
        background-color: var(--aplus-primary-hover) !important;
      }
      .border-indigo-500, .border-indigo-600 {
        border-color: var(--aplus-scheme-border) !important;
      }
      .bg-slate-900 {
        background-color: var(--aplus-header-bg) !important;
      }
      ${darkRules}
    `;
  }

  return {
    activeThemeMode,
    activeScheme,
    effectivePrimaryHex,
    effectiveAccentHex,
  };
}
