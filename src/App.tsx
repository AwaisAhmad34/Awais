/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { AccountingProvider, MainApp } from './core/aplusEngine';
import { AplusSystemManual } from './components/AplusSystemManual';
import { AplusTopBar } from './components/AplusTopBar';
import { SecureAuditTrail } from './components/SecureAuditTrail';
import { PrintableVoucherA4Layout } from './components/PrintableVoucherA4Layout';
import { PhysicalCashReconciliation } from './components/PhysicalCashReconciliation';
import { BudgetVarianceWidget } from './components/BudgetVarianceWidget';
import { PettyCashCategoryAnalytics } from './components/PettyCashCategoryAnalytics';
import { ModernErpSuite } from './components/ModernErpSuite';
import {
  BulkVoucherAndAccessManager,
  installGlobalVisibilityHook,
} from './components/BulkVoucherAndAccessManager';
import { FinancialHealthAndSuggestions } from './components/FinancialHealthAndSuggestions';
import { MultiFormatReportsHub } from './components/MultiFormatReportsHub';
import { DynamicReportSignatureBlock } from './components/ReportSignatureManager';
import { RecurringVoucherManager } from './components/RecurringVoucherManager';
import {
  MultiSchoolAdminPanel,
  SiteAdminGlobalFooter,
} from './components/MultiSchoolAdminPanel';
import { SiteOwnerEntryCreationGuard } from './components/BulkVoucherPdfPrinter';
import {
  TenantAuthProvider,
  useTenantAuth,
} from './context/TenantAuthContext';
import {
  getStoredSiteOwnerGovernance,
  saveStoredSiteOwnerGovernance,
  subscribeSiteOwnerGovernance,
  createDefaultClientControlProfile,
  applySiteOwnerThemeAndColorScheme,
  COLOR_SCHEME_VARIATIONS,
  ColorSchemeVariationId,
} from './components/SiteOwnerGovernanceEngine';
import { initFirebaseCloudSync } from './services/firebaseSync';
import { useState } from 'react';

initFirebaseCloudSync();
installGlobalVisibilityHook();
window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail;
window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
window.__APLUS_MODERN_ERP__ = ModernErpSuite;
window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
window.__APLUS_RECURRING_VOUCHERS__ = RecurringVoucherManager;
window.__APLUS_MULTI_SCHOOL_ADMIN__ = MultiSchoolAdminPanel;
window.__APLUS_TOP_BAR__ = AplusTopBar;

