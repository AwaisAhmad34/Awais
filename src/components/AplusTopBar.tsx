import React, { useEffect, useState, useMemo } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  X,
  ArrowRight,
  Clock,
  WifiOff,
  Download,
  Search,
  Keyboard,
  Sparkles,
  User,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  Banknote,
} from 'lucide-react';
import { useAccounting, ImportCategoryTab, Transaction } from '../core/aplusEngine';
import { restoreLastDeletedAccount } from '../services/chartOfAccountsRecovery';
import {
  subscribeCloudSync,
  CloudSyncStats,
  pushMasterCloudSnapshot,
  pullMasterCloudSnapshot,
  fetchCashReconciliationsFromCloud,
  triggerInstantCloudSyncAndLoad,
} from '../services/firebaseSync';
import { SuperAdminImportModal } from './SuperAdminImportModal';
import { VoucherA4PrintStudioModal } from './PrintableVoucherA4Layout';
import { PlatformSiteAdminHub } from './PlatformSiteAdminHub';
import { ConfigurableApprovalMatrixModule } from './ConfigurableApprovalMatrixModule';
import {
  subscribeVisibilityConfig,
  getStoredVisibilityConfig,
  resolveActiveProfileForUser,
  VisibilityAccessConfig,
} from './BulkVoucherAndAccessManager';
import { DynamicCampusAuthModal } from './DynamicCampusAuthModal';
import { ExpenseCategorySuggesterWidget } from './ExpenseCategorySuggesterWidget';
import { CampusAccountHeadPermissionPanel } from './CampusAccountHeadPermissionPanel';
import { FullTransactionLedgerPdfExport } from './FullTransactionLedgerPdfExport';
import { PermissionEngine } from './PermissionEngine';
import {
  CertifiedCashCountRecord,
  getStoredCashReconciliations,
  subscribeCashReconciliationEvents,
  evaluateSevenDayCashReconciliationStatus,
  CASH_RECONCILIATION_STORAGE_KEY,
} from './PhysicalCashReconciliation';
import {
  getStoredSchoolClients,
  DEFAULT_CLIENT_MODULES,
  SchoolClientOrganization,
} from '../services/platformSiteAdminService';
import { DataMigrationControlCenter } from './DataMigrationControlCenter';
import { DeploymentReadinessHub } from './DeploymentReadinessHub';
import { SmartCommandBar } from './SmartCommandBar';
import { ExpressVoucherModal } from './ExpressVoucherModal';
import { ExpressPettyCashModal } from './ExpressPettyCashModal';
import { VoucherDetailModal } from './VoucherDetailModal';
import { isUserPermittedForModule, isUserReadOnlyRole } from '../services/rolePresets';

