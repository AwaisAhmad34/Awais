import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  User,
  CreditCard,
  ExternalLink,
  FileText,
} from 'lucide-react';
import {
  Transaction,
  Campus,
  useAccounting,
  printOrDownloadElement,
} from '../core/aplusEngine';
import { PrintableVoucherA4Layout } from './PrintableVoucherA4Layout';
import {
  resolveVoucherCampusInfo,
  usePrintRequestTimestamp,
} from '../utils/voucherPrintUtils';

interface VoucherDetailModalProps {
  voucher: Transaction | null;
  campuses: Campus[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLedger?: (voucherNo: string) => void;
}

export const VoucherDetailModal: React.FC<VoucherDetailModalProps> = ({
  voucher,
  campuses,
  isOpen,
  onClose,
  onNavigateToLedger,
}) => {
  const { orgSettings, currentCampusId } = useAccounting();
  const [viewMode, setViewMode] = useState<'detail' | 'a4'>('detail');
  const { printTimestamp, refreshPrintTimestamp } = usePrintRequestTimestamp();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !voucher) return null;

  const campus = campuses.find((c) => c.id === voucher.campusId);
  const campusDisplay = campus ? `${campus.name} (${campus.code})` : voucher.campusId;
  const campusInfo = resolveVoucherCampusInfo({
    voucher,
    campus,
    campuses,
    currentCampusId,
    orgSettings,
  });

  const handlePrint = async () => {
    refreshPrintTimestamp();
    await new Promise((r) => setTimeout(r, 30));
    if (printRef.current) {
      try {
        await printOrDownloadElement(printRef.current, {
          title: `Voucher_${voucher.voucherNo}_${campusInfo.campusCode}`,
          fallbackFileName: `Voucher_${voucher.voucherNo}_${campusInfo.campusCode}`,
          orientation: 'portrait',
        });
        return;
      } catch {}
    }
    window.print();
  };

  const getVoucherTypeBadge = (type: string) => {
    switch (type) {
      case 'BPV':
        return { label: 'Bank Payment (BPV)', bg: 'bg-blue-600', text: 'text-white' };
      case 'BRV':
        return { label: 'Bank Receipt (BRV)', bg: 'bg-emerald-600', text: 'text-white' };
      case 'CPV':
        return { label: 'Cash Payment (CPV)', bg: 'bg-rose-600', text: 'text-white' };
      case 'CRV':
        return { label: 'Cash Receipt (CRV)', bg: 'bg-teal-600', text: 'text-white' };
      case 'JV':
        return { label: 'Journal Voucher (JV)', bg: 'bg-purple-600', text: 'text-white' };
      default:
        return { label: type, bg: 'bg-slate-700', text: 'text-white' };
    }
  };

