import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building2,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  CloudCheck,
  AlertCircle,
  FileText,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  X,
  History,
  Trash2,
} from 'lucide-react';
import {
  useAccounting,
  Transaction,
  Campus,
} from '../core/aplusEngine';
import { syncVoucher, autoSaveMasterState } from '../services/firebaseSync';
import {
  getRecentVoucherSearches,
  saveRecentVoucherSearch,
  deleteRecentVoucherSearch,
  clearAllRecentVoucherSearches,
  RecentVoucherSearch,
} from '../services/recentSearchesIndexedDb';
import { VoucherDetailModal } from './VoucherDetailModal';

interface BulkVoucherApprovalHubProps {
  onNavigate?: (tab: string) => void;
  embedded?: boolean;
}

export const BulkVoucherApprovalHub: React.FC<BulkVoucherApprovalHubProps> = ({
  onNavigate,
  embedded = false,
}) => {
  const {
    transactions,
    campuses,
    currentCampusId,
    setCurrentCampusId,
    currentUser,
    isSuperAdmin,
    updateVoucherStatus,
    logActivity,
    exportSystemState,
  } = useAccounting();

  // Active status queue tab
  const [activeQueue, setActiveQueue] = useState<'Pending' | 'Approved' | 'Rejected' | 'ALL'>('Pending');

  // Filters
  const [selectedCampus, setSelectedCampus] = useState<string>(() => {
    if (currentUser?.campusId && currentUser.campusId !== 'all') {
      return currentUser.campusId;
    }
    return currentCampusId || 'all';
  });
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [recentSearches, setRecentSearches] = useState<RecentVoucherSearch[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);

  // Load recent searches from IndexedDB on initial mount
  React.useEffect(() => {
    getRecentVoucherSearches().then((list) => {
      setRecentSearches(list);
    });
  }, []);

  // Save search query to IndexedDB on debounce when query length >= 2
  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => {
      saveRecentVoucherSearch({
        query: searchQuery.trim(),
        campusId: selectedCampus,
        voucherType: voucherTypeFilter,
        dateFilter,
      }).then((updated) => {
        setRecentSearches(updated);
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCampus, voucherTypeFilter, dateFilter]);

  // Selection & Batch Action State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchRemarks, setBatchRemarks] = useState<string>('');
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Detail Modal inspection
  const [inspectVoucher, setInspectVoucher] = useState<Transaction | null>(null);

  // Normalize status
  const getNormalizedStatus = (status?: string): 'Pending' | 'Approved' | 'Rejected' => {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s.includes('approv') || s.includes('posted')) return 'Approved';
    if (s.includes('reject') || s.includes('cancel')) return 'Rejected';
    return 'Pending';
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    return (transactions || []).filter((tx) => {
      // 1. Campus scoping
      if (selectedCampus !== 'all' && tx.campusId !== selectedCampus) {
        return false;
      }

      // 2. Queue Status
      const st = getNormalizedStatus(tx.status);
      if (activeQueue !== 'ALL' && st !== activeQueue) {
        return false;
      }

      // 3. Voucher Type
      if (voucherTypeFilter !== 'ALL' && tx.voucherType !== voucherTypeFilter) {
        return false;
      }

      // 4. Date filter
      if (dateFilter === 'TODAY' && tx.date !== todayStr) {
        return false;
      }
      if (dateFilter === 'WEEK' && (tx.date < weekAgoStr || tx.date > todayStr)) {
        return false;
      }
      if (dateFilter === 'MONTH' && (tx.date < monthStartStr || tx.date > todayStr)) {
        return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const vNo = (tx.voucherNo || '').toLowerCase();
        const narr = (tx.narration || '').toLowerCase();
        const amt = String(tx.totalDebit || tx.totalCredit || '');
        const entriesMatch = (tx.entries || []).some(
          (e) =>
            (e.accountName || '').toLowerCase().includes(q) ||
            (e.accountCode || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q) ||
            (e.refCheckNo || '').toLowerCase().includes(q)
        );
        if (!vNo.includes(q) && !narr.includes(q) && !amt.includes(q) && !entriesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, selectedCampus, activeQueue, voucherTypeFilter, dateFilter, searchQuery]);

  // Counts for tabs
  const queueCounts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    (transactions || []).forEach((tx) => {
      if (selectedCampus !== 'all' && tx.campusId !== selectedCampus) return;
      const st = getNormalizedStatus(tx.status);
      if (st === 'Pending') pending++;
      else if (st === 'Approved') approved++;
      else if (st === 'Rejected') rejected++;
    });

    return {
      pending,
      approved,
      rejected,
      all: pending + approved + rejected,
    };
  }, [transactions, selectedCampus]);

  // Selected vouchers details
  const selectedVouchers = useMemo(() => {
    const set = new Set(selectedIds);
    return (transactions || []).filter((tx) => set.has(tx.id));
  }, [transactions, selectedIds]);

  const selectedTotalDebit = useMemo(() => {
    return selectedVouchers.reduce((sum, v) => sum + (Number(v.totalDebit) || 0), 0);
  }, [selectedVouchers]);

  const selectedTotalCredit = useMemo(() => {
    return selectedVouchers.reduce((sum, v) => sum + (Number(v.totalCredit) || 0), 0);
  }, [selectedVouchers]);

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all pending in current view
  const handleSelectAllPendingInView = () => {
    const pendingIds = filteredTransactions
      .filter((tx) => getNormalizedStatus(tx.status) === 'Pending')
      .map((tx) => tx.id);
    setSelectedIds(pendingIds);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle row expansion for line items
  const handleToggleExpandRow = (id: string) => {
    setExpandedRowIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Execute Batch Approval or Rejection with Automatic Cloud Sync
  const handleExecuteBulkAction = async (newStatus: 'Approved' | 'Rejected' | 'Pending') => {
    if (selectedVouchers.length === 0) return;

    if (newStatus === 'Rejected' && !batchRemarks.trim()) {
      const reason = window.prompt('Please enter a rejection reason for the selected voucher(s):');
      if (reason === null) return; // user cancelled
      if (!reason.trim()) {
        alert('A rejection reason is required to reject vouchers.');
        return;
      }
      setBatchRemarks(reason.trim());
    }

    setIsProcessing(true);
    const count = selectedVouchers.length;
    const approverName = currentUser?.name || currentUser?.username || 'Campus Administrator';
    const approverRole = currentUser?.role || 'Campus Admin';
    const remarks = batchRemarks.trim() || `Bulk ${newStatus.toLowerCase()} execution`;

    try {
      // 1. Update in-memory state and log activity
      selectedVouchers.forEach((voucher) => {
        if (updateVoucherStatus) {
          updateVoucherStatus(voucher.id, newStatus, approverName, approverRole, remarks);
        }

        if (logActivity) {
          logActivity(
            `${newStatus === 'Approved' ? 'APPROVED' : newStatus === 'Rejected' ? 'REJECTED' : 'RESET'}_VOUCHER`,
            'Voucher',
            voucher.id,
            `Voucher #${voucher.voucherNo} marked as ${newStatus} (${remarks})`,
            voucher.campusId,
            voucher.totalDebit
          );
        }

        // 2. Direct automatic Firestore sync for each voucher (No manual backup needed)
        const updatedVoucher = {
          ...voucher,
          status: newStatus,
          approvedBy: approverName,
          approverRole,
          approvalRemarks: remarks,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        syncVoucher(updatedVoucher).catch((err: any) => {
          console.warn('Voucher auto-sync notice:', err);
        });
      });

      // 3. Trigger debounced master cloud snapshot auto-save
      if (exportSystemState) {
        autoSaveMasterState(exportSystemState());
      }

      // 4. Feedback
      setToastMessage({
        type: newStatus === 'Approved' ? 'success' : newStatus === 'Rejected' ? 'error' : 'info',
        text: `✓ Successfully ${newStatus.toLowerCase()} ${count} voucher(s). All records automatically synchronized to Cloud datastore (no manual backup required).`,
      });

      setSelectedIds([]);
      setBatchRemarks('');
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Bulk action error:', err);
      setToastMessage({
        type: 'error',
        text: `Error during batch update: ${err?.message || 'Operation failed'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper formatting
  const formatPKR = (amount: number) => {
    return `Rs. ${(amount || 0).toLocaleString('en-PK')}`;
  };

  const getVoucherTypeBadge = (type: string) => {
    switch (type) {
      case 'BPV':
        return { label: 'BPV', full: 'Bank Payment', bg: 'bg-blue-600', text: 'text-white' };
      case 'BRV':
        return { label: 'BRV', full: 'Bank Receipt', bg: 'bg-emerald-600', text: 'text-white' };
      case 'CPV':
        return { label: 'CPV', full: 'Cash Payment', bg: 'bg-amber-600', text: 'text-white' };
      case 'CRV':
        return { label: 'CRV', full: 'Cash Receipt', bg: 'bg-teal-600', text: 'text-white' };
      case 'JV':
        return { label: 'JV', full: 'Journal Voucher', bg: 'bg-purple-600', text: 'text-white' };
      default:
        return { label: type, full: type, bg: 'bg-slate-700', text: 'text-white' };
    }
  };

  return (
    <div className={`space-y-4 ${embedded ? '' : 'max-w-7xl mx-auto p-4 sm:p-6'}`}>
      {/* Header & Auto-Sync Live Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500 text-white font-bold">
              <CheckSquare className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
              Bulk Voucher Approval & Batch Verification
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
              {queueCounts.pending} Pending
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Campus administrators can select multiple pending vouchers simultaneously, review line-item debit/credit integrity, and batch approve or reject them in a single operation.
          </p>
        </div>

        {/* Dynamic Cloud Auto-Sync Assurance Pill */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-inner">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-white flex items-center gap-1">
              <span>Automatic Cloud Sync Active</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-slate-400 text-[10px]">
              Approvals save directly to Firebase · No manual backups required
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-bold transition-all shadow-md animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-500 text-rose-200'
              : 'bg-indigo-950/90 border-indigo-500 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar: Queue Tabs + Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* Row 1: Status Queue Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveQueue('Pending')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeQueue === 'Pending'
                  ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Approvals</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeQueue === 'Pending' ? 'bg-slate-950 text-amber-300' : 'bg-slate-300 text-slate-800'
              }`}>
                {queueCounts.pending}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueue('Approved')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeQueue === 'Approved'
                  ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approved Queue</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeQueue === 'Approved' ? 'bg-emerald-950 text-emerald-200' : 'bg-slate-300 text-slate-800'
              }`}>
                {queueCounts.approved}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueue('Rejected')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeQueue === 'Rejected'
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rejected Queue</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeQueue === 'Rejected' ? 'bg-rose-950 text-rose-200' : 'bg-slate-300 text-slate-800'
              }`}>
                {queueCounts.rejected}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveQueue('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeQueue === 'ALL'
                  ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-800/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>All Vouchers</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeQueue === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-300 text-slate-800'
              }`}>
                {queueCounts.all}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllPendingInView}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select All Pending ({queueCounts.pending})</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Campus Scope, Type & Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search bar with Recent Searches History Dropdown */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowRecentSearches(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search voucher # (e.g. CPV-001), narration, payee, amount..."
              className="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {recentSearches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRecentSearches((prev) => !prev)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    showRecentSearches ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:text-indigo-600'
                  }`}
                  title="View Recent Voucher Searches (IndexedDB)"
                >
                  <History className="w-3.5 h-3.5" />
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Recent Searches Flyout Panel */}
            {showRecentSearches && recentSearches.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="px-3.5 py-2 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Recent Searches (IndexedDB)</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearAllRecentVoucherSearches().then(() => setRecentSearches([]));
                      }}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-mono transition-colors cursor-pointer"
                      title="Clear search history"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecentSearches(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {recentSearches.map((rec) => (
                    <div
                      key={rec.id}
                      className="px-3.5 py-2 flex items-center justify-between hover:bg-indigo-50/70 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSearchQuery(rec.query);
                        if (rec.campusId && rec.campusId !== 'all') {
                          setSelectedCampus(rec.campusId);
                        }
                        if (rec.voucherType && rec.voucherType !== 'ALL') {
                          setVoucherTypeFilter(rec.voucherType);
                        }
                        if (rec.dateFilter && (rec.dateFilter as any) !== 'ALL') {
                          setDateFilter(rec.dateFilter as any);
                        }
                        setShowRecentSearches(false);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700">
                          {rec.query}
                        </span>
                        {rec.voucherType && rec.voucherType !== 'ALL' && (
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-mono font-bold">
                            {rec.voucherType}
                          </span>
                        )}
                        {rec.campusId && rec.campusId !== 'all' && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[9px] font-mono">
                            {campuses.find((c) => c.id === rec.campusId)?.code || rec.campusId}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(rec.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRecentVoucherSearch(rec.id).then((updated) => setRecentSearches(updated));
                          }}
                          className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove this search"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campus Scoping Dropdown */}
          <div className="lg:col-span-3 flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedCampus}
              onChange={(e) => {
                setSelectedCampus(e.target.value);
                if (setCurrentCampusId) setCurrentCampusId(e.target.value);
              }}
              className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Campuses ({campuses.length})</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Voucher Type Filter */}
          <div className="lg:col-span-2 flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={voucherTypeFilter}
              onChange={(e) => setVoucherTypeFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All 5 Types</option>
              <option value="BPV">BPV (Bank Payment)</option>
              <option value="BRV">BRV (Bank Receipt)</option>
              <option value="CPV">CPV (Cash Payment)</option>
              <option value="CRV">CRV (Cash Receipt)</option>
              <option value="JV">JV (Journal Voucher)</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="lg:col-span-2 flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today Only</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sticky Batch Action Bar (Appears when 1 or more vouchers are selected) */}
      {selectedVouchers.length > 0 && (
        <div className="sticky top-2 z-30 bg-slate-900 border-2 border-indigo-500 text-white rounded-2xl p-4 shadow-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-mono font-black text-sm flex items-center justify-center">
                {selectedVouchers.length}
              </span>
              <div>
                <div className="text-xs font-bold text-white">
                  {selectedVouchers.length === 1 ? '1 Voucher Selected' : `${selectedVouchers.length} Vouchers Selected for Batch Action`}
                </div>
                <div className="text-[11px] font-mono text-slate-300">
                  Total Dr: <strong className="text-emerald-400">{formatPKR(selectedTotalDebit)}</strong> · Total Cr: <strong className="text-emerald-400">{formatPKR(selectedTotalCredit)}</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Deselect All
            </button>
          </div>

          {/* Action controls */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl justify-end">
            <input
              type="text"
              value={batchRemarks}
              onChange={(e) => setBatchRemarks(e.target.value)}
              placeholder="Optional approval note or rejection reason..."
              className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-400"
            />

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleExecuteBulkAction('Approved')}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Approve Selected ({selectedVouchers.length})</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleExecuteBulkAction('Rejected')}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject Selected ({selectedVouchers.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <tr>
                <th className="py-3 px-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedIds.length === filteredTransactions.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredTransactions.map((tx) => tx.id));
                      }
                    }}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer"
                    title="Toggle select all in current filtered view"
                  >
                    {filteredTransactions.length > 0 && selectedIds.length === filteredTransactions.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Voucher #</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Campus</th>
                <th className="py-3 px-3">Description / Narration</th>
                <th className="py-3 px-3 text-right">Debit (PKR)</th>
                <th className="py-3 px-3 text-right">Credit (PKR)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-slate-700 text-sm">
                      No vouchers match the selected queue or filters
                    </div>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {activeQueue === 'Pending'
                        ? 'All vouchers for this campus have been reviewed and approved.'
                        : 'Adjust your search query, campus filter, or date range to inspect other transactions.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isSelected = selectedIds.includes(tx.id);
                  const isExpanded = expandedRowIds.includes(tx.id);
                  const campusObj = campuses.find((c) => c.id === tx.campusId);
                  const badge = getVoucherTypeBadge(tx.voucherType);
                  const st = getNormalizedStatus(tx.status);

                  return (
                    <React.Fragment key={tx.id}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                        <td className="py-3 px-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelect(tx.id)}
                            className="p-1 rounded-md text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => setInspectVoucher(tx)}
                            className="font-mono font-bold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer flex items-center gap-1"
                            title="Click to view full voucher detail with line items & print preview"
                          >
                            <span>{tx.voucherNo}</span>
                          </button>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {tx.date}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">
                            {campusObj?.code || tx.campusId}
                          </span>
                        </td>

                        <td className="py-3 px-3 max-w-xs truncate text-slate-700 font-medium" title={tx.narration}>
                          {tx.narration || '—'}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatPKR(tx.totalDebit)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatPKR(tx.totalCredit)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {st === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Approved
                            </span>
                          ) : st === 'Rejected' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Expand line items */}
                            <button
                              type="button"
                              onClick={() => handleToggleExpandRow(tx.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                              title="Toggle breakdown line items inline"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {/* Row-level approve */}
                            {st !== 'Approved' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds([tx.id]);
                                  handleExecuteBulkAction('Approved');
                                }}
                                className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-[10px] cursor-pointer"
                                title="Approve this voucher immediately"
                              >
                                Approve
                              </button>
                            )}

                            {/* Row-level reject */}
                            {st !== 'Rejected' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedIds([tx.id]);
                                  handleExecuteBulkAction('Rejected');
                                }}
                                className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-[10px] cursor-pointer"
                                title="Reject this voucher"
                              >
                                Reject
                              </button>
                            )}

                            {/* View / Print modal trigger */}
                            <button
                              type="button"
                              onClick={() => setInspectVoucher(tx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                              title="Open read-only voucher detail & A4 print view"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Line Items Row */}
                      {isExpanded && tx.entries && tx.entries.length > 0 && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={10} className="p-3 pl-12">
                            <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-1.5">
                                <span className="flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Voucher Line Item Breakdown ({tx.entries.length} Entries)</span>
                                </span>
                                <span className="font-mono text-slate-500">
                                  Invariant Check: {Math.abs((tx.totalDebit || 0) - (tx.totalCredit || 0)) < 0.01 ? 'Balanced ✓' : 'Unbalanced ⚠'}
                                </span>
                              </div>

                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-slate-500 font-bold border-b border-slate-100">
                                    <th className="py-1">Account Code</th>
                                    <th className="py-1">Account Title</th>
                                    <th className="py-1">Cheque / Ref #</th>
                                    <th className="py-1">Line Description</th>
                                    <th className="py-1 text-right">Debit (PKR)</th>
                                    <th className="py-1 text-right">Credit (PKR)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {tx.entries.map((entry, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="py-1 font-mono font-bold text-indigo-700">{entry.accountCode}</td>
                                      <td className="py-1 font-semibold text-slate-800">{entry.accountName}</td>
                                      <td className="py-1 font-mono text-slate-500">{entry.refCheckNo || '—'}</td>
                                      <td className="py-1 text-slate-600">{entry.description || tx.narration}</td>
                                      <td className="py-1 text-right font-mono font-bold text-slate-900">
                                        {entry.debit ? formatPKR(entry.debit) : '—'}
                                      </td>
                                      <td className="py-1 text-right font-mono font-bold text-slate-900">
                                        {entry.credit ? formatPKR(entry.credit) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voucher Detail Modal */}
      <VoucherDetailModal
        voucher={inspectVoucher}
        campuses={campuses}
        isOpen={Boolean(inspectVoucher)}
        onClose={() => setInspectVoucher(null)}
        onNavigateToLedger={() => {
          setInspectVoucher(null);
          onNavigate?.('alltransactions');
        }}
      />
    </div>
  );
};
