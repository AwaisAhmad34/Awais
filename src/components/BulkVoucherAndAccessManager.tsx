import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Sliders,
  Eye,
  EyeOff,
  Building2,
  Users,
  FileCheck2,
  AlertTriangle,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  RotateCcw,
  UserCheck,
  Layers,
  Calendar,
  Filter,
  X,
  Trash2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useAccounting, Transaction } from '../core/aplusEngine';
import {
  saveVisibilityConfigToCloud,
  loadVisibilityConfigFromCloud,
  wipeAllCloudCollectionsToZero,
} from '../services/firebaseSync';

export interface RolePermissionProfile {
  modules: string[];
  widgets: {
    showPettyCashChart: boolean;
    showBudgetVarianceWidget: boolean;
    showBulkApprovalQueue: boolean;
    showTopBarErpButton: boolean;
    showTopBarCashReconButton: boolean;
    showTopBarA4PrintButton: boolean;
    showTopBarAuditTrailButton: boolean;
  };
  permissions: {
    canBulkApproveReject: boolean;
    canDeleteVouchers: boolean;
    canEditApprovedVouchers: boolean;
    canApproveHighValue: boolean;
    canExportData: boolean;
  };
}

export interface VisibilityAccessConfig {
  previewRole: 'super_admin' | 'administration' | 'campus_head';
  profiles: {
    administration: RolePermissionProfile;
    campus_head: RolePermissionProfile;
  };
  campusOverrides: Record<string, RolePermissionProfile>;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  category: 'Dynamic School ERP Suite' | 'Daily Operations' | 'Ledgers & Statements' | 'Administration & System';
  description: string;
}

export const ALL_SYSTEM_MODULES: ModuleDefinition[] = [
  // Dynamic School ERP Suite
  {
    id: 'erp_overview',
    label: '360° ERP Command Center',
    category: 'Dynamic School ERP Suite',
    description: 'Executive ERP overview, revenue vs expense telemetry & quick actions',
  },
  {
    id: 'erp_fees',
    label: 'Student Fee & Challan ERP',
    category: 'Dynamic School ERP Suite',
    description: 'Student fee challans, collections & 1-click CRV/BRV ledger auto-posting',
  },
  {
    id: 'erp_payroll',
    label: 'HR & Staff Payroll ERP',
    category: 'Dynamic School ERP Suite',
    description: 'Faculty & staff salary sheets & 1-click BPV/CPV ledger auto-posting',
  },
  {
    id: 'erp_procurement',
    label: 'Procurement & Purchase Orders',
    category: 'Dynamic School ERP Suite',
    description: 'Vendor POs, GRN verification & automated supplier BPV settlement',
  },
  {
    id: 'erp_inventory',
    label: 'Inventory & Campus Store',
    category: 'Dynamic School ERP Suite',
    description: 'Stock quantities, low-stock reorder alerts & petty cash restock',
  },
  {
    id: 'erp_budgeting',
    label: 'Campus Budgeting & Variance',
    category: 'Dynamic School ERP Suite',
    description: 'Departmental budget allocations vs actual General Ledger spend',
  },
  // Daily Operations
  {
    id: 'dashboard',
    label: 'Executive Dashboard',
    category: 'Daily Operations',
    description: 'Multi-campus cash flow snapshots, liquidity & analytics cards',
  },
  {
    id: 'pettycash',
    label: 'Petty Cash Management',
    category: 'Daily Operations',
    description: 'Imprest cash float, daily expense slips & Recharts category breakdown',
  },
  {
    id: 'transaction',
    label: 'Voucher Entry (BPV/BRV/CPV/CRV/JV)',
    category: 'Daily Operations',
    description: 'Create new Four-Voucher Standard & Journal Voucher transactions',
  },
  {
    id: 'alltransactions',
    label: 'Edit Transactions & Bulk Approval',
    category: 'Daily Operations',
    description: 'Ledger register, bulk pending voucher approve/reject & batch print',
  },
  // Ledgers & Statements
  {
    id: 'reports',
    label: 'Financial Reports & Trial Balance',
    category: 'Ledgers & Statements',
    description: 'Audited 8-column trial balance, account ledgers & income statement',
  },
  {
    id: 'accounts',
    label: 'Chart of Accounts (157 Heads)',
    category: 'Ledgers & Statements',
    description: '5-Main, 28-Group, 157-Account Head institutional COA structure',
  },
  {
    id: 'reconciliation',
    label: 'Bank Reconciliation',
    category: 'Ledgers & Statements',
    description: 'Match campus bank ledger entries against bank statements',
  },
  {
    id: 'cashreconciliation',
    label: 'Physical Cash Reconciliation',
    category: 'Ledgers & Statements',
    description: 'PKR physical currency denomination count vs Cash in Hand ledger',
  },
  {
    id: 'openingbalance',
    label: 'Opening Balances Setup',
    category: 'Ledgers & Statements',
    description: 'Campus fiscal year opening debit and credit balances',
  },
  {
    id: 'periods',
    label: 'Accounting Periods',
    category: 'Ledgers & Statements',
    description: 'Manage fiscal years, lock closed periods & year-end close',
  },
  {
    id: 'depreciation',
    label: 'Fixed Asset Depreciation',
    category: 'Ledgers & Statements',
    description: 'Fixed asset schedule, depreciation rates & net book values',
  },
  // Administration & System
  {
    id: 'campuses',
    label: 'Campus Branches & Users',
    category: 'Administration & System',
    description: 'Multi-campus branch setup, accountant roles & imprest limits',
  },
  {
    id: 'activity',
    label: 'Forensic Secure Audit Trail',
    category: 'Administration & System',
    description: 'Cryptographic audit log of voucher creations, edits & deletions',
  },
  {
    id: 'docs',
    label: '49-Section Manual & Procedures',
    category: 'Administration & System',
    description: 'Institutional finance SOPs, checklists & compliance manual',
  },
];

const VISIBILITY_STORAGE_KEY = 'aplus_superadmin_visibility_config_v1';

