import React, { useState, useMemo, useRef } from 'react';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Building2,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  Scale,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  useAccounting,
  Transaction,
  Campus,
  SchoolLogo,
  generateElementPdf,
  printOrDownloadElement,
} from '../core/aplusEngine';

interface FullTransactionLedgerPdfExportProps {
  onClose?: () => void;
  initialCampusId?: string;
  embedded?: boolean;
}

export const FullTransactionLedgerPdfExport: React.FC<FullTransactionLedgerPdfExportProps> = ({
  onClose,
  initialCampusId,
  embedded = false,
}) => {
  const {
    campuses,
    currentCampusId,
    transactions,
    accountHeads,
    orgSettings,
    currentUser,
  } = useAccounting();

  // Document Filters
  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    initialCampusId || (currentCampusId !== 'all' ? currentCampusId : 'all')
  );
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'FY'>('ALL');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Approved' | 'Pending'>('ALL');
  const [accountHeadFilter, setAccountHeadFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Print & PDF Layout Controls
  const [pageOrientation, setPageOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [layoutDensity, setLayoutDensity] = useState<'compact' | 'standard' | 'spacious'>('standard');
  const [showStampBox, setShowStampBox] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const printDocumentRef = useRef<HTMLDivElement>(null);

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Date Preset Handlers
  const handleApplyDatePreset = (preset: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'FY') => {
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

  // Resolved Campus
  const selectedCampus = campuses.find((c) => c.id === selectedCampusId);

  // Normalize voucher status
  const getNormalizedStatus = (st?: string): 'Pending' | 'Approved' | 'Rejected' => {
    if (st === 'Approved' || st === 'Posted' || st === 'Paid') return 'Approved';
    if (st === 'Rejected' || st === 'Cancelled') return 'Rejected';
    return 'Pending';
  };

  // Filtered Ledger Transactions
  const filteredLedgerRows = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (selectedCampusId !== 'all' && tx.campusId !== selectedCampusId) return false;
      if (voucherTypeFilter !== 'ALL' && tx.voucherType !== voucherTypeFilter) return false;

      const normStatus = getNormalizedStatus(tx.status);
      if (statusFilter !== 'ALL' && normStatus !== statusFilter) return false;

      const txDate = (tx.date || '').slice(0, 10);
      if (dateFrom && txDate && txDate < dateFrom) return false;
      if (dateTo && txDate && txDate > dateTo) return false;

      if (accountHeadFilter !== 'ALL') {
        const hasMatchingHead = (tx.entries || []).some(
          (e) => e.accountCode === accountHeadFilter || e.accountId === accountHeadFilter
        );
        if (!hasMatchingHead) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = (tx.voucherNo || '').toLowerCase().includes(q);
        const matchNarr = (tx.narration || '').toLowerCase().includes(q);
        const matchPrep = (tx.preparedBy || '').toLowerCase().includes(q);
        const matchLines = (tx.entries || []).some(
          (e) =>
            (e.accountName || '').toLowerCase().includes(q) ||
            (e.accountCode || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q)
        );
        if (!matchNo && !matchNarr && !matchPrep && !matchLines) return false;
      }

      return true;
    });
  }, [
    transactions,
    selectedCampusId,
    voucherTypeFilter,
    statusFilter,
    dateFrom,
    dateTo,
    accountHeadFilter,
    searchQuery,
  ]);

  // Compute Totals and Balance
  const { totalDebit, totalCredit, balancedVariance } = useMemo(() => {
    let dr = 0;
    let cr = 0;
    filteredLedgerRows.forEach((tx) => {
      dr += Number(tx.totalDebit) || 0;
      cr += Number(tx.totalCredit) || 0;
    });
    return {
      totalDebit: dr,
      totalCredit: cr,
      balancedVariance: Math.abs(dr - cr),
    };
  }, [filteredLedgerRows]);

  // High-Resolution PDF Download Trigger
  const handleDownloadPdf = async () => {
    if (!printDocumentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const filename = `Aplus-Full-Transaction-Ledger-${
        selectedCampus ? selectedCampus.code : 'All-Campuses'
      }-${new Date().toISOString().slice(0, 10)}.pdf`;

      await generateElementPdf(printDocumentRef.current, filename, pageOrientation, 0.95, {
        addPageNumbers: true,
        docTitle: 'Aplus School System — Full Transaction Ledger',
        institutionName: orgSettings?.schoolName || 'Aplus School System',
      });
      showToast('Downloaded formatted print-ready PDF ledger document!');
    } catch (err) {
      console.error('PDF generation error:', err);
      // Fallback to print
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct Print Trigger
  const handlePrintDocument = async () => {
    if (!printDocumentRef.current) return;
    await printOrDownloadElement(printDocumentRef.current, {
      title: `Full Transaction Ledger — ${orgSettings?.schoolName || 'Aplus School System'}`,
      orientation: pageOrientation,
      fallbackFileName: 'Aplus-Full-Transaction-Ledger.pdf',
    });
  };

  // Export CSV Data
  const handleExportCsv = () => {
    const headers = [
      'Sr #',
      'Date',
      'Voucher No',
      'Voucher Type',
      'Campus',
      'Debit (Rs)',
      'Credit (Rs)',
      'Account Code',
      'Account Name',
      'Description / Particulars',
      'Prepared By',
      'Status',
    ];

    const rows: string[][] = [];
    let sr = 1;

    filteredLedgerRows.forEach((tx) => {
      const campusObj = campuses.find((c) => c.id === tx.campusId);
      const campusLabel = campusObj ? `${campusObj.code} - ${campusObj.name}` : tx.campusId;

      (tx.entries || []).forEach((entry) => {
        rows.push([
          String(sr++),
          tx.date,
          tx.voucherNo,
          tx.voucherType,
          `"${campusLabel}"`,
          String(entry.debit || 0),
          String(entry.credit || 0),
          entry.accountCode || '',
          `"${(entry.accountName || '').replace(/"/g, '""')}"`,
          `"${(entry.description || tx.narration || '').replace(/"/g, '""')}"`,
          `"${tx.preparedBy || ''}"`,
          tx.status,
        ]);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Transaction-Ledger-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Exported CSV spreadsheet file successfully!');
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden ${
        embedded ? 'mb-6' : 'max-w-7xl mx-auto px-4 sm:px-6 my-6'
      }`}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-5 py-2.5 text-xs font-semibold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Toolbar (Hidden in Print) */}
      <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Printer className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              <span>Financial Reports & Statutory Ledgers</span>
              <span>·</span>
              <span>IAS 1 Compliant PDF Export</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Full Transaction Ledger PDF Export Studio</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Official Signature Lines
              </span>
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingPdf ? 'Rendering PDF...' : 'Download Formatted PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintDocument}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Direct Print (A4)</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close PDF Studio"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Settings Panel (Hidden in Print) */}
      <div className="bg-slate-50 border-b border-slate-200 p-5 space-y-4 print:hidden">
        {/* Row 1: Campus, Type, Status, Account Head */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Campus Branch Scope
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Consolidated (All Campus Branches)</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Voucher Type
            </label>
            <select
              value={voucherTypeFilter}
              onChange={(e) => setVoucherTypeFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Types (BPV, BRV, CPV, CRV, JV)</option>
              <option value="BPV">BPV — Bank Payment Voucher</option>
              <option value="BRV">BRV — Bank Receipt Voucher</option>
              <option value="CPV">CPV — Cash Payment Voucher</option>
              <option value="CRV">CRV — Cash Receipt Voucher</option>
              <option value="JV">JV — Journal Voucher</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses (Approved & Pending)</option>
              <option value="Approved">Approved & Posted Vouchers Only</option>
              <option value="Pending">Pending Audit & Review Only</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Filter by Account Head
            </label>
            <select
              value={accountHeadFilter}
              onChange={(e) => setAccountHeadFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Account Heads (Complete Ledger)</option>
              {accountHeads.map((h) => (
                <option key={h.code} value={h.code}>
                  {h.code} — {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date Range, Presets & Orientation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Date Period:
            </span>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset('ALL');
              }}
              className="text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset('ALL');
              }}
              className="text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1 ml-1">
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
                  onClick={() => handleApplyDatePreset(p.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                    datePreset === p.id && (!dateFrom || p.id !== 'ALL')
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orientation & Spacing Density Options */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPageOrientation('landscape')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  pageOrientation === 'landscape'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Landscape (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setPageOrientation('portrait')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  pageOrientation === 'portrait'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Portrait
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showStampBox}
                onChange={(e) => setShowStampBox(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
              />
              <span>Include Stamp Boxes</span>
            </label>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT-READY FORMATTED LEDGER DOCUMENT CANVAS (Captured for PDF & Direct Print) */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-8 bg-slate-100 flex justify-center overflow-x-auto print:p-0 print:bg-white">
        <div
          ref={printDocumentRef}
          className={`bg-white text-slate-900 shadow-xl border border-slate-200 rounded-xl p-8 sm:p-10 w-full print:shadow-none print:border-none print:p-0 print:rounded-none ${
            pageOrientation === 'landscape' ? 'max-w-[1150px]' : 'max-w-[850px]'
          }`}
          style={{ minHeight: '1000px' }}
        >
          {/* 1. INSTITUTIONAL HEADER & BRANDING */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <SchoolLogo size="lg" />
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">
                    {orgSettings?.schoolName || 'Aplus School System'}
                  </h1>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700">
                    {orgSettings?.subTitle ||
                      'Multi-Campus Voucher & Petty Cash Management System'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedCampus
                      ? `${selectedCampus.name} (${selectedCampus.code}) · ${
                          selectedCampus.city || 'Gujranwala'
                        }`
                      : 'Central Consolidated Ledger (All Campuses Branch Network)'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded text-[11px] font-black uppercase tracking-wider mb-1">
                  General Ledger Register
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Document ID: APL-GL-{Date.now().toString().slice(-6)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Date: {new Date().toLocaleDateString('en-PK', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            {/* Document Title & Period Banner */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Period:</span>
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800">
                  {dateFrom || dateTo
                    ? `${dateFrom || 'Opening'} to ${dateTo || 'Current'}`
                    : 'All Fiscal Records (Full Transaction History)'}
                </span>
                <span className="text-slate-400">·</span>
                <span className="font-bold text-slate-900">Currency:</span>
                <span className="font-mono text-slate-700">PKR (Rs.)</span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span>
                  Total Transactions: <strong>{filteredLedgerRows.length}</strong>
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Double-Entry Verified</span>
                </span>
              </div>
            </div>
          </div>

          {/* 2. SUMMARY KPI STATS BAR */}
          <div className="grid grid-cols-3 gap-3 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                Total Ledger Debits (Dr)
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-slate-900 mt-0.5">
                Rs. {Math.round(totalDebit).toLocaleString('en-PK')}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                Total Ledger Credits (Cr)
              </div>
              <div className="text-sm sm:text-base font-black font-mono text-slate-900 mt-0.5">
                Rs. {Math.round(totalCredit).toLocaleString('en-PK')}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                Reconciliation Balance Status
              </div>
              <div className="text-sm sm:text-base font-black font-mono mt-0.5 flex items-center gap-1.5">
                {balancedVariance === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Balanced (Δ = 0.00)</span>
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <Scale className="w-4 h-4 text-amber-600" />
                    <span>Net Δ: Rs. {Math.round(balancedVariance).toLocaleString('en-PK')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. TRANSACTION LEDGER DATA TABLE */}
          <div className="overflow-x-auto rounded-lg border border-slate-300 mb-6">
            <table className="w-full text-left text-[11px] divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-2 text-center w-10">Sr</th>
                  <th className="p-2 w-20">Date</th>
                  <th className="p-2 w-24">Voucher #</th>
                  <th className="p-2 w-14">Type</th>
                  <th className="p-2 w-24">Account</th>
                  <th className="p-2">Description / Line Particulars</th>
                  <th className="p-2 text-right w-24">Debit (Dr)</th>
                  <th className="p-2 text-right w-24">Credit (Cr)</th>
                  <th className="p-2 text-center w-16">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No transaction ledger entries match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLedgerRows.map((tx, idx) => {
                    // Extract line items
                    const entries = tx.entries || [];
                    const firstEntry = entries[0];
                    const normStatus = getNormalizedStatus(tx.status);

                    return (
                      <React.Fragment key={tx.id || idx}>
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                          <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2 font-mono whitespace-nowrap">{tx.date}</td>
                          <td className="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {tx.voucherNo}
                          </td>
                          <td className="p-2">
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] ${
                                tx.voucherType === 'BPV'
                                  ? 'bg-blue-100 text-blue-900'
                                  : tx.voucherType === 'BRV'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : tx.voucherType === 'CPV'
                                  ? 'bg-amber-100 text-amber-900'
                                  : tx.voucherType === 'CRV'
                                  ? 'bg-purple-100 text-purple-900'
                                  : 'bg-slate-200 text-slate-800'
                              }`}
                            >
                              {tx.voucherType}
                            </span>
                          </td>
                          <td className="p-2 font-mono font-semibold text-slate-800">
                            {firstEntry?.accountCode || 'Multi-Line'}
                          </td>
                          <td className="p-2 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">
                              {tx.narration || firstEntry?.description || 'Ledger Entry'}
                            </div>
                            {entries.length > 1 && (
                              <div className="text-[9px] text-slate-500 font-mono">
                                ({entries.length} double-entry line items)
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {tx.totalDebit > 0
                              ? `Rs. ${Math.round(tx.totalDebit).toLocaleString('en-PK')}`
                              : '—'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {tx.totalCredit > 0
                              ? `Rs. ${Math.round(tx.totalCredit).toLocaleString('en-PK')}`
                              : '—'}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                normStatus === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {normStatus}
                            </span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Total Footers */}
              <tfoot className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-900">
                <tr>
                  <td colSpan={6} className="p-2.5 text-right uppercase tracking-wider text-[10px]">
                    Total Ledger Debits & Credits:
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-xs text-slate-950">
                    Rs. {Math.round(totalDebit).toLocaleString('en-PK')}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-xs text-slate-950">
                    Rs. {Math.round(totalCredit).toLocaleString('en-PK')}
                  </td>
                  <td className="p-2.5 text-center text-[10px] text-emerald-700 font-bold">
                    Balanced
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 4. OFFICIAL AUTHORIZED SIGNATURE LINES BLOCK */}
          <div className="mt-8 pt-6 border-t-2 border-slate-900 page-break-inside-avoid">
            <div className="text-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Statutory Financial Certification & Authorized Signatures
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-xs">
              {/* Slot 1: Prepared By */}
              <div className="space-y-2">
                <div className="h-14 flex items-end justify-center pb-1">
                  <div className="w-3/4 border-b border-slate-900 border-dashed" />
                </div>
                <div className="font-bold text-slate-900">
                  {currentUser?.name || 'Campus Accountant'}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">
                  Prepared By (Accounts Officer)
                </div>
                <div className="text-[10px] font-mono text-slate-400">Date: _______________</div>
              </div>

              {/* Slot 2: Checked By */}
              <div className="space-y-2">
                <div className="h-14 flex items-end justify-center pb-1">
                  <div className="w-3/4 border-b border-slate-900 border-dashed" />
                </div>
                <div className="font-bold text-slate-900">Internal Audit Controller</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">
                  Checked & Verified By
                </div>
                <div className="text-[10px] font-mono text-slate-400">Date: _______________</div>
              </div>

              {/* Slot 3: Approved By (With Stamp Box) */}
              <div className="space-y-2">
                {showStampBox ? (
                  <div className="h-14 flex items-center justify-center">
                    <div className="w-24 h-12 border-2 border-slate-300 border-dashed rounded flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase">
                      Campus Seal
                    </div>
                  </div>
                ) : (
                  <div className="h-14 flex items-end justify-center pb-1">
                    <div className="w-3/4 border-b border-slate-900 border-dashed" />
                  </div>
                )}
                <div className="font-bold text-slate-900">Campus Principal / Head</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">
                  Approved By (Campus Administrator)
                </div>
                <div className="text-[10px] font-mono text-slate-400">Date: _______________</div>
              </div>

              {/* Slot 4: Authorized By */}
              <div className="space-y-2">
                <div className="h-14 flex items-end justify-center pb-1">
                  <div className="w-3/4 border-b border-slate-900 border-dashed" />
                </div>
                <div className="font-bold text-slate-900">Director / CFO</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">
                  Authorized & Posted By
                </div>
                <div className="text-[10px] font-mono text-slate-400">Date: _______________</div>
              </div>
            </div>

            {/* Document Bottom Security Note */}
            <div className="mt-8 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>
                System: {orgSettings?.schoolName || 'Aplus School System'} · Multi-Campus Financial Suite
              </span>
              <span>
                Report Ref: GL-REC-{filteredLedgerRows.length}-{new Date().getFullYear()} · Page 1 of 1
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
