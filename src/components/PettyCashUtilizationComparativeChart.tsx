import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { Campus, PettyCashTransaction } from '../core/aplusEngine';

export interface PettyCashUtilizationComparativeChartProps {
  campuses: Campus[];
  pettyCashTransactions: PettyCashTransaction[];
  onReplenishClick?: (campusId: string) => void;
  onNavigate?: (tab: string) => void;
}

export interface CampusUtilizationMetric {
  id: string;
  code: string;
  name: string;
  city?: string;
  accountantName?: string;
  allocatedFloat: number;
  totalDisbursed: number;
  totalReplenished: number;
  currentCashInHand: number;
  utilizationRate: number; // percentage (0 - 100+)
  effectiveAvailable: number;
  slipCount: number;
  status: 'healthy' | 'warning' | 'critical';
  projectedRunwayDays: number;
}

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const PettyCashUtilizationComparativeChart: React.FC<
  PettyCashUtilizationComparativeChartProps
> = ({ campuses = [], pettyCashTransactions = [], onReplenishClick, onNavigate }) => {
  const [viewMode, setViewMode] = useState<'side_by_side_pkr' | 'utilization_percent'>(
    'side_by_side_pkr'
  );
  const [sortBy, setSortBy] = useState<
    'utilization_desc' | 'utilization_asc' | 'float_desc' | 'spent_desc' | 'name'
  >('utilization_desc');
  const [filterThreshold, setFilterThreshold] = useState<'all' | 'critical' | 'warning' | 'healthy'>('all');
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);

  // Calculate detailed comparative metrics for all campuses
  const metrics = useMemo<CampusUtilizationMetric[]>(() => {
    return campuses.map((campus) => {
      const campusTx = pettyCashTransactions.filter((tx) => tx.campusId === campus.id);

      const totalDisbursed = campusTx
        .filter((tx) => tx.type === 'Disbursement')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const totalReplenished = campusTx
        .filter((tx) => tx.type === 'Replenishment')
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const allocatedFloat = Number(campus.pettyCashFloat) || 0;
      const currentCashInHand = Number(campus.currentPettyCash) || 0;

      // Utilization rate relative to allocated imprest float
      const utilizationRate =
        allocatedFloat > 0
          ? Math.round((totalDisbursed / allocatedFloat) * 1000) / 10
          : 0;

      const effectiveAvailable = Math.max(0, allocatedFloat - totalDisbursed);

      // Estimate spending velocity (average daily burn assuming 30-day operating month)
      const dailyBurn = totalDisbursed / 30;
      const projectedRunwayDays =
        dailyBurn > 0 ? Math.max(1, Math.round(currentCashInHand / dailyBurn)) : 30;

      let status: CampusUtilizationMetric['status'] = 'healthy';
      if (utilizationRate >= 90 || currentCashInHand <= allocatedFloat * 0.15) {
        status = 'critical';
      } else if (utilizationRate >= 70 || currentCashInHand <= allocatedFloat * 0.3) {
        status = 'warning';
      }

      return {
        id: campus.id,
        code: campus.code,
        name: campus.name,
        city: campus.city,
        accountantName: campus.accountantName,
        allocatedFloat,
        totalDisbursed,
        totalReplenished,
        currentCashInHand,
        utilizationRate,
        effectiveAvailable,
        slipCount: campusTx.length,
        status,
        projectedRunwayDays,
      };
    });
  }, [campuses, pettyCashTransactions]);

  // Aggregate network KPIs
  const networkSummary = useMemo(() => {
    const totalAllocated = metrics.reduce((sum, m) => sum + m.allocatedFloat, 0);
    const totalDisbursed = metrics.reduce((sum, m) => sum + m.totalDisbursed, 0);
    const totalInHand = metrics.reduce((sum, m) => sum + m.currentCashInHand, 0);
    const avgUtilization =
      totalAllocated > 0 ? Math.round((totalDisbursed / totalAllocated) * 1000) / 10 : 0;
    const criticalCampuses = metrics.filter((m) => m.status === 'critical');
    const warningCampuses = metrics.filter((m) => m.status === 'warning');

    // Find campus with highest utilization
    const highestUtilized = [...metrics].sort((a, b) => b.utilizationRate - a.utilizationRate)[0];

    return {
      totalAllocated,
      totalDisbursed,
      totalInHand,
      avgUtilization,
      criticalCount: criticalCampuses.length,
      warningCount: warningCampuses.length,
      highestUtilized,
    };
  }, [metrics]);

  // Filtered and sorted data for chart & table
  const chartData = useMemo(() => {
    let list = [...metrics];

    if (filterThreshold !== 'all') {
      list = list.filter((m) => m.status === filterThreshold);
    }

    list.sort((a, b) => {
      if (sortBy === 'utilization_desc') return b.utilizationRate - a.utilizationRate;
      if (sortBy === 'utilization_asc') return a.utilizationRate - b.utilizationRate;
      if (sortBy === 'float_desc') return b.allocatedFloat - a.allocatedFloat;
      if (sortBy === 'spent_desc') return b.totalDisbursed - a.totalDisbursed;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [metrics, filterThreshold, sortBy]);

  const selectedCampusMetric = useMemo(() => {
    if (!selectedCampusId) return null;
    return metrics.find((m) => m.id === selectedCampusId) || null;
  }, [metrics, selectedCampusId]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                <span>Multi-Campus Imprest Analytics</span>
                <span aria-hidden="true">·</span>
                <span>Side-by-Side Comparison</span>
              </div>
              <h3 className="text-base font-black tracking-tight text-white">
                Petty Cash Utilization & Imprest Absorption Rates Across All Campuses
              </h3>
            </div>
          </div>

          {/* View Mode & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800 p-0.5 rounded-xl border border-slate-700 flex items-center text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('side_by_side_pkr')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'side_by_side_pkr'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Side-by-Side Amounts (PKR)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('utilization_percent')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'utilization_percent'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Utilization Rate (%)
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('pettycash')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Petty Cash Module</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5 bg-slate-50/50">
        {/* KPI Metric Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">
              Total Network Float Limit
            </span>
            <div className="text-base font-black text-slate-900 mt-1 font-mono">
              {formatPKR(networkSummary.totalAllocated)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Combined imprest cap across {campuses.length} campuses
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-600 uppercase block">
              Total Spent / Disbursed
            </span>
            <div className="text-base font-black text-amber-700 mt-1 font-mono">
              {formatPKR(networkSummary.totalDisbursed)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Total petty disbursements to date
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-600 uppercase block">
              Liquid Cash in Hand
            </span>
            <div className="text-base font-black text-emerald-700 mt-1 font-mono">
              {formatPKR(networkSummary.totalInHand)}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Safe cash balances certified across branches
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
            <span className="text-[11px] font-bold text-indigo-600 uppercase block">
              Average Network Absorption
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-base font-black text-indigo-900 font-mono">
                {networkSummary.avgUtilization}%
              </span>
              {networkSummary.criticalCount > 0 ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                  {networkSummary.criticalCount} Critical
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Stable
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
              Peak: {networkSummary.highestUtilized?.name || 'N/A'} (
              {networkSummary.highestUtilized?.utilizationRate || 0}%)
            </span>
          </div>
        </div>

        {/* Filter and Sorting Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter Status:</span>
            </span>
            <button
              type="button"
              onClick={() => setFilterThreshold('all')}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                filterThreshold === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All ({metrics.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterThreshold('critical')}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                filterThreshold === 'critical'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Critical / Alert (&ge;90%)
            </button>
            <button
              type="button"
              onClick={() => setFilterThreshold('warning')}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                filterThreshold === 'warning'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Warning (70-89%)
            </button>
            <button
              type="button"
              onClick={() => setFilterThreshold('healthy')}
              className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-colors ${
                filterThreshold === 'healthy'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Safe (&lt;70%)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-slate-800 bg-white"
            >
              <option value="utilization_desc">Highest Utilization % (Descending)</option>
              <option value="utilization_asc">Lowest Utilization % (Ascending)</option>
              <option value="float_desc">Highest Float Budget (PKR)</option>
              <option value="spent_desc">Highest Total Spent (PKR)</option>
              <option value="name">Campus Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* SIDE-BY-SIDE BAR CHART VISUALIZATION */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Side-by-Side Campus Utilization Comparison</span>
                <span className="text-xs font-normal text-slate-500">
                  ({chartData.length} Campuses Rendered)
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                {viewMode === 'side_by_side_pkr'
                  ? 'Comparative side-by-side columns: Allocated Float Limit (Blue) vs Total Disbursed (Amber) vs Liquid Cash in Hand (Emerald)'
                  : 'Percentage Absorption Rate relative to 100% Imprest Float limit with 70% Warning and 90% Critical Threshold lines'}
              </p>
            </div>

            {/* Visual Legend */}
            {viewMode === 'side_by_side_pkr' ? (
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                  <span className="text-slate-700">Allocated Float (PKR)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                  <span className="text-slate-700">Total Disbursed (PKR)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  <span className="text-slate-700">Safe Cash in Hand (PKR)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[11px] font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  <span className="text-slate-700">Safe (&lt;70%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                  <span className="text-slate-700">Warning (70-89%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                  <span className="text-slate-700">Critical (&ge;90%)</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {viewMode === 'side_by_side_pkr' ? (
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      setSelectedCampusId(e.activePayload[0].payload.id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="code"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    tickFormatter={(val) => `Rs. ${(val / 1000).toFixed(0)}k`}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as CampusUtilizationMetric;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
                          <div className="font-bold border-b border-slate-800 pb-1 flex justify-between">
                            <span>{data.name}</span>
                            <span className="font-mono text-amber-400">({data.code})</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Allocated Float:</span>
                            <span className="font-mono font-bold text-blue-400">
                              {formatPKR(data.allocatedFloat)}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Total Disbursed:</span>
                            <span className="font-mono font-bold text-amber-400">
                              {formatPKR(data.totalDisbursed)}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Cash in Safe:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatPKR(data.currentCashInHand)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-slate-800 pt-1 font-bold">
                            <span>Utilization Rate:</span>
                            <span
                              className={`font-mono ${
                                data.status === 'critical'
                                  ? 'text-rose-400'
                                  : data.status === 'warning'
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {data.utilizationRate}%
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 italic">
                            Est. Runway: ~{data.projectedRunwayDays} days before exhaustion
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* SIDE-BY-SIDE BARS */}
                  <Bar
                    dataKey="allocatedFloat"
                    name="Allocated Float"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                  <Bar
                    dataKey="totalDisbursed"
                    name="Total Disbursed"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                  <Bar
                    dataKey="currentCashInHand"
                    name="Safe Cash in Hand"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      setSelectedCampusId(e.activePayload[0].payload.id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="code"
                    tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    tickFormatter={(val) => `${val}%`}
                    domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload as CampusUtilizationMetric;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
                          <div className="font-bold border-b border-slate-800 pb-1 flex justify-between">
                            <span>{data.name}</span>
                            <span className="font-mono text-amber-400">({data.code})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Utilization Rate:</span>
                            <span className="font-mono font-bold text-amber-400">
                              {data.utilizationRate}%
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Spent / Float:</span>
                            <span className="font-mono">
                              {formatPKR(data.totalDisbursed)} / {formatPKR(data.allocatedFloat)}
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Cash in Hand:</span>
                            <span className="font-mono text-emerald-400">
                              {formatPKR(data.currentCashInHand)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 italic border-t border-slate-800 pt-1">
                            Status: {data.status.toUpperCase()} · ~{data.projectedRunwayDays} days runway
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={70}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: '70% Warning',
                      fill: '#d97706',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                  <ReferenceLine
                    y={90}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{
                      value: '90% Critical Limit',
                      fill: '#dc2626',
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                  <Bar
                    dataKey="utilizationRate"
                    name="Utilization %"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={55}
                  >
                    {chartData.map((entry) => {
                      let color = '#10b981'; // healthy
                      if (entry.utilizationRate >= 90) color = '#ef4444'; // critical
                      else if (entry.utilizationRate >= 70) color = '#f59e0b'; // warning
                      return <Cell key={`cell-${entry.id}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Selected Campus Detail Callout (if active) */}
        {selectedCampusMetric && (
          <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center font-bold">
                {selectedCampusMetric.code}
              </div>
              <div>
                <h5 className="font-black text-slate-900 text-sm">
                  {selectedCampusMetric.name} · Campus Imprest Focus
                </h5>
                <p className="text-slate-600 text-xs">
                  Accountant: {selectedCampusMetric.accountantName || 'Assigned Accountant'} · City:{' '}
                  {selectedCampusMetric.city || 'Gujranwala'} · {selectedCampusMetric.slipCount} Vouchers
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Absorption Rate
                </span>
                <span
                  className={`font-mono font-black text-sm ${
                    selectedCampusMetric.status === 'critical'
                      ? 'text-rose-700'
                      : selectedCampusMetric.status === 'warning'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {selectedCampusMetric.utilizationRate}%
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Safe Cash in Hand
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {formatPKR(selectedCampusMetric.currentCashInHand)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => onReplenishClick?.(selectedCampusMetric.id)}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replenish Imprest Float</span>
              </button>
            </div>
          </div>
        )}

        {/* COMPARATIVE RANKING TABLE */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
              Multi-Campus Imprest Ranking & Utilization Schedule
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Showing {chartData.length} Campuses
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="p-2.5 text-left w-16">Code</th>
                  <th className="p-2.5 text-left">Campus Branch</th>
                  <th className="p-2.5 text-right w-28">Allocated Float</th>
                  <th className="p-2.5 text-right w-28">Spent / Disbursed</th>
                  <th className="p-2.5 text-right w-28">Safe Cash in Hand</th>
                  <th className="p-2.5 text-right w-24">Utilization %</th>
                  <th className="p-2.5 text-center w-24">Status</th>
                  <th className="p-2.5 text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartData.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      selectedCampusId === row.id ? 'bg-amber-50/40' : ''
                    }`}
                    onClick={() => setSelectedCampusId(row.id)}
                  >
                    <td className="p-2.5 font-mono font-bold text-slate-900">{row.code}</td>
                    <td className="p-2.5 font-semibold text-slate-900">
                      <div>{row.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {row.accountantName} · {row.city || 'Punjab'}
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-700">
                      {formatPKR(row.allocatedFloat)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-700">
                      {formatPKR(row.totalDisbursed)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                      {formatPKR(row.currentCashInHand)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.status === 'critical'
                                ? 'bg-rose-500'
                                : row.status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, row.utilizationRate)}%` }}
                          />
                        </div>
                        <span>{row.utilizationRate}%</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.status === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : row.status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {row.status === 'critical'
                          ? 'Critical'
                          : row.status === 'warning'
                          ? 'Warning'
                          : 'Normal'}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReplenishClick?.(row.id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Replenish
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
