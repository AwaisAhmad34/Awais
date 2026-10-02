import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  AlertTriangle,
  QrCode,
  FileBarChart2,
  Layers,
  PieChart,
  CheckCircle2,
  Ban,
  ShieldAlert,
  Sliders,
  Lock,
  Sun,
  Moon,
  Palette,
} from 'lucide-react';
import {
  ALL_18_REPORT_DEFINITIONS,
  ALL_16_CLIENT_MODULES,
  ALL_8_DASHBOARD_CHARTS,
  COLOR_SCHEME_VARIATIONS,
  ColorSchemeVariationId,
  ThemeModeOption,
  SiteOwnerGovernanceState,
  getStoredSiteOwnerGovernance,
  saveStoredSiteOwnerGovernance,
  subscribeSiteOwnerGovernance,
  evaluateCampusPettyCashAlerts,
  createDefaultClientControlProfile,
  ClientDeepControlProfile,
} from './SiteOwnerGovernanceEngine';
import type { SchoolInstituteAccount } from './MultiSchoolAdminPanel';

interface SiteOwnerDeepGovernanceHubProps {
  institutes: SchoolInstituteAccount[];
  activeClientId: string;
  onSelectClientId: (id: string) => void;
  onTriggerToast?: (msg: string) => void;
}

export const SiteOwnerDeepGovernanceHub: React.FC<
  SiteOwnerDeepGovernanceHubProps
