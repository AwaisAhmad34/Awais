import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  RefreshCw,
  Upload,
  ShieldCheck,
  Printer,
  Banknote,
  LayoutGrid,
  BarChart3,
  CheckSquare,
  AlertTriangle,
  X,
  ArrowRight,
  Clock,
  WifiOff,
  HardDrive,
  Download,
  Search,
  Keyboard,
  QrCode,
  CalendarClock,
  Building,
  Lock,
  Unlock,
} from 'lucide-react';
import { useAccounting, ImportCategoryTab } from '../core/aplusEngine';
import {
  subscribeCloudSync,
  CloudSyncStats,
  pushMasterCloudSnapshot,
  pullMasterCloudSnapshot,
  fetchCashReconciliationsFromCloud,
} from '../services/firebaseSync';
import { SuperAdminImportModal } from './SuperAdminImportModal';
import { VoucherA4PrintStudioModal } from './PrintableVoucherA4Layout';
import { VoucherQRScannerAndRetrievalModal } from './VoucherQRCodeAndScanner';
import {
  subscribeMultiSchoolRegistry,
  getStoredMultiSchoolRegistry,
  saveStoredMultiSchoolRegistry,
  MultiSchoolRegistryState,
  PlatformRoleType,
} from './MultiSchoolAdminPanel';
import { NavigationPermissionGuard } from './NavigationPermissionGuard';
import { useTenantAuth } from '../context/TenantAuthContext';
import {
  subscribeVisibilityConfig,
  getStoredVisibilityConfig,
  resolveActiveProfileForUser,
  VisibilityAccessConfig,
} from './BulkVoucherAndAccessManager';
import {
  CertifiedCashCountRecord,
  getStoredCashReconciliations,
  subscribeCashReconciliationEvents,
  evaluateSevenDayCashReconciliationStatus,
  CASH_RECONCILIATION_STORAGE_KEY,
} from './PhysicalCashReconciliation';

interface AplusTopBarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export type ResolvedAuthPermissionLevel =
  | 'platform_super_admin'
  | 'school_client_admin'
  | 'campus_admin'
  | 'staff_or_viewer'
  | 'unauthenticated';

/**
 * Resolves the current user's effective navigation permission level directly from
 * the auth context (`currentUser`, `isSuperAdmin`) and synchronized tenant role registry.
 */
export function resolveAuthNavigationPermissionLevel(
  currentUser: any,
  isSuperAdmin: boolean,
  platformRole?: PlatformRoleType
): ResolvedAuthPermissionLevel {
  if (!currentUser) {
    return 'unauthenticated';
  }

  const rawAuthRole = String(currentUser.role || '').toLowerCase();
  const effectivePlatformRole = platformRole || 'platform_super_admin';

  if (
    (isSuperAdmin ||
      rawAuthRole === 'superadmin' ||
      rawAuthRole === 'platform_super_admin') &&
    effectivePlatformRole === 'platform_super_admin'
  ) {
    return 'platform_super_admin';
  }

  if (
    effectivePlatformRole === 'school_client_admin' &&
    (isSuperAdmin ||
      rawAuthRole === 'superadmin' ||
      rawAuthRole === 'admin' ||
      rawAuthRole === 'approver' ||
      rawAuthRole === 'school_client_admin')
  ) {
    return 'school_client_admin';
  }

  if (effectivePlatformRole === 'campus_admin' || rawAuthRole === 'campus_admin') {
    return 'campus_admin';
  }

  return 'staff_or_viewer';
}

/**
 * Robust Navigation Wrapper in AplusTopBar.tsx that reads the current user's role
 * from the auth context (`useAccounting()`) and conditionally hides or renders the
 * 'Platform Super Admin' and 'School Client Admin' navigation items based on permission level.
 */
