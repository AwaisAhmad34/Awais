import React, { useMemo } from 'react';
import { Banknote, Building2, FileText, RotateCcw } from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import {
  computeCampusOverviewMetrics,
  formatPkrAmount,
} from '../utils/campusOverviewMetrics';

export {
  computeCampusCashLedgerBalance,
  computeCampusOverviewMetrics,
  formatPkrAmount,
  getLocalTodayIso,
  resolveCashInHandAccountHead,
  type CampusDashboardOverviewResult,
  type CampusOverviewMetric,
} from '../utils/campusOverviewMetrics';

export interface CampusDashboardOverviewProps {
  onNavigateToCampuses?: () => void;
}

export const CampusDashboardOverview: React.FC<CampusDashboardOverviewProps> = ({
  onNavigateToCampuses,
}) => {
  const {
    campuses,
    transactions,
    accountHeads,
    getAccountBalance,
    currentCampusId,
    setCurrentCampusId,
  } = useAccounting();

  const overview = useMemo(
    () =>
      computeCampusOverviewMetrics({
        campuses: campuses || [],
        transactions: transactions || [],
        accountHeads: accountHeads || [],
        getAccountBalance,
      }),
    [campuses, transactions, accountHeads, getAccountBalance]
  );

  const isScopedToCampus = Boolean(currentCampusId && currentCampusId !== 'all');
  const activeScopedItem = isScopedToCampus
    ? overview.items.find((item) => item.campusId === currentCampusId)
    : undefined;

  return (
    <section
      aria-labelledby="campus-dashboard-overview-heading"
      className="space-y-3"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <h4
              id="campus-dashboard-overview-heading"
              className="text-sm font-bold text-white tracking-tight"
            >
              Campus Dashboard Overview
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cash in Hand ledger + Petty Cash imprest float and vouchers dated{' '}
            <span className="font-mono tabular-nums text-slate-300">{overview.todayIso}</span>
            {' · '}
            {activeScopedItem
              ? `Scoped to ${activeScopedItem.campusName} (${activeScopedItem.campusCode})`
              : 'Click any campus card to scope workspace'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="text-slate-400">
            <span>Network Cash </span>
            <span className="font-mono tabular-nums font-bold text-emerald-400">
              {formatPkrAmount(overview.totalNetworkCashOnHand)}
            </span>
          </div>
          <span className="text-slate-700" aria-hidden="true">
            ·
          </span>
          <div className="text-slate-400">
            <span>Today&apos;s Vouchers </span>
            <span className="font-mono tabular-nums font-bold text-white">
              {overview.totalTodayVouchers}
            </span>
          </div>

          {isScopedToCampus && (
            <button
              type="button"
              onClick={() => setCurrentCampusId('all')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-indigo-500/60 hover:text-white text-slate-200 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>All Campuses (Consolidated)</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State or Campus Summary Card Grid */}
      {overview.items.length === 0 ? (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 text-center space-y-2.5">
          <p className="text-sm font-semibold text-slate-200">
            No school campuses configured yet
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Register a Main Campus or sub-campus branch to monitor combined Cash on Hand balances and daily voucher activity here.
          </p>
          {onNavigateToCampuses && (
            <button
              type="button"
              onClick={onNavigateToCampuses}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Open Campus Directory</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {overview.items.map((item) => {
            const isSelected = currentCampusId === item.campusId;

            return (
              <button
                key={item.campusId}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  setCurrentCampusId(isSelected ? 'all' : item.campusId)
                }
                className={`group text-left w-full rounded-xl p-4 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950/35 ring-1 ring-indigo-500/40'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                }`}
              >
                {/* Metadata Kicker Line */}
                <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-slate-400">
                  <span className="truncate font-semibold">
                    {item.campusCode}
                    {' · '}
                    {item.isMainCampus ? 'Main Campus' : 'Sub-Campus'}
                    {item.city ? ` · ${item.city}` : ''}
                  </span>
                  {isSelected ? (
                    <span className="shrink-0 font-bold text-indigo-400">
                      Scoped
                    </span>
                  ) : item.status === 'inactive' ? (
                    <span className="shrink-0 font-semibold text-amber-400">
                      Inactive
                    </span>
                  ) : null}
                </div>

                {/* Campus Title */}
                <div className="mt-1 text-sm font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                  {item.campusName}
                </div>

                {/* Two Compact Metrics */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-3 items-end">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Total Cash on Hand</span>
                    </div>
                    <div
                      className={`mt-0.5 text-base font-black font-mono tabular-nums truncate ${
                        item.totalCashOnHand < 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatPkrAmount(item.totalCashOnHand)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums truncate">
                      GL {Math.round(item.cashLedgerBalance).toLocaleString('en-PK')} · Petty{' '}
                      {Math.round(item.pettyCashBalance).toLocaleString('en-PK')}
                    </div>
                  </div>

                  <div className="min-w-0 text-right">
                    <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">Today&apos;s Vouchers</span>
                    </div>
                    <div className="mt-0.5 text-base font-black font-mono tabular-nums text-white">
                      {item.todayVoucherCount}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 font-mono tabular-nums truncate">
                      {item.todayPendingCount > 0
                        ? `All statuses · ${item.todayPendingCount} pending`
                        : 'All statuses today'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CampusDashboardOverview;
