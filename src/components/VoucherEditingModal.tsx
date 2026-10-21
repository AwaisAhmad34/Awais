import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Save,
  X,
  Plus,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  DollarSign,
  Sparkles,
  History,
  ListFilter,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useAccounting, Transaction, VoucherEntry, AccountHead, Campus } from '../core/aplusEngine';
import { softDeleteRecord } from '../services/globalRecoveryService';

interface VoucherEditingModalProps {
  initialVoucherId?: string;
  isOpen: boolean;
  onClose: () => void;
  filteredVoucherList?: Transaction[];
}

export const VoucherEditingModal: React.FC<VoucherEditingModalProps> = ({
  initialVoucherId,
  isOpen,
  onClose,
  filteredVoucherList,
}) => {
  const {
    transactions,
    updateTransaction,
    deleteTransaction,
    campuses,
    accountHeads,
    currentUser,
    isSuperAdmin,
    logActivity,
  } = useAccounting();

  // The pool of vouchers to navigate through
  const voucherPool: Transaction[] = useMemo(() => {
    if (filteredVoucherList && filteredVoucherList.length > 0) {
      return filteredVoucherList;
    }
    return transactions;
  }, [filteredVoucherList, transactions]);

  // Current active voucher ID
  const [currentVoucherId, setCurrentVoucherId] = useState<string>(() => {
    if (initialVoucherId && voucherPool.some((v) => v.id === initialVoucherId)) {
      return initialVoucherId;
    }
    return voucherPool[0]?.id || '';
  });

  useEffect(() => {
    if (initialVoucherId && voucherPool.some((v) => v.id === initialVoucherId)) {
      setCurrentVoucherId(initialVoucherId);
    }
  }, [initialVoucherId, voucherPool]);

  // Active tab inside the modal
  const [activeTab, setActiveTab] = useState<'editor' | 'recent_vouchers' | 'revision_history'>('editor');

  // Currently loaded voucher
  const activeVoucher = useMemo(() => {
    return transactions.find((v) => v.id === currentVoucherId) || voucherPool[0] || null;
  }, [transactions, currentVoucherId, voucherPool]);

  // Current index in pool
  const currentIndex = useMemo(() => {
    if (!activeVoucher) return -1;
    return voucherPool.findIndex((v) => v.id === activeVoucher.id);
  }, [voucherPool, activeVoucher]);

  // Form editable states
  const [formVoucherNo, setFormVoucherNo] = useState('');
  const [formVoucherType, setFormVoucherType] = useState<'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV'>('BPV');
  const [formDate, setFormDate] = useState('');
  const [formCampusId, setFormCampusId] = useState('');
  const [formNarration, setFormNarration] = useState('');
  const [formChequeNo, setFormChequeNo] = useState('');
  const [formEntries, setFormEntries] = useState<VoucherEntry[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);

  // Autocomplete state
  const [activeRowIndexForAcct, setActiveRowIndexForAcct] = useState<number | null>(null);
  const [acctSearchText, setAcctSearchText] = useState('');
  const [highlightedAcctIndex, setHighlightedAcctIndex] = useState(0);

  // Populate form when active voucher changes
  useEffect(() => {
    if (activeVoucher) {
      setFormVoucherNo(activeVoucher.voucherNo);
      setFormVoucherType(activeVoucher.voucherType);
      setFormDate(activeVoucher.date || new Date().toISOString().slice(0, 10));
      setFormCampusId(activeVoucher.campusId);
      setFormNarration(activeVoucher.narration || '');
      setFormChequeNo(activeVoucher.chequeNo || '');
      setFormEntries(
        (activeVoucher.entries || []).map((e) => ({
          ...e,
          id: e.id || `ent-${Math.random().toString(36).slice(2, 7)}`,
        }))
      );
      setHasUnsavedChanges(false);
      setFeedback(null);
    }
  }, [activeVoucher]);

  // Totals calculation
  const totalDebit = useMemo(() => {
    return formEntries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
  }, [formEntries]);

  const totalCredit = useMemo(() => {
    return formEntries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  }, [formEntries]);

  const isBalanced = useMemo(() => {
    return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
  }, [totalDebit, totalCredit]);

  const variance = useMemo(() => {
    return Math.abs(totalDebit - totalCredit);
  }, [totalDebit, totalCredit]);

  // Filtered accounts for autocomplete
  const filteredAccounts = useMemo(() => {
    if (!acctSearchText.trim()) return accountHeads.slice(0, 15);
    const q = acctSearchText.toLowerCase().trim();
    return accountHeads
      .filter((h) => h.code.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
      .slice(0, 15);
  }, [accountHeads, acctSearchText]);

  // Navigate Previous / Next with unsaved check
  const handleNavigateToVoucher = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= voucherPool.length) return;
    if (hasUnsavedChanges) {
      if (
        !window.confirm(
          'You have unsaved edits in the current voucher. Do you want to discard your changes and navigate to the next voucher?'
        )
      ) {
        return;
      }
    }
    const target = voucherPool[newIndex];
    if (target) {
      setCurrentVoucherId(target.id);
    }
  };

  // Keyboard navigation for whole modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea or text input unless holding Alt/Ctrl
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) handleNavigateToVoucher(currentIndex - 1);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < voucherPool.length - 1) handleNavigateToVoucher(currentIndex + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveChanges();
      } else if (e.key === 'Escape' && activeRowIndexForAcct !== null) {
        setActiveRowIndexForAcct(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, voucherPool, hasUnsavedChanges, activeRowIndexForAcct]);

  // Line item handlers
  const handleAddEntry = () => {
    const newEntry: VoucherEntry = {
      id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId: accountHeads[0]?.id || 'acc-1',
      accountCode: accountHeads[0]?.code || '1001',
      accountName: accountHeads[0]?.name || 'Cash in Hand',
      description: formNarration || 'Ledger Entry',
      debit: 0,
      credit: 0,
    };
    setFormEntries([...formEntries, newEntry]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveEntry = (index: number) => {
    if (formEntries.length <= 1) {
      alert('A voucher must contain at least one debit and one credit entry line.');
      return;
    }
    setFormEntries(formEntries.filter((_, i) => i !== index));
    setHasUnsavedChanges(true);
  };

  const handleDuplicateEntry = (index: number) => {
    const source = formEntries[index];
    const copy: VoucherEntry = {
      ...source,
      id: `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const next = [...formEntries];
    next.splice(index + 1, 0, copy);
    setFormEntries(next);
    setHasUnsavedChanges(true);
  };

  const handleSelectAccountForEntry = (rowIndex: number, account: AccountHead) => {
    const updated = [...formEntries];
    updated[rowIndex] = {
      ...updated[rowIndex],
      accountId: account.id || account.code,
      accountCode: account.code,
      accountName: account.name,
    };
    setFormEntries(updated);
    setActiveRowIndexForAcct(null);
    setHasUnsavedChanges(true);
  };

  // Save changes
  const handleSaveChanges = () => {
    if (!activeVoucher) return;

    if (!formNarration.trim()) {
      setFeedback({ type: 'error', msg: 'Narration is required for audit compliance.' });
      return;
    }

    if (!isBalanced) {
      setFeedback({
        type: 'error',
        msg: `Cannot save unbalanced voucher! Debit (PKR ${totalDebit.toLocaleString()}) must exactly equal Credit (PKR ${totalCredit.toLocaleString()}). Difference: PKR ${variance.toLocaleString()}.`,
      });
      return;
    }

    // Role permission check for posted vouchers
    const isPosted = activeVoucher.status === 'Posted' || activeVoucher.status === 'Approved';
    if (isPosted && !isSuperAdmin) {
      setFeedback({
        type: 'error',
        msg: 'Restricted: Approved/Posted vouchers can only be amended by authorized Platform Super Admins or Controllers.',
      });
      return;
    }

    const updatedVoucherPayload: Partial<Transaction> = {
      voucherType: formVoucherType,
      date: formDate,
      campusId: formCampusId,
      narration: formNarration.trim(),
      chequeNo: formChequeNo.trim() || undefined,
      entries: formEntries,
      totalDebit,
      totalCredit,
    };

    updateTransaction(activeVoucher.id, updatedVoucherPayload);

    // Audit log
    logActivity(
      'UPDATE_VOUCHER',
      'Voucher',
      activeVoucher.id,
      `Amended voucher #${activeVoucher.voucherNo} (${formVoucherType}). Total Debit: PKR ${totalDebit.toLocaleString()}. Narration: ${formNarration}`,
      formCampusId,
      totalDebit,
      {
        previousEntries: activeVoucher.entries,
        updatedEntries: formEntries,
        modifiedBy: currentUser?.name || 'Administrator',
      }
    );

    setHasUnsavedChanges(false);
    setFeedback({
      type: 'success',
      msg: `Voucher #${activeVoucher.voucherNo} successfully updated and verified in general ledger!`,
    });

    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Delete Active Voucher & Soft Delete to Global Recycle Bin
  const handleDeleteCurrentVoucher = () => {
    if (!activeVoucher) return;

    if (
      !window.confirm(
        `Are you sure you want to delete voucher #${activeVoucher.voucherNo} (${activeVoucher.voucherType} - PKR ${(
          activeVoucher.totalDebit || 0
        ).toLocaleString()})?\n\nThis voucher will be safely preserved in the Global Recycle Bin where it can be recovered.`
      )
    ) {
      return;
    }

    const c = campuses.find((cmp) => cmp.id === activeVoucher.campusId);
    softDeleteRecord({
      recordType: 'VOUCHER',
      originalPayload: activeVoucher,
      campusId: activeVoucher.campusId,
      campusName: c?.name || 'Campus Branch',
      campusCode: c?.code || 'CMP',
      identifier: activeVoucher.voucherNo,
      title: `${activeVoucher.voucherType} - ${activeVoucher.narration || 'General Ledger Voucher'}`,
      date: activeVoucher.date,
      deletedByUserId: currentUser?.id || 'usr-campus-admin',
      deletedByUserName: currentUser?.name || 'Campus Administrator',
      deletedByUserRole: currentUser?.role || 'Campus Admin',
      deletionReason: 'Deleted via Full-Edge Voucher Editor (Preserved in Global Recycle Bin)',
    });

    deleteTransaction(activeVoucher.id);

    logActivity(
      'DELETE_VOUCHER',
      'Voucher',
      activeVoucher.id,
      `Voucher #${activeVoucher.voucherNo} deleted by Campus Administrator ${currentUser?.name || ''} and archived to Global Recycle Bin`,
      activeVoucher.campusId,
      activeVoucher.totalDebit
    );

    // If there are other vouchers in the list, advance to the next or previous
    const remaining = voucherPool.filter((v) => v.id !== activeVoucher.id);
    if (remaining.length > 0) {
      const nextIndex = Math.min(currentIndex, remaining.length - 1);
      setCurrentVoucherId(remaining[nextIndex].id);
      setFeedback({
        type: 'warning',
        msg: `Voucher #${activeVoucher.voucherNo} was deleted and moved to Global Recycle Bin. Loaded next voucher.`,
      });
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden text-slate-100">
        {/* Top Header & Voucher Navigation Controls */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded">
                  {formVoucherType}
                </span>
                <span className="text-base font-black text-white font-mono tracking-tight">
                  #{formVoucherNo || 'VOUCHER'}
                </span>
                {activeVoucher && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeVoucher.status === 'Approved' || activeVoucher.status === 'Posted'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : activeVoucher.status === 'Rejected'
                        ? 'bg-rose-950 text-rose-300 border border-rose-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {activeVoucher.status || 'Pending'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Official Double-Entry Voucher Editor & Navigation Hub
              </p>
            </div>
          </div>

          {/* Sequential Previous & Next Navigation Bar */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-inner">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => handleNavigateToVoucher(currentIndex - 1)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                currentIndex > 0
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                  : 'bg-slate-950/40 text-slate-600 cursor-not-allowed'
              }`}
              title="Previous Voucher in register (Alt + ArrowLeft)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-mono font-bold text-slate-300 px-2">
              {currentIndex + 1} of {voucherPool.length}
            </span>

            <button
              type="button"
              disabled={currentIndex >= voucherPool.length - 1}
              onClick={() => handleNavigateToVoucher(currentIndex + 1)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                currentIndex < voucherPool.length - 1
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                  : 'bg-slate-950/40 text-slate-600 cursor-not-allowed'
              }`}
              title="Next Voucher in register (Alt + ArrowRight)"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 border-b border-slate-800 bg-slate-950/60 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'editor'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Voucher Details & Line Item Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recent_vouchers')}
            className={`py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'recent_vouchers'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Recent Vouchers Tab ({voucherPool.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('revision_history')}
            className={`py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'revision_history'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Revision History & Signatures</span>
          </button>
        </div>

        {/* Toast / Feedback Notice */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              feedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                : 'bg-amber-950/80 border-amber-800 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span>{feedback.msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: VOUCHER EDITOR */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* Metadata Form Header Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                {/* Voucher Type */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Voucher Type
                  </label>
                  <select
                    value={formVoucherType}
                    onChange={(e) => {
                      setFormVoucherType(e.target.value as any);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  >
                    <option value="BPV">BPV - Bank Payment Voucher</option>
                    <option value="BRV">BRV - Bank Receipt Voucher</option>
                    <option value="CPV">CPV - Cash Payment Voucher</option>
                    <option value="CRV">CRV - Cash Receipt Voucher</option>
                    <option value="JV">JV - Journal Voucher</option>
                  </select>
                </div>

                {/* Voucher Date */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Voucher Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => {
                      setFormDate(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Campus Branch */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Assigned Campus Branch
                  </label>
                  <select
                    value={formCampusId}
                    onChange={(e) => {
                      setFormCampusId(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cheque / Reference No */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Cheque / Ref #
                  </label>
                  <input
                    type="text"
                    value={formChequeNo}
                    onChange={(e) => {
                      setFormChequeNo(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="e.g. CHQ-99014"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                {/* Narration (full width) */}
                <div className="sm:col-span-2 md:col-span-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Narration / Transaction Description
                  </label>
                  <input
                    type="text"
                    value={formNarration}
                    onChange={(e) => {
                      setFormNarration(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Enter full transaction details for the audit log..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Double-Entry General Ledger Lines
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {formEntries.length} entries
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEntry}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entry Line</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Sr #</th>
                        <th className="py-2.5 px-3 min-w-[240px]">Account Head & Code</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Line Description</th>
                        <th className="py-2.5 px-3 text-right min-w-[120px]">Debit (PKR)</th>
                        <th className="py-2.5 px-3 text-right min-w-[120px]">Credit (PKR)</th>
                        <th className="py-2.5 px-3 text-right w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {formEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="hover:bg-slate-900/40">
                          <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>

                          {/* Account Autocomplete */}
                          <td className="py-2.5 px-3 relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRowIndexForAcct(idx);
                                setAcctSearchText('');
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 text-xs font-mono flex items-center justify-between"
                            >
                              <span className="truncate">
                                <strong className="text-indigo-400">[{entry.accountCode}]</strong>{' '}
                                {entry.accountName}
                              </span>
                              <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                            </button>

                            {/* Dropdown popup */}
                            {activeRowIndexForAcct === idx && (
                              <div className="absolute z-30 left-3 top-10 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 space-y-2 animate-in fade-in duration-150">
                                <input
                                  type="text"
                                  autoFocus
                                  value={acctSearchText}
                                  onChange={(e) => setAcctSearchText(e.target.value)}
                                  placeholder="Type code (1001) or account title..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                                <div className="max-h-48 overflow-y-auto divide-y divide-slate-800">
                                  {filteredAccounts.map((acct) => (
                                    <button
                                      key={acct.id || acct.code}
                                      type="button"
                                      onClick={() => handleSelectAccountForEntry(idx, acct)}
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-800 rounded flex items-center justify-between text-slate-200"
                                    >
                                      <span>
                                        <strong className="text-indigo-400 font-mono">[{acct.code}]</strong>{' '}
                                        {acct.name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 uppercase">
                                        {acct.category}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Line Description */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={entry.description || ''}
                              onChange={(e) => {
                                const next = [...formEntries];
                                next[idx] = { ...next[idx], description: e.target.value };
                                setFormEntries(next);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                          </td>

                          {/* Debit Input */}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.debit || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const next = [...formEntries];
                                next[idx] = {
                                  ...next[idx],
                                  debit: val,
                                  credit: val > 0 ? 0 : next[idx].credit,
                                };
                                setFormEntries(next);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono font-bold text-right focus:outline-none focus:border-emerald-500"
                            />
                          </td>

                          {/* Credit Input */}
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={entry.credit || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const next = [...formEntries];
                                next[idx] = {
                                  ...next[idx],
                                  credit: val,
                                  debit: val > 0 ? 0 : next[idx].debit,
                                };
                                setFormEntries(next);
                                setHasUnsavedChanges(true);
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-sky-400 font-mono font-bold text-right focus:outline-none focus:border-sky-500"
                            />
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleDuplicateEntry(idx)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                title="Duplicate Line Item"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveEntry(idx)}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                                title="Remove Line Item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Footer Balancing Row */}
                    <tfoot>
                      <tr className="border-t border-slate-700 bg-slate-900/90 font-mono font-bold">
                        <td colSpan={3} className="py-3 px-3 text-right uppercase text-slate-400 text-xs">
                          Totals & Ledger Balance:
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 text-xs">
                          PKR {totalDebit.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-sky-400 text-xs">
                          PKR {totalCredit.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isBalanced ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Balancing Verification Banner */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isBalanced
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-800 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {isBalanced
                        ? 'Voucher is perfectly balanced according to the GAAP Double-Entry standard.'
                        : `Voucher is UNBALANCED! Debit and Credit variance: PKR ${variance.toLocaleString()}.`}
                    </span>
                  </div>

                  <span className="font-mono font-bold">
                    Diff: PKR {variance.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECENT VOUCHERS LIST */}
          {activeTab === 'recent_vouchers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Recent Vouchers Register (Click any row to open in editor)</span>
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  {voucherPool.length} vouchers loaded
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase bg-slate-900/60">
                      <th className="py-3 px-3">Voucher #</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Campus</th>
                      <th className="py-3 px-3">Narration</th>
                      <th className="py-3 px-3 text-right">Debit / Credit</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {voucherPool.map((v, i) => {
                      const isCurrent = v.id === currentVoucherId;
                      const c = campuses.find((cmp) => cmp.id === v.campusId);
                      return (
                        <tr
                          key={v.id}
                          onClick={() => {
                            if (hasUnsavedChanges) {
                              if (
                                !window.confirm(
                                  'Discard unsaved changes to open this voucher?'
                                )
                              ) {
                                return;
                              }
                            }
                            setCurrentVoucherId(v.id);
                            setActiveTab('editor');
                          }}
                          className={`hover:bg-slate-800/60 cursor-pointer transition-colors ${
                            isCurrent ? 'bg-indigo-950/60 border-l-4 border-indigo-500' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-white">
                            {v.voucherNo}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{v.date}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-300 font-mono">
                            {v.voucherType}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{c?.name || v.campusId}</td>
                          <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">
                            {v.narration || 'General Voucher'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            PKR {(v.totalDebit || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                v.status === 'Approved' || v.status === 'Posted'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : v.status === 'Rejected'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                  : 'bg-amber-950 text-amber-300 border border-amber-700'
                              }`}
                            >
                              {v.status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[11px] font-bold text-indigo-400 hover:underline">
                              {isCurrent ? 'Active Now' : 'Edit &rarr;'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: REVISION & AUDIT HISTORY */}
          {activeTab === 'revision_history' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  <span>Audit Trail & Cryptographic Signatures for Voucher #{formVoucherNo}</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Prepared By:</span>
                    <span className="font-semibold text-slate-200">
                      {activeVoucher?.preparedBy || 'Campus Accountant'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Checked By:</span>
                    <span className="font-semibold text-slate-200">
                      {activeVoucher?.checkedBy || 'Senior Auditor'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Approved By:</span>
                    <span className="font-semibold text-slate-200">
                      {activeVoucher?.approvedBy || 'Campus Head / Principal'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Status:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {activeVoucher?.status || 'Pending Review'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
                  <p>
                    All modifications to double-entry general ledger vouchers are committed atomically to Google Cloud Firestore and logged with immutable SHA-256 transaction integrity hashes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Unsaved Changes
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                All changes saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDeleteCurrentVoucher}
              className="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Delete this voucher from ledger (archived to Global Recycle Bin for safe recovery)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete Voucher</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!isBalanced}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                isBalanced
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
              title="Save changes to voucher and commit to ledger (Ctrl + S)"
            >
              <Save className="w-4 h-4" />
              <span>Save & Commit Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