interface AplusTopBarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

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
    exportSystemState,
    importSystemState,
    addAccountHead,
    importOfficialAccountsHeads,
  } = useAccounting();
  const [syncStats, setSyncStats] = useState<CloudSyncStats>({
    lastSyncedAt: null,
    status: 'connected',
    message: 'Firebase Cloud Ready',
  });
  const [busy, setBusy] = useState(false);
  const [clientsVersion, setClientsVersion] = useState(0);

  useEffect(() => {
    const handleUpdated = () => setClientsVersion((v) => v + 1);
    window.addEventListener('aplus-clients-updated', handleUpdated);
    return () => window.removeEventListener('aplus-clients-updated', handleUpdated);
  }, []);
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
  const [isDeploymentHubOpen, setIsDeploymentHubOpen] = useState(false);

  // Power-User Global Search & Keyboard Shortcuts Palette
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const [isSuggesterModalOpen, setIsSuggesterModalOpen] = useState(false);
  const [isCampusAuthModalOpen, setIsCampusAuthModalOpen] = useState(false);
  const [isFullLedgerPdfOpen, setIsFullLedgerPdfOpen] = useState(false);
  const [isCampusAccountHeadAccessOpen, setIsCampusAccountHeadAccessOpen] = useState(false);
  const [isPermissionEngineOpen, setIsPermissionEngineOpen] = useState(false);
  const [isSiteAdminHubOpen, setIsSiteAdminHubOpen] = useState(false);
  const [isApprovalMatrixModalOpen, setIsApprovalMatrixModalOpen] = useState(false);
  const [isMigrationCenterOpen, setIsMigrationCenterOpen] = useState(false);
  const [selectedVoucherForDetail, setSelectedVoucherForDetail] = useState<Transaction | null>(null);
  const [isExpressVoucherOpen, setIsExpressVoucherOpen] = useState(false);
  const [isExpressPettyCashOpen, setIsExpressPettyCashOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aplus_sidebar_minimized') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const handleToggleEvent = (e: any) => {
      if (e.detail?.minimized !== undefined) {
        setIsSidebarMinimized(Boolean(e.detail.minimized));
      }
    };
    window.addEventListener('aplus-sidebar-toggle', handleToggleEvent);
    return () => window.removeEventListener('aplus-sidebar-toggle', handleToggleEvent);
  }, []);

  const handleToggleSidebar = () => {
    const next = !isSidebarMinimized;
    setIsSidebarMinimized(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aplus_sidebar_minimized', String(next));
      window.dispatchEvent(new CustomEvent('aplus-sidebar-toggle', { detail: { minimized: next } }));
      if (next) {
        document.body.classList.add('sidebar-minimized');
      } else {
        document.body.classList.remove('sidebar-minimized');
      }
    }
  };

  const triggerShortcutToast = (msg: string) => {
    setShortcutFeedback(msg);
    setTimeout(() => setShortcutFeedback(null), 2600);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+N or Alt+N -> New Voucher Entry (only if permitted & non-read-only)
      if ((ctrlOrMeta && key === 'n') || (e.altKey && key === 'n')) {
        if (isReadOnlyRole || !isModuleAllowed('transaction')) return;
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
        if (isReadOnlyRole) return;
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
        if (!isModuleAllowed('pettycash')) return;
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
        if (!isModuleAllowed('alltransactions')) return;
        e.preventDefault();
        onNavigate('alltransactions');
        triggerShortcutToast('Shortcut Alt+L → Opened All Vouchers & Audit Ledger');
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
  // Super Administration Account ONLY: Level 1 Platform Super Admin / Root Site Owner (no client attachment)
  const isPlatformSiteAdmin = Boolean(
    currentUser &&
    !currentUser.clientId &&
    (currentUser.role === 'level_1_platform_super_admin' ||
     currentUser.username?.toLowerCase() === 'admin' ||
     (currentUser.role === 'admin' && !currentUser.campusId && isSuperAdmin))
  );
  const isAuthorizedForCampusDb =
    isPlatformSiteAdmin ||
    isSuperAdmin ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'level_2_client_super_admin' ||
    currentUser?.role === 'level_3_main_campus_admin';

  const userClientId = currentUser?.clientId;
  const isClientOwnerMainAdmin = Boolean(
    currentUser &&
    (currentUser.role === 'level_2_client_super_admin' ||
     Boolean(currentUser.clientId && currentUser.role?.includes('client_super_admin')))
  );
  const effectiveClientId = userClientId || (isClientOwnerMainAdmin ? 'client-aplus' : null);

  const clientOrg = useMemo((): (SchoolClientOrganization | { id: string; name: string; code: string; logoUrl?: string }) | null => {
    if (!effectiveClientId) return null;
    const allClients = getStoredSchoolClients();
    const found = allClients.find((c) => c.id === effectiveClientId);
    if (found) return found;
    if (effectiveClientId === 'client-apex') {
      return { id: 'client-apex', name: 'Apex School System', code: 'APEX', logoUrl: undefined };
    }
    return { id: 'client-aplus', name: 'Aplus School System', code: 'APLUS', logoUrl: undefined };
  }, [effectiveClientId, clientsVersion]);

  const clientAllowedModules: string[] | null = useMemo(() => {
    if (!userClientId) return null;
    const allClients = getStoredSchoolClients();
    const cl = allClients.find((item) => item.id === userClientId);
    return cl?.enabledModules || DEFAULT_CLIENT_MODULES;
  }, [userClientId]);

  const isReadOnlyRole = isUserReadOnlyRole(currentUser);

  const isModuleAllowed = (moduleId: string) => {
    if (clientAllowedModules && !clientAllowedModules.includes(moduleId)) {
      return false;
    }
    return isUserPermittedForModule(moduleId, currentUser, activeProfile?.modules || null);
  };

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

  // Keep latest tool action handlers synchronized for Sidebar tool dispatchers
  const toolDispatchRef = React.useRef<(toolId: string) => void>(() => {});
  toolDispatchRef.current = (toolId: string) => {
    switch (toolId) {
      case 'express_voucher':
        if (!isReadOnlyRole && isModuleAllowed('transaction')) {
          setIsExpressVoucherOpen(true);
        }
        break;
      case 'express_petty_cash':
        if (!isReadOnlyRole && isModuleAllowed('pettycash')) {
          setIsExpressPettyCashOpen(true);
        }
        break;
      case 'global_search':
        setIsGlobalSearchOpen(true);
        break;
      case 'import_coa':
        if (isSuperAdmin) {
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
        }
        break;
      case 'deployment_ready':
        setIsDeploymentHubOpen(true);
        break;
      case 'cloud_migration':
        if (isSuperAdmin || isPlatformSiteAdmin) {
          setIsMigrationCenterOpen(true);
        }
        break;
      case 'sync_cloud':
        if (isPlatformSiteAdmin) {
          void handleCloudPush();
        }
        break;
      case 'load_cloud':
        if (isPlatformSiteAdmin) {
          void handleCloudPull();
        }
        break;
      case 'full_ledger_pdf':
        setIsFullLedgerPdfOpen(true);
        break;
      case 'campus_head_access':
        if (isPlatformSiteAdmin) {
          setIsCampusAccountHeadAccessOpen(true);
        }
        break;
      case 'permission_engine':
        if (isPlatformSiteAdmin) {
          setIsPermissionEngineOpen(true);
        }
        break;
      case 'ai_suggester':
        if (isPlatformSiteAdmin && isModuleAllowed('ai_suggester')) {
          setIsSuggesterModalOpen(true);
        }
        break;
      case 'site_admin_hub':
        if (isPlatformSiteAdmin) {
          setIsSiteAdminHubOpen(true);
        }
        break;
      case 'approval_matrix':
        if (isPlatformSiteAdmin && isModuleAllowed('approval_matrix')) {
          setIsApprovalMatrixModalOpen(true);
        }
        break;
      case 'campus_db_auth':
        if (isPlatformSiteAdmin && isAuthorizedForCampusDb) {
          setIsCampusAuthModalOpen(true);
        }
        break;
      case 'a4_print_studio':
        if (isModuleAllowed('reports')) {
          setIsA4StudioOpen(true);
        }
        break;
      case 'restore_deleted_coa':
        if (isPlatformSiteAdmin) {
          const res = restoreLastDeletedAccount({
            accountHeads,
            addAccountHead,
            importOfficialAccountsHeads,
          });
          triggerShortcutToast(res.message);
        }
        break;
      case 'install_pwa':
        void handleInstallPwaApp();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const opener = (toolId: string) => toolDispatchRef.current(toolId);
    const onCustomEvent = (ev: Event) => {
      const id = (ev as CustomEvent<{ id?: string }>).detail?.id;
      if (id) opener(id);
    };
    (window as any).__APLUS_OPEN_TOOL__ = opener;
    window.addEventListener('aplus-open-tool', onCustomEvent);
    return () => {
      delete (window as any).__APLUS_OPEN_TOOL__;
      window.removeEventListener('aplus-open-tool', onCustomEvent);
    };
  }, []);

  useEffect(() => {
    const meta = {
      pendingCount,
      cashReconDue: cashReconciliationAlert.isDue,
      busy,
      isPlatformSiteAdmin,
      isAuthorizedForCampusDb,
      isReadOnlyRole,
    };
    (window as any).__APLUS_TOOL_META__ = meta;
    window.dispatchEvent(new CustomEvent('aplus-tool-meta', { detail: meta }));
  }, [
    pendingCount,
    cashReconciliationAlert.isDue,
    busy,
    isPlatformSiteAdmin,
    isAuthorizedForCampusDb,
    isReadOnlyRole,
  ]);

  return (
    <>
      <div className="bg-slate-950 text-white border-b border-slate-800 px-4 sm:px-5 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 text-xs print:hidden">
        {/* Left Zone: Sidebar Toggle + Cloud Status + Tenant/Campus Context */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <button
            type="button"
            onClick={handleToggleSidebar}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer shrink-0"
            title={isSidebarMinimized ? 'Expand side navigation bar' : 'Minimize side navigation bar'}
            aria-label={isSidebarMinimized ? 'Expand side navigation bar' : 'Minimize side navigation bar'}
          >
            {isSidebarMinimized ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {!isOnline || syncStats.status === 'offline' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold text-[11px] whitespace-nowrap">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline</span>
            </span>
          ) : syncStats.status === 'connecting' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 font-semibold text-[11px] whitespace-nowrap">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>Connecting...</span>
            </span>
          ) : syncStats.status === 'synchronizing' || busy ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 font-semibold text-[11px] whitespace-nowrap">
              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
              <span>Syncing...</span>
            </span>
          ) : syncStats.status === 'saved_locally_pending' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-amber-300 font-semibold text-[11px] whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Pending Sync</span>
            </span>
          ) : syncStats.status === 'conflict' || syncStats.status === 'sync_failed' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-300 font-semibold text-[11px] whitespace-nowrap">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{syncStats.status === 'conflict' ? 'Sync Conflict' : 'Sync Failed'}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                triggerInstantCloudSyncAndLoad().finally(() => setBusy(false));
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              title="Auto-Sync active. Click to sync & refresh from cloud now."
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cloud Synced</span>
              {(syncStats.lastCloudLoadAt || syncStats.lastSyncedAt) && (
                <span className="hidden xl:inline text-[10px] text-emerald-400/80 font-mono tabular-nums font-normal">
                  {new Date(syncStats.lastCloudLoadAt || syncStats.lastSyncedAt || '').toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </button>
          )}

          {(clientOrg || orgSettings?.schoolName) && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300 text-[11px] font-medium truncate max-w-[240px]">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate font-semibold text-white">
                {clientOrg?.name || orgSettings?.schoolName}
              </span>
              {currentCampusId && currentCampusId !== 'all' && (
                <span className="text-[10px] font-mono text-indigo-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded shrink-0">
                  {campuses.find((c) => c.id === currentCampusId)?.code || currentCampusId}
                </span>
              )}
            </div>
          )}

          {currentUser && (
            <div className="hidden md:flex items-center gap-1.5 text-slate-300 text-[11px] border-l border-slate-800 pl-3 whitespace-nowrap">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-white">{currentUser.name}</span>
              <span className="text-slate-400 text-[10px]">({currentUser.role || 'Staff'})</span>
            </div>
          )}
        </div>

        {/* Center Zone: Global Command Search */}
        <div className="w-full lg:w-auto lg:flex-1 lg:max-w-md min-w-[200px]">
          <SmartCommandBar
            onNavigate={onNavigate}
            onOpenExpressVoucher={() => setIsExpressVoucherOpen(true)}
            onOpenExpressPettyCash={() => setIsExpressPettyCashOpen(true)}
            onSelectVoucher={(voucher) => setSelectedVoucherForDetail(voucher)}
          />
        </div>

        {/* Right Zone: Minimal Quick Actions (All modules & admin tools are organized in the Sidebar) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {!isPwaInstalled && (deferredPwaPrompt || isIOSDevice) && (
            <button
              type="button"
              onClick={handleInstallPwaApp}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Install offline desktop/mobile app"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsGlobalSearchOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title="Power-User Global Search & Keyboard Shortcuts (Ctrl+F / Ctrl+N)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          {!isReadOnlyRole && isModuleAllowed('transaction') && (
            <button
              type="button"
              onClick={() => setIsExpressVoucherOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              title="Open Express Voucher overlay for rapid entry (Alt+N)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Express Voucher</span>
            </button>
          )}
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
                aria-label="Close modal"
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ESC</span>
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

      {/* Dynamic Campus Credentials & DB Auth Modal */}
      <DynamicCampusAuthModal
        isOpen={isCampusAuthModalOpen}
        onClose={() => setIsCampusAuthModalOpen(false)}
        onSelectCampusLogin={(campusId) => {
          setIsCampusAuthModalOpen(false);
          onNavigate('dashboard');
        }}
      />

      {/* Auto Expense Category Suggester Modal */}
      {isSuggesterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white">
                  Automatic Expense Category Suggester & Pattern Learner
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSuggesterModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              <ExpenseCategorySuggesterWidget
                embedded
                onApplyCategory={() => {
                  setIsSuggesterModalOpen(false);
                  onNavigate('alltransactions');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Full Transaction Ledger Print-Ready PDF Export Studio Modal */}
      {isFullLedgerPdfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-1">
              <FullTransactionLedgerPdfExport
                embedded
                onClose={() => setIsFullLedgerPdfOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Campus Account Head Access & 5-Tier RBAC Governance Modal */}
      {isCampusAccountHeadAccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-1">
              <CampusAccountHeadPermissionPanel
                embedded
                onClose={() => setIsCampusAccountHeadAccessOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Centralized Permission Engine Modal (Role Assignments & Action Matrix Enforcement) */}
      {isPermissionEngineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden">
            <div className="overflow-y-auto flex-1">
              <PermissionEngine
                embedded
                onClose={() => setIsPermissionEngineOpen(false)}
                onNavigateToAuditTrail={() => {
                  setIsPermissionEngineOpen(false);
                  onNavigate('activity');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Platform Site Admin Hub Modal - ONLY accessible for Super Administration account */}
      {isSiteAdminHubOpen && isPlatformSiteAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-7xl h-[94vh] max-h-[96vh] flex flex-col overflow-hidden">
            <PlatformSiteAdminHub
              onClose={() => setIsSiteAdminHubOpen(false)}
              onNavigate={(tab) => {
                setIsSiteAdminHubOpen(false);
                onNavigate(tab);
              }}
            />
          </div>
        </div>
      )}

      {/* Configurable Approval Matrix Modal */}
      {isApprovalMatrixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-y-auto">
            <ConfigurableApprovalMatrixModule onClose={() => setIsApprovalMatrixModalOpen(false)} />
          </div>
        </div>
      )}

      {/* Multi-Client Persistent Cloud Migration Center */}
      <DataMigrationControlCenter
        isOpen={isMigrationCenterOpen}
        onClose={() => setIsMigrationCenterOpen(false)}
      />

      {/* Express Voucher Rapid Entry Overlay */}
      <ExpressVoucherModal
        isOpen={isExpressVoucherOpen}
        onClose={() => setIsExpressVoucherOpen(false)}
        onVoucherCreated={(voucher) => setSelectedVoucherForDetail(voucher)}
      />

      {/* Express Petty Cash Expense Slip Overlay */}
      <ExpressPettyCashModal
        isOpen={isExpressPettyCashOpen}
        onClose={() => setIsExpressPettyCashOpen(false)}
      />

      {/* Voucher Detail Modal for 1-Click Smart Jump & Inspect */}
      <VoucherDetailModal
        voucher={selectedVoucherForDetail}
        campuses={campuses}
        isOpen={Boolean(selectedVoucherForDetail)}
        onClose={() => setSelectedVoucherForDetail(null)}
        onNavigateToLedger={(voucherNo) => {
          setSelectedVoucherForDetail(null);
          onNavigate('alltransactions');
        }}
      />
    </>
  );
};
