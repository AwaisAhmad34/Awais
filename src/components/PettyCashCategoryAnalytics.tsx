import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  Line,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Plus,
  Download,
  Calendar,
  Building2,
  Layers,
  Wallet,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAccounting, PettyCashTransaction } from '../core/aplusEngine';

export interface PettyCashCategoryMeta {
  key: string;
  label: string;
  shortLabel: string;
  coaCode: string;
  accountCode: string;
  color: string;
}

export const PETTY_CASH_CATEGORIES: PettyCashCategoryMeta[] = [
  {
    key: 'Stationery & Printing',
    label: 'Stationery, Printing & Photocopy',
    shortLabel: 'Stationery & Print',
    coaCode: '500-4-02',
    accountCode: '5014',
    color: '#2563eb', // blue-600
  },
  {
    key: 'Refreshments & Hospitality',
    label: 'Refreshments, Tea & Entertainment',
    shortLabel: 'Refreshments',
    coaCode: '500-4-05',
    accountCode: '5017',
    color: '#d97706', // amber-600
  },
  {
    key: 'Repairs & Maintenance',
    label: 'Minor Repairs, Electrical & Plumbing',
    shortLabel: 'Repairs & Maint.',
    coaCode: '500-6-01',
    accountCode: '5043',
    color: '#dc2626', // red-600
  },
  {
    key: 'Transport & Conveyance',
    label: 'Conveyance, Fuel & Local Rider',
    shortLabel: 'Conveyance & Fuel',
    coaCode: '500-4-08',
    accountCode: '5020',
    color: '#059669', // emerald-600
  },
  {
    key: 'Cleaning & Sanitation',
    label: 'Cleaning, Janitorial & Washroom Supplies',
    shortLabel: 'Janitorial & Clean',
    coaCode: '500-4-06',
    accountCode: '5018',
    color: '#0891b2', // cyan-600
  },
  {
    key: 'Utilities & Postage',
    label: 'Postage, Courier, Internet & Utility Tokens',
    shortLabel: 'Postage & Utility',
    coaCode: '500-4-04',
    accountCode: '5016',
    color: '#7c3aed', // violet-600
  },
  {
    key: 'Lab & Teaching Aids',
    label: 'Science Lab, Art & Classroom Consumables',
    shortLabel: 'Lab & Teaching',
    coaCode: '500-6-07',
    accountCode: '5049',
    color: '#db2777', // pink-600
  },
  {
    key: 'Library & Fixtures',
    label: 'Library Books & Minor Campus Fixtures',
    shortLabel: 'Library & Books',
    coaCode: '100-1-02',
    accountCode: '1002',
    color: '#4f46e5', // indigo-600
  },
  {
    key: 'Medical & Miscellaneous',
    label: 'First Aid Dispensary & General Contingency',
    shortLabel: 'Medical & Misc.',
    coaCode: '500-4-13',
    accountCode: '5025',
    color: '#64748b', // slate-500
  },
];

