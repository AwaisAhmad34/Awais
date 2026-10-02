import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ShieldAlert,
  Radio,
  Search,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Play,
  Pause,
  Zap,
  Globe,
  KeyRound,
  Eye,
} from 'lucide-react';
import type {
  SchoolInstituteAccount,
  TenantCampusNode,
} from './MultiSchoolAdminPanel';

export const CAMPUS_ACTIVITY_STREAM_STORAGE_KEY =
  'aplus_realtime_campus_activity_stream_v1';

export type CampusActivitySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';

export type CampusActivityCategory =
  | 'AUTH_SECURITY'
  | 'HIGH_VALUE_VOUCHER'
  | 'PETTY_CASH'
  | 'DATA_EXPORT'
  | 'POLICY_VIOLATION';

export interface CampusActivityStreamEvent {
  id: string;
  timestampIso: string;
  timestampDisplay: string;
  organizationId: string;
  organizationCode: string;
  organizationName: string;
  campusId: string;
  campusCode: string;
  campusName: string;
  campusLoginId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  category: CampusActivityCategory;
  severity: CampusActivitySeverity;
  actionCode: string;
  summary: string;
  amountPKR?: number;
  ipAddress: string;
  cityLocation: string;
  eventHash: string;
  reviewedBySiteOwner: boolean;
  flaggedForAudit: boolean;
}

const INITIAL_CAMPUS_ACTIVITY_EVENTS: CampusActivityStreamEvent[] = [
  {
    id: 'cas-evt-101',
    timestampIso: '2026-10-01T23:54:12.000Z',
    timestampDisplay: '2026-10-01 11:54:12 PM',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'A+ School System',
    campusId: 'tcamp-aplus-main-1',
    campusCode: 'CVT-MAIN',
    campusName: 'A+ Central Model Main Campus',
    campusLoginId: 'LOGIN-CVT-MAIN',
    actorName: 'Maqsood Ahmad',
    actorEmail: 'cvt.main@aplusschool.edu.pk',
    actorRole: 'Campus Admin',
    category: 'HIGH_VALUE_VOUCHER',
    severity: 'HIGH',
    actionCode: 'HIGH_VALUE_BPV_APPROVED',
    summary:
      'Approved high-value Bank Payment Voucher BPV-2026-0841 for Science Lab Equipment & Generator Overhaul.',
    amountPKR: 485000,
    ipAddress: '119.160.98.14',
    cityLocation: 'Lahore, PK',
    eventHash: 'SHA256:9f84b2c1e07a48d1',
    reviewedBySiteOwner: false,
    flaggedForAudit: false,
  },
  {
    id: 'cas-evt-102',
    timestampIso: '2026-10-01T23:51:40.000Z',
    timestampDisplay: '2026-10-01 11:51:40 PM',
    organizationId: 'inst-apex-college',
    organizationCode: 'ORG-APEX-002',
    organizationName: 'Apex Science & Commerce Institute',
    campusId: 'tcamp-apex-main-1',
    campusCode: 'APEX-ISB-MAIN',
    campusName: 'Apex Islamabad Main Campus',
    campusLoginId: 'LOGIN-APEX-ISB01',
    actorName: 'Kamran Raza',
    actorEmail: 'isb.main@apexinstitute.edu.pk',
    actorRole: 'Campus Admin',
    category: 'PETTY_CASH',
    severity: 'CRITICAL',
    actionCode: 'PETTY_CASH_THRESHOLD_EXCEEDED',
    summary:
      'Posted Petty Cash slip PC-2026-319 (PKR 28,500), pushing monthly campus petty cash usage +48.0% above 3-month historical average.',
    amountPKR: 28500,
    ipAddress: '203.99.172.88',
    cityLocation: 'Islamabad, PK',
    eventHash: 'SHA256:4a19d7e3b92c61f0',
    reviewedBySiteOwner: false,
    flaggedForAudit: true,
  },
  {
    id: 'cas-evt-103',
    timestampIso: '2026-10-01T23:48:05.000Z',
    timestampDisplay: '2026-10-01 11:48:05 PM',
    organizationId: 'inst-alhuda-academy',
    organizationCode: 'ORG-ALHUDA-003',
    organizationName: 'Al-Huda Islamic & Science Academy',
    campusId: 'tcamp-alhuda-main-1',
    campusCode: 'ALHUDA-FSD-01',
    campusName: 'Al-Huda Peoples Colony Main Campus',
    campusLoginId: 'LOGIN-ALHUDA-01',
    actorName: 'Prof. Usman Ghani',
    actorEmail: 'fsd.main@alhudaacademy.org',
    actorRole: 'Campus Admin',
    category: 'POLICY_VIOLATION',
    severity: 'CRITICAL',
    actionCode: 'BLOCKED_SUSPENDED_CAMPUS_LOGIN_ATTEMPT',
    summary:
      'Attempted campus portal login and voucher export while Campus Login ID [LOGIN-ALHUDA-01] is blocked by Site Owner.',
    ipAddress: '39.45.114.209',
    cityLocation: 'Faisalabad, PK',
    eventHash: 'SHA256:7c31e8f9a10b54d2',
    reviewedBySiteOwner: false,
    flaggedForAudit: true,
  },
  {
    id: 'cas-evt-104',
    timestampIso: '2026-10-01T23:42:19.000Z',
    timestampDisplay: '2026-10-01 11:42:19 PM',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'A+ School System',
    campusId: 'tcamp-aplus-sub-1',
    campusCode: 'CVT-SUB-JR',
    campusName: 'A+ Junior & Montessori Wing (Sub-Campus)',
    campusLoginId: 'LOGIN-CVT-SUBJR',
    actorName: 'Ayesha Siddiqa',
    actorEmail: 'cvt.subjr@aplusschool.edu.pk',
    actorRole: 'Sub-Campus Admin',
    category: 'DATA_EXPORT',
    severity: 'MEDIUM',
    actionCode: 'BULK_VOUCHER_PDF_BATCH_PRINTED',
    summary:
      'Generated single printable multi-page PDF batch (8 Vouchers with page breaks) for Sub-Campus monthly audit file.',
    amountPKR: 192400,
    ipAddress: '119.160.98.22',
    cityLocation: 'Lahore, PK',
    eventHash: 'SHA256:2e65a9c4d81f30b7',
    reviewedBySiteOwner: true,
    flaggedForAudit: false,
  },
  {
    id: 'cas-evt-105',
    timestampIso: '2026-10-01T23:36:50.000Z',
    timestampDisplay: '2026-10-01 11:36:50 PM',
    organizationId: 'inst-aplus-main',
    organizationCode: 'ORG-APLUS-001',
    organizationName: 'A+ School System',
    campusId: 'tcamp-aplus-main-1',
    campusCode: 'CVT-MAIN',
    campusName: 'A+ Central Model Main Campus',
    campusLoginId: 'LOGIN-CVT-MAIN',
    actorName: 'Maqsood Ahmad',
    actorEmail: 'cvt.main@aplusschool.edu.pk',
    actorRole: 'Campus Admin',
    category: 'AUTH_SECURITY',
    severity: 'INFO',
    actionCode: 'CAMPUS_ADMIN_SESSION_VERIFIED',
    summary:
      'Authenticated Campus Login [LOGIN-CVT-MAIN] and completed 7-Day Physical Cash Reconciliation count (Zero Variance).',
    amountPKR: 340000,
    ipAddress: '119.160.98.14',
    cityLocation: 'Lahore, PK',
    eventHash: 'SHA256:8b12f4c9e23a76c5',
    reviewedBySiteOwner: true,
    flaggedForAudit: false,
  },
];

