/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  AccountingProvider,
  MainApp,
  useAccounting,
} from './core/aplusEngine';
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
import { DailyCashSummary } from './components/DailyCashSummary';
import { MultiFormatReportsHub } from './components/MultiFormatReportsHub';
import { DynamicReportSignatureBlock } from './components/ReportSignatureManager';
import { DynamicCampusLoginPortal } from './components/DynamicCampusLoginPortal';
import { PermissionEngine } from './components/PermissionEngine';
import { PlatformSiteAdminHub } from './components/PlatformSiteAdminHub';
import { ClientOwnerManagementHub } from './components/ClientOwnerManagementHub';
import { CampusMonthlyBudgetExpenditureChart } from './components/CampusMonthlyBudgetExpenditureChart';
import { initFirebaseCloudSync } from './services/firebaseSync';
import { purgeAllProductionData, getStoredSchoolClients, fetchSchoolClientsFromCloud, SchoolClientOrganization } from './services/platformSiteAdminService';
import { ErrorBoundary } from './components/ErrorBoundary';

import { SEED_MULTI_TENANT_USERS, filterCampusesForUser } from './services/multiTenantDataService';

// ----------------------------------------------------------------------------
// DEFENSIVE DATA SANITIZATION: Clean duplicate user records from localStorage
// ----------------------------------------------------------------------------
function purgeDuplicateUsersFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const userKeys = ['ams_users_v5_clean', 'aplus_users', 'users'];
    for (const key of userKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seenIds = new Set<string>();
        const seenUsernames = new Set<string>();
        const clean: any[] = [];
        for (const u of parsed) {
          if (!u) continue;
          const uid = u.id ? String(u.id).trim() : '';
          const uname = u.username ? String(u.username).toLowerCase().trim() : '';
          if (uid && seenIds.has(uid)) continue;
          if (uname && seenUsernames.has(uname)) continue;
          if (uid) seenIds.add(uid);
          if (uname) seenUsernames.add(uname);
          clean.push(u);
        }
        if (clean.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(clean));
        }
      }
    }
  } catch {}
}

// ----------------------------------------------------------------------------
// PRODUCTION RECOVERY BOOTSTRAP: Ensure Master Accounts Exist on Fresh Vercel Deployments
// ----------------------------------------------------------------------------
function bootstrapProductionDefaultAccounts() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const raw = localStorage.getItem('ams_users_v5_clean');
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const userMap = new Map<string, any>();

    if (Array.isArray(existing)) {
      existing.forEach((u) => {
        if (u && (u.username || u.id)) {
          userMap.set(String(u.username || u.id).toLowerCase(), u);
        }
      });
    }

    let modified = false;
    for (const seed of SEED_MULTI_TENANT_USERS) {
      const key = seed.username.toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, seed);
        modified = true;
      }
    }

    if (modified || !raw) {
      localStorage.setItem('ams_users_v5_clean', JSON.stringify(Array.from(userMap.values())));
    }
  } catch (err) {
    console.warn('Could not bootstrap production default accounts:', err);
  }
}

// One-time cleanup utility available on window.__PURGE_PRODUCTION_DATA__ for emergency resets
(window as any).__PURGE_PRODUCTION_DATA__ = purgeAllProductionData;
purgeDuplicateUsersFromStorage();
bootstrapProductionDefaultAccounts();
initFirebaseCloudSync();
fetchSchoolClientsFromCloud().catch(() => {});
installGlobalVisibilityHook();
window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail as any;
window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
window.__APLUS_MODERN_ERP__ = ModernErpSuite;
// Executive Dashboard is reserved exclusively for charts & institutional performance
window.__APLUS_BULK_VOUCHER_HUB__ = undefined;
window.__APLUS_SUGGESTIONS_HUB__ = undefined;
window.__APLUS_DAILY_CASH_SUMMARY__ = DailyCashSummary;
window.__APLUS_SITE_ADMIN_HUB__ = PlatformSiteAdminHub;
window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
window.__APLUS_PERMISSION_ENGINE__ = PermissionEngine;
window.__APLUS_TOP_BAR__ = AplusTopBar;
(window as any).__APLUS_CAMPUS_BUDGET_COMPARISON_CHART__ = CampusMonthlyBudgetExpenditureChart;

