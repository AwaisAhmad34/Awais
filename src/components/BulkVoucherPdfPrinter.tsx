import React, { useMemo, useState } from 'react';
import {
  Printer,
  FileDown,
  CheckSquare,
  Square,
  Search,
  Lock,
  ShieldAlert,
  FileText,
  Layers,
  Eye,
} from 'lucide-react';
import {
  useAccounting,
  generateElementPdf,
  printOrDownloadElement,
} from '../core/aplusEngine';
import { useTenantAuth } from '../context/TenantAuthContext';
import { publishCampusActivityEvent } from './RealTimeCampusActivityStream';

function numberToWordsPKR(num: number): string {
  const n = Math.round(Math.abs(num || 0));
  if (n === 0) return 'Zero Rupees Only';
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const underThousand = (val: number): string => {
    if (val === 0) return '';
    if (val < 20) return ones[val];
    if (val < 100) {
      return `${tens[Math.floor(val / 10)]}${
        val % 10 ? ' ' + ones[val % 10] : ''
      }`;
    }
    return `${ones[Math.floor(val / 100)]} Hundred${
      val % 100 ? ' and ' + underThousand(val % 100) : ''
    }`;
  };

  let rem = n;
  const parts: string[] = [];
  if (rem >= 10000000) {
    parts.push(`${underThousand(Math.floor(rem / 10000000))} Crore`);
    rem %= 10000000;
  }
  if (rem >= 100000) {
    parts.push(`${underThousand(Math.floor(rem / 100000))} Lakh`);
    rem %= 100000;
  }
  if (rem >= 1000) {
    parts.push(`${underThousand(Math.floor(rem / 1000))} Thousand`);
    rem %= 1000;
  }
  if (rem > 0) {
    parts.push(underThousand(rem));
  }
  return `Rupees ${parts.join(' ')} Only`;
}

export interface BulkVoucherPdfPrinterProps {
  organizationName: string;
  organizationCode: string;
  campusFilterLabel?: string;
}

