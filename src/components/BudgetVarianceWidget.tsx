import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Download,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Building2,
  Layers,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import {
  saveDepartmentBudgetsToCloud,
  loadDepartmentBudgetsFromCloud,
} from '../services/firebaseSync';

export interface DepartmentDefinition {
  deptCode: string;
  groupCode: string;
  departmentName: string;
  groupName: string;
  headRange: string;
  defaultAnnualBudget: number;
}

export const INSTITUTIONAL_DEPARTMENTS: DepartmentDefinition[] = [
  {
    deptCode: 'DEPT-01',
    groupCode: '500-1',
    departmentName: 'Human Resources & Faculty Payroll',
    groupName: 'Salaries & Staff Benefits Expenses',
    headRange: '5001 – 5004',
    defaultAnnualBudget: 6500000,
  },
  {
    deptCode: 'DEPT-02',
    groupCode: '500-2',
    departmentName: 'Campus Facilities & Utilities',
    groupName: 'Utilities & Communication Expenses',
    headRange: '5005 – 5009',
    defaultAnnualBudget: 1450000,
  },
  {
    deptCode: 'DEPT-03',
    groupCode: '500-3',
    departmentName: 'Estates, Building & Campus Leases',
    groupName: 'Rent, Rates & Building Occupancy',
    headRange: '5010 – 5012',
    defaultAnnualBudget: 2400000,
  },
  {
    deptCode: 'DEPT-04',
    groupCode: '500-4',
    departmentName: 'Academic Operations & Administration',
    groupName: 'General Administrative & Operational Expenses',
    headRange: '5013 – 5030',
    defaultAnnualBudget: 1850000,
  },
  {
    deptCode: 'DEPT-05',
    groupCode: '500-5',
    departmentName: 'Admissions, Marketing & Events',
    groupName: 'Marketing, Advertising & Student Events',
    headRange: '5031 – 5042',
    defaultAnnualBudget: 950000,
  },
  {
    deptCode: 'DEPT-06',
    groupCode: '500-6',
    departmentName: 'Maintenance, IT & Transport Fleet',
    groupName: 'Repairs, Maintenance & Lab Consumables',
    headRange: '5043 – 5053',
    defaultAnnualBudget: 1100000,
  },
  {
    deptCode: 'DEPT-07',
    groupCode: '500-7',
    departmentName: 'Student Welfare, Financial Aid & Banking',
    groupName: 'Financial, Fee Concessions & Welfare Charges',
    headRange: '5054 – 5058',
    defaultAnnualBudget: 650000,
  },
  {
    deptCode: 'DEPT-08',
    groupCode: '500-8',
    departmentName: 'Capital Assets & Depreciation Control',
    groupName: 'Depreciation & Amortization Expenses',
    headRange: '5059 – 5063',
    defaultAnnualBudget: 750000,
  },
  {
    deptCode: 'DEPT-09',
    groupCode: '500-9',
    departmentName: 'Taxation, Legal & Statutory Compliance',
    groupName: 'Taxation & Statutory Levies',
    headRange: '5064 – 5065',
    defaultAnnualBudget: 450000,
  },
];

const STORAGE_KEY = 'aplus_department_budgets_v1';