function AppRoleWorkspaceRouter() {
  const {
    platformRole,
    setPlatformRole,
    organizationId,
    organizationCode,
    organizationName,
  } = useTenantAuth();
  const [govState, setGovState] = useState(() =>
    getStoredSiteOwnerGovernance()
  );

  useEffect(() => {
    return subscribeSiteOwnerGovernance(setGovState);
  }, []);

  const activeClientCtrl =
    govState.clientControls[organizationId] ||
    createDefaultClientControlProfile(organizationId, 'FULL');

  const isSiteOwner = platformRole === 'platform_super_admin';

  useEffect(() => {
    applySiteOwnerThemeAndColorScheme(govState, organizationId, isSiteOwner);
  }, [govState, organizationId, isSiteOwner]);

  const currentThemeMode = isSiteOwner
    ? govState.siteOwnerMasterThemeMode || 'light'
    : activeClientCtrl.themeMode || 'light';

  const currentSchemeId = isSiteOwner
    ? govState.siteOwnerMasterColorSchemeId || 'royal_indigo'
    : activeClientCtrl.colorSchemeId || 'royal_indigo';

  const handleToggleTopBarTheme = () => {
    if (isSiteOwner) {
      const nextMode = currentThemeMode === 'dark' ? 'light' : 'dark';
      const next = { ...govState, siteOwnerMasterThemeMode: nextMode as 'light' | 'dark' };
      setGovState(next);
      saveStoredSiteOwnerGovernance(next);
    } else if (!activeClientCtrl.lockClientThemeOverride) {
      const nextMode = currentThemeMode === 'dark' ? 'light' : 'dark';
      const next = {
        ...govState,
        clientControls: {
          ...govState.clientControls,
          [organizationId]: {
            ...activeClientCtrl,
            themeMode: nextMode as 'light' | 'dark',
          },
        },
      };
      setGovState(next);
      saveStoredSiteOwnerGovernance(next);
    }
  };

  const handleChangeTopBarScheme = (schemeId: ColorSchemeVariationId) => {
    const next = {
      ...govState,
      siteOwnerMasterColorSchemeId: schemeId,
      clientControls: {
        ...govState.clientControls,
        [organizationId]: {
          ...activeClientCtrl,
          colorSchemeId: schemeId,
        },
      },
    };
    setGovState(next);
    saveStoredSiteOwnerGovernance(next);
  };

  // SITE OWNER DEDICATED MASTER PANEL MODE:
  // Shows ONLY the overall site governance & full client right controls (no client site UI or entry modules)
  if (isSiteOwner) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <div className="bg-slate-950 text-white border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black uppercase text-[10px]">
              Dedicated Site Owner Master Panel
            </span>
            <span className="font-bold text-slate-200">
              Overall Site Governance & Full Client Right Controls Only (Zero Client Entry Forms)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentSchemeId}
              onChange={(e) =>
                handleChangeTopBarScheme(
                  e.target.value as ColorSchemeVariationId
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-amber-300 font-bold text-[11px]"
            >
              {COLOR_SCHEME_VARIATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  Scheme: {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleToggleTopBarTheme}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-[11px] cursor-pointer"
            >
              {currentThemeMode === 'dark' ? '☀ Light Mode' : '🌙 Dark Mode'}
            </button>
            <button
              type="button"
              onClick={() => setPlatformRole('school_client_admin')}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer"
            >
              Open Client Site ERP UI ({organizationCode}) →
            </button>
          </div>
        </div>
        <div className="flex-1">
          <MultiSchoolAdminPanel />
        </div>
      </div>
    );
  }

  // CLIENT SITE ERP UI MODE (Scoped to the Client's Allowed Modules, Reports, Charts & QR Code Policy)
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-indigo-950 text-white border-b border-indigo-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-[10px]">
            Client ERP Mode: {organizationCode} ({organizationName})
          </span>
          <span className="text-[11px] text-indigo-200 font-semibold">
            Site Owner Rights Applied: QR Code{' '}
            <strong>
              {activeClientCtrl.allowQrCodeVerification ? 'ALLOWED' : 'BLOCKED'}
            </strong>{' '}
            · Reports:{' '}
            <strong>{activeClientCtrl.allowedReports.length}/18</strong> ·
            Modules:{' '}
            <strong>{activeClientCtrl.allowedModules.length}/16</strong> ·
            Dashboard Charts:{' '}
            <strong>{activeClientCtrl.allowedDashboardCharts.length}/8</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPlatformRole('platform_super_admin')}
          className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer"
        >
          ← Return to Dedicated Site Owner Master Panel
        </button>
      </div>
      <div className="flex-1">
        <MainApp />
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initFirebaseCloudSync();
    installGlobalVisibilityHook();
    window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
    window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail;
    window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
    window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
    window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
    window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
    window.__APLUS_MODERN_ERP__ = ModernErpSuite;
    window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
    window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
    window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
    window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
    window.__APLUS_RECURRING_VOUCHERS__ = RecurringVoucherManager;
    window.__APLUS_MULTI_SCHOOL_ADMIN__ = MultiSchoolAdminPanel;
    window.__APLUS_TOP_BAR__ = AplusTopBar;
  }, []);

  return (
    <AccountingProvider>
      <TenantAuthProvider>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <AppRoleWorkspaceRouter />
          </div>
          <SiteOwnerEntryCreationGuard />
          <SiteAdminGlobalFooter />
        </div>
      </TenantAuthProvider>
    </AccountingProvider>
  );
}
