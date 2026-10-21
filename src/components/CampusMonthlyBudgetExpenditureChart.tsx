import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Download,
  Calendar,
  Filter,
  ArrowUpDown,
  RefreshCw,
  Edit3,
  Layers,
  Save,
  Info,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useAccounting, Campus, Transaction } from '../core/aplusEngine';

export interface CampusMonthlyBudgetExpenditureChartProps {
  campuses?: Campus[];
  transactions?: Transaction[];
  initialMonth?: string;
  onCampusSelect?: (campusId: string) => void;
  className?: string;
  standalone?: boolean;
}

export interface CampusBudgetComparativeMetric {
  campusId: string;
  campusCode: string;
  campusName: string;
  shortName: string;
  isMainCampus: boolean;
  clientId?: string;
  monthlyBudget: number;
  actualExpenditure: number;
  varianceAmount: number; // monthlyBudget - actualExpenditure (positive = surplus/under budget, negative = deficit/over budget)
  utilizationRate: number; // percentage (actualExpenditure / monthlyBudget * 100)
  status: 'within_budget' | 'near_limit' | 'over_budget';
  voucherCount: number;
  topExpenseHead?: string;
}

const STORAGE_KEY_CAMPUS_BUDGETS = 'aplus_campus_monthly_budget_limits_v1';

// Standard realistic default monthly budgets based on campus tier & scale
export const DEFAULT_CAMPUS_MONTHLY_BUDGETS: Record<string, number> = {
  'campus-main': 1250000,
  'campus-khiali': 680000,
  'campus-c2': 550000,
  'campus-c3': 480000,
  'campus-apex-main': 1150000,
  'campus-apex-c2': 580000,
  'campus-apex-c3': 520000,
};

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

