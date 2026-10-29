import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  Activity,
  Users,
  Building2,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Download,
  Sparkles,
  Zap,
  Globe,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  Laptop,
  Check,
  Trash2,
} from 'lucide-react';
import {
  CampusLoginActivity,
  CampusActivitySummary,
  RoleActivitySummary,
  getStoredCampusLoginActivities,
  calculateUserActivityStats,
  simulateRandomLoginActivity,
  clearCampusLoginActivities,
  formatRelativeTime,
  normalizeRoleCategory,
} from '../services/campusLoginActivityService';
import { Campus, AppUser } from '../core/aplusEngine';

export interface SystemUserActivityWidgetProps {
  campuses: Campus[];
  users: AppUser[];
  className?: string;
  onNavigateToCampus?: (campusId: string) => void;
}

export const SystemUserActivityWidget: React.FC<SystemUserActivityWidgetProps> = ({
  campuses,
  users,
  className = '',
  onNavigateToCampus,
}) => {
  // Activity state
  const [activities, setActivities] = useState<CampusLoginActivity[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'by_campus' | 'by_role' | 'trend' | 'live_stream'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load stored login activities
  const loadActivities = () => {
    const list = getStoredCampusLoginActivities();
    setActivities(list);
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter activities by search query
  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase().trim();
    return activities.filter(
      (a) =>
        a.userName?.toLowerCase().includes(q) ||
        a.campusName?.toLowerCase().includes(q) ||
        a.campusCode?.toLowerCase().includes(q) ||
        a.userRole?.toLowerCase().includes(q) ||
        a.ipAddress?.toLowerCase().includes(q) ||
        a.device?.toLowerCase().includes(q) ||
        a.userEmail?.toLowerCase().includes(q)
    );
  }, [activities, searchQuery]);

  // Aggregate stats using service
  const stats = useMemo(() => {
    return calculateUserActivityStats(
      filteredActivities,
      timeFilter,
      selectedCampusFilter,
      selectedRoleFilter
    );
  }, [filteredActivities, timeFilter, selectedCampusFilter, selectedRoleFilter]);

  // Handler: Simulate Live Login Event
  const handleSimulateLogin = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const newAct = simulateRandomLoginActivity(campuses, users);
      setActivities((prev) => [newAct, ...prev]);
      setIsSimulating(false);
      showToast(`Recorded live login for ${newAct.userName} at ${newAct.campusCode} (${newAct.status.toUpperCase()})`);
    }, 300);
  };

  // Handler: Export Activity Data as CSV
  const handleExportCsv = () => {
    try {
      const headers = ['Timestamp', 'User Name', 'Role', 'Email', 'Campus Code', 'Campus Name', 'Status', 'Method', 'IP Address', 'Device', 'Remarks'];
      const rows = stats.recentActivities.map((a) => [
        `"${a.timestamp}"`,
        `"${a.userName}"`,
        `"${a.userRole}"`,
        `"${a.userEmail || ''}"`,
        `"${a.campusCode}"`,
        `"${a.campusName}"`,
        `"${a.status}"`,
        `"${a.method}"`,
        `"${a.ipAddress}"`,
        `"${a.device}"`,
        `"${a.remarks || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `system_user_activity_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Downloaded activity audit report (CSV)');
    } catch {
      showToast('Could not export telemetry CSV');
    }
  };

  // Handler: Purge Activities
  const handleClearActivities = () => {
    if (window.confirm('Reset telemetry activity logs back to fresh system default?')) {
      clearCampusLoginActivities();
      loadActivities();
      showToast('Login telemetry reset to baseline state.');
    }
  };

  // Color palette for campus bars
  const CAMPUS_COLORS = [
    '#6366f1', // indigo
    '#a855f7', // purple
    '#10b981', // emerald
    '#0ea5e9', // sky
    '#f59e0b', // amber
    '#ec4899', // pink
    '#14b8a6', // teal
    '#8b5cf6', // violet
  ];

  // Role bar colors matching the 5-tier architecture
  const ROLE_COLORS: Record<string, string> = {
    level_1: '#6366f1', // Indigo (Platform Super Admin)
    level_2: '#a855f7', // Purple (Client Super Admin)
    level_3: '#10b981', // Emerald (Main Campus Admin)
    level_4: '#0ea5e9', // Sky (Sub-Campus Admin)
    level_5: '#14b8a6', // Teal (Staff & Accountant)
    auditor: '#f59e0b', // Amber (Auditor & Compliance)
  };

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-white ${className}`}>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-950 border border-indigo-600 text-indigo-100 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Widget Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  System-Wide User Activity & Login Telemetry
                </h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Stream Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detailed login frequency visualization across multi-tenant campuses and 5-tier governance roles.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSimulateLogin}
            disabled={isSimulating}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Simulate a real-time authenticated session entry to test live chart responsiveness"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-bounce' : 'text-amber-300'}`} />
            <span>Simulate Live Login</span>
          </button>

          <button
            type="button"
            onClick={loadActivities}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Reload Activity Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export CSV audit telemetry report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleClearActivities}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Reset telemetry baseline"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Total Logins</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.totalLogins}
          </div>
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">100%</span>
            <span>telemetry indexed</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Auth Success Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {stats.overallSuccessRate}%
          </div>
          <div className="text-[10px] text-slate-500">
            {stats.successfulLogins} ok / {stats.failedLogins} failed
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Active Campuses</span>
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.activeCampusesCount}
          </div>
          <div className="text-[10px] text-slate-500 truncate" title={stats.mostActiveCampus.name}>
            Top: {stats.mostActiveCampus.name.split(' ')[0]} ({stats.mostActiveCampus.count})
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Unique Users</span>
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {stats.uniqueActiveUsers}
          </div>
          <div className="text-[10px] text-slate-500 truncate" title={stats.mostActiveRole.name}>
            Top Role: {stats.mostActiveRole.name.split(':')[0]}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
            <span>Peak Activity</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-black text-amber-300 font-mono mt-1">
            {stats.peakOperatingHour.split(' ')[0]}
          </div>
          <div className="text-[10px] text-slate-500">
            High operational density
          </div>
        </div>
      </div>

      {/* Filter and View Bar */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Navigation Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('by_campus')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'by_campus'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Campus Frequency</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
              {stats.campusBreakdown.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('by_role')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'by_role'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Role Frequency</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
              {stats.roleBreakdown.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trend')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trend'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Hourly Trend</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live_stream')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'live_stream'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Live Audit Stream</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px]">
              {stats.recentActivities.length}
            </span>
          </button>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Filter */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {(['all', '24h', '7d', '30d'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeFilter(t)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  timeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All Time' : t === '24h' ? '24h' : t === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>

          {/* Campus Filter */}
          <select
            value={selectedCampusFilter}
            onChange={(e) => setSelectedCampusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="level_1">Level 1: Platform Super Admin</option>
            <option value="level_2">Level 2: Client Super Admin</option>
            <option value="level_3">Level 3: Main Campus Admin</option>
            <option value="level_4">Level 4: Sub-Campus Admin</option>
            <option value="level_5">Level 5: Departmental Staff</option>
            <option value="auditor">Auditor & Compliance</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user, campus, IP..."
              className="pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 w-44"
            />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 1: OVERVIEW & COMBINED VIEW                                  */}
      {/* -------------------------------------------------------------------- */}
      {(activeTab === 'overview' || activeTab === 'by_campus') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Login Frequency Across Campuses
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              Showing {stats.campusBreakdown.length} active campus branches
            </span>
          </div>

          {/* Recharts Bar Chart: Logins by Campus */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="h-64 w-full">
              {stats.campusBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                  No login activities found for the selected filter criteria.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.campusBreakdown}
                    margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="campusCode"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      axisLine={{ stroke: '#334155' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload as CampusActivitySummary;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{data.campusName}</span>
                              <span className="font-mono text-[10px] text-indigo-300 bg-indigo-950 px-1 rounded border border-indigo-800">
                                {data.campusCode}
                              </span>
                            </div>
                            <div className="text-slate-400 text-[11px]">{data.clientName}</div>
                            <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-4">
                              <span className="text-slate-400">Total Logins:</span>
                              <span className="font-mono font-bold text-white">{data.totalLogins} ({data.percentage}%)</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 text-emerald-400">
                              <span>Successful:</span>
                              <span className="font-mono font-bold">{data.successCount}</span>
                            </div>
                            {data.failedCount > 0 && (
                              <div className="flex items-center justify-between gap-4 text-rose-400">
                                <span>Failed Attempts:</span>
                                <span className="font-mono font-bold">{data.failedCount}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-4 text-slate-400 text-[10px]">
                              <span>Active Users:</span>
                              <span className="text-white">{data.uniqueUsers} accounts</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="totalLogins" radius={[6, 6, 0, 0]} name="Logins">
                      {stats.campusBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.campusId}`}
                          fill={CAMPUS_COLORS[index % CAMPUS_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Detailed Campus Breakdown Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Campus Branch</th>
                    <th className="p-3">Organization Client</th>
                    <th className="p-3">Login Frequency</th>
                    <th className="p-3">Share</th>
                    <th className="p-3">Success / Fail</th>
                    <th className="p-3">Most Active User</th>
                    <th className="p-3 text-right">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {stats.campusBreakdown.map((camp, idx) => (
                    <tr
                      key={camp.campusId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CAMPUS_COLORS[idx % CAMPUS_COLORS.length] }}
                          />
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{camp.campusName}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {camp.campusCode}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-300 text-[11px]">
                        {camp.clientName}
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-white text-sm">
                          {camp.totalLogins}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {camp.uniqueUsers} unique users
                        </div>
                      </td>
                      <td className="p-3 w-36">
                        <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                          <span className="text-indigo-300 font-bold">{camp.percentage}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, camp.percentage)}%`,
                              backgroundColor: CAMPUS_COLORS[idx % CAMPUS_COLORS.length],
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-mono font-bold">
                            ✓ {camp.successCount}
                          </span>
                          {camp.failedCount > 0 ? (
                            <span className="text-rose-400 font-mono font-bold">
                              ✗ {camp.failedCount}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">0 fails</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-slate-300 text-[11px]">
                        <span className="font-medium text-white">{camp.mostActiveUser}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {camp.lastLoginFormatted}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 2: ROLE FREQUENCY BREAKDOWN                                  */}
      {/* -------------------------------------------------------------------- */}
      {(activeTab === 'overview' || activeTab === 'by_role') && (
        <div className="space-y-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                2. Login Frequency Across Governance Roles (5-Tier Architecture)
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              Comparing access frequencies across administrative tiers
            </span>
          </div>

          {/* Role Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.roleBreakdown.map((role) => {
              const color = ROLE_COLORS[role.roleKey] || '#6366f1';
              return (
                <div
                  key={role.roleKey}
                  className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${role.colorClass}`}>
                        {role.levelBadge}
                      </span>
                      <h5 className="font-bold text-white text-xs mt-1.5">
                        {role.roleDisplayName}
                      </h5>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black font-mono text-white">
                        {role.totalLogins}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {role.percentage}% share
                      </div>
                    </div>
                  </div>

                  {/* Progress frequency bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, role.percentage)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>

                  {/* Micro stats */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      <span>Unique Accounts: </span>
                      <strong className="text-white font-mono">{role.uniqueUsers}</strong>
                    </div>
                    <div>
                      <span>Success Rate: </span>
                      <strong className="text-emerald-400 font-mono">{role.successRate}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recharts Bar Chart: Role Frequencies */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="text-xs font-bold text-slate-400 mb-2 uppercase">
              Role Login Volume Comparison
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.roleBreakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="levelBadge"
                    type="category"
                    tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload as RoleActivitySummary;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white">{d.roleDisplayName}</div>
                          <div className="text-slate-400 text-[11px]">
                            Logins: <strong className="text-white font-mono">{d.totalLogins}</strong> ({d.percentage}%)
                          </div>
                          <div className="text-emerald-400 text-[11px]">
                            Success Rate: <strong className="font-mono">{d.successRate}%</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="totalLogins" radius={[0, 6, 6, 0]}>
                    {stats.roleBreakdown.map((entry) => (
                      <Cell
                        key={`cell-role-${entry.roleKey}`}
                        fill={ROLE_COLORS[entry.roleKey] || '#6366f1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 3: HOURLY ACTIVITY TREND                                     */}
      {/* -------------------------------------------------------------------- */}
      {(activeTab === 'overview' || activeTab === 'trend') && (
        <div className="space-y-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                3. Hourly Activity Trend & Peak Operating Density
              </h4>
            </div>
            <span className="text-xs text-amber-300 font-mono">
              Peak: {stats.peakOperatingHour}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.hourlyTrend}
                  margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload as { label: string; logins: number; success: number; failed: number };
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white">Hour: {d.label}</div>
                          <div className="text-indigo-300">
                            Logins Recorded: <strong className="font-mono text-white">{d.logins}</strong>
                          </div>
                          <div className="text-emerald-400 text-[10px]">
                            Success: {d.success} &bull; Failed: {d.failed}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="logins" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* SECTION 4: REAL-TIME AUDIT STREAM                                    */}
      {/* -------------------------------------------------------------------- */}
      {(activeTab === 'overview' || activeTab === 'live_stream') && (
        <div className="space-y-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                4. Live Real-Time Authentication Stream
              </h4>
            </div>
            <span className="text-xs text-slate-400">
              Showing recent {Math.min(15, stats.recentActivities.length)} of {stats.recentActivities.length} events
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {stats.recentActivities.slice(0, 15).map((act) => {
              const roleMeta = normalizeRoleCategory(act.userRole);
              return (
                <div
                  key={act.id}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 flex flex-wrap items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                        act.status === 'success'
                          ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-400'
                          : 'bg-rose-950/80 border border-rose-800 text-rose-400'
                      }`}
                    >
                      {act.status === 'success' ? '✓' : '✗'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs truncate">
                          {act.userName}
                        </span>
                        <span className={`px-2 py-0.2 rounded-md text-[9px] font-bold border uppercase ${roleMeta.colorClass}`}>
                          {roleMeta.levelBadge}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
                          {act.campusCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-slate-300">{act.campusName}</span>
                        <span>&bull;</span>
                        <span className="font-mono text-slate-500">{act.ipAddress}</span>
                        <span>&bull;</span>
                        <span className="text-slate-500 truncate max-w-xs">{act.device}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-900 px-2 py-0.5 rounded-md uppercase">
                        {act.method.replace('_', ' ')}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {formatRelativeTime(act.epochMs)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
