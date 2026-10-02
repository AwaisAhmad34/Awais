import React, { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  TrendingUp,
  Wallet,
  Activity,
  Building2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Eye,
} from 'lucide-react';
import {
  getStoredSiteOwnerGovernance,
  subscribeSiteOwnerGovernance,
  SiteOwnerGovernanceState,
} from './SiteOwnerGovernanceEngine';
import type {
  SchoolInstituteAccount,
  TenantCampusNode,
} from './MultiSchoolAdminPanel';

const HEATMAP_METRICS_STORAGE_KEY = 'aplus_campus_heatmap_metrics_v1';

export interface CampusHeatmapMetricRecord {
  campusId: string;
  monthlyBudgetAllocationPKR: number;
  monthlyActualExpenditurePKR: number;
  monthlyVoucherCount: number;
  monthlyTargetVoucherCount: number;
  cashAuditCompliancePct: number;
}

const DEFAULT_HEATMAP_METRICS: Record<string, CampusHeatmapMetricRecord> = {
  'tcamp-aplus-main-1': {
    campusId: 'tcamp-aplus-main-1',
    monthlyBudgetAllocationPKR: 1850000,
    monthlyActualExpenditurePKR: 1740000, // 94.1% utilization (High/Elevated)
    monthlyVoucherCount: 148,
    monthlyTargetVoucherCount: 120, // 123% frequency intensity
    cashAuditCompliancePct: 98,
  },
  'tcamp-aplus-sub-1': {
    campusId: 'tcamp-aplus-sub-1',
    monthlyBudgetAllocationPKR: 720000,
    monthlyActualExpenditurePKR: 518000, // 71.9% utilization (Optimal)
    monthlyVoucherCount: 74,
    monthlyTargetVoucherCount: 80, // 92.5% frequency
    cashAuditCompliancePct: 95,
  },
  'tcamp-apex-main-1': {
    campusId: 'tcamp-apex-main-1',
    monthlyBudgetAllocationPKR: 1400000,
    monthlyActualExpenditurePKR: 1386000, // 99.0% utilization (Critical)
    monthlyVoucherCount: 164,
    monthlyTargetVoucherCount: 110, // 149% frequency spike
    cashAuditCompliancePct: 88,
  },
  'tcamp-alhuda-main-1': {
    campusId: 'tcamp-alhuda-main-1',
    monthlyBudgetAllocationPKR: 950000,
    monthlyActualExpenditurePKR: 410000, // 43.2% utilization (Low/Conservative)
    monthlyVoucherCount: 38,
    monthlyTargetVoucherCount: 75, // 50.7% frequency
    cashAuditCompliancePct: 92,
  },
};