export const DEFAULT_VISIBILITY_CONFIG: VisibilityAccessConfig = {
  previewRole: 'super_admin',
  profiles: {
    administration: {
      modules: [
        'erp_overview',
        'erp_fees',
        'erp_payroll',
        'erp_procurement',
        'erp_inventory',
        'erp_budgeting',
        'dashboard',
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
      widgets: {
        showPettyCashChart: true,
        showBudgetVarianceWidget: true,
        showBulkApprovalQueue: true,
        showTopBarErpButton: true,
        showTopBarCashReconButton: true,
        showTopBarA4PrintButton: true,
        showTopBarAuditTrailButton: true,
      },
      permissions: {
        canBulkApproveReject: true,
        canDeleteVouchers: false,
        canEditApprovedVouchers: true,
        canApproveHighValue: true,
        canExportData: true,
      },
    },
    campus_head: {
      modules: [
        'erp_overview',
        'erp_fees',
        'erp_inventory',
        'dashboard',
        'pettycash',
        'transaction',
        'alltransactions',
        'reports',
        'cashreconciliation',
        'docs',
      ],
      widgets: {
        showPettyCashChart: true,
        showBudgetVarianceWidget: true,
        showBulkApprovalQueue: true,
        showTopBarErpButton: true,
        showTopBarCashReconButton: true,
        showTopBarA4PrintButton: true,
        showTopBarAuditTrailButton: false,
      },
      permissions: {
        canBulkApproveReject: true,
        canDeleteVouchers: false,
        canEditApprovedVouchers: false,
        canApproveHighValue: false,
        canExportData: true,
      },
    },
  },
  campusOverrides: {},
};

const listeners = new Set<(cfg: VisibilityAccessConfig) => void>();

export function getStoredVisibilityConfig(): VisibilityAccessConfig {
  try {
    const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profiles) {
        return {
          ...DEFAULT_VISIBILITY_CONFIG,
          ...parsed,
          profiles: {
            administration: {
              ...DEFAULT_VISIBILITY_CONFIG.profiles.administration,
              ...(parsed.profiles?.administration || {}),
            },
            campus_head: {
              ...DEFAULT_VISIBILITY_CONFIG.profiles.campus_head,
              ...(parsed.profiles?.campus_head || {}),
            },
          },
          campusOverrides: parsed.campusOverrides || {},
        };
      }
    }
  } catch {}
  return DEFAULT_VISIBILITY_CONFIG;
}