function formatCompactPKR(val: number): string {
  if (Math.abs(val) >= 1000000) {
    return `Rs. ${(val / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(val) >= 1000) {
    return `Rs. ${(val / 1000).toFixed(0)}k`;
  }
  return `Rs. ${Math.round(val)}`;
}

export const CampusMonthlyBudgetExpenditureChart: React.FC<CampusMonthlyBudgetExpenditureChartProps> = ({
  campuses: propCampuses,
  transactions: propTransactions,
  initialMonth,
  onCampusSelect,
  className = '',
  standalone = false,
}) => {
  const accounting = useAccounting();
  const campuses = propCampuses || accounting.campuses || [];
  const transactions = propTransactions || accounting.transactions || [];
  const pettyCashTransactions = accounting.pettyCashTransactions || [];
  const currentUser = accounting.currentUser;

  // Selected Month (YYYY-MM format)
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'comparison' | 'variance' | 'utilization'>('comparison');
  const [sortBy, setSortBy] = useState<'expenditure_desc' | 'budget_desc' | 'utilization_desc' | 'variance_asc' | 'name'>('expenditure_desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'over_budget' | 'near_limit' | 'within_budget'>('all');
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const [includePettyCash, setIncludePettyCash] = useState<boolean>(true);

  // Budget editing modal state
  const [isEditingBudgets, setIsEditingBudgets] = useState<boolean>(false);
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CAMPUS_BUDGETS);
      if (stored) {
        return { ...DEFAULT_CAMPUS_MONTHLY_BUDGETS, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    return { ...DEFAULT_CAMPUS_MONTHLY_BUDGETS };
  });

  const [tempBudgets, setTempBudgets] = useState<Record<string, number>>({});

  // Save updated budget limits
  const handleSaveBudgetLimits = () => {
    const updated = { ...budgetLimits, ...tempBudgets };
    setBudgetLimits(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CAMPUS_BUDGETS, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist budget limits:', e);
    }
    setIsEditingBudgets(false);
  };

  // Available distinct months in transactions
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    monthSet.add(currentMonthStr);

    transactions.forEach((tx) => {
      if (tx.date) {
        const ym = tx.date.substring(0, 7);
        if (ym.match(/^\d{4}-\d{2}$/)) {
          monthSet.add(ym);
        }
      }
    });

    return Array.from(monthSet).sort().reverse();
  }, [transactions, currentMonthStr]);

  // Compute expenditures and metrics per campus for selected month
  const campusMetrics = useMemo<CampusBudgetComparativeMetric[]>(() => {
    return campuses.map((campus) => {
      // Find campus transactions in selected month
      const campusMonthTx = transactions.filter((tx) => {
        if (tx.campusId !== campus.id) return false;
        if (selectedMonth !== 'all' && (!tx.date || !tx.date.startsWith(selectedMonth))) {
          return false;
        }
        return true;
      });

      // Calculate actual expense from transactions
      // 1. CPV (Cash Payment) & BPV (Bank Payment) are direct expenditure vouchers
      // 2. Debits against expense heads (group 5xx / 5001-5065)
      let totalExpense = 0;
      let count = 0;
      const headExpenseMap: Record<string, number> = {};

      campusMonthTx.forEach((tx) => {
        // If entries exist, sum debits to expense accounts or debits in CPV/BPV
        if (tx.entries && tx.entries.length > 0) {
          let txExp = 0;
          tx.entries.forEach((e) => {
            const isExpenseHead =
              e.accountCode?.startsWith('5') ||
              e.accountName?.toLowerCase().includes('expense') ||
              tx.voucherType === 'CPV' ||
              tx.voucherType === 'BPV';

            if (isExpenseHead && Number(e.debit) > 0) {
              const debit = Number(e.debit);
              txExp += debit;
              const hName = e.accountName || e.accountCode || 'General Expense';
              headExpenseMap[hName] = (headExpenseMap[hName] || 0) + debit;
            }
          });

          if (txExp > 0) {
            totalExpense += txExp;
            count++;
          } else if (tx.voucherType === 'CPV' || tx.voucherType === 'BPV') {
            totalExpense += Number(tx.totalDebit || tx.totalCredit || 0);
            count++;
          }
        } else if (tx.voucherType === 'CPV' || tx.voucherType === 'BPV') {
          totalExpense += Number(tx.totalDebit || tx.totalCredit || 0);
          count++;
        }
      });

      // Include petty cash disbursements if toggled on
      if (includePettyCash) {
        const campusPetty = pettyCashTransactions.filter((pt) => {
          if (pt.campusId !== campus.id) return false;
          if (pt.type !== 'Disbursement') return false;
          if (selectedMonth !== 'all' && (!pt.date || !pt.date.startsWith(selectedMonth))) {
            return false;
          }
          return true;
        });

        campusPetty.forEach((pt) => {
          const amt = Number(pt.amount || 0);
          totalExpense += amt;
          count++;
          const cat = pt.category || 'Petty Cash Operating';
          headExpenseMap[cat] = (headExpenseMap[cat] || 0) + amt;
        });
      }

      // Budget limit for this campus
      const monthlyBudget =
        budgetLimits[campus.id] ||
        (campus.isMainCampus ? 1200000 : 550000);

      const varianceAmount = monthlyBudget - totalExpense;
      const utilizationRate =
        monthlyBudget > 0
          ? Math.round((totalExpense / monthlyBudget) * 1000) / 10
          : 0;

      let status: CampusBudgetComparativeMetric['status'] = 'within_budget';
      if (utilizationRate > 100) {
        status = 'over_budget';
      } else if (utilizationRate >= 85) {
        status = 'near_limit';
      }

      // Find top expense head
      let topExpenseHead = 'Operating Activities';
      let maxHeadVal = 0;
      Object.entries(headExpenseMap).forEach(([h, val]) => {
        if (val > maxHeadVal) {
          maxHeadVal = val;
          topExpenseHead = h;
        }
      });

      return {
        campusId: campus.id,
        campusCode: campus.code,
        campusName: campus.name,
        shortName: campus.shortName || campus.code,
        isMainCampus: !!campus.isMainCampus,
        clientId: campus.clientId,
        monthlyBudget,
        actualExpenditure: totalExpense,
        varianceAmount,
        utilizationRate,
        status,
        voucherCount: count,
        topExpenseHead,
      };
    });
  }, [campuses, transactions, pettyCashTransactions, selectedMonth, budgetLimits, includePettyCash]);

  // Network aggregated statistics
  const summaryKPIs = useMemo(() => {
    let filtered = campusMetrics;
    if (selectedClientFilter !== 'all') {
      filtered = filtered.filter((m) => m.clientId === selectedClientFilter);
    }

    const totalBudget = filtered.reduce((s, m) => s + m.monthlyBudget, 0);
    const totalExpenditure = filtered.reduce((s, m) => s + m.actualExpenditure, 0);
    const netVariance = totalBudget - totalExpenditure;
    const avgUtilization =
      totalBudget > 0 ? Math.round((totalExpenditure / totalBudget) * 1000) / 10 : 0;

    const overBudgetCampuses = filtered.filter((m) => m.status === 'over_budget');
    const nearLimitCampuses = filtered.filter((m) => m.status === 'near_limit');
    const withinBudgetCampuses = filtered.filter((m) => m.status === 'within_budget');

    const highestSpender = [...filtered].sort((a, b) => b.actualExpenditure - a.actualExpenditure)[0];
    const highestUtilization = [...filtered].sort((a, b) => b.utilizationRate - a.utilizationRate)[0];

    return {
      totalBudget,
      totalExpenditure,
      netVariance,
      avgUtilization,
      overBudgetCount: overBudgetCampuses.length,
      nearLimitCount: nearLimitCampuses.length,
      withinBudgetCount: withinBudgetCampuses.length,
      highestSpender,
      highestUtilization,
      totalCampuses: filtered.length,
    };
  }, [campusMetrics, selectedClientFilter]);

  // Filtered and sorted chart dataset
  const chartData = useMemo(() => {
    let list = [...campusMetrics];

    // Client filter
    if (selectedClientFilter !== 'all') {
      list = list.filter((m) => m.clientId === selectedClientFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((m) => m.status === statusFilter);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'expenditure_desc') return b.actualExpenditure - a.actualExpenditure;
      if (sortBy === 'budget_desc') return b.monthlyBudget - a.monthlyBudget;
      if (sortBy === 'utilization_desc') return b.utilizationRate - a.utilizationRate;
      if (sortBy === 'variance_asc') return a.varianceAmount - b.varianceAmount;
      return a.campusName.localeCompare(b.campusName);
    });

    return list.map((item) => ({
      ...item,
      // Friendly label for X-axis
      displayName: item.shortName || item.campusName.replace(/School System|Campus/gi, '').trim(),
    }));
  }, [campusMetrics, selectedClientFilter, statusFilter, sortBy]);

  // Selected campus drill-down details
  const activeDrilldown = useMemo(() => {
    if (!selectedCampusId) return null;
    return campusMetrics.find((m) => m.campusId === selectedCampusId) || null;
  }, [campusMetrics, selectedCampusId]);

  // Export CSV summary
  const handleExportCSV = () => {
    const headers = [
      'Campus Code',
      'Campus Name',
      'Client Org',
      'Selected Month',
      'Monthly Budget Limit (PKR)',
      'Actual Expenditure (PKR)',
      'Variance Surplus/Deficit (PKR)',
      'Utilization Rate (%)',
      'Budget Status',
      'Recorded Vouchers',
      'Top Expense Category',
    ];

    const rows = chartData.map((d) => [
      `"${d.campusCode}"`,
      `"${d.campusName}"`,
      `"${d.clientId || 'N/A'}"`,
      `"${selectedMonth}"`,
      d.monthlyBudget,
      d.actualExpenditure,
      d.varianceAmount,
      `${d.utilizationRate}%`,
      `"${d.status.toUpperCase()}"`,
      d.voucherCount,
      `"${d.topExpenseHead || 'Operating'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `campus_monthly_expenditure_vs_budget_${selectedMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden ${className}`}
    >
      {/* ==================================================================== */}
      {/* HEADER & EXECUTIVE TOOLBAR                                           */}
      {/* ==================================================================== */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <BarChart className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">
                  Comparative Monthly Expenditures vs Budget Limits
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Recharts Analytics Hub
                </span>
                {summaryKPIs.overBudgetCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{summaryKPIs.overBudgetCount} Campus Over Budget</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time comparative analysis of posted general ledger expenditures against approved monthly budget thresholds across all campuses.
              </p>
            </div>
          </div>

          {/* Quick Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="comp-month-select" className="text-slate-400 text-[11px] font-medium">Month:</label>
              <select
                id="comp-month-select"
                aria-label="Select Billing & Reporting Month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-slate-900 text-white">All Recorded Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {new Date(m + '-01').toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>

            {/* Adjust Budgets Button */}
            <button
              type="button"
              onClick={() => {
                setTempBudgets({ ...budgetLimits });
                setIsEditingBudgets(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="Configure and save monthly budget caps per campus"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Set Budget Limits</span>
            </button>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="Download CSV report of monthly expenditures vs budgets"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* EXECUTIVE KPI SUMMARY CARDS                                        */}
        {/* ================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          {/* Card 1: Total Multi-Campus Budget */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Budget Limit
            </span>
            <span className="text-base sm:text-lg font-black text-indigo-300 block mt-1">
              {formatCompactPKR(summaryKPIs.totalBudget)}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Across {summaryKPIs.totalCampuses} campuses
            </span>
          </div>

          {/* Card 2: Total Actual Expenditure */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Actual Expenditure
            </span>
            <span className="text-base sm:text-lg font-black text-white block mt-1">
              {formatCompactPKR(summaryKPIs.totalExpenditure)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              CPV, BPV & Expenses
            </span>
          </div>

          {/* Card 3: Net Variance (Surplus / Deficit) */}
          <div
            className={`p-3.5 rounded-2xl border ${
              summaryKPIs.netVariance >= 0
                ? 'bg-emerald-950/20 border-emerald-900/40'
                : 'bg-rose-950/20 border-rose-900/40'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Net Surplus / Deficit
            </span>
            <span
              className={`text-base sm:text-lg font-black block mt-1 ${
                summaryKPIs.netVariance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {summaryKPIs.netVariance >= 0 ? '+' : ''}
              {formatCompactPKR(summaryKPIs.netVariance)}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {summaryKPIs.netVariance >= 0 ? 'Within budget limit' : 'Over allocated budget'}
            </span>
          </div>

          {/* Card 4: Overall Burn Rate */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Network Burn Rate
            </span>
            <span
              className={`text-base sm:text-lg font-black block mt-1 ${
                summaryKPIs.avgUtilization > 100
                  ? 'text-rose-400'
                  : summaryKPIs.avgUtilization >= 85
                  ? 'text-amber-400'
                  : 'text-indigo-400'
              }`}
            >
              {summaryKPIs.avgUtilization}%
            </span>
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  summaryKPIs.avgUtilization > 100
                    ? 'bg-rose-500'
                    : summaryKPIs.avgUtilization >= 85
                    ? 'bg-amber-400'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, summaryKPIs.avgUtilization)}%` }}
              />
            </div>
          </div>

          {/* Card 5: Highest Spender */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Highest Spending Campus
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-200 block mt-1 truncate">
              {summaryKPIs.highestSpender?.shortName || summaryKPIs.highestSpender?.campusName || 'N/A'}
            </span>
            <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
              {formatCompactPKR(summaryKPIs.highestSpender?.actualExpenditure || 0)}
            </span>
          </div>

          {/* Card 6: Over-Budget Alerts */}
          <div
            className={`p-3.5 rounded-2xl border ${
              summaryKPIs.overBudgetCount > 0
                ? 'bg-rose-950/30 border-rose-900/50'
                : 'bg-emerald-950/20 border-emerald-900/40'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Compliance Status
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {summaryKPIs.overBudgetCount > 0 ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-xs font-black text-rose-300">
                    {summaryKPIs.overBudgetCount} Over Budget
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-black text-emerald-300">
                    All Within Cap
                  </span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {summaryKPIs.nearLimitCount} near 85% limit
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* FILTER & CHART CONTROLS BAR                                          */}
      {/* ==================================================================== */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Client filter if multi-client platform admin */}
          {(!currentUser?.clientId || currentUser?.role === 'level_1_platform_super_admin' || currentUser?.role === 'admin') && (
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <label htmlFor="comp-client-select" className="text-slate-400 text-[11px]">Client:</label>
              <select
                id="comp-client-select"
                aria-label="Filter by School Client System"
                value={selectedClientFilter}
                onChange={(e) => setSelectedClientFilter(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-white">All Client Networks</option>
                <option value="client-aplus" className="bg-slate-900 text-white">Aplus School System</option>
                <option value="client-apex" className="bg-slate-900 text-white">Apex School System</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <label htmlFor="comp-status-select" className="text-slate-400 text-[11px]">Status:</label>
            <select
              id="comp-status-select"
              aria-label="Filter by Budget Utilization Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">All Campuses</option>
              <option value="over_budget" className="bg-slate-900 text-rose-400">Over Budget (&gt;100%)</option>
              <option value="near_limit" className="bg-slate-900 text-amber-400">Near Limit (&ge;85%)</option>
              <option value="within_budget" className="bg-slate-900 text-emerald-400">Within Budget (&lt;85%)</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <label htmlFor="comp-sort-select" className="text-slate-400 text-[11px]">Sort:</label>
            <select
              id="comp-sort-select"
              aria-label="Sort Campuses By Metric"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="expenditure_desc" className="bg-slate-900 text-white">Highest Expenditure</option>
              <option value="budget_desc" className="bg-slate-900 text-white">Highest Budget Limit</option>
              <option value="utilization_desc" className="bg-slate-900 text-white">Highest Utilization %</option>
              <option value="variance_asc" className="bg-slate-900 text-white">Deficit / Over-budget first</option>
              <option value="name" className="bg-slate-900 text-white">Campus Name (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Include Petty Cash Toggle */}
          <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePettyCash}
              onChange={(e) => setIncludePettyCash(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
            />
            <span className="text-[11px]">Include Petty Cash Expenses</span>
          </label>

          {/* Chart Display Mode Tabs */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('comparison')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'comparison'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Side-by-Side (PKR)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('utilization')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'utilization'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Burn Rate (%)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('variance')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'variance'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Surplus / Deficit
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* RECHARTS COMPARATIVE BAR CHART CONTAINER                              */}
      {/* ==================================================================== */}
      <div className="p-5 sm:p-6 bg-slate-950/90">
        {chartData.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-500 gap-2 border border-dashed border-slate-800 rounded-2xl">
            <AlertTriangle className="w-8 h-8 text-slate-600" />
            <p className="text-sm font-semibold">No campuses match the selected criteria.</p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSelectedClientFilter('all');
              }}
              className="text-xs text-indigo-400 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {viewMode === 'comparison' ? (
                  /* Mode 1: Comparative Double Bars (Expenditure vs Budget) */
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 25, left: 20, bottom: 45 }}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length > 0) {
                        const cid = e.activePayload[0].payload.campusId;
                        setSelectedCampusId(cid);
                        if (onCampusSelect) onCampusSelect(cid);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={formatCompactPKR}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as CampusBudgetComparativeMetric;
                          const isOver = data.status === 'over_budget';
                          const isNear = data.status === 'near_limit';
                          return (
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl text-xs space-y-2 min-w-56 text-white">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-black text-sm text-indigo-300">
                                  {data.campusName}
                                </span>
                                {data.isMainCampus && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                                    Main Campus
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Monthly Budget Limit:</span>
                                  <span className="font-mono font-bold text-indigo-400">
                                    {formatPKR(data.monthlyBudget)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Actual Expenditure:</span>
                                  <span className="font-mono font-bold text-white">
                                    {formatPKR(data.actualExpenditure)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Net Variance:</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      data.varianceAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {data.varianceAmount >= 0 ? '+' : ''}
                                    {formatPKR(data.varianceAmount)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Utilization Rate:</span>
                                  <span
                                    className={`font-mono font-bold ${
                                      isOver
                                        ? 'text-rose-400'
                                        : isNear
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {data.utilizationRate}%
                                  </span>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                                <span>{data.voucherCount} Vouchers Recorded</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                    isOver
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : isNear
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {data.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 600 }}
                      formatter={(val) => (
                        <span className="text-slate-300 font-semibold">{val}</span>
                      )}
                    />
                    <Bar
                      dataKey="monthlyBudget"
                      name="Monthly Budget Limit"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="actualExpenditure"
                      name="Actual Monthly Expenditure"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    >
                      {chartData.map((entry, index) => {
                        let barFill = '#10b981'; // within budget (emerald)
                        if (entry.status === 'over_budget') {
                          barFill = '#f43f5e'; // over budget (rose)
                        } else if (entry.status === 'near_limit') {
                          barFill = '#f59e0b'; // near limit (amber)
                        }
                        return <Cell key={`cell-${index}`} fill={barFill} />;
                      })}
                    </Bar>
                  </BarChart>
                ) : viewMode === 'utilization' ? (
                  /* Mode 2: Burn Rate Percentage (%) with 100% threshold reference line */
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 25, left: 20, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={(val) => `${val}%`}
                      domain={[0, (dataMax: number) => Math.max(120, Math.ceil(dataMax / 10) * 10)]}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Budget Burn Rate']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '1rem',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      y={100}
                      stroke="#f43f5e"
                      strokeDasharray="4 4"
                      label={{
                        value: '100% Budget Ceiling',
                        fill: '#f43f5e',
                        position: 'top',
                        fontSize: 10,
                        fontWeight: 'bold',
                      }}
                    />
                    <ReferenceLine
                      y={85}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: '85% Warning Limit',
                        fill: '#f59e0b',
                        position: 'top',
                        fontSize: 10,
                      }}
                    />
                    <Bar
                      dataKey="utilizationRate"
                      name="Budget Burn Rate (%)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    >
                      {chartData.map((entry, index) => {
                        let fill = '#10b981';
                        if (entry.utilizationRate > 100) fill = '#f43f5e';
                        else if (entry.utilizationRate >= 85) fill = '#f59e0b';
                        return <Cell key={`cell-util-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                ) : (
                  /* Mode 3: Net Surplus / Deficit Variance (PKR) */
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 25, left: 20, bottom: 45 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="displayName"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={formatCompactPKR}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatPKR(Number(val)), 'Net Variance']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '1rem',
                        color: '#f8fafc',
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Bar
                      dataKey="varianceAmount"
                      name="Net Variance (Surplus / Deficit)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-var-${index}`}
                          fill={entry.varianceAmount >= 0 ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Chart Legend Guide */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                  <span>Approved Monthly Budget Limit</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span>Actual Spend Within Budget (&lt;85%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span>Near Limit (&ge;85%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span>Over Budget Ceiling (&gt;100%)</span>
                </span>
              </div>
              <span className="text-[11px] text-slate-500 italic">
                Tip: Click any bar or table row to inspect campus expense distribution
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* DETAILED COMPARATIVE BREAKDOWN TABLE                                 */}
      {/* ==================================================================== */}
      <div className="p-5 sm:p-6 border-t border-slate-800 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Campus Expenditure vs Budget Audit Ledger</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown by campus showing approved limits, actual disbursement totals, variance, and status.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800">
            Reporting Month: <span className="text-indigo-300">{selectedMonth}</span>
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Campus Name & Code</th>
                <th className="py-3 px-4">Monthly Budget Limit</th>
                <th className="py-3 px-4">Actual Expenditure</th>
                <th className="py-3 px-4">Remaining / Deficit</th>
                <th className="py-3 px-4">Burn Rate (%)</th>
                <th className="py-3 px-4">Top Cost Category</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {chartData.map((campus) => {
                const isSelected = selectedCampusId === campus.campusId;
                return (
                  <tr
                    key={campus.campusId}
                    onClick={() => {
                      const newId = isSelected ? null : campus.campusId;
                      setSelectedCampusId(newId);
                      if (onCampusSelect && newId) onCampusSelect(newId);
                    }}
                    className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-950/30 border-l-4 border-indigo-500' : ''
                    }`}
                  >
                    {/* Campus info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{campus.campusName}</span>
                        {campus.isMainCampus && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                            Main Branch
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        Code: {campus.campusCode} • {campus.voucherCount} transactions
                      </span>
                    </td>

                    {/* Monthly Budget */}
                    <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                      {formatPKR(campus.monthlyBudget)}
                    </td>

                    {/* Actual Expenditure */}
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {formatPKR(campus.actualExpenditure)}
                    </td>

                    {/* Remaining / Deficit */}
                    <td className="py-3 px-4 font-mono font-bold">
                      <span
                        className={
                          campus.varianceAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {campus.varianceAmount >= 0 ? '+' : ''}
                        {formatPKR(campus.varianceAmount)}
                      </span>
                    </td>

                    {/* Burn Rate with bar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-xs ${
                            campus.utilizationRate > 100
                              ? 'text-rose-400'
                              : campus.utilizationRate >= 85
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {campus.utilizationRate}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              campus.utilizationRate > 100
                                ? 'bg-rose-500'
                                : campus.utilizationRate >= 85
                                ? 'bg-amber-400'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, campus.utilizationRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Top Cost Category */}
                    <td className="py-3 px-4 text-slate-400 truncate max-w-44">
                      {campus.topExpenseHead || 'Operating Expenses'}
                    </td>

                    {/* Status badge */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          campus.status === 'over_budget'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : campus.status === 'near_limit'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {campus.status === 'over_budget' && <AlertTriangle className="w-3 h-3" />}
                        {campus.status === 'within_budget' && <CheckCircle2 className="w-3 h-3" />}
                        <span>{campus.status.replace('_', ' ')}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* CAMPUS DRILLDOWN DRAWER (if a campus is clicked)                     */}
      {/* ==================================================================== */}
      {activeDrilldown && (
        <div className="p-5 sm:p-6 bg-slate-950 border-t border-indigo-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <h4 className="text-sm font-black text-white">
                Detailed Spend Drilldown: <span className="text-indigo-300">{activeDrilldown.campusName}</span> ({activeDrilldown.campusCode})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCampusId(null)}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Close Drilldown &times;
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Monthly Budget Allocation</span>
              <p className="text-base font-black text-indigo-400 font-mono">{formatPKR(activeDrilldown.monthlyBudget)}</p>
              <p className="text-[11px] text-slate-500">Configured operational threshold</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Month Total Expenditure</span>
              <p className="text-base font-black text-white font-mono">{formatPKR(activeDrilldown.actualExpenditure)}</p>
              <p className="text-[11px] text-slate-500">From {activeDrilldown.voucherCount} posted vouchers</p>
            </div>

            <div
              className={`p-4 rounded-xl border space-y-1 ${
                activeDrilldown.varianceAmount >= 0
                  ? 'bg-emerald-950/20 border-emerald-900/50'
                  : 'bg-rose-950/20 border-rose-900/50'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase">Operating Headroom</span>
              <p
                className={`text-base font-black font-mono ${
                  activeDrilldown.varianceAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeDrilldown.varianceAmount >= 0 ? '+' : ''}
                {formatPKR(activeDrilldown.varianceAmount)}
              </p>
              <p className="text-[11px] text-slate-400">
                {activeDrilldown.status === 'over_budget'
                  ? 'Warning: Campus exceeded approved monthly ceiling!'
                  : 'Operating comfortably within financial limit'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: EDIT MONTHLY BUDGET LIMITS PER CAMPUS                         */}
      {/* ==================================================================== */}
      {isEditingBudgets && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white tracking-tight">
                  Configure Campus Monthly Budget Limits
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingBudgets(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Set the monthly expense ceiling (in PKR) for each campus. These thresholds dynamically drive the comparative Recharts bar chart, burn rate calculations, and automated over-budget alerts.
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {campuses.map((campus) => {
                const currentVal =
                  tempBudgets[campus.id] !== undefined
                    ? tempBudgets[campus.id]
                    : budgetLimits[campus.id] || (campus.isMainCampus ? 1200000 : 550000);

                return (
                  <div
                    key={campus.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800"
                  >
                    <div>
                      <span className="font-bold text-xs text-white block">
                        {campus.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Code: {campus.code} {campus.isMainCampus ? '• Main Campus' : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">PKR</span>
                      <input
                        type="number"
                        step={10000}
                        min={0}
                        value={currentVal}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setTempBudgets((prev) => ({
                            ...prev,
                            [campus.id]: val,
                          }));
                        }}
                        className="w-36 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xs text-white text-right outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setTempBudgets({ ...DEFAULT_CAMPUS_MONTHLY_BUDGETS });
                }}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Reset to Defaults
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingBudgets(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBudgetLimits}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Budget Limits</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
