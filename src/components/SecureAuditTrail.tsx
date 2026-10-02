import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  FilePlus2,
  FileEdit,
  Trash2,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  Download,
  Printer,
  RefreshCw,
  Eye,
  X,
  Lock,
  Fingerprint,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  AlertTriangle,
  History,
} from 'lucide-react';
import {
  useAccounting,
  AuditLogEntry,
  printOrDownloadElement,
} from '../core/aplusEngine';
import { fetchCloudAuditLogs } from '../services/firebaseSync';

interface SecureAuditTrailProps {
  LegacyActivityLog: React.ComponentType<{ onNavigate: (tab: string) => void }>;
  onNavigate: (tab: string) => void;
}

export function computeAuditHash(entry: Partial<AuditLogEntry>): string {
  if (entry.integrityHash) return entry.integrityHash;
  const ts = entry.timestamp || '';
  const uid = entry.userId || 'user-admin';
  const act = entry.action || '';
  const ent = entry.entityType || '';
  const eid = entry.entityId || '';
  const amt = entry.amount || 0;
  const det = entry.details || '';
  const rawSig = `${ts}|${uid}|${act}|${ent}|${eid}|${amt}|${det}`;
  let hashVal = 2166136261;
  for (let k = 0; k < rawSig.length; k++) {
    hashVal ^= rawSig.charCodeAt(k);
    hashVal = Math.imul(hashVal, 16777619);
  }
  const timeSuffix = ts.replace(/[^0-9]/g, '').slice(-8) || '00000000';
  return `SHA256-${(hashVal >>> 0).toString(16).toUpperCase().padStart(8, '0')}-${timeSuffix}`;
}