export function updateStoredVisibilityConfig(next: VisibilityAccessConfig) {
  try {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((fn) => fn(next));
  saveVisibilityConfigToCloud(next);
}

export function subscribeVisibilityConfig(fn: (cfg: VisibilityAccessConfig) => void) {
  listeners.add(fn);
  fn(getStoredVisibilityConfig());
  return () => {
    listeners.delete(fn);
  };
}

export function resolveActiveProfileForUser(
  cfg: VisibilityAccessConfig,
  currentUser: any,
  currentCampusId?: string
): RolePermissionProfile | null {
  // If Super Admin is previewing a role, return that role's profile
  if (cfg.previewRole === 'administration') {
    return cfg.profiles.administration;
  }
  if (cfg.previewRole === 'campus_head') {
    if (currentCampusId && currentCampusId !== 'all' && cfg.campusOverrides[currentCampusId]) {
      return cfg.campusOverrides[currentCampusId];
    }
    return cfg.profiles.campus_head;
  }

  // If logged in as non-super-admin
  if (currentUser && currentUser.role !== 'super_admin') {
    const cid = currentUser.campusId || currentCampusId;
    if (cid && cid !== 'all' && cfg.campusOverrides[cid]) {
      return cfg.campusOverrides[cid];
    }
    const roleStr = String(currentUser.role || currentUser.designation || '').toLowerCase();
    if (roleStr.includes('admin') || roleStr.includes('controller') || roleStr.includes('director')) {
      return cfg.profiles.administration;
    }
    return cfg.profiles.campus_head;
  }

  // Pure Super Admin with no preview active has unrestricted access
  return null;
}

// Install global visibility check hook used by aplusEngine.js sidebar
export function installGlobalVisibilityHook() {
  window.__APLUS_VISIBILITY_CHECK__ = (moduleId: string, user?: any) => {
    try {
      const regRaw = localStorage.getItem('aplus_multi_school_registry_v1');
      const govRaw = localStorage.getItem('aplus_site_owner_governance_v1');
      if (regRaw && govRaw) {
        const reg = JSON.parse(regRaw);
        const gov = JSON.parse(govRaw);
        const activeOrgId = reg?.activeInstituteId || 'inst-aplus-main';
        const clientCtrl = gov?.clientControls?.[activeOrgId];
        if (
          clientCtrl &&
          Array.isArray(clientCtrl.allowedModules) &&
          moduleId !== 'multitenant'
        ) {
          if (!clientCtrl.allowedModules.includes(moduleId)) {
            return false;
          }
        }
      }
    } catch {}
    const cfg = getStoredVisibilityConfig();
    const profile = resolveActiveProfileForUser(cfg, user);
    if (!profile) return true; // Super Admin unrestricted
    return profile.modules.includes(moduleId);
  };
}

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const BulkVoucherAndAccessManager: React.FC<{
  onNavigate?: (tab: string) => void;
  mode?: 'ledger' | 'standalone';
}> = ({ onNavigate, mode = 'ledger' }) => {
  const {
    transactions,
    campuses,
    currentCampusId,
    setCurrentCampusId,
    accountHeads,
    currentUser,
    isSuperAdmin,
    updateVoucherStatus,
    deleteTransaction,
    deleteCampus,
    clearAllData,
    addTransaction,
    getNextVoucherNumber,
    updateCampusModules,
    logActivity,
  } = useAccounting();

  const [visibilityConfig, setVisibilityConfig] = useState<VisibilityAccessConfig>(() =>
    getStoredVisibilityConfig()
  );
  const [activePanel, setActivePanel] = useState<'bulk_approval' | 'super_admin_visibility'>(
    mode === 'standalone' ? 'super_admin_visibility' : 'bulk_approval'
  );

  // Bulk Voucher Selection & Filter State
  const [statusFilter, setStatusFilter] = useState<'Pending' | 'Approved' | 'Rejected' | 'ALL'>('Pending');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'FY'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRemarks, setBatchRemarks] = useState<string>('');
  const [expandedVoucherIds, setExpandedVoucherIds] = useState<string[]>([]);
  const [toastBanner, setToastBanner] = useState<{
    type: 'approve' | 'reject' | 'info';
    text: string;
  } | null>(null);

  const toggleExpandRow = (voucherId: string) => {
    setExpandedVoucherIds((prev) =>
      prev.includes(voucherId)
        ? prev.filter((id) => id !== voucherId)
        : [...prev, voucherId]
    );
  };

  const handleToggleExpandAllFiltered = () => {
    const visibleIds = filteredVouchers.map((v) => v.id);
    const allExpanded =
      visibleIds.length > 0 &&
      visibleIds.every((id) => expandedVoucherIds.includes(id));
    if (allExpanded) {
      setExpandedVoucherIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setExpandedVoucherIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  // Super Admin Visibility Editor Target State
  const [targetScope, setTargetScope] = useState<'administration' | 'campus_head' | string>('campus_head');

  useEffect(() => {
    installGlobalVisibilityHook();
    const unsub = subscribeVisibilityConfig(setVisibilityConfig);
    loadVisibilityConfigFromCloud().then((cloudCfg) => {
      if (cloudCfg && cloudCfg.profiles) {
        updateStoredVisibilityConfig({
          ...DEFAULT_VISIBILITY_CONFIG,
          ...cloudCfg,
        });
      }
    });
    return unsub;
  }, []);

  const activeRoleProfile = useMemo(
    () => resolveActiveProfileForUser(visibilityConfig, currentUser, currentCampusId),
    [visibilityConfig, currentUser, currentCampusId]
  );

  const canPerformBulkActions =
    !activeRoleProfile || activeRoleProfile.permissions.canBulkApproveReject;
  const canApproveHighValue =
    !activeRoleProfile || activeRoleProfile.permissions.canApproveHighValue;

  // Normalize voucher status helper
  const getNormalizedStatus = (st?: string): 'Pending' | 'Approved' | 'Rejected' => {
    if (st === 'Approved' || st === 'Posted' || st === 'Paid') return 'Approved';
    if (st === 'Rejected' || st === 'Cancelled') return 'Rejected';
    return 'Pending';
  };

  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'FY') => {
    setDatePreset(preset);
    const now = new Date();
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    if (preset === 'ALL') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'TODAY') {
      const todayStr = toIso(now);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDateFrom(toIso(weekAgo));
      setDateTo(toIso(now));
    } else if (preset === 'MONTH') {
      const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setDateFrom(firstOfMonth);
      setDateTo(toIso(now));
    } else if (preset === 'FY') {
      setDateFrom('2026-07-01');
      setDateTo('2027-06-30');
    }
  };

  const handleResetAllFilters = () => {
    setStatusFilter('ALL');
    setVoucherTypeFilter('ALL');
    setCurrentCampusId('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setDatePreset('ALL');
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    voucherTypeFilter !== 'ALL' ||
    currentCampusId !== 'all' ||
    searchQuery.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  // Scoped transactions for Bulk Action Queue
  const filteredVouchers = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (currentCampusId !== 'all' && tx.campusId !== currentCampusId) return false;
      const norm = getNormalizedStatus(tx.status);
      if (statusFilter !== 'ALL' && norm !== statusFilter) return false;
      if (voucherTypeFilter !== 'ALL' && tx.voucherType !== voucherTypeFilter) return false;

      // Date-range filter (YYYY-MM-DD comparison)
      const txDate = (tx.date || '').slice(0, 10);
      if (dateFrom && txDate && txDate < dateFrom) return false;
      if (dateTo && txDate && txDate > dateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const campusObj = campuses.find((c) => c.id === tx.campusId);
        const matchNo = (tx.voucherNo || '').toLowerCase().includes(q);
        const matchType = (tx.voucherType || '').toLowerCase().includes(q);
        const matchNarr = (tx.narration || '').toLowerCase().includes(q);
        const matchPrep = (tx.preparedBy || '').toLowerCase().includes(q);
        const matchCampus =
          (campusObj?.name || '').toLowerCase().includes(q) ||
          (campusObj?.code || '').toLowerCase().includes(q);
        const matchAmount = String(tx.totalDebit || '').includes(q);
        const matchLineItems = (tx.entries || []).some(
          (entry) =>
            (entry.accountCode || '').toLowerCase().includes(q) ||
            (entry.accountName || '').toLowerCase().includes(q) ||
            (entry.description || '').toLowerCase().includes(q) ||
            (entry.refCheckNo || '').toLowerCase().includes(q)
        );
        if (
          !matchNo &&
          !matchType &&
          !matchNarr &&
          !matchPrep &&
          !matchCampus &&
          !matchAmount &&
          !matchLineItems
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    transactions,
    campuses,
    currentCampusId,
    statusFilter,
    voucherTypeFilter,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  const filteredTotalDebit = useMemo(
    () => filteredVouchers.reduce((sum, tx) => sum + (Number(tx.totalDebit) || 0), 0),
    [filteredVouchers]
  );

  const filteredTotalCredit = useMemo(
    () => filteredVouchers.reduce((sum, tx) => sum + (Number(tx.totalCredit) || 0), 0),
    [filteredVouchers]
  );

  // Current Balance based on current search & filter results:
  // Calculates net inflow/outflow across filtered vouchers (Receipt Vouchers CRV/BRV minus Payment Vouchers CPV/BPV, plus any net debit-credit movement)
  const filteredCurrentBalance = useMemo(() => {
    let netMovement = 0;
    filteredVouchers.forEach((tx) => {
      const amt = Number(tx.totalDebit) || Number(tx.totalCredit) || 0;
      if (tx.voucherType === 'BRV' || tx.voucherType === 'CRV') {
        netMovement += amt;
      } else if (tx.voucherType === 'BPV' || tx.voucherType === 'CPV') {
        netMovement -= amt;
      } else {
        netMovement += (Number(tx.totalDebit) || 0) - (Number(tx.totalCredit) || 0);
      }
    });
    return netMovement;
  }, [filteredVouchers]);

  const filteredStatusCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    filteredVouchers.forEach((tx) => {
      const st = getNormalizedStatus(tx.status);
      if (st === 'Approved') approved++;
      else if (st === 'Rejected') rejected++;
      else pending++;
    });
    return { pending, approved, rejected };
  }, [filteredVouchers]);

  const handleBulkDeleteSelected = () => {
    if (selectedVouchers.length === 0) return;
    const count = selectedVouchers.length;
    selectedVouchers.forEach((v) => {
      deleteTransaction(v.id);
    });
    setSelectedIds([]);
    showToast('reject', `Deleted ${count} selected voucher(s) from the ledger.`);
  };

  const handleDeleteAllPreviousEntriesAndCampuses = async () => {
    clearAllData();
    await wipeAllCloudCollectionsToZero();
    setSelectedIds([]);
    showToast(
      'info',
      'Deleted all previous entries, vouchers, petty cash records, and campuses (Reset to 0).'
    );
  };

  const pendingVouchersInCampus = useMemo(
    () =>
      (transactions || []).filter(
        (tx) =>
          (currentCampusId === 'all' || tx.campusId === currentCampusId) &&
          getNormalizedStatus(tx.status) === 'Pending'
      ),
    [transactions, currentCampusId]
  );

  const selectedVouchers = useMemo(
    () => (transactions || []).filter((tx) => selectedIds.includes(tx.id)),
    [transactions, selectedIds]
  );

  const selectedTotalDebit = useMemo(
    () => selectedVouchers.reduce((sum, tx) => sum + (Number(tx.totalDebit) || 0), 0),
    [selectedVouchers]
  );

  const selectedTotalCredit = useMemo(
    () => selectedVouchers.reduce((sum, tx) => sum + (Number(tx.totalCredit) || 0), 0),
    [selectedVouchers]
  );

  const showToast = (type: 'approve' | 'reject' | 'info', text: string) => {
    setToastBanner({ type, text });
    setTimeout(() => setToastBanner(null), 5000);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const visibleIds = filteredVouchers.map((v) => v.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectAllPending = () => {
    setStatusFilter('Pending');
    setSelectedIds(pendingVouchersInCampus.map((v) => v.id));
  };

  // SIMULTANEOUS BULK APPROVE OR REJECT HANDLER
  const handleExecuteBulkStatusUpdate = (targetStatus: 'Approved' | 'Rejected' | 'Pending') => {
    if (selectedVouchers.length === 0) return;

    if (!canPerformBulkActions) {
      showToast(
        'reject',
        'Permission Restricted: Super Admin has disabled Bulk Approve/Reject for this role profile.'
      );
      return;
    }

    // Check High-Value threshold if Campus Head profile has restriction
    if (targetStatus === 'Approved' && !canApproveHighValue) {
      const highValueVouchers = selectedVouchers.filter((v) => (Number(v.totalDebit) || 0) > 50000);
      if (highValueVouchers.length > 0) {
        showToast(
          'reject',
          `Approval Limit Exceeded: ${highValueVouchers.length} selected voucher(s) exceed Rs. 50,000. Super Admin or Administration authorization required.`
        );
        return;
      }
    }

    const officerName =
      visibilityConfig.previewRole === 'administration'
        ? 'Administration Controller'
        : visibilityConfig.previewRole === 'campus_head'
        ? 'Campus Head / Principal'
        : currentUser?.name || 'Super Administrator';

    const officerRole =
      visibilityConfig.previewRole === 'administration'
        ? 'Administration'
        : visibilityConfig.previewRole === 'campus_head'
        ? 'Campus Head'
        : isSuperAdmin
        ? 'Super Administrator'
        : 'Campus Accountant';

    const remarksText =
      batchRemarks.trim() ||
      (targetStatus === 'Approved'
        ? `Simultaneous Bulk Approval (${selectedVouchers.length} vouchers) by ${officerName}`
        : targetStatus === 'Rejected'
        ? `Simultaneous Bulk Rejection (${selectedVouchers.length} vouchers) by ${officerName} — Requires supporting documentation`
        : `Moved back to Pending ReviewQueue by ${officerName}`);

    const voucherNos: string[] = [];
    selectedVouchers.forEach((voucher) => {
      voucherNos.push(voucher.voucherNo);
      updateVoucherStatus(voucher.id, targetStatus, officerName, officerRole, remarksText);
    });

    logActivity(
      'STATUS_CHANGE',
      'Voucher',
      voucherNos.slice(0, 3).join(', ') + (voucherNos.length > 3 ? ` (+${voucherNos.length - 3} more)` : ''),
      `Simultaneous Bulk ${targetStatus}: ${selectedVouchers.length} vouchers (${voucherNos.join(', ')}) totaling ${formatPKR(selectedTotalDebit)}. Remarks: ${remarksText}`,
      currentCampusId === 'all' ? selectedVouchers[0]?.campusId || 'all' : currentCampusId,
      selectedTotalDebit,
      {
        bulkAction: targetStatus,
        voucherCount: selectedVouchers.length,
        voucherNumbers: voucherNos,
        performedBy: officerName,
        performedByRole: officerRole,
        remarks: remarksText,
      }
    );

    const count = selectedVouchers.length;
    const totalFormatted = formatPKR(selectedTotalDebit);
    setSelectedIds([]);
    setBatchRemarks('');

    if (targetStatus === 'Approved') {
      showToast(
        'approve',
        `Simultaneously Approved ${count} voucher(s) (${voucherNos.join(', ')}) totaling ${totalFormatted}!`
      );
    } else if (targetStatus === 'Rejected') {
      showToast(
        'reject',
        `Simultaneously Rejected ${count} voucher(s) (${voucherNos.join(', ')}) totaling ${totalFormatted}.`
      );
    } else {
      showToast(
        'info',
        `Moved ${count} voucher(s) (${voucherNos.join(', ')}) to Pending Queue for bulk verification.`
      );
    }
  };

  // Seed 4 realistic Pending Vouchers so administrators can test bulk approve/reject immediately
  const handleGenerateSamplePendingVouchers = () => {
    const targetCampus =
      currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId;
    const today = new Date().toISOString().slice(0, 10);

    const sampleConfigs = [
      {
        type: 'BPV' as const,
        narration: 'Pending Vendor Bill: Lab Microscopes & Chemistry Glassware Batch #14',
        drCode: '5049',
        drName: 'Science & Computer Lab Consumables',
        crCode: '1020',
        crName: 'Main Bank Account',
        amount: 34500,
      },
      {
        type: 'CPV' as const,
        narration: 'Pending Cash Voucher: Mid-Term Exam Answer Sheet Printing & Stationery',
        drCode: '5014',
        drName: 'Printing & Stationery',
        crCode: '1018',
        crName: 'Cash in Hand',
        amount: 18200,
      },
      {
        type: 'BRV' as const,
        narration: 'Pending Bank Receipt: Group Tuition & Admission Challan Batch Deposit',
        drCode: '1020',
        drName: 'Main Bank Account',
        crCode: '4001',
        crName: 'Tuition Fee Income',
        amount: 64000,
      },
      {
        type: 'JV' as const,
        narration: 'Pending Journal Adjustment: Campus Generator Fuel & Maintenance Allocation',
        drCode: '5043',
        drName: 'Building & Electrical Repairs',
        crCode: '1018',
        crName: 'Cash in Hand',
        amount: 12800,
      },
    ];

    const createdIds: string[] = [];
    sampleConfigs.forEach((cfg, idx) => {
      const vNo = `${cfg.type}-PND-${Date.now().toString().slice(-3)}-${idx + 1}`;
      const drHead = accountHeads.find((a) => a.accountId === cfg.drCode || a.code === cfg.drCode);
      const crHead = accountHeads.find((a) => a.accountId === cfg.crCode || a.code === cfg.crCode);

      const created = addTransaction({
        voucherNo: vNo,
        voucherType: cfg.type,
        campusId: targetCampus,
        date: today,
        narration: cfg.narration,
        status: 'Pending',
        preparedBy: 'Campus Accounts Officer',
        totalDebit: cfg.amount,
        totalCredit: cfg.amount,
        entries: [
          {
            id: `pnd-dr-${Date.now()}-${idx}`,
            accountId: drHead?.id || `acc-${cfg.drCode}`,
            accountCode: drHead?.code || cfg.drCode,
            accountName: drHead?.name || cfg.drName,
            description: cfg.narration,
            debit: cfg.amount,
            credit: 0,
          },
          {
            id: `pnd-cr-${Date.now()}-${idx}`,
            accountId: crHead?.id || `acc-${cfg.crCode}`,
            accountCode: crHead?.code || cfg.crCode,
            accountName: crHead?.name || cfg.crName,
            description: cfg.narration,
            debit: 0,
            credit: cfg.amount,
          },
        ],
      });
      if (created?.id) {
        createdIds.push(created.id);
        // Ensure status is explicitly Pending even if logged in as Super Admin
        updateVoucherStatus(
          created.id,
          'Pending',
          'Campus Accounts Officer',
          'Campus Accountant',
          'Submitted to Pending Queue for Administrator Bulk Review'
        );
      }
    });

    setStatusFilter('Pending');
    setSelectedIds(createdIds);
    showToast(
      'info',
      'Created & selected 4 Pending Vouchers (BPV, CPV, BRV, JV) ready for simultaneous Bulk Approve or Reject!'
    );
  };

  // Super Admin Visibility Matrix Helpers
  const currentEditingProfile: RolePermissionProfile = useMemo(() => {
    if (targetScope === 'administration') {
      return visibilityConfig.profiles.administration;
    }
    if (targetScope === 'campus_head') {
      return visibilityConfig.profiles.campus_head;
    }
    return (
      visibilityConfig.campusOverrides[targetScope] ||
      visibilityConfig.profiles.campus_head
    );
  }, [visibilityConfig, targetScope]);

  const updateTargetProfile = (updater: (prev: RolePermissionProfile) => RolePermissionProfile) => {
    const updatedProfile = updater(currentEditingProfile);
    let nextConfig: VisibilityAccessConfig;

    if (targetScope === 'administration') {
      nextConfig = {
        ...visibilityConfig,
        profiles: {
          ...visibilityConfig.profiles,
          administration: updatedProfile,
        },
      };
    } else if (targetScope === 'campus_head') {
      nextConfig = {
        ...visibilityConfig,
        profiles: {
          ...visibilityConfig.profiles,
          campus_head: updatedProfile,
        },
      };
      // Sync default campus_head modules to campuses without explicit overrides
      campuses.forEach((c) => {
        if (!visibilityConfig.campusOverrides[c.id]) {
          updateCampusModules?.(c.id, updatedProfile.modules);
        }
      });
    } else {
      nextConfig = {
        ...visibilityConfig,
        campusOverrides: {
          ...visibilityConfig.campusOverrides,
          [targetScope]: updatedProfile,
        },
      };
      updateCampusModules?.(targetScope, updatedProfile.modules);
    }

    updateStoredVisibilityConfig(nextConfig);
  };

  const handleToggleModuleForTarget = (moduleId: string) => {
    updateTargetProfile((prev) => {
      const exists = prev.modules.includes(moduleId);
      const nextModules = exists
        ? prev.modules.filter((m) => m !== moduleId)
        : [...prev.modules, moduleId];
      return { ...prev, modules: nextModules };
    });
  };

  const handleApplyPreset = (preset: 'all' | 'admin_standard' | 'campus_head_essential' | 'accounting_only') => {
    const allIds = ALL_SYSTEM_MODULES.map((m) => m.id);
    if (preset === 'all') {
      updateTargetProfile((prev) => ({
        ...prev,
        modules: allIds,
        widgets: {
          showPettyCashChart: true,
          showBudgetVarianceWidget: true,
          showBulkApprovalQueue: true,
          showTopBarErpButton: true,
          showTopBarCashReconButton: true,
          showTopBarA4PrintButton: true,
          showTopBarAuditTrailButton: true,
        },
        permissions: {
          canBulkApproveReject: true,
          canDeleteVouchers: true,
          canEditApprovedVouchers: true,
          canApproveHighValue: true,
          canExportData: true,
        },
      }));
      showToast('info', 'Applied Full Unrestricted Access Preset');
    } else if (preset === 'admin_standard') {
      updateTargetProfile(() => DEFAULT_VISIBILITY_CONFIG.profiles.administration);
      showToast('info', 'Applied Standard Administration Controller Preset');
    } else if (preset === 'campus_head_essential') {
      updateTargetProfile(() => DEFAULT_VISIBILITY_CONFIG.profiles.campus_head);
      showToast('info', 'Applied Campus Head / Principal Essentials Preset');
    } else if (preset === 'accounting_only') {
      updateTargetProfile((prev) => ({
        ...prev,
        modules: [
          'dashboard',
          'pettycash',
          'transaction',
          'alltransactions',
          'reports',
          'accounts',
          'reconciliation',
          'cashreconciliation',
        ],
        widgets: {
          ...prev.widgets,
          showTopBarErpButton: false,
        },
      }));
      showToast('info', 'Applied Core Voucher & Petty Cash Only Preset (ERP Hidden)');
    }
  };

  const handleSetPreviewRole = (role: 'super_admin' | 'administration' | 'campus_head') => {
    const next: VisibilityAccessConfig = {
      ...visibilityConfig,
      previewRole: role,
    };
    updateStoredVisibilityConfig(next);
    showToast(
      'info',
      role === 'super_admin'
        ? 'Restored Full Super Admin View'
        : `Active Live Preview: Viewing system as ${
            role === 'administration' ? 'Administration Controller' : 'Campus Head / Principal'
          }`
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Command Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                <span>Ledger Batch Governance</span>
                <span aria-hidden="true">·</span>
                <span>Super Admin Visibility & Role Access Control</span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Bulk Pending Voucher Approval & Super Admin Role Visibility Matrix
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActivePanel('bulk_approval')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activePanel === 'bulk_approval'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Bulk Voucher Approval ({pendingVouchersInCampus.length} Pending)</span>
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setActivePanel('super_admin_visibility')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    activePanel === 'super_admin_visibility'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Super Admin: Manage Admin & Campus Head View</span>
                </button>
              )}
            </div>

            {/* Super Admin Live Role Preview Selector */}
            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 font-medium hidden sm:inline">View As:</span>
                <select
                  value={visibilityConfig.previewRole}
                  onChange={(e) =>
                    handleSetPreviewRole(
                      e.target.value as 'super_admin' | 'administration' | 'campus_head'
                    )
                  }
                  className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
                  aria-label="Preview Role Visibility"
                >
                  <option value="super_admin" className="text-slate-900">
                    Super Admin (All Modules)
                  </option>
                  <option value="administration" className="text-slate-900">
                    Administration View
                  </option>
                  <option value="campus_head" className="text-slate-900">
                    Campus Head View
                  </option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Active Role Preview Banner */}
        {visibilityConfig.previewRole !== 'super_admin' && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <Eye className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Super Admin Preview Active: You are currently experiencing the interface with{' '}
                <strong className="uppercase">
                  {visibilityConfig.previewRole === 'administration'
                    ? 'Administration / Finance Controller'
                    : 'Campus Head / Principal'}
                </strong>{' '}
                visibility & permission rules ({activeRoleProfile?.modules.length} modules enabled).
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSetPreviewRole('super_admin')}
              className="px-2.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-[11px] cursor-pointer"
            >
              Exit Preview & Restore Super Admin
            </button>
          </div>
        )}

        {/* Toast Feedback Banner */}
        {toastBanner && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between text-xs font-bold ${
              toastBanner.type === 'approve'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : toastBanner.type === 'reject'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastBanner.type === 'approve' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {toastBanner.type === 'reject' && (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {toastBanner.type === 'info' && (
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{toastBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* PANEL 1: BULK PENDING VOUCHER APPROVAL & REJECTION INTERFACE */}
        {activePanel === 'bulk_approval' && (
          <div className="p-5 space-y-4">
            {/* Filter & Selection Toolbar: Search Bar, Date-Range Picker, Campus & Voucher Type */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
              {/* Row 1: Search Input + Campus Filter + Voucher Type Filter + Actions */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Multi-Field Search Bar */}
                <div className="md:col-span-5 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search voucher #, narration, account code/title, cheque #, campus, or amount..."
                    aria-label="Search vouchers by voucher number, narration, account, campus, or amount"
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/15"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      title="Clear search query"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Campus Selector */}
                <div className="md:col-span-3 flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    value={currentCampusId}
                    onChange={(e) => setCurrentCampusId(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    aria-label="Filter by Campus"
                  >
                    <option value="all">All Campuses ({campuses.length})</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Voucher Type Selector */}
                <div className="md:col-span-2 flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-2">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    value={voucherTypeFilter}
                    onChange={(e) => setVoucherTypeFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    aria-label="Filter by Voucher Type"
                  >
                    <option value="ALL">All Types (5)</option>
                    <option value="BPV">BPV — Bank Payment</option>
                    <option value="BRV">BRV — Bank Receipt</option>
                    <option value="CPV">CPV — Cash Payment</option>
                    <option value="CRV">CRV — Cash Receipt</option>
                    <option value="JV">JV — Journal Voucher</option>
                  </select>
                </div>

                {/* Quick Create New Voucher Button */}
                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigate?.('transaction')}
                    className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Create a new real voucher (BPV, BRV, CPV, CRV, JV) from scratch"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                    <span>+ New Voucher</span>
                  </button>
                </div>
              </div>

              {/* Row 2: Date-Range Picker (From Date & To Date) + Quick Date Presets */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Date Range:</span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-semibold text-slate-500">From</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setDatePreset('ALL');
                      }}
                      aria-label="Filter vouchers from start date"
                      className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] font-semibold text-slate-500">To</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setDatePreset('ALL');
                      }}
                      aria-label="Filter vouchers to end date"
                      className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Quick Date Range Presets */}
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'ALL', label: 'All Dates' },
                        { id: 'TODAY', label: 'Today' },
                        { id: 'WEEK', label: 'Last 7 Days' },
                        { id: 'MONTH', label: 'This Month' },
                        { id: 'FY', label: 'FY 26-27' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyDatePreset(p.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          datePreset === p.id &&
                          (p.id !== 'ALL' || (!dateFrom && !dateTo))
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voucher Type Quick Filter Pills */}
                <div className="flex flex-wrap items-center gap-1">
                  {(['ALL', 'BPV', 'BRV', 'CPV', 'CRV', 'JV'] as const).map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => setVoucherTypeFilter(vt)}
                      className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                        voucherTypeFilter === vt
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {vt === 'ALL' ? 'All Types' : vt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Status Queue Tabs + Filtered Summary + Select All Pending */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                <div className="flex flex-wrap items-center gap-2">
                  {(['Pending', 'Approved', 'Rejected', 'ALL'] as const).map((st) => {
                    const isActive = statusFilter === st;
                    const count =
                      st === 'Pending'
                        ? pendingVouchersInCampus.length
                        : (transactions || []).filter(
                            (tx) =>
                              (currentCampusId === 'all' || tx.campusId === currentCampusId) &&
                              (st === 'ALL' || getNormalizedStatus(tx.status) === st)
                          ).length;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{st === 'ALL' ? 'All Vouchers' : `${st} Queue`}</span>
                        <span className="font-mono text-[11px] opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[11px] text-slate-600 font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    Showing <strong>{filteredVouchers.length}</strong> voucher(s) · Dr:{' '}
                    <strong className="text-slate-900">{formatPKR(filteredTotalDebit)}</strong> · Cr:{' '}
                    <strong className="text-slate-900">{formatPKR(filteredTotalCredit)}</strong>
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Clear search, date range, campus, and voucher type filters"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear Filters</span>
                    </button>
                  )}

                  {filteredVouchers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleExpandAllFiltered}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Expand or collapse all visible rows to inspect detailed transaction line items inline"
                    >
                      {filteredVouchers.every((v) =>
                        expandedVoucherIds.includes(v.id)
                      ) ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Collapse All Rows</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Expand All Rows ({filteredVouchers.length})</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSelectAllPending}
                    className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold cursor-pointer"
                  >
                    Select All Pending ({pendingVouchersInCampus.length})
                  </button>
                </div>
              </div>
            </div>

            {/* ROW OF 4 SUMMARY CARDS ABOVE DATA TABLE (BASED ON CURRENT SEARCH FILTER RESULTS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Card 1: Total Vouchers */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Vouchers
                  </span>
                  <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <FileCheck2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {filteredVouchers.length}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                    <span className="text-amber-700">{filteredStatusCounts.pending} Pending</span>
                    <span>·</span>
                    <span className="text-emerald-700">{filteredStatusCounts.approved} Approved</span>
                    <span>·</span>
                    <span className="text-rose-700">{filteredStatusCounts.rejected} Rejected</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Debit */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Debit
                  </span>
                  <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700">
                    {formatPKR(filteredTotalDebit)}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    Sum of Debit entries in current filter
                  </div>
                </div>
              </div>

              {/* Card 3: Total Credit */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Total Credit
                  </span>
                  <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-indigo-700">
                    {formatPKR(filteredTotalCredit)}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    Sum of Credit entries in current filter
                  </div>
                </div>
              </div>

              {/* Card 4: Current Balance */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Current Balance
                  </span>
                  <span className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <Wallet className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-2">
                  <div
                    className={`text-xl sm:text-2xl font-black font-mono ${
                      filteredCurrentBalance >= 0 ? 'text-slate-900' : 'text-rose-700'
                    }`}
                  >
                    {formatPKR(filteredCurrentBalance)}
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-slate-500">
                    {Math.abs(filteredTotalDebit - filteredTotalCredit) < 0.01
                      ? 'Double-Entry Balanced (Dr = Cr)'
                      : `Variance: ${formatPKR(Math.abs(filteredTotalDebit - filteredTotalCredit))}`}
                  </div>
                </div>
              </div>
            </div>

            {/* Simultaneous Bulk Action Command Bar */}
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 font-mono font-black text-emerald-300 text-sm">
                    {selectedVouchers.length}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {selectedVouchers.length === 1
                        ? '1 Voucher Selected for Batch Action'
                        : `${selectedVouchers.length} Vouchers Selected Simultaneously`}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Batch Debit: <strong className="text-emerald-400">{formatPKR(selectedTotalDebit)}</strong> · Batch Credit:{' '}
                      <strong className="text-emerald-400">{formatPKR(selectedTotalCredit)}</strong>
                    </div>
                  </div>
                </div>

                {selectedVouchers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl justify-end">
                <input
                  type="text"
                  value={batchRemarks}
                  onChange={(e) => setBatchRemarks(e.target.value)}
                  placeholder="Optional approval note or rejection reason for all selected vouchers..."
                  className="flex-1 min-w-[210px] px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="button"
                  disabled={selectedVouchers.length === 0}
                  onClick={() => handleExecuteBulkStatusUpdate('Approved')}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Selected ({selectedVouchers.length})</span>
                </button>

                <button
                  type="button"
                  disabled={selectedVouchers.length === 0}
                  onClick={() => handleExecuteBulkStatusUpdate('Rejected')}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject Selected ({selectedVouchers.length})</span>
                </button>

                <button
                  type="button"
                  disabled={selectedVouchers.length === 0}
                  onClick={() => handleExecuteBulkStatusUpdate('Pending')}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-40 disabled:pointer-events-none text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Move selected vouchers to Pending status"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Set Pending</span>
                </button>

                <button
                  type="button"
                  disabled={selectedVouchers.length === 0}
                  onClick={handleBulkDeleteSelected}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-700 border border-slate-600 disabled:opacity-40 disabled:pointer-events-none text-rose-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Permanently delete selected vouchers"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedVouchers.length})</span>
                </button>
              </div>
            </div>

            {/* Multi-Select Ledger Voucher Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 border-b border-slate-200 uppercase text-[11px] font-bold">
                    <tr>
                      <th className="py-3 px-3 w-10">
                        <button
                          type="button"
                          onClick={handleSelectAllFiltered}
                          className="flex items-center justify-center text-slate-700 hover:text-slate-900 cursor-pointer"
                          title="Select / Deselect All Visible Vouchers"
                        >
                          {filteredVouchers.length > 0 &&
                          filteredVouchers.every((v) => selectedIds.includes(v.id)) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-2 w-10 text-center" title="Expand Row Details">
                        <button
                          type="button"
                          onClick={handleToggleExpandAllFiltered}
                          className="inline-flex items-center justify-center text-slate-600 hover:text-slate-950 cursor-pointer"
                          title="Expand / Collapse All Rows"
                        >
                          {filteredVouchers.length > 0 &&
                          filteredVouchers.every((v) =>
                            expandedVoucherIds.includes(v.id)
                          ) ? (
                            <ChevronUp className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-3">Date & Voucher #</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Campus Branch</th>
                      <th className="py-3 px-3">Narration & Line Items</th>
                      <th className="py-3 px-3 text-right">Debit / Credit (PKR)</th>
                      <th className="py-3 px-3">Current Status</th>
                      <th className="py-3 px-4 text-right">Quick Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 px-4 text-center text-slate-500">
                          <div className="max-w-md mx-auto space-y-2">
                            <p className="font-bold text-slate-700">
                              No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} vouchers match the current filter.
                            </p>
                            <p className="text-xs text-slate-500">
                              Click <strong>+ New Voucher</strong> above to record a BPV, BRV, CPV, CRV, or JV voucher, or switch the queue filter to <strong>All Vouchers</strong>.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredVouchers.map((voucher) => {
                        const isSelected = selectedIds.includes(voucher.id);
                        const normStatus = getNormalizedStatus(voucher.status);
                        const campusObj = campuses.find((c) => c.id === voucher.campusId);
                        const isExpanded = expandedVoucherIds.includes(voucher.id);
                        const lineItems = voucher.entries || [];

                        return (
                          <React.Fragment key={voucher.id}>
                            <tr
                              onClick={() => toggleExpandRow(voucher.id)}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50/80 hover:bg-blue-50'
                                  : isExpanded
                                  ? 'bg-indigo-50/40 hover:bg-indigo-50/60'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td
                                className="py-3 px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSelectOne(voucher.id);
                                }}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </td>
                              <td
                                className="py-3 px-2 text-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandRow(voucher.id);
                                }}
                              >
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  aria-label={`Expand transaction line items for ${voucher.voucherNo}`}
                                  className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors cursor-pointer ${
                                    isExpanded
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                  title={
                                    isExpanded
                                      ? 'Collapse transaction line items'
                                      : 'Expand row to view detailed transaction line items'
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                              <td className="py-3 px-3 font-mono">
                                <div className="font-bold text-slate-900">{voucher.voucherNo}</div>
                                <div className="text-[11px] text-slate-500">{voucher.date}</div>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-800">
                                {voucher.voucherType}
                              </td>
                              <td className="py-3 px-3 text-slate-700 font-medium">
                                {campusObj?.name || voucher.campusId}
                              </td>
                              <td className="py-3 px-3 max-w-md">
                                <div className="font-semibold text-slate-900 truncate">
                                  {voucher.narration || 'Official Accounting Voucher'}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                  <span>{lineItems.length} ledger line(s)</span>
                                  <span aria-hidden="true">·</span>
                                  <span>By {voucher.preparedBy || 'Accountant'}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandRow(voucher.id);
                                    }}
                                    className="text-indigo-600 hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <span>
                                      {isExpanded
                                        ? 'Hide Line Items'
                                        : `View ${lineItems.length} Line Item(s)`}
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-3 h-3" />
                                    ) : (
                                      <ChevronDown className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                                {formatPKR(voucher.totalDebit)}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`font-bold ${
                                    normStatus === 'Approved'
                                      ? 'text-emerald-700'
                                      : normStatus === 'Rejected'
                                      ? 'text-rose-600'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {normStatus}
                                </span>
                                {voucher.rejectionReason && normStatus === 'Rejected' && (
                                  <span className="block text-[10px] text-rose-600 truncate max-w-[140px]">
                                    {voucher.rejectionReason}
                                  </span>
                                )}
                              </td>
                              <td
                                className="py-3 px-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center gap-1.5">
                                  {normStatus !== 'Approved' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateVoucherStatus(
                                          voucher.id,
                                          'Approved',
                                          currentUser?.name || 'Administrator',
                                          'Authorized Approver',
                                          batchRemarks || 'Approved from Ledger Queue'
                                        );
                                        showToast('approve', `Approved voucher ${voucher.voucherNo}`);
                                      }}
                                      className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {normStatus !== 'Rejected' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateVoucherStatus(
                                          voucher.id,
                                          'Rejected',
                                          currentUser?.name || 'Administrator',
                                          'Authorized Approver',
                                          batchRemarks || 'Rejected during audit review'
                                        );
                                        showToast('reject', `Rejected voucher ${voucher.voucherNo}`);
                                      }}
                                      className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* EXPANDED INLINE TRANSACTION LINE-ITEMS SUB-TABLE */}
                            {isExpanded && (
                              <tr className="bg-slate-50/95 border-b border-slate-300">
                                <td colSpan={9} className="px-5 py-4">
                                  <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                                    <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono font-black text-emerald-400">
                                          {voucher.voucherNo}
                                        </span>
                                        <span className="text-slate-400">·</span>
                                        <span className="font-bold">
                                          Detailed Double-Entry Transaction Line Items ({lineItems.length})
                                        </span>
                                        {voucher.chequeNo && (
                                          <>
                                            <span className="text-slate-400">·</span>
                                            <span className="font-mono text-amber-300">
                                              Ref / Cheque #: {voucher.chequeNo}
                                            </span>
                                          </>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3 text-[11px] text-slate-300 font-mono">
                                        <span>
                                          Prepared By:{' '}
                                          <strong className="text-white">
                                            {voucher.preparedBy || 'Campus Accountant'}
                                          </strong>
                                        </span>
                                        {voucher.approvedBy && (
                                          <span>
                                            Approved By:{' '}
                                            <strong className="text-emerald-300">
                                              {voucher.approvedBy}
                                            </strong>
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider">
                                            <th className="py-2 px-3 w-12 text-center">Line #</th>
                                            <th className="py-2 px-3 w-28">Account Code</th>
                                            <th className="py-2 px-3">Account Head / Title</th>
                                            <th className="py-2 px-3">Line Narration / Particulars</th>
                                            <th className="py-2 px-3 w-28">Ref / Chq #</th>
                                            <th className="py-2 px-3 w-32 text-right">Debit (Dr PKR)</th>
                                            <th className="py-2 px-3 w-32 text-right">Credit (Cr PKR)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                          {lineItems.map((ent, idx) => {
                                            const dr = Number(ent.debit) || 0;
                                            const cr = Number(ent.credit) || 0;
                                            return (
                                              <tr
                                                key={ent.id || idx}
                                                className="hover:bg-slate-50/80"
                                              >
                                                <td className="py-2 px-3 text-center font-mono text-slate-500">
                                                  {idx + 1}
                                                </td>
                                                <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                                  {ent.accountCode}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-slate-900">
                                                  {ent.accountName}
                                                </td>
                                                <td className="py-2 px-3 text-slate-600">
                                                  {ent.description || voucher.narration || '—'}
                                                </td>
                                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                                  {ent.refCheckNo || voucher.chequeNo || '—'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                                  {dr > 0 ? formatPKR(dr) : '—'}
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                                                  {cr > 0 ? formatPKR(cr) : '—'}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                        <tfoot>
                                          <tr className="bg-slate-100 border-t border-slate-300 font-black text-slate-900">
                                            <td
                                              colSpan={5}
                                              className="py-2 px-3 text-right uppercase text-[11px]"
                                            >
                                              Voucher Double-Entry Totals (Dr = Cr Balanced)
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-emerald-800">
                                              {formatPKR(voucher.totalDebit)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-indigo-800">
                                              {formatPKR(voucher.totalCredit)}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PANEL 2: SUPER ADMIN ROLE & CAMPUS HEAD VISIBILITY CONTROLLER */}
        {activePanel === 'super_admin_visibility' && isSuperAdmin && (
          <div className="p-5 space-y-6">
            {/* Target Role / Campus Selector & Quick Presets */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Configure What To Show To:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTargetScope('administration')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      targetScope === 'administration'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Administration / Finance Controller
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetScope('campus_head')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      targetScope === 'campus_head'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Campus Head / Principal (Default)
                  </button>

                  <select
                    value={
                      targetScope !== 'administration' && targetScope !== 'campus_head'
                        ? targetScope
                        : ''
                    }
                    onChange={(e) => {
                      if (e.target.value) setTargetScope(e.target.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 cursor-pointer"
                    aria-label="Configure Specific Campus Branch Override"
                  >
                    <option value="">Or Specific Campus Branch Override...</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        Campus Override: {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 1-Click Visibility Presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Presets:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('all')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Show Everything (20/20)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('admin_standard')}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Admin Standard
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('campus_head_essential')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Campus Head Essentials
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('accounting_only')}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold cursor-pointer"
                >
                  Vouchers & Petty Cash Only
                </button>
              </div>
            </div>

            {/* Section A: Dashboard Widgets & Top Bar Visibility + Operational Permissions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Widgets & Top Bar Shortcuts */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Dashboard Widgets & Top Bar Shortcuts Visibility
                    </h3>
                    <p className="text-xs text-slate-500">
                      Control which analytics widgets and top bar tools are shown to{' '}
                      <strong>
                        {targetScope === 'administration'
                          ? 'Administration'
                          : targetScope === 'campus_head'
                          ? 'Campus Heads'
                          : campuses.find((c) => c.id === targetScope)?.name}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      key: 'showPettyCashChart' as const,
                      label: 'Recharts Monthly Petty Cash Category Breakdown Chart',
                    },
                    {
                      key: 'showBudgetVarianceWidget' as const,
                      label: 'Departmental Budget Variance Dashboard Widget',
                    },
                    {
                      key: 'showBulkApprovalQueue' as const,
                      label: 'Bulk Pending Voucher Approval & Rejection Queue',
                    },
                    {
                      key: 'showTopBarErpButton' as const,
                      label: 'Top Bar: 360° Modern ERP Suite Shortcut',
                    },
                    {
                      key: 'showTopBarCashReconButton' as const,
                      label: 'Top Bar: Physical Cash Reconciliation Shortcut',
                    },
                    {
                      key: 'showTopBarA4PrintButton' as const,
                      label: 'Top Bar: A4 Voucher Print Studio Shortcut',
                    },
                    {
                      key: 'showTopBarAuditTrailButton' as const,
                      label: 'Top Bar: Forensic Secure Audit Trail Shortcut',
                    },
                  ].map((item) => {
                    const enabled = currentEditingProfile.widgets[item.key];
                    return (
                      <label
                        key={item.key}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() =>
                            updateTargetProfile((prev) => ({
                              ...prev,
                              widgets: {
                                ...prev.widgets,
                                [item.key]: !prev.widgets[item.key],
                              },
                            }))
                          }
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Operational Authority & Ledger Action Permissions */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Ledger Operational Authority & Approval Limits
                    </h3>
                    <p className="text-xs text-slate-500">
                      Control what actions{' '}
                      <strong>
                        {targetScope === 'administration'
                          ? 'Administration'
                          : targetScope === 'campus_head'
                          ? 'Campus Heads'
                          : campuses.find((c) => c.id === targetScope)?.name}
                      </strong>{' '}
                      can execute inside the General Ledger
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      key: 'canBulkApproveReject' as const,
                      label: 'Allow Simultaneous Bulk Approve / Reject Pending Vouchers',
                    },
                    {
                      key: 'canApproveHighValue' as const,
                      label: 'Allow Approving High-Value Vouchers (> Rs. 50,000)',
                    },
                    {
                      key: 'canEditApprovedVouchers' as const,
                      label: 'Allow Editing Previously Approved / Posted Vouchers',
                    },
                    {
                      key: 'canDeleteVouchers' as const,
                      label: 'Allow Deleting Vouchers from General Ledger',
                    },
                    {
                      key: 'canExportData' as const,
                      label: 'Allow Exporting CSV Reports & JSON Ledger Backups',
                    },
                  ].map((perm) => {
                    const enabled = currentEditingProfile.permissions[perm.key];
                    return (
                      <label
                        key={perm.key}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800">{perm.label}</span>
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() =>
                            updateTargetProfile((prev) => ({
                              ...prev,
                              permissions: {
                                ...prev.permissions,
                                [perm.key]: !prev.permissions[perm.key],
                              },
                            }))
                          }
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span>Test these exact rules immediately in the live app:</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleSetPreviewRole(
                        targetScope === 'administration' ? 'administration' : 'campus_head'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Preview as {targetScope === 'administration' ? 'Administration' : 'Campus Head'}
                  </button>
                </div>
              </div>
            </div>

            {/* Section B: Complete 20-Module Sidebar & ERP Visibility Matrix */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Sidebar & ERP Module Visibility Matrix ({currentEditingProfile.modules.length} of{' '}
                    {ALL_SYSTEM_MODULES.length} Modules Shown)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Uncheck any module below to hide it completely from the sidebar and navigation for the selected role or campus head
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(
                  [
                    'Dynamic School ERP Suite',
                    'Daily Operations',
                    'Ledgers & Statements',
                    'Administration & System',
                  ] as const
                ).map((catName) => {
                  const groupModules = ALL_SYSTEM_MODULES.filter((m) => m.category === catName);
                  return (
                    <div
                      key={catName}
                      className="bg-slate-50/70 rounded-xl border border-slate-200 p-3 space-y-2"
                    >
                      <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-200">
                        {catName}
                      </div>
                      <div className="space-y-1.5">
                        {groupModules.map((mod) => {
                          const isShown = currentEditingProfile.modules.includes(mod.id);
                          return (
                            <label
                              key={mod.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                                isShown
                                  ? 'bg-white border-blue-200 text-slate-900 shadow-2xs'
                                  : 'bg-slate-100/70 border-slate-200 text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isShown}
                                onChange={() => handleToggleModuleForTarget(mod.id)}
                                className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold leading-snug">{mod.label}</div>
                                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                  {mod.description}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