function getStoredHeatmapMetrics(): Record<string, CampusHeatmapMetricRecord> {
  try {
    const raw = localStorage.getItem(HEATMAP_METRICS_STORAGE_KEY);
    if (!raw) return DEFAULT_HEATMAP_METRICS;
    return { ...DEFAULT_HEATMAP_METRICS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HEATMAP_METRICS;
  }
}

function saveStoredHeatmapMetrics(
  next: Record<string, CampusHeatmapMetricRecord>
) {
  try {
    localStorage.setItem(HEATMAP_METRICS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

/**
 * Returns Tailwind classes and label for a 0..150+ intensity percentage
 */
function getHeatCellStyle(pct: number): {
  bgClass: string;
  barClass: string;
  badgeText: string;
  level: 'LOW' | 'OPTIMAL' | 'ELEVATED' | 'CRITICAL';
} {
  if (pct >= 95) {
    return {
      bgClass: 'bg-rose-600 text-white border-rose-700',
      barClass: 'bg-rose-300',
      badgeText: 'CRITICAL INTENSITY',
      level: 'CRITICAL',
    };
  }
  if (pct >= 80) {
    return {
      bgClass: 'bg-amber-500 text-slate-950 border-amber-600',
      barClass: 'bg-slate-900',
      badgeText: 'HIGH / ELEVATED',
      level: 'ELEVATED',
    };
  }
  if (pct >= 50) {
    return {
      bgClass: 'bg-emerald-600 text-white border-emerald-700',
      barClass: 'bg-emerald-200',
      badgeText: 'OPTIMAL RANGE',
      level: 'OPTIMAL',
    };
  }
  return {
    bgClass: 'bg-sky-600 text-white border-sky-700',
    barClass: 'bg-sky-200',
    badgeText: 'LOW / CONSERVATIVE',
    level: 'LOW',
  };
}

interface CampusPerformanceHeatmapProps {
  institutes: SchoolInstituteAccount[];
  tenantCampuses: TenantCampusNode[];
  onTriggerToast?: (msg: string) => void;
}

export const CampusPerformanceHeatmap: React.FC<
  CampusPerformanceHeatmapProps
> = ({ institutes, tenantCampuses, onTriggerToast }) => {
  const [govState, setGovState] = useState<SiteOwnerGovernanceState>(() =>
    getStoredSiteOwnerGovernance()
  );
  const [metricsMap, setMetricsMap] = useState<
    Record<string, CampusHeatmapMetricRecord>
  >(() => getStoredHeatmapMetrics());
  const [orgFilter, setOrgFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'composite' | 'budget' | 'petty_cash' | 'frequency'
  >('composite');
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSiteOwnerGovernance(setGovState);
  }, []);

  const enrichedRows = useMemo(() => {
    const rows = tenantCampuses
      .filter((c) => orgFilter === 'ALL' || c.organizationId === orgFilter)
      .map((camp) => {
        const org = institutes.find((i) => i.id === camp.organizationId);
        const hm = metricsMap[camp.id] || {
          campusId: camp.id,
          monthlyBudgetAllocationPKR: 850000,
          monthlyActualExpenditurePKR: 610000,
          monthlyVoucherCount: 68,
          monthlyTargetVoucherCount: 80,
          cashAuditCompliancePct: 94,
        };

        const pcMetric = govState.campusPettyCashMetrics.find(
          (m) => m.campusId === camp.id
        );
        const pcAvg = pcMetric?.historicalMonthlyAvgPKR || 60000;
        const pcCurrent = pcMetric?.currentMonthSpendPKR || 48000;

        const budgetUtilizationPct = Number(
          (
            (hm.monthlyActualExpenditurePKR /
              Math.max(1, hm.monthlyBudgetAllocationPKR)) *
            100
          ).toFixed(1)
        );

        // Petty cash intensity where 100% = at historical average, >100% = above average
        const pettyCashIntensityPct = Number(
          ((pcCurrent / Math.max(1, pcAvg)) * 75).toFixed(1)
        );
        const pettyCashVariancePct = Number(
          (((pcCurrent - pcAvg) / Math.max(1, pcAvg)) * 100).toFixed(1)
        );

        const txFrequencyIntensityPct = Number(
          (
            (hm.monthlyVoucherCount /
              Math.max(1, hm.monthlyTargetVoucherCount)) *
            75
          ).toFixed(1)
        );

        const compositeHeatScore = Number(
          (
            (budgetUtilizationPct +
              pettyCashIntensityPct +
              txFrequencyIntensityPct) /
            3
          ).toFixed(1)
        );

        return {
          campus: camp,
          orgCode: org?.code || 'ORG',
          orgName: org?.name || 'School Client',
          hm,
          pcAvg,
          pcCurrent,
          budgetUtilizationPct,
          pettyCashIntensityPct,
          pettyCashVariancePct,
          txFrequencyIntensityPct,
          compositeHeatScore,
        };
      });

    return rows.sort((a, b) => {
      if (sortBy === 'budget')
        return b.budgetUtilizationPct - a.budgetUtilizationPct;
      if (sortBy === 'petty_cash')
        return b.pettyCashIntensityPct - a.pettyCashIntensityPct;
      if (sortBy === 'frequency')
        return b.hm.monthlyVoucherCount - a.hm.monthlyVoucherCount;
      return b.compositeHeatScore - a.compositeHeatScore;
    });
  }, [tenantCampuses, institutes, metricsMap, govState, orgFilter, sortBy]);

  const selectedRow =
    enrichedRows.find((r) => r.campus.id === selectedCampusId) ||
    enrichedRows[0];

  const handleUpdateCampusMetric = (
    campusId: string,
    patch: Partial<CampusHeatmapMetricRecord>
  ) => {
    const existing = metricsMap[campusId] || {
      campusId,
      monthlyBudgetAllocationPKR: 850000,
      monthlyActualExpenditurePKR: 610000,
      monthlyVoucherCount: 68,
      monthlyTargetVoucherCount: 80,
      cashAuditCompliancePct: 94,
    };
    const next = {
      ...metricsMap,
      [campusId]: { ...existing, ...patch },
    };
    setMetricsMap(next);
    saveStoredHeatmapMetrics(next);
    if (onTriggerToast) {
      onTriggerToast('Updated campus heatmap performance benchmark.');
    }
  };

  return (
    <div
      className="bg-white rounded-2xl border-2 border-slate-900 p-5 space-y-4 text-xs shadow-2xs"
      data-site-admin-allowed="true"
    >
      {/* Header & Color-Coded Intensity Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Multi-Campus Comparative Visual Analytics
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-mono font-black text-[10px]">
                {enrichedRows.length} Campuses Compared
              </span>
            </div>
            <h3 className="font-black text-base text-slate-900 mt-0.5">
              Campus Performance Heatmap — Budget Utilization, Petty Cash Expenditure & Transaction Frequency
            </h3>
            <p className="text-[11px] text-slate-600">
              Color-coded intensity matrix comparing monthly budget utilization, petty cash expenditure vs. historical average, and voucher transaction frequency across all campuses. Click any campus row to inspect or adjust benchmarks.
            </p>
          </div>
        </div>

        {/* Intensity Scale Legend */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span className="font-black text-[10px] uppercase text-slate-600 mr-1">
            Intensity Scale:
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-black text-[10px]">
            &lt;50% Low
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10px]">
            50–79% Optimal
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px]">
            80–94% Elevated
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-[10px]">
            ≥95% Critical Hot
          </span>
        </div>
      </div>

      {/* Filter & Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black text-slate-700">Filter by Client:</span>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
          >
            <option value="ALL">All School Clients ({institutes.length})</option>
            {institutes.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.code} — {inst.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-black text-slate-700 mr-1">
            Sort Heatmap By:
          </span>
          {(
            [
              ['composite', 'Overall Heat Index'],
              ['budget', 'Budget Utilization (%)'],
              ['petty_cash', 'Petty Cash Expenditure'],
              ['frequency', 'Transaction Frequency'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSortBy(id)}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                sortBy === id
                  ? 'bg-slate-900 text-amber-300 font-black'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Color-Coded Intensity Heatmap Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-2 text-xs">
          <thead>
            <tr className="text-slate-700 font-black uppercase text-[11px]">
              <th className="p-2 text-left bg-slate-100 rounded-xl">
                Campus & Client Organization
              </th>
              <th className="p-2 text-center bg-slate-100 rounded-xl">
                1. Budget Utilization Intensity
              </th>
              <th className="p-2 text-center bg-slate-100 rounded-xl">
                2. Petty Cash Expenditure Intensity
              </th>
              <th className="p-2 text-center bg-slate-100 rounded-xl">
                3. Transaction Frequency (Vouchers/Mo)
              </th>
              <th className="p-2 text-center bg-slate-100 rounded-xl">
                Composite Heat Score
              </th>
            </tr>
          </thead>
          <tbody>
            {enrichedRows.map((row) => {
              const budgetHeat = getHeatCellStyle(row.budgetUtilizationPct);
              const pcHeat = getHeatCellStyle(row.pettyCashIntensityPct);
              const freqHeat = getHeatCellStyle(row.txFrequencyIntensityPct);
              const compHeat = getHeatCellStyle(row.compositeHeatScore);
              const isSelected = selectedRow?.campus.id === row.campus.id;

              return (
                <tr
                  key={row.campus.id}
                  onClick={() => setSelectedCampusId(row.campus.id)}
                  className={`cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-indigo-600 rounded-xl' : ''
                  }`}
                >
                  {/* Campus Identifier Column */}
                  <td className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-black text-[10px]">
                        {row.orgCode} · {row.campus.code}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {row.campus.campusLoginId}
                      </span>
                    </div>
                    <div className="font-black text-slate-900 text-xs mt-1">
                      {row.campus.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {row.orgName} · {row.campus.city}
                    </div>
                  </td>

                  {/* Cell 1: Budget Utilization Heatmap Cell */}
                  <td
                    className={`p-3 rounded-xl border ${budgetHeat.bgClass} transition-transform hover:scale-[1.01]`}
                  >
                    <div className="flex items-center justify-between font-mono font-black">
                      <span className="text-sm">
                        {row.budgetUtilizationPct}%
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20">
                        {budgetHeat.badgeText}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-95 mt-1 font-mono">
                      PKR {row.hm.monthlyActualExpenditurePKR.toLocaleString()}{' '}
                      / {row.hm.monthlyBudgetAllocationPKR.toLocaleString()}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/20 mt-1.5 overflow-hidden">
                      <div
                        className={`h-full ${budgetHeat.barClass}`}
                        style={{
                          width: `${Math.min(100, row.budgetUtilizationPct)}%`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Cell 2: Petty Cash Expenditure Heatmap Cell */}
                  <td
                    className={`p-3 rounded-xl border ${pcHeat.bgClass} transition-transform hover:scale-[1.01]`}
                  >
                    <div className="flex items-center justify-between font-mono font-black">
                      <span className="text-sm">
                        PKR {row.pcCurrent.toLocaleString()}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20">
                        {row.pettyCashVariancePct >= 0 ? '+' : ''}
                        {row.pettyCashVariancePct}% vs Avg
                      </span>
                    </div>
                    <div className="text-[10px] opacity-95 mt-1 font-mono">
                      3-Mo Historical Avg: PKR {row.pcAvg.toLocaleString()}
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/20 mt-1.5 overflow-hidden">
                      <div
                        className={`h-full ${pcHeat.barClass}`}
                        style={{
                          width: `${Math.min(100, row.pettyCashIntensityPct)}%`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Cell 3: Transaction Frequency Heatmap Cell */}
                  <td
                    className={`p-3 rounded-xl border ${freqHeat.bgClass} transition-transform hover:scale-[1.01]`}
                  >
                    <div className="flex items-center justify-between font-mono font-black">
                      <span className="text-sm">
                        {row.hm.monthlyVoucherCount} Vouchers/Mo
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20">
                        ~{(row.hm.monthlyVoucherCount / 26).toFixed(1)}/Day
                      </span>
                    </div>
                    <div className="text-[10px] opacity-95 mt-1 font-mono">
                      Benchmark Capacity: {row.hm.monthlyTargetVoucherCount}{' '}
                      Vouchers/Mo
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/20 mt-1.5 overflow-hidden">
                      <div
                        className={`h-full ${freqHeat.barClass}`}
                        style={{
                          width: `${Math.min(100, row.txFrequencyIntensityPct)}%`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Cell 4: Composite Heat Score */}
                  <td
                    className={`p-3 rounded-xl border text-center ${compHeat.bgClass}`}
                  >
                    <div className="text-base font-mono font-black">
                      {row.compositeHeatScore}%
                    </div>
                    <div className="text-[9px] font-black uppercase mt-0.5">
                      {compHeat.level} HEAT
                    </div>
                    <div className="text-[10px] opacity-90 mt-1">
                      Audit Score: {row.hm.cashAuditCompliancePct}%
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Campus Benchmark & Budget Calibrator for Selected Campus */}
      {selectedRow && (
        <div className="bg-slate-50 rounded-xl border border-slate-300 p-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase text-indigo-700">
              Selected Campus Heatmap Calibrator ({selectedRow.orgCode} ·{' '}
              {selectedRow.campus.code})
            </div>
            <div className="font-black text-slate-900 text-xs">
              Adjust Monthly Budget Allocation, Actual Spend & Voucher Frequency for{' '}
              {selectedRow.campus.name}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Monthly Budget Allocation (PKR)
              </label>
              <input
                type="number"
                value={selectedRow.hm.monthlyBudgetAllocationPKR}
                onChange={(e) =>
                  handleUpdateCampusMetric(selectedRow.campus.id, {
                    monthlyBudgetAllocationPKR: Math.max(
                      10000,
                      Number(e.target.value) || 0
                    ),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Actual Monthly Expenditure (PKR)
              </label>
              <input
                type="number"
                value={selectedRow.hm.monthlyActualExpenditurePKR}
                onChange={(e) =>
                  handleUpdateCampusMetric(selectedRow.campus.id, {
                    monthlyActualExpenditurePKR: Math.max(
                      0,
                      Number(e.target.value) || 0
                    ),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Monthly Transaction Count (Vouchers)
              </label>
              <input
                type="number"
                value={selectedRow.hm.monthlyVoucherCount}
                onChange={(e) =>
                  handleUpdateCampusMetric(selectedRow.campus.id, {
                    monthlyVoucherCount: Math.max(
                      0,
                      Number(e.target.value) || 0
                    ),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