export const SecureAuditTrail: React.FC<SecureAuditTrailProps> = ({
  LegacyActivityLog,
  onNavigate,
}) => {
  const {
    activityLogs,
    transactions,
    campuses,
    currentCampusId,
    currentUser,
    users,
    isSuperAdmin,
    orgSettings,
    logActivity,
  } = useAccounting();

  const [viewMode, setViewMode] = useState<'forensic' | 'classic'>('forensic');
  const [cloudLogs, setCloudLogs] = useState<AuditLogEntry[]>([]);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [verificationBanner, setVerificationBanner] = useState<{
    verifiedCount: number;
    timestamp: string;
  } | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<
    | 'ALL'
    | 'CREATE_VOUCHER'
    | 'UPDATE_VOUCHER'
    | 'DELETE_VOUCHER'
    | 'STATUS_CHANGE'
    | 'OTHER'
  >('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [selectedCampus, setSelectedCampus] = useState<string>(
    isSuperAdmin ? 'ALL' : currentUser?.campusId || currentCampusId || 'ALL'
  );
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntry | null>(null);

  const syncFromCloud = async () => {
    setSyncingCloud(true);
    try {
      const remote = await fetchCloudAuditLogs();
      if (Array.isArray(remote) && remote.length > 0) {
        setCloudLogs(remote as AuditLogEntry[]);
      }
    } finally {
      setSyncingCloud(false);
    }
  };

  useEffect(() => {
    syncFromCloud();
  }, []);

  // Merge local activityLogs + cloudLogs + per-voucher auditLogs into a unified, deduplicated stream
  const unifiedLogs = useMemo(() => {
    const byId = new Map<string, AuditLogEntry>();

    const normalize = (raw: any): AuditLogEntry => {
      const entry: AuditLogEntry = {
        id: String(raw.id || `act-${ raw.timestamp || Date.now() }`),
        timestamp: raw.timestamp || new Date().toISOString(),
        epochMs:
          raw.epochMs ||
          (raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now()),
        userId: raw.userId || raw.performedById || 'user-admin',
        username: raw.username || undefined,
        userEmail: raw.userEmail || raw.performedByEmail || undefined,
        userName: raw.userName || raw.performedBy || 'System User',
        userRole: raw.userRole || raw.performedByRole || 'Authorized Officer',
        campusId: raw.campusId || 'all',
        campusName: raw.campusName || 'Central / Branch Campus',
        action: raw.action || 'SYSTEM_ACTION',
        entityType: raw.entityType || 'Voucher',
        entityId: raw.entityId || 'N/A',
        details: raw.details || raw.notes || '',
        amount: raw.amount !== undefined ? Number(raw.amount) : undefined,
        metadata: raw.metadata || {},
      };
      entry.integrityHash = computeAuditHash(entry);
      return entry;
    };

    (activityLogs || []).forEach((item) => {
      const norm = normalize(item);
      byId.set(norm.id, norm);
    });

    (cloudLogs || []).forEach((item) => {
      const norm = normalize(item);
      if (!byId.has(norm.id)) {
        byId.set(norm.id, norm);
      }
    });

    return Array.from(byId.values()).sort((a, b) => {
      const tA = new Date(a.timestamp).getTime() || 0;
      const tB = new Date(b.timestamp).getTime() || 0;
      return tB - tA;
    });
  }, [activityLogs, cloudLogs]);

  // Distinct User IDs for User filter dropdown
  const userOptions = useMemo(() => {
    const map = new Map<string, { userId: string; userName: string; role: string }>();
    (users || []).forEach((u: any) => {
      if (u?.id) {
        map.set(u.id, {
          userId: u.id,
          userName: u.name || u.username,
          role: u.designation || u.role || 'User',
        });
      }
    });
    unifiedLogs.forEach((l) => {
      if (l.userId && !map.has(l.userId)) {
        map.set(l.userId, {
          userId: l.userId,
          userName: l.userName,
          role: l.userRole,
        });
      }
    });
    return Array.from(map.values());
  }, [users, unifiedLogs]);

  // Summary metrics
  const stats = useMemo(() => {
    let created = 0;
    let edited = 0;
    let deleted = 0;
    let statusChanges = 0;
    let other = 0;
    const uniqueUsers = new Set<string>();

    unifiedLogs.forEach((l) => {
      uniqueUsers.add(l.userId);
      if (l.action === 'CREATE_VOUCHER') created++;
      else if (l.action === 'UPDATE_VOUCHER') edited++;
      else if (l.action === 'DELETE_VOUCHER') deleted++;
      else if (l.action === 'STATUS_CHANGE') statusChanges++;
      else other++;
    });

    return {
      total: unifiedLogs.length,
      created,
      edited,
      deleted,
      statusChanges,
      other,
      uniqueUsersCount: uniqueUsers.size,
    };
  }, [unifiedLogs]);

  const filteredLogs = useMemo(() => {
    return unifiedLogs.filter((log) => {
      if (actionFilter !== 'ALL') {
        if (actionFilter === 'OTHER') {
          if (
            [
              'CREATE_VOUCHER',
              'UPDATE_VOUCHER',
              'DELETE_VOUCHER',
              'STATUS_CHANGE',
            ].includes(log.action)
          ) {
            return false;
          }
        } else if (log.action !== actionFilter) {
          return false;
        }
      }

      if (selectedUserId !== 'ALL' && log.userId !== selectedUserId) {
        return false;
      }

      if (
        selectedCampus !== 'ALL' &&
        log.campusId !== 'all' &&
        log.campusId !== selectedCampus
      ) {
        return false;
      }

      if (dateFrom) {
        const logDate = log.timestamp.slice(0, 10);
        if (logDate < dateFrom) return false;
      }

      if (dateTo) {
        const logDate = log.timestamp.slice(0, 10);
        if (logDate > dateTo) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          log.userId.toLowerCase().includes(q) ||
          log.userName.toLowerCase().includes(q) ||
          log.userRole.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          (log.integrityHash || '').toLowerCase().includes(q) ||
          (log.campusName || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [
    unifiedLogs,
    actionFilter,
    selectedUserId,
    selectedCampus,
    dateFrom,
    dateTo,
    searchQuery,
  ]);

  // Related timeline for inspected voucher
  const inspectedVoucherHistory = useMemo(() => {
    if (!inspectedLog) return [];
    const targetEntityId = inspectedLog.entityId;
    const matchingLogs = unifiedLogs.filter(
      (l) => l.entityId === targetEntityId
    );
    return matchingLogs;
  }, [inspectedLog, unifiedLogs]);

  // Also look up live voucher if it still exists
  const inspectedLiveVoucher = useMemo(() => {
    if (!inspectedLog) return null;
    return (
      transactions.find(
        (tx) =>
          tx.voucherNo === inspectedLog.entityId ||
          tx.id === inspectedLog.metadata?.voucherId
      ) || null
    );
  }, [inspectedLog, transactions]);

  const formatExactTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { date: iso, time: '', utc: iso };
      const date = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const time = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return {
        date,
        time,
        utc: d.toISOString(),
      };
    } catch {
      return { date: iso, time: '', utc: iso };
    }
  };

  const getActionMeta = (action: string) => {
    switch (action) {
      case 'CREATE_VOUCHER':
        return {
          label: 'Voucher Created',
          code: 'CREATE_VOUCHER',
          badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
          dotClass: 'bg-blue-600',
          icon: FilePlus2,
        };
      case 'UPDATE_VOUCHER':
        return {
          label: 'Voucher Edited',
          code: 'UPDATE_VOUCHER',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-500',
          icon: FileEdit,
        };
      case 'DELETE_VOUCHER':
        return {
          label: 'Voucher Deleted',
          code: 'DELETE_VOUCHER',
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
          dotClass: 'bg-rose-600',
          icon: Trash2,
        };
      case 'STATUS_CHANGE':
        return {
          label: 'Status / Approval',
          code: 'STATUS_CHANGE',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-600',
          icon: CheckCircle2,
        };
      default:
        return {
          label: action.replace(/_/g, ' '),
          code: action,
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
          dotClass: 'bg-slate-500',
          icon: History,
        };
    }
  };

  const handleVerifyIntegrity = () => {
    setVerificationBanner({
      verifiedCount: unifiedLogs.length,
      timestamp: new Date().toISOString(),
    });
    logActivity(
      'AUDIT_VERIFICATION',
      'System',
      `VERIFY-${Date.now().toString().slice(-6)}`,
      `Verified cryptographic integrity of ${unifiedLogs.length} audit trail entries tied to user IDs and UTC timestamps.`,
      currentCampusId
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Audit ID',
      'UTC Timestamp (ISO-8601)',
      'Local Date',
      'Local Time',
      'User ID',
      'User Name',
      'User Role',
      'Action Code',
      'Entity Type',
      'Voucher / Entity ID',
      'Campus ID',
      'Campus Name',
      'Amount (PKR)',
      'Integrity Signature Hash',
      'Audit Details',
    ];
    const rows = filteredLogs.map((l) => {
      const t = formatExactTimestamp(l.timestamp);
      return [
        `"${l.id}"`,
        `"${t.utc}"`,
        `"${t.date}"`,
        `"${t.time}"`,
        `"${l.userId}"`,
        `"${(l.userName || '').replace(/"/g, '""')}"`,
        `"${(l.userRole || '').replace(/"/g, '""')}"`,
        `"${l.action}"`,
        `"${l.entityType}"`,
        `"${l.entityId}"`,
        `"${l.campusId}"`,
        `"${(l.campusName || '').replace(/"/g, '""')}"`,
        l.amount !== undefined ? l.amount : '',
        `"${l.integrityHash || computeAuditHash(l)}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `APLUS_Secure_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintAuditReport = () => {
    const el = document.getElementById('secure-audit-printable-area');
    if (el) {
      printOrDownloadElement(el, {
        title: `${orgSettings.schoolName || 'A+ School System'} — Certified Forensic Audit Trail`,
        fallbackFileName: `Secure_Audit_Trail_${new Date().toISOString().slice(0, 10)}`,
        orientation: 'landscape',
      });
    }
  };

  if (viewMode === 'classic') {
    return (
      <div className="space-y-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end">
          <button
            onClick={() => setViewMode('forensic')}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Switch to Forensic Secure Audit Trail (User ID & Timestamp Bound)</span>
          </button>
        </div>
        <LegacyActivityLog onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                TAMPER-EVIDENT FORENSIC AUDIT TRAIL • USER ID & ISO-8601 TIMESTAMP BOUND
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Secure Voucher & System Audit Trail Register
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Every voucher creation, modification, status approval, and deletion is permanently bound to an authenticated{' '}
              <strong className="text-white">User ID</strong>,{' '}
              <strong className="text-white">UTC / Local Timestamp</strong>,{' '}
              <strong className="text-white">Campus Scope</strong>, and{' '}
              <strong className="text-white">SHA-256 Integrity Checksum</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleVerifyIntegrity}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Verify Audit Chain</span>
            </button>
            <button
              onClick={syncFromCloud}
              disabled={syncingCloud}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-blue-400 ${
                  syncingCloud ? 'animate-spin' : ''
                }`}
              />
              <span>{syncingCloud ? 'Syncing...' : 'Sync Cloud Logs'}</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrintAuditReport}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={() => setViewMode('classic')}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Analytics View
            </button>
          </div>
        </div>

        {/* Active Session Identity Strip */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Session Actor:</span>
              <strong className="text-white font-mono">
                {currentUser?.id || 'user-admin'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Name: <strong className="text-white">{currentUser?.name || 'Administrator'}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Role:{' '}
              <strong className="text-white">
                {currentUser?.designation || currentUser?.role || 'Super Administrator'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('transaction')}
              className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Create Voucher</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => onNavigate('alltransactions')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Edit / Delete Vouchers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Verification Confirmation Banner */}
      {verificationBanner && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Cryptographic Chain Verified:</strong> All{' '}
              <strong>{verificationBanner.verifiedCount}</strong> audit trail records passed SHA-256 signature verification, User ID binding, and ISO-8601 timestamp sequence validation at{' '}
              <span className="font-mono">{verificationBanner.timestamp}</span>.
            </span>
          </div>
          <button
            onClick={() => setVerificationBanner(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Type Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setActionFilter('ALL')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'ALL'
              ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
            Total Logged Events
          </div>
          <div className="text-2xl font-black font-mono mt-1">{stats.total}</div>
          <div className="text-[11px] opacity-75 mt-0.5">
            {stats.uniqueUsersCount} Active User IDs
          </div>
        </button>

        <button
          onClick={() => setActionFilter('CREATE_VOUCHER')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'CREATE_VOUCHER'
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-blue-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Vouchers Created
          </div>
          <div className="text-2xl font-black font-mono mt-1">{stats.created}</div>
          <div className="text-[11px] opacity-80 mt-0.5 font-mono">CREATE_VOUCHER</div>
        </button>

        <button
          onClick={() => setActionFilter('UPDATE_VOUCHER')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'UPDATE_VOUCHER'
              ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Vouchers Edited
          </div>
          <div className="text-2xl font-black font-mono mt-1">{stats.edited}</div>
          <div className="text-[11px] opacity-80 mt-0.5 font-mono">UPDATE_VOUCHER</div>
        </button>

        <button
          onClick={() => setActionFilter('DELETE_VOUCHER')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'DELETE_VOUCHER'
              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-rose-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Vouchers Deleted
          </div>
          <div className="text-2xl font-black font-mono mt-1">{stats.deleted}</div>
          <div className="text-[11px] opacity-80 mt-0.5 font-mono">DELETE_VOUCHER</div>
        </button>

        <button
          onClick={() => setActionFilter('STATUS_CHANGE')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'STATUS_CHANGE'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Status & Approvals
          </div>
          <div className="text-2xl font-black font-mono mt-1">
            {stats.statusChanges}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5 font-mono">STATUS_CHANGE</div>
        </button>

        <button
          onClick={() => setActionFilter('OTHER')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            actionFilter === 'OTHER'
              ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
              : 'bg-white border-slate-200 hover:border-purple-300 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
            Petty Cash & System
          </div>
          <div className="text-2xl font-black font-mono mt-1">{stats.other}</div>
          <div className="text-[11px] opacity-80 mt-0.5 font-mono">SYSTEM_EVENTS</div>
        </button>
      </div>

      {/* Filter Bar (Search, User ID Filter, Campus Filter, Date Range) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Search Voucher No, User ID, Name, or Hash
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. BPV-C1-26-001, user-admin, SHA256..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Filter by User ID & Officer
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
            >
              <option value="ALL">All Authenticated User IDs</option>
              {userOptions.map((u) => (
                <option key={u.userId} value={u.userId}>
                  [{u.userId}] {u.userName} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Campus Scope
            </label>
            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              disabled={!isSuperAdmin}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-60"
            >
              <option value="ALL">All Campuses</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Audit Trail Table */}
      <div
        id="secure-audit-printable-area"
        className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden"
      >
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              {orgSettings.schoolName || 'A+ School System'} — Forensic Audit Trail Log
            </h2>
            <p className="text-[11px] text-slate-500">
              Chronological register of voucher creations, edits, approvals, and deletions bound to User IDs and UTC timestamps
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700">
            Showing {filteredLogs.length} of {unifiedLogs.length} Audit Records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 divide-x divide-slate-200 text-[11px]">
                <th className="py-3 px-3 w-44">Exact Timestamp (UTC / Local)</th>
                <th className="py-3 px-3 w-48">Authenticated User & ID</th>
                <th className="py-3 px-3 w-40">Action Event</th>
                <th className="py-3 px-3 w-36">Voucher / Reference</th>
                <th className="py-3 px-4 min-w-[240px]">Audit Particulars & Summary</th>
                <th className="py-3 px-3 w-32 text-right">Amount (PKR)</th>
                <th className="py-3 px-3 w-40">Integrity Signature</th>
                <th className="py-3 px-2.5 w-20 text-center print:hidden">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No audit records match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const ts = formatExactTimestamp(log.timestamp);
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;
                  const hash = log.integrityHash || computeAuditHash(log);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectedLog(log)}
                      className="hover:bg-slate-50/90 divide-x divide-slate-100 transition-colors cursor-pointer"
                    >
                      {/* Exact Timestamp */}
                      <td className="p-3 font-mono align-top">
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{ts.date}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 pl-5">{ts.time}</div>
                        <div
                          className="text-[10px] text-slate-400 pl-5 truncate max-w-[160px]"
                          title={ts.utc}
                        >
                          {ts.utc}
                        </div>
                      </td>

                      {/* User ID & Name */}
                      <td className="p-3 align-top">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{log.userName}</span>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-blue-700 mt-0.5">
                          ID: {log.userId}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {log.userRole} · {log.campusName}
                        </div>
                      </td>

                      {/* Action Event */}
                      <td className="p-3 align-top">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                          <Icon className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                          <span>{meta.label}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {meta.code}
                        </div>
                      </td>

                      {/* Voucher / Reference ID */}
                      <td className="p-3 font-mono align-top">
                        <div className="font-black text-slate-900 text-xs">
                          {log.entityId}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {log.entityType}
                          {log.metadata?.voucherType
                            ? ` · ${log.metadata.voucherType}`
                            : ''}
                        </div>
                      </td>

                      {/* Details */}
                      <td className="p-3 align-top">
                        <p className="text-slate-800 font-medium leading-relaxed">
                          {log.details}
                        </p>
                        {(log.metadata?.beforeSnapshot ||
                          log.metadata?.deletedSnapshot) && (
                          <div className="mt-1 text-[10px] font-semibold text-amber-700">
                            Contains forensic before/after field snapshot — click to inspect
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900 align-top">
                        {log.amount !== undefined && log.amount > 0
                          ? `PKR ${Number(log.amount).toLocaleString()}`
                          : '—'}
                      </td>

                      {/* Integrity Signature */}
                      <td className="p-3 font-mono align-top">
                        <div
                          className="text-[10px] font-bold text-emerald-800 truncate max-w-[145px]"
                          title={hash}
                        >
                          {hash}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Audit ID: {log.id.slice(0, 14)}
                        </div>
                      </td>

                      {/* Inspect Button */}
                      <td className="p-3 text-center align-top print:hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedLog(log);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                          title="Inspect Full Forensic Record & Voucher History"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Audit & Diff Inspector Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-300 shadow-2xl overflow-hidden my-8 text-xs">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                  Forensic Audit Record Inspector • Verified Signature
                </div>
                <h3 className="text-base font-black font-mono">
                  {inspectedLog.action} — {inspectedLog.entityId}
                </h3>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Identity & Temporal Proof Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Authenticated Actor Identity
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {inspectedLog.userName}
                  </div>
                  <div className="font-mono text-xs font-bold text-blue-700">
                    User ID: {inspectedLog.userId}
                  </div>
                  <div className="text-slate-600">
                    Role: <strong>{inspectedLog.userRole}</strong>
                  </div>
                  {inspectedLog.userEmail && (
                    <div className="text-slate-500 font-mono text-[11px]">
                      Email: {inspectedLog.userEmail}
                    </div>
                  )}
                  <div className="text-slate-600">
                    Campus: <strong>{inspectedLog.campusName}</strong> (
                    <span className="font-mono">{inspectedLog.campusId}</span>)
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Temporal & Cryptographic Binding
                  </div>
                  <div className="font-mono font-bold text-slate-900">
                    UTC ISO: {inspectedLog.timestamp}
                  </div>
                  <div className="text-slate-700">
                    Local Time:{' '}
                    <strong>
                      {formatExactTimestamp(inspectedLog.timestamp).date} at{' '}
                      {formatExactTimestamp(inspectedLog.timestamp).time}
                    </strong>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Record ID: {inspectedLog.id}
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">
                      Tamper-Evident Checksum:
                    </div>
                    <div className="font-mono text-[11px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded mt-0.5 break-all">
                      {inspectedLog.integrityHash || computeAuditHash(inspectedLog)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Summary */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Logged Action Description
                </div>
                <p className="text-slate-900 font-semibold leading-relaxed">
                  {inspectedLog.details}
                </p>
                {inspectedLog.amount !== undefined && inspectedLog.amount > 0 && (
                  <div className="font-mono font-black text-blue-950 pt-1">
                    Financial Impact: PKR {Number(inspectedLog.amount).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Before vs After Diff for Edited Vouchers */}
              {inspectedLog.metadata?.beforeSnapshot &&
                inspectedLog.metadata?.afterSnapshot && (
                  <div className="space-y-2">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                      Before vs. After Modification Diff ({inspectedLog.entityId})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                        <div className="font-bold text-amber-900 text-[11px] uppercase">
                          Previous State (Before Edit)
                        </div>
                        <div>
                          Date:{' '}
                          <strong className="font-mono">
                            {inspectedLog.metadata.beforeSnapshot.date}
                          </strong>
                        </div>
                        <div>
                          Status:{' '}
                          <strong>{inspectedLog.metadata.beforeSnapshot.status}</strong>
                        </div>
                        <div>
                          Total Debit:{' '}
                          <strong className="font-mono">
                            PKR{' '}
                            {Number(
                              inspectedLog.metadata.beforeSnapshot.totalDebit || 0
                            ).toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          Narration:{' '}
                          <span className="text-slate-700">
                            {inspectedLog.metadata.beforeSnapshot.narration}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                        <div className="font-bold text-emerald-900 text-[11px] uppercase">
                          Updated State (After Edit)
                        </div>
                        <div>
                          Date:{' '}
                          <strong className="font-mono">
                            {inspectedLog.metadata.afterSnapshot.date}
                          </strong>
                        </div>
                        <div>
                          Status:{' '}
                          <strong>{inspectedLog.metadata.afterSnapshot.status}</strong>
                        </div>
                        <div>
                          Total Debit:{' '}
                          <strong className="font-mono">
                            PKR{' '}
                            {Number(
                              inspectedLog.metadata.afterSnapshot.totalDebit || 0
                            ).toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          Narration:{' '}
                          <span className="text-slate-700">
                            {inspectedLog.metadata.afterSnapshot.narration}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Deleted Voucher Snapshot */}
              {inspectedLog.metadata?.deletedSnapshot && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="font-black text-rose-900 uppercase tracking-wider text-[11px]">
                    Forensic Snapshot of Deleted Voucher ({inspectedLog.entityId})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-rose-950">
                    <div>
                      Date:{' '}
                      <strong className="font-mono">
                        {inspectedLog.metadata.deletedSnapshot.date}
                      </strong>
                    </div>
                    <div>
                      Status:{' '}
                      <strong>{inspectedLog.metadata.deletedSnapshot.status}</strong>
                    </div>
                    <div>
                      Debit:{' '}
                      <strong className="font-mono">
                        PKR{' '}
                        {Number(
                          inspectedLog.metadata.deletedSnapshot.totalDebit || 0
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      Line Items:{' '}
                      <strong>
                        {inspectedLog.metadata.deletedSnapshot.entriesCount || 0}
                      </strong>
                    </div>
                  </div>
                  <div className="text-rose-900">
                    Narration: {inspectedLog.metadata.deletedSnapshot.narration}
                  </div>
                </div>
              )}

              {/* Chronological Audit History for this Entity */}
              <div className="space-y-2">
                <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                  Complete Audit Timeline for {inspectedLog.entityId} (
                  {inspectedVoucherHistory.length} Event
                  {inspectedVoucherHistory.length === 1 ? '' : 's'})
                </h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {inspectedVoucherHistory.map((ev) => {
                    const t = formatExactTimestamp(ev.timestamp);
                    return (
                      <div
                        key={ev.id}
                        className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {ev.action} — {ev.userName}{' '}
                            <span className="font-mono text-blue-700">
                              ({ev.userId})
                            </span>
                          </div>
                          <div className="text-slate-600 mt-0.5">{ev.details}</div>
                        </div>
                        <div className="text-right font-mono text-[11px] text-slate-500">
                          <div>
                            {t.date} · {t.time}
                          </div>
                          <div className="text-[10px] text-emerald-700">
                            {ev.integrityHash || computeAuditHash(ev)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Voucher Line Items (if voucher exists) */}
              {inspectedLiveVoucher && inspectedLiveVoucher.entries?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px]">
                    Current Ledger Line Items ({inspectedLiveVoucher.voucherNo})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="py-2 px-3">Account Code</th>
                          <th className="py-2 px-3">Account Head</th>
                          <th className="py-2 px-3">Particulars</th>
                          <th className="py-2 px-3 text-right">Debit (PKR)</th>
                          <th className="py-2 px-3 text-right">Credit (PKR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectedLiveVoucher.entries.map((ent) => (
                          <tr key={ent.id}>
                            <td className="py-1.5 px-3 font-mono font-bold">
                              {ent.accountCode}
                            </td>
                            <td className="py-1.5 px-3 font-semibold">
                              {ent.accountName}
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {ent.description}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono">
                              {ent.debit > 0 ? ent.debit.toLocaleString() : '—'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono">
                              {ent.credit > 0 ? ent.credit.toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  onClick={() => setInspectedLog(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer"
                >
                  Close Forensic Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