export const BudgetVarianceWidget: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const {
    accountHeads,
    transactions,
    pettyCashTransactions,
    campuses,
    currentCampusId,
    currentUser,
    isSuperAdmin,
    logActivity,
  } = useAccounting() as any;

  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    !isSuperAdmin && currentUser?.campusId
      ? currentUser.campusId
      : currentCampusId || 'all'
  );

  useEffect(() => {
    if (!isSuperAdmin && currentUser?.campusId) {
      setSelectedCampusId(currentUser.campusId);
    } else if (currentCampusId) {
      setSelectedCampusId(currentCampusId);
    }
  }, [currentCampusId, isSuperAdmin, currentUser]);

  const [horizon, setHorizon] = useState<'annual' | 'quarterly' | 'monthly'>(
    'annual'
  );
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'OVER_BUDGET' | 'NEAR_LIMIT' | 'FAVORABLE'
  >('ALL');
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [isEditingBudgets, setIsEditingBudgets] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [annualBudgets, setAnnualBudgets] = useState<Record<string, number>>(
    () => {
      const defaults: Record<string, number> = {};
      INSTITUTIONAL_DEPARTMENTS.forEach((d) => {
        defaults[d.groupCode] = d.defaultAnnualBudget;
      });
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return { ...defaults, ...JSON.parse(raw) };
        }
      } catch {}
      return defaults;
    }
  );

  useEffect(() => {
    loadDepartmentBudgetsFromCloud().then((remote) => {
      if (remote && typeof remote === 'object') {
        setAnnualBudgets((prev) => {
          const merged = { ...prev, ...remote };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
    });
  }, []);

  // Map any expense accountHead to one of the 9 Departmental Groups (500-1 .. 500-9)
  const resolveDeptGroupCode = (head: any): string => {
    if (head?.groupCode && head.groupCode.startsWith('500-')) {
      return head.groupCode;
    }
    if (head?.code && head.code.startsWith('500-')) {
      const parts = head.code.split('-');
      if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
    }
    const numId = parseInt(String(head?.accountId || head?.code || '').replace(/\D/g, ''), 10);
    if (numId >= 5001 && numId <= 5004) return '500-1';
    if (numId >= 5005 && numId <= 5009) return '500-2';
    if (numId >= 5010 && numId <= 5012) return '500-3';
    if (numId >= 5013 && numId <= 5030) return '500-4';
    if (numId >= 5031 && numId <= 5042) return '500-5';
    if (numId >= 5043 && numId <= 5053) return '500-6';
    if (numId >= 5054 && numId <= 5058) return '500-7';
    if (numId >= 5059 && numId <= 5063) return '500-8';
    if (numId >= 5064 && numId <= 5065) return '500-9';
    return '500-4';
  };

  // Compute Departmental Actual vs. Budgeted Expenses from the live Ledger
  const departmentRows = useMemo(() => {
    const horizonDivisor =
      horizon === 'monthly' ? 12 : horizon === 'quarterly' ? 4 : 1;
    const campusScale =
      selectedCampusId === 'all'
        ? 1
        : 1 / Math.max(1, (campuses || []).length || 4);

    // Index all Expense account heads
    const expenseHeads = (accountHeads || []).filter(
      (h: any) => h.category === 'Expense' || String(h.mainCode) === '500'
    );
    const headByIdOrCode = new Map<string, any>();
    expenseHeads.forEach((h: any) => {
      if (h.id) headByIdOrCode.set(h.id, h);
      if (h.code) headByIdOrCode.set(h.code, h);
      if (h.accountId) headByIdOrCode.set(h.accountId, h);
    });

    // Track per-head actual spend from posted vouchers + base ledger balances
    const headSpendMap = new Map<string, number>();
    expenseHeads.forEach((h: any) => {
      const baseBal =
        selectedCampusId === 'all'
          ? Number(h.balance) || 0
          : Number(h.campusBalances?.[selectedCampusId]) ||
            Math.round((Number(h.balance) || 0) * campusScale);
      headSpendMap.set(h.id, Math.max(0, Math.round(baseBal / horizonDivisor)));
    });

    // Add live Voucher Debit/Credit movements for expense accounts
    const activeVouchers = (transactions || []).filter((tx: any) => {
      if (tx.status === 'Rejected' || tx.status === 'Cancelled') return false;
      if (selectedCampusId !== 'all' && tx.campusId !== selectedCampusId) {
        return false;
      }
      return true;
    });

    const voucherHitsByGroup: Record<string, number> = {};

    activeVouchers.forEach((tx: any) => {
      (tx.entries || []).forEach((ent: any) => {
        const matchedHead =
          headByIdOrCode.get(ent.accountId) ||
          headByIdOrCode.get(ent.accountCode);
        if (matchedHead) {
          const netExpense = (Number(ent.debit) || 0) - (Number(ent.credit) || 0);
          if (netExpense !== 0) {
            const grp = resolveDeptGroupCode(matchedHead);
            voucherHitsByGroup[grp] = (voucherHitsByGroup[grp] || 0) + 1;
            const prev = headSpendMap.get(matchedHead.id) || 0;
            headSpendMap.set(matchedHead.id, Math.max(0, prev + netExpense));
          }
        }
      });
    });

    // Also include Petty Cash disbursements mapped to expense heads or categories
    (pettyCashTransactions || []).forEach((pc: any) => {
      if (pc.type !== 'Disbursement') return;
      if (selectedCampusId !== 'all' && pc.campusId !== selectedCampusId) return;
      const matchedHead =
        headByIdOrCode.get(pc.accountId) || headByIdOrCode.get(pc.accountCode);
      if (matchedHead) {
        const prev = headSpendMap.get(matchedHead.id) || 0;
        headSpendMap.set(matchedHead.id, prev + (Number(pc.amount) || 0));
      }
    });

    return INSTITUTIONAL_DEPARTMENTS.map((dept) => {
      const deptHeads = expenseHeads
        .filter((h: any) => resolveDeptGroupCode(h) === dept.groupCode)
        .map((h: any) => ({
          id: h.id,
          code: h.code,
          accountId: h.accountId || h.code,
          name: h.name,
          actual: headSpendMap.get(h.id) || 0,
        }))
        .sort((a: any, b: any) => b.actual - a.actual);

      const actualExpense = deptHeads.reduce(
        (sum: number, h: any) => sum + h.actual,
        0
      );

      const rawAnnualBudget =
        annualBudgets[dept.groupCode] ?? dept.defaultAnnualBudget;
      const budgetedExpense = Math.max(
        1,
        Math.round((rawAnnualBudget * campusScale) / horizonDivisor)
      );

      // Variance = Budget - Actual (Positive = Under Budget / Favorable, Negative = Over Budget / Unfavorable)
      const varianceAmount = budgetedExpense - actualExpense;
      const utilizationPct = Number(
        ((actualExpense / budgetedExpense) * 100).toFixed(1)
      );

      let status: 'OVER_BUDGET' | 'NEAR_LIMIT' | 'FAVORABLE' = 'FAVORABLE';
      if (utilizationPct > 100) status = 'OVER_BUDGET';
      else if (utilizationPct >= 85) status = 'NEAR_LIMIT';

      return {
        ...dept,
        rawAnnualBudget,
        budgetedExpense,
        actualExpense,
        varianceAmount,
        utilizationPct,
        status,
        headsCount: deptHeads.length,
        voucherHits: voucherHitsByGroup[dept.groupCode] || 0,
        heads: deptHeads,
      };
    });
  }, [
    accountHeads,
    transactions,
    pettyCashTransactions,
    selectedCampusId,
    campuses,
    horizon,
    annualBudgets,
  ]);

  const filteredDepartments = useMemo(() => {
    if (statusFilter === 'ALL') return departmentRows;
    return departmentRows.filter((d) => d.status === statusFilter);
  }, [departmentRows, statusFilter]);

  const totals = useMemo(() => {
    const totalBudget = departmentRows.reduce(
      (s, d) => s + d.budgetedExpense,
      0
    );
    const totalActual = departmentRows.reduce((s, d) => s + d.actualExpense, 0);
    const totalVariance = totalBudget - totalActual;
    const overallUtilization =
      totalBudget > 0 ? Number(((totalActual / totalBudget) * 100).toFixed(1)) : 0;
    const overBudgetCount = departmentRows.filter(
      (d) => d.status === 'OVER_BUDGET'
    ).length;
    const nearLimitCount = departmentRows.filter(
      (d) => d.status === 'NEAR_LIMIT'
    ).length;
    const favorableCount = departmentRows.filter(
      (d) => d.status === 'FAVORABLE'
    ).length;

    return {
      totalBudget,
      totalActual,
      totalVariance,
      overallUtilization,
      overBudgetCount,
      nearLimitCount,
      favorableCount,
    };
  }, [departmentRows]);

  const handleSaveBudgets = async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(annualBudgets));
    } catch {}
    await saveDepartmentBudgetsToCloud(annualBudgets);
    setIsEditingBudgets(false);
    logActivity(
      'BUDGET_UPDATE',
      'System',
      'DEPT-BUDGETS',
      `Updated departmental annual expense budget allocations across 9 institutional departments (Total Annual Budget: PKR ${Object.values(
        annualBudgets
      )
        .reduce((a, b) => a + Number(b || 0), 0)
        .toLocaleString()})`,
      selectedCampusId
    );
    setSavedNotice(
      'Departmental budget allocations saved and synced to Firebase Firestore!'
    );
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleResetDefaultBudgets = () => {
    const defaults: Record<string, number> = {};
    INSTITUTIONAL_DEPARTMENTS.forEach((d) => {
      defaults[d.groupCode] = d.defaultAnnualBudget;
    });
    setAnnualBudgets(defaults);
  };

  const handleExportCsv = () => {
    const headers = [
      'Dept Code',
      'COA Group Code',
      'Department Name',
      'COA Expense Group',
      'Account Range',
      'Budgeted Expense (PKR)',
      'Actual Ledger Expense (PKR)',
      'Variance (Budget - Actual PKR)',
      'Utilization %',
      'Status',
    ];
    const rows = departmentRows.map((d) =>
      [
        `"${d.deptCode}"`,
        `"${d.groupCode}"`,
        `"${d.departmentName}"`,
        `"${d.groupName}"`,
        `"${d.headRange}"`,
        d.budgetedExpense,
        d.actualExpense,
        d.varianceAmount,
        `${d.utilizationPct}%`,
        `"${d.status}"`,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `APLUS_Department_Budget_Variance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 mb-8 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden">
        {/* Top Widget Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>
                LIVE 500-SERIES EXPENSE LEDGER • DEPARTMENTAL BUDGET VARIANCE MONITOR
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              Departmental Budget vs. Actual Expense Variance Analysis
            </h2>
            <p className="text-xs text-slate-300">
              Real-time comparison of posted ledger expenses (`500-1` to `500-9` / IDs `5001`–`5065`) against institutional department budgets
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Horizon Selector */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
              {(['annual', 'quarterly', 'monthly'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                    horizon === h
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>

            {/* Campus Selector */}
            <select
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              disabled={!isSuperAdmin}
              className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white cursor-pointer disabled:opacity-60"
            >
              <option value="all">All Campuses (Consolidated)</option>
              {(campuses || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsEditingBudgets((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isEditingBudgets
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isEditingBudgets ? 'Cancel Edit' : 'Configure Budgets'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Executive KPI Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/70">
          <div className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Allocated Budget ({horizon})
            </div>
            <div className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
              PKR {totals.totalBudget.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across 9 Institutional Departments (`500-1`–`500-9`)
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Actual Ledger Expenses
            </div>
            <div className="text-xl font-black font-mono tabular-nums text-blue-700 mt-1">
              PKR {totals.totalActual.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Overall Utilization: <strong>{totals.overallUtilization}%</strong>
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net Budget Variance
            </div>
            <div
              className={`text-xl font-black font-mono tabular-nums mt-1 ${
                totals.totalVariance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {totals.totalVariance >= 0 ? '+' : ''}PKR{' '}
              {totals.totalVariance.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {totals.totalVariance >= 0
                ? 'Favorable (Under Budget Savings)'
                : 'Unfavorable (Net Budget Overrun)'}
            </div>
          </div>

          <div className="p-4 flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Departmental Health Filter
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                All (9)
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('FAVORABLE')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'FAVORABLE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                On Track ({totals.favorableCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('NEAR_LIMIT')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'NEAR_LIMIT'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                Near Limit ({totals.nearLimitCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OVER_BUDGET')}
                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                  statusFilter === 'OVER_BUDGET'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                Overrun ({totals.overBudgetCount})
              </button>
            </div>
          </div>
        </div>

        {/* Optional Inline Annual Budget Editor Toolbar */}
        {isEditingBudgets && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-amber-950 font-semibold">
              <strong>Budget Configuration Mode:</strong> Edit the Annual Departmental Budgets (PKR) in the table below, then click <strong>Save Budgets to Cloud</strong>.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaultBudgets}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Budgets to Cloud</span>
              </button>
            </div>
          </div>
        )}

        {/* Departmental Variance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] divide-x divide-slate-200">
                <th className="py-3 px-4">Department & COA Expense Group</th>
                <th className="py-3 px-3 w-28 text-center">COA Group</th>
                <th className="py-3 px-3 w-36 text-right font-mono">
                  Budgeted (PKR)
                </th>
                <th className="py-3 px-3 w-36 text-right font-mono">
                  Actual Spend (PKR)
                </th>
                <th className="py-3 px-3 w-40 text-right font-mono">
                  Variance (PKR)
                </th>
                <th className="py-3 px-4 w-52">Budget Utilization</th>
                <th className="py-3 px-3 w-32 text-center">Variance Status</th>
                <th className="py-3 px-2.5 w-16 text-center">Heads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDepartments.map((dept) => {
                const isExpanded = expandedDept === dept.groupCode;
                const barWidth = Math.min(100, Math.max(2, dept.utilizationPct));
                const barColor =
                  dept.status === 'OVER_BUDGET'
                    ? 'bg-rose-600'
                    : dept.status === 'NEAR_LIMIT'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600';

                return (
                  <React.Fragment key={dept.groupCode}>
                    <tr
                      onClick={() =>
                        setExpandedDept(isExpanded ? null : dept.groupCode)
                      }
                      className="hover:bg-slate-50/90 divide-x divide-slate-100 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 text-xs">
                          {dept.departmentName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {dept.groupName} · IDs {dept.headRange} ({dept.headsCount}{' '}
                          heads)
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono">
                        <div className="font-bold text-slate-900">
                          {dept.groupCode}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {dept.deptCode}
                        </div>
                      </td>

                      <td
                        className="py-3 px-3 text-right font-mono font-bold text-slate-800 tabular-nums"
                        onClick={(e) => isEditingBudgets && e.stopPropagation()}
                      >
                        {isEditingBudgets ? (
                          <input
                            type="number"
                            min={0}
                            step={10000}
                            value={annualBudgets[dept.groupCode] || 0}
                            onChange={(e) =>
                              setAnnualBudgets((prev) => ({
                                ...prev,
                                [dept.groupCode]: Math.max(
                                  0,
                                  Number(e.target.value)
                                ),
                              }))
                            }
                            className="w-32 px-2 py-1 border border-amber-400 rounded bg-white text-right font-mono font-bold text-slate-900"
                          />
                        ) : (
                          dept.budgetedExpense.toLocaleString()
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black text-blue-900 tabular-nums">
                        {dept.actualExpense.toLocaleString()}
                      </td>

                      <td
                        className={`py-3 px-3 text-right font-mono font-black tabular-nums ${
                          dept.varianceAmount >= 0
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {dept.varianceAmount >= 0 ? (
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          <span>
                            {dept.varianceAmount >= 0 ? '+' : ''}
                            {dept.varianceAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] font-normal text-slate-500">
                          {dept.varianceAmount >= 0 ? 'Remaining' : 'Overrun'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                          <span className="font-bold text-slate-800">
                            {dept.utilizationPct}%
                          </span>
                          <span className="text-slate-500">of budget</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-[11px]">
                        {dept.status === 'OVER_BUDGET' ? (
                          <span className="text-rose-700 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Over Budget</span>
                          </span>
                        ) : dept.status === 'NEAR_LIMIT' ? (
                          <span className="text-amber-700 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Near Limit</span>
                          </span>
                        ) : (
                          <span className="text-emerald-700 flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Favorable</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2.5 text-center text-slate-500">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 mx-auto text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 mx-auto" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Drill-Down of Individual Account Heads in this Department */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90">
                        <td colSpan={8} className="p-4 border-b border-slate-300">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="text-xs font-black text-slate-900">
                              Ledger Account Head Breakdown — {dept.departmentName} (
                              {dept.groupCode})
                            </div>
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate('accounts')}
                                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                View in Chart of Accounts →
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {dept.heads.map((h: any) => (
                              <div
                                key={h.id}
                                className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-[11px] font-mono font-bold text-blue-800">
                                    {h.code}{' '}
                                    {h.accountId !== h.code
                                      ? `[ID: ${h.accountId}]`
                                      : ''}
                                  </div>
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {h.name}
                                  </div>
                                </div>
                                <div className="text-right font-mono font-bold text-slate-900 shrink-0 tabular-nums">
                                  PKR {h.actual.toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-black text-slate-900 divide-x divide-slate-300">
                <td colSpan={2} className="py-3 px-4 text-right uppercase">
                  Total Departmental Expense Budget vs. Actual:
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  PKR {totals.totalBudget.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right font-mono text-blue-950 tabular-nums">
                  PKR {totals.totalActual.toLocaleString()}
                </td>
                <td
                  className={`py-3 px-3 text-right font-mono tabular-nums ${
                    totals.totalVariance >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {totals.totalVariance >= 0 ? '+' : ''}PKR{' '}
                  {totals.totalVariance.toLocaleString()}
                </td>
                <td className="py-3 px-4 font-mono">
                  {totals.overallUtilization}% Total Utilization
                </td>
                <td colSpan={2} className="py-3 px-3 text-center">
                  {totals.totalVariance >= 0 ? 'WITHIN BUDGET' : 'NET OVERRUN'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
