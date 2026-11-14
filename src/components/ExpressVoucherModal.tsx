import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Zap,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Printer,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  useAccounting,
  Campus,
  AccountHead,
  Transaction,
  VoucherEntry,
  printOrDownloadElement,
} from '../core/aplusEngine';
import { PrintableVoucherA4Layout } from './PrintableVoucherA4Layout';
import { usePrintRequestTimestamp } from '../utils/voucherPrintUtils';

interface ExpressVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoucherCreated?: (voucher: Transaction) => void;
}

type VoucherType = 'CPV' | 'CRV' | 'BPV' | 'BRV' | 'JV';

interface TemplatePreset {
  label: string;
  type: VoucherType;
  debitAccountCode: string;
  creditAccountCode: string;
  narration: string;
}

export const ExpressVoucherModal: React.FC<ExpressVoucherModalProps> = ({
  isOpen,
  onClose,
  onVoucherCreated,
}) => {
  const {
    campuses,
    currentCampusId,
    currentUser,
    orgSettings,
    accountHeads,
    getNextVoucherNumber,
    addTransaction,
    logActivity,
  } = useAccounting();

  // Selected campus: default to current user's campus or active campus
  const initialCampusId = useMemo(() => {
    if (currentUser?.campusId && currentUser.campusId !== 'all') {
      return currentUser.campusId;
    }
    if (currentCampusId && currentCampusId !== 'all') {
      return currentCampusId;
    }
    return campuses[0]?.id || 'campus-khiali';
  }, [currentUser, currentCampusId, campuses]);

  const [selectedCampusId, setSelectedCampusId] = useState<string>(initialCampusId);
  const [voucherType, setVoucherType] = useState<VoucherType>('CPV');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [chequeNo, setChequeNo] = useState('');
  const [generatedVoucherNo, setGeneratedVoucherNo] = useState('');

  // Dual entry or compound entries
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState<string>('');

  // Status & Success Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [createdVoucher, setCreatedVoucher] = useState<Transaction | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { printTimestamp, refreshPrintTimestamp } = usePrintRequestTimestamp();

  // Update campus when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCampusId(initialCampusId);
      setDate(new Date().toISOString().slice(0, 10));
      setErrorNotice(null);
      setCreatedVoucher(null);
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [isOpen, initialCampusId]);

  // Generate voucher number whenever type or campus changes
  useEffect(() => {
    if (isOpen && getNextVoucherNumber) {
      try {
        const nextNo = getNextVoucherNumber(voucherType, selectedCampusId);
        setGeneratedVoucherNo(nextNo);
      } catch {
        const campusObj = campuses.find((c) => c.id === selectedCampusId);
        const code = campusObj?.code || 'HQ';
        setGeneratedVoucherNo(`${code}-${voucherType}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
      }
    }
  }, [isOpen, voucherType, selectedCampusId, getNextVoucherNumber, campuses]);

  // Find standard Cash and Bank accounts from chart of accounts
  const cashInHandAccount = useMemo(() => {
    return (
      accountHeads.find(
        (a) => a.code === '100-4-01' || a.name.toLowerCase().includes('cash in hand')
      ) || accountHeads.find((a) => a.category === 'Asset' && a.type === 'Bank')
    );
  }, [accountHeads]);

  const primaryBankAccount = useMemo(() => {
    return (
      accountHeads.find(
        (a) => a.code === '100-4-02' || a.name.toLowerCase().includes('meezan')
      ) ||
      accountHeads.find((a) => a.category === 'Asset' && a.type === 'Bank' && a.id !== cashInHandAccount?.id) ||
      cashInHandAccount
    );
  }, [accountHeads, cashInHandAccount]);

  // Auto-fill standard accounts based on voucher type
  useEffect(() => {
    if (!isOpen) return;

    if (voucherType === 'CPV') {
      // Cash Payment: Credit = Cash In Hand, Debit = Expense
      if (cashInHandAccount && !creditAccountId) {
        setCreditAccountId(cashInHandAccount.id);
      }
      const expHead = accountHeads.find((a) => a.category === 'Expense');
      if (expHead && !debitAccountId) {
        setDebitAccountId(expHead.id);
      }
    } else if (voucherType === 'CRV') {
      // Cash Receipt: Debit = Cash In Hand, Credit = Revenue (Tuition Fee)
      if (cashInHandAccount && !debitAccountId) {
        setDebitAccountId(cashInHandAccount.id);
      }
      const revHead = accountHeads.find((a) => a.category === 'Revenue');
      if (revHead && !creditAccountId) {
        setCreditAccountId(revHead.id);
      }
    } else if (voucherType === 'BPV') {
      // Bank Payment: Credit = Bank Account
      if (primaryBankAccount && !creditAccountId) {
        setCreditAccountId(primaryBankAccount.id);
      }
      const expHead = accountHeads.find((a) => a.category === 'Expense');
      if (expHead && !debitAccountId) {
        setDebitAccountId(expHead.id);
      }
    } else if (voucherType === 'BRV') {
      // Bank Receipt: Debit = Bank Account
      if (primaryBankAccount && !debitAccountId) {
        setDebitAccountId(primaryBankAccount.id);
      }
      const revHead = accountHeads.find((a) => a.category === 'Revenue');
      if (revHead && !creditAccountId) {
        setCreditAccountId(revHead.id);
      }
    }
  }, [voucherType, isOpen, cashInHandAccount, primaryBankAccount, accountHeads]);

  // Quick 1-Click Templates
  const TEMPLATES: TemplatePreset[] = useMemo(() => [
    {
      label: '💡 Electricity / Utility Bill',
      type: 'CPV',
      debitAccountCode: '500-2-01', // Electricity or first expense
      creditAccountCode: '100-4-01', // Cash
      narration: 'Monthly electricity bill paid in cash',
    },
    {
      label: '🎓 Student Tuition Fee Collection',
      type: 'CRV',
      debitAccountCode: '100-4-01', // Cash
      creditAccountCode: '400-1-01', // Tuition Fee
      narration: 'Student monthly tuition fee collected via official receipt',
    },
    {
      label: '💼 Faculty & Staff Salary (Bank)',
      type: 'BPV',
      debitAccountCode: '300-5-01', // Salaries Payable or Expense
      creditAccountCode: '100-4-02', // Meezan Bank
      narration: 'Staff monthly salaries disbursed via bank transfer',
    },
    {
      label: '📦 Stationery & Repairs Expense',
      type: 'CPV',
      debitAccountCode: '500-4-01', // General Admin Expense
      creditAccountCode: '100-4-01', // Cash
      narration: 'Classroom stationery and minor maintenance expense',
    },
  ], []);

  const applyTemplate = (t: TemplatePreset) => {
    setVoucherType(t.type);
    setNarration(t.narration);

    const dr = accountHeads.find((a) => a.code === t.debitAccountCode) || accountHeads.find((a) => a.category === (t.type === 'CPV' || t.type === 'BPV' ? 'Expense' : 'Asset'));
    const cr = accountHeads.find((a) => a.code === t.creditAccountCode) || accountHeads.find((a) => a.category === (t.type === 'CRV' || t.type === 'BRV' ? 'Revenue' : 'Asset'));

    if (dr) setDebitAccountId(dr.id);
    if (cr) setCreditAccountId(cr.id);
    setErrorNotice(null);
  };

  const numAmount = parseFloat(amount) || 0;
  const isBalanced = numAmount > 0 && Boolean(debitAccountId) && Boolean(creditAccountId) && debitAccountId !== creditAccountId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    if (numAmount <= 0) {
      setErrorNotice('Please enter a valid monetary amount greater than zero.');
      return;
    }
    if (!debitAccountId) {
      setErrorNotice('Please select a valid Debit Account.');
      return;
    }
    if (!creditAccountId) {
      setErrorNotice('Please select a valid Credit Account.');
      return;
    }
    if (debitAccountId === creditAccountId) {
      setErrorNotice('Debit and Credit cannot be posted to the same identical account head.');
      return;
    }

    const drHead = accountHeads.find((a) => a.id === debitAccountId);
    const crHead = accountHeads.find((a) => a.id === creditAccountId);

    if (!drHead || !crHead) {
      setErrorNotice('Selected account heads could not be found.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedCampus = campuses.find((c) => c.id === selectedCampusId);
      const campusCode = selectedCampus?.code || 'HQ';
      const cleanVoucherNo = generatedVoucherNo || `${campusCode}-${voucherType}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

      const entries: VoucherEntry[] = [
        {
          id: `entry-${Date.now()}-1`,
          accountId: drHead.id,
          accountCode: drHead.code,
          accountName: drHead.name,
          description: narration || `${voucherType} Entry`,
          debit: numAmount,
          credit: 0,
        },
        {
          id: `entry-${Date.now()}-2`,
          accountId: crHead.id,
          accountCode: crHead.code,
          accountName: crHead.name,
          description: narration || `${voucherType} Entry`,
          debit: 0,
          credit: numAmount,
        },
      ];

      const newTx: any = {
        voucherNo: cleanVoucherNo,
        voucherType,
        campusId: selectedCampusId,
        clientId: currentUser?.clientId || undefined,
        date,
        narration: narration || `Express ${voucherType} for ${selectedCampus?.name || 'Campus'}`,
        chequeNo: chequeNo.trim() || undefined,
        entries,
        totalDebit: numAmount,
        totalCredit: numAmount,
        status: 'Posted',
        preparedBy: currentUser?.name || currentUser?.username || 'Campus Accountant',
      };

      const created = addTransaction(newTx);

      // Audit Log
      if (logActivity) {
        logActivity(
          'CREATE_VOUCHER',
          'Voucher',
          created.id || cleanVoucherNo,
          `Express posted ${voucherType} #${cleanVoucherNo} for Rs. ${numAmount.toLocaleString('en-PK')}`,
          selectedCampusId,
          numAmount,
          { voucherNo: cleanVoucherNo, voucherType }
        );
      }

      setCreatedVoucher(created);
      onVoucherCreated?.(created);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Could not post voucher. Check fields and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setCreatedVoucher(null);
    setAmount('');
    setNarration('');
    setChequeNo('');
    setErrorNotice(null);
    if (getNextVoucherNumber) {
      setGeneratedVoucherNo(getNextVoucherNumber(voucherType, selectedCampusId));
    }
  };

  if (!isOpen) return null;

  const currentCampusObj = campuses.find((c) => c.id === selectedCampusId);

  const handlePrintCreatedVoucher = async () => {
    refreshPrintTimestamp();
    await new Promise((r) => setTimeout(r, 30));
    if (printRef.current && createdVoucher) {
      try {
        await printOrDownloadElement(printRef.current, {
          title: `${createdVoucher.voucherType}_${createdVoucher.voucherNo}`,
          fallbackFileName: `Voucher_${createdVoucher.voucherNo}`,
          orientation: 'portrait',
        });
        return;
      } catch {}
    }
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="express-voucher-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150 voucher-print-modal-backdrop"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 voucher-print-modal-card">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 id="express-voucher-title" className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>Express Voucher Entry</span>
                <span className="text-[10px] bg-indigo-800/80 text-indigo-200 px-2 py-0.5 rounded-full font-mono font-bold">
                  Overlay Mode
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Rapid double-entry posting without page reload • Auto-saved to global Firestore
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close express voucher overlay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Screen after Posting */}
        {createdVoucher ? (
          <div className="p-5 sm:p-6 text-center space-y-4 overflow-y-auto flex-1 print:p-0 print:overflow-visible">
            <div className="space-y-4 print:hidden">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Voucher Successfully Posted & Synced!
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Voucher <strong className="font-mono text-indigo-700">#{createdVoucher.voucherNo}</strong> has
                  been securely posted to the general ledger and automatically persisted to the global cloud datastore.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 max-w-md mx-auto text-xs grid grid-cols-2 gap-2 text-left">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Voucher Type</span>
                  <p className="font-bold text-slate-900">{createdVoucher.voucherType}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Amount Posted</span>
                  <p className="font-mono font-bold text-emerald-700">
                    Rs. {Number(createdVoucher.totalDebit || 0).toLocaleString('en-PK')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Campus Branch</span>
                  <p className="font-semibold text-slate-800 truncate">
                    {currentCampusObj?.name || createdVoucher.campusId}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Posting Date</span>
                  <p className="font-mono text-slate-800">{createdVoucher.date}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePrintCreatedVoucher}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Voucher</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetForAnother}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Another Voucher</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Close Overlay
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-left max-h-[340px] overflow-y-auto print:border-none print:max-h-none print:overflow-visible">
              <div ref={printRef} id="printable-voucher-document">
                <PrintableVoucherA4Layout
                  voucher={createdVoucher}
                  campus={currentCampusObj}
                  campuses={campuses}
                  currentCampusId={currentCampusId}
                  orgSettings={orgSettings}
                  printTimestamp={printTimestamp}
                  showConfigureBar={false}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Form Screen */
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            {errorNotice && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Quick Template Presets */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> 1-Click Fast Templates:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-semibold text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Top Row: Voucher Type & Campus Branch Defaults */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Voucher Type Pills */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  1. Voucher Standard Type:
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {(['CPV', 'CRV', 'BPV', 'BRV', 'JV'] as VoucherType[]).map((t) => {
                    const isSelected = voucherType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVoucherType(t)}
                        className={`py-1.5 rounded-lg font-mono font-black text-xs transition-all cursor-pointer border ${
                          isSelected
                            ? t === 'CPV'
                              ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                              : t === 'CRV'
                              ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                              : t === 'BPV'
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : t === 'BRV'
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 font-semibold'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {voucherType === 'CPV' && 'Cash Payment Voucher (Disbursement)'}
                  {voucherType === 'CRV' && 'Cash Receipt Voucher (Collection)'}
                  {voucherType === 'BPV' && 'Bank Payment Voucher (Cheque / Transfer)'}
                  {voucherType === 'BRV' && 'Bank Receipt Voucher (Deposit)'}
                  {voucherType === 'JV' && 'Journal Voucher (Non-cash / Adjusting)'}
                </span>
              </div>

              {/* Pre-filled Campus Branch */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  2. Campus Branch (Pre-filled):
                </label>
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <select
                    value={selectedCampusId}
                    onChange={(e) => setSelectedCampusId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 w-full focus:outline-hidden cursor-pointer"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) {c.id === currentUser?.campusId ? '★ My Campus' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                  <span>Voucher No: <strong className="text-slate-900">{generatedVoucherNo}</strong></span>
                  <span>Auto-allocated</span>
                </div>
              </div>
            </div>

            {/* Date, Amount & Cheque No Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Voucher Date:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 w-full focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Amount in PKR: <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-indigo-400 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500">
                  <span className="font-bold text-xs text-indigo-700">Rs.</span>
                  <input
                    ref={firstInputRef}
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="bg-transparent text-sm font-mono font-black text-slate-900 w-full focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  {voucherType === 'BPV' || voucherType === 'BRV' ? 'Cheque / Ref #:' : 'Receipt / Ref #:'}
                </label>
                <input
                  type="text"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  placeholder={voucherType.startsWith('B') ? 'e.g. CHQ-98124' : 'Optional ref'}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-full focus:outline-hidden"
                />
              </div>
            </div>

            {/* Double Entry Posting Rows (Debit & Credit) */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-black uppercase text-slate-700 block">
                3. Double-Entry Ledger Heads (Balanced IAS 1):
              </span>

              {/* Debit Account Head Selector */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    DEBIT ACCOUNT (Dr):
                  </span>
                  <span className="font-mono text-[11px] text-emerald-800 font-bold">
                    {numAmount > 0 ? `Rs. ${numAmount.toLocaleString('en-PK')}` : '—'}
                  </span>
                </div>
                <select
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Select Debit Account Head --</option>
                  {accountHeads.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name} ({acc.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Credit Account Head Selector */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-blue-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    CREDIT ACCOUNT (Cr):
                  </span>
                  <span className="font-mono text-[11px] text-blue-800 font-bold">
                    {numAmount > 0 ? `Rs. ${numAmount.toLocaleString('en-PK')}` : '—'}
                  </span>
                </div>
                <select
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Select Credit Account Head --</option>
                  {accountHeads.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.name} ({acc.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Invariant Balance Status Strip */}
              <div
                className={`flex items-center justify-between text-xs p-2 rounded-lg font-semibold ${
                  isBalanced
                    ? 'bg-emerald-100/70 border border-emerald-300 text-emerald-900'
                    : 'bg-amber-100/70 border border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isBalanced ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Info className="w-4 h-4 text-amber-600" />
                  )}
                  <span>
                    {isBalanced
                      ? '✓ Double-Entry Invariant: Debits equal Credits (Rs. ' + numAmount.toLocaleString('en-PK') + ')'
                      : 'Ensure both accounts are selected and amount is greater than zero.'}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase font-bold">
                  {isBalanced ? 'Balanced' : 'Pending'}
                </span>
              </div>
            </div>

            {/* Narration */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Voucher Narration / Description:
              </label>
              <textarea
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Enter description of transaction, payee name, or institutional reference..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
              <div className="text-[11px] text-slate-500">
                Prepared By: <strong>{currentUser?.name || 'Accountant'}</strong>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !isBalanced}
                  className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isBalanced && !isSubmitting
                      ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:opacity-95 text-white shadow-emerald-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>{isSubmitting ? 'Posting...' : '⚡ Post & Save to Cloud'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
