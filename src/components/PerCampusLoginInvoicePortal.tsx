import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Download,
  CreditCard,
  Eye,
  Plus,
  ShieldCheck,
  FileText,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  ClientMonthlyInvoice,
  SchoolInstituteAccount,
  TenantCampusNode,
} from './MultiSchoolAdminPanel';
import { getStoredSiteOwnerGovernance } from './SiteOwnerGovernanceEngine';

export interface CampusInvoiceBreakdownItem {
  campusId: string;
  campusCode: string;
  campusName: string;
  campusLoginId: string;
  monthlyFeePKR: number;
  status: 'Active' | 'Waived' | 'Suspended';
}

interface PerCampusLoginInvoicePortalProps {
  invoices: ClientMonthlyInvoice[];
  activeInstitute: SchoolInstituteAccount;
  tenantCampuses: TenantCampusNode[];
  isSiteOwner?: boolean;
  onUpdateInvoiceStatus?: (
    invoiceId: string,
    newStatus: ClientMonthlyInvoice['status']
  ) => void;
  onGenerateInvoice?: (e: React.FormEvent) => void;
  onTriggerToast?: (msg: string) => void;
}

export const PerCampusLoginInvoicePortal: React.FC<
  PerCampusLoginInvoicePortalProps
> = ({
  invoices,
  activeInstitute,
  tenantCampuses,
  isSiteOwner = false,
  onUpdateInvoiceStatus,
  onGenerateInvoice,
  onTriggerToast,
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<ClientMonthlyInvoice | null>(
    null
  );
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentTxRef, setPaymentTxRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentProofNotes, setPaymentProofNotes] = useState<string>('');

  // Per-campus breakdown helper
  const getInvoiceCampusLineItems = (
    invoice: ClientMonthlyInvoice
  ): CampusInvoiceBreakdownItem[] => {
    // Find all campuses belonging to this organization
    const orgCampuses = tenantCampuses.filter(
      (c) => c.organizationId === invoice.organizationId
    );

    if (orgCampuses.length > 0) {
      return orgCampuses.map((c) => ({
        campusId: c.id,
        campusCode: c.code,
        campusName: c.name,
        campusLoginId: c.campusLoginId,
        monthlyFeePKR: invoice.perCampusFeePKR || 4000,
        status: c.campusLoginEnabled ? 'Active' : 'Suspended',
      }));
    }

    // Default item if no tenant campuses registered yet
    return [
      {
        campusId: 'camp-main',
        campusCode: 'MAIN',
        campusName: `${invoice.organizationName} — Main Campus`,
        campusLoginId: `LOGIN-${invoice.organizationCode}-MAIN`,
        monthlyFeePKR: invoice.perCampusFeePKR || 5000,
        status: 'Active',
      },
    ];
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const handleSubmitPaymentProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentTxRef.trim()) return;

    if (onTriggerToast) {
      onTriggerToast(
        `Payment proof (${paymentTxRef}) submitted for Invoice ${selectedInvoice.invoiceNo}. Site Owner has been notified for verification.`
      );
    }
    setShowPaymentModal(false);
    setPaymentTxRef('');
    setPaymentProofNotes('');
  };

  const govState = getStoredSiteOwnerGovernance();
  const clientCtrl = govState.clientControls[activeInstitute?.id];
  const isQrAllowed = clientCtrl ? clientCtrl.allowQrCodeVerification : true;

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-600 p-5 space-y-4 shadow-sm text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Customer Portal · Monthly Invoicing Module
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-mono font-black text-[10px]">
                Itemized Per-Campus Login Billing
              </span>
            </div>
            <h3 className="font-black text-sm sm:text-base text-slate-900 mt-0.5">
              Monthly Invoices Issued to {activeInstitute.name} ({activeInstitute.code})
            </h3>
            <p className="text-[11px] text-slate-600">
              Each monthly invoice includes itemized subscription charges for each active Campus Login ID + Base Multi-Campus Platform ERP license.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-500">
            {invoices.length} Invoice(s) On Record
          </span>
        </div>
      </div>

      {/* Invoice Table with Per-Campus Breakdown */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="p-3">Invoice #</th>
              <th className="p-3">Billing Month</th>
              <th className="p-3">Per-Campus Login Breakdown</th>
              <th className="p-3 text-right">Base License (PKR)</th>
              <th className="p-3 text-right">Campus Logins Total (PKR)</th>
              <th className="p-3 text-right">Grand Total (PKR)</th>
              <th className="p-3 text-center">Due Date</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.map((inv) => {
              const campusItems = getInvoiceCampusLineItems(inv);
              const campusLoginsTotal = campusItems.reduce(
                (sum, c) => sum + (c.status === 'Waived' ? 0 : c.monthlyFeePKR),
                0
              );

              return (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-black text-slate-900">
                    {inv.invoiceNo}
                  </td>
                  <td className="p-3 font-bold text-slate-900">
                    {inv.billingMonth}
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {campusItems.map((c) => (
                        <div
                          key={c.campusId}
                          className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded border border-slate-200 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-indigo-900 text-[10px]">
                              {c.campusLoginId}
                            </span>
                            <span className="text-slate-700 truncate max-w-[140px]">
                              {c.campusName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 font-mono font-bold">
                            <span>PKR {c.monthlyFeePKR.toLocaleString()}</span>
                            <span
                              className={`px-1 rounded text-[8px] uppercase ${
                                c.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-700">
                    PKR {(inv.basePlatformFeePKR || 12000).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-indigo-900">
                    PKR {campusLoginsTotal.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">
                    PKR {inv.totalAmountPKR.toLocaleString()}
                  </td>
                  <td className="p-3 text-center font-mono text-slate-600">
                    {inv.dueDate}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full font-black text-[10px] uppercase ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : inv.status === 'Overdue'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer"
                      >
                        View & Print →
                      </button>

                      {!isSiteOwner && inv.status !== 'Paid' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setShowPaymentModal(true);
                          }}
                          className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[10px] cursor-pointer"
                        >
                          Submit Proof
                        </button>
                      )}

                      {isSiteOwner && onUpdateInvoiceStatus && (
                        <select
                          value={inv.status}
                          onChange={(e) =>
                            onUpdateInvoiceStatus(inv.id, e.target.value as any)
                          }
                          className="px-1.5 py-1 rounded border border-slate-300 font-bold text-[10px] bg-white"
                        >
                          <option value="Paid">Mark Paid</option>
                          <option value="Unpaid">Mark Unpaid</option>
                          <option value="Overdue">Mark Overdue</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail & Print Modal */}
      {selectedInvoice && !showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-indigo-600 p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-700" />
                <h4 className="font-black text-sm text-slate-900">
                  Itemized Per-Campus Invoice Details ({selectedInvoice.invoiceNo})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Invoice Document */}
            <div className="p-4 border border-slate-300 rounded-xl space-y-4 bg-white text-slate-900">
              {/* Institution & Invoice Title Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-black text-indigo-950 uppercase">
                    A+ Cloud School ERP & Multi-Campus System
                  </h2>
                  <p className="text-[11px] text-slate-600">
                    Official Monthly Per-Campus Billing & License Invoice
                  </p>
                  <div className="mt-1 text-[11px] text-slate-700">
                    Billed To: <strong>{selectedInvoice.organizationName}</strong> ({selectedInvoice.organizationCode})
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-black text-indigo-900">
                    {selectedInvoice.invoiceNo}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Date: {selectedInvoice.createdAt.slice(0, 10)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Due Date: <strong>{selectedInvoice.dueDate}</strong>
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      selectedInvoice.status === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div>
                <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 block mb-1">
                  Itemized Service & Campus Login Charges
                </span>
                <table className="w-full border-collapse border border-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                      <th className="border border-slate-200 p-2 text-left">Description / Service</th>
                      <th className="border border-slate-200 p-2 text-center">Login ID / Code</th>
                      <th className="border border-slate-200 p-2 text-right">Fee (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Base ERP License Item */}
                    <tr className="border-b border-slate-200">
                      <td className="border border-slate-200 p-2">
                        <div className="font-bold">Base Multi-Campus Cloud ERP Platform License</div>
                        <div className="text-[10px] text-slate-500">
                          Voucher Entry, Double-Entry General Ledger, Audit Trails & Reports Engine
                        </div>
                      </td>
                      <td className="border border-slate-200 p-2 text-center font-mono">
                        {selectedInvoice.organizationCode}
                      </td>
                      <td className="border border-slate-200 p-2 text-right font-mono font-bold">
                        PKR {(selectedInvoice.basePlatformFeePKR || 12000).toLocaleString()}
                      </td>
                    </tr>

                    {/* Per-Campus Login Line Items */}
                    {getInvoiceCampusLineItems(selectedInvoice).map((camp) => (
                      <tr key={camp.campusId} className="border-b border-slate-200">
                        <td className="border border-slate-200 p-2">
                          <div className="font-bold">Campus Login Access: {camp.campusName}</div>
                          <div className="text-[10px] text-slate-500">
                            Dedicated Campus Admin, Accountant & Cashier Sub-Portal Access
                          </div>
                        </td>
                        <td className="border border-slate-200 p-2 text-center font-mono text-indigo-900 font-bold">
                          {camp.campusLoginId}
                        </td>
                        <td className="border border-slate-200 p-2 text-right font-mono font-bold">
                          PKR {camp.monthlyFeePKR.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-black text-slate-900">
                      <td colSpan={2} className="border border-slate-200 p-2 text-right uppercase">
                        Total Amount Payable:
                      </td>
                      <td className="border border-slate-200 p-2 text-right font-mono text-sm text-indigo-900">
                        PKR {selectedInvoice.totalAmountPKR.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Bank Remittance Instructions */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px]">
                <div className="font-bold text-slate-800">
                  Bank Remittance / Payment Instructions:
                </div>
                <div className="font-mono text-slate-600">
                  Bank: <strong>Meezan Bank Ltd / HBL</strong> · Account Title: <strong>A+ School System Central ERP</strong>
                </div>
                <div className="font-mono text-slate-600">
                  IBAN: <strong>PK72MEZN0001928374650192</strong> · Ref: <strong>{selectedInvoice.invoiceNo}</strong>
                </div>
              </div>

              {/* QR Verification & Signatures */}
              <div className="flex justify-between items-end pt-2 text-[10px] text-slate-500">
                <div>
                  {isQrAllowed && (
                    <div className="font-mono">
                      ✓ System Digitally Verified · Token Hash:{' '}
                      {selectedInvoice.id.slice(-8).toUpperCase()}
                    </div>
                  )}
                  <div>Thank you for choosing A+ Multi-Campus ERP.</div>
                </div>
                <div className="text-right border-t border-slate-400 pt-1 w-44 font-bold text-slate-700">
                  Authorized Billing Desk
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Proof Submission Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitPaymentProof}
            className="bg-white rounded-2xl border-2 border-indigo-600 p-5 max-w-md w-full space-y-3 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-black text-sm text-slate-900">
                Submit Payment Proof for {selectedInvoice.invoiceNo}
              </h4>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bank Deposit Slip # / Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  value={paymentTxRef}
                  onChange={(e) => setPaymentTxRef(e.target.value)}
                  placeholder="e.g. TRX-9921448 or Slip # 88219"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Additional Notes (Bank branch, deposit mode, etc.)
                </label>
                <textarea
                  value={paymentProofNotes}
                  onChange={(e) => setPaymentProofNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Transferred via online banking to Meezan Bank..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black cursor-pointer shadow-sm"
              >
                Submit Payment Proof
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
