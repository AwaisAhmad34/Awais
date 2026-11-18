import { TenantAuthProvider } from './context/TenantAuthContext';
import {
  getVerifiedProfile,
  initAuthListener,
  getAuthResolutionState,
  logoutAccount,
} from './services/secureAuthentication';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
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
import { ErrorBoundary } from './components/ErrorBoundary';

installGlobalVisibilityHook();
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    localStorage.removeItem('ams_current_user_v5_clean');
    localStorage.removeItem('ams_impersonation_admin_v1');
    localStorage.removeItem('aplus_current_user');
  } catch {}
}
window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail as any;
window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
window.__APLUS_MODERN_ERP__ = ModernErpSuite;
window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
window.__APLUS_DAILY_CASH_SUMMARY__ = DailyCashSummary;
window.__APLUS_SITE_ADMIN_HUB__ = PlatformSiteAdminHub;
window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
window.__APLUS_PERMISSION_ENGINE__ = PermissionEngine;
window.__APLUS_TOP_BAR__ = AplusTopBar;
(window as any).__APLUS_CAMPUS_BUDGET_COMPARISON_CHART__ = CampusMonthlyBudgetExpenditureChart;

function InnerApp() {
  const { currentUser, isSuperAdmin, setCurrentCampusId, loginAsUser, logout, users, addUser, updateUser } = useAccounting();
  const [adminViewMode, setAdminViewMode] = useState<'platform_control_panel' | 'campus_operations'>('platform_control_panel');
  const [clientViewMode, setClientViewMode] = useState<'client_hub' | 'campus_operations'>('client_hub');
  const [isAuthResolving, setIsAuthResolving] = useState<boolean>(() => !getAuthResolutionState().resolved);
  const [, setAuthTick] = useState(0);

  const bridgeRef = useRef({ currentUser, loginAsUser, logout, users, addUser, updateUser, setCurrentCampusId });
  bridgeRef.current = { currentUser, loginAsUser, logout, users, addUser, updateUser, setCurrentCampusId };

  useEffect(() => {
    const unsubscribe = initAuthListener(
      (profile) => {
        const bridge = bridgeRef.current;
        if (!profile || !bridge.loginAsUser) {
          setIsAuthResolving(false);
          setAuthTick((t) => t + 1);
          if (bridge.currentUser && bridge.logout) {
            bridge.logout();
          }
          return;
        }
        const isSuper = profile.permissionLevel === 'level_1_platform_super_admin';
        let target = bridge.users?.find(
          (u: any) =>
            u.id === profile.id ||
            (profile.email && u.email?.toLowerCase() === profile.email.toLowerCase()) ||
            (profile.username && u.username?.toLowerCase() === profile.username.toLowerCase())
        );
        const resolvedUserObj = {
          id: target?.id || profile.id,
          uid: profile.uid,
          username: profile.username || target?.username || profile.email?.split('@')[0] || 'user',
          name: profile.name || target?.name || 'Campus Administrator',
          email: profile.email || target?.email || `${profile.username}@institution.edu.pk`,
          role: profile.role || target?.role || (isSuper ? 'level_1_platform_super_admin' : 'level_2_client_super_admin'),
          permissionLevel: profile.permissionLevel,
          isSuperAdmin: Boolean(isSuper || profile.isSuperAdmin),
          status: 'active',
          clientId: profile.clientId ?? target?.clientId ?? null,
          campusId: profile.campusId ?? target?.campusId ?? null,
          permittedCampusIds: profile.permittedCampusIds || target?.permittedCampusIds || ['all'],
          delegatedSubCampusIds: profile.delegatedCampusIds || profile.delegatedSubCampusIds || target?.delegatedSubCampusIds || [],
          allowedModules: profile.allowedModules || target?.allowedModules || ['all'],
          designation: profile.designation || target?.designation || profile.role,
          departmentalRole: profile.departmentalRole || target?.departmentalRole,
          readOnly: Boolean(profile.readOnly || target?.readOnly),
        };
        if (!target && bridge.addUser) {
          target = bridge.addUser(resolvedUserObj);
        } else if (target && bridge.updateUser) {
          bridge.updateUser(target.id, resolvedUserObj);
        }
        if (
          !isSuper &&
          resolvedUserObj.permissionLevel !== 'level_2_client_super_admin' &&
          resolvedUserObj.campusId &&
          resolvedUserObj.campusId !== 'all' &&
          bridge.setCurrentCampusId
        ) {
          bridge.setCurrentCampusId(resolvedUserObj.campusId);
        }
        const effectiveId = target?.id || resolvedUserObj.id;
        if (bridge.currentUser?.id !== effectiveId || bridge.currentUser?.permissionLevel !== resolvedUserObj.permissionLevel) {
          (bridge.loginAsUser as any)(effectiveId, isSuper, { ...resolvedUserObj, id: effectiveId });
        }
        setIsAuthResolving(false);
        setAuthTick((t) => t + 1);
      },
      (state) => {
        setIsAuthResolving(!state.resolved);
        setAuthTick((t) => t + 1);
      }
    );
    return () => unsubscribe?.();
  }, []);

  const verifiedProfile = getVerifiedProfile();

  const hadLegacyUserRef = useRef(false);
  useEffect(() => {
    if (currentUser) {
      hadLegacyUserRef.current = true;
      return;
    }
    if (!currentUser && verifiedProfile && hadLegacyUserRef.current) {
      hadLegacyUserRef.current = false;
      logoutAccount().catch(() => {});
    }
  }, [currentUser, verifiedProfile]);

  if (isAuthResolving && (!currentUser || !verifiedProfile)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 mx-auto rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">Verifying institutional session &amp; campus permissions...</p>
        </div>
      </div>
    );
  }

  // Strict Login Lockout: Never allow access to any panel without verified login
  if (!currentUser || !verifiedProfile) {
    return <DynamicCampusLoginPortal />;
  }

  // Hierarchy Level 1: Platform Super Admin (Site Owner) - Strictly registered Level 1 account ONLY
  const isPlatformSiteAdmin = Boolean(
    currentUser &&
    verifiedProfile &&
    !currentUser.clientId &&
    (currentUser.role === 'level_1_platform_super_admin' ||
     currentUser.permissionLevel === 'level_1_platform_super_admin' ||
     (currentUser.role === 'admin' && !currentUser.campusId && isSuperAdmin))
  );

  // Hierarchy Level 2: Main Campus Administrator (Client Owner)
  const isClientOwnerMainAdmin =
    currentUser.role === 'level_2_client_super_admin' ||
    (currentUser.clientId && currentUser.role?.includes('client_super_admin'));

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
        <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 border-b border-indigo-800/80 px-4 py-1.5 text-xs flex items-center justify-between text-indigo-200">
          <div className="flex items-center gap-2 font-mono">
            <span className="font-bold text-white">Client Owner:</span>
            <span>Viewing Branch Operations</span>
          </div>
          <button
            type="button"
            onClick={() => setClientViewMode('client_hub')}
            className="px-2.5 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm"
          >
            &larr; Return to Organization Management Hub
          </button>
        </div>
      )}

      <MainApp />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (getVerifiedProfile()) {
      initFirebaseCloudSync();
    }
    installGlobalVisibilityHook();
    window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
    window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail as any;
    window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
    window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
    window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
    window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
    window.__APLUS_MODERN_ERP__ = ModernErpSuite;
    window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
    window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
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
        <TenantAuthProvider>
          <ErrorBoundary>
            <InnerApp />
          </ErrorBoundary>
        </TenantAuthProvider>
      </AccountingProvider>
    </ErrorBoundary>
  );
}