> = ({ institutes, activeClientId, onSelectClientId, onTriggerToast }) => {
  const [govState, setGovState] = useState<SiteOwnerGovernanceState>(() =>
    getStoredSiteOwnerGovernance()
  );

  useEffect(() => {
    return subscribeSiteOwnerGovernance(setGovState);
  }, []);

  const selectedClient =
    institutes.find((i) => i.id === activeClientId) || institutes[0];

  const clientProfile: ClientDeepControlProfile = useMemo(() => {
    return (
      govState.clientControls[selectedClient.id] ||
      createDefaultClientControlProfile(selectedClient.id, 'FULL')
    );
  }, [govState.clientControls, selectedClient.id]);

  const pettyCashEvaluations = useMemo(() => {
    return evaluateCampusPettyCashAlerts(govState);
  }, [govState]);

  const flaggedCampuses = useMemo(() => {
    return pettyCashEvaluations.filter(
      (e) => e.severity === 'CRITICAL' || e.severity === 'WARNING'
    );
  }, [pettyCashEvaluations]);

  const updateGov = (next: SiteOwnerGovernanceState, msg?: string) => {
    setGovState(next);
    saveStoredSiteOwnerGovernance(next);
    if (msg && onTriggerToast) {
      onTriggerToast(msg);
    }
  };

  const updateClientProfile = (
    updater: (prev: ClientDeepControlProfile) => ClientDeepControlProfile,
    msg?: string
  ) => {
    const nextProfile = updater(clientProfile);
    const nextState: SiteOwnerGovernanceState = {
      ...govState,
      clientControls: {
        ...govState.clientControls,
        [selectedClient.id]: nextProfile,
      },
    };
    updateGov(nextState, msg);
  };

  const handleToggleReport = (reportId: string) => {
    updateClientProfile((prev) => {
      const exists = prev.allowedReports.includes(reportId);
      const nextReports = exists
        ? prev.allowedReports.filter((id) => id !== reportId)
        : [...prev.allowedReports, reportId];
      return { ...prev, allowedReports: nextReports };
    }, `Updated allowed reports count for ${selectedClient.name}.`);
  };

  const handleToggleModule = (modId: string) => {
    updateClientProfile((prev) => {
      const exists = prev.allowedModules.includes(modId);
      const nextModules = exists
        ? prev.allowedModules.filter((id) => id !== modId)
        : [...prev.allowedModules, modId];
      return { ...prev, allowedModules: nextModules };
    }, `Updated allowed modules for ${selectedClient.name}.`);
  };

  const handleToggleChart = (chartId: string) => {
    updateClientProfile((prev) => {
      const exists = prev.allowedDashboardCharts.includes(chartId);
      const nextCharts = exists
        ? prev.allowedDashboardCharts.filter((id) => id !== chartId)
        : [...prev.allowedDashboardCharts, chartId];
      return { ...prev, allowedDashboardCharts: nextCharts };
    }, `Updated visible dashboard charts for ${selectedClient.name}.`);
  };

  return (
    <div className="space-y-5 text-xs" data-site-admin-allowed="true">
      {/* =================================================================== */}
      {/* 1. AUTOMATED PETTY CASH USAGE SPIKE ALERT ENGINE (HISTORICAL AVG)   */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border-2 border-rose-500 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-sm text-slate-900 uppercase">
                  Automated Campus Petty Cash Spike Alert System (Historical Monthly Average Comparison)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[10px]">
                  {flaggedCampuses.length} Campus Alert(s) Flagged
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Automatically compares each campus&apos;s current monthly petty cash usage against its 3-month historical monthly average and notifies the Site Owner when spending exceeds defined Warning (+{govState.globalWarningThresholdPct}%) or Critical (+{govState.globalCriticalThresholdPct}%) thresholds.
              </p>
            </div>
          </div>

          {/* Threshold Controls */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold text-slate-600">
                Warning Threshold (%)
              </label>
              <input
                type="number"
                value={govState.globalWarningThresholdPct}
                onChange={(e) =>
                  updateGov({
                    ...govState,
                    globalWarningThresholdPct: Math.max(
                      1,
                      Number(e.target.value) || 20
                    ),
                  })
                }
                className="w-20 px-2 py-1 rounded border border-slate-300 font-mono font-black bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600">
                Critical Threshold (%)
              </label>
              <input
                type="number"
                value={govState.globalCriticalThresholdPct}
                onChange={(e) =>
                  updateGov({
                    ...govState,
                    globalCriticalThresholdPct: Math.max(
                      5,
                      Number(e.target.value) || 35
                    ),
                  })
                }
                className="w-20 px-2 py-1 rounded border border-rose-300 font-mono font-black bg-white text-rose-900"
              />
            </div>
          </div>
        </div>

        {/* Active Site Admin Notifications for Flagged Campuses */}
        {flaggedCampuses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {flaggedCampuses.map((alert) => (
              <div
                key={alert.campusId}
                className={`rounded-xl p-3 border-2 flex flex-col justify-between gap-2 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-400 text-rose-950'
                    : 'bg-amber-50 border-amber-400 text-amber-950'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-[10px] px-2 py-0.5 rounded bg-slate-900 text-amber-300">
                      {alert.organizationCode} · {alert.campusCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {alert.severity} (+{alert.variancePct}%)
                    </span>
                  </div>
                  <div className="font-black text-xs mt-1.5">
                    {alert.campusName}
                  </div>
                  <p className="text-[11px] mt-1">{alert.alertMessage}</p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-300/60">
                  <span className="font-mono text-[10px] font-bold">
                    Overrun: +PKR {alert.variancePKR.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextMetrics = govState.campusPettyCashMetrics.map(
                        (m) =>
                          m.campusId === alert.campusId
                            ? {
                                ...m,
                                pettyCashFrozenByAlert: !m.pettyCashFrozenByAlert,
                              }
                            : m
                      );
                      updateGov(
                        { ...govState, campusPettyCashMetrics: nextMetrics },
                        `${
                          alert.pettyCashFrozenByAlert ? 'Unfroze' : 'Froze'
                        } Petty Cash disbursements for ${alert.campusName}.`
                      );
                    }}
                    className={`px-2.5 py-1 rounded-lg font-black text-[10px] cursor-pointer ${
                      alert.pettyCashFrozenByAlert
                        ? 'bg-slate-900 text-emerald-300'
                        : 'bg-rose-700 text-white'
                    }`}
                  >
                    {alert.pettyCashFrozenByAlert
                      ? '✓ Petty Cash Frozen (Click to Unfreeze)'
                      : 'Freeze Campus Petty Cash'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Campus Historical Monthly Average vs Current Spend Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 text-xs">
            <thead>
              <tr className="bg-slate-100 font-black uppercase text-slate-700">
                <th className="border border-slate-200 p-2 text-left">Client & Campus</th>
                <th className="border border-slate-200 p-2 text-right">3-Mo Historical Monthly Avg (PKR)</th>
                <th className="border border-slate-200 p-2 text-right">Current Month Petty Cash (PKR)</th>
                <th className="border border-slate-200 p-2 text-right">Variance vs Avg</th>
                <th className="border border-slate-200 p-2 text-center">Alert Status</th>
                <th className="border border-slate-200 p-2 text-center">Site Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {pettyCashEvaluations.map((row) => (
                <tr key={row.campusId} className="border-b border-slate-200">
                  <td className="border border-slate-200 p-2">
                    <div className="font-black text-slate-900">
                      [{row.organizationCode}] {row.campusName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      3-Mo History: PKR{' '}
                      {row.threeMonthHistoryPKR
                        .map((n) => n.toLocaleString())
                        .join(' / ')}
                    </div>
                  </td>
                  <td className="border border-slate-200 p-2 text-right font-mono font-bold">
                    <input
                      type="number"
                      value={row.historicalMonthlyAvgPKR}
                      onChange={(e) => {
                        const val = Math.max(1000, Number(e.target.value) || 0);
                        const next = govState.campusPettyCashMetrics.map((m) =>
                          m.campusId === row.campusId
                            ? { ...m, historicalMonthlyAvgPKR: val }
                            : m
                        );
                        updateGov({ ...govState, campusPettyCashMetrics: next });
                      }}
                      className="w-28 px-2 py-1 rounded border border-slate-300 text-right font-mono font-bold"
                    />
                  </td>
                  <td className="border border-slate-200 p-2 text-right font-mono font-black">
                    <input
                      type="number"
                      value={row.currentMonthSpendPKR}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        const next = govState.campusPettyCashMetrics.map((m) =>
                          m.campusId === row.campusId
                            ? { ...m, currentMonthSpendPKR: val }
                            : m
                        );
                        updateGov({ ...govState, campusPettyCashMetrics: next });
                      }}
                      className="w-28 px-2 py-1 rounded border border-indigo-300 bg-indigo-50/40 text-right font-mono font-black"
                    />
                  </td>
                  <td className="border border-slate-200 p-2 text-right font-mono font-black">
                    <span
                      className={
                        row.variancePct >= govState.globalCriticalThresholdPct
                          ? 'text-rose-700'
                          : row.variancePct >= row.effectiveThresholdPct
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }
                    >
                      {row.variancePct >= 0 ? '+' : ''}
                      {row.variancePct}% (PKR {row.variancePKR.toLocaleString()})
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                        row.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-900 border border-rose-300'
                          : row.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="border border-slate-200 p-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        const next = govState.campusPettyCashMetrics.map((m) =>
                          m.campusId === row.campusId
                            ? {
                                ...m,
                                acknowledgedByAdmin: !m.acknowledgedByAdmin,
                              }
                            : m
                        );
                        updateGov(
                          { ...govState, campusPettyCashMetrics: next },
                          `Updated alert acknowledgment for ${row.campusName}.`
                        );
                      }}
                      className={`px-2.5 py-1 rounded font-bold text-[10px] cursor-pointer ${
                        row.acknowledgedByAdmin
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 text-amber-300'
                      }`}
                    >
                      {row.acknowledgedByAdmin
                        ? '✓ Alert Acknowledged'
                        : 'Acknowledge Alert'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. SITE OWNER LIGHT/DARK THEME & COLOR SCHEME VARIATION STUDIO      */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border-2 border-indigo-600 p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Site Owner Visual Governance · Light / Dark Mode & Color Scheme Variations
              </div>
              <h3 className="font-black text-sm text-slate-900 uppercase">
                Manage Site Owner Light/Dark Theme & Assign Color Scheme Variations Per Client
              </h3>
              <p className="text-[11px] text-slate-600">
                Toggle Light or Dark mode for the Site Owner Master Panel and assign a dedicated Light/Dark Mode + Color Scheme Variation to each School Client.
              </p>
            </div>
          </div>

          {/* Site Owner Master Panel Theme Toggle */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-300">
            <span className="font-black text-[11px] text-slate-800 px-1">
              Site Owner Panel Theme:
            </span>
            <button
              type="button"
              onClick={() =>
                updateGov(
                  { ...govState, siteOwnerMasterThemeMode: 'light' },
                  'Switched Site Owner Master Panel to Light Theme.'
                )
              }
              className={`px-3 py-1.5 rounded-lg font-black flex items-center gap-1 cursor-pointer ${
                (govState.siteOwnerMasterThemeMode || 'light') === 'light'
                  ? 'bg-amber-400 text-slate-950 shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              onClick={() =>
                updateGov(
                  { ...govState, siteOwnerMasterThemeMode: 'dark' },
                  'Switched Site Owner Master Panel to Dark Theme.'
                )
              }
              className={`px-3 py-1.5 rounded-lg font-black flex items-center gap-1 cursor-pointer ${
                govState.siteOwnerMasterThemeMode === 'dark'
                  ? 'bg-slate-900 text-amber-300 shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>

        {/* Assign Theme & Color Scheme Variation to Selected Client */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left Column: Selected Client Light/Dark & Lock Control */}
          <div className="rounded-xl border border-slate-300 p-4 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-slate-900">
                Client Theme Mode ({selectedClient.code})
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono font-bold text-[10px]">
                {(clientProfile.themeMode || 'light').toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({ ...prev, themeMode: 'light' }),
                    `Assigned Light Theme Mode to ${selectedClient.name}.`
                  )
                }
                className={`py-2 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer border ${
                  (clientProfile.themeMode || 'light') === 'light'
                    ? 'bg-amber-400 border-amber-500 text-slate-950'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Assign Light</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({ ...prev, themeMode: 'dark' }),
                    `Assigned Dark Theme Mode to ${selectedClient.name}.`
                  )
                }
                className={`py-2 rounded-xl font-black flex items-center justify-center gap-1.5 cursor-pointer border ${
                  clientProfile.themeMode === 'dark'
                    ? 'bg-slate-900 border-slate-950 text-amber-300'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Assign Dark</span>
              </button>
            </div>

            <label className="flex items-center gap-2 pt-1 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(clientProfile.lockClientThemeOverride)}
                onChange={(e) =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      lockClientThemeOverride: e.target.checked,
                    }),
                    `Updated Theme Lock policy for ${selectedClient.name}.`
                  )
                }
              />
              <span>Lock Theme & Color Scheme (Client Cannot Override)</span>
            </label>
          </div>

          {/* Right 2 Columns: 6 Color Scheme Variations Grid */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black uppercase text-slate-900">
                Assign Color Scheme Variation for {selectedClient.name} & Site Preview:
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Click any variation below to apply immediately
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {COLOR_SCHEME_VARIATIONS.map((scheme) => {
                const isSelectedForClient =
                  (clientProfile.colorSchemeId || 'royal_indigo') === scheme.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => {
                      const nextProfile: ClientDeepControlProfile = {
                        ...clientProfile,
                        colorSchemeId: scheme.id as ColorSchemeVariationId,
                      };
                      updateGov(
                        {
                          ...govState,
                          siteOwnerMasterColorSchemeId:
                            scheme.id as ColorSchemeVariationId,
                          clientControls: {
                            ...govState.clientControls,
                            [selectedClient.id]: nextProfile,
                          },
                        },
                        `Assigned Color Scheme Variation "${scheme.name}" to ${selectedClient.name}.`
                      );
                    }}
                    className={`text-left p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelectedForClient
                        ? 'border-slate-950 ring-2 ring-amber-400 bg-white shadow-sm'
                        : 'border-slate-200 hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: scheme.primaryHex }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: scheme.accentHex }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: scheme.headerBgHex }}
                        />
                      </div>
                      {isSelectedForClient && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono font-black text-[9px]">
                          ACTIVE ✓
                        </span>
                      )}
                    </div>
                    <div className="font-black text-slate-900 mt-1.5">
                      {scheme.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {scheme.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. SITE OWNER CLIENT RIGHTS MATRIX: QR CODE BLOCK, REPORTS COUNT,   */}
      {/*    MODULES COUNT & DASHBOARD CHARTS VISIBILITY CONTROL              */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border-2 border-indigo-600 p-5 space-y-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
              Site Owner Full Client Visibility & Feature Authority
            </div>
            <h3 className="font-black text-base text-slate-900">
              Control QR Code Blocking, Allowed Reports Count ({clientProfile.allowedReports.length}/18), Allowed Modules ({clientProfile.allowedModules.length}/16) & Dashboard Charts ({clientProfile.allowedDashboardCharts.length}/8)
            </h3>
            <p className="text-[11px] text-slate-600">
              Choose any School Client below to control whether their QR codes are blocked or allowed, exactly how many reports and modules they can see, and which dashboard charts are displayed in their client portal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-black text-slate-700">Target Client:</span>
            <select
              value={selectedClient.id}
              onChange={(e) => onSelectClientId(e.target.value)}
              className="px-3 py-2 rounded-xl border-2 border-indigo-600 bg-indigo-50 font-black text-indigo-950"
            >
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.code} — {inst.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary KPI Strip for Selected Client */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* QR Code Block / Allow Card */}
          <div
            className={`rounded-xl p-3.5 border-2 flex flex-col justify-between ${
              clientProfile.allowQrCodeVerification
                ? 'bg-emerald-50 border-emerald-400'
                : 'bg-rose-50 border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-[11px]">
                Client QR Code Status
              </span>
              <QrCode className="w-4 h-4" />
            </div>
            <div className="text-base font-black my-1">
              {clientProfile.allowQrCodeVerification
                ? 'QR CODE ALLOWED ✓'
                : 'QR CODE BLOCKED ✕'}
            </div>
            <button
              type="button"
              onClick={() =>
                updateClientProfile(
                  (prev) => ({
                    ...prev,
                    allowQrCodeVerification: !prev.allowQrCodeVerification,
                    allowVoucherQrCode: !prev.allowQrCodeVerification,
                    allowReportQrCode: !prev.allowQrCodeVerification,
                    allowChallanQrCode: !prev.allowQrCodeVerification,
                  }),
                  `${
                    clientProfile.allowQrCodeVerification ? 'Blocked' : 'Enabled'
                  } all QR Codes for ${selectedClient.name}.`
                )
              }
              className={`w-full py-1.5 rounded-lg font-black text-xs cursor-pointer ${
                clientProfile.allowQrCodeVerification
                  ? 'bg-rose-600 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {clientProfile.allowQrCodeVerification
                ? 'Block QR Code for Client'
                : 'Unblock / Allow QR Code'}
            </button>
          </div>

          {/* Reports Count Card */}
          <div className="rounded-xl p-3.5 border-2 border-indigo-300 bg-indigo-50/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-[11px] text-indigo-900">
                Reports Shown to Client
              </span>
              <FileBarChart2 className="w-4 h-4 text-indigo-700" />
            </div>
            <div className="text-lg font-black text-indigo-950 my-1">
              {clientProfile.allowedReports.length} / {ALL_18_REPORT_DEFINITIONS.length} Reports
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      allowedReports: ALL_18_REPORT_DEFINITIONS.map((r) => r.id),
                    }),
                    `Enabled all 18 reports for ${selectedClient.name}.`
                  )
                }
                className="flex-1 py-1 rounded bg-indigo-600 text-white font-bold text-[10px] cursor-pointer"
              >
                Show All 18
              </button>
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      allowedReports: ALL_18_REPORT_DEFINITIONS.slice(0, 5).map(
                        (r) => r.id
                      ),
                    }),
                    `Restricted ${selectedClient.name} to 5 core reports.`
                  )
                }
                className="flex-1 py-1 rounded bg-slate-800 text-white font-bold text-[10px] cursor-pointer"
              >
                Core 5 Only
              </button>
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({ ...prev, allowedReports: [] }),
                    `Blocked all reports for ${selectedClient.name}.`
                  )
                }
                className="px-2 py-1 rounded bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
              >
                0
              </button>
            </div>
          </div>

          {/* Modules Count Card */}
          <div className="rounded-xl p-3.5 border-2 border-emerald-300 bg-emerald-50/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-[11px] text-emerald-900">
                Modules Shown to Client
              </span>
              <Layers className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-lg font-black text-emerald-950 my-1">
              {clientProfile.allowedModules.length} / {ALL_16_CLIENT_MODULES.length} Modules
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      allowedModules: ALL_16_CLIENT_MODULES.map((m) => m.id),
                    }),
                    `Enabled all 16 modules for ${selectedClient.name}.`
                  )
                }
                className="flex-1 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
              >
                Allow All 16
              </button>
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      allowedModules: ['dashboard', 'reports', 'coa'],
                    }),
                    `Set ${selectedClient.name} to Basic 3 Modules.`
                  )
                }
                className="flex-1 py-1 rounded bg-slate-800 text-white font-bold text-[10px] cursor-pointer"
              >
                Basic 3 Only
              </button>
            </div>
          </div>

          {/* Dashboard Charts Count Card */}
          <div className="rounded-xl p-3.5 border-2 border-amber-300 bg-amber-50/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-[11px] text-amber-900">
                Dashboard Charts Shown
              </span>
              <PieChart className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-lg font-black text-amber-950 my-1">
              {clientProfile.allowedDashboardCharts.length} / {ALL_8_DASHBOARD_CHARTS.length} Charts
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({
                      ...prev,
                      allowedDashboardCharts: ALL_8_DASHBOARD_CHARTS.map(
                        (c) => c.id
                      ),
                    }),
                    `Enabled all 8 dashboard charts for ${selectedClient.name}.`
                  )
                }
                className="flex-1 py-1 rounded bg-amber-500 text-slate-950 font-black text-[10px] cursor-pointer"
              >
                Show All 8
              </button>
              <button
                type="button"
                onClick={() =>
                  updateClientProfile(
                    (prev) => ({ ...prev, allowedDashboardCharts: [] }),
                    `Hid all dashboard charts for ${selectedClient.name}.`
                  )
                }
                className="flex-1 py-1 rounded bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
              >
                Hide All Charts
              </button>
            </div>
          </div>
        </div>

        {/* Granular QR Code Sub-Controls */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="font-black text-slate-800 uppercase text-[11px]">
            Granular QR Code Placement Controls for {selectedClient.name}:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['allowVoucherQrCode', 'Voucher Print QR Code'],
                ['allowReportQrCode', 'Financial Reports QR Code'],
                ['allowChallanQrCode', 'Student Fee Challan QR Code'],
              ] as const
            ).map(([k, label]) => {
              const on =
                clientProfile.allowQrCodeVerification &&
                clientProfile[k] !== false;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    updateClientProfile((prev) => ({
                      ...prev,
                      allowQrCodeVerification: true,
                      [k]: !prev[k],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg font-bold text-[11px] border cursor-pointer ${
                    on
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                      : 'bg-rose-100 border-rose-300 text-rose-900 line-through'
                  }`}
                >
                  {on ? '✓ Allowed: ' : '✕ Blocked: '}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Column Deep Selector Grid: 18 Reports | 16 Modules | 8 Dashboard Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Which Reports Client Can See (X / 18) */}
          <div className="border border-slate-300 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-black uppercase text-indigo-950">
                1. Allowed Reports ({clientProfile.allowedReports.length}/18)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Click to Toggle
              </span>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {ALL_18_REPORT_DEFINITIONS.map((rep) => {
                const enabled = clientProfile.allowedReports.includes(rep.id);
                return (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => handleToggleReport(rep.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      enabled
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <span className="truncate">{rep.title}</span>
                    <span className="text-[10px] font-mono shrink-0">
                      {enabled ? 'SHOW ✓' : 'HIDDEN'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 2: Which ERP Modules Client Can See (X / 16) */}
          <div className="border border-slate-300 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-black uppercase text-emerald-950">
                2. Allowed Modules ({clientProfile.allowedModules.length}/16)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Click to Toggle
              </span>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {ALL_16_CLIENT_MODULES.map((mod) => {
                const enabled = clientProfile.allowedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleToggleModule(mod.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 cursor-pointer ${
                      enabled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <span className="truncate">{mod.title}</span>
                    <span className="text-[10px] font-mono shrink-0">
                      {enabled ? 'ENABLED ✓' : 'BLOCKED'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 3: Which Dashboard Charts Client Can See (X / 8) */}
          <div className="border border-slate-300 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-black uppercase text-amber-950">
                3. Dashboard Charts ({clientProfile.allowedDashboardCharts.length}/8)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Click to Toggle
              </span>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {ALL_8_DASHBOARD_CHARTS.map((chart) => {
                const enabled = clientProfile.allowedDashboardCharts.includes(
                  chart.id
                );
                return (
                  <button
                    key={chart.id}
                    type="button"
                    onClick={() => handleToggleChart(chart.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border cursor-pointer ${
                      enabled
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="truncate">{chart.title}</span>
                      <span className="text-[10px] font-mono shrink-0">
                        {enabled ? 'VISIBLE ✓' : 'HIDDEN'}
                      </span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      {chart.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