export function classifyPettyCashCategory(tx: PettyCashTransaction): string {
  const raw = `${tx.category || ''} ${tx.payee || ''} ${tx.narration || ''} ${tx.accountCode || ''}`.toLowerCase();

  // Exact match on our category keys first
  for (const cat of PETTY_CASH_CATEGORIES) {
    if (
      (tx.category && tx.category.toLowerCase() === cat.key.toLowerCase()) ||
      (tx.category && tx.category.toLowerCase() === cat.label.toLowerCase())
    ) {
      return cat.key;
    }
  }

  if (
    raw.includes('stationery') ||
    raw.includes('print') ||
    raw.includes('photocopy') ||
    raw.includes('paper') ||
    raw.includes('toner') ||
    raw.includes('marker') ||
    raw.includes('register') ||
    raw.includes('5014') ||
    raw.includes('5015')
  ) {
    return 'Stationery & Printing';
  }
  if (
    raw.includes('refreshment') ||
    raw.includes('tea') ||
    raw.includes('hospitality') ||
    raw.includes('entertainment') ||
    raw.includes('guest') ||
    raw.includes('lunch') ||
    raw.includes('biscuit') ||
    raw.includes('water') ||
    raw.includes('5017')
  ) {
    return 'Refreshments & Hospitality';
  }
  if (
    raw.includes('repair') ||
    raw.includes('maintenance') ||
    raw.includes('plumb') ||
    raw.includes('electric') ||
    raw.includes('bulb') ||
    raw.includes('switch') ||
    raw.includes('lock') ||
    raw.includes('carpenter') ||
    raw.includes('5043') ||
    raw.includes('5044')
  ) {
    return 'Repairs & Maintenance';
  }
  if (
    raw.includes('transport') ||
    raw.includes('conveyance') ||
    raw.includes('fuel') ||
    raw.includes('petrol') ||
    raw.includes('diesel') ||
    raw.includes('rickshaw') ||
    raw.includes('fare') ||
    raw.includes('rider') ||
    raw.includes('5020') ||
    raw.includes('5048')
  ) {
    return 'Transport & Conveyance';
  }
  if (
    raw.includes('clean') ||
    raw.includes('janitor') ||
    raw.includes('sweep') ||
    raw.includes('soap') ||
    raw.includes('phenyl') ||
    raw.includes('sanit') ||
    raw.includes('broom') ||
    raw.includes('5018')
  ) {
    return 'Cleaning & Sanitation';
  }
  if (
    raw.includes('postage') ||
    raw.includes('courier') ||
    raw.includes('tcs') ||
    raw.includes('leopards') ||
    raw.includes('stamp') ||
    raw.includes('internet') ||
    raw.includes('utility') ||
    raw.includes('gas') ||
    raw.includes('5016') ||
    raw.includes('5008')
  ) {
    return 'Utilities & Postage';
  }
  if (
    raw.includes('lab') ||
    raw.includes('science') ||
    raw.includes('chemical') ||
    raw.includes('art') ||
    raw.includes('chart') ||
    raw.includes('chalk') ||
    raw.includes('sport') ||
    raw.includes('5049') ||
    raw.includes('5050')
  ) {
    return 'Lab & Teaching Aids';
  }
  if (
    raw.includes('library') ||
    raw.includes('book') ||
    raw.includes('furniture') ||
    raw.includes('fixture') ||
    raw.includes('1002') ||
    raw.includes('1003')
  ) {
    return 'Library & Fixtures';
  }
  return 'Medical & Miscellaneous';
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const PettyCashCategoryAnalytics: React.FC<{
  onNavigate?: (tab: string) => void;
  compact?: boolean;
  defaultCollapsed?: boolean;
}> = ({ onNavigate, compact = false, defaultCollapsed = false }) => {
  const {
    pettyCashTransactions,
    campuses,
    currentCampusId,
    setCurrentCampusId,
    addPettyCashTransaction,
    getNextPettyCashNumber,
    logActivity,
  } = useAccounting();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const [chartType, setChartType] = useState<'stacked' | 'donut' | 'trend'>('stacked');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Quick Add Petty Cash Expense Form State
  const [quickDate, setQuickDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [quickCategory, setQuickCategory] = useState<string>(PETTY_CASH_CATEGORIES[0].key);
  const [quickPayee, setQuickPayee] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [quickNarration, setQuickNarration] = useState<string>('');

  // Filter transactions by active campus scope
  const scopedTransactions = useMemo(() => {
    return (pettyCashTransactions || []).filter((tx) => {
      if (currentCampusId !== 'all' && tx.campusId !== currentCampusId) {
        return false;
      }
      return true;
    });
  }, [pettyCashTransactions, currentCampusId]);

  const disbursements = useMemo(
    () => scopedTransactions.filter((tx) => tx.type === 'Disbursement' && Number(tx.amount) > 0),
    [scopedTransactions]
  );

  // Compute all available YYYY-MM months sorted chronologically
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    scopedTransactions.forEach((tx) => {
      if (tx.date && tx.date.length >= 7) {
        monthSet.add(tx.date.slice(0, 7));
      }
    });
    const sorted = Array.from(monthSet).sort();
    return sorted;
  }, [scopedTransactions]);

  // Build Monthly Category Breakdown Data for Recharts BarChart & ComposedChart
  const monthlyChartData = useMemo(() => {
    const monthsToRender =
      selectedMonth === 'ALL'
        ? availableMonths.length > 0
          ? availableMonths
          : [new Date().toISOString().slice(0, 7)]
        : [selectedMonth];

    let runningCumulative = 0;

    return monthsToRender.map((ym) => {
      const row: Record<string, any> = {
        monthKey: ym,
        monthLabel: formatMonthLabel(ym),
        totalDisbursed: 0,
        totalReplenished: 0,
        slipCount: 0,
      };

      PETTY_CASH_CATEGORIES.forEach((cat) => {
        row[cat.key] = 0;
      });

      scopedTransactions.forEach((tx) => {
        const txMonth = (tx.date || '').slice(0, 7);
        if (txMonth !== ym) return;
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'Disbursement' && amt > 0) {
          const catKey = classifyPettyCashCategory(tx);
          row[catKey] = (row[catKey] || 0) + amt;
          row.totalDisbursed += amt;
          row.slipCount += 1;
        } else if ((tx.type === 'Replenishment' || tx.type === 'Opening') && amt > 0) {
          row.totalReplenished += amt;
        }
      });

      runningCumulative += row.totalDisbursed;
      row.cumulativeDisbursed = runningCumulative;
      return row;
    });
  }, [scopedTransactions, availableMonths, selectedMonth]);

  // Build Category Breakdown Summary for PieChart / Donut & KPI Table
  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {};
    PETTY_CASH_CATEGORIES.forEach((c) => {
      totals[c.key] = { amount: 0, count: 0 };
    });

    let grandTotal = 0;
    disbursements.forEach((tx) => {
      if (selectedMonth !== 'ALL' && (tx.date || '').slice(0, 7) !== selectedMonth) {
        return;
      }
      const catKey = classifyPettyCashCategory(tx);
      const amt = Number(tx.amount) || 0;
      if (!totals[catKey]) {
        totals[catKey] = { amount: 0, count: 0 };
      }
      totals[catKey].amount += amt;
      totals[catKey].count += 1;
      grandTotal += amt;
    });

    return PETTY_CASH_CATEGORIES.map((meta) => {
      const stat = totals[meta.key] || { amount: 0, count: 0 };
      const percentage = grandTotal > 0 ? (stat.amount / grandTotal) * 100 : 0;
      return {
        ...meta,
        amount: stat.amount,
        count: stat.count,
        percentage,
        avgSlip: stat.count > 0 ? stat.amount / stat.count : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [disbursements, selectedMonth]);

  const totalSpentInScope = useMemo(
    () => categoryBreakdown.reduce((sum, c) => sum + c.amount, 0),
    [categoryBreakdown]
  );

  const totalSlipsInScope = useMemo(
    () => categoryBreakdown.reduce((sum, c) => sum + c.count, 0),
    [categoryBreakdown]
  );

  const topCategory = useMemo(
    () => categoryBreakdown.find((c) => c.amount > 0) || categoryBreakdown[0],
    [categoryBreakdown]
  );

  const monthlyAverageSpend = useMemo(() => {
    if (monthlyChartData.length === 0) return 0;
    const sum = monthlyChartData.reduce((acc, m) => acc + (m.totalDisbursed || 0), 0);
    return sum / monthlyChartData.length;
  }, [monthlyChartData]);

  const toggleCategoryVisibility = (catKey: string) => {
    setHiddenCategories((prev) =>
      prev.includes(catKey) ? prev.filter((k) => k !== catKey) : [...prev, catKey]
    );
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(quickAmount);
    if (!amt || amt <= 0) return;

    const targetCampusId =
      currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId;
    const catMeta =
      PETTY_CASH_CATEGORIES.find((c) => c.key === quickCategory) || PETTY_CASH_CATEGORIES[0];
    const nextNo = getNextPettyCashNumber(targetCampusId);

    addPettyCashTransaction({
      voucherNo: nextNo,
      trNo: String(scopedTransactions.length + 1),
      campusId: targetCampusId,
      date: quickDate,
      type: 'Disbursement',
      payee: quickPayee.trim() || catMeta.shortLabel,
      category: catMeta.key,
      accountCode: catMeta.accountCode,
      amount: amt,
      narration:
        quickNarration.trim() || `${catMeta.label} petty cash disbursement`,
      receiptNo: `PC-${Date.now().toString().slice(-4)}`,
      approvedBy: 'Campus Accountant',
    });

    logActivity(
      'PETTY_CASH_EXPENSE',
      'PettyCash',
      nextNo,
      `Logged ${formatPKR(amt)} under ${catMeta.key} (${quickDate})`,
      targetCampusId,
      amt
    );

    setQuickAmount('');
    setQuickPayee('');
    setQuickNarration('');
    setShowQuickAdd(false);
    setFeedbackMessage(`Added ${formatPKR(amt)} to ${catMeta.key} (${formatMonthLabel(quickDate.slice(0, 7))})`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleSeedMultiMonthCategories = () => {
    const targetCampusId =
      currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId;
    const sampleDisbursements = [
      {
        date: '2026-04-12',
        category: 'Stationery & Printing',
        payee: 'Al-Madina Books & Paper Mart',
        amount: 14500,
        narration: 'A4 exam paper rims, whiteboard markers & attendance registers',
        accountCode: '5014',
      },
      {
        date: '2026-04-19',
        category: 'Refreshments & Hospitality',
        payee: 'Parent-Teacher Meeting Hospitality',
        amount: 8200,
        narration: 'Tea, mineral water & biscuits for PTM faculty & visiting parents',
        accountCode: '5017',
      },
      {
        date: '2026-05-08',
        category: 'Repairs & Maintenance',
        payee: 'Usman Electrical & Plumbing Works',
        amount: 16800,
        narration: 'Classroom LED tube replacements, ceiling fan capacitors & water cooler tap repair',
        accountCode: '5043',
      },
      {
        date: '2026-05-22',
        category: 'Transport & Conveyance',
        payee: 'Campus Dispatch Rider',
        amount: 9400,
        narration: 'Fuel & local rickshaw conveyance for BISE board registration submissions',
        accountCode: '5020',
      },
      {
        date: '2026-06-10',
        category: 'Cleaning & Sanitation',
        payee: 'Punjab Hygiene & Janitorial Store',
        amount: 11200,
        narration: 'Disinfectant phenyl, liquid handwash, floor mops & washroom sanitizers',
        accountCode: '5018',
      },
      {
        date: '2026-06-24',
        category: 'Utilities & Postage',
        payee: 'TCS Express & PTCL Failover',
        amount: 7600,
        narration: 'Urgent board gazette courier dispatches & backup 4G internet data package',
        accountCode: '5016',
      },
      {
        date: '2026-07-14',
        category: 'Lab & Teaching Aids',
        payee: 'Scientific Apparatus Traders',
        amount: 19500,
        narration: 'Chemistry titration reagents, litmus papers, biology slides & geometry charts',
        accountCode: '5049',
      },
      {
        date: '2026-08-09',
        category: 'Stationery & Printing',
        payee: 'Star Digital Press',
        amount: 18900,
        narration: 'New academic session syllabus booklets, diary covers & fee slip pads',
        accountCode: '5014',
      },
      {
        date: '2026-08-21',
        category: 'Refreshments & Hospitality',
        payee: 'Faculty Orientation Tea',
        amount: 9800,
        narration: 'Refreshments for annual staff orientation seminar & academic audit team',
        accountCode: '5017',
      },
      {
        date: '2026-09-05',
        category: 'Repairs & Maintenance',
        payee: 'CoolTech AC & Generator Service',
        amount: 15400,
        narration: 'Computer lab split AC gas top-up & standby generator oil filter change',
        accountCode: '5043',
      },
      {
        date: '2026-09-18',
        category: 'Medical & Miscellaneous',
        payee: 'Clinix Pharmacy',
        amount: 6500,
        narration: 'Campus dispensary first-aid bandages, antiseptic, ORS & thermometer',
        accountCode: '5025',
      },
    ];

    sampleDisbursements.forEach((item, idx) => {
      addPettyCashTransaction({
        voucherNo: `PCV-CAT-${Date.now().toString().slice(-3)}-${idx + 1}`,
        trNo: String(scopedTransactions.length + idx + 1),
        campusId: targetCampusId,
        date: item.date,
        type: 'Disbursement',
        payee: item.payee,
        category: item.category,
        accountCode: item.accountCode,
        amount: item.amount,
        narration: item.narration,
        receiptNo: `RCP-${401 + idx}`,
        approvedBy: 'Campus Accountant',
      });
    });

    setFeedbackMessage('Populated 11 categorized monthly petty cash slips across Apr–Sep 2026');
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  const handleExportCsv = () => {
    const headers = [
      'Month',
      ...PETTY_CASH_CATEGORIES.map((c) => `"${c.key} (${c.coaCode})"`),
      'Total Monthly Disbursed (PKR)',
      'Total Monthly Replenished (PKR)',
      'Slip Count',
    ];
    const rows = monthlyChartData.map((m) => [
      `"${m.monthLabel}"`,
      ...PETTY_CASH_CATEGORIES.map((c) => Math.round(m[c.key] || 0)),
      Math.round(m.totalDisbursed || 0),
      Math.round(m.totalReplenished || 0),
      m.slipCount || 0,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Monthly_Petty_Cash_By_Category_${currentCampusId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const nonZero = payload
      .filter((p: any) => Number(p.value) > 0)
      .sort((a: any, b: any) => Number(b.value) - Number(a.value));
    const monthTotal = nonZero.reduce((s: number, p: any) => s + Number(p.value || 0), 0);

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[250px]">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
          <span className="font-bold text-slate-100">{label}</span>
          <span className="font-mono font-bold text-emerald-400">{formatPKR(monthTotal)}</span>
        </div>
        {nonZero.length === 0 ? (
          <p className="text-slate-400 py-1">No petty cash spend recorded in {label}</p>
        ) : (
          <div className="space-y-1.5">
            {nonZero.map((entry: any) => {
              const pct = monthTotal > 0 ? ((Number(entry.value) / monthTotal) * 100).toFixed(1) : '0.0';
              return (
                <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color || entry.fill }}
                    />
                    <span className="text-slate-200 truncate">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    <span className="font-semibold text-white">{formatPKR(Number(entry.value))}</span>
                    <span className="text-[10px] text-slate-400 w-10 text-right">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-blue-300 uppercase tracking-wider">
                <span>Imprest Petty Cash Analytics</span>
                <span aria-hidden="true">·</span>
                <span>500-Series COA Category Breakdown</span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Monthly Petty Cash Expenses by Category (Recharts Visualization)
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Campus Selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={currentCampusId}
                onChange={(e) => setCurrentCampusId(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                aria-label="Filter Petty Cash Analytics by Campus"
              >
                <option value="all" className="text-slate-900">
                  All Campuses (Consolidated)
                </option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id} className="text-slate-900">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                aria-label="Filter Petty Cash Analytics by Month"
              >
                <option value="ALL" className="text-slate-900">
                  All Months ({availableMonths.length || 1} Months)
                </option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym} className="text-slate-900">
                    {formatMonthLabel(ym)}
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Mode Segmented Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setChartType('stacked')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  chartType === 'stacked'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Stacked Monthly</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('donut')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  chartType === 'donut'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
                <span>Category Share</span>
              </button>
              <button
                type="button"
                onClick={() => setChartType('trend')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  chartType === 'trend'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Burn vs Replenish</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowQuickAdd((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Expense</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export Monthly Petty Cash Category Matrix to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Recharts Petty Cash Analytics' : 'Collapse Recharts Petty Cash Analytics'}
            >
              <span>{isCollapsed ? 'Expand Chart' : 'Collapse'}</span>
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>

        {/* Feedback Toast */}
        {feedbackMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-900 font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Log Categorized Petty Cash Slip Form */}
        {showQuickAdd && (
          <form
            onSubmit={handleQuickAddSubmit}
            className="bg-slate-50 border-b border-slate-200 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
          >
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Slip Date
              </label>
              <input
                type="date"
                value={quickDate}
                onChange={(e) => setQuickDate(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Expense Category (500-Series COA)
              </label>
              <select
                value={quickCategory}
                onChange={(e) => setQuickCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-800"
              >
                {PETTY_CASH_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.key} ({cat.coaCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Vendor / Payee
              </label>
              <input
                type="text"
                placeholder="e.g. Al-Fatah Stationery"
                value={quickPayee}
                onChange={(e) => setQuickPayee(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Amount (PKR)
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                placeholder="e.g. 4500"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Save to Ledger
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Executive KPI Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/60">
          <div className="p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Petty Cash Disbursed
            </div>
            <div className="mt-1 text-xl font-black text-slate-900 font-mono">
              {formatPKR(totalSpentInScope)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {totalSlipsInScope} verified expense slips ·{' '}
              {selectedMonth === 'ALL' ? `${monthlyChartData.length} active months` : formatMonthLabel(selectedMonth)}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Average Monthly Burn Rate
            </div>
            <div className="mt-1 text-xl font-black text-blue-700 font-mono">
              {formatPKR(monthlyAverageSpend)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Avg slip size:{' '}
              {formatPKR(totalSlipsInScope > 0 ? totalSpentInScope / totalSlipsInScope : 0)}
            </div>
          </div>

          <div className="p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Highest Spend Category
            </div>
            <div className="mt-1 text-base font-black text-slate-900 truncate">
              {topCategory?.key || '—'}
            </div>
            <div className="mt-0.5 text-xs text-slate-600 font-mono">
              {formatPKR(topCategory?.amount || 0)} ({(topCategory?.percentage || 0).toFixed(1)}% of spend)
            </div>
          </div>

          <div className="p-4 flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Categories Tracked
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-700 font-mono">
                {categoryBreakdown.filter((c) => c.amount > 0).length} / {PETTY_CASH_CATEGORIES.length}
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('pettycash')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Register</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Linked to 500-Series Expense Heads
            </div>
          </div>
        </div>

        {/* Main Visualization Grid */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Interactive Recharts Canvas */}
          <div className="lg:col-span-8 bg-slate-50/50 rounded-xl border border-slate-200/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {chartType === 'stacked' &&
                    'Monthly Petty Cash Expenditure Stacked by Category (PKR)'}
                  {chartType === 'donut' &&
                    'Proportional Petty Cash Expense Share by Category'}
                  {chartType === 'trend' &&
                    'Monthly Petty Cash Disbursements vs Imprest Replenishments'}
                </h3>
                <p className="text-xs text-slate-500">
                  Click any category filter button below to isolate or compare specific expense heads
                </p>
              </div>
            </div>

            {/* Category Interactive Filter Bar */}
            {chartType === 'stacked' && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {PETTY_CASH_CATEGORIES.map((cat) => {
                  const isHidden = hiddenCategories.includes(cat.key);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => toggleCategoryVisibility(cat.key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        isHidden
                          ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
                          : 'bg-white text-slate-800 border-slate-300 shadow-2xs'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: isHidden ? '#94a3b8' : cat.color }}
                      />
                      <span>{cat.shortLabel}</span>
                    </button>
                  );
                })}
                {hiddenCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHiddenCategories([])}
                    className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* Recharts Container */}
            <div className={compact ? 'h-[300px] w-full' : 'h-[360px] w-full'}>
              {chartType === 'stacked' && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomMonthlyTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                      iconType="square"
                    />
                    {PETTY_CASH_CATEGORIES.filter(
                      (cat) => !hiddenCategories.includes(cat.key)
                    ).map((cat) => (
                      <Bar
                        key={cat.key}
                        dataKey={cat.key}
                        name={cat.shortLabel}
                        stackId="pettycash"
                        fill={cat.color}
                        radius={[2, 2, 0, 0]}
                        maxBarSize={54}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}

              {chartType === 'donut' && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.filter((c) => c.amount > 0)}
                      dataKey="amount"
                      nameKey="key"
                      cx="50%"
                      cy="50%"
                      innerRadius={compact ? 65 : 80}
                      outerRadius={compact ? 105 : 128}
                      paddingAngle={2}
                      label={({ shortLabel, percentage }: any) =>
                        percentage >= 4 ? `${shortLabel}: ${percentage.toFixed(1)}%` : ''
                      }
                      labelLine={false}
                    >
                      {categoryBreakdown
                        .filter((c) => c.amount > 0)
                        .map((entry) => (
                          <Cell key={entry.key} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [formatPKR(Number(value)), name]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {chartType === 'trend' && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyChartData}
                    margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                      tick={{ fontSize: 11, fill: '#475569' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [formatPKR(Number(value)), name]}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area
                      type="monotone"
                      dataKey="totalReplenished"
                      name="Imprest Replenished (PKR)"
                      fill="#10b981"
                      fillOpacity={0.18}
                      stroke="#059669"
                      strokeWidth={2}
                    />
                    <Bar
                      dataKey="totalDisbursed"
                      name="Monthly Disbursed (PKR)"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeDisbursed"
                      name="Cumulative Spend (PKR)"
                      stroke="#d97706"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#d97706' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right 4 Columns: Ranked Category Ledger Table */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Category Spend Breakdown
                </span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-500">
                {selectedMonth === 'ALL' ? 'All Months' : formatMonthLabel(selectedMonth)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[385px] overflow-y-auto">
              {categoryBreakdown.map((cat) => (
                <div
                  key={cat.key}
                  className="px-4 py-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {cat.key}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          COA {cat.coaCode} · {cat.count} {cat.count === 1 ? 'slip' : 'slips'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-slate-900 font-mono">
                        {formatPKR(cat.amount)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {cat.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(cat.amount > 0 ? 3 : 0, cat.percentage))}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-300">TOTAL CATEGORIZED</span>
              <span className="font-black text-emerald-400 text-sm">
                {formatPKR(totalSpentInScope)}
              </span>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </section>
  );
};