export const AuthRoleNavigationWrapper: React.FC<{
  allowedLevels: ResolvedAuthPermissionLevel[];
  platformRoleOverride?: PlatformRoleType;
  children: React.ReactNode;
}> = ({ allowedLevels, platformRoleOverride, children }) => {
  const { currentUser, isSuperAdmin } = useAccounting();
  const { platformRole } = useTenantAuth();
  const level = resolveAuthNavigationPermissionLevel(
    currentUser,
    Boolean(isSuperAdmin),
    platformRoleOverride || platformRole
  );

  if (!allowedLevels.includes(level)) {
    return null;
  }

  return <>{children}</>;
};

export const AplusTopBar: React.FC<AplusTopBarProps> = ({
  activeTab,
  onNavigate,
}) => {
  const {
    isSuperAdmin,
    currentUser,
    currentCampusId,
    campuses,
    transactions,
    pettyCashTransactions,
    accountHeads,
    orgSettings,
    updateOrgSettings,
    exportSystemState,
    importSystemState,
  } = useAccounting();
  const [syncStats, setSyncStats] = useState<CloudSyncStats>({
    lastSyncedAt: null,
    status: 'connected',
    message: 'Firebase Cloud Ready',
  });
  const [busy, setBusy] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importInitialTab, setImportInitialTab] = useState<ImportCategoryTab>('coa');
  const [isA4StudioOpen, setIsA4StudioOpen] = useState(false);
  const [visConfig, setVisConfig] = useState<VisibilityAccessConfig>(() =>
    getStoredVisibilityConfig()
  );
  const [cashRecRecords, setCashRecRecords] = useState<CertifiedCashCountRecord[]>(() =>
    getStoredCashReconciliations()
  );
  const [isCashToastDismissed, setIsCashToastDismissed] = useState(false);
  const [justCertifiedRecord, setJustCertifiedRecord] =
    useState<CertifiedCashCountRecord | null>(null);

  // Campus Network Online/Offline & PWA Install State
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showIOSInstallGuide, setShowIOSInstallGuide] = useState(false);

  // Power-User Global Search & Keyboard Shortcuts Palette
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [schoolRegistry, setSchoolRegistry] = useState<MultiSchoolRegistryState>(() =>
    getStoredMultiSchoolRegistry()
  );

  useEffect(() => {
    return subscribeMultiSchoolRegistry(setSchoolRegistry);
  }, []);

  const activeSchoolAccount =
    schoolRegistry.institutes.find((i) => i.id === schoolRegistry.activeInstituteId) ||
    schoolRegistry.institutes[0];

  // Auto-open QR Scanner / Retrieval if URL has ?voucherId=... or ?voucherNo=...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('voucherId') || params.get('voucherNo')) {
        setIsQrScannerOpen(true);
      }
    } catch {}
  }, []);

  const triggerShortcutToast = (msg: string) => {
    setShortcutFeedback(msg);
    setTimeout(() => setShortcutFeedback(null), 2600);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+N or Alt+N -> New Voucher Entry
      if ((ctrlOrMeta && key === 'n') || (e.altKey && key === 'n')) {
        e.preventDefault();
        onNavigate('transaction');
        triggerShortcutToast('Shortcut Ctrl+N → Opened New Voucher Entry');
        setTimeout(() => {
          const firstInput = document.querySelector<HTMLInputElement>(
            '.suggestion-container input, input[placeholder*="Code" i], input[placeholder*="Narration" i]'
          );
          firstInput?.focus();
        }, 120);
        return;
      }

      // Ctrl+F or Ctrl+K or Alt+F -> Global Search / Focus Page Search
      if ((ctrlOrMeta && (key === 'f' || key === 'k')) || (e.altKey && key === 'f')) {
        e.preventDefault();
        const localSearch = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search" i]:not([data-global-search="true"]), input[type="search"]'
        );
        if (localSearch && !isGlobalSearchOpen) {
          localSearch.focus();
          localSearch.select();
          triggerShortcutToast('Shortcut Ctrl+F → Focused Search Filter (Press Ctrl+K for Global Search)');
          if (key === 'k') {
            setIsGlobalSearchOpen(true);
          }
        } else {
          setIsGlobalSearchOpen((prev) => !prev);
        }
        return;
      }

      // Ctrl+S or Ctrl+Enter -> Save Voucher or Save Petty Cash Entry
      if ((ctrlOrMeta && key === 's') || (ctrlOrMeta && e.key === 'Enter')) {
        if (activeTab === 'transaction' && window.__APLUS_TRIGGER_VOUCHER_SAVE__) {
          e.preventDefault();
          window.__APLUS_TRIGGER_VOUCHER_SAVE__();
          triggerShortcutToast('Shortcut Save → Triggered Voucher Save & Post');
          return;
        }
        if (activeTab === 'pettycash' && window.__APLUS_TRIGGER_PETTY_SAVE__) {
          e.preventDefault();
          window.__APLUS_TRIGGER_PETTY_SAVE__();
          triggerShortcutToast('Shortcut Save → Triggered Petty Cash Post');
          return;
        }
      }

      // Alt+P -> Petty Cash Entry
      if (e.altKey && key === 'p') {
        e.preventDefault();
        onNavigate('pettycash');
        triggerShortcutToast('Shortcut Alt+P → Opened Petty Cash Management');
        setTimeout(() => {
          const pcInput = document.querySelector<HTMLInputElement>('.pc-suggestion-box input');
          pcInput?.focus();
        }, 120);
        return;
      }

      // Alt+L -> All Transactions / Voucher Audit Ledger
      if (e.altKey && key === 'l') {
        e.preventDefault();
        onNavigate('alltransactions');
        triggerShortcutToast('Shortcut Alt+L → Opened All Vouchers & Audit Ledger');
        return;
      }

      // Alt+Q -> Scan / Retrieve Printed Voucher QR Code
      if (e.altKey && key === 'q') {
        e.preventDefault();
        setIsQrScannerOpen((prev) => !prev);
        triggerShortcutToast('Shortcut Alt+Q → Opened Voucher QR Code Scanner & Retrieval');
        return;
      }

      // Alt+R -> Recurring Monthly Expense Vouchers
      if (e.altKey && key === 'r') {
        e.preventDefault();
        onNavigate('recurringvouchers');
        triggerShortcutToast('Shortcut Alt+R → Opened Recurring Monthly Voucher Scheduler');
        return;
      }

      // Escape closes Global Search modal
      if (e.key === 'Escape' && isGlobalSearchOpen) {
        setIsGlobalSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab, isGlobalSearchOpen, onNavigate]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPwaInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOSDevice(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPwaPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwaApp = async () => {
    if (deferredPwaPrompt) {
      await deferredPwaPrompt.prompt();
      const { outcome } = await deferredPwaPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPwaInstalled(true);
        setDeferredPwaPrompt(null);
      }
    } else if (isIOSDevice) {
      setShowIOSInstallGuide(true);
    }
  };

  useEffect(() => {
    return subscribeCloudSync(setSyncStats);
  }, []);

  useEffect(() => {
    return subscribeVisibilityConfig(setVisConfig);
  }, []);

  useEffect(() => {
    const unsub = subscribeCashReconciliationEvents((records, justCertified) => {
      setCashRecRecords(records);
      if (justCertified) {
        setJustCertifiedRecord(justCertified);
        setIsCashToastDismissed(false);
        setTimeout(() => setJustCertifiedRecord(null), 6000);
      }
    });

    fetchCashReconciliationsFromCloud()
      .then((cloudList) => {
        if (Array.isArray(cloudList) && cloudList.length > 0) {
          setCashRecRecords((prev) => {
            const map = new Map<string, CertifiedCashCountRecord>();
            prev.forEach((r) => map.set(r.id, r));
            cloudList.forEach((r: any) => {
              if (r?.id && !map.has(r.id)) {
                map.set(r.id, r as CertifiedCashCountRecord);
              }
            });
            const merged = Array.from(map.values());
            try {
              localStorage.setItem(
                CASH_RECONCILIATION_STORAGE_KEY,
                JSON.stringify(merged)
              );
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    return unsub;
  }, []);

  // Re-show toast if user switches campus scope and that campus is overdue
  useEffect(() => {
    setIsCashToastDismissed(false);
  }, [currentCampusId]);

  const cashReconciliationAlert = evaluateSevenDayCashReconciliationStatus(
    currentCampusId,
    campuses,
    cashRecRecords
  );

  const activeProfile = resolveActiveProfileForUser(visConfig, currentUser, currentCampusId);
  const pendingCount = (transactions || []).filter(
    (t) => !t.status || t.status === 'Pending' || t.status === 'Draft'
  ).length;

  useEffect(() => {
    window.__OPEN_SUPER_ADMIN_IMPORT__ = (tab?: ImportCategoryTab) => {
      if (!isSuperAdmin) return;
      setImportInitialTab(tab || 'coa');
      setIsImportModalOpen(true);
    };
    return () => {
      delete window.__OPEN_SUPER_ADMIN_IMPORT__;
    };
  }, [isSuperAdmin]);

  const handleCloudPush = async () => {
    setBusy(true);
    try {
      const state = window.__APLUS_GET_CURRENT_STATE__?.() || exportSystemState('all');
      await pushMasterCloudSnapshot(state);
    } catch (e) {
      console.error('Cloud push error:', e);
    } finally {
      setBusy(false);
    }
  };

  const handleCloudPull = async () => {
    setBusy(true);
    try {
      await pullMasterCloudSnapshot();
    } catch (e) {
      console.error('Cloud pull error:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden aplus-nav-scroll">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap aplus-nav-scroll">
          {!isOnline || syncStats.status === 'offline' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/50 text-amber-300 font-bold text-[11px]">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Offline Mode · IndexedDB & Service Worker Cache Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {syncStats.status === 'syncing' || busy
                  ? 'Syncing Firestore & IndexedDB...'
                  : 'Cloud + IndexedDB Offline Cache Active'}
              </span>
            </span>
          )}

          <span
            className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-[11px]"
            title="Firebase enableIndexedDbPersistence & PWA Service Worker cache all vouchers, petty cash slips, COA, and assets locally for intermittent campus networks"
          >
            <HardDrive className="w-3 h-3 text-cyan-400" />
            <span>IndexedDB + SW Ready</span>
          </span>

          {isSuperAdmin && (
            <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={schoolRegistry.currentPlatformRole || 'platform_super_admin'}
                onChange={(e) => {
                  const nextRole = e.target.value as PlatformRoleType;
                  const next = {
                    ...schoolRegistry,
                    currentPlatformRole: nextRole,
                  };
                  setSchoolRegistry(next);
                  saveStoredMultiSchoolRegistry(next);
                }}
                className="bg-transparent text-[11px] font-bold text-amber-300 focus:outline-hidden cursor-pointer"
                title="Verify NavigationPermissionGuard across Platform Roles"
              >
                <option value="platform_super_admin" className="text-slate-900">
                  Role: Platform Super Admin
                </option>
                <option value="school_client_admin" className="text-slate-900">
                  Role: School Client Admin
                </option>
                <option value="campus_admin" className="text-slate-900">
                  Role: Campus Administrator
                </option>
                <option value="accountant" className="text-slate-900">
                  Role: Accountant
                </option>
                <option value="viewer" className="text-slate-900">
                  Role: Viewer / Auditor
                </option>
              </select>
            </div>
          )}

          {/* Auth-Context Role Navigation Wrapper: Platform Super Admin Entry Point */}
          <AuthRoleNavigationWrapper
            allowedLevels={['platform_super_admin']}
            platformRoleOverride={schoolRegistry.currentPlatformRole}
          >
            <NavigationPermissionGuard entryPoint="platform_super_admin">
              <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5">
                <Building className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={activeSchoolAccount?.id || ''}
                  onChange={(e) => {
                    const target = schoolRegistry.institutes.find(
                      (inst) => inst.id === e.target.value
                    );
                    if (!target) return;
                    const next = { ...schoolRegistry, activeInstituteId: target.id };
                    setSchoolRegistry(next);
                    saveStoredMultiSchoolRegistry(next);
                    if (updateOrgSettings) {
                      updateOrgSettings({
                        ...orgSettings,
                        schoolName: target.name,
                        tagline: target.tagline,
                      });
                    }
                  }}
                  className="bg-transparent text-[11px] font-bold text-amber-200 focus:outline-hidden cursor-pointer max-w-[190px] truncate"
                  title="Switch Active School or Institute Account (Platform Super Admin Only)"
                >
                  {schoolRegistry.institutes.map((inst) => (
                    <option key={inst.id} value={inst.id} className="text-slate-900">
                      {inst.code} — {inst.name} [{inst.status}]
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('multischool_admin')}
                className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'multischool_admin'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300'
                }`}
                title="Open Platform Super Admin Dashboard (/platform-admin) — Verified platform_super_admin Role"
              >
                <Building className="w-3 h-3" />
                <span>Platform Super Admin</span>
              </button>
            </NavigationPermissionGuard>
          </AuthRoleNavigationWrapper>

          {/* Auth-Context Role Navigation Wrapper: School Client Admin Entry Point */}
          <AuthRoleNavigationWrapper
            allowedLevels={['school_client_admin']}
            platformRoleOverride={schoolRegistry.currentPlatformRole}
          >
            <NavigationPermissionGuard entryPoint="school_client_admin">
              <button
                type="button"
                onClick={() => onNavigate('multischool_admin')}
                className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'multischool_admin'
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300'
                }`}
                title="Open Scoped School Client Admin Dashboard — Verified school_client_admin Role"
              >
                <Building className="w-3 h-3" />
                <span>School Client Admin</span>
              </button>
            </NavigationPermissionGuard>
          </AuthRoleNavigationWrapper>
          <span className="text-slate-300 truncate text-[11px] hidden lg:inline">
            {schoolRegistry.headerFooterConfig?.headerTopBarBanner ||
              orgSettings?.headerTopBarText ||
              orgSettings?.headerRightText ||
              syncStats.message ||
              orgSettings?.schoolName ||
              'Aplus School System Multi-Campus Voucher & Petty Cash Management System'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Scan Printed Voucher QR Code or Enter Unique Transaction ID for Quick Retrieval (Alt+Q)"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-200" />
            <span>Scan Voucher QR</span>
            <kbd className="hidden xl:inline-block px-1 py-0.2 rounded bg-emerald-900 border border-emerald-600 font-mono text-[9px] text-emerald-200">
              Alt+Q
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setIsGlobalSearchOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Power-User Global Search & Keyboard Shortcuts (Ctrl+F / Ctrl+N / Enter=Save)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>Search & Shortcuts</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-slate-900 border border-slate-600 font-mono text-[10px] text-amber-300">
              Ctrl+F / Ctrl+N
            </kbd>
          </button>

          {!isPwaInstalled && (deferredPwaPrompt || isIOSDevice) && (
            <button
              type="button"
              onClick={handleInstallPwaApp}
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Install this system as an offline-ready desktop or mobile app"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Offline App</span>
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => {
                const defaultTab: ImportCategoryTab =
                  activeTab === 'accounts'
                    ? 'coa'
                    : activeTab === 'transaction' || activeTab === 'alltransactions'
                    ? 'vouchers'
                    : activeTab === 'pettycash'
                    ? 'pettycash'
                    : activeTab === 'campuses'
                    ? 'campuses'
                    : activeTab === 'openingbalance'
                    ? 'openingbalance'
                    : 'coa';
                setImportInitialTab(defaultTab);
                setIsImportModalOpen(true);
              }}
              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Super Admin Exclusive: Import Chart of Accounts, Vouchers, Petty Cash, Campuses, Opening Balances & Complete System Backup"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import COA & All Data (Super Admin)</span>
            </button>
          )}

          <button
            onClick={handleCloudPush}
            disabled={busy}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Save complete ledger, vouchers, petty cash & campuses to Firebase Firestore across all browsers"
          >
            {busy ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Sync to Cloud</span>
          </button>

          <button
            onClick={handleCloudPull}
            disabled={busy}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Pull & refresh latest vouchers, COA, campuses, and petty cash from Firebase Cloud"
          >
            <CloudDownload className="w-3.5 h-3.5 text-blue-400" />
            <span>Load Cloud</span>
          </button>

          <button
            onClick={() => onNavigate('alltransactions')}
            className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'alltransactions'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300'
            }`}
            title="Open Bulk Pending Voucher Approval & Super Admin Role Visibility Matrix"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Bulk Approval & Role Access ({pendingCount} Pending)</span>
          </button>

          <button
            onClick={() => onNavigate('recurringvouchers')}
            className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'recurringvouchers'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300'
            }`}
            title="Schedule Recurring Monthly Expenses (Rent, Electricity, Utilities) with Automated Journal Entry Creation on Permission (Alt+R)"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Recurring Vouchers</span>
          </button>

          {(!activeProfile || activeProfile.widgets.showTopBarErpButton) && (
            <button
              onClick={() => onNavigate('erp_overview')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab.startsWith('erp_')
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-blue-300'
              }`}
              title="Open Modernized 360° School ERP Suite (Fees, Payroll, Procurement, Inventory, Budgeting & Recharts Analytics)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>360° Modern ERP</span>
              {activeTab.startsWith('erp_') && <CheckCircle2 className="w-3 h-3" />}
            </button>
          )}

          {(!activeProfile || activeProfile.widgets.showPettyCashChart) && (
            <button
              onClick={() => onNavigate('pettycash')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'pettycash'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300'
              }`}
              title="Open Petty Cash Management & Monthly Recharts Expense Breakdown by Category"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Petty Cash Analytics</span>
              {activeTab === 'pettycash' && <CheckCircle2 className="w-3 h-3" />}
            </button>
          )}

          {(!activeProfile || activeProfile.widgets.showTopBarCashReconButton) && (
            <button
              onClick={() => {
                setIsCashToastDismissed(false);
                onNavigate('cashreconciliation');
              }}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'cashreconciliation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : cashReconciliationAlert.isDue
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300'
              }`}
              title={cashReconciliationAlert.detailMessage}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Physical Cash Reconciliation</span>
              {cashReconciliationAlert.isDue ? (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-mono font-black text-[10px]">
                  7d Due
                </span>
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              )}
            </button>
          )}

          {(!activeProfile || activeProfile.widgets.showTopBarA4PrintButton) && (
            <button
              onClick={() => setIsA4StudioOpen(true)}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open A4 Print-Friendly Four-Voucher Layout Studio (BPV, BRV, CPV, CRV)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 Voucher Print Studio</span>
            </button>
          )}

          {(!activeProfile || activeProfile.widgets.showTopBarAuditTrailButton) && (
            <button
              onClick={() => onNavigate('activity')}
              className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300'
              }`}
              title="Open Forensic Secure Audit Trail (Voucher Creations, Edits & Deletions bound to User IDs & Timestamps)"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure Audit Trail</span>
              {activeTab === 'activity' && <CheckCircle2 className="w-3 h-3" />}
            </button>
          )}

          <button
            onClick={() => onNavigate('docs')}
            className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Aplus 49-Section Manual & Procedures</span>
            {activeTab === 'docs' && <CheckCircle2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Intermittent Campus Network / Offline Persistence Banner */}
      {(!isOnline || syncStats.status === 'offline') && (
        <div className="bg-amber-950 text-amber-100 border-b border-amber-700/80 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong className="text-white uppercase tracking-wide">
                Campus Network Intermittent / Offline Mode:
              </strong>{' '}
              Firebase <code className="font-mono text-amber-300">enableIndexedDbPersistence</code> & Service Worker are active. All vouchers, petty cash entries, and ledger updates are safely cached in local IndexedDB and will automatically sync to Cloud when connectivity returns.
            </span>
          </div>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-900 border border-amber-700 text-amber-200">
            IndexedDB Queue Ready
          </span>
        </div>
      )}

      {/* iOS Safari Install Guide Modal */}
      {showIOSInstallGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl border border-slate-200 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">
                Install Offline App on iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSInstallGuide(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
              <li>
                Tap the <strong>Share</strong> button in the Safari toolbar.
              </li>
              <li>
                Scroll down and select <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> to launch in standalone offline mode.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSInstallGuide(false)}
              className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      <VoucherA4PrintStudioModal
        isOpen={isA4StudioOpen}
        onClose={() => setIsA4StudioOpen(false)}
      />

      <VoucherQRScannerAndRetrievalModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onOpenInA4Studio={() => setIsA4StudioOpen(true)}
      />

      {/* CLOSED SCHOOL / INSTITUTE ACCOUNT LOCKOUT OVERLAY */}
      {activeSchoolAccount?.status === 'Closed' &&
        activeTab !== 'multischool_admin' &&
        activeTab !== 'campuses' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 print:hidden">
            <div className="w-full max-w-xl bg-white rounded-2xl border-2 border-rose-500 shadow-2xl overflow-hidden text-center">
              <div className="bg-rose-600 text-white px-6 py-5 flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-100">
                  Official Master Admin Account Closure Notice
                </span>
                <h2 className="text-lg font-black">
                  School / Institute Account Closed: {activeSchoolAccount.name} ({activeSchoolAccount.code})
                </h2>
              </div>

              <div className="p-6 space-y-4 text-xs text-slate-700">
                <p className="leading-relaxed">
                  Access to <strong>{activeSchoolAccount.name}</strong> has been officially closed and locked by the Master Administrator. Voucher entry, petty cash operations, and ledger modifications are disabled for this school/institute account.
                </p>
                {activeSchoolAccount.statusReason && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                    Closure Reason: {activeSchoolAccount.statusReason}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('multischool_admin')}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Building className="w-4 h-4 text-amber-400" />
                    <span>Open Multi-School Admin Panel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = schoolRegistry.institutes.map((inst) =>
                        inst.id === activeSchoolAccount.id
                          ? { ...inst, status: 'Active' as const, statusReason: 'Re-opened by Master Admin' }
                          : inst
                      );
                      const next = { ...schoolRegistry, institutes: updated };
                      setSchoolRegistry(next);
                      saveStoredMultiSchoolRegistry(next);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Re-Open / Activate This School Account Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Shortcut Action Feedback Pill */}
      {shortcutFeedback && (
        <div className="fixed top-14 right-5 z-50 bg-slate-900 text-white border border-amber-400/60 px-3.5 py-2 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 print:hidden">
          <Keyboard className="w-4 h-4 text-amber-400" />
          <span>{shortcutFeedback}</span>
        </div>
      )}

      {/* Power-User Global Search & Keyboard Shortcuts Modal (Ctrl+F / Ctrl+K) */}
      {isGlobalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/65 backdrop-blur-xs p-4 pt-14 print:hidden">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-3.5 bg-slate-900 text-white flex items-center gap-3">
              <Search className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="text"
                data-global-search="true"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search Vouchers, Petty Cash Slips, Chart of Accounts (157 heads), or jump to a module..."
                className="flex-1 bg-transparent text-white placeholder:text-slate-400 text-sm font-medium focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setIsGlobalSearchOpen(false)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Active Keyboard Shortcuts Reference Bar */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-700 uppercase flex items-center gap-1">
                  <Keyboard className="w-3.5 h-3.5 text-indigo-600" />
                  Power Shortcuts:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsGlobalSearchOpen(false);
                    onNavigate('transaction');
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:border-blue-500 font-semibold text-slate-800 cursor-pointer"
                >
                  <kbd className="font-mono font-bold text-blue-700">Ctrl+N</kbd> New Voucher
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsGlobalSearchOpen(false);
                    onNavigate('pettycash');
                  }}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:border-emerald-500 font-semibold text-slate-800 cursor-pointer"
                >
                  <kbd className="font-mono font-bold text-emerald-700">Alt+P</kbd> Petty Cash
                </button>
                <span className="px-2 py-0.5 rounded bg-white border border-slate-300 font-semibold text-slate-800">
                  <kbd className="font-mono font-bold text-amber-700">Enter / Ctrl+S</kbd> Save Entry
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-semibold text-emerald-900">
                  1-Click Account Pick Active
                </span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 p-2">
              {/* Matching Vouchers */}
              {(transactions || [])
                .filter((tx) => {
                  const q = globalSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (tx.voucherNo || '').toLowerCase().includes(q) ||
                    (tx.narration || '').toLowerCase().includes(q) ||
                    (tx.voucherType || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 6)
                .map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => {
                      setIsGlobalSearchOpen(false);
                      onNavigate('alltransactions');
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-blue-50 rounded-lg flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                          {tx.voucherNo}
                        </span>
                        <span className="truncate">{tx.narration}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {tx.date} · {tx.voucherType} · Status: {tx.status || 'Posted'}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      PKR {(tx.totalDebit || 0).toLocaleString()}
                    </span>
                  </button>
                ))}

              {/* Matching Petty Cash */}
              {(pettyCashTransactions || [])
                .filter((pc) => {
                  const q = globalSearchQuery.trim().toLowerCase();
                  if (!q) return false;
                  return (
                    (pc.voucherNo || '').toLowerCase().includes(q) ||
                    (pc.payee || '').toLowerCase().includes(q) ||
                    (pc.narration || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 5)
                .map((pc) => (
                  <button
                    key={pc.id}
                    type="button"
                    onClick={() => {
                      setIsGlobalSearchOpen(false);
                      onNavigate('pettycash');
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 rounded-lg flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                          {pc.voucherNo}
                        </span>
                        <span className="truncate">{pc.payee || pc.narration}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Petty Cash · {pc.date}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 shrink-0">
                      PKR {(pc.amount || 0).toLocaleString()}
                    </span>
                  </button>
                ))}

              {/* Matching Chart of Accounts Heads */}
              {(accountHeads || [])
                .filter((acc) => {
                  const q = globalSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    acc.code.toLowerCase().includes(q) ||
                    acc.name.toLowerCase().includes(q) ||
                    acc.category.toLowerCase().includes(q)
                  );
                })
                .slice(0, 8)
                .map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setIsGlobalSearchOpen(false);
                      onNavigate('accounts');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-[11px]">
                        {acc.code}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{acc.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {acc.category}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {isSuperAdmin && (
        <SuperAdminImportModal
          isOpen={isImportModalOpen}
          initialTab={importInitialTab}
          onClose={() => setIsImportModalOpen(false)}
        />
      )}

      {/* 7-DAY PHYSICAL CASH RECONCILIATION TOAST NOTIFICATION SYSTEM */}
      {justCertifiedRecord ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] bg-slate-900 text-white border-2 border-emerald-500 rounded-2xl shadow-2xl p-4 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                  7-Day Safe Count Certified
                </span>
                <button
                  type="button"
                  onClick={() => setJustCertifiedRecord(null)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-sm font-black text-white mt-1">
                Physical Cash Reconciliation Completed ({justCertifiedRecord.certificateNo})
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Certified physical safe count of{' '}
                <strong className="text-emerald-300 font-mono">
                  PKR {justCertifiedRecord.adjustedPhysicalTotal.toLocaleString()}
                </strong>{' '}
                ({justCertifiedRecord.status}). Next mandatory 7-day cash reconciliation due in 7 days.
              </p>
            </div>
          </div>
        </div>
      ) : (
        cashReconciliationAlert.isDue &&
        !isCashToastDismissed && (
          <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] bg-slate-950 text-white border-2 border-amber-400 rounded-2xl shadow-2xl p-4 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                      7-Day Treasury Policy Alert
                    </span>
                    <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {cashReconciliationAlert.neverPerformed
                        ? 'No Count in Last 7 Days'
                        : `${cashReconciliationAlert.daysSinceLast}d Since Last Count`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCashToastDismissed(true)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                    title="Dismiss reminder for now"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-sm font-black text-white mt-1.5">
                  {cashReconciliationAlert.headline}
                </h4>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {cashReconciliationAlert.detailMessage}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  {activeTab !== 'cashreconciliation' ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('cashreconciliation')}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Perform Physical Cash Count Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-400">
                      Complete & certify the denomination table below to clear this 7-day alert
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCashToastDismissed(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Remind Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </>
  );
};