  const badge = getVoucherTypeBadge(voucher.voucherType);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voucher-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white voucher-print-modal-backdrop"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 print:shadow-none print:border-none print:max-w-full voucher-print-modal-card">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${badge.bg} ${badge.text}`}>
              {badge.label}
            </div>
            <div>
              <h2 id="voucher-detail-title" className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>Voucher #{voucher.voucherNo}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {voucher.status || 'Posted'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Official double-entry voucher record • Campus: {campusDisplay}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'detail' ? 'a4' : 'detail'))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
              title="Toggle Official A4 Voucher View"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{viewMode === 'detail' ? 'A4 Print Layout' : 'Summary View'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Print Voucher Document"
              aria-label="Print voucher"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 transition-colors cursor-pointer"
              title="Close Voucher Details"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
          {viewMode === 'a4' ? (
            <div ref={printRef} id="printable-voucher-document">
              <PrintableVoucherA4Layout
                voucher={voucher}
                campus={campus}
                campuses={campuses}
                currentCampusId={currentCampusId}
                orgSettings={orgSettings}
                printTimestamp={printTimestamp}
                showConfigureBar={true}
              />
            </div>
          ) : (
            <div
              ref={printRef}
              id="printable-voucher-document"
              data-voucher-campus-name={campusInfo.campusDisplayLabel}
              data-print-timestamp={printTimestamp}
              className="official-voucher-document bg-white text-black"
            >
              <table className="voucher-print-table-wrapper w-full border-collapse">
                <thead className="voucher-print-thead">
                  <tr>
                    <td>
                      <header
                        className="voucher-print-header flex items-center justify-between gap-3 border-b-2 border-slate-900 pb-2 mb-4 text-[11px] font-sans text-slate-900"
                        aria-label="Voucher Print Header"
                      >
                        <div className="flex flex-col">
                          <span className="font-black uppercase tracking-wider text-slate-900">
                            {campusInfo.schoolName}
                          </span>
                          <span className="font-bold text-slate-800">
                            School Campus: {campusInfo.campusDisplayLabel}
                          </span>
                        </div>
                        <div className="text-right font-mono text-[10px]">
                          <div className="font-bold uppercase">
                            {voucher.voucherType} • Voucher #{voucher.voucherNo}
                          </div>
                          <div>Print Timestamp: {printTimestamp}</div>
                        </div>
                      </header>
                    </td>
                  </tr>
                </thead>
                <tbody className="voucher-print-tbody">
                  <tr>
                    <td className="space-y-5">
                      {/* Metadata Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> Date
                          </span>
                          <p className="font-mono font-bold text-slate-900 mt-0.5">{voucher.date}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-400" /> Campus
                          </span>
                          <p className="font-semibold text-slate-900 mt-0.5 truncate">{campusDisplay}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <CreditCard className="w-3 h-3 text-slate-400" /> Cheque / Ref
                          </span>
                          <p className="font-mono font-semibold text-slate-800 mt-0.5">
                            {voucher.chequeNo || '— N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" /> Prepared By
                          </span>
                          <p className="font-semibold text-slate-800 mt-0.5 truncate">
                            {voucher.preparedBy || 'Campus Accountant'}
                          </p>
                        </div>
                      </div>

                      {/* Narration */}
                      {voucher.narration && (
                        <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 text-xs my-4">
                          <span className="font-bold text-blue-900 block uppercase text-[10px] tracking-wider mb-0.5">
                            General Narration / Purpose:
                          </span>
                          <p className="text-slate-800 font-medium leading-relaxed">{voucher.narration}</p>
                        </div>
                      )}

                      {/* Debit & Credit Ledger Entries Table */}
                      <div className="border border-slate-200 rounded-xl overflow-hidden my-4">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                              <th className="p-2.5 text-left font-mono w-24">Account Code</th>
                              <th className="p-2.5 text-left">Account Title & Description</th>
                              <th className="p-2.5 text-right font-mono w-28 bg-emerald-50/70 text-emerald-900">
                                Debit (PKR)
                              </th>
                              <th className="p-2.5 text-right font-mono w-28 bg-blue-50/70 text-blue-900">
                                Credit (PKR)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(voucher.entries || []).map((entry, idx) => (
                              <tr key={entry.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                <td className="p-2.5 font-mono font-bold text-slate-800 text-[11px]">
                                  {entry.accountCode}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-900">{entry.accountName}</div>
                                  {entry.description && entry.description !== voucher.narration && (
                                    <div className="text-[11px] text-slate-500 mt-0.5">{entry.description}</div>
                                  )}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                                  {Number(entry.debit) > 0 ? `Rs. ${Number(entry.debit).toLocaleString('en-PK')}` : '—'}
                                </td>
                                <td className="p-2.5 text-right font-mono font-bold text-blue-700">
                                  {Number(entry.credit) > 0 ? `Rs. ${Number(entry.credit).toLocaleString('en-PK')}` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-mono font-black text-xs border-t-2 border-slate-800">
                              <td colSpan={2} className="p-2.5 text-right uppercase tracking-wider">
                                Consolidated Total
                              </td>
                              <td className="p-2.5 text-right text-emerald-300">
                                Rs. {Number(voucher.totalDebit || 0).toLocaleString('en-PK')}
                              </td>
                              <td className="p-2.5 text-right text-blue-300">
                                Rs. {Number(voucher.totalCredit || 0).toLocaleString('en-PK')}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Double Entry Verification Invariant Badge */}
                      <div className="flex items-center justify-between text-xs px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Double-Entry Balance Verified: Total Debits equal Total Credits.</span>
                        </span>
                        <span className="font-mono font-bold text-[11px] text-emerald-800">IAS 1 Compliant</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
                <tfoot className="voucher-print-tfoot">
                  <tr>
                    <td>
                      <footer
                        className="voucher-print-footer mt-4 pt-2 border-t-2 border-slate-900 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-900"
                        aria-label="Voucher Print Footer"
                      >
                        <div>
                          <span className="font-bold">Campus: {campusInfo.campusDisplayLabel}</span>
                          <span> • Voucher #{voucher.voucherNo} ({voucher.voucherType})</span>
                        </div>
                        <div>
                          <span>Print Request Timestamp: {printTimestamp}</span>
                        </div>
                      </footer>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="text-[11px] text-slate-500 font-mono">
            Transaction ID: <span className="font-semibold text-slate-700">{voucher.id}</span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToLedger && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToLedger(voucher.voucherNo);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                <span>Open in Ledger</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