export function getStoredCampusActivityStream(): CampusActivityStreamEvent[] {
  try {
    const raw = localStorage.getItem(CAMPUS_ACTIVITY_STREAM_STORAGE_KEY);
    if (!raw) return INITIAL_CAMPUS_ACTIVITY_EVENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_CAMPUS_ACTIVITY_EVENTS;
  } catch {
    return INITIAL_CAMPUS_ACTIVITY_EVENTS;
  }
}

export function saveStoredCampusActivityStream(
  events: CampusActivityStreamEvent[]
): void {
  try {
    localStorage.setItem(
      CAMPUS_ACTIVITY_STREAM_STORAGE_KEY,
      JSON.stringify(events.slice(0, 150))
    );
    window.dispatchEvent(
      new CustomEvent('aplus-campus-activity-stream-updated', {
        detail: events,
      })
    );
  } catch (err) {
    console.warn('Failed to save campus activity stream:', err);
  }
}

export function publishCampusActivityEvent(
  partial: Omit<
    CampusActivityStreamEvent,
    | 'id'
    | 'timestampIso'
    | 'timestampDisplay'
    | 'eventHash'
    | 'reviewedBySiteOwner'
    | 'flaggedForAudit'
  > & { flaggedForAudit?: boolean }
): CampusActivityStreamEvent {
  const now = new Date();
  const hashSuffix = Math.random().toString(16).slice(2, 18);
  const newEvt: CampusActivityStreamEvent = {
    ...partial,
    id: `cas-evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestampIso: now.toISOString(),
    timestampDisplay: now.toLocaleString(),
    eventHash: `SHA256:${hashSuffix}`,
    reviewedBySiteOwner: false,
    flaggedForAudit:
      partial.flaggedForAudit ??
      (partial.severity === 'CRITICAL' || partial.severity === 'HIGH'),
  };
  const current = getStoredCampusActivityStream();
  const next = [newEvt, ...current];
  saveStoredCampusActivityStream(next);
  return newEvt;
}

interface RealTimeCampusActivityStreamProps {
  institutes: SchoolInstituteAccount[];
  tenantCampuses: TenantCampusNode[];
  onToggleCampusLoginLock?: (campusId: string) => void;
  onTriggerToast?: (msg: string) => void;
}

export const RealTimeCampusActivityStream: React.FC<
  RealTimeCampusActivityStreamProps
> = ({
  institutes,
  tenantCampuses,
  onToggleCampusLoginLock,
  onTriggerToast,
}) => {
  const [events, setEvents] = useState<CampusActivityStreamEvent[]>(() =>
    getStoredCampusActivityStream()
  );
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFlagged, setOnlyFlagged] = useState<boolean>(false);

  // Subscribe to cross-component campus activity events
  useEffect(() => {
    const handler = () => setEvents(getStoredCampusActivityStream());
    window.addEventListener('aplus-campus-activity-stream-updated', handler);
    return () =>
      window.removeEventListener(
        'aplus-campus-activity-stream-updated',
        handler
      );
  }, []);

  // Simulated real-time network heartbeat for live campus admin oversight when enabled
  const simulateIncomingNetworkEvent = () => {
    const sampleTemplates: Array<{
      campIndex: number;
      category: CampusActivityCategory;
      severity: CampusActivitySeverity;
      actionCode: string;
      summary: string;
      amountPKR?: number;
      ip: string;
    }> = [
      {
        campIndex: 0,
        category: 'HIGH_VALUE_VOUCHER',
        severity: 'HIGH',
        actionCode: 'CAMPUS_BPV_POSTED',
        summary:
          'Campus Admin posted Bank Payment Voucher for Utility & Solar Inverter Maintenance.',
        amountPKR: 165000,
        ip: '119.160.98.14',
      },
      {
        campIndex: 1,
        category: 'PETTY_CASH',
        severity: 'MEDIUM',
        actionCode: 'IMPREST_PETTY_CASH_DISBURSED',
        summary:
          'Sub-Campus Admin recorded Petty Cash disbursement for Classroom Stationery & Lab Consumables.',
        amountPKR: 14800,
        ip: '119.160.98.22',
      },
      {
        campIndex: 2,
        category: 'DATA_EXPORT',
        severity: 'INFO',
        actionCode: 'MULTI_VOUCHER_PDF_GENERATED',
        summary:
          'Campus Admin exported 6 Ledger Vouchers into a single A4 PDF with page breaks.',
        amountPKR: 230000,
        ip: '203.99.172.88',
      },
      {
        campIndex: 3,
        category: 'POLICY_VIOLATION',
        severity: 'CRITICAL',
        actionCode: 'UNAUTHORIZED_MODULE_ACCESS_BLOCKED',
        summary:
          'Campus Admin attempted to access restricted ERP Payroll module outside assigned campus scope (Blocked by Site Owner Policy).',
        ip: '39.45.114.209',
      },
    ];

    const pick =
      sampleTemplates[Math.floor(Math.random() * sampleTemplates.length)];
    const targetCamp =
      tenantCampuses[pick.campIndex % Math.max(1, tenantCampuses.length)] ||
      tenantCampuses[0];
    if (!targetCamp) return;

    const org = institutes.find((i) => i.id === targetCamp.organizationId);
    const created = publishCampusActivityEvent({
      organizationId: targetCamp.organizationId,
      organizationCode: org?.code || 'ORG-001',
      organizationName: org?.name || 'School Client',
      campusId: targetCamp.id,
      campusCode: targetCamp.code,
      campusName: targetCamp.name,
      campusLoginId: targetCamp.campusLoginId,
      actorName: targetCamp.campusAdminName,
      actorEmail:
        targetCamp.campusLoginUsername || targetCamp.campusAdminEmail,
      actorRole: targetCamp.parentCampusId
        ? 'Sub-Campus Admin'
        : 'Main Campus Admin',
      category: pick.category,
      severity: pick.severity,
      actionCode: pick.actionCode,
      summary: pick.summary,
      amountPKR: pick.amountPKR,
      ipAddress: pick.ip,
      cityLocation: `${targetCamp.city}, PK`,
    });

    if (onTriggerToast) {
      onTriggerToast(
        `Live Campus Event Captured: [${created.campusLoginId}] ${created.actionCode}`
      );
    }
  };

  useEffect(() => {
    if (!isLiveStreaming) return;
    const timer = setInterval(() => {
      // Gently emit a live network heartbeat event every 25 seconds while live stream is active
      simulateIncomingNetworkEvent();
    }, 25000);
    return () => clearInterval(timer);
  }, [isLiveStreaming, tenantCampuses.length]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((evt) => {
      if (orgFilter !== 'ALL' && evt.organizationId !== orgFilter) return false;
      if (campusFilter !== 'ALL' && evt.campusId !== campusFilter) return false;
      if (severityFilter !== 'ALL' && evt.severity !== severityFilter)
        return false;
      if (categoryFilter !== 'ALL' && evt.category !== categoryFilter)
        return false;
      if (onlyFlagged && !evt.flaggedForAudit) return false;
      if (q) {
        const hay = `${evt.organizationCode} ${evt.organizationName} ${evt.campusName} ${evt.campusLoginId} ${evt.actorName} ${evt.actorEmail} ${evt.actionCode} ${evt.summary} ${evt.ipAddress}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    events,
    orgFilter,
    campusFilter,
    severityFilter,
    categoryFilter,
    onlyFlagged,
    searchQuery,
  ]);

  const criticalUnreviewedCount = useMemo(
    () =>
      events.filter(
        (e) =>
          (e.severity === 'CRITICAL' || e.severity === 'HIGH') &&
          !e.reviewedBySiteOwner
      ).length,
    [events]
  );

  const handleToggleReviewed = (eventId: string) => {
    const next = events.map((e) =>
      e.id === eventId
        ? { ...e, reviewedBySiteOwner: !e.reviewedBySiteOwner }
        : e
    );
    setEvents(next);
    saveStoredCampusActivityStream(next);
  };

  const handleToggleFlagged = (eventId: string) => {
    const next = events.map((e) =>
      e.id === eventId ? { ...e, flaggedForAudit: !e.flaggedForAudit } : e
    );
    setEvents(next);
    saveStoredCampusActivityStream(next);
  };

  const handleExportStreamCsv = () => {
    const headers = [
      'Timestamp',
      'Client Code',
      'Campus Login ID',
      'Campus Name',
      'Actor Name',
      'Role',
      'Category',
      'Severity',
      'Action Code',
      'Amount PKR',
      'IP Address',
      'Hash',
      'Summary',
    ];
    const rows = filteredEvents.map((e) => [
      `"${e.timestampDisplay}"`,
      `"${e.organizationCode}"`,
      `"${e.campusLoginId}"`,
      `"${e.campusName}"`,
      `"${e.actorName}"`,
      `"${e.actorRole}"`,
      `"${e.category}"`,
      `"${e.severity}"`,
      `"${e.actionCode}"`,
      e.amountPKR || 0,
      `"${e.ipAddress}"`,
      `"${e.eventHash}"`,
      `"${e.summary.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SiteOwner_Campus_Activity_Stream_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="bg-white rounded-2xl border-2 border-slate-900 p-5 space-y-4 text-xs shadow-2xs"
      data-site-admin-allowed="true"
    >
      {/* Header Banner */}
      <div className="bg-slate-950 text-white rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <Radio
              className={`w-5 h-5 ${isLiveStreaming ? 'animate-pulse' : ''}`}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                Real-Time Network Security Oversight
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono font-black text-[10px] ${
                  isLiveStreaming
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {isLiveStreaming ? '● LIVE STREAMING' : '❚❚ PAUSED'}
              </span>
              {criticalUnreviewedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px]">
                  {criticalUnreviewedCount} Critical/High Unreviewed
                </span>
              )}
            </div>
            <h3 className="font-black text-sm sm:text-base text-white mt-0.5">
              Real-Time Campus Activity Stream ({filteredEvents.length} Events Logged Across {tenantCampuses.length} Campuses)
            </h3>
            <p className="text-[11px] text-slate-300">
              Monitors all critical actions taken by Campus Admins across every client organization (High-Value Vouchers, Petty Cash Spikes, Login Sessions, Bulk Exports & Policy Violations) with 1-click Campus Login Lock.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={simulateIncomingNetworkEvent}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Simulate Live Campus Admin Action</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLiveStreaming((v) => !v)}
            className={`px-3 py-1.5 rounded-xl font-black flex items-center gap-1.5 cursor-pointer border ${
              isLiveStreaming
                ? 'bg-slate-800 border-slate-700 text-amber-300'
                : 'bg-emerald-600 border-emerald-500 text-white'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Stream</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportStreamCsv}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="lg:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">
            Search Campus Admin, Login ID, IP or Action
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. LOGIN-CVT-MAIN, BPV, 119.160.98.14, Kamran..."
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold bg-white"
          />
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Client Organization
          </label>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All Clients ({institutes.length})</option>
            {institutes.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.code} — {inst.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Campus Login Node
          </label>
          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All Campuses ({tenantCampuses.length})</option>
            {tenantCampuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.campusLoginId} ({c.name})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Severity Level
          </label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="INFO">INFO</option>
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Category Filter
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All Categories</option>
            <option value="HIGH_VALUE_VOUCHER">High-Value Vouchers</option>
            <option value="PETTY_CASH">Petty Cash Usage</option>
            <option value="AUTH_SECURITY">Campus Auth & Sessions</option>
            <option value="DATA_EXPORT">Bulk PDF & Data Exports</option>
            <option value="POLICY_VIOLATION">Policy Violations</option>
          </select>
        </div>
      </div>

      {/* Stream Table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-xl">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 font-black uppercase text-slate-700 sticky top-0">
              <th className="border-b border-slate-200 p-2 text-left">Timestamp & Hash</th>
              <th className="border-b border-slate-200 p-2 text-left">Client & Campus Login ID</th>
              <th className="border-b border-slate-200 p-2 text-left">Campus Admin & IP</th>
              <th className="border-b border-slate-200 p-2 text-center">Severity</th>
              <th className="border-b border-slate-200 p-2 text-left">Critical Action & Financial Impact</th>
              <th className="border-b border-slate-200 p-2 text-center">Site Owner Security Control</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((evt) => {
              const campusNode = tenantCampuses.find(
                (c) => c.id === evt.campusId
              );
              const isLoginEnabled = campusNode?.campusLoginEnabled !== false;
              return (
                <tr
                  key={evt.id}
                  className={`border-b border-slate-200 ${
                    evt.severity === 'CRITICAL'
                      ? 'bg-rose-50/70'
                      : evt.severity === 'HIGH'
                      ? 'bg-amber-50/50'
                      : ''
                  }`}
                >
                  <td className="p-2 font-mono whitespace-nowrap">
                    <div className="font-bold text-slate-900">
                      {evt.timestampDisplay}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {evt.eventHash}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-black text-[10px]">
                        {evt.organizationCode}
                      </span>
                      <span className="font-mono font-black text-indigo-900">
                        {evt.campusLoginId}
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 mt-0.5">
                      {evt.campusName}
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="font-bold text-slate-900">
                      {evt.actorName}{' '}
                      <span className="text-[10px] font-mono text-slate-500">
                        ({evt.actorRole})
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      IP: {evt.ipAddress} · {evt.cityLocation}
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : evt.severity === 'HIGH'
                          ? 'bg-amber-500 text-slate-950'
                          : evt.severity === 'MEDIUM'
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {evt.severity}
                    </span>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                      {evt.category}
                    </div>
                  </td>
                  <td className="p-2 max-w-md">
                    <div className="font-mono font-black text-slate-900">
                      {evt.actionCode}
                      {typeof evt.amountPKR === 'number' && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 font-mono font-black text-[10px]">
                          PKR {evt.amountPKR.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">
                      {evt.summary}
                    </div>
                  </td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleReviewed(evt.id)}
                        className={`px-2 py-1 rounded font-bold text-[10px] cursor-pointer ${
                          evt.reviewedBySiteOwner
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                        }`}
                      >
                        {evt.reviewedBySiteOwner ? '✓ Reviewed' : 'Mark Reviewed'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFlagged(evt.id)}
                        className={`px-2 py-1 rounded font-bold text-[10px] cursor-pointer ${
                          evt.flaggedForAudit
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-100 border border-slate-300 text-slate-700'
                        }`}
                      >
                        {evt.flaggedForAudit ? '⚑ Flagged' : 'Flag'}
                      </button>
                      {onToggleCampusLoginLock && campusNode && (
                        <button
                          type="button"
                          onClick={() => onToggleCampusLoginLock(campusNode.id)}
                          className={`px-2 py-1 rounded font-black text-[10px] cursor-pointer ${
                            isLoginEnabled
                              ? 'bg-rose-600 hover:bg-rose-700 text-white'
                              : 'bg-slate-900 text-emerald-300'
                          }`}
                        >
                          {isLoginEnabled
                            ? 'Lock Campus Login'
                            : 'Unlock Campus'}
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
    </div>
  );
};
