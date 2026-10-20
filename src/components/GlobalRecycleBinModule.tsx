import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Search,
  Filter,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  User,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
  Download,
  Eye,
  Check,
  X,
  RefreshCw,
  Coins,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import {
  SoftDeletedRecord,
  RecoverableRecordType,
  getStoredRecycleBinRecords,
  saveStoredRecycleBinRecords,
  validateRestorePreconditions,
  executeRecordRestore,
  executePermanentDelete,
  exportRecycleBinAuditReportCSV,
  DependencyCheckResult,
} from '../services/globalRecoveryService';

interface GlobalRecycleBinModuleProps {
  onRecordRestored?: (record: SoftDeletedRecord) => void;
  onClose?: () => void;
}

export const GlobalRecycleBinModule: React.FC<GlobalRecycleBinModuleProps> = ({
  onRecordRestored,
  onClose,
}) => {
  const {
    transactions,
    pettyCashTransactions,
    accountHeads,
    campuses,
    addTransaction,
    addPettyCashTransaction,
    addAccountHead,
    addCampus,
    currentUser,
    currentCampusId,
    isSuperAdmin,
  } = useAccounting();

  // Site Owner & Main Branch privilege boundaries:
  // Deleted COA restoration is strictly restricted to Site Owner and Main Branch (sub-campuses prohibited).
  const isSiteOwner =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'level_1_platform_super_admin' ||
    (isSuperAdmin && (!currentUser?.campusId || currentUser?.campusAccess === 'all'));

  const effectiveCampusId = currentCampusId || currentUser?.campusId;
  const userCampus = campuses.find((c) => c.id === effectiveCampusId);
  const isMainBranch = userCampus
    ? (userCampus.isMainCampus !== false && !userCampus.parentCampusId)
    : false;
  const canRestoreCOA = isSiteOwner || isMainBranch;

  // Records state
  const [records, setRecords] = useState<SoftDeletedRecord[]>(() => getStoredRecycleBinRecords());

  // Filter States
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [selectedCampus, setSelectedCampus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Modal States
  const [inspectRecord, setInspectRecord] = useState<SoftDeletedRecord | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<SoftDeletedRecord | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [alternateVoucherNo, setAlternateVoucherNo] = useState('');
  const [autoRecreateHeads, setAutoRecreateHeads] = useState(true);
  const [restoreNotes, setRestoreNotes] = useState('');

  // Toast / feedback message
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  const triggerToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    details?: string
  ) => {
    setFeedback({ type, message, details });
    setTimeout(() => setFeedback(null), 6000);
  };

  // Distinct Organizations & Campuses
  const organizations = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => map.set(r.organizationId, r.organizationName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return records.filter((r) => {
      if (selectedOrg !== 'all' && r.organizationId !== selectedOrg) return false;
      if (selectedCampus !== 'all' && r.campusId !== selectedCampus) return false;
      if (selectedType !== 'all' && r.recordType !== selectedType) return false;
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;

      // Security Policy: Restoring deleted Chart of Accounts (COA) is strictly restricted to Site Owner and Main Branch
      if (r.recordType === 'ACCOUNT_HEAD' && !canRestoreCOA) return false;

      // Date filtering
      if (dateFilter === 'today' && now - r.deletedEpochMs > dayMs) return false;
      if (dateFilter === '7days' && now - r.deletedEpochMs > 7 * dayMs) return false;
      if (dateFilter === '30days' && now - r.deletedEpochMs > 30 * dayMs) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = r.identifier?.toLowerCase().includes(q);
        const matchTitle = r.title?.toLowerCase().includes(q);
        const matchReason = r.deletionReason?.toLowerCase().includes(q);
        const matchUser = r.deletedByUserName?.toLowerCase().includes(q);
        const matchCampus = r.campusName?.toLowerCase().includes(q);
        if (!matchId && !matchTitle && !matchReason && !matchUser && !matchCampus) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedOrg, selectedCampus, selectedType, selectedStatus, dateFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = records.length;
    const softDeleted = records.filter((r) => r.status === 'soft_deleted').length;
    const restored = records.filter((r) => r.status === 'restored').length;
    const totalRecoverableAmount = records
      .filter((r) => r.status === 'soft_deleted')
      .reduce((sum, r) => sum + (r.financialImpact?.totalAmount || 0), 0);
    const vouchersCount = records.filter(
      (r) => r.recordType === 'VOUCHER' && r.status === 'soft_deleted'
    ).length;

    return { total, softDeleted, restored, totalRecoverableAmount, vouchersCount };
  }, [records]);

  // Preconditions inspection for selected item
  const currentPrecheck: DependencyCheckResult | null = useMemo(() => {
    if (!inspectRecord) return null;
    return validateRestorePreconditions(inspectRecord, {
      activeTransactions: transactions,
      activePettyCash: pettyCashTransactions,
      activeAccountHeads: accountHeads,
      activeCampuses: campuses,
    });
  }, [inspectRecord, transactions, pettyCashTransactions, accountHeads, campuses]);

  // Handle Restore Execution
  const handlePerformRestore = () => {
    if (!inspectRecord) return;

    if (inspectRecord.recordType === 'ACCOUNT_HEAD' && !canRestoreCOA) {
      triggerToast(
        'error',
        'Permission Denied: Restoration of Chart of Accounts (COA) is strictly restricted to Site Owner and Main Campus Branch.'
      );
      return;
    }

    const actor = {
      name: currentUser?.name || 'Platform Site Admin',
      role: currentUser?.role || 'Super Admin',
      email: currentUser?.email,
    };

    const result = executeRecordRestore(
      inspectRecord.id,
      actor,
      {
        activeTransactions: transactions,
        activePettyCash: pettyCashTransactions,
        activeAccountHeads: accountHeads,
        activeCampuses: campuses,
        addTransaction,
        addPettyCashTransaction,
        addAccountHead,
        addCampus,
      },
      {
        overrideDuplicateVoucherNo: alternateVoucherNo.trim() || undefined,
        autoRecreateMissingAccountHeads: autoRecreateHeads,
        restoreNotes: restoreNotes.trim() || undefined,
      }
    );

    if (result.success) {
      triggerToast('success', result.message, result.reconciliationNotice);
      setRecords(getStoredRecycleBinRecords());
      if (onRecordRestored) onRecordRestored(inspectRecord);
      setInspectRecord(null);
      setAlternateVoucherNo('');
      setRestoreNotes('');
    } else {
      triggerToast('error', 'Restore failed: ' + result.message);
    }
  };

  // Handle Permanent Delete Execution
  const handlePerformPermanentDelete = () => {
    if (!permanentDeleteTarget) return;

    const actor = {
      name: currentUser?.name || 'Platform Site Admin',
      role: currentUser?.role || 'Super Admin',
    };

    const res = executePermanentDelete(
      permanentDeleteTarget.id,
      actor,
      confirmPhrase.trim(),
      deleteReason.trim() || 'Purged per data retention policy'
    );

    if (res.success) {
      triggerToast('warning', res.message);
      setRecords(getStoredRecycleBinRecords());
      setPermanentDeleteTarget(null);
      setConfirmPhrase('');
      setDeleteReason('');
    } else {
      triggerToast('error', res.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Control Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Zero Data-Loss Standard
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Global Multi-Campus Vault
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-400" />
              <span>Global Recycle Bin & Financial Record Recovery</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl">
              Centralized platform repository for soft-deleted financial vouchers, petty cash, chart of accounts, and campus entities across all client organizations. Protects balance integrity and prevents duplicate postings during recovery.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={exportRecycleBinAuditReportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all border border-slate-700 cursor-pointer shadow-sm"
              title="Export complete recovery audit history to CSV"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Export Audit Report</span>
            </button>
            <button
              type="button"
              onClick={() => setRecords(getStoredRecycleBinRecords())}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700 cursor-pointer"
              title="Refresh recycle bin state"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              In Recycle Bin
            </span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {stats.softDeleted} <span className="text-xs font-normal text-slate-400">records</span>
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Recoverable Value
            </span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              PKR {stats.totalRecoverableAmount.toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Restored Vouchers
            </span>
            <span className="text-lg font-black text-indigo-300 font-mono">
              {stats.restored} <span className="text-xs font-normal text-slate-400">recovered</span>
            </span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Campuses Covered
            </span>
            <span className="text-lg font-black text-sky-400 font-mono">
              {campuses.length} <span className="text-xs font-normal text-slate-400">branches</span>
            </span>
          </div>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-start justify-between gap-3 animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : feedback.type === 'warning'
              ? 'bg-amber-950/80 border-amber-800 text-amber-200'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{feedback.message}</p>
              {feedback.details && <p className="text-[11px] opacity-80 mt-0.5">{feedback.details}</p>}
            </div>
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

      {/* Multi-Parameter Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Organization filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Client / Organization
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Client Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* Campus filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Campus Branch
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Campus Branches</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Record Type filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Entity Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Entity Types</option>
              <option value="VOUCHER">Financial Vouchers (GL)</option>
              <option value="PETTY_CASH">Petty Cash Vouchers</option>
              {canRestoreCOA && (
                <option value="ACCOUNT_HEAD">Chart of Accounts Heads (COA)</option>
              )}
              <option value="CAMPUS">Campus Branches</option>
              <option value="USER">User Accounts</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Vault Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="soft_deleted">Soft-Deleted (Pending Restore)</option>
              <option value="restored">Restored to Ledger</option>
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Deletion Timeline
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Voucher Number (e.g. BPV-0089), Account Code (1001-2), Record ID, deleting officer, or reason..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Recoverable Vault Items
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800">
              Showing {filteredRecords.length} of {records.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
            <span>Soft-Deleted</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 ml-2" />
            <span>Restored</span>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <RotateCcw className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">No records found matching filters</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Any vouchers, petty cash, or accounts soft-deleted from campuses will safely appear here for validation and atomic recovery.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
                  <th className="py-3 px-4">Entity & Identifier</th>
                  <th className="py-3 px-4">Campus & Org</th>
                  <th className="py-3 px-4">Financial Impact</th>
                  <th className="py-3 px-4">Deletion Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredRecords.map((r) => {
                  const isRestored = r.status === 'restored';
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isRestored ? 'opacity-70 bg-slate-950/30' : ''
                      }`}
                    >
                      {/* Entity & Identifier */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border mt-0.5 ${
                              r.recordType === 'VOUCHER'
                                ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                                : r.recordType === 'PETTY_CASH'
                                ? 'bg-amber-950 text-amber-300 border-amber-700'
                                : r.recordType === 'ACCOUNT_HEAD'
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {r.recordType}
                          </span>
                          <div>
                            <span className="font-mono font-bold text-white text-xs block">
                              {r.identifier}
                            </span>
                            <span className="text-slate-300 text-xs block line-clamp-1 max-w-sm">
                              {r.title}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ID: {r.originalId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Campus & Org */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-200 block text-xs">
                            {r.campusName}
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono">
                            [{r.campusCode}] • {r.organizationName}
                          </span>
                        </div>
                      </td>

                      {/* Financial Impact */}
                      <td className="py-3.5 px-4 font-mono">
                        {r.financialImpact?.totalAmount !== undefined ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-emerald-400 text-xs block">
                              PKR {r.financialImpact.totalAmount.toLocaleString()}
                            </span>
                            {r.financialImpact.affectedAccountCodes?.length > 0 && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                                Codes: {r.financialImpact.affectedAccountCodes.join(', ')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">N/A (Metadata)</span>
                        )}
                      </td>

                      {/* Deletion Details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          <span className="text-[11px] text-slate-300 block">
                            By <strong>{r.deletedByUserName}</strong> ({r.deletedByUserRole})
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(r.deletedAt).toLocaleString()}
                          </span>
                          <p className="text-[11px] text-amber-300/90 italic truncate" title={r.deletionReason}>
                            "{r.deletionReason}"
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isRestored ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                            <Check className="w-3 h-3 text-emerald-400" />
                            Restored
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Soft-Deleted
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.recordType === 'ACCOUNT_HEAD' && !canRestoreCOA ? (
                            <span
                              className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 text-amber-300 font-bold text-[11px] flex items-center gap-1 border border-amber-800/40"
                              title="Restoration of deleted COA is restricted to Site Owner and Main Branch"
                            >
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Site Owner / Main Branch Only</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (r.recordType === 'ACCOUNT_HEAD' && !canRestoreCOA) {
                                  triggerToast(
                                    'error',
                                    'Access Denied: Restoration of deleted Chart of Accounts (COA) is strictly restricted to Site Owner and Main Branch.'
                                  );
                                  return;
                                }
                                setInspectRecord(r);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title="Inspect dependencies and perform safe restore"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>{isRestored ? 'Inspect' : 'Recover'}</span>
                            </button>
                          )}

                          {!isRestored && (
                            <button
                              type="button"
                              onClick={() => {
                                setPermanentDeleteTarget(r);
                                setConfirmPhrase('');
                                setDeleteReason('');
                              }}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 transition-colors border border-slate-700 hover:border-rose-800 cursor-pointer"
                              title="Permanently erase record (Restricted / High-Risk)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* RESTORE PREVIEW & DEPENDENCY MODAL */}
      {/* --------------------------------------------------------------------- */}
      {inspectRecord && currentPrecheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                      {inspectRecord.recordType}
                    </span>
                    <span className="text-xs font-mono font-black text-amber-300">
                      #{inspectRecord.identifier}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-white tracking-tight">
                    Restore Preview & Financial Integrity Check
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Dependency Status Card */}
              <div
                className={`p-4 rounded-2xl border ${
                  currentPrecheck.canRestoreSafely
                    ? 'bg-emerald-950/40 border-emerald-800/80'
                    : 'bg-rose-950/40 border-rose-800/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  {currentPrecheck.canRestoreSafely ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h5 className="text-sm font-bold text-white">
                      {currentPrecheck.canRestoreSafely
                        ? 'Dependencies Verified — Ready for Safe Restoration'
                        : 'Pre-Restoration Conflicts Detected'}
                    </h5>
                    <p className="text-xs text-slate-300">
                      {currentPrecheck.canRestoreSafely
                        ? 'Original accounts, ledger codes, and campus records are intact. No duplicate vouchers detected.'
                        : 'The following dependency warnings or duplicate collisions must be resolved before restoring.'}
                    </p>
                  </div>
                </div>

                {currentPrecheck.errors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rose-800/60 space-y-1.5">
                    {currentPrecheck.errors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-rose-200">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {currentPrecheck.warnings.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-amber-800/60 space-y-1.5">
                    {currentPrecheck.warnings.map((warn, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-amber-200">
                        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Duplicate Voucher Number Resolution */}
              {currentPrecheck.duplicateConflict && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-amber-600/60 space-y-2">
                  <label className="text-xs font-bold text-amber-300 block">
                    Resolve Duplicate Voucher Conflict:
                  </label>
                  <p className="text-xs text-slate-400">
                    Provide an alternate unique voucher number to prevent overwriting or double-posting:
                  </p>
                  <input
                    type="text"
                    value={alternateVoucherNo}
                    onChange={(e) => setAlternateVoucherNo(e.target.value)}
                    placeholder={`e.g. ${inspectRecord.identifier}-RESTORED`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              )}

              {/* Missing Account Heads Auto-Recreate Option */}
              {currentPrecheck.missingAccountCodes.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-700/60 flex items-center justify-between gap-4">
                  <div>
                    <h6 className="text-xs font-bold text-white">
                      Auto-Recreate Missing Chart of Accounts Heads
                    </h6>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Automatically re-create missing codes ({currentPrecheck.missingAccountCodes.join(', ')}) with initial zero balance to maintain ledger integrity.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRecreateHeads}
                    onChange={(e) => setAutoRecreateHeads(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </div>
              )}

              {/* Original Payload & Financial Details */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Original Record Payload & Voucher Lines
                </span>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Campus:</span>
                      <span className="font-bold text-white">
                        {inspectRecord.campusName} ({inspectRecord.campusCode})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Transaction Date:</span>
                      <span className="font-mono text-slate-200">{inspectRecord.date}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Amount:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        PKR {inspectRecord.financialImpact?.totalAmount?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Original ID:</span>
                      <span className="font-mono text-slate-400 truncate block">
                        {inspectRecord.originalId}
                      </span>
                    </div>
                  </div>

                  {/* Voucher entries breakdown if voucher */}
                  {inspectRecord.recordType === 'VOUCHER' &&
                    inspectRecord.originalPayload.entries && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                          Debit & Credit Journal Entries:
                        </span>
                        <div className="space-y-1 text-xs font-mono">
                          {inspectRecord.originalPayload.entries.map((entry: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80"
                            >
                              <div className="truncate max-w-sm">
                                <span className="text-indigo-400 font-bold">
                                  [{entry.accountCode}]
                                </span>{' '}
                                <span className="text-slate-300 font-sans">{entry.accountName}</span>
                              </div>
                              <div className="text-right space-x-3">
                                {entry.debit > 0 && (
                                  <span className="text-emerald-400">
                                    Dr: PKR {Number(entry.debit).toLocaleString()}
                                  </span>
                                )}
                                {entry.credit > 0 && (
                                  <span className="text-sky-400">
                                    Cr: PKR {Number(entry.credit).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* Restoration Audit Note */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Restoration Audit Note (Optional)
                </label>
                <input
                  type="text"
                  value={restoreNotes}
                  onChange={(e) => setRestoreNotes(e.target.value)}
                  placeholder="e.g. Authorized restoration following financial audit verification..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!currentPrecheck.canRestoreSafely && !alternateVoucherNo.trim()}
                onClick={handlePerformRestore}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                  currentPrecheck.canRestoreSafely || alternateVoucherNo.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirm Atomic Restore to Ledger</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* CONTROLLED PERMANENT DELETION MODAL */}
      {/* --------------------------------------------------------------------- */}
      {permanentDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-800/80 rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4 text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-white">Controlled Permanent Deletion</h4>
              <p className="text-xs text-rose-300">
                Warning: Permanent erasure permanently purges this record from the database. It cannot be recovered without an offline cold backup.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
              <div>
                <span className="text-slate-500">Target Record:</span>{' '}
                <span className="font-mono font-bold text-white">
                  {permanentDeleteTarget.identifier}
                </span>{' '}
                ({permanentDeleteTarget.recordType})
              </div>
              <div>
                <span className="text-slate-500">Campus:</span>{' '}
                <span className="text-slate-300">{permanentDeleteTarget.campusName}</span>
              </div>
              <div>
                <span className="text-slate-500">Value:</span>{' '}
                <span className="font-mono text-emerald-400">
                  PKR {permanentDeleteTarget.financialImpact?.totalAmount?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block">
                Type <span className="font-mono text-rose-400 select-all">PERMANENT_DELETE_CONFIRMED</span> to proceed:
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="PERMANENT_DELETE_CONFIRMED"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block">
                Administrative Justification:
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Reason for permanent database purge..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPermanentDeleteTarget(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmPhrase.trim() !== 'PERMANENT_DELETE_CONFIRMED'}
                onClick={handlePerformPermanentDelete}
                className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  confirmPhrase.trim() === 'PERMANENT_DELETE_CONFIRMED'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Permanent Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
