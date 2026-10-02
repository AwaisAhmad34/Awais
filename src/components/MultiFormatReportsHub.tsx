import React, { useState, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Building2,
  CheckCircle2,
  Star,
  Layers,
  BookOpen,
  Columns,
  Table,
  FileCheck2,
  Wallet,
  Award,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  useAccounting,
  generateElementPdf,
  printOrDownloadElement,
  SchoolLogo,
} from '../core/aplusEngine';
import {
  DynamicReportSignatureBlock,
  ReportSignatureConfigPanel,
  RelevantReportKey,
} from './ReportSignatureManager';

export type ReportFormatId =
  | 'format_1_main'
  | 'format_2_executive_board'
  | 'format_3_daily_daybook'
  | 'format_4_t_account'
  | 'format_5_10col_worksheet'
  | 'format_6_monthly_matrix'
  | 'format_7_voucher_books'
  | 'format_8_campus_columnar'
  | 'format_9_expense_pettycash'
  | 'format_10_audit_certificate';

interface FormatDefinition {
  id: ReportFormatId;
  number: number;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  isMain?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export const TEN_REPORT_FORMATS: FormatDefinition[] = [
  {
    id: 'format_1_main',
    number: 1,
    shortTitle: '1. ★ Main Format (Current Standard)',
    fullTitle: 'Format 1 (MAIN): Official Institutional Standard Report Suite',
    subtitle:
      'Our primary institutional format with Custom Master Report, All Ledgers, 8-Col Trial Balance, P&L, Balance Sheet & 6-Signature Block',
    isMain: true,
    icon: Star,
  },
  {
    id: 'format_2_executive_board',
    number: 2,
    shortTitle: '2. Executive Board Summary',
    fullTitle: 'Format 2: Executive Board & Trustee Financial Digest',
    subtitle:
      'Condensed CFO Board presentation with Net Surplus KPIs, Category Breakdown & Key Ratios',
    icon: BarChart3,
  },
  {
    id: 'format_3_daily_daybook',
    number: 3,
    shortTitle: '3. Daily Daybook Scroll',
    fullTitle: 'Format 3: Chronological Daily Daybook & Cash/Bank Scroll',
    subtitle:
      'Date-ordered register of every voucher entry with daily debit/credit totals and running net movement',
    icon: Clock,
  },
  {
    id: 'format_4_t_account',
    number: 4,
    shortTitle: '4. T-Account (Dr | Cr Split)',
    fullTitle: 'Format 4: Classic Horizontal Two-Sided T-Account Ledger (Debit Left | Credit Right)',
    subtitle:
      'Traditional side-by-side Debit (Dr) and Credit (Cr) T-Account sheets per account head',
    icon: Columns,
  },
  {
    id: 'format_5_10col_worksheet',
    number: 5,
    shortTitle: '5. 10-Column Audit Worksheet',
    fullTitle: 'Format 5: 10-Column Statutory Auditor Working Paper',
    subtitle:
      'Opening Dr/Cr, Period Movement Dr/Cr, Closing Trial Balance Dr/Cr, Income Statement (P&L) & Balance Sheet columns',
    icon: Table,
  },
  {
    id: 'format_6_monthly_matrix',
    number: 6,
    shortTitle: '6. Month-Wise Matrix',
    fullTitle: 'Format 6: Month-by-Month Revenue & Expenditure Comparative Matrix',
    subtitle:
      'Cross-tabulated monthly financial performance across operating months with row and column totals',
    icon: Calendar,
  },
  {
    id: 'format_7_voucher_books',
    number: 7,
    shortTitle: '7. 5-Voucher Books Register',
    fullTitle: 'Format 7: Segregated Five-Voucher Books (BPV · BRV · CPV · CRV · JV)',
    subtitle:
      'Dedicated schedules for Bank Payment, Bank Receipt, Cash Payment, Cash Receipt & Journal Books',
    icon: BookOpen,
  },
  {
    id: 'format_8_campus_columnar',
    number: 8,
    shortTitle: '8. Multi-Campus Columnar',
    fullTitle: 'Format 8: Side-by-Side Multi-Campus Comparative Columnar Statement',
    subtitle:
      'Every campus branch displayed as a dedicated column alongside consolidated institutional totals',
    icon: Building2,
  },
  {
    id: 'format_9_expense_pettycash',
    number: 9,
    shortTitle: '9. Expense & Petty Cash',
    fullTitle: 'Format 9: Departmental Expense & Petty Cash Imprest Utilization Schedule',
    subtitle:
      'Combined Operating Expense ledger heads (500-series) and Petty Cash imprest register with float status',
    icon: Wallet,
  },
  {
    id: 'format_10_audit_certificate',
    number: 10,
    shortTitle: '10. Statutory Audit Certificate',
    fullTitle: 'Format 10: Single-Page Statutory Audit Certificate & Group Control Summary',
    subtitle:
      'Executive control totals by Main Account Group (100–500) with formal External & Internal Audit Certification',
    icon: Award,
  },
];

function formatNum(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PK');
}

export const MultiFormatReportsHub: React.FC<{
  LegacyReportsHub: React.ComponentType<any>;
}> = ({ LegacyReportsHub }) => {
  const {
    accountHeads,
    transactions,
    pettyCashTransactions,
    campuses,
    currentCampusId,
    setCurrentCampusId,
    orgSettings,
    activePeriod,
    getAccountOpeningDrCr,
  } = useAccounting();

  const [selectedFormat, setSelectedFormat] = useState<ReportFormatId>('format_1_main');
  const [dateFrom, setDateFrom] = useState<string>(() => activePeriod?.startDate || '2026-07-01');
  const [dateTo, setDateTo] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [selectedTAccountId, setSelectedTAccountId] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const activeFormatObj =
    TEN_REPORT_FORMATS.find((f) => f.id === selectedFormat) || TEN_REPORT_FORMATS[0];

  const campusLabel =
    currentCampusId === 'all'
      ? 'All Campuses Combined (Consolidated)'
      : campuses.find((c) => c.id === currentCampusId)?.name || 'Selected Campus';

  // Scoped transactions for Formats 2–10
  const scopedVouchers = useMemo(() => {
    return (transactions || [])
      .filter((tx) => {
        if (currentCampusId !== 'all' && tx.campusId !== currentCampusId) return false;
        const d = (tx.date || '').slice(0, 10);
        if (dateFrom && d && d < dateFrom) return false;
        if (dateTo && d && d > dateTo) return false;
        return tx.status !== 'Rejected';
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [transactions, currentCampusId, dateFrom, dateTo]);

  const scopedPettyCash = useMemo(() => {
    return (pettyCashTransactions || []).filter((pc) => {
      if (currentCampusId !== 'all' && pc.campusId !== currentCampusId) return false;
      const d = (pc.date || '').slice(0, 10);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      return true;
    });
  }, [pettyCashTransactions, currentCampusId, dateFrom, dateTo]);

  // Compute Account-Level Movements & Balances for Formats 2–10
  const accountAnalytics = useMemo(() => {
    return (accountHeads || []).map((head) => {
      let openDr = 0;
      let openCr = 0;
      if (getAccountOpeningDrCr) {
        const op = getAccountOpeningDrCr(head, currentCampusId);
        openDr = Number(op?.debit) || 0;
        openCr = Number(op?.credit) || 0;
      }

      let periodDr = 0;
      let periodCr = 0;
      const drEntries: { date: string; voucherNo: string; narration: string; amount: number }[] = [];
      const crEntries: { date: string; voucherNo: string; narration: string; amount: number }[] = [];

      scopedVouchers.forEach((tx) => {
        (tx.entries || []).forEach((ent) => {
          const isMatch =
            ent.accountId === head.id ||
            ent.accountCode === head.code ||
            ent.accountCode === head.accountId;
          if (isMatch) {
            const dr = Number(ent.debit) || 0;
            const cr = Number(ent.credit) || 0;
            if (dr > 0) {
              periodDr += dr;
              drEntries.push({
                date: tx.date,
                voucherNo: tx.voucherNo,
                narration: ent.description || tx.narration || '',
                amount: dr,
              });
            }
            if (cr > 0) {
              periodCr += cr;
              crEntries.push({
                date: tx.date,
                voucherNo: tx.voucherNo,
                narration: ent.description || tx.narration || '',
                amount: cr,
              });
            }
          }
        });
      });

      const netDrCr = openDr + periodDr - (openCr + periodCr);
      const closingDr = netDrCr > 0 ? netDrCr : 0;
      const closingCr = netDrCr < 0 ? Math.abs(netDrCr) : 0;

      const isPL = head.category === 'Revenue' || head.category === 'Expense';
      const isBS =
        head.category === 'Asset' ||
        head.category === 'Liability' ||
        head.category === 'Equity';

      return {
        head,
        openDr,
        openCr,
        periodDr,
        periodCr,
        closingDr,
        closingCr,
        plDr: isPL ? closingDr : 0,
        plCr: isPL ? closingCr : 0,
        bsDr: isBS ? closingDr : 0,
        bsCr: isBS ? closingCr : 0,
        drEntries,
        crEntries,
        hasActivity:
          openDr > 0 || openCr > 0 || periodDr > 0 || periodCr > 0,
      };
    });
  }, [accountHeads, scopedVouchers, currentCampusId, getAccountOpeningDrCr]);

  const activeAccountRows = useMemo(() => {
    const active = accountAnalytics.filter((a) => a.hasActivity);
    return active.length > 0 ? active : accountAnalytics.slice(0, 25);
  }, [accountAnalytics]);

  const totals = useMemo(() => {
    let openDr = 0,
      openCr = 0,
      periodDr = 0,
      periodCr = 0,
      closingDr = 0,
      closingCr = 0,
      revenue = 0,
      expense = 0,
      assets = 0,
      liabilities = 0,
      equity = 0;

    accountAnalytics.forEach((row) => {
      openDr += row.openDr;
      openCr += row.openCr;
      periodDr += row.periodDr;
      periodCr += row.periodCr;
      closingDr += row.closingDr;
      closingCr += row.closingCr;

      if (row.head.category === 'Revenue') {
        revenue += Math.max(0, row.closingCr - row.closingDr);
      } else if (row.head.category === 'Expense') {
        expense += Math.max(0, row.closingDr - row.closingCr);
      } else if (row.head.category === 'Asset') {
        assets += Math.max(0, row.closingDr - row.closingCr);
      } else if (row.head.category === 'Liability') {
        liabilities += Math.max(0, row.closingCr - row.closingDr);
      } else if (row.head.category === 'Equity') {
        equity += Math.max(0, row.closingCr - row.closingDr);
      }
    });

    return {
      openDr,
      openCr,
      periodDr,
      periodCr,
      closingDr,
      closingCr,
      revenue,
      expense,
      netSurplus: revenue - expense,
      assets,
      liabilities,
      equity,
    };
  }, [accountAnalytics]);

  // Month list for Format 6
  const monthColumns = useMemo(() => {
    const monthsMap = new Map<string, string>();
    scopedVouchers.forEach((tx) => {
      const ym = (tx.date || '').slice(0, 7);
      if (ym) {
        const [y, m] = ym.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        const label = dateObj.toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
        monthsMap.set(ym, label);
      }
    });
    if (monthsMap.size === 0) {
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthsMap.set(ym, label);
      }
    }
    return Array.from(monthsMap.entries()).map(([ym, label]) => ({ ym, label }));
  }, [scopedVouchers]);

  const handlePrintFormat = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const res = await printOrDownloadElement(printRef.current, {
        title: `${activeFormatObj.fullTitle} (${dateFrom} to ${dateTo})`,
        orientation:
          selectedFormat === 'format_5_10col_worksheet' ||
          selectedFormat === 'format_6_monthly_matrix' ||
          selectedFormat === 'format_8_campus_columnar'
            ? 'landscape'
            : 'portrait',
        fallbackFileName: `Report_Format_${activeFormatObj.number}_${dateFrom}_to_${dateTo}`,
        scale: 2.2,
      });
      setToastMsg(res.message);
      setTimeout(() => setToastMsg(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdfFormat = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const fileName = `APlus_Format_${activeFormatObj.number}_${activeFormatObj.shortTitle
        .replace(/[^a-zA-Z0-9]/g, '_')}_${dateFrom}_to_${dateTo}.pdf`;
      await generateElementPdf(
        printRef.current,
        fileName,
        selectedFormat === 'format_5_10col_worksheet' ||
          selectedFormat === 'format_6_monthly_matrix' ||
          selectedFormat === 'format_8_campus_columnar'
          ? 'landscape'
          : 'portrait',
        2.2,
        {
          addPageNumbers: true,
          margin: 6,
          docTitle: activeFormatObj.fullTitle,
          institutionName: orgSettings?.schoolName || 'A+ School System',
        }
      );
      setToastMsg(`Exported PDF for ${activeFormatObj.shortTitle}`);
      setTimeout(() => setToastMsg(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsvFormat = () => {
    let csv = `"${orgSettings?.schoolName || 'A+ School System'} - ${activeFormatObj.fullTitle}"\n`;
    csv += `"Campus: ${campusLabel}","Period: ${dateFrom} to ${dateTo}"\n\n`;
    csv += `"Account Code","Account Title","Category","Opening Dr","Opening Cr","Period Dr","Period Cr","Closing Dr","Closing Cr"\n`;
    activeAccountRows.forEach((r) => {
      csv += `"${r.head.code}","${r.head.name.replace(/"/g, '""')}","${r.head.category}","${r.openDr}","${r.openCr}","${r.periodDr}","${r.periodCr}","${r.closingDr}","${r.closingCr}"\n`;
    });
    csv += `"TOTAL","CONSOLIDATED TOTALS","","${totals.openDr}","${totals.openCr}","${totals.periodDr}","${totals.periodCr}","${totals.closingDr}","${totals.closingCr}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report_Format_${activeFormatObj.number}_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Dynamic Signature Footer powered by Super Admin & Campus Signature Controller
  const OfficialSignatureFooter = () => (
    <DynamicReportSignatureBlock
      reportKey={selectedFormat as RelevantReportKey}
      docRef={`FMT-${activeFormatObj.number}-${dateFrom}`}
      periodText={`FY ${activePeriod?.fiscalYear || '2026-2027'}`}
      campusRef={
        currentCampusId === 'all'
          ? 'CONSOLIDATED'
          : campuses.find((c) => c.id === currentCampusId)?.code || 'CAMPUS'
      }
    />
  );

  // Official Institutional Report Header shared across Formats 2–10
  const OfficialReportHeader = ({
    formatNumber,
    title,
    subtitle,
  }: {
    formatNumber: number;
    title: string;
    subtitle: string;
  }) => (
    <div className="border-b-2 border-black pb-4 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SchoolLogo size="md" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Official Report Format #{formatNumber} of 10 · Institutional Financial Standard
            </div>
            <h1 className="text-lg sm:text-xl font-black uppercase tracking-tight text-black">
              {orgSettings?.schoolName || 'A+ School System'}
            </h1>
            <p className="text-xs font-bold text-slate-700">{title}</p>
          </div>
        </div>
        <div className="text-right text-xs font-mono space-y-0.5">
          <div className="font-black text-black uppercase">{campusLabel}</div>
          <div className="text-slate-700">
            Period: <strong>{dateFrom}</strong> to <strong>{dateTo}</strong>
          </div>
          <div className="text-[11px] text-slate-500">{subtitle}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* TOP 10-FORMAT SELECTOR COMMAND BAR */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 print:hidden">
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  <span>10 Official Financial Report Formats</span>
                  <span>·</span>
                  <span>Format #1 is Our Main Standard Format</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Select Report Format (1 to 10) — Instant Live Preview, A4 Print, PDF & CSV Export
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400">Active Format:</span>
              <strong className="text-emerald-300">{activeFormatObj.shortTitle}</strong>
            </div>
          </div>

          {/* 10 Format Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {TEN_REPORT_FORMATS.map((fmt) => {
              const IconComp = fmt.icon;
              const isSelected = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmt.id)}
                  className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? fmt.isMain
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs font-black'
                        : 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs font-black'
                      : fmt.isMain
                      ? 'bg-slate-800/90 hover:bg-slate-800 text-amber-200 border-amber-500/40 font-bold'
                      : 'bg-slate-800/60 hover:bg-slate-800 text-slate-200 border-slate-700/80 font-semibold'
                  }`}
                >
                  <IconComp
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected
                        ? 'text-slate-950'
                        : fmt.isMain
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs leading-tight truncate">{fmt.shortTitle}</div>
                    <div
                      className={`text-[10px] mt-0.5 line-clamp-1 ${
                        isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {fmt.isMain ? 'Default Main Format We Use' : fmt.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Secondary Filter & Export Bar when Formats 2–10 are selected */}
          {selectedFormat !== 'format_1_main' && (
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Campus Selector */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={currentCampusId}
                    onChange={(e) => setCurrentCampusId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
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

                {/* Date From */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-slate-400">From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>

                {/* Date To */}
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5">
                  <span className="text-[11px] text-slate-400">To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedFormat('format_1_main')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-300 text-xs font-bold cursor-pointer"
                >
                  ★ Back to Format 1 (Main Format)
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleExportPdfFormat}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handlePrintFormat}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Format #{activeFormatObj.number}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsvFormat}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {toastMsg && (
          <div className="mt-3 bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* SUPER ADMIN & CAMPUS SIGNATURE CONTROLLER FOR ALL RELEVANT REPORTS */}
        <div className="mt-3">
          <ReportSignatureConfigPanel
            activeFormatKey={
              selectedFormat === 'format_1_main'
                ? 'all_reports'
                : (selectedFormat as RelevantReportKey)
            }
          />
        </div>
      </div>

      {/* FORMAT #1 (MAIN FORMAT WE ALREADY USE): Renders the complete original Yw report suite */}
      {selectedFormat === 'format_1_main' && <LegacyReportsHub />}

      {/* FORMATS #2 TO #10: Rendered in A4 Printable Institutional Container */}
      {selectedFormat !== 'format_1_main' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <div
            ref={printRef}
            className="bg-white border-2 border-black rounded-xl p-6 sm:p-8 shadow-sm text-black"
          >
            <OfficialReportHeader
              formatNumber={activeFormatObj.number}
              title={activeFormatObj.fullTitle}
              subtitle={activeFormatObj.subtitle}
            />

            {/* FORMAT 2: EXECUTIVE BOARD & TRUSTEE SUMMARY */}
            {selectedFormat === 'format_2_executive_board' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="border-2 border-black p-4">
                    <div className="text-[10px] font-black uppercase text-slate-600">
                      Total Operating Revenue
                    </div>
                    <div className="text-xl font-black font-mono mt-1">
                      Rs. {formatNum(totals.revenue)}
                    </div>
                  </div>
                  <div className="border-2 border-black p-4">
                    <div className="text-[10px] font-black uppercase text-slate-600">
                      Total Operating Expenditure
                    </div>
                    <div className="text-xl font-black font-mono mt-1">
                      Rs. {formatNum(totals.expense)}
                    </div>
                  </div>
                  <div className="border-2 border-black p-4 bg-slate-50">
                    <div className="text-[10px] font-black uppercase text-slate-600">
                      Net Surplus / (Deficit)
                    </div>
                    <div className="text-xl font-black font-mono mt-1">
                      Rs. {formatNum(totals.netSurplus)}
                    </div>
                  </div>
                  <div className="border-2 border-black p-4">
                    <div className="text-[10px] font-black uppercase text-slate-600">
                      Total Assets Position
                    </div>
                    <div className="text-xl font-black font-mono mt-1">
                      Rs. {formatNum(totals.assets)}
                    </div>
                  </div>
                </div>

                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th className="border border-black p-2.5 text-left">Classification Group</th>
                      <th className="border border-black p-2.5 text-center">Active Heads</th>
                      <th className="border border-black p-2.5 text-right">Opening Dr (PKR)</th>
                      <th className="border border-black p-2.5 text-right">Period Movement Dr</th>
                      <th className="border border-black p-2.5 text-right">Period Movement Cr</th>
                      <th className="border border-black p-2.5 text-right">Closing Net Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map(
                      (cat) => {
                        const rows = accountAnalytics.filter((a) => a.head.category === cat);
                        const opDr = rows.reduce((s, r) => s + r.openDr - r.openCr, 0);
                        const pDr = rows.reduce((s, r) => s + r.periodDr, 0);
                        const pCr = rows.reduce((s, r) => s + r.periodCr, 0);
                        const closeNet = rows.reduce(
                          (s, r) => s + (r.closingDr - r.closingCr),
                          0
                        );
                        return (
                          <tr key={cat} className="border-b border-black font-semibold">
                            <td className="border border-black p-2.5 font-black uppercase">
                              {cat} Accounts
                            </td>
                            <td className="border border-black p-2.5 text-center font-mono">
                              {rows.length}
                            </td>
                            <td className="border border-black p-2.5 text-right font-mono">
                              {formatNum(Math.abs(opDr))}
                            </td>
                            <td className="border border-black p-2.5 text-right font-mono">
                              {formatNum(pDr)}
                            </td>
                            <td className="border border-black p-2.5 text-right font-mono">
                              {formatNum(pCr)}
                            </td>
                            <td className="border border-black p-2.5 text-right font-mono font-black">
                              {formatNum(Math.abs(closeNet))} {closeNet >= 0 ? 'Dr' : 'Cr'}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* FORMAT 3: CHRONOLOGICAL DAILY DAYBOOK SCROLL */}
            {selectedFormat === 'format_3_daily_daybook' && (
              <div className="space-y-4">
                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th className="border border-black p-2 text-center w-12">Sr#</th>
                      <th className="border border-black p-2 text-left">Date</th>
                      <th className="border border-black p-2 text-left">Voucher #</th>
                      <th className="border border-black p-2 text-center">Type</th>
                      <th className="border border-black p-2 text-left">Particulars / Account Lines</th>
                      <th className="border border-black p-2 text-right">Debit (PKR)</th>
                      <th className="border border-black p-2 text-right">Credit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center font-semibold text-slate-500">
                          No vouchers recorded in the selected date range ({dateFrom} to {dateTo}).
                        </td>
                      </tr>
                    ) : (
                      scopedVouchers.map((tx, idx) => (
                        <tr key={tx.id} className="border-b border-black align-top">
                          <td className="border border-black p-2 text-center font-mono">
                            {idx + 1}
                          </td>
                          <td className="border border-black p-2 font-mono">{tx.date}</td>
                          <td className="border border-black p-2 font-mono font-bold">
                            {tx.voucherNo}
                          </td>
                          <td className="border border-black p-2 text-center font-mono font-bold">
                            {tx.voucherType}
                          </td>
                          <td className="border border-black p-2">
                            <div className="font-bold">{tx.narration}</div>
                            <div className="text-[11px] text-slate-600 mt-1 space-y-0.5">
                              {(tx.entries || []).map((e, i) => (
                                <div key={i} className="font-mono">
                                  [{e.accountCode}] {e.accountName}:{' '}
                                  {Number(e.debit) > 0
                                    ? `Dr ${formatNum(Number(e.debit))}`
                                    : `Cr ${formatNum(Number(e.credit))}`}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="border border-black p-2 text-right font-mono font-bold">
                            {formatNum(Number(tx.totalDebit) || 0)}
                          </td>
                          <td className="border border-black p-2 text-right font-mono font-bold">
                            {formatNum(Number(tx.totalCredit) || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-black font-black">
                      <td colSpan={5} className="border border-black p-2 text-right uppercase">
                        Daybook Grand Totals ({scopedVouchers.length} Vouchers)
                      </td>
                      <td className="border border-black p-2 text-right font-mono underline decoration-double">
                        {formatNum(
                          scopedVouchers.reduce((s, v) => s + (Number(v.totalDebit) || 0), 0)
                        )}
                      </td>
                      <td className="border border-black p-2 text-right font-mono underline decoration-double">
                        {formatNum(
                          scopedVouchers.reduce((s, v) => s + (Number(v.totalCredit) || 0), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMAT 4: T-ACCOUNT (HORIZONTAL TWO-SIDED DR | CR) */}
            {selectedFormat === 'format_4_t_account' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 print:hidden">
                  <label className="text-xs font-bold">Filter T-Account Head:</label>
                  <select
                    value={selectedTAccountId}
                    onChange={(e) => setSelectedTAccountId(e.target.value)}
                    className="px-3 py-1.5 border border-black rounded text-xs font-bold"
                  >
                    <option value="ALL">All Active Ledger Accounts ({activeAccountRows.length})</option>
                    {accountHeads.map((h) => (
                      <option key={h.id} value={h.id}>
                        [{h.code}] {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                {activeAccountRows
                  .filter((r) => selectedTAccountId === 'ALL' || r.head.id === selectedTAccountId)
                  .slice(0, 15)
                  .map((item) => (
                    <div key={item.head.id} className="border-2 border-black">
                      <div className="bg-slate-100 border-b-2 border-black px-3 py-2 flex items-center justify-between text-xs font-black uppercase">
                        <span>
                          Dr. — [{item.head.code}] {item.head.name} ({item.head.category})
                        </span>
                        <span>Cr.</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-black text-xs">
                        {/* Left Debit Side */}
                        <div className="p-2.5">
                          <div className="text-[10px] font-black uppercase border-b border-black pb-1 mb-1.5 flex justify-between">
                            <span>Debit (Dr) Particulars</span>
                            <span>Amount (PKR)</span>
                          </div>
                          {item.openDr > 0 && (
                            <div className="flex justify-between font-mono py-0.5 font-semibold">
                              <span>To Balance b/d (Opening)</span>
                              <span>{formatNum(item.openDr)}</span>
                            </div>
                          )}
                          {item.drEntries.map((d, idx) => (
                            <div key={idx} className="flex justify-between font-mono py-0.5">
                              <span className="truncate pr-2">
                                {d.date} · {d.voucherNo} ({d.narration})
                              </span>
                              <span>{formatNum(d.amount)}</span>
                            </div>
                          ))}
                          <div className="mt-2 pt-1 border-t border-black flex justify-between font-mono font-black">
                            <span>Total Debit (Dr)</span>
                            <span>{formatNum(item.openDr + item.periodDr)}</span>
                          </div>
                        </div>

                        {/* Right Credit Side */}
                        <div className="p-2.5">
                          <div className="text-[10px] font-black uppercase border-b border-black pb-1 mb-1.5 flex justify-between">
                            <span>Credit (Cr) Particulars</span>
                            <span>Amount (PKR)</span>
                          </div>
                          {item.openCr > 0 && (
                            <div className="flex justify-between font-mono py-0.5 font-semibold">
                              <span>By Balance b/d (Opening)</span>
                              <span>{formatNum(item.openCr)}</span>
                            </div>
                          )}
                          {item.crEntries.map((c, idx) => (
                            <div key={idx} className="flex justify-between font-mono py-0.5">
                              <span className="truncate pr-2">
                                {c.date} · {c.voucherNo} ({c.narration})
                              </span>
                              <span>{formatNum(c.amount)}</span>
                            </div>
                          ))}
                          <div className="mt-2 pt-1 border-t border-black flex justify-between font-mono font-black">
                            <span>Total Credit (Cr)</span>
                            <span>{formatNum(item.openCr + item.periodCr)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 border-t border-black px-3 py-1.5 text-right text-xs font-mono font-black">
                        Closing Balance c/d:{' '}
                        {item.closingDr > 0
                          ? `Rs. ${formatNum(item.closingDr)} (Dr)`
                          : item.closingCr > 0
                          ? `Rs. ${formatNum(item.closingCr)} (Cr)`
                          : 'Rs. 0 (Nil)'}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* FORMAT 5: 10-COLUMN STATUTORY AUDITOR WORKSHEET */}
            {selectedFormat === 'format_5_10col_worksheet' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-black text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th rowSpan={2} className="border border-black p-1.5 text-left">
                        Code
                      </th>
                      <th rowSpan={2} className="border border-black p-1.5 text-left">
                        Account Head
                      </th>
                      <th colSpan={2} className="border border-black p-1.5 text-center">
                        Opening Balance
                      </th>
                      <th colSpan={2} className="border border-black p-1.5 text-center">
                        Period Movement
                      </th>
                      <th colSpan={2} className="border border-black p-1.5 text-center">
                        Closing Trial Balance
                      </th>
                      <th colSpan={2} className="border border-black p-1.5 text-center">
                        Income Stmt (P&L)
                      </th>
                      <th colSpan={2} className="border border-black p-1.5 text-center">
                        Balance Sheet
                      </th>
                    </tr>
                    <tr className="bg-slate-50 border-b-2 border-black font-bold font-mono">
                      <th className="border border-black p-1 text-right">Dr</th>
                      <th className="border border-black p-1 text-right">Cr</th>
                      <th className="border border-black p-1 text-right">Dr</th>
                      <th className="border border-black p-1 text-right">Cr</th>
                      <th className="border border-black p-1 text-right">Dr</th>
                      <th className="border border-black p-1 text-right">Cr</th>
                      <th className="border border-black p-1 text-right">Expense (Dr)</th>
                      <th className="border border-black p-1 text-right">Revenue (Cr)</th>
                      <th className="border border-black p-1 text-right">Assets (Dr)</th>
                      <th className="border border-black p-1 text-right">Liab/Eq (Cr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAccountRows.map((r) => (
                      <tr key={r.head.id} className="border-b border-black font-mono">
                        <td className="border border-black p-1.5 font-bold">{r.head.code}</td>
                        <td className="border border-black p-1.5 font-sans font-semibold">
                          {r.head.name}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.openDr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.openCr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.periodDr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.periodCr)}
                        </td>
                        <td className="border border-black p-1.5 text-right font-bold">
                          {formatNum(r.closingDr)}
                        </td>
                        <td className="border border-black p-1.5 text-right font-bold">
                          {formatNum(r.closingCr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.plDr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.plCr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.bsDr)}
                        </td>
                        <td className="border border-black p-1.5 text-right">
                          {formatNum(r.bsCr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                      <td colSpan={2} className="border border-black p-1.5 text-right uppercase">
                        10-Column Totals
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.openDr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.openCr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.periodDr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.periodCr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.closingDr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.closingCr)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.expense)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.revenue)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.assets)}
                      </td>
                      <td className="border border-black p-1.5 text-right">
                        {formatNum(totals.liabilities + totals.equity)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* FORMAT 6: MONTH-WISE COMPARATIVE MATRIX */}
            {selectedFormat === 'format_6_monthly_matrix' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th className="border border-black p-2 text-left">Code</th>
                      <th className="border border-black p-2 text-left">Account Head</th>
                      <th className="border border-black p-2 text-center">Type</th>
                      {monthColumns.map((m) => (
                        <th key={m.ym} className="border border-black p-2 text-right font-mono">
                          {m.label}
                        </th>
                      ))}
                      <th className="border border-black p-2 text-right">Row Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAccountRows.map((r) => {
                      let rowSum = 0;
                      return (
                        <tr key={r.head.id} className="border-b border-black">
                          <td className="border border-black p-2 font-mono font-bold">
                            {r.head.code}
                          </td>
                          <td className="border border-black p-2 font-semibold">{r.head.name}</td>
                          <td className="border border-black p-2 text-center text-[11px]">
                            {r.head.category}
                          </td>
                          {monthColumns.map((m) => {
                            let monthAmt = 0;
                            scopedVouchers
                              .filter((tx) => (tx.date || '').startsWith(m.ym))
                              .forEach((tx) => {
                                (tx.entries || []).forEach((ent) => {
                                  if (
                                    ent.accountId === r.head.id ||
                                    ent.accountCode === r.head.code
                                  ) {
                                    monthAmt +=
                                      (Number(ent.debit) || 0) + (Number(ent.credit) || 0);
                                  }
                                });
                              });
                            rowSum += monthAmt;
                            return (
                              <td
                                key={m.ym}
                                className="border border-black p-2 text-right font-mono"
                              >
                                {formatNum(monthAmt)}
                              </td>
                            );
                          })}
                          <td className="border border-black p-2 text-right font-mono font-black">
                            {formatNum(rowSum)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* FORMAT 7: SEGREGATED 5-VOUCHER BOOKS REGISTER */}
            {selectedFormat === 'format_7_voucher_books' && (
              <div className="space-y-6">
                {(
                  [
                    { code: 'BPV', title: 'Bank Payment Voucher Book (BPV)' },
                    { code: 'BRV', title: 'Bank Receipt Voucher Book (BRV)' },
                    { code: 'CPV', title: 'Cash Payment Voucher Book (CPV)' },
                    { code: 'CRV', title: 'Cash Receipt Voucher Book (CRV)' },
                    { code: 'JV', title: 'Journal Voucher Book (JV)' },
                  ] as const
                ).map((book) => {
                  const list = scopedVouchers.filter((v) => v.voucherType === book.code);
                  const bookDr = list.reduce((s, v) => s + (Number(v.totalDebit) || 0), 0);
                  const bookCr = list.reduce((s, v) => s + (Number(v.totalCredit) || 0), 0);
                  return (
                    <div key={book.code} className="border-2 border-black">
                      <div className="bg-slate-100 border-b-2 border-black px-3 py-2 flex items-center justify-between text-xs font-black uppercase">
                        <span>{book.title}</span>
                        <span className="font-mono">
                          {list.length} Vouchers · Total: Rs. {formatNum(bookDr)}
                        </span>
                      </div>
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-black font-bold">
                            <th className="border-r border-black p-2 text-left">Date</th>
                            <th className="border-r border-black p-2 text-left">Voucher #</th>
                            <th className="border-r border-black p-2 text-left">Narration</th>
                            <th className="border-r border-black p-2 text-right">Debit (PKR)</th>
                            <th className="p-2 text-right">Credit (PKR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-3 text-center text-slate-500">
                                No {book.code} vouchers recorded in period.
                              </td>
                            </tr>
                          ) : (
                            list.map((v) => (
                              <tr key={v.id} className="border-b border-black">
                                <td className="border-r border-black p-2 font-mono">{v.date}</td>
                                <td className="border-r border-black p-2 font-mono font-bold">
                                  {v.voucherNo}
                                </td>
                                <td className="border-r border-black p-2">{v.narration}</td>
                                <td className="border-r border-black p-2 text-right font-mono">
                                  {formatNum(Number(v.totalDebit) || 0)}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {formatNum(Number(v.totalCredit) || 0)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 border-t border-black font-black font-mono">
                            <td colSpan={3} className="border-r border-black p-2 text-right">
                              {book.code} Book Subtotal
                            </td>
                            <td className="border-r border-black p-2 text-right">
                              {formatNum(bookDr)}
                            </td>
                            <td className="p-2 text-right">{formatNum(bookCr)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* FORMAT 8: MULTI-CAMPUS SIDE-BY-SIDE COLUMNAR FORMAT */}
            {selectedFormat === 'format_8_campus_columnar' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th className="border border-black p-2 text-left">Code</th>
                      <th className="border border-black p-2 text-left">Account Head</th>
                      <th className="border border-black p-2 text-center">Category</th>
                      {campuses.length === 0 ? (
                        <th className="border border-black p-2 text-center">
                          No Campuses Created Yet
                        </th>
                      ) : (
                        campuses.map((c) => (
                          <th key={c.id} className="border border-black p-2 text-right">
                            {c.name} ({c.code})
                          </th>
                        ))
                      )}
                      <th className="border border-black p-2 text-right">Consolidated Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeAccountRows.map((r) => (
                      <tr key={r.head.id} className="border-b border-black">
                        <td className="border border-black p-2 font-mono font-bold">
                          {r.head.code}
                        </td>
                        <td className="border border-black p-2 font-semibold">{r.head.name}</td>
                        <td className="border border-black p-2 text-center">{r.head.category}</td>
                        {campuses.length === 0 ? (
                          <td className="border border-black p-2 text-center font-mono">0</td>
                        ) : (
                          campuses.map((c) => {
                            let cBal = 0;
                            (transactions || [])
                              .filter((tx) => tx.campusId === c.id && tx.status !== 'Rejected')
                              .forEach((tx) => {
                                (tx.entries || []).forEach((ent) => {
                                  if (
                                    ent.accountId === r.head.id ||
                                    ent.accountCode === r.head.code
                                  ) {
                                    cBal +=
                                      (Number(ent.debit) || 0) - (Number(ent.credit) || 0);
                                  }
                                });
                              });
                            return (
                              <td
                                key={c.id}
                                className="border border-black p-2 text-right font-mono"
                              >
                                {formatNum(Math.abs(cBal))}
                              </td>
                            );
                          })
                        )}
                        <td className="border border-black p-2 text-right font-mono font-black">
                          {formatNum(Math.max(r.closingDr, r.closingCr))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FORMAT 9: DEPARTMENTAL EXPENSE & PETTY CASH IMPREST UTILIZATION */}
            {selectedFormat === 'format_9_expense_pettycash' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase mb-2">
                    Part A: General Ledger Operating Expense Heads (500-Series)
                  </h3>
                  <table className="w-full border-collapse border-2 border-black text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                        <th className="border border-black p-2 text-left">Account Code</th>
                        <th className="border border-black p-2 text-left">Expense Head</th>
                        <th className="border border-black p-2 text-right">Opening Dr</th>
                        <th className="border border-black p-2 text-right">Period Expense Dr</th>
                        <th className="border border-black p-2 text-right">Closing Expense Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountAnalytics
                        .filter((a) => a.head.category === 'Expense')
                        .slice(0, 25)
                        .map((r) => (
                          <tr key={r.head.id} className="border-b border-black">
                            <td className="border border-black p-2 font-mono font-bold">
                              {r.head.code}
                            </td>
                            <td className="border border-black p-2 font-semibold">
                              {r.head.name}
                            </td>
                            <td className="border border-black p-2 text-right font-mono">
                              {formatNum(r.openDr)}
                            </td>
                            <td className="border border-black p-2 text-right font-mono">
                              {formatNum(r.periodDr)}
                            </td>
                            <td className="border border-black p-2 text-right font-mono font-black">
                              {formatNum(r.closingDr)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase mb-2">
                    Part B: Petty Cash Imprest Register ({scopedPettyCash.length} Slips)
                  </h3>
                  <table className="w-full border-collapse border-2 border-black text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                        <th className="border border-black p-2 text-left">Date</th>
                        <th className="border border-black p-2 text-left">Slip #</th>
                        <th className="border border-black p-2 text-left">Category / Head</th>
                        <th className="border border-black p-2 text-left">Narration</th>
                        <th className="border border-black p-2 text-right">Amount (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedPettyCash.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-500">
                            No Petty Cash slips recorded in selected period.
                          </td>
                        </tr>
                      ) : (
                        scopedPettyCash.map((pc) => (
                          <tr key={pc.id} className="border-b border-black">
                            <td className="border border-black p-2 font-mono">{pc.date}</td>
                            <td className="border border-black p-2 font-mono font-bold">
                              {pc.voucherNo}
                            </td>
                            <td className="border border-black p-2 font-semibold">
                              {pc.category || pc.payee}
                            </td>
                            <td className="border border-black p-2">{pc.narration}</td>
                            <td className="border border-black p-2 text-right font-mono font-bold">
                              {formatNum(Number(pc.amount) || 0)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* FORMAT 10: STATUTORY AUDIT CERTIFICATE & GROUP CONTROL SUMMARY */}
            {selectedFormat === 'format_10_audit_certificate' && (
              <div className="space-y-6">
                <div className="border-2 border-black p-4 bg-slate-50 text-xs leading-relaxed">
                  <div className="font-black uppercase text-sm mb-1">
                    Statutory Internal & External Audit Certification Statement
                  </div>
                  <p>
                    We hereby certify that the books of accounts, General Ledger registers, Four-Voucher
                    books (BPV, BRV, CPV, CRV, JV), and Petty Cash imprest scrolls of{' '}
                    <strong>{orgSettings?.schoolName || 'A+ School System'}</strong> (
                    <strong>{campusLabel}</strong>) for the period <strong>{dateFrom}</strong> to{' '}
                    <strong>{dateTo}</strong> have been examined in accordance with IAS-1 double-entry
                    accounting standards.
                  </p>
                </div>

                <table className="w-full border-collapse border-2 border-black text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-black font-black uppercase">
                      <th className="border border-black p-2.5 text-left">Main Control Code</th>
                      <th className="border border-black p-2.5 text-left">Account Classification</th>
                      <th className="border border-black p-2.5 text-center">Total Heads</th>
                      <th className="border border-black p-2.5 text-right">Closing Debit (PKR)</th>
                      <th className="border border-black p-2.5 text-right">Closing Credit (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { code: '100', cat: 'Asset', label: '100 — ASSETS (Fixed & Current)' },
                      { code: '200', cat: 'Liability', label: '200 — LIABILITIES' },
                      { code: '300', cat: 'Equity', label: '300 — EQUITY & RESERVES' },
                      { code: '400', cat: 'Revenue', label: '400 — OPERATING REVENUE / INCOME' },
                      { code: '500', cat: 'Expense', label: '500 — OPERATING EXPENSES' },
                    ].map((grp) => {
                      const rows = accountAnalytics.filter((a) => a.head.category === grp.cat);
                      const dr = rows.reduce((s, r) => s + r.closingDr, 0);
                      const cr = rows.reduce((s, r) => s + r.closingCr, 0);
                      return (
                        <tr key={grp.code} className="border-b border-black font-semibold">
                          <td className="border border-black p-2.5 font-mono font-black">
                            {grp.code}
                          </td>
                          <td className="border border-black p-2.5 font-bold">{grp.label}</td>
                          <td className="border border-black p-2.5 text-center font-mono">
                            {rows.length}
                          </td>
                          <td className="border border-black p-2.5 text-right font-mono">
                            {formatNum(dr)}
                          </td>
                          <td className="border border-black p-2.5 text-right font-mono">
                            {formatNum(cr)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-black font-black font-mono">
                      <td colSpan={3} className="border border-black p-2.5 text-right uppercase">
                        Certified Trial Balance Control Totals
                      </td>
                      <td className="border border-black p-2.5 text-right underline decoration-double">
                        Rs. {formatNum(totals.closingDr)}
                      </td>
                      <td className="border border-black p-2.5 text-right underline decoration-double">
                        Rs. {formatNum(totals.closingCr)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <OfficialSignatureFooter />
          </div>
        </div>
      )}
    </div>
  );
};
