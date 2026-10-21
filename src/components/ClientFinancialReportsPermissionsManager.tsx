import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Sliders,
  Sparkles,
  Download,
  Printer,
  FileText,
  Search,
  RefreshCw,
  Copy,
  ChevronRight,
  ShieldAlert,
  Award,
  BarChart3,
  Scale,
  Calendar,
  Layers,
  Check,
  Info,
  Server,
  Zap,
} from 'lucide-react';
import {
  PLATFORM_FINANCIAL_REPORTS_CATALOG,
  ClientReportPermission,
  getStoredClientReportPermissions,
  saveStoredClientReportPermissions,
  syncClientReportPermissionsToCloud,
  generateDefaultClientReportPermissions,
  validateClientReportAccess,
  PermissionLevel,
} from '../services/tenantIsolationService';
import {
  SchoolClientOrganization,
  getStoredSchoolClients,
} from '../services/platformSiteAdminService';
import { useAccounting } from '../core/aplusEngine';

interface Props {
  triggerToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export const ClientFinancialReportsPermissionsManager: React.FC<Props> = ({ triggerToast }) => {
  const { currentUser, campuses } = useAccounting();

  // Clients registry
  const [clients, setClients] = useState<SchoolClientOrganization[]>(() => getStoredSchoolClients());
  const [selectedClientId, setSelectedClientId] = useState<string>(() => clients[0]?.id || 'client-aplus');

  // Permissions state
  const [allPermissions, setAllPermissions] = useState<Record<string, ClientReportPermission[]>>(() =>
    getStoredClientReportPermissions()
  );

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Live Query / Isolation Tester State
  const [testUserRole, setTestUserRole] = useState<PermissionLevel>('level_4_sub_campus_admin');
  const [testCampusId, setTestCampusId] = useState<string>(campuses[0]?.id || 'campus-khiali');
  const [testReportKey, setTestReportKey] = useState<string>('format_2_executive_board');
  const [testConsolidated, setTestConsolidated] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    allowed: boolean;
    reason?: string;
    rewrittenQuery?: any;
    timestamp?: string;
  } | null>(null);