function InnerApp() {
  const { currentUser, isSuperAdmin, setCurrentCampusId, currentCampusId, campuses } = useAccounting();
  const [adminViewMode, setAdminViewMode] = useState<'platform_control_panel' | 'campus_operations'>('platform_control_panel');
  const [clientViewMode, setClientViewMode] = useState<'client_hub' | 'campus_operations'>('client_hub');
  const [clientsVersion, setClientsVersion] = useState(0);

  useEffect(() => {
    const handleUpdated = () => setClientsVersion((v) => v + 1);
    window.addEventListener('aplus-clients-updated', handleUpdated);
    return () => window.removeEventListener('aplus-clients-updated', handleUpdated);
  }, []);

  // Hierarchy Level 1: Platform Super Admin (Site Owner) - Strictly Super Administration account ONLY
  const isPlatformSiteAdmin = Boolean(
    currentUser &&
    !currentUser.clientId &&
    (currentUser.role === 'level_1_platform_super_admin' ||
     currentUser.username?.toLowerCase() === 'admin' ||
     (currentUser.role === 'admin' && !currentUser.campusId && isSuperAdmin))
  );

  // Hierarchy Level 2: Main Campus Administrator (Client Owner)
  const isClientOwnerMainAdmin = Boolean(
    currentUser &&
    (currentUser.role === 'level_2_client_super_admin' ||
     Boolean(currentUser.clientId && currentUser.role?.includes('client_super_admin')))
  );

  const userClientId = currentUser?.clientId || (isClientOwnerMainAdmin ? 'client-aplus' : null);

  // Subordinate Campuses strictly belonging to this Level 2 Client (Hook called unconditionally)
  const mySubordinateCampuses = useMemo(() => {
    if (!currentUser) return [];
    return filterCampusesForUser(campuses, currentUser);
  }, [campuses, currentUser]);

  // Client Organization details (reads from stored clients or fallbacks, hook called unconditionally)
  const clientOrg = useMemo((): (SchoolClientOrganization | { id: string; name: string; code: string; logoUrl?: string }) | null => {
    if (!userClientId) return null;
    const stored = getStoredSchoolClients().find((c) => c.id === userClientId);
    if (stored) return stored;
    if (userClientId === 'client-apex') {
      return { id: 'client-apex', name: 'Apex School System', code: 'APEX', logoUrl: undefined };
    }
    return { id: 'client-aplus', name: 'Aplus School System', code: 'APLUS', logoUrl: undefined };
  }, [userClientId, clientsVersion]);

  // Login is required for everyone (Early return placed AFTER all hooks to follow Rules of Hooks)
  if (!currentUser) {
    return <DynamicCampusLoginPortal />;
  }

  // Dedicated Platform-Level Control Panel (Level 1)
  if (isPlatformSiteAdmin && adminViewMode === 'platform_control_panel') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
        {/* Platform Creator Workspace Bar */}
        <div className="max-w-7xl mx-auto mb-2 flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-slate-300">
              Platform Administration Workspace • Signed in as <strong className="text-white">{currentUser.name || currentUser.username}</strong> (Site Owner)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdminViewMode('campus_operations')}
              className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Inspect live Campus Operational Ledgers, Cash Books & Vouchers"
            >
              <span>Campus Operational Ledger View &rarr;</span>
            </button>
          </div>
        </div>

        <PlatformSiteAdminHub
          isStandalonePlatformView
          onSwitchToCampusView={() => setAdminViewMode('campus_operations')}
        />
      </div>
    );
  }

  // Dedicated Client Owner Management Panel (Level 2)
  if (isClientOwnerMainAdmin && clientViewMode === 'client_hub') {
    return (
      <ClientOwnerManagementHub
        onSwitchToCampusOperationalView={(campusId) => {
          if (campusId && setCurrentCampusId) {
            setCurrentCampusId(campusId);
          }
          setClientViewMode('campus_operations');
        }}
      />
    );
  }

  // Campus Operational View (Level 2 when inspecting branch, or Level 3/4 sub-campus users)
  return (
    <div>
      {isPlatformSiteAdmin && (
        <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border-b border-indigo-800/80 px-4 py-1.5 text-xs flex items-center justify-between text-indigo-200">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-white">Platform Site Admin:</span>
            <span>Auditing Campus Operations</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminViewMode('platform_control_panel')}
            className="px-2.5 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm"
          >
            &larr; Return to Platform Site Admin Control Panel
          </button>
        </div>
      )}

      {isClientOwnerMainAdmin && clientViewMode === 'campus_operations' && (
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 border-b border-indigo-700/80 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 text-indigo-100 shadow-md">
          {/* Organization Client Name Top Display */}
          <div className="flex items-center gap-3">
            {clientOrg?.logoUrl ? (
              <img
                src={clientOrg.logoUrl}
                alt={clientOrg.name}
                className="w-9 h-9 rounded-xl object-contain bg-white p-1 border border-indigo-400/50 shadow-md shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white shadow-md text-base">
                🏢
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-sm sm:text-base tracking-tight uppercase">
                  {clientOrg?.name || 'School Organization'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/90 text-purple-200 border border-purple-500/50 uppercase">
                  Level 2 Organization Owner
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Main Campus Admin • Managing strictly your own subordinate campuses ({mySubordinateCampuses.length} registered)
              </p>
            </div>
          </div>

          {/* Subordinate Campus Switcher & Hub Navigation */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-indigo-700/60 rounded-xl px-3 py-1.5 shadow-inner">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide">
                Subordinate Branch:
              </span>
              <select
                value={currentCampusId || mySubordinateCampuses[0]?.id || ''}
                onChange={(e) => {
                  if (setCurrentCampusId && e.target.value) {
                    setCurrentCampusId(e.target.value);
                  }
                }}
                className="bg-slate-800 border border-indigo-600/70 text-white font-bold text-xs rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-purple-400 focus:outline-hidden cursor-pointer"
                title="Select from your own subordinate campuses only"
              >
                {mySubordinateCampuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} {c.isMainCampus ? '(Main Campus)' : '(Subordinate Branch)'}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setClientViewMode('client_hub')}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Return to Level 2 Organization Management Hub"
            >
              <span>&larr; Return to Organization Management Hub</span>
            </button>
          </div>
        </div>
      )}

      <MainApp />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    initFirebaseCloudSync();
    installGlobalVisibilityHook();
    window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
    window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail as any;
    window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
    window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
    window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
    window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
    // Executive Dashboard is reserved exclusively for charts & institutional performance
    window.__APLUS_BULK_VOUCHER_HUB__ = undefined;
    window.__APLUS_SUGGESTIONS_HUB__ = undefined;
    window.__APLUS_DAILY_CASH_SUMMARY__ = DailyCashSummary;
    window.__APLUS_SITE_ADMIN_HUB__ = PlatformSiteAdminHub;
    window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
    window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
    window.__APLUS_PERMISSION_ENGINE__ = PermissionEngine;
    window.__APLUS_TOP_BAR__ = AplusTopBar;
    (window as any).__APLUS_CAMPUS_BUDGET_COMPARISON_CHART__ = CampusMonthlyBudgetExpenditureChart;
  }, []);

  return (
    <ErrorBoundary>
      <AccountingProvider>
        <ErrorBoundary>
          <InnerApp />
        </ErrorBoundary>
      </AccountingProvider>
    </ErrorBoundary>
  );
}
