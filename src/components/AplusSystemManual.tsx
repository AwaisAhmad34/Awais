import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Download,
  Printer,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Calculator,
  ClipboardCheck,
  FileSpreadsheet,
  GitBranch,
  Layers,
  ShieldCheck,
  Sparkles,
  Building2,
  ArrowDown,
  AlertTriangle,
  PlusCircle,
  RotateCcw,
  Cloud,
} from 'lucide-react';
import {
  useAccounting,
  generateElementPdf,
  printOrDownloadElement,
  SchoolLogo,
} from '../core/aplusEngine';
import {
  APLUS_MANUAL_SECTIONS,
  DAILY_PROCEDURE_CHECKLIST,
  MONTHLY_CLOSING_CHECKLIST,
  ManualSection,
} from '../data/aplusManualData';
import {
  saveChecklistStateToCloud,
  loadChecklistStateFromCloud,
} from '../services/firebaseSync';

interface AplusSystemManualProps {
  LegacyDocs: React.ComponentType;
  onNavigate?: (tab: string) => void;
}

type ManualWorkspaceTab =
  | 'interactive_49'
  | 'full_print_manual'
  | 'petty_cash_reconcile'
  | 'procedures_checklist'
  | 'voucher_template_demo'
  | 'legacy_specs';

const CATEGORIES = [
  'All',
  'Foundations & Scope',
  'Users, Auth & Campus',
  'Voucher Management',
  'Petty Cash Control',
  'Workflows & Reporting',
  'Audit, Security & Procedures',
  'Templates, FAQs & Blueprint',
] as const;