  // Saving state
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || clients[0],
    [clients, selectedClientId]
  );

  // Current client's report permissions list
  const currentClientPermissions = useMemo<ClientReportPermission[]>(() => {
    if (!selectedClientId) return [];
    if (allPermissions[selectedClientId]) {
      return allPermissions[selectedClientId];
    }
    const defaults = generateDefaultClientReportPermissions(selectedClientId);
    return defaults;
  }, [allPermissions, selectedClientId]);

  // Statistics for this client
  const stats = useMemo(() => {
    const total = PLATFORM_FINANCIAL_REPORTS_CATALOG.length;
    const enabled = currentClientPermissions.filter((p) => p.enabled).length;
    const sensitive = currentClientPermissions.filter(
      (p) => p.enabled && (p.sensitivityTier === 'executive_board' || p.sensitivityTier === 'confidential')
    ).length;
    const consolidated = currentClientPermissions.filter((p) => p.enabled && p.allowCrossCampusConsolidated).length;
    return { total, enabled, sensitive, consolidated };
  }, [currentClientPermissions]);

  // Filtered reports list
  const filteredPermissions = useMemo(() => {
    return currentClientPermissions.filter((p) => {
      const matchSearch =
        p.reportTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.reportKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && p.enabled) ||
        (statusFilter === 'disabled' && !p.enabled);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [currentClientPermissions, searchQuery, categoryFilter, statusFilter]);

  // Helper to persist updates
  const updateClientPermissions = (updatedList: ClientReportPermission[]) => {
    const updatedAll = {
      ...allPermissions,
      [selectedClientId]: updatedList,
    };
    setAllPermissions(updatedAll);
    saveStoredClientReportPermissions(updatedAll);
    syncClientReportPermissionsToCloud(updatedAll);
  };

  // Toggle report enabled / disabled
  const handleToggleReport = (reportKey: string) => {
    const updated = currentClientPermissions.map((p) => {
      if (p.reportKey === reportKey) {
        return {
          ...p,
          enabled: !p.enabled,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Site Admin',
        };
      }
      return p;
    });
    updateClientPermissions(updated);
    const target = currentClientPermissions.find((p) => p.reportKey === reportKey);
    triggerToast?.(
      'info',
      `${target?.reportTitle || reportKey} is now ${!target?.enabled ? 'ENABLED' : 'DISABLED'} for ${selectedClient?.name}.`
    );
  };

  // Change minimum role level
  const handleChangeRole = (reportKey: string, role: PermissionLevel) => {
    const updated = currentClientPermissions.map((p) => {
      if (p.reportKey === reportKey) {
        return {
          ...p,
          minimumRole: role,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Site Admin',
        };
      }
      return p;
    });
    updateClientPermissions(updated);
    triggerToast?.('success', `Updated minimum access role for ${reportKey} to ${role}.`);
  };

  // Toggle consolidated cross-campus
  const handleToggleConsolidated = (reportKey: string) => {
    const updated = currentClientPermissions.map((p) => {
      if (p.reportKey === reportKey) {
        return {
          ...p,
          allowCrossCampusConsolidated: !p.allowCrossCampusConsolidated,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Site Admin',
        };
      }
      return p;
    });
    updateClientPermissions(updated);
  };

  // Toggle export format
  const handleToggleExportFormat = (reportKey: string, format: 'pdf' | 'excel' | 'print') => {
    const updated = currentClientPermissions.map((p) => {
      if (p.reportKey === reportKey) {
        const currentFormats = p.allowedExportFormats || [];
        const hasFormat = currentFormats.includes(format);
        const nextFormats = hasFormat
          ? currentFormats.filter((f) => f !== format)
          : [...currentFormats, format];
        return {
          ...p,
          allowedExportFormats: nextFormats,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Site Admin',
        };
      }
      return p;
    });
    updateClientPermissions(updated);
  };

  // Apply Presets
  const handleApplyPreset = (preset: 'all_access' | 'standard' | 'subcampus_restricted' | 'auditor_only') => {
    const updated = currentClientPermissions.map((p) => {
      if (preset === 'all_access') {
        return {
          ...p,
          enabled: true,
          allowCrossCampusConsolidated: true,
          allowedExportFormats: ['pdf', 'excel', 'print'] as ('pdf' | 'excel' | 'print')[],
        };
      }
      if (preset === 'standard') {
        return {
          ...p,
          enabled: p.sensitivityTier !== 'executive_board',
          allowCrossCampusConsolidated: p.category !== 'Petty Cash & Imprest',
          minimumRole: p.minimumRole === 'level_1_platform_super_admin' ? 'level_2_client_super_admin' : p.minimumRole,
        };
      }
      if (preset === 'subcampus_restricted') {
        const isBranchDoc = p.category === 'Ledgers & Daybooks' || p.category === 'Petty Cash & Imprest';
        return {
          ...p,
          enabled: isBranchDoc,
          allowCrossCampusConsolidated: false,
        };
      }
      if (preset === 'auditor_only') {
        return {
          ...p,
          enabled: true,
          allowCrossCampusConsolidated: true,
          minimumRole: 'level_2_client_super_admin' as PermissionLevel,
          allowedExportFormats: ['pdf', 'print'] as ('pdf' | 'excel' | 'print')[],
        };
      }
      return p;
    });

    updateClientPermissions(updated);
    triggerToast?.('success', `Applied preset '${preset}' to client '${selectedClient?.name}'!`);
  };

  // Live Query / Authorization Tester
  const handleRunIsolationTest = () => {
    const simulatedContext = {
      clientId: selectedClientId,
      userId: 'test-user-simulation',
      userName: `Simulated User (${testUserRole})`,
      userRole: testUserRole,
      permissionLevel: testUserRole,
      campusId: testCampusId,
      isPlatformAdmin: testUserRole === 'level_1_platform_super_admin',
      isClientAdmin: testUserRole === 'level_2_client_super_admin',
    };

    const result = validateClientReportAccess(
      simulatedContext,
      testReportKey,
      testCampusId,
      testConsolidated,
      allPermissions
    );

    // Mock query rewrite
    const rewritten = {
      enforced_client_id: selectedClientId,
      enforced_campus_filter: testConsolidated ? 'ALL_AUTHORIZED_BRANCHES' : testCampusId,
      user_permission_level: testUserRole,
      report_policy_active: result.permission?.enabled ?? false,
      minimum_role_required: result.permission?.minimumRole ?? 'N/A',
      allow_consolidated: result.permission?.allowCrossCampusConsolidated ?? false,
      timestamp: new Date().toISOString(),
    };

    setTestResult({
      tested: true,
      allowed: result.allowed,
      reason: result.reason,
      rewrittenQuery: rewritten,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  const categories = [
    'all',
    'Financial Statements',
    'Ledgers & Daybooks',
    'Executive & Board',
    'Petty Cash & Imprest',
    'Audits & Controls',
  ];

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/80 p-5 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono">
              Backend Tenant Isolation & Access Governance
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
              Live Cloud Synced
            </span>
          </div>
          <h3 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            <span>Financial Reports & Client Visibility Permissions Hub</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage which of the 15 financial reports are accessible to each school client organization,
            enforce role-based access tiers, and restrict cross-campus consolidated disclosures.
          </p>
        </div>

        {/* Client Organization Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Managing Client:</span>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="bg-slate-900 border border-indigo-700/80 text-white font-bold text-xs rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:border-indigo-500 shadow-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code} • {c.tier})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Client Summary Card & KPI Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Reports Granted</div>
            <div className="text-2xl font-black text-white mt-1">
              {stats.enabled} <span className="text-xs font-normal text-slate-500">/ {stats.total}</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
              {Math.round((stats.enabled / stats.total) * 100)}% Catalog Access
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Executive / Sensitive</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{stats.sensitive}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Board & Trustee Gated</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Cross-Campus Consolidated</div>
            <div className="text-2xl font-black text-indigo-400 mt-1">{stats.consolidated}</div>
            <div className="text-[10px] text-indigo-300/80 font-mono mt-0.5">Network Totals Permitted</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase">Client Plan Tier</div>
            <div className="text-base font-black text-white mt-1">{selectedClient?.tier || 'Enterprise'}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Code: <span className="font-bold text-white">{selectedClient?.code}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Preset Action Bar & Search / Category Filters */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-white">One-Click Client Report Presets:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('all_access')}
              className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
              title="Grant full access to all 15 reports for this client"
            >
              Enterprise (All 15 Reports)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('standard')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] transition-colors cursor-pointer border border-slate-700"
              title="Enable standard operational ledgers & financial statements"
            >
              Standard Operations
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('subcampus_restricted')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] transition-colors cursor-pointer border border-slate-700"
              title="Restrict client strictly to sub-campus daybooks & petty cash"
            >
              Sub-Campus Branch Restricted
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('auditor_only')}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] transition-colors cursor-pointer border border-slate-700"
              title="External auditor profile: Level 2 Client Super Admin only"
            >
              Auditor & Trustee Suite
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports by title or code..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="enabled">Active / Granted Only</option>
              <option value="disabled">Blocked / Revoked Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Permissions Matrix Table */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70 shadow-xl">
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-white">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
            <span>
              Report Visibility & Capability Matrix for <strong className="text-indigo-300">{selectedClient?.name}</strong>
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Showing {filteredPermissions.length} of {currentClientPermissions.length} Reports
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Financial Report</th>
                <th className="py-3 px-3 text-center">Client Access</th>
                <th className="py-3 px-3 text-center">Minimum Role Level</th>
                <th className="py-3 px-3 text-center">Cross-Campus Consolidated</th>
                <th className="py-3 px-3 text-center">Sensitivity Tier</th>
                <th className="py-3 px-4 text-center">Allowed Export Formats</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-[11px]">
              {filteredPermissions.map((perm) => {
                const isEnabled = perm.enabled;
                return (
                  <tr
                    key={perm.reportKey}
                    className={`transition-colors ${
                      isEnabled ? 'hover:bg-slate-900/50' : 'bg-slate-950/90 text-slate-500 hover:bg-slate-950'
                    }`}
                  >
                    {/* Report Title & Metadata */}
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isEnabled
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className={`font-bold ${isEnabled ? 'text-white' : 'text-slate-400 line-through'}`}>
                            {perm.reportTitle}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>Key: {perm.reportKey}</span>
                            <span>•</span>
                            <span className="text-indigo-400/90">{perm.category}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Client Access Toggle Switch */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleReport(perm.reportKey)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-[10px] transition-all cursor-pointer ${
                          isEnabled
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-sm'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                        title={`Click to ${isEnabled ? 'revoke' : 'grant'} report access for ${selectedClient?.name}`}
                      >
                        {isEnabled ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Granted</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-rose-400" />
                            <span>Blocked</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Minimum Required Role Selector */}
                    <td className="py-3 px-3 text-center">
                      <select
                        value={perm.minimumRole}
                        disabled={!isEnabled}
                        onChange={(e) => handleChangeRole(perm.reportKey, e.target.value as PermissionLevel)}
                        className={`bg-slate-900 border rounded-xl px-2 py-1 text-[11px] font-mono outline-none cursor-pointer ${
                          isEnabled
                            ? 'border-slate-700 text-white focus:border-indigo-500'
                            : 'border-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <option value="level_1_platform_super_admin">Level 1 — Platform Super Admin Only</option>
                        <option value="level_2_client_super_admin">Level 2 — Client Super Admin</option>
                        <option value="level_3_main_campus_admin">Level 3 — Main Campus Admin</option>
                        <option value="level_4_sub_campus_admin">Level 4 — Sub-Campus Admin</option>
                        <option value="level_5_departmental_staff">Level 5 — All Departmental Staff</option>
                      </select>
                    </td>

                    {/* Consolidated Cross-Campus Toggle */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        disabled={!isEnabled}
                        onClick={() => handleToggleConsolidated(perm.reportKey)}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-colors cursor-pointer border ${
                          !isEnabled
                            ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                            : perm.allowCrossCampusConsolidated
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-700 hover:bg-indigo-900'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Allow users to consolidate data across all campuses"
                      >
                        {perm.allowCrossCampusConsolidated ? 'Consolidated: YES' : 'Single-Campus Only'}
                      </button>
                    </td>

                    {/* Sensitivity Tier */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          perm.sensitivityTier === 'executive_board'
                            ? 'bg-purple-950 text-purple-300 border-purple-800'
                            : perm.sensitivityTier === 'confidential'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {perm.sensitivityTier}
                      </span>
                    </td>

                    {/* Allowed Export Formats */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {(['pdf', 'excel', 'print'] as const).map((fmt) => {
                          const active = (perm.allowedExportFormats || []).includes(fmt);
                          return (
                            <button
                              key={fmt}
                              type="button"
                              disabled={!isEnabled}
                              onClick={() => handleToggleExportFormat(perm.reportKey, fmt)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-colors cursor-pointer border ${
                                !isEnabled
                                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                  : active
                                  ? 'bg-blue-950 text-blue-300 border-blue-700'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                              title={`Toggle ${fmt.toUpperCase()} export`}
                            >
                              {fmt}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Quick Toggle Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleReport(perm.reportKey)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-colors cursor-pointer border border-slate-700"
                      >
                        {isEnabled ? 'Revoke Access' : 'Grant Access'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live "Tenant Isolation & Report Permission Tester" Sandbox */}
      <div className="bg-slate-950/80 border border-indigo-900/60 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-white flex items-center gap-2">
                <span>Tenant Isolation & Report Authorization Simulator</span>
                <span className="text-[10px] font-mono bg-indigo-900/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">
                  Live Test Sandbox
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Simulate a real backend query under any client, role, and campus context to verify automatic client_id filter injection and report security gates.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRunIsolationTest}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Simulate Backend Query</span>
          </button>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-bold">Simulated User Role</label>
            <select
              value={testUserRole}
              onChange={(e: any) => setTestUserRole(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
            >
              <option value="level_1_platform_super_admin">Level 1 — Platform Super Admin</option>
              <option value="level_2_client_super_admin">Level 2 — Client Super Admin</option>
              <option value="level_3_main_campus_admin">Level 3 — Main Campus Admin</option>
              <option value="level_4_sub_campus_admin">Level 4 — Sub-Campus Admin</option>
              <option value="level_5_departmental_staff">Level 5 — Departmental Staff</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Target Campus</label>
            <select
              value={testCampusId}
              onChange={(e) => setTestCampusId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
            >
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Target Financial Report</label>
            <select
              value={testReportKey}
              onChange={(e) => setTestReportKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
            >
              {PLATFORM_FINANCIAL_REPORTS_CATALOG.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.shortTitle}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-bold">Cross-Campus Scope</label>
            <button
              type="button"
              onClick={() => setTestConsolidated(!testConsolidated)}
              className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                testConsolidated
                  ? 'bg-purple-950 text-purple-300 border-purple-700'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{testConsolidated ? 'Consolidated All Campuses' : 'Single Branch'}</span>
            </button>
          </div>
        </div>

        {/* Test Result Display */}
        {testResult?.tested && (
          <div
            className={`p-4 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-200 ${
              testResult.allowed
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2">
                {testResult.allowed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
                <span>
                  Result:{' '}
                  <strong className={testResult.allowed ? 'text-emerald-300' : 'text-rose-300'}>
                    {testResult.allowed ? '200 OK — ACCESS GRANTED' : '403 FORBIDDEN — ACCESS REJECTED'}
                  </strong>
                </span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Tested at {testResult.timestamp}</span>
            </div>

            {!testResult.allowed && testResult.reason && (
              <div className="p-2.5 rounded-xl bg-rose-900/40 border border-rose-800/80 text-rose-200 text-[11px] font-mono">
                {testResult.reason}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300">
              <div className="font-bold text-slate-400 mb-1">
                Backend Tenant Isolation Query Rewriter:
              </div>
              <pre className="bg-slate-950 p-2.5 rounded-xl overflow-x-auto text-emerald-400">
                {JSON.stringify(testResult.rewrittenQuery, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
