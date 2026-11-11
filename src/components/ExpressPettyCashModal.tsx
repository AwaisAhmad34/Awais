import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Wallet,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';

interface ExpressPettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPettyCashRecorded?: (item: any) => void;
}

export const ExpressPettyCashModal: React.FC<ExpressPettyCashModalProps> = ({
  isOpen,
  onClose,
  onPettyCashRecorded,
}) => {
  const {
    campuses,
    currentCampusId,
    currentUser,
    accountHeads,
    getNextPettyCashNumber,
    addPettyCashTransaction,
    logActivity,
  } = useAccounting();

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
  const [type, setType] = useState<'Disbursement' | 'Replenishment'>('Disbursement');
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Office Supplies');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [narration, setNarration] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
  const [voucherNo, setVoucherNo] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [recordedItem, setRecordedItem] = useState<any | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedCampusId(initialCampusId);
      setDate(new Date().toISOString().slice(0, 10));
      setErrorNotice(null);
      setRecordedItem(null);
      setTimeout(() => amountInputRef.current?.focus(), 80);
    }
  }, [isOpen, initialCampusId]);

  useEffect(() => {
    if (isOpen && getNextPettyCashNumber) {
      try {
        const nextNo = getNextPettyCashNumber(selectedCampusId);
        setVoucherNo(nextNo);
      } catch {
        const c = campuses.find((x) => x.id === selectedCampusId);
        setVoucherNo(`${c?.code || 'HQ'}-PC-${Date.now().toString().slice(-4)}`);
      }
    }
  }, [isOpen, selectedCampusId, getNextPettyCashNumber, campuses]);

  const campus = campuses.find((c) => c.id === selectedCampusId);
  const currentFloat = Number(campus?.pettyCashFloat || 25000);
  const currentBalance = Number(campus?.currentPettyCash || currentFloat);

  const numAmount = parseFloat(amount) || 0;
  const projectedBalance =
    type === 'Disbursement'
      ? currentBalance - numAmount
      : currentBalance + numAmount;

  const CATEGORIES = [
    'Office Supplies & Stationery',
    'Faculty & Guest Refreshments',
    'Daily Transport & Courier',
    'Classroom Minor Repairs',
    'Sanitation & Cleaning Items',
    'Minor Emergency Utilities',
    'Science Lab Consumables',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    if (numAmount <= 0) {
      setErrorNotice('Please enter a valid amount greater than zero.');
      return;
    }
    if (!payee.trim()) {
      setErrorNotice('Please enter payee name or person receiving payment.');
      return;
    }
    if (type === 'Disbursement' && projectedBalance < 0) {
      setErrorNotice(
        `Disbursement of Rs. ${numAmount.toLocaleString()} exceeds available petty cash balance (Rs. ${currentBalance.toLocaleString()}). Replenishment required.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        voucherNo: voucherNo || `PC-${Date.now().toString().slice(-4)}`,
        campusId: selectedCampusId,
        clientId: currentUser?.clientId || undefined,
        date,
        type,
        payee: payee.trim(),
        category,
        amount: numAmount,
        narration: narration.trim() || `${category} - ${payee.trim()}`,
        receiptNo: receiptNo.trim() || undefined,
        approvedBy: currentUser?.name || 'Campus Accountant',
      };

      addPettyCashTransaction(payload);

      if (logActivity) {
        logActivity(
          type === 'Disbursement' ? 'PETTY_CASH_EXPENSE' : 'PETTY_CASH_REPLENISH',
          'PettyCash',
          payload.voucherNo,
          `Recorded Petty Cash ${type} #${payload.voucherNo} for Rs. ${numAmount.toLocaleString('en-PK')} (${payee})`,
          selectedCampusId,
          numAmount,
          { category, payee }
        );
      }

      setRecordedItem(payload);
      onPettyCashRecorded?.(payload);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Could not record petty cash. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAnother = () => {
    setRecordedItem(null);
    setAmount('');
    setPayee('');
    setNarration('');
    setReceiptNo('');
    setErrorNotice(null);
    if (getNextPettyCashNumber) {
      setVoucherNo(getNextPettyCashNumber(selectedCampusId));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="express-petty-cash-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 id="express-petty-cash-title" className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>Record Petty Cash</span>
                <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
                  Imprest Float
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Instant cash voucher recording • Updates available float in real-time
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {recordedItem ? (
          <div className="p-6 text-center space-y-4 my-auto overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                Petty Cash Entry Successfully Saved!
              </h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                Slip <strong className="font-mono text-emerald-700">#{recordedItem.voucherNo}</strong> recorded
                for <span className="font-semibold text-slate-900">{recordedItem.payee}</span>.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-w-sm mx-auto text-xs grid grid-cols-2 gap-2 text-left">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Amount</span>
                <p className="font-mono font-bold text-emerald-700">
                  Rs. {Number(recordedItem.amount).toLocaleString('en-PK')}
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Category</span>
                <p className="font-semibold text-slate-800 truncate">{recordedItem.category}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Campus</span>
                <p className="font-semibold text-slate-800 truncate">{campus?.name || recordedItem.campusId}</p>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold">Date</span>
                <p className="font-mono text-slate-800">{recordedItem.date}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetAnother}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Another Slip</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-3.5">
            {errorNotice && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Type & Campus */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Transaction Type:
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setType('Disbursement')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'Disbursement'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('Replenishment')}
                    className={`py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      type === 'Replenishment'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Refill
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Campus Branch:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    value={selectedCampusId}
                    onChange={(e) => setSelectedCampusId(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 w-full focus:outline-hidden cursor-pointer"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Float Balance Indicator Strip */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">
                  Available Petty Cash Float
                </span>
                <span className="font-mono text-sm font-black text-emerald-950">
                  Rs. {currentBalance.toLocaleString('en-PK')}
                </span>
                <span className="text-[10px] text-slate-500 ml-1.5">
                  (Float: Rs. {currentFloat.toLocaleString('en-PK')})
                </span>
              </div>

              {numAmount > 0 && (
                <div className="text-right">
                  <span className="text-[10px] text-slate-600 font-bold uppercase block">
                    Balance After {type === 'Disbursement' ? 'Expense' : 'Refill'}
                  </span>
                  <span
                    className={`font-mono font-black text-sm ${
                      projectedBalance < 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    Rs. {projectedBalance.toLocaleString('en-PK')}
                  </span>
                </div>
              )}
            </div>

            {/* Amount & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Amount in PKR: <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 border-2 border-emerald-400 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500">
                  <span className="font-bold text-xs text-emerald-700">Rs.</span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1200"
                    className="bg-transparent text-sm font-mono font-black text-slate-900 w-full focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Voucher Date:
                </label>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-slate-900 w-full focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Payee & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Payee / Recipient: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  placeholder="e.g. Aslam Khan / Gatekeeper"
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-full focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-900 w-full focus:outline-hidden cursor-pointer"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Narration & Receipt # */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Expense Narration / Purpose:
                </label>
                <input
                  type="text"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Brief reason for expense..."
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-full focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Receipt / Bill #:
                </label>
                <input
                  type="text"
                  value={receiptNo}
                  onChange={(e) => setReceiptNo(e.target.value)}
                  placeholder="Slip #"
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 w-full focus:outline-hidden"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
              <div className="text-[10px] text-slate-500 font-mono">
                Voucher #: <strong>{voucherNo}</strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || numAmount <= 0 || !payee.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                    numAmount > 0 && payee.trim() && !isSubmitting
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Saving...' : '⚡ Record & Save to Cloud'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