export const AplusSystemManual: React.FC<AplusSystemManualProps> = ({
  LegacyDocs,
  onNavigate,
}) => {
  const {
    orgSettings,
    campuses,
    currentCampusId,
    accountHeads,
    transactions,
    pettyCashTransactions,
    addTransaction,
    addPettyCashTransaction,
    logActivity,
  } = useAccounting();

  const [activeSubTab, setActiveSubTab] = useState<ManualWorkspaceTab>('interactive_49');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(APLUS_MANUAL_SECTIONS[0].id);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const singleSectionPrintRef = useRef<HTMLDivElement>(null);
  const fullManualPrintRef = useRef<HTMLDivElement>(null);
  const reconcilePrintRef = useRef<HTMLDivElement>(null);

  // Petty Cash Reconciliation state (Sections 17-19)
  const [reconcileCampusId, setReconcileCampusId] = useState<string>(
    currentCampusId === 'all' ? campuses[0]?.id || 'campus-khiali' : currentCampusId
  );
  const [customOpeningFloat, setCustomOpeningFloat] = useState<string>('');
  const [customCashReceived, setCustomCashReceived] = useState<string>('');
  const [customCashSpent, setCustomCashSpent] = useState<string>('');
  const [physicalCashInput, setPhysicalCashInput] = useState<string>('');
  const [reconcileRemarks, setReconcileRemarks] = useState<string>(
    'Physical safe cash counted and verified against system petty cash register per Section 19.'
  );

  // Daily & Monthly Checklist state (Sections 21, 22, 37, 38)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('aplus_finance_procedures_checklist_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    loadChecklistStateFromCloud().then((cloudData) => {
      if (cloudData && typeof cloudData === 'object') {
        setCheckedItems((prev) => ({ ...cloudData, ...prev }));
      }
    });
  }, []);

  const toggleChecklistItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('aplus_finance_procedures_checklist_v1', JSON.stringify(next));
      } catch {}
      saveChecklistStateToCloud(next);
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Filtered 49 sections
  const filteredSections = useMemo(() => {
    return APLUS_MANUAL_SECTIONS.filter((sec) => {
      const matchesCategory =
        selectedCategory === 'All' || sec.category === selectedCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = sec.title.toLowerCase().includes(q);
      const inSummary = sec.summary.toLowerCase().includes(q);
      const inParagraphs = (sec.paragraphs || []).some((p) =>
        p.toLowerCase().includes(q)
      );
      const inBullets = (sec.bullets || []).some((b) =>
        b.toLowerCase().includes(q)
      );
      const inSubs = (sec.subSections || []).some(
        (s) =>
          s.heading.toLowerCase().includes(q) ||
          (s.text || '').toLowerCase().includes(q) ||
          (s.bullets || []).some((b) => b.toLowerCase().includes(q))
      );
      return inTitle || inSummary || inParagraphs || inBullets || inSubs;
    });
  }, [searchQuery, selectedCategory]);

  const activeSection: ManualSection = useMemo(() => {
    return (
      filteredSections.find((s) => s.id === selectedSectionId) ||
      APLUS_MANUAL_SECTIONS.find((s) => s.id === selectedSectionId) ||
      filteredSections[0] ||
      APLUS_MANUAL_SECTIONS[0]
    );
  }, [filteredSections, selectedSectionId]);

  // Compute Petty Cash Reconciliation figures for selected campus (Sections 17-19)
  const campusPettyStats = useMemo(() => {
    const campus = campuses.find((c) => c.id === reconcileCampusId) || campuses[0];
    const campusPcTxs = pettyCashTransactions.filter(
      (tx) => tx.campusId === campus?.id
    );
    const ledgerOpening = campus?.pettyCashFloat ?? 20000;
    const ledgerReceived = campusPcTxs
      .filter((tx) => tx.type === 'Replenishment')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const ledgerSpent = campusPcTxs
      .filter((tx) => tx.type === 'Disbursement')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const opening =
      customOpeningFloat !== '' ? Number(customOpeningFloat) || 0 : ledgerOpening;
    const received =
      customCashReceived !== '' ? Number(customCashReceived) || 0 : ledgerReceived;
    const spent =
      customCashSpent !== '' ? Number(customCashSpent) || 0 : ledgerSpent;

    const closingSystemBalance = opening + received - spent;
    const physicalCash =
      physicalCashInput !== ''
        ? Number(physicalCashInput) || 0
        : closingSystemBalance;
    const difference = closingSystemBalance - physicalCash;

    return {
      campus,
      opening,
      received,
      spent,
      closingSystemBalance,
      physicalCash,
      difference,
      txCount: campusPcTxs.length,
    };
  }, [
    campuses,
    reconcileCampusId,
    pettyCashTransactions,
    customOpeningFloat,
    customCashReceived,
    customCashSpent,
    physicalCashInput,
  ]);

  // Checklist completion stats
  const checklistStats = useMemo(() => {
    const allDaily = [
      ...DAILY_PROCEDURE_CHECKLIST.beginningOfDay,
      ...DAILY_PROCEDURE_CHECKLIST.duringTheDay,
      ...DAILY_PROCEDURE_CHECKLIST.endOfDay,
    ];
    const dailyDone = allDaily.filter((i) => checkedItems[i.id]).length;
    const monthlyDone = MONTHLY_CLOSING_CHECKLIST.filter(
      (i) => checkedItems[i.id]
    ).length;
    return {
      dailyDone,
      dailyTotal: allDaily.length,
      dailyPct: Math.round((dailyDone / allDaily.length) * 100),
      monthlyDone,
      monthlyTotal: MONTHLY_CLOSING_CHECKLIST.length,
      monthlyPct: Math.round(
        (monthlyDone / MONTHLY_CLOSING_CHECKLIST.length) * 100
      ),
    };
  }, [checkedItems]);

  // Post Section 42 Example Transaction (PKR 4,500 Stationery)
  const handlePostSection42Example = () => {
    const targetCampus =
      campuses.find((c) => c.id === 'campus-khiali') || campuses[0];
    const stationeryAcc =
      accountHeads.find(
        (a) =>
          a.name.toLowerCase().includes('stationery') || a.code === '500-3-01'
      ) ||
      accountHeads.find((a) => a.category === 'Expense') ||
      accountHeads[0];
    const cashAcc =
      accountHeads.find(
        (a) =>
          a.name.toLowerCase().includes('cash in hand') ||
          a.code === '100-4-01' ||
          a.type === 'Cash'
      ) || accountHeads[0];

    const voucherNo = `APS-EXP-${String(transactions.length + 1).padStart(5, '0')}`;
    const todayDate = '2026-09-30';

    addTransaction({
      voucherNo,
      voucherType: 'CPV',
      campusId: targetCampus.id,
      date: todayDate,
      narration:
        'Stationery purchased for administrative and classroom use (Payee: Stationery Supplier — Manual Section 42 Example)',
      chequeNo: 'CASH-SLIP-42',
      status: 'Approved',
      preparedBy: 'Finance User',
      checkedBy: 'Campus Administrator',
      approvedBy: 'Super Administrator',
      entries: [
        {
          id: `row-dr-${Date.now()}`,
          accountId: stationeryAcc.id,
          accountCode: stationeryAcc.code,
          accountName: stationeryAcc.name,
          description:
            'Stationery purchased for administrative and classroom use (Payee: Stationery Supplier)',
          debit: 4500,
          credit: 0,
          refCheckNo: 'APS-EXP-00001',
        },
        {
          id: `row-cr-${Date.now() + 1}`,
          accountId: cashAcc.id,
          accountCode: cashAcc.code,
          accountName: cashAcc.name,
          description: 'Cash payment to Stationery Supplier',
          debit: 0,
          credit: 4500,
          refCheckNo: 'APS-EXP-00001',
        },
      ],
      totalDebit: 4500,
      totalCredit: 4500,
    });

    addPettyCashTransaction({
      voucherNo,
      campusId: targetCampus.id,
      date: todayDate,
      type: 'Disbursement',
      payee: 'Stationery Supplier',
      category: 'Stationery',
      accountId: stationeryAcc.id,
      accountCode: stationeryAcc.code,
      amount: 4500,
      narration: 'Stationery purchased for administrative and classroom use',
      receiptNo: 'BILL-4201',
      approvedBy: 'Super Administrator',
    });

    showToast(
      `Posted Section 42 Example Transaction (${voucherNo} — PKR 4,500 Stationery for ${targetCampus.name}) to General Ledger & Petty Cash!`
    );
  };

  const renderSectionContent = (sec: ManualSection) => (
    <div className="space-y-4 text-xs leading-relaxed text-slate-700">
      {sec.paragraphs?.map((p, idx) => (
        <p key={idx} className="text-slate-700 leading-relaxed">
          {p}
        </p>
      ))}

      {sec.formula && (
        <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-xs sm:text-sm font-bold text-center shadow-xs border border-slate-700">
          <span className="text-emerald-400 uppercase text-[10px] tracking-widest block mb-1 font-sans">
            Official Formula
          </span>
          {sec.formula}
        </div>
      )}

      {sec.bullets && sec.bullets.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {sec.bullets.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 text-slate-800 font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {sec.subSections && sec.subSections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {sec.subSections.map((sub, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-1.5"
            >
              <h5 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                {sub.heading}
              </h5>
              {sub.text && (
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {sub.text}
                </p>
              )}
              {sub.bullets && (
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700 pt-1">
                  {sub.bullets.map((b, bIdx) => (
                    <li key={bIdx}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {sec.table && (
        <div className="overflow-x-auto rounded-xl border border-slate-300 mt-2">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                {sec.table.headers.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3.5 py-2.5 font-bold uppercase tracking-wider text-[10px] ${
                      sec.table?.alignRightCols?.includes(i) ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {sec.table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-3.5 py-2 text-slate-800 ${
                        cIdx === 0 ? 'font-bold text-slate-900' : ''
                      } ${
                        sec.table?.alignRightCols?.includes(cIdx)
                          ? 'text-right font-mono font-bold'
                          : ''
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sec.flowSteps && sec.flowSteps.length > 0 && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Sequential Process Pipeline ({sec.flowSteps.length} Stages)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sec.flowSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="px-3 py-2 rounded-lg bg-white border border-slate-300 shadow-2xs flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-800 text-xs">{step}</span>
                </div>
                {idx < sec.flowSteps!.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {sec.highlightBox && (
        <div
          className={`p-4 rounded-xl border space-y-1.5 ${
            sec.highlightBox.tone === 'emerald'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
              : sec.highlightBox.tone === 'amber'
              ? 'bg-amber-50/90 border-amber-200 text-amber-950'
              : 'bg-blue-50/90 border-blue-200 text-blue-950'
          }`}
        >
          <div className="font-bold text-xs uppercase tracking-wider">
            {sec.highlightBox.title}
          </div>
          <div className="space-y-1 font-mono text-xs">
            {sec.highlightBox.lines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-300 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                APLUS SCHOOL SYSTEM — Complete System Documentation & User Manual
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                49 Sections Incorporated
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-Campus Voucher & Petty Cash Management System • Standard Operating Procedures, Reconciliation & Audit Guide
            </p>
          </div>
        </div>

        {/* Workspace Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('interactive_49')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'interactive_49'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>49-Section Manual</span>
          </button>
          <button
            onClick={() => setActiveSubTab('full_print_manual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'full_print_manual'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Full Printable Manual (PDF)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('petty_cash_reconcile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'petty_cash_reconcile'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Petty Cash Reconciliation (Sec 17–19)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('procedures_checklist')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'procedures_checklist'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Daily & Monthly Procedures (Sec 37–38)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('voucher_template_demo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'voucher_template_demo'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Standard Voucher & Sec 42 Example</span>
          </button>
          <button
            onClick={() => setActiveSubTab('legacy_specs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'legacy_specs'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-700 hover:bg-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Core Technical Specs (10)</span>
          </button>
        </div>
      </div>

      {/* MODE 1: INTERACTIVE 49-SECTION MANUAL */}
      {activeSubTab === 'interactive_49' && (
        <div className="space-y-4">
          {/* Category Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-300 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => {
                const count =
                  cat === 'All'
                    ? APLUS_MANUAL_SECTIONS.length
                    : APLUS_MANUAL_SECTIONS.filter((s) => s.category === cat)
                        .length;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!singleSectionPrintRef.current) return;
                  setIsExportingPdf(true);
                  try {
                    await generateElementPdf(
                      singleSectionPrintRef.current,
                      `Aplus_Manual_Section_${activeSection.number}.pdf`
                    );
                    showToast(`Downloaded Section ${activeSection.number} PDF`);
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Section PDF</span>
              </button>
              <button
                onClick={() =>
                  singleSectionPrintRef.current &&
                  printOrDownloadElement(singleSectionPrintRef.current, {
                    title: activeSection.title,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Section</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Sidebar: 49 Sections Index */}
            <div className="lg:col-span-4 space-y-3 print:hidden">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search all 49 manual sections, vouchers, petty cash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="bg-white rounded-xl border border-slate-300 p-2 shadow-xs max-h-[620px] overflow-y-auto space-y-1">
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Manual Sections ({filteredSections.length} of 49)</span>
                  <span className="font-mono text-[10px] text-blue-600">
                    APS-MAN-2026
                  </span>
                </div>
                {filteredSections.map((sec) => {
                  const isSelected = sec.id === activeSection.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedSectionId(sec.id)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs flex items-start gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 text-blue-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-700 font-medium'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sec.number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{sec.title}</div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {sec.summary}
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-3.5 h-3.5 text-blue-600 mt-1 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Content: Active Section Detail */}
            <div className="lg:col-span-8">
              <div
                ref={singleSectionPrintRef}
                className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-xs space-y-6"
              >
                <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <SchoolLogo className="w-12 h-12" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900 uppercase tracking-tight">
                        {orgSettings.schoolName || 'APLUS SCHOOL SYSTEM'}
                      </h3>
                      <div className="text-xs text-slate-500 font-medium">
                        Multi-Campus Voucher & Petty Cash Management System • User Manual
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <div>
                      Section:{' '}
                      <strong className="text-slate-900">
                        {activeSection.number} of 49
                      </strong>
                    </div>
                    <div>
                      Category:{' '}
                      <span className="text-blue-700 font-bold">
                        {activeSection.category}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold">
                        § {activeSection.number}
                      </span>
                      <h4 className="text-lg font-black text-slate-900 tracking-tight">
                        {activeSection.title}
                      </h4>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 italic">
                    <strong>Executive Summary:</strong> {activeSection.summary}
                  </div>

                  {renderSectionContent(activeSection)}
                </div>

                {/* Contextual Quick Action Links inside specific sections */}
                {(activeSection.number === 17 ||
                  activeSection.number === 18 ||
                  activeSection.number === 19) && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="text-xs text-emerald-950">
                      <strong>Live Interactive Tool Available:</strong> Run the{' '}
                      <strong>Petty Cash Physical Reconciliation Calculator</strong>{' '}
                      for any campus now.
                    </div>
                    <button
                      onClick={() => setActiveSubTab('petty_cash_reconcile')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Open Petty Cash Reconciliation →
                    </button>
                  </div>
                )}

                {(activeSection.number === 21 ||
                  activeSection.number === 22 ||
                  activeSection.number === 37 ||
                  activeSection.number === 38) && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="text-xs text-amber-950">
                      <strong>Interactive Procedure Checklist:</strong> Track and
                      certify daily and monthly finance staff procedures.
                    </div>
                    <button
                      onClick={() => setActiveSubTab('procedures_checklist')}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Open Daily & Monthly Checklists →
                    </button>
                  </div>
                )}

                {(activeSection.number === 41 ||
                  activeSection.number === 42 ||
                  activeSection.number === 46) && (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div className="text-xs text-purple-950">
                      <strong>Live Voucher Format & Section 42 Demo:</strong>{' '}
                      Inspect the standard voucher or post the PKR 4,500
                      Stationery example directly to the ledger.
                    </div>
                    <button
                      onClick={() => setActiveSubTab('voucher_template_demo')}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Open Standard Voucher & Demo →
                    </button>
                  </div>
                )}

                {/* Previous / Next Navigation */}
                <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs print:hidden">
                  <span className="text-slate-500">
                    Showing Section{' '}
                    <strong className="text-slate-800">
                      {activeSection.number}
                    </strong>{' '}
                    of <strong>49</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    {activeSection.number > 1 && (
                      <button
                        onClick={() => {
                          const prev = APLUS_MANUAL_SECTIONS.find(
                            (s) => s.number === activeSection.number - 1
                          );
                          if (prev) setSelectedSectionId(prev.id);
                        }}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-bold cursor-pointer text-slate-700 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous (§{activeSection.number - 1})</span>
                      </button>
                    )}
                    {activeSection.number < 49 && (
                      <button
                        onClick={() => {
                          const next = APLUS_MANUAL_SECTIONS.find(
                            (s) => s.number === activeSection.number + 1
                          );
                          if (next) setSelectedSectionId(next.id);
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer flex items-center gap-1"
                      >
                        <span>Next (§{activeSection.number + 1})</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: COMPLETE 49-SECTION FORMAL SOFTWARE MANUAL (PRINT / PDF) */}
      {activeSubTab === 'full_print_manual' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>
                  Complete 49-Section Formal Software Manual (Print & PDF Master Edition)
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Includes Cover Page, Document Control, Revision History, Table of Contents, and all 49 Sections formatted for A4 archival.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!fullManualPrintRef.current) return;
                  setIsExportingPdf(true);
                  try {
                    await generateElementPdf(
                      fullManualPrintRef.current,
                      'APLUS_SCHOOL_SYSTEM_Complete_49_Section_Manual.pdf',
                      'portrait',
                      2.0,
                      {
                        addPageNumbers: true,
                        margin: 8,
                        docTitle:
                          'Aplus School System — Complete System Documentation & User Manual',
                        institutionName: orgSettings.schoolName,
                      }
                    );
                    showToast(
                      'Complete 49-Section Aplus Software Manual PDF downloaded!'
                    );
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}
                disabled={isExportingPdf}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isExportingPdf
                    ? 'Generating Complete PDF...'
                    : 'Download Complete 49-Section PDF'}
                </span>
              </button>
              <button
                onClick={() =>
                  fullManualPrintRef.current &&
                  printOrDownloadElement(fullManualPrintRef.current, {
                    title:
                      'APLUS SCHOOL SYSTEM — Complete System Documentation & User Manual',
                  })
                }
                className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Full Manual</span>
              </button>
            </div>
          </div>

          <div
            ref={fullManualPrintRef}
            className="bg-white rounded-2xl border border-slate-300 p-8 sm:p-12 shadow-xs space-y-10 max-w-5xl mx-auto"
          >
            {/* 1. Cover Page & Document Control (Per Section 49) */}
            <div className="border-4 border-double border-slate-900 p-8 sm:p-12 text-center space-y-6">
              <div className="flex justify-center">
                <SchoolLogo className="w-20 h-20" />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">
                  Official Institutional Software Specification & User Manual
                </div>
                <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
                  APLUS SCHOOL SYSTEM
                </h1>
                <h2 className="text-lg sm:text-xl font-bold text-slate-700">
                  Multi-Campus Voucher & Petty Cash Management System
                </h2>
                <p className="text-xs text-slate-500 max-w-xl mx-auto pt-2">
                  Complete System Documentation, Operational Procedures, Four-Voucher Standard (BPV, BRV, CPV, CRV, JV), Petty Cash Imprest Control & Multi-Campus Financial Reporting Manual
                </p>
              </div>

              {/* Document Control Box */}
              <div className="max-w-2xl mx-auto pt-6">
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700 w-44">
                        Document ID
                      </th>
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">
                        APS-FIN-MAN-2026-V5
                      </td>
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700 w-40">
                        Effective Date
                      </th>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        30 September 2026
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700">
                        Organization
                      </th>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {orgSettings.schoolName || 'A+ School System'}
                      </td>
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700">
                        Active Campuses
                      </th>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        {campuses.length} Campuses
                      </td>
                    </tr>
                    <tr>
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700">
                        Chart of Accounts
                      </th>
                      <td className="px-3 py-2 font-mono text-slate-800">
                        {accountHeads.length} Standard Heads (100–500)
                      </td>
                      <th className="bg-slate-100 px-3 py-2 font-bold text-slate-700">
                        Compliance Status
                      </th>
                      <td className="px-3 py-2 font-bold text-emerald-700">
                        Approved & Certified
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table of Contents */}
            <div className="space-y-3 border-b border-slate-200 pb-8">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider border-b-2 border-slate-900 pb-2">
                Master Table of Contents (Sections 1 – 49)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                {APLUS_MANUAL_SECTIONS.map((sec) => (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between border-b border-dotted border-slate-200 py-1"
                  >
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {sec.title}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      §{sec.number}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* All 49 Sections Rendered Sequentially */}
            <div className="space-y-8">
              {APLUS_MANUAL_SECTIONS.map((sec) => (
                <div
                  key={sec.id}
                  className="border-b border-slate-200 pb-6 break-inside-avoid space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-black text-slate-900">
                      {sec.title}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {sec.category}
                    </span>
                  </div>
                  {renderSectionContent(sec)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: PETTY CASH PHYSICAL RECONCILIATION (SECTIONS 17, 18, 19) */}
      {activeSubTab === 'petty_cash_reconcile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-300 p-5 shadow-xs space-y-4 print:hidden">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>Petty Cash Reconciliation Inputs (Sec 17–19)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Compare System Petty Cash Balance against Physical Safe Cash
                </p>
              </div>
              <button
                onClick={() => {
                  setCustomOpeningFloat('');
                  setCustomCashReceived('');
                  setCustomCashSpent('');
                  setPhysicalCashInput('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                title="Reset to live campus ledger figures"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Use Live Ledger</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Select School Campus
                </label>
                <select
                  value={reconcileCampusId}
                  onChange={(e) => setReconcileCampusId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Opening Balance (PKR)
                  </label>
                  <input
                    type="number"
                    placeholder={String(campusPettyStats.opening)}
                    value={customOpeningFloat}
                    onChange={(e) => setCustomOpeningFloat(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    + Cash Received (PKR)
                  </label>
                  <input
                    type="number"
                    placeholder={String(campusPettyStats.received)}
                    value={customCashReceived}
                    onChange={(e) => setCustomCashReceived(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    − Cash Spent (PKR)
                  </label>
                  <input
                    type="number"
                    placeholder={String(campusPettyStats.spent)}
                    value={customCashSpent}
                    onChange={(e) => setCustomCashSpent(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <span className="font-bold text-blue-950">
                  System Closing Balance:
                </span>
                <span className="font-mono font-black text-sm text-blue-950">
                  PKR {campusPettyStats.closingSystemBalance.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Physical Cash Available in Drawer/Safe (PKR)
                </label>
                <input
                  type="number"
                  placeholder={String(campusPettyStats.closingSystemBalance)}
                  value={physicalCashInput}
                  onChange={(e) => setPhysicalCashInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-emerald-50/50 border-2 border-emerald-500 rounded-xl font-mono text-sm font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reconciliation Remarks / Audit Note
                </label>
                <textarea
                  rows={2}
                  value={reconcileRemarks}
                  onChange={(e) => setReconcileRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setCustomOpeningFloat('20000');
                    setCustomCashReceived('10000');
                    setCustomCashSpent('7500');
                    setPhysicalCashInput('22500');
                    showToast(
                      'Loaded Section 17 Formula Example (20,000 + 10,000 − 7,500 = 22,500)'
                    );
                  }}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Load Sec 17 Example (PKR 22,500)
                </button>
                <button
                  onClick={() => {
                    setCustomOpeningFloat('25000');
                    setCustomCashReceived('0');
                    setCustomCashSpent('0');
                    setPhysicalCashInput('25000');
                    showToast(
                      'Loaded Section 19 Reconciliation Example (System PKR 25,000 vs Physical PKR 25,000)'
                    );
                  }}
                  className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold text-[11px] cursor-pointer"
                >
                  Load Sec 19 Example (PKR 25,000)
                </button>
              </div>

              <button
                onClick={() => {
                  logActivity(
                    'PETTY_CASH_RECONCILED',
                    'PettyCash',
                    `reconcile-${Date.now()}`,
                    `Petty Cash Reconciled for ${campusPettyStats.campus?.name}: System Balance PKR ${campusPettyStats.closingSystemBalance.toLocaleString()}, Physical Cash PKR ${campusPettyStats.physicalCash.toLocaleString()}, Difference PKR ${campusPettyStats.difference.toLocaleString()}.`,
                    campusPettyStats.campus?.id,
                    campusPettyStats.physicalCash
                  );
                  showToast(
                    'Petty Cash Reconciliation certified and logged to Audit Trail!'
                  );
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Certify & Log Petty Cash Reconciliation</span>
              </button>
            </div>
          </div>

          {/* Printable Petty Cash Reconciliation Statement */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex justify-end gap-2 print:hidden">
              <button
                onClick={() =>
                  reconcilePrintRef.current &&
                  generateElementPdf(
                    reconcilePrintRef.current,
                    `Aplus_Petty_Cash_Reconciliation_${campusPettyStats.campus?.code || 'Campus'}.pdf`
                  )
                }
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Certificate PDF</span>
              </button>
              <button
                onClick={() =>
                  reconcilePrintRef.current &&
                  printOrDownloadElement(reconcilePrintRef.current, {
                    title: 'Petty Cash Reconciliation Statement',
                  })
                }
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Certificate</span>
              </button>
            </div>

            <div
              ref={reconcilePrintRef}
              className="bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-xs space-y-6"
            >
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SchoolLogo className="w-12 h-12" />
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase">
                      {orgSettings.schoolName || 'APLUS SCHOOL SYSTEM'}
                    </h3>
                    <p className="text-xs text-slate-600 font-bold">
                      OFFICIAL PETTY CASH RECONCILIATION STATEMENT (SECTIONS 17–19)
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs">
                  <div className="font-bold text-slate-900">
                    Campus: {campusPettyStats.campus?.name}
                  </div>
                  <div className="text-slate-500">
                    Date: {new Date().toLocaleDateString('en-GB')}
                  </div>
                </div>
              </div>

              {/* Section 17 Formula Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  1. Petty Cash Movement Formula (Section 17)
                </div>
                <div className="p-3 bg-slate-900 text-white rounded-xl font-mono text-xs text-center font-bold">
                  Opening Balance + Cash Received − Cash Spent = Closing Balance
                </div>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-2.5 font-bold text-slate-700 bg-slate-50">
                        Opening Petty Cash Balance (Float)
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                        PKR {campusPettyStats.opening.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-2.5 font-bold text-emerald-800 bg-emerald-50/40">
                        (+) Cash Received / Replenishments
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">
                        + PKR {campusPettyStats.received.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="px-4 py-2.5 font-bold text-rose-800 bg-rose-50/40">
                        (−) Cash Spent / Petty Cash Expenses
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-700">
                        − PKR {campusPettyStats.spent.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="bg-slate-100 font-black">
                      <td className="px-4 py-3 text-slate-900">
                        (=) System Closing Petty Cash Balance
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-900">
                        PKR {campusPettyStats.closingSystemBalance.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 19 Physical Reconciliation Comparison */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  2. Physical Cash Verification (Section 19)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      System Balance
                    </span>
                    <span className="font-mono text-base font-black text-slate-900 mt-1 block">
                      PKR {campusPettyStats.closingSystemBalance.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                      Physical Cash Available
                    </span>
                    <span className="font-mono text-base font-black text-blue-900 mt-1 block">
                      PKR {campusPettyStats.physicalCash.toLocaleString()}
                    </span>
                  </div>
                  <div
                    className={`p-4 rounded-xl border text-center ${
                      campusPettyStats.difference === 0
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase block">
                      Difference
                    </span>
                    <span className="font-mono text-base font-black mt-1 block">
                      PKR {campusPettyStats.difference.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-bold block mt-0.5">
                      {campusPettyStats.difference === 0
                        ? '✓ Balanced (PKR 0)'
                        : '⚠ Review History'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <strong>Remarks:</strong> {reconcileRemarks}
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Prepared By (Custodian)
                </div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Checked By (Finance Officer)
                </div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Approved By (Administrator)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: DAILY & MONTHLY PROCEDURES CHECKLIST (SECTIONS 21, 22, 37, 38) */}
      {activeSubTab === 'procedures_checklist' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Procedure (Sections 21 & 37) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Section 21 & 37: Daily Procedure for Finance Staff
                </h3>
                <p className="text-xs text-slate-500">
                  Interactive daily operating checklist synced with Firebase Cloud
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-blue-100 text-blue-800">
                {checklistStats.dailyDone}/{checklistStats.dailyTotal} ({checklistStats.dailyPct}%)
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 mb-2">
                  At the Beginning of the Day
                </h4>
                <div className="space-y-1.5">
                  {DAILY_PROCEDURE_CHECKLIST.beginningOfDay.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        checkedItems[item.id]
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedItems[item.id])}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 mb-2">
                  During the Day
                </h4>
                <div className="space-y-1.5">
                  {DAILY_PROCEDURE_CHECKLIST.duringTheDay.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        checkedItems[item.id]
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedItems[item.id])}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-800 mb-2">
                  At the End of the Day (Daily Expense Review)
                </h4>
                <div className="space-y-1.5">
                  {DAILY_PROCEDURE_CHECKLIST.endOfDay.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        checkedItems[item.id]
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checkedItems[item.id])}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Closing Procedure (Sections 22 & 38) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-300 p-6 shadow-xs flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Section 22 & 38: Monthly Closing Procedure
                  </h3>
                  <p className="text-xs text-slate-500">
                    10-Step Month-End Financial Verification & Archive Protocol
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-black bg-amber-100 text-amber-900">
                  {checklistStats.monthlyDone}/{checklistStats.monthlyTotal} ({checklistStats.monthlyPct}%)
                </span>
              </div>

              <div className="space-y-2">
                {MONTHLY_CLOSING_CHECKLIST.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      checkedItems[item.id]
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedItems[item.id])}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => {
                  const allIds: Record<string, boolean> = {};
                  [
                    ...DAILY_PROCEDURE_CHECKLIST.beginningOfDay,
                    ...DAILY_PROCEDURE_CHECKLIST.duringTheDay,
                    ...DAILY_PROCEDURE_CHECKLIST.endOfDay,
                    ...MONTHLY_CLOSING_CHECKLIST,
                  ].forEach((i) => {
                    allIds[i.id] = true;
                  });
                  setCheckedItems(allIds);
                  localStorage.setItem(
                    'aplus_finance_procedures_checklist_v1',
                    JSON.stringify(allIds)
                  );
                  saveChecklistStateToCloud(allIds);
                  logActivity(
                    'PROCEDURES_VERIFIED',
                    'System',
                    `proc-${Date.now()}`,
                    'Completed Daily & Monthly Finance Staff Procedure Verification Checklist (Sections 37 & 38).'
                  );
                  showToast('All Daily & Monthly procedures marked complete and logged!');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Mark All Complete & Certify in Audit Log
              </button>
              <button
                onClick={() => {
                  setCheckedItems({});
                  localStorage.removeItem('aplus_finance_procedures_checklist_v1');
                  saveChecklistStateToCloud({});
                  showToast('Checklist reset for new period');
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Reset Checklists
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 5: STANDARD VOUCHER FORMAT & SECTION 42 EXAMPLE TRANSACTION */}
      {activeSubTab === 'voucher_template_demo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Section 41 Standard Voucher Format */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-300 p-6 sm:p-8 shadow-xs space-y-5">
            <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-700">
                Section 41 Official Specification
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase">
                APLUS SCHOOL SYSTEM
              </h3>
              <div className="inline-block px-4 py-1 bg-slate-900 text-white text-xs font-bold rounded-md uppercase tracking-wider">
                PAYMENT / EXPENSE VOUCHER
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-300">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="px-4 py-2.5 text-left font-black text-slate-800 w-44">
                      Field
                    </th>
                    <th className="px-4 py-2.5 text-left font-black text-slate-800">
                      Information (Section 42 Example Pre-Filled)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Voucher No.
                    </td>
                    <td className="px-4 py-2 font-mono font-bold text-blue-800">
                      APS-EXP-00001
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Date
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-900">
                      30 September 2026
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Campus
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-900">
                      Main Campus — A+ School System (Khiali Campus)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Category
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      Stationery (Account Code: 500-3-01)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Payee
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      Stationery Supplier
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Description
                    </td>
                    <td className="px-4 py-2 text-slate-800">
                      Stationery purchased for administrative and classroom use
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Amount
                    </td>
                    <td className="px-4 py-2 font-mono font-black text-emerald-700 text-sm">
                      PKR 4,500
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Payment Method
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      Cash
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Prepared By
                    </td>
                    <td className="px-4 py-2 text-slate-800">Finance User</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Checked By
                    </td>
                    <td className="px-4 py-2 text-slate-800">
                      Campus Administrator
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Approved By
                    </td>
                    <td className="px-4 py-2 text-slate-800">
                      Super Administrator / Management
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Status
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full text-[11px]">
                        Submitted → Approved → Paid
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-bold text-slate-700 bg-slate-50">
                      Remarks
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      Supporting Bill #4201 attached & verified
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                onClick={handlePostSection42Example}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  Post Section 42 Example (PKR 4,500 Stationery) to Live Ledger
                </span>
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('transaction')}
                  className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  Go to Voucher Entry →
                </button>
              )}
            </div>
          </div>

          {/* Right: Section 46 Complete 16-Step Recommended Financial Workflow */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-300 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-purple-600" />
                <span>Section 46: 16-Step Recommended Financial Workflow</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete end-to-end institutional lifecycle from Expense Occurrence to Record Archiving
              </p>
            </div>

            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {APLUS_MANUAL_SECTIONS[45].flowSteps?.map((step, idx, arr) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {step}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <ArrowDown className="w-3.5 h-3.5 text-slate-400 my-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODE 6: ORIGINAL 10 TECHNICAL ARCHITECTURE SPECIFICATIONS */}
      {activeSubTab === 'legacy_specs' && <LegacyDocs />}
    </div>
  );
};