export const BulkVoucherPdfPrinter: React.FC<BulkVoucherPdfPrinterProps> = ({
  organizationName,
  organizationCode,
  campusFilterLabel,
}) => {
  const { transactions, campuses } = useAccounting();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>(() =>
    transactions.slice(0, 3).map((t) => t.id)
  );
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const filteredVouchers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'ALL' && tx.voucherType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && tx.status !== statusFilter) return false;
      if (q) {
        const hay = `${tx.voucherNo} ${tx.narration} ${tx.voucherType} ${
          tx.chequeNo || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, typeFilter, statusFilter]);

  const selectedVouchers = useMemo(() => {
    const idSet = new Set(selectedVoucherIds);
    return transactions.filter((tx) => idSet.has(tx.id));
  }, [transactions, selectedVoucherIds]);

  const allFilteredSelected =
    filteredVouchers.length > 0 &&
    filteredVouchers.every((tx) => selectedVoucherIds.includes(tx.id));

  // Generate a single multi-page PDF document with page breaks between each selected voucher
  const handleDownloadBulkMultiPagePdf = async () => {
    if (selectedVouchers.length === 0) return;
    setIsGeneratingPdf(true);
    setShowPrintPreview(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const sheetContainer = document.getElementById(
        'printable-voucher-document'
      );
      const fileName = `Bulk_Vouchers_${organizationCode}_${selectedVouchers.length}_Pages.pdf`;
      if (sheetContainer) {
        await generateElementPdf(sheetContainer, fileName, 'portrait', 2, {
          addPageNumbers: true,
          margin: 8,
          docTitle: `Multi-Voucher Batch (${selectedVouchers.length} Vouchers)`,
          institutionName: organizationName,
        });
      }
      const totalBatchPKR = selectedVouchers.reduce(
        (acc, t) => acc + (t.totalDebit || 0),
        0
      );
      publishCampusActivityEvent({
        organizationId: 'inst-aplus-main',
        organizationCode,
        organizationName,
        campusId: 'tcamp-aplus-main-1',
        campusCode: 'MAIN-CAMPUS',
        campusName: `${organizationName} Campus`,
        campusLoginId: `LOGIN-${organizationCode}`,
        actorName: 'Campus Administrator',
        actorEmail: `admin@${organizationCode.toLowerCase()}.edu.pk`,
        actorRole: 'Campus Admin',
        category: 'DATA_EXPORT',
        severity: 'MEDIUM',
        actionCode: 'BULK_VOUCHER_PDF_BATCH_DOWNLOADED',
        summary: `Exported ${selectedVouchers.length} selected ledger vouchers into single multi-page PDF (${fileName}) with page breaks.`,
        amountPKR: totalBatchPKR,
        ipAddress: '119.160.98.14',
        cityLocation: 'Pakistan',
      });
      setStatusToast(
        `Generated single printable PDF (${fileName}) containing ${selectedVouchers.length} vouchers with dedicated A4 page breaks between each voucher.`
      );
      setTimeout(() => setStatusToast(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleNativeBrowserBatchPrint = async () => {
    setShowPrintPreview(true);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const sheetContainer = document.getElementById(
      'printable-voucher-document'
    );
    await printOrDownloadElement(sheetContainer, {
      title: `${organizationName} — Bulk Vouchers (${selectedVouchers.length})`,
      orientation: 'portrait',
      fallbackFileName: `Bulk_Vouchers_${organizationCode}.pdf`,
    });
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-500 p-5 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-600" />
            <h3 className="font-black text-sm text-slate-900 uppercase">
              Multi-Voucher Bulk PDF & A4 Batch Print Engine (Page Break Between Each Voucher)
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Select multiple vouchers from the ledger below to generate a single, multi-page printable PDF document with dedicated A4 page breaks between each voucher.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={selectedVouchers.length === 0 || isGeneratingPdf}
            onClick={handleDownloadBulkMultiPagePdf}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FileDown className="w-4 h-4" />
            <span>
              {isGeneratingPdf
                ? 'Generating PDF...'
                : `Download Single PDF (${selectedVouchers.length} Vouchers · Page Breaks)`}
            </span>
          </button>

          <button
            type="button"
            disabled={selectedVouchers.length === 0}
            onClick={() => setShowPrintPreview((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-amber-300 font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>
              {showPrintPreview
                ? 'Hide Multi-Page A4 Preview'
                : `Preview & Print (${selectedVouchers.length} Pages)`}
            </span>
          </button>

          {showPrintPreview && (
            <button
              type="button"
              onClick={handleNativeBrowserBatchPrint}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Batch Now</span>
            </button>
          )}
        </div>
      </div>

      {statusToast && (
        <div className="bg-emerald-50 border border-emerald-400 text-emerald-950 px-3.5 py-2.5 rounded-xl font-bold">
          ✓ {statusToast}
        </div>
      )}

      {/* Filter & Bulk Selection Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
        <div className="sm:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">
            Search Ledger Vouchers
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by Voucher No (BPV/BRV/CPV/CRV/JV) or narration..."
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Voucher Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All Types (BPV/BRV/CPV/CRV/JV)</option>
            <option value="BPV">BPV — Bank Payment</option>
            <option value="BRV">BRV — Bank Receipt</option>
            <option value="CPV">CPV — Cash Payment</option>
            <option value="CRV">CRV — Cash Receipt</option>
            <option value="JV">JV — Journal Voucher</option>
          </select>
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Quick Selection
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setSelectedVoucherIds(filteredVouchers.map((t) => t.id))
              }
              className="flex-1 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold cursor-pointer"
            >
              Select All ({filteredVouchers.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedVoucherIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Voucher Selection Table */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 font-black text-slate-700 uppercase sticky top-0">
              <th className="p-2 text-center w-10 border-b border-slate-200">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedVoucherIds(filteredVouchers.map((t) => t.id));
                    } else {
                      setSelectedVoucherIds([]);
                    }
                  }}
                  className="cursor-pointer"
                />
              </th>
              <th className="p-2 text-left border-b border-slate-200">Voucher No</th>
              <th className="p-2 text-center border-b border-slate-200">Type</th>
              <th className="p-2 text-left border-b border-slate-200">Date</th>
              <th className="p-2 text-left border-b border-slate-200">Narration</th>
              <th className="p-2 text-right border-b border-slate-200">Amount (PKR)</th>
              <th className="p-2 text-center border-b border-slate-200">Access Policy</th>
            </tr>
          </thead>
          <tbody>
            {filteredVouchers.slice(0, 30).map((tx) => {
              const checked = selectedVoucherIds.includes(tx.id);
              return (
                <tr
                  key={tx.id}
                  onClick={() => {
                    if (checked) {
                      setSelectedVoucherIds((prev) =>
                        prev.filter((id) => id !== tx.id)
                      );
                    } else {
                      setSelectedVoucherIds((prev) => [...prev, tx.id]);
                    }
                  }}
                  className={`border-b border-slate-200 cursor-pointer hover:bg-slate-50 ${
                    checked ? 'bg-indigo-50/70' : ''
                  }`}
                >
                  <td
                    className="p-2 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedVoucherIds((prev) => [...prev, tx.id]);
                        } else {
                          setSelectedVoucherIds((prev) =>
                            prev.filter((id) => id !== tx.id)
                          );
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="p-2 font-mono font-black text-indigo-900">
                    {tx.voucherNo}
                  </td>
                  <td className="p-2 text-center font-mono font-bold">
                    {tx.voucherType}
                  </td>
                  <td className="p-2 font-mono">{tx.date}</td>
                  <td className="p-2 truncate max-w-xs">{tx.narration}</td>
                  <td className="p-2 text-right font-mono font-black">
                    PKR {(tx.totalDebit || 0).toLocaleString()}
                  </td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[10px]">
                      Show & Bulk Print Only
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Multi-Voucher Printable Sheet Preview with Page Breaks Between Each Voucher */}
      {showPrintPreview && selectedVouchers.length > 0 && (
        <div
          id="printable-voucher-document"
          className="space-y-6 pt-3 border-t-2 border-slate-300"
        >
          {selectedVouchers.map((tx, idx) => {
            const camp = campuses.find((c) => c.id === tx.campusId);
            return (
              <div
                key={tx.id}
                className={`a4-voucher-sheet a4-voucher-pad-standard a4-voucher-typo-11pt border-2 border-slate-900 rounded-xl bg-white shadow-sm ${
                  idx > 0 ? 'break-before-page print-break-before' : ''
                }`}
              >
                <div className="bg-slate-900 text-white p-4 rounded-t-lg flex items-center justify-between">
                  <div>
                    <div className="text-base font-black uppercase">
                      {organizationName}
                    </div>
                    <div className="text-[11px] text-amber-300 font-mono">
                      {organizationCode} · {camp?.name || tx.campusId}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded">
                      {tx.voucherType} VOUCHER · Page {idx + 1} of{' '}
                      {selectedVouchers.length}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-1">
                      Voucher No: {tx.voucherNo} | Date: {tx.date}
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <table className="w-full border-collapse border border-slate-400 text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-black uppercase">
                        <th className="border border-slate-400 p-2 text-left">
                          Account Code
                        </th>
                        <th className="border border-slate-400 p-2 text-left">
                          Account Head & Description
                        </th>
                        <th className="border border-slate-400 p-2 text-right">
                          Debit (PKR)
                        </th>
                        <th className="border border-slate-400 p-2 text-right">
                          Credit (PKR)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tx.entries || []).map((ent, i) => (
                        <tr key={ent.id || i}>
                          <td className="border border-slate-400 p-2 font-mono font-bold">
                            {ent.accountCode}
                          </td>
                          <td className="border border-slate-400 p-2">
                            <span className="font-bold">{ent.accountName}</span>
                            {ent.description ? ` — ${ent.description}` : ''}
                          </td>
                          <td className="border border-slate-400 p-2 text-right font-mono">
                            {ent.debit ? ent.debit.toLocaleString() : '-'}
                          </td>
                          <td className="border border-slate-400 p-2 text-right font-mono">
                            {ent.credit ? ent.credit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-black">
                        <td
                          colSpan={2}
                          className="border border-slate-400 p-2 text-right uppercase"
                        >
                          Total Voucher Amount (PKR)
                        </td>
                        <td className="border border-slate-400 p-2 text-right font-mono">
                          {(tx.totalDebit || 0).toLocaleString()}
                        </td>
                        <td className="border border-slate-400 p-2 text-right font-mono">
                          {(tx.totalCredit || 0).toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="text-xs space-y-1">
                    <div>
                      <strong>Amount in Words:</strong>{' '}
                      {numberToWordsPKR(tx.totalDebit || 0)}
                    </div>
                    <div>
                      <strong>Narration / Particulars:</strong> {tx.narration}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 pt-8 text-center text-[11px] font-bold">
                    <div className="border-t border-slate-800 pt-1">
                      Prepared By
                    </div>
                    <div className="border-t border-slate-800 pt-1">
                      Checked By
                    </div>
                    <div className="border-t border-slate-800 pt-1">
                      Campus Admin
                    </div>
                    <div className="border-t border-slate-800 pt-1">
                      Approved By
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Global Site Owner Entry Creation & Mutation Lock Guard:
 * Enforces the strict rule that Site Owner (`platform_super_admin`) CANNOT create
 * any type of entry in Vouchers, Petty Cash, Opening Balances, or ERP Ledgers.
 * Site Owner can only manage Clients, Campuses, Logins, Header/Footer, Monthly Invoices,
 * and view/print existing entries.
 */
export const SiteOwnerEntryCreationGuard: React.FC = () => {
  const { platformRole } = useTenantAuth();
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  const isSiteOwnerMode =
    (platformRole || 'platform_super_admin') === 'platform_super_admin';

  React.useEffect(() => {
    if (!isSiteOwnerMode) return;

    // Intercept any form submission or entry creation button outside the Site Admin Console
    const handleCaptureSubmit = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Allow Site Admin forms inside MultiSchoolAdminPanel (marked with data-site-admin-form="true")
      if (target.closest('[data-site-admin-allowed="true"]')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setBlockedMsg(
        'Site Owner Policy Enforced: Site Owner (Platform Super Admin) is strictly prohibited from creating or modifying any Voucher, Petty Cash, or Ledger Entry. Switch to Campus Admin or Accountant role to post entries.'
      );
      setTimeout(() => setBlockedMsg(null), 5500);
    };

    const handleCaptureClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-site-admin-allowed="true"]')) {
        return;
      }
      const btn = target.closest('button');
      if (!btn) return;
      const text = (btn.textContent || '').toLowerCase();
      const isEntryCreateAction =
        text.includes('save voucher') ||
        text.includes('post voucher') ||
        text.includes('submit voucher') ||
        text.includes('add expense') ||
        text.includes('record disbursement') ||
        text.includes('replenish float') ||
        text.includes('save opening') ||
        text.includes('delete voucher') ||
        text.includes('auto-post');

      if (isEntryCreateAction) {
        e.preventDefault();
        e.stopPropagation();
        setBlockedMsg(
          `Action Blocked ("${btn.textContent?.trim()}"): Site Owner cannot create, post, or delete any Voucher, Petty Cash, or Ledger Entry.`
        );
        setTimeout(() => setBlockedMsg(null), 5500);
      }
    };

    document.addEventListener('submit', handleCaptureSubmit, true);
    document.addEventListener('click', handleCaptureClick, true);
    return () => {
      document.removeEventListener('submit', handleCaptureSubmit, true);
      document.removeEventListener('click', handleCaptureClick, true);
    };
  }, [isSiteOwnerMode]);

  if (!blockedMsg) return null;

  return (
    <div className="fixed bottom-12 right-4 z-50 max-w-md bg-rose-950 text-white border-2 border-rose-400 rounded-2xl p-4 shadow-2xl flex items-start gap-3 text-xs print:hidden">
      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
      <div>
        <div className="font-black uppercase text-rose-300">
          Site Owner Entry Creation Blocked
        </div>
        <p className="text-[11px] text-rose-100 mt-1">{blockedMsg}</p>
      </div>
    </div>
  );
};
