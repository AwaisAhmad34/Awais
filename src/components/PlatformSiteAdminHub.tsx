import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  KeyRound,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck,
  UserX,
  Clock,
  Fingerprint,
  Check,
  AlertCircle,
  HelpCircle,
  Scale,
  LayoutGrid,
  Database,
  CloudUpload,
  CloudDownload,
  Settings,
  Bell,
  Download,
  Printer,
  FileCheck2,
  Banknote,
  RotateCcw,
  Activity,
  Globe,
  Radio,
  FolderTree,
  ShieldAlert,
  Server,
  Zap,
  UserPlus,
  LogOut,
  Edit3,
  Trash2,
} from 'lucide-react';
import { useAccounting, Campus, AccountHead, Transaction } from '../core/aplusEngine';
import {
  SchoolClientOrganization,
  ExtendedCampusNode,
  PlatformSystemSettings,
  PlatformAuditSecurityEvent,
  getStoredSchoolClients,
  saveStoredSchoolClients,
  syncSchoolClientsToCloud,
  getStoredPlatformSettings,
  saveStoredPlatformSettings,
  syncPlatformSettingsToCloud,
  getStoredPlatformAuditLogs,
  recordSiteAdminSecurityEvent,
  validateCampusHierarchy,
  isAccountCodeReferencedInTransactions,
  generateNextChildAccountCode,
  resolveUserCampusDataScope,
  DEFAULT_PLATFORM_SETTINGS,
  PLATFORM_CLIENT_MODULES,
  DEFAULT_CLIENT_MODULES,
} from '../services/platformSiteAdminService';
import {
  PermissionLevel,
  DepartmentalStaffRole,
  HierarchicalRbacMasterConfig,
  getStoredHierarchicalRbacConfig,
  saveStoredHierarchicalRbacConfig,
  syncHierarchicalRbacToCloud,
} from '../services/campusPermissionEngine';
import {
  generateDynamicPassword,
  createDynamicCampusCredential,
  saveCampusCredentialToCloud,
} from '../services/campusAuthSync';
import { pushMasterCloudSnapshot } from '../services/firebaseSync';
import { ConfigurableApprovalMatrixModule } from './ConfigurableApprovalMatrixModule';
import { GlobalRecycleBinModule } from './GlobalRecycleBinModule';
import { GlobalRecordSearchModule } from './GlobalRecordSearchModule';
import { PermissionEngine } from './PermissionEngine';
import { BulkVoucherAndAccessManager } from './BulkVoucherAndAccessManager';
import { ExpenseCategorySuggesterWidget } from './ExpenseCategorySuggesterWidget';
import { MultiFormatReportsHub } from './MultiFormatReportsHub';
import { SecureAuditTrail } from './SecureAuditTrail';
import { getStoredRecycleBinRecords, softDeleteRecord } from '../services/globalRecoveryService';
import {
  SubCampusHierarchyView,
  PettyCashImprestView,
  DatabaseHubView,
  CloudSyncCenterView,
  OfflineQueueView,
  SecuritySessionsView,
  SystemConfigView,
  IntegrationsApiView,
  HealthMonitorView,
  ServiceWorkerPwaView,
  MaintenanceReleaseView,
} from './PlatformAdminExtendedModules';
import { ClientFinancialReportsPermissionsManager } from './ClientFinancialReportsPermissionsManager';
import { SystemUserActivityWidget } from './SystemUserActivityWidget';
import { DeploymentReadinessHub } from './DeploymentReadinessHub';

export type PlatformAdminNavSection =
  | '01_dashboard'
  | 'user_activity_telemetry'
  | '02_clients'
  | '03_main_campuses'
  | '04_sub_campuses'
  | '05_users'
  | '06_login_roles'
  | '07_permissions'
  | '08_approval_matrix'
  | '09_database_hub'
  | '10_cloud_sync'
  | '11_offline_indexeddb'
  | '12_service_worker'
  | '13_backup_dr'
  | '14_recycle_bin'
  | '15_chart_of_accounts'
  | '16_voucher_mgmt'
  | '17_petty_cash'
  | '18_ai_suggester'
  | '19_financial_reports'
  | 'financial_reports_permissions'
  | '20_audit_logs'
  | '21_security_sessions'
  | '22_system_config'
  | '23_integrations'
  | '24_health_monitor'
  | '25_maintenance_release'
  | 'global_search'
  // Backward compatibility with legacy keys
  | '03_campuses'
  | '04_users'
  | '05_roles_permissions'
  | '06_modules'
  | '07_account_heads'
  | '08_voucher_controls'
  | '09_consolidated_reports'
  | '10_audit_security'
  | '11_notifications'
  | '12_backup_settings'
  | '13_recycle_bin'
  | '14_global_search';

export const PlatformSiteAdminHub: React.FC<{
  onNavigate?: (tab: string) => void;
  onClose?: () => void;
  defaultSection?: PlatformAdminNavSection;
  onSwitchToCampusView?: () => void;
  isStandalonePlatformView?: boolean;
}> = ({
  onNavigate,
  onClose,
  defaultSection = '01_dashboard',
  onSwitchToCampusView,
  isStandalonePlatformView = false,
}) => {
  const {
    campuses,
    addCampus,
    updateCampus,
    deleteCampus,
    users,
    addUser,
    updateUser,
    accountHeads,
    addAccountHead,
    updateAccountHead,
    deleteAccountHead,
    transactions,
    pettyCashTransactions,
    currentUser,
    isSuperAdmin,
    orgSettings,
    exportSystemState,
    logout,
  } = useAccounting();

  const [activeSection, setActiveSection] = useState<PlatformAdminNavSection>(defaultSection);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [clients, setClients] = useState<SchoolClientOrganization[]>(() => getStoredSchoolClients());
  const [settings, setSettings] = useState<PlatformSystemSettings>(() => getStoredPlatformSettings());
  const [auditLogs, setAuditLogs] = useState<PlatformAuditSecurityEvent[]>(() =>
    getStoredPlatformAuditLogs()
  );
  const [rbacConfig, setRbacConfig] = useState<HierarchicalRbacMasterConfig>(() =>
    getStoredHierarchicalRbacConfig(campuses, accountHeads)
  );

  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const triggerToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setFeedbackNotice({ type, message });
    setTimeout(() => setFeedbackNotice(null), 4500);
  };

  const [reportsSubTab, setReportsSubTab] = useState<'permissions' | 'viewer'>('permissions');
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  // --------------------------------------------------------------------------
  // SECTION 02: CLIENTS & ORGANIZATIONS STATE
  // --------------------------------------------------------------------------
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientFormId, setClientFormId] = useState<string | null>(null);
  const [clientFormName, setClientFormName] = useState('');
  const [clientFormCode, setClientFormCode] = useState('');
  const [clientFormTier, setClientFormTier] = useState<'Starter' | 'Professional' | 'Enterprise'>('Enterprise');
  const [clientFormContact, setClientFormContact] = useState('');
  const [clientFormEmail, setClientFormEmail] = useState('');
  const [clientFormPhone, setClientFormPhone] = useState('');
  const [clientFormMaxCampuses, setClientFormMaxCampuses] = useState('10');
  const [clientFormMaxUsers, setClientFormMaxUsers] = useState('40');
  const [clientFormRegisterMainCampus, setClientFormRegisterMainCampus] = useState(true);
  const [clientFormMainCampusName, setClientFormMainCampusName] = useState('');
  const [clientFormMainCampusCode, setClientFormMainCampusCode] = useState('');
  const [clientFormMainCampusCity, setClientFormMainCampusCity] = useState('');
  const [clientFormMainCampusFloat, setClientFormMainCampusFloat] = useState('50000');
  const [clientFormMainCampusPassword, setClientFormMainCampusPassword] = useState('campus');
  const [clientFormLogoUrl, setClientFormLogoUrl] = useState('');

  // --------------------------------------------------------------------------
  // SECTION 03: CAMPUS HIERARCHY STATE
  // --------------------------------------------------------------------------
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
  const [newCampusClientId, setNewCampusClientId] = useState<string>('');
  const [targetCampusForParent, setTargetCampusForParent] = useState<string>('');
  const [selectedParentId, setSelectedParentId] = useState<string>('none');
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [newCampusName, setNewCampusName] = useState('');
  const [newCampusCode, setNewCampusCode] = useState('');
  const [newCampusCity, setNewCampusCity] = useState('Gujranwala');
  const [newCampusAccountant, setNewCampusAccountant] = useState('');
  const [newCampusPassword, setNewCampusPassword] = useState('');
  const [newCampusFloat, setNewCampusFloat] = useState('35000');
  const [newCampusParentId, setNewCampusParentId] = useState<string>('none');

  // Campus Edit Modal State
  const [editingCampus, setEditingCampus] = useState<ExtendedCampusNode | null>(null);
  const [editCampusName, setEditCampusName] = useState('');
  const [editCampusCode, setEditCampusCode] = useState('');
  const [editCampusCity, setEditCampusCity] = useState('');
  const [editCampusAccountant, setEditCampusAccountant] = useState('');
  const [editCampusFloat, setEditCampusFloat] = useState('35000');
  const [editCampusParentId, setEditCampusParentId] = useState<string>('none');
  const [editCampusStatus, setEditCampusStatus] = useState<'active' | 'inactive'>('active');
  const [editCampusLoginEnabled, setEditCampusLoginEnabled] = useState(true);

  // Campus Delete Confirmation State
  const [deletingCampus, setDeletingCampus] = useState<ExtendedCampusNode | null>(null);

  // Client Module Governance State
  const [managingModulesClient, setManagingModulesClient] = useState<SchoolClientOrganization | null>(null);
  const [clientSelectedModules, setClientSelectedModules] = useState<string[]>([]);

  // --------------------------------------------------------------------------
  // SECTION 04: USERS & LOGIN ACCOUNTS STATE
  // --------------------------------------------------------------------------
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedUserToEdit, setSelectedUserToEdit] = useState<any | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormUsername, setUserFormUsername] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<string>('Accountant');
  const [userFormCampusId, setUserFormCampusId] = useState<string>(campuses[0]?.id || '');
  const [userFormLevel, setUserFormLevel] = useState<PermissionLevel>('level_4_sub_campus_admin');
  const [userFormDelegatedSubCampuses, setUserFormDelegatedSubCampuses] = useState<string[]>([]);

  // --------------------------------------------------------------------------
  // SECTION 07: ACCOUNT HEADS & CODE CONFIGURATION STATE
  // --------------------------------------------------------------------------
  const [accountSearchQuery, setAccountSearchQuery] = useState('');
  const [parentAccountSelect, setParentAccountSelect] = useState<string>('1001');
  const [suggestedChildCode, setSuggestedChildCode] = useState<string>('');
  const [childAccountName, setChildAccountName] = useState<string>('');
  const [childAccountCategory, setChildAccountCategory] = useState<'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'>('Expense');

  // Compute suggested child code when parent account is selected
  useEffect(() => {
    if (parentAccountSelect) {
      const code = generateNextChildAccountCode(parentAccountSelect, accountHeads);
      setSuggestedChildCode(code);
    }
  }, [parentAccountSelect, accountHeads]);

  // --------------------------------------------------------------------------
  // DEDUPLICATED USERS (Defensive deduplication by unique ID and Username)
  // --------------------------------------------------------------------------
  const deduplicatedUsers = useMemo(() => {
    const seenIds = new Set<string>();
    const seenUsernames = new Set<string>();
    const result: typeof users = [];

    for (const u of users || []) {
      if (!u) continue;
      const idKey = u.id ? String(u.id).trim() : '';
      const nameKey = u.username ? u.username.toLowerCase().trim() : '';

      if (idKey && seenIds.has(idKey)) continue;
      if (nameKey && seenUsernames.has(nameKey)) continue;

      if (idKey) seenIds.add(idKey);
      if (nameKey) seenUsernames.add(nameKey);
      result.push(u);
    }
    return result;
  }, [users]);

  // --------------------------------------------------------------------------
  // STATS & AGGREGATIONS FOR DASHBOARD
  // --------------------------------------------------------------------------
  const dashboardStats = useMemo(() => {
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.status === 'active').length;
    const totalCampuses = campuses.length;
    const mainCampuses = campuses.filter((c: any) => c.isMainCampus || !c.parentCampusId).length;
    const subCampuses = totalCampuses - mainCampuses;
    const totalUsers = deduplicatedUsers.length;
    const totalTx = transactions.length;
    const totalPetty = pettyCashTransactions.length;
    const pendingTx = transactions.filter((t) => t.status === 'Pending').length;
    const totalVolume = transactions.reduce((sum, t) => sum + (Number(t.totalDebit) || 0), 0);
    const criticalAuditCount = auditLogs.filter((a) => a.severity === 'critical' || a.severity === 'high').length;

    return {
      totalClients,
      activeClients,
      totalCampuses,
      mainCampuses,
      subCampuses,
      totalUsers,
      totalTx,
      totalPetty,
      pendingTx,
      totalVolume,
      criticalAuditCount,
    };
  }, [clients, campuses, users, transactions, pettyCashTransactions, auditLogs]);

  // --------------------------------------------------------------------------
  // CLIENT HANDLERS
  // --------------------------------------------------------------------------
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormName.trim() || !clientFormCode.trim()) {
      triggerToast('error', 'Client name and identifier code are required.');
      return;
    }

    const now = new Date().toISOString();
    let updatedList: SchoolClientOrganization[];

    if (clientFormId) {
      // Edit existing
      updatedList = clients.map((c) =>
        c.id === clientFormId
          ? {
              ...c,
              name: clientFormName.trim(),
              code: clientFormCode.trim().toUpperCase(),
              tier: clientFormTier,
              logoUrl: clientFormLogoUrl.trim() || undefined,
              contactPerson: clientFormContact.trim(),
              contactEmail: clientFormEmail.trim(),
              contactPhone: clientFormPhone.trim(),
              maxCampuses: Math.max(1, Number(clientFormMaxCampuses) || 5),
              maxUsers: Math.max(1, Number(clientFormMaxUsers) || 20),
              updatedAt: now,
            }
          : c
      );
      recordSiteAdminSecurityEvent({
        actorName: currentUser?.name || 'Platform Site Admin',
        actorRole: 'Level 1 Platform Creator',
        severity: 'medium',
        category: 'CLIENT_MANAGEMENT',
        action: 'UPDATE_CLIENT_ORGANIZATION',
        targetEntity: 'SchoolClientOrganization',
        targetId: clientFormId,
        details: `Updated client organization '${clientFormName.trim()}' (${clientFormCode.trim().toUpperCase()}).`,
      });
      triggerToast('success', `Client organization '${clientFormName.trim()}' updated!`);
    } else {
      // New Client Registration
      const cleanCode = clientFormCode.trim().toUpperCase();
      const newId = `client-${cleanCode.toLowerCase()}-${Date.now().toString(36).slice(2, 6)}`;
      let designatedMainCampusId = campuses[0]?.id || 'campus-main';

      // Automatically register the Primary Main Campus against this client organization
      if (clientFormRegisterMainCampus) {
        designatedMainCampusId = `campus-${cleanCode.toLowerCase()}-main`;
        const mainCampusName = clientFormMainCampusName.trim() || `${clientFormName.trim()} Main Campus`;
        const mainCampusCode = clientFormMainCampusCode.trim().toUpperCase() || `${cleanCode}-MAIN`;
        const mainCampusCity = clientFormMainCampusCity.trim() || 'Head Office';
        const mainCampusFloat = Number(clientFormMainCampusFloat) || 50000;
        const mainAdminName = clientFormContact.trim() || `${clientFormName.trim()} Administrator`;
        const mainAdminPass = clientFormMainCampusPassword.trim() || 'campus';

        const newMainCampus: ExtendedCampusNode = {
          id: designatedMainCampusId,
          code: mainCampusCode,
          name: mainCampusName,
          city: mainCampusCity,
          accountantName: mainAdminName,
          pettyCashFloat: mainCampusFloat,
          currentPettyCash: mainCampusFloat,
          status: 'active',
          isMainCampus: true,
          parentCampusId: null,
          clientId: newId,
          loginEnabled: true,
          allowedModules: DEFAULT_CLIENT_MODULES,
        };

        addCampus(newMainCampus);

        // Register Level 2 Client Super Admin account for this organization & its main campus
        const adminUsername = `${cleanCode.toLowerCase()}.admin`;
        if (addUser) {
          addUser({
            id: `user-${newId}-admin`,
            username: adminUsername,
            name: mainAdminName,
            email: clientFormEmail.trim() || `${adminUsername}@${cleanCode.toLowerCase()}.edu.pk`,
            role: 'level_2_client_super_admin',
            status: 'active',
            password: mainAdminPass,
            clientId: newId,
            campusId: designatedMainCampusId,
            permittedCampusIds: ['all'],
            allowedModules: DEFAULT_CLIENT_MODULES,
            designation: 'Managing Director & Organization Owner',
          });
        }

        // Generate dynamic credentials and sync to cloud
        const cred = createDynamicCampusCredential(newMainCampus, undefined, mainAdminPass);
        saveCampusCredentialToCloud(cred);
      }

      const newClient: SchoolClientOrganization = {
        id: newId,
        name: clientFormName.trim(),
        code: cleanCode,
        logoUrl: clientFormLogoUrl.trim() || undefined,
        tier: clientFormTier,
        status: 'active',
        contactPerson: clientFormContact.trim() || 'Central Director',
        contactEmail: clientFormEmail.trim() || 'director@institution.edu.pk',
        contactPhone: clientFormPhone.trim() || '',
        mainCampusId: designatedMainCampusId,
        maxCampuses: Math.max(1, Number(clientFormMaxCampuses) || 10),
        maxUsers: Math.max(1, Number(clientFormMaxUsers) || 30),
        billingRenewalDate: '2027-12-31',
        enabledModules: DEFAULT_CLIENT_MODULES,
        createdAt: now,
        updatedAt: now,
      };
      updatedList = [newClient, ...clients];
      recordSiteAdminSecurityEvent({
        actorName: currentUser?.name || 'Platform Site Admin',
        actorRole: 'Level 1 Platform Creator',
        severity: 'high',
        category: 'CLIENT_MANAGEMENT',
        action: 'REGISTER_CLIENT_ORGANIZATION',
        targetEntity: 'SchoolClientOrganization',
        targetId: newId,
        details: `Created new client organization '${newClient.name}' with registered Main Campus ID '${designatedMainCampusId}' and Level 2 Admin.`,
      });
      triggerToast('success', `Registered client organization '${newClient.name}' and Primary Main Campus!`);
    }

    setClients(updatedList);
    syncSchoolClientsToCloud(updatedList);
    setIsClientModalOpen(false);
  };

  const handleToggleClientStatus = (clientId: string, newStatus: 'active' | 'suspended' | 'archived') => {
    const updated = clients.map((c) =>
      c.id === clientId ? { ...c, status: newStatus, updatedAt: new Date().toISOString() } : c
    );
    setClients(updated);
    syncSchoolClientsToCloud(updated);
    const target = clients.find((c) => c.id === clientId);
    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: newStatus === 'suspended' ? 'high' : 'medium',
      category: 'CLIENT_MANAGEMENT',
      action: `CLIENT_STATUS_${newStatus.toUpperCase()}`,
      targetEntity: 'SchoolClientOrganization',
      targetId: clientId,
      details: `Changed client '${target?.name}' status to ${newStatus}.`,
    });
    triggerToast('info', `Client '${target?.name}' status changed to ${newStatus}.`);
  };

  // --------------------------------------------------------------------------
  // CAMPUS HIERARCHY HANDLERS & CYCLE PREVENTION
  // --------------------------------------------------------------------------
  const handleUpdateCampusParent = (campusId: string, parentId: string) => {
    const validation = validateCampusHierarchy(
      campuses as ExtendedCampusNode[],
      campusId,
      parentId === 'none' ? null : parentId
    );

    if (!validation.isValid) {
      triggerToast('error', validation.error || 'Invalid campus hierarchy relationship.');
      return;
    }

    const cleanParentId = parentId === 'none' ? null : parentId;
    updateCampus(campusId, {
      parentCampusId: cleanParentId,
      isMainCampus: !cleanParentId,
    } as any);

    const target = campuses.find((c) => c.id === campusId);
    const parent = campuses.find((c) => c.id === parentId);

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'medium',
      category: 'CAMPUS_HIERARCHY',
      action: 'UPDATE_PARENT_RELATIONSHIP',
      targetEntity: 'Campus',
      targetId: campusId,
      details: cleanParentId
        ? `Configured campus '${target?.name}' as Sub-Campus under '${parent?.name}'.`
        : `Elevated campus '${target?.name}' to Primary Main Campus (No parent).`,
    });

    triggerToast(
      'success',
      cleanParentId
        ? `Linked '${target?.name}' as Sub-Campus of '${parent?.name}'!`
        : `Configured '${target?.name}' as Primary Main Campus!`
    );
    setTargetCampusForParent('');
  };

  const handleOpenAddSubCampusModal = (preselectedParentId?: string) => {
    setNewCampusName('');
    setNewCampusCode('');
    setNewCampusCity('Gujranwala');
    setNewCampusAccountant('');
    setNewCampusPassword(generateDynamicPassword('SUB'));
    setNewCampusFloat('35000');
    setNewCampusParentId(preselectedParentId || 'none');
    setIsCampusModalOpen(true);
  };

  const handleCreateCampusOrSubCampus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampusName.trim() || !newCampusCode.trim()) {
      triggerToast('error', 'Branch name and branch code are required.');
      return;
    }

    const cleanCode = newCampusCode.trim().toUpperCase();
    if (campuses.some((c) => c.code.toUpperCase() === cleanCode)) {
      triggerToast('error', `Campus code '${cleanCode}' is already registered.`);
      return;
    }

    const parentId = newCampusParentId === 'none' || !newCampusParentId ? null : newCampusParentId;
    const parent = campuses.find((c) => c.id === parentId);
    const resolvedClientId = newCampusClientId || (parent as any)?.clientId || (clients[0]?.id || null);

    const newId = `campus-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const newCampus: ExtendedCampusNode = {
      id: newId,
      code: cleanCode,
      name: newCampusName.trim(),
      city: newCampusCity.trim() || 'Punjab',
      accountantName: newCampusAccountant.trim() || (parentId ? 'Branch Accountant' : 'Main Campus Administrator'),
      pettyCashFloat: Number(newCampusFloat) || 35000,
      currentPettyCash: Number(newCampusFloat) || 35000,
      status: 'active',
      isMainCampus: !parentId,
      parentCampusId: parentId,
      clientId: resolvedClientId || undefined,
      loginEnabled: true,
      allowedModules: [
        'dashboard',
        'transaction',
        'alltransactions',
        'pettycash',
        'cashreconciliation',
        'reports',
      ],
    };

    addCampus(newCampus);

    // If registered as Main Campus and assigned to a client without a designated main campus, link it
    if (!parentId && resolvedClientId) {
      const updatedClients = clients.map((cl) =>
        cl.id === resolvedClientId && !cl.mainCampusId
          ? { ...cl, mainCampusId: newId, updatedAt: new Date().toISOString() }
          : cl
      );
      setClients(updatedClients);
      syncSchoolClientsToCloud(updatedClients);
    }

    // Generate dynamic credentials and save to database
    const pass = newCampusPassword.trim() || generateDynamicPassword(cleanCode);
    const cred = createDynamicCampusCredential(newCampus, undefined, pass);
    saveCampusCredentialToCloud(cred);

    // Create user login account so this branch can be operated immediately
    const assignedClient = clients.find((cl) => cl.id === resolvedClientId);
    const clientPrefix = assignedClient?.code ? assignedClient.code.toLowerCase() : 'campus';
    const autoUsername = `${clientPrefix}.${cleanCode.toLowerCase()}`;
    if (addUser) {
      addUser({
        id: `user-${newId}`,
        username: autoUsername,
        name: newCampusAccountant.trim() || `${newCampusName.trim()} Accountant`,
        email: `${autoUsername}@institution.edu.pk`,
        role: parentId ? 'level_3_sub_campus_admin' : 'level_2_client_super_admin',
        status: 'active',
        password: pass,
        clientId: resolvedClientId || null,
        campusId: newId,
        permittedCampusIds: [newId],
        allowedModules: newCampus.allowedModules,
        designation: parentId ? `Sub-Campus Accountant (${cleanCode})` : `Main Campus Administrator (${cleanCode})`,
      });
    }

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'medium',
      category: 'CAMPUS_HIERARCHY',
      action: parentId ? 'CREATE_SUB_CAMPUS' : 'CREATE_MAIN_CAMPUS',
      targetEntity: 'Campus',
      targetId: newId,
      details: parentId
        ? `Created Sub-Campus '${newCampus.name}' (${newCampus.code}) under Parent '${parent?.name}'. Initial Float: PKR ${newCampus.pettyCashFloat.toLocaleString()}.`
        : `Created Main Campus '${newCampus.name}' (${newCampus.code}).`,
    });

    triggerToast(
      'success',
      parentId
        ? `Created Sub-Campus '${newCampus.name}' (${newCampus.code}) under Parent '${parent?.name}'!`
        : `Created Main Campus '${newCampus.name}' (${newCampus.code})!`
    );

    setIsCampusModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // CAMPUS EDIT, DELETE & RETRIEVAL HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenEditCampus = (campus: ExtendedCampusNode) => {
    setEditingCampus(campus);
    setEditCampusName(campus.name || '');
    setEditCampusCode(campus.code || '');
    setEditCampusCity(campus.city || 'Punjab');
    setEditCampusAccountant(campus.accountantName || '');
    setEditCampusFloat(String(campus.pettyCashFloat || 35000));
    setEditCampusParentId(campus.parentCampusId || 'none');
    setEditCampusStatus((campus.status as any) || 'active');
    setEditCampusLoginEnabled(campus.loginEnabled !== false);
  };

  const handleSaveEditCampus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampus) return;
    if (!editCampusName.trim() || !editCampusCode.trim()) {
      triggerToast('error', 'Branch name and branch code are required.');
      return;
    }

    const cleanCode = editCampusCode.trim().toUpperCase();
    if (campuses.some((c) => c.id !== editingCampus.id && c.code.toUpperCase() === cleanCode)) {
      triggerToast('error', `Campus code '${cleanCode}' is already registered to another branch.`);
      return;
    }

    const targetParent = editCampusParentId === 'none' || !editCampusParentId ? null : editCampusParentId;
    if (targetParent) {
      const hierarchyCheck = validateCampusHierarchy(campuses as ExtendedCampusNode[], editingCampus.id, targetParent);
      if (!hierarchyCheck.isValid) {
        triggerToast('error', hierarchyCheck.error || 'Invalid parent hierarchy loop.');
        return;
      }
    }

    const updates: Partial<ExtendedCampusNode> = {
      name: editCampusName.trim(),
      code: cleanCode,
      city: editCampusCity.trim() || 'Punjab',
      accountantName: editCampusAccountant.trim() || 'Branch Accountant',
      pettyCashFloat: Number(editCampusFloat) || 35000,
      parentCampusId: targetParent,
      isMainCampus: !targetParent,
      status: editCampusStatus,
      loginEnabled: editCampusLoginEnabled,
    };

    updateCampus(editingCampus.id, updates as any);

    try {
      const raw = localStorage.getItem('aplus_campuses');
      if (raw) {
        const list = JSON.parse(raw);
        const updatedList = list.map((c: any) => (c.id === editingCampus.id ? { ...c, ...updates } : c));
        localStorage.setItem('aplus_campuses', JSON.stringify(updatedList));
      }
    } catch {}

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'medium',
      category: 'CAMPUS_HIERARCHY',
      action: 'UPDATE_CAMPUS_DETAILS',
      targetEntity: 'Campus',
      targetId: editingCampus.id,
      details: `Updated campus details for '${updates.name}' (${updates.code}). Parent: ${targetParent || 'None (Main)'}, Status: ${updates.status}.`,
    });

    triggerToast('success', `Campus '${updates.name}' updated successfully!`);
    setEditingCampus(null);
  };

  const handleOpenDeleteCampus = (campus: ExtendedCampusNode) => {
    setDeletingCampus(campus);
  };

  const handleConfirmDeleteCampus = () => {
    if (!deletingCampus) return;
    const campusId = deletingCampus.id;
    const campusName = deletingCampus.name;
    const campusCode = deletingCampus.code;

    // Gracefully detach any child campuses reporting to this campus so they become independent main campuses
    const childCampuses = campuses.filter((c: any) => c.parentCampusId === campusId);
    childCampuses.forEach((child) => {
      updateCampus(child.id, {
        parentCampusId: null,
        isMainCampus: true,
      } as any);
    });

    // Soft delete to Global Recovery / Recycle Bin
    try {
      softDeleteRecord({
        recordType: 'CAMPUS',
        originalPayload: deletingCampus,
        campusId: campusId,
        campusName: campusName,
        campusCode: campusCode,
        identifier: campusCode,
        title: `Campus: ${campusName} (${campusCode})`,
        deletedByUserId: currentUser?.id || 'admin',
        deletedByUserName: currentUser?.name || 'Platform Super Admin',
        deletedByUserRole: 'Platform Super Admin',
        deletionReason: 'Administrative campus removal',
      });
    } catch (err) {
      console.warn('Recycle bin record creation deferred:', err);
    }

    // Call engine deleteCampus
    if (deleteCampus) {
      deleteCampus(campusId);
    }

    // Update localStorage
    try {
      const raw = localStorage.getItem('aplus_campuses');
      if (raw) {
        const list = JSON.parse(raw);
        const filtered = list.filter((c: any) => c.id !== campusId);
        localStorage.setItem('aplus_campuses', JSON.stringify(filtered));
      }
    } catch {}

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'high',
      category: 'CAMPUS_HIERARCHY',
      action: 'DELETE_CAMPUS',
      targetEntity: 'Campus',
      targetId: campusId,
      details: `Deleted campus '${campusName}' (${campusCode}). Detached ${childCampuses.length} child branches. Preserved in Recycle Bin.`,
    });

    triggerToast(
      'warning',
      `Campus '${campusName}' deleted and moved to the Global Recycle Bin.`
    );
    setDeletingCampus(null);
  };

  // --------------------------------------------------------------------------
  // CLIENT MODULE GOVERNANCE HANDLERS
  // --------------------------------------------------------------------------
  const handleOpenManageModules = (client: SchoolClientOrganization) => {
    setManagingModulesClient(client);
    setClientSelectedModules(
      client.enabledModules && client.enabledModules.length > 0
        ? [...client.enabledModules]
        : [...DEFAULT_CLIENT_MODULES]
    );
  };

  const handleToggleClientModule = (moduleId: string) => {
    if (moduleId === 'dashboard') {
      triggerToast('info', 'Executive Dashboard is a core module and must remain enabled.');
      return;
    }
    setClientSelectedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSaveClientModules = () => {
    if (!managingModulesClient) return;
    const finalModules = clientSelectedModules.length > 0 ? clientSelectedModules : ['dashboard'];
    const updated = clients.map((c) =>
      c.id === managingModulesClient.id
        ? {
            ...c,
            enabledModules: finalModules,
            updatedAt: new Date().toISOString(),
          }
        : c
    );
    setClients(updated);
    saveStoredSchoolClients(updated);
    syncSchoolClientsToCloud(updated);

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'medium',
      category: 'CLIENT_MANAGEMENT',
      action: 'UPDATE_CLIENT_MODULES',
      targetEntity: 'SchoolClientOrganization',
      targetId: managingModulesClient.id,
      details: `Updated active ERP modules for client '${managingModulesClient.name}'. Total Active: ${finalModules.length} modules.`,
    });

    triggerToast(
      'success',
      `Updated module permissions for '${managingModulesClient.name}' (${finalModules.length} active modules)!`
    );
    setManagingModulesClient(null);
  };

  const handleOpenAddUserModal = (preselectedCampusId?: string, userToEdit?: any) => {
    if (userToEdit) {
      setSelectedUserToEdit(userToEdit);
      setUserFormUsername(userToEdit.username || '');
      setUserFormName(userToEdit.name || '');
      setUserFormEmail(userToEdit.email || '');
      setUserFormPassword('');
      setUserFormRole(userToEdit.role || 'Accountant');
      setUserFormCampusId(userToEdit.campusId || campuses[0]?.id || '');
      setUserFormLevel(userToEdit.permissionLevel || 'level_4_sub_campus_admin');
      setUserFormDelegatedSubCampuses(userToEdit.delegatedSubCampusIds || []);
    } else {
      setSelectedUserToEdit(null);
      setUserFormUsername('');
      setUserFormName('');
      setUserFormEmail('');
      setUserFormPassword(generateDynamicPassword('USER'));
      setUserFormRole('Accountant');
      setUserFormCampusId(preselectedCampusId || campuses[0]?.id || '');
      setUserFormLevel(preselectedCampusId ? 'level_4_sub_campus_admin' : 'level_4_sub_campus_admin');
      setUserFormDelegatedSubCampuses([]);
    }
    setIsUserModalOpen(true);
  };

  const handleSaveUserAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormUsername.trim() || !userFormName.trim()) {
      triggerToast('error', 'Username and user full name are required.');
      return;
    }

    const cleanUsername = userFormUsername.trim().toLowerCase();

    if (!selectedUserToEdit) {
      if (users.some((u) => u.username?.toLowerCase() === cleanUsername)) {
        triggerToast('error', `Username '${cleanUsername}' already exists.`);
        return;
      }
      if (!userFormPassword.trim()) {
        triggerToast('error', 'A secure password is required for this user.');
        return;
      }

      const assignedCampus = campuses.find((c) => c.id === userFormCampusId) || campuses[0];
      const isLevel1 = userFormLevel === 'level_1_platform_super_admin';

      const newUser = {
        id: `usr-${cleanUsername.replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
        username: cleanUsername,
        name: userFormName.trim(),
        email: userFormEmail.trim() || `${cleanUsername}@school.edu.pk`,
        password: userFormPassword.trim(),
        role: isLevel1 ? 'admin' : userFormRole,
        isSuperAdmin: isLevel1,
        campusId: isLevel1 ? 'all' : (userFormCampusId || assignedCampus?.id),
        campusName: isLevel1 ? 'All Campuses (Central Platform)' : assignedCampus?.name,
        permissionLevel: userFormLevel,
        delegatedSubCampusIds:
          userFormLevel === 'level_3_main_campus_admin' ? userFormDelegatedSubCampuses : [],
        createdAt: new Date().toISOString(),
      };

      addUser(newUser);

      recordSiteAdminSecurityEvent({
        actorName: currentUser?.name || 'Platform Site Admin',
        actorRole: 'Level 1 Platform Creator',
        severity: isLevel1 ? 'high' : 'medium',
        category: 'AUTHENTICATION',
        action: 'CREATE_USER_ACCOUNT',
        targetEntity: 'User',
        targetId: newUser.id,
        details: `Created user account '${newUser.name}' (@${newUser.username}) with ${userFormLevel} for campus '${newUser.campusName}'.`,
      });

      triggerToast('success', `Created user account '${newUser.name}' (@${cleanUsername})!`);
    } else {
      const updates: any = {
        name: userFormName.trim(),
        email: userFormEmail.trim(),
        role: userFormLevel === 'level_1_platform_super_admin' ? 'admin' : userFormRole,
        isSuperAdmin: userFormLevel === 'level_1_platform_super_admin',
        campusId: userFormCampusId,
        permissionLevel: userFormLevel,
        delegatedSubCampusIds:
          userFormLevel === 'level_3_main_campus_admin' ? userFormDelegatedSubCampuses : [],
      };
      if (userFormPassword.trim()) {
        updates.password = userFormPassword.trim();
      }

      updateUser(selectedUserToEdit.id, updates);
      triggerToast('success', `Updated user account '${userFormName}'!`);
    }

    setIsUserModalOpen(false);
    setSelectedUserToEdit(null);
  };

  // --------------------------------------------------------------------------
  // ACCOUNT HEAD CREATION WITH PARENT-CHILD STANDARD
  // --------------------------------------------------------------------------
  const handleCreateChildAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestedChildCode.trim() || !childAccountName.trim()) {
      triggerToast('error', 'Account code and name are required.');
      return;
    }

    // Check duplicate code
    if (accountHeads.some((h) => h.code === suggestedChildCode.trim())) {
      triggerToast('error', `Account code ${suggestedChildCode.trim()} already exists in Chart of Accounts.`);
      return;
    }

    const parentHead = accountHeads.find((h) => h.code === parentAccountSelect);
    addAccountHead({
      code: suggestedChildCode.trim(),
      accountId: suggestedChildCode.trim(),
      ledgerCode: suggestedChildCode.trim(),
      name: childAccountName.trim(),
      category: childAccountCategory,
      type: childAccountCategory === 'Revenue' ? 'Income' : childAccountCategory,
      balance: 0,
      mainCode: parentHead?.mainCode || parentAccountSelect,
      mainAccount: parentHead?.mainAccount || parentHead?.name || 'Parent Ledger',
      groupCode: parentHead?.groupCode || 'General',
      groupName: parentHead?.groupName || 'Sub-Accounts',
      description: `Child sub-account under parent code ${parentAccountSelect}`,
    });

    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'medium',
      category: 'ACCOUNT_HEAD',
      action: 'CREATE_CHILD_ACCOUNT_HEAD',
      targetEntity: 'AccountHead',
      targetId: suggestedChildCode.trim(),
      details: `Created child account ${suggestedChildCode.trim()} ('${childAccountName.trim()}') under parent ${parentAccountSelect}.`,
    });

    triggerToast('success', `Created Child Account Head ${suggestedChildCode.trim()} — ${childAccountName.trim()}!`);
    setChildAccountName('');
  };

  const handleDeleteOrDeactivateAccount = (account: AccountHead) => {
    // Flaw Check: Is account code referenced by existing transactions?
    const check = isAccountCodeReferencedInTransactions(account.code, transactions);
    if (check.isReferenced) {
      triggerToast(
        'error',
        `Integrity Protection: Account code ${account.code} is referenced by ${check.usageCount} voucher(s) (e.g. ${check.sampleVoucherNo}). It cannot be deleted. Deactivate it instead.`
      );
      recordSiteAdminSecurityEvent({
        actorName: currentUser?.name || 'Platform Site Admin',
        actorRole: 'Level 1 Platform Creator',
        severity: 'high',
        category: 'FINANCIAL_INTEGRITY',
        action: 'BLOCKED_ACCOUNT_DELETION',
        targetEntity: 'AccountHead',
        targetId: account.code,
        details: `Blocked deletion of referenced account code ${account.code} (${check.usageCount} active transactions).`,
      });
      return;
    }

    softDeleteRecord({
      recordType: 'ACCOUNT_HEAD',
      originalPayload: account,
      campusId: 'campus-khiali',
      campusName: 'Aplus Central Network',
      campusCode: 'ALL',
      identifier: account.code,
      title: `Account Head: ${account.name}`,
      deletedByUserId: currentUser?.id || 'usr-admin',
      deletedByUserName: currentUser?.name || 'Platform Site Admin',
      deletedByUserRole: currentUser?.role || 'Super Admin',
      deletionReason: 'Deleted via Site Admin Chart of Accounts Module (Moved to Global Recycle Bin)',
    });

    const res = deleteAccountHead(account.id || account.code);
    if (res.success) {
      triggerToast('success', `Moved account head ${account.code} to the Global Recycle Bin!`);
    } else {
      triggerToast('error', res.message || 'Could not delete account.');
    }
  };

  // --------------------------------------------------------------------------
  // MAINTENANCE MODE & BACKUP HANDLERS
  // --------------------------------------------------------------------------
  const handleToggleMaintenanceMode = () => {
    const nextMode = !settings.maintenanceMode;
    const updated = { ...settings, maintenanceMode: nextMode };
    setSettings(updated);
    syncPlatformSettingsToCloud(updated);
    recordSiteAdminSecurityEvent({
      actorName: currentUser?.name || 'Platform Site Admin',
      actorRole: 'Level 1 Platform Creator',
      severity: 'critical',
      category: 'SYSTEM_SETTINGS',
      action: nextMode ? 'ENABLE_MAINTENANCE_MODE' : 'DISABLE_MAINTENANCE_MODE',
      targetEntity: 'PlatformSystemSettings',
      targetId: 'global_settings',
      details: `Platform Maintenance Mode ${nextMode ? 'ACTIVATED (Logins locked to Platform Admin)' : 'DEACTIVATED (Normal operations resumed)'}.`,
    });
    triggerToast(
      nextMode ? 'error' : 'success',
      `Platform Maintenance Mode is now ${nextMode ? 'ACTIVATED' : 'DEACTIVATED'}!`
    );
  };

  const handleCreateDisasterRecoverySnapshot = async () => {
    try {
      const state = exportSystemState('all');
      await pushMasterCloudSnapshot(state);
      const updated = {
        ...settings,
        lastDisasterRecoveryBackupAt: new Date().toISOString(),
      };
      setSettings(updated);
      syncPlatformSettingsToCloud(updated);
      recordSiteAdminSecurityEvent({
        actorName: currentUser?.name || 'Platform Site Admin',
        actorRole: 'Level 1 Platform Creator',
        severity: 'low',
        category: 'SYSTEM_SETTINGS',
        action: 'DISASTER_RECOVERY_BACKUP_CREATED',
        targetEntity: 'SystemSnapshot',
        targetId: 'master_ledger_cache',
        details: 'Generated complete cloud disaster recovery backup snapshot to Firestore.',
      });
      triggerToast('success', 'Full Platform Disaster Recovery Snapshot saved to Cloud Firestore!');
    } catch {
      triggerToast('error', 'Disaster recovery cloud backup failed.');
    }
  };

  // Navigation Items matching the 25 requested modules organized by operational domain
  const NAV_ITEMS: Array<{
    id: PlatformAdminNavSection;
    number: string;
    label: string;
    category: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    // Category 1: Core Platform
    { id: '01_dashboard', number: '01', label: 'Platform Dashboard', category: 'Core Platform', icon: LayoutGrid },
    { id: '02_clients', number: '02', label: 'Organizations & Clients', category: 'Core Platform', icon: Building2, badge: clients.length },
    { id: '03_main_campuses', number: '03', label: 'Main Campus Management', category: 'Core Platform', icon: Building2, badge: campuses.filter((c: any) => c.isMainCampus || !c.parentCampusId).length },
    { id: '04_sub_campuses', number: '04', label: 'Sub-Campuses & Hierarchy Tree', category: 'Core Platform', icon: FolderTree, badge: campuses.filter((c: any) => c.parentCampusId).length },
    { id: 'global_search', number: '★', label: 'Global Multi-Campus Search', category: 'Core Platform', icon: Search },

    // Category 2: Identity & Access Governance
    { id: 'user_activity_telemetry', number: '★', label: 'User Activity & Login Telemetry', category: 'Identity & Access', icon: Activity, badge: 'Live' },
    { id: '05_users', number: '05', label: 'Global User Management', category: 'Identity & Access', icon: Users, badge: deduplicatedUsers.length },
    { id: '06_login_roles', number: '06', label: 'Login & Role Hierarchy (5-Tier)', category: 'Identity & Access', icon: KeyRound },
    { id: '07_permissions', number: '07', label: 'Permission Engineering', category: 'Identity & Access', icon: ShieldCheck },
    { id: '08_approval_matrix', number: '08', label: 'Platform Approval Matrix', category: 'Identity & Access', icon: FileCheck2 },

    // Category 3: Financial Accounting Suite
    { id: '15_chart_of_accounts', number: '09', label: 'Chart of Accounts & Codes', category: 'Financial Suite', icon: Layers, badge: accountHeads.length },
    { id: '16_voucher_mgmt', number: '10', label: 'Voucher Management & Audit', category: 'Financial Suite', icon: FileText, badge: transactions.length },
    { id: '17_petty_cash', number: '11', label: 'Petty Cash & Imprest Floats', category: 'Financial Suite', icon: Banknote, badge: pettyCashTransactions.length },
    { id: '18_ai_suggester', number: '12', label: 'AI Expense Suggester', category: 'Financial Suite', icon: Sparkles },
    { id: '19_financial_reports', number: '13', label: 'Financial Reports Suite', category: 'Financial Suite', icon: Scale },
    { id: 'financial_reports_permissions', number: '14', label: 'Client Report Permissions', category: 'Financial Suite', icon: ShieldCheck, badge: 'Policy' },

    // Category 4: Data & Cloud Infrastructure
    { id: '14_recycle_bin', number: '14', label: 'Deleted Records Recovery', category: 'Data & Recovery', icon: RotateCcw, badge: getStoredRecycleBinRecords().filter((r) => r.status === 'soft_deleted').length || undefined },
    { id: '09_database_hub', number: '15', label: 'Database Management Hub', category: 'Data & Recovery', icon: Database },
    { id: '10_cloud_sync', number: '16', label: 'Cloud Synchronization Center', category: 'Data & Recovery', icon: CloudUpload },
    { id: '11_offline_indexeddb', number: '17', label: 'IndexedDB & Offline Queue', category: 'Data & Recovery', icon: Server },
    { id: '13_backup_dr', number: '18', label: 'Backup & Disaster Recovery', category: 'Data & Recovery', icon: CloudDownload },

    // Category 5: Security, System & Operations
    { id: '20_audit_logs', number: '19', label: 'Forensic Audit Logs', category: 'Security & Operations', icon: Activity, badge: dashboardStats.criticalAuditCount > 0 ? `${dashboardStats.criticalAuditCount} Alert` : undefined },
    { id: '21_security_sessions', number: '20', label: 'Security & Session Control', category: 'Security & Operations', icon: Lock },
    { id: '22_system_config', number: '21', label: 'System Configuration', category: 'Security & Operations', icon: Sliders },
    { id: '23_integrations', number: '22', label: 'Integration & API Management', category: 'Security & Operations', icon: Globe },
    { id: '24_health_monitor', number: '23', label: 'Application Health Monitoring', category: 'Security & Operations', icon: Zap },
    { id: '12_service_worker', number: '24', label: 'Service Worker & PWA', category: 'Security & Operations', icon: Radio },
    { id: '25_maintenance_release', number: '25', label: 'Maintenance & Releases', category: 'Security & Operations', icon: Settings },
  ];

  // STRICT SECURITY CHECK: Show Super Admin Panel ONLY in Super Administration Account
  const isSuperAdminAccountOnly = Boolean(
    currentUser &&
    !currentUser.clientId &&
    (currentUser.role === 'level_1_platform_super_admin' ||
     currentUser.username?.toLowerCase() === 'admin' ||
     (currentUser.role === 'admin' && !currentUser.campusId && isSuperAdmin))
  );

  if (!isSuperAdminAccountOnly) {
    return (
      <div className="bg-slate-900 border border-rose-800/60 rounded-3xl p-8 text-center text-slate-200 max-w-lg mx-auto my-12 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-700/60 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Access Restricted: Super Administrator Only</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          The Super Admin Panel is confidential and restricted exclusively to the Super Administration account. Your current account does not have authorization to view or modify platform-wide infrastructure, client organizations, or system security settings.
        </p>
        <div className="flex items-center justify-center gap-3">
          {onSwitchToCampusView && (
            <button
              type="button"
              onClick={onSwitchToCampusView}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Go to Campus Operational View
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 max-w-7xl mx-auto my-4 flex flex-col min-h-[820px] transition-all">
      {/* Platform Creator Header Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-900/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700 font-mono">
                Level 1 — Original Platform Creator
              </span>
              {settings.maintenanceMode && (
                <span className="text-[10px] font-black uppercase tracking-wider bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-700 animate-pulse">
                  Maintenance Mode Active
                </span>
              )}
            </div>
            <h2 className="text-lg font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Platform Site Admin & Multi-Campus Management Hub</span>
              <span className="text-xs font-mono text-slate-400 font-normal">
                ({settings.systemVersion})
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleMaintenanceMode}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              settings.maintenanceMode
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title="Toggle system maintenance lock (restricts logins to Platform Creator)"
          >
            <Radio className={`w-3.5 h-3.5 ${settings.maintenanceMode ? 'animate-spin' : ''}`} />
            <span>{settings.maintenanceMode ? 'End Maintenance' : 'Maintenance Mode'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeploymentModal(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Inspect production deployment readiness checklist and live stack diagnostics"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Deployment Ready ✓</span>
          </button>

          <button
            type="button"
            onClick={handleCreateDisasterRecoverySnapshot}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Create live disaster recovery snapshot"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Disaster Backup</span>
          </button>

          {onSwitchToCampusView && (
            <button
              type="button"
              onClick={onSwitchToCampusView}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              title="Open Campus Operational Ledger & Vouchers"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Campus Ledger View</span>
            </button>
          )}

          {logout && (
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 hover:border-rose-800"
              title="Sign out of Platform Control Panel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Close Platform Site Admin Hub"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackNotice && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b animate-in fade-in duration-200 ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : feedbackNotice.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : feedbackNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <HelpCircle className="w-4 h-4 text-indigo-400" />
            )}
            <span>{feedbackNotice.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            className="text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Navigation Sidebar + Active Module Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Navigation Sequence (Sections 01 to 12) */}
        <aside className="w-full md:w-64 bg-slate-950/90 border-r border-slate-800/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Platform Controls</span>
            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
              25 Modules
            </span>
          </div>

          {/* Module Filter Input */}
          <div className="p-2 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search modules..."
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-3 overflow-y-auto max-h-[700px]">
            {['Core Platform', 'Identity & Access', 'Financial Suite', 'Data & Recovery', 'Security & Operations'].map((cat) => {
              const catItems = NAV_ITEMS.filter((item) => {
                if (item.category !== cat) return false;
                if (!sidebarSearch.trim()) return true;
                const q = sidebarSearch.toLowerCase();
                return item.label.toLowerCase().includes(q) || item.number.includes(q);
              });

              if (catItems.length === 0) return null;

              return (
                <div key={cat} className="space-y-1">
                  <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                    {cat}
                  </div>
                  {catItems.map((item) => {
                    const isActive =
                      activeSection === item.id ||
                      (item.id === '03_main_campuses' && activeSection === '03_campuses') ||
                      (item.id === '05_users' && activeSection === '04_users') ||
                      (item.id === '06_login_roles' && activeSection === '05_roles_permissions') ||
                      (item.id === '07_permissions' && activeSection === '06_modules') ||
                      (item.id === '08_approval_matrix' && activeSection === '08_voucher_controls') ||
                      (item.id === '15_chart_of_accounts' && activeSection === '07_account_heads') ||
                      (item.id === '19_financial_reports' && activeSection === '09_consolidated_reports') ||
                      (item.id === '14_recycle_bin' && activeSection === '13_recycle_bin') ||
                      (item.id === '13_backup_dr' && activeSection === '12_backup_settings') ||
                      (item.id === '20_audit_logs' && activeSection === '10_audit_security') ||
                      (item.id === 'global_search' && activeSection === '14_global_search');

                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-mono text-[10px] w-4 text-center shrink-0 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {item.number}
                          </span>
                          <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                          <span className="truncate text-[11px]">{item.label}</span>
                        </div>

                        {item.badge !== undefined && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 ml-1 ${
                              isActive
                                ? 'bg-indigo-800 text-white'
                                : String(item.badge).includes('Alert')
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Creator Credentials & Info Pill */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-500">Platform Creator:</span>
              <span className="text-emerald-400 font-bold">Authenticated ✓</span>
            </div>
            <div className="text-white font-bold truncate">
              {currentUser?.name || 'Platform Creator'}
            </div>
            <div className="text-slate-500 text-[10px]">
              Central Multi-Campus Authority
            </div>
          </div>
        </aside>

        {/* Right Workspace Module Content */}
        <main className="flex-1 p-5 sm:p-6 overflow-y-auto bg-slate-900/60">
          {/* ================================================================ */}
          {/* 01: GLOBAL DASHBOARD                                             */}
          {/* ================================================================ */}
          {activeSection === '01_dashboard' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-indigo-400" />
                  <span>Platform Command Center & Real-Time Telemetry</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Multi-client oversight: School organizations, campus branches, transaction volumes, and system risk monitors.
                </p>
              </div>

              {/* Production Deployment Readiness Command Hub */}
              <DeploymentReadinessHub onNavigateToCampusOperations={onSwitchToCampusView} />

              {/* KPI Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                    <span>School Clients</span>
                    <Building2 className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {dashboardStats.totalClients}{' '}
                    <span className="text-xs text-emerald-400 font-normal">
                      ({dashboardStats.activeClients} Active)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                    Aplus Network, Beacon Crest & Partner Orgs
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                    <span>Campus Branches</span>
                    <FolderTree className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {dashboardStats.totalCampuses}{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      ({dashboardStats.mainCampuses} Main / {dashboardStats.subCampuses} Sub)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                    Parent-Child Hierarchical Segregation
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                    <span>Ledger Transactions</span>
                    <FileCheck2 className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">
                    {dashboardStats.totalTx}{' '}
                    <span className="text-xs text-amber-400 font-normal">
                      ({dashboardStats.pendingTx} Pending)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                    Total Volume: PKR {(dashboardStats.totalVolume / 1000).toFixed(0)}k
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
                    <span>Security & Health</span>
                    <Activity className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    Operational
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                    Firestore Live Sync • Zero Fatal Errors
                  </div>
                </div>
              </div>

              {/* Hierarchy Architecture Diagram Box */}
              <div className="bg-slate-950/60 border border-indigo-900/60 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span>5-Tier Site Administration Access Architecture</span>
                  </div>
                  <span className="text-xs text-indigo-300 font-mono">
                    ISO 27001 Access Control Matrix
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 text-xs">
                  <div className="bg-slate-900 p-3 rounded-xl border border-indigo-800/80 space-y-1">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold block">
                      LEVEL 1 (Creator)
                    </span>
                    <strong className="text-white block">Platform Site Admin</strong>
                    <p className="text-[11px] text-slate-400">
                      Original platform creator / owner. Full centralized control across all school clients, databases, and global settings.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-purple-400 font-bold block">
                      LEVEL 2 (Client Owner)
                    </span>
                    <strong className="text-white block">School Client Admin</strong>
                    <p className="text-[11px] text-slate-400">
                      Owns organization & authorized campuses. Controls institutional budgeting and client-wide users.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                      LEVEL 3 (Main Branch)
                    </span>
                    <strong className="text-white block">Main Campus Admin</strong>
                    <p className="text-[11px] text-slate-400">
                      Oversees primary campus & delegated sub-campuses. Authorizes major vouchers and float replenishments.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-sky-400 font-bold block">
                      LEVEL 4 (Sub Branch)
                    </span>
                    <strong className="text-white block">Sub-Campus Admin</strong>
                    <p className="text-[11px] text-slate-400">
                      Confined strictly to own sub-campus transactions, daily vouchers, and imprest petty cash drawer.
                    </p>
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-amber-400 font-bold block">
                      LEVEL 5 (Staff)
                    </span>
                    <strong className="text-white block">Departmental Staff</strong>
                    <p className="text-[11px] text-slate-400">
                      Accountants, cashiers, fee clerks, and viewers. Restricted to specific vouchers & petty cash slips.
                    </p>
                  </div>
                </div>
              </div>

              {/* System-Wide User Activity & Login Telemetry Dashboard Widget */}
              <SystemUserActivityWidget
                campuses={campuses}
                users={deduplicatedUsers}
                onNavigateToCampus={(campusId) => {
                  setActiveSection('04_sub_campuses');
                }}
              />

              {/* Fast Module Switchers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSection('user_activity_telemetry')}
                  className="p-3 rounded-xl bg-slate-950 border border-indigo-700/80 hover:border-indigo-500 text-left transition-colors cursor-pointer group shadow-xs"
                >
                  <Activity className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Login Telemetry</div>
                  <div className="text-[10px] text-slate-400">Campus & role frequency</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('02_clients')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-600 text-left transition-colors cursor-pointer group"
                >
                  <Building2 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Client Registry</div>
                  <div className="text-[10px] text-slate-400">School organizations</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('03_campuses')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-600 text-left transition-colors cursor-pointer group"
                >
                  <FolderTree className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Campus Tree</div>
                  <div className="text-[10px] text-slate-400">Parent-child hierarchy</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('13_recycle_bin')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500 text-left transition-colors cursor-pointer group"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Recycle Bin</div>
                  <div className="text-[10px] text-slate-400">Voucher & data recovery</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('14_global_search')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500 text-left transition-colors cursor-pointer group"
                >
                  <Search className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Global Search</div>
                  <div className="text-[10px] text-slate-400">Multi-campus query</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('07_account_heads')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-600 text-left transition-colors cursor-pointer group"
                >
                  <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">COA & Codes</div>
                  <div className="text-[10px] text-slate-400">1001-1 child syntax</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('10_audit_security')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-600 text-left transition-colors cursor-pointer group"
                >
                  <Activity className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Audit & Security</div>
                  <div className="text-[10px] text-slate-400">Isolation & security logs</div>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* USER ACTIVITY & LOGIN TELEMETRY DEDICATED VIEW                  */}
          {/* ================================================================ */}
          {activeSection === 'user_activity_telemetry' && (
            <div className="space-y-5">
              <SystemUserActivityWidget
                campuses={campuses}
                users={deduplicatedUsers}
                onNavigateToCampus={(campusId) => {
                  setActiveSection('04_sub_campuses');
                }}
              />
            </div>
          )}

          {/* ================================================================ */}
          {/* 02: CLIENTS & ORGANIZATIONS                                      */}
          {/* ================================================================ */}
          {activeSection === '02_clients' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <span>School Clients & Organizations Registry</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Central authority over all school clients, contractual quotas, authorized campuses, and status flags.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Search school client..."
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-48 sm:w-60 focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setClientFormId(null);
                      setClientFormName('');
                      setClientFormCode('');
                      setClientFormTier('Enterprise');
                      setClientFormContact('');
                      setClientFormEmail('');
                      setClientFormPhone('');
                      setClientFormMaxCampuses('10');
                      setClientFormMaxUsers('40');
                      setClientFormLogoUrl('');
                      setIsClientModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register New Client</span>
                  </button>
                </div>
              </div>

              {/* Clients Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Client Organization</th>
                      <th className="py-3 px-4">Plan / Tier</th>
                      <th className="py-3 px-4">Authorized Quota</th>
                      <th className="py-3 px-4">Primary Contact</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {clients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                            <Building2 className="w-10 h-10 text-slate-600" />
                            <span className="font-bold text-white text-sm">No Client Organizations Registered</span>
                            <span className="text-xs text-slate-400">All demo client organizations, campuses, and entries have been completely deleted. Database is in a fresh, clean production state.</span>
                            <button
                              type="button"
                              onClick={() => {
                                setClientFormId(null);
                                setClientFormName('');
                                setClientFormCode('');
                                setClientFormTier('Enterprise');
                                setClientFormContact('');
                                setClientFormEmail('');
                                setClientFormPhone('');
                                setClientFormMaxCampuses('10');
                                setClientFormMaxUsers('40');
                                setIsClientModalOpen(true);
                              }}
                              className="mt-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                            >
                              + Register First Client Organization
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      clients
                        .filter(
                          (c) =>
                            c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                            c.code.toLowerCase().includes(clientSearchQuery.toLowerCase())
                        )
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {c.logoUrl ? (
                                <img
                                  src={c.logoUrl}
                                  alt={c.name}
                                  className="w-7 h-7 rounded-lg object-contain bg-white p-0.5 border border-slate-700 shrink-0"
                                />
                              ) : (
                                <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                                  {c.code}
                                </span>
                              )}
                              <div>
                                <div className="font-bold text-white text-xs">{c.name}</div>
                                <div className="text-[10px] text-slate-400">{c.address || 'Pakistan'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                                c.tier === 'Enterprise'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : c.tier === 'Professional'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {c.tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            <div>{c.maxCampuses} Max Campuses</div>
                            <div className="text-[10px] text-slate-500">{c.maxUsers} Users Quota</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-white font-medium">{c.contactPerson}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.contactEmail}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                c.status === 'active'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : c.status === 'suspended'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {c.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {c.status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleClientStatus(c.id, 'suspended')}
                                  className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[10px] border border-rose-800 transition-colors cursor-pointer"
                                  title="Suspend client organization"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleClientStatus(c.id, 'active')}
                                  className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold text-[10px] border border-emerald-800 transition-colors cursor-pointer"
                                  title="Activate client organization"
                                >
                                  Activate
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setClientFormId(c.id);
                                  setClientFormName(c.name);
                                  setClientFormCode(c.code);
                                  setClientFormTier(c.tier);
                                  setClientFormContact(c.contactPerson);
                                  setClientFormEmail(c.contactEmail);
                                  setClientFormPhone(c.contactPhone);
                                  setClientFormMaxCampuses(String(c.maxCampuses));
                                  setClientFormMaxUsers(String(c.maxUsers));
                                  setClientFormLogoUrl(c.logoUrl || '');
                                  setIsClientModalOpen(true);
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] transition-colors cursor-pointer"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenManageModules(c)}
                                className="px-2.5 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-bold text-[10px] border border-indigo-800 transition-colors cursor-pointer flex items-center gap-1"
                                title="Manage which ERP modules are visible and permitted to this client organization"
                              >
                                <Sliders className="w-3 h-3 text-indigo-400" />
                                <span>Modules ({c.enabledModules?.length || DEFAULT_CLIENT_MODULES.length}/16)</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 03: CAMPUSES & HIERARCHY                                         */}
          {/* ================================================================ */}
          {(activeSection === '03_campuses' || activeSection === '03_main_campuses') && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-emerald-400" />
                    <span>Campus Branches & Hierarchical Relationship Tree</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Main Campus (Level 3) vs Sub-Campus (Level 4) parent-child structure with cycle prevention.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={campusSearchQuery}
                      onChange={(e) => setCampusSearchQuery(e.target.value)}
                      placeholder="Search campus branches..."
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-40 sm:w-52 focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNewCampusParentId('none');
                      setNewCampusName('');
                      setNewCampusCode(`C-${campuses.length + 1}`);
                      setNewCampusPassword(generateDynamicPassword('CAMP'));
                      setIsCampusModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Register Campus</span>
                  </button>
                </div>
              </div>

              {/* Hierarchy Tree Visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campuses
                  .filter(
                    (c) =>
                      c.name.toLowerCase().includes(campusSearchQuery.toLowerCase()) ||
                      c.code.toLowerCase().includes(campusSearchQuery.toLowerCase())
                  )
                  .map((campus: any) => {
                    const isMain = campus.isMainCampus || !campus.parentCampusId;
                    const parent = campuses.find((p) => p.id === campus.parentCampusId);
                    const subBranches = campuses.filter((sub: any) => sub.parentCampusId === campus.id);

                    return (
                      <div
                        key={campus.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isMain
                            ? 'bg-slate-950/90 border-emerald-800/80 shadow-md'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {campus.code}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isMain
                                  ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                                  : 'bg-sky-950/50 text-sky-300 border border-sky-800'
                              }`}
                            >
                              {isMain ? 'Main Campus (Parent)' : 'Sub-Campus (Child)'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Float: PKR {campus.pettyCashFloat?.toLocaleString() || '35,000'}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white">{campus.name}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Accountant: {campus.accountantName || 'Branch Accountant'} • {campus.city || 'Punjab'}
                        </p>

                        {/* Parent relationship indicator */}
                        {!isMain && parent && (
                          <div className="mt-2 text-[11px] text-sky-400 bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-900 flex items-center gap-1.5">
                            <span>↳ Reports to Parent:</span>
                            <strong className="text-white">{parent.name}</strong>
                          </div>
                        )}

                        {/* Child sub-branches list */}
                        {subBranches.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Sub-Campuses ({subBranches.length}):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {subBranches.map((s) => (
                                <span
                                  key={s.id}
                                  className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-mono"
                                >
                                  {s.code}: {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Direct Sub-Campus, Edit, Delete, and User Quick Creation Buttons */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                setNewCampusParentId(campus.id);
                                setNewCampusName(`${campus.name} Sub-Branch`);
                                setNewCampusCode(`${campus.code}-S${subBranches.length + 1}`);
                                setNewCampusCity(campus.city || 'Punjab');
                                setNewCampusPassword(generateDynamicPassword(campus.code));
                                setIsCampusModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title={`Add a new Sub-Campus child under parent ${campus.name}`}
                            >
                              <Plus className="w-3 h-3 text-emerald-400" />
                              <span>+ Sub-Campus</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditCampus(campus)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title={`Edit campus parameters for ${campus.name}`}
                            >
                              <Edit3 className="w-3 h-3 text-indigo-400" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteCampus(campus)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-700/80 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title={`Delete campus ${campus.name} (safely moves to Global Recycle Bin)`}
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Delete</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenAddUserModal(campus.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title={`Create a login user account assigned to ${campus.name}`}
                            >
                              <UserPlus className="w-3 h-3 text-slate-400" />
                              <span>+ Add User</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400 text-[10px]">Parent:</span>
                            <select
                              value={campus.parentCampusId || 'none'}
                              onChange={(e) => handleUpdateCampusParent(campus.id, e.target.value)}
                              className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2 py-0.5 text-[11px] outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value="none">-- Main (None) --</option>
                              {campuses
                                .filter(
                                  (c) =>
                                    c.id !== campus.id &&
                                    (!campus.clientId || !c.clientId || c.clientId === campus.clientId)
                                )
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    Parent: {c.name} ({c.code})
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 04: USERS & LOGIN ACCOUNTS                                       */}
          {/* ================================================================ */}
          {(activeSection === '04_users' || activeSection === '05_users') && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-400" />
                    <span>Multi-Tenant User Accounts Directory</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    User mapping across School Clients, Campus Branches, and Role Clearances.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-40 sm:w-52 focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddUserModal()}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Generate New Login</span>
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">User Account</th>
                      <th className="py-3 px-4">Permission Level</th>
                      <th className="py-3 px-4">Assigned Campus</th>
                      <th className="py-3 px-4">Role Type</th>
                      <th className="py-3 px-4 text-right">Actions & Security</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {deduplicatedUsers
                      .filter(
                        (u) =>
                          u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.role?.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                      .map((u, idx) => {
                        const targetCampus = campuses.find((c) => c.id === u.campusId);
                        const isCreator = u.role === 'admin' || u.isSuperAdmin;

                        return (
                          <tr key={`${u.id || u.username || 'user'}-${idx}`} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-300 font-bold flex items-center justify-center font-mono text-xs border border-indigo-800">
                                  {u.username?.[0]?.toUpperCase() || 'U'}
                                </span>
                                <div>
                                  <div className="font-bold text-white text-xs">{u.name || u.username}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  isCreator
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                }`}
                              >
                                {isCreator ? 'Level 1 Platform Super Admin' : 'Level 4/5 Branch Staff'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-300">
                              {targetCampus ? `${targetCampus.name} (${targetCampus.code})` : 'All Campuses'}
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                              {u.role || 'campus_accountant'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddUserModal(u.campusId, u)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] transition-colors cursor-pointer border border-slate-700"
                                  title="Edit user role, scope, or password"
                                >
                                  Edit
                                </button>
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                                  Active ✓
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 05: ROLES & PERMISSIONS                                          */}
          {/* ================================================================ */}
          {(activeSection === '05_roles_permissions' || activeSection === '06_login_roles') && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  <span>5-Tier Hierarchical RBAC & Action Matrix</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Formal segregation of duties between Platform Creator, Client Owners, Main Campus Admins, and Branch Cashiers.
                </p>
              </div>

              {/* Master System Credentials PDF Download Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-950/50 border border-indigo-800/80 shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Official Production Credentials Directory (Print-Ready PDF)</span>
                  </span>
                  <p className="text-[11px] text-indigo-300">
                    Comprehensive credentials directory covering all 5 clearance tiers for testing, institutional audits, and Vercel production deployment.
                  </p>
                </div>
                <a
                  href="/SYSTEM_CREDENTIALS_DIRECTORY.pdf"
                  download="SYSTEM_CREDENTIALS_DIRECTORY.pdf"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Credentials PDF</span>
                </a>
              </div>

              {/* Default Access Policy Reference Table (From User Prompt Section 3) */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
                <div className="p-3 bg-slate-950 border-b border-slate-800 text-xs font-bold text-white flex items-center justify-between">
                  <span>Default Capability Matrix Policy (Backend Enforced)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Strict Scope Policy</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-4">System Capability</th>
                      <th className="py-2.5 px-4 text-center">Level 1 Platform Admin</th>
                      <th className="py-2.5 px-4 text-center">Level 2 Client Admin</th>
                      <th className="py-2.5 px-4 text-center">Level 3 Main Campus Admin</th>
                      <th className="py-2.5 px-4 text-center">Level 4 Sub-Campus Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-[11px]">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">View All Clients</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">Yes</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Create Client</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">Yes</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Manage Assigned Campuses</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">All Campuses</td>
                      <td className="py-2.5 px-4 text-center text-blue-300 font-bold font-mono">Authorized Only</td>
                      <td className="py-2.5 px-4 text-center text-blue-300 font-bold font-mono">Assigned Hierarchy</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-bold font-mono">Own Campus Only</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Configure Global Account Heads</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">Yes</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">View Financial Reports</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">All (Audited)</td>
                      <td className="py-2.5 px-4 text-center text-blue-300 font-bold font-mono">Own Organization</td>
                      <td className="py-2.5 px-4 text-center text-blue-300 font-bold font-mono">Assigned Campuses</td>
                      <td className="py-2.5 px-4 text-center text-amber-300 font-bold font-mono">Own Campus Only</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Change Global Settings</td>
                      <td className="py-2.5 px-4 text-center text-emerald-400 font-bold font-mono">Yes</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                      <td className="py-2.5 px-4 text-center text-rose-400 font-bold font-mono">No</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 07: ACCOUNT HEADS & CODE CONFIGURATION                           */}
          {/* ================================================================ */}
          {(activeSection === '07_account_heads' || activeSection === '15_chart_of_accounts') && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-400" />
                    <span>Global Account Heads & Code Sequence Engine</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Parent-Child Code Architecture (1001 → 1001-1, 1001-2) with transaction immutability protection.
                  </p>
                </div>
              </div>

              {/* Automatic Child Account Head Generator */}
              <div className="bg-slate-950/80 border border-purple-900/60 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Automatic Parent-Child Account Code Generator</span>
                </div>

                <form onSubmit={handleCreateChildAccount} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Select Parent Account</label>
                    <select
                      value={parentAccountSelect}
                      onChange={(e) => setParentAccountSelect(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
                    >
                      {accountHeads.map((h) => (
                        <option key={h.code} value={h.code}>
                          {h.code} — {h.name} ({h.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Generated Child Code</label>
                    <input
                      type="text"
                      readOnly
                      value={suggestedChildCode}
                      className="w-full bg-slate-900/50 border border-purple-700/60 rounded-xl px-3 py-2 text-purple-300 font-mono font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-bold">Child Sub-Account Title</label>
                    <input
                      type="text"
                      value={childAccountName}
                      onChange={(e) => setChildAccountName(e.target.value)}
                      placeholder="e.g. Science Lab Consumables"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500"
                      required
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Child Head</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Account Heads List with Reference Lock Verification */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/70">
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Registered Account Heads ({accountHeads.length})</span>
                  <input
                    type="text"
                    value={accountSearchQuery}
                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                    placeholder="Search account code or name..."
                    className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 outline-none w-56"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-900 z-10 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Account Code</th>
                        <th className="py-2.5 px-4">Head Title</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Transaction Usage</th>
                        <th className="py-2.5 px-4 text-right">Protection Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {accountHeads
                        .filter(
                          (h) =>
                            h.code.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                            h.name.toLowerCase().includes(accountSearchQuery.toLowerCase())
                        )
                        .map((h) => {
                          const refCheck = isAccountCodeReferencedInTransactions(h.code, transactions);
                          return (
                            <tr key={h.code} className="hover:bg-slate-900/60 transition-colors">
                              <td className="py-2.5 px-4 font-mono font-bold text-indigo-300">
                                {h.code}
                              </td>
                              <td className="py-2.5 px-4 font-bold text-white">
                                {h.name}
                              </td>
                              <td className="py-2.5 px-4 text-slate-400">
                                {h.category}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px]">
                                {refCheck.isReferenced ? (
                                  <span className="text-amber-400 font-semibold">
                                    {refCheck.usageCount} voucher(s)
                                  </span>
                                ) : (
                                  <span className="text-slate-500">0 vouchers (unreferenced)</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {refCheck.isReferenced ? (
                                  <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800 px-2 py-0.5 rounded font-bold font-mono">
                                    Locked (Immutable)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrDeactivateAccount(h)}
                                    className="text-[10px] bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                                  >
                                    Delete Unused
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 04: SUB-CAMPUSES & HIERARCHY TREE                                */}
          {/* ================================================================ */}
          {activeSection === '04_sub_campuses' && (
            <SubCampusHierarchyView
              campuses={campuses}
              onUpdateCampus={updateCampus}
              onEditCampus={handleOpenEditCampus}
              onDeleteCampus={handleOpenDeleteCampus}
              triggerToast={triggerToast}
              onOpenRegisterModal={() => {
                setNewCampusParentId('none');
                setNewCampusName('');
                setNewCampusCode(`C-${campuses.length + 1}`);
                setNewCampusPassword(generateDynamicPassword('CAMP'));
                setIsCampusModalOpen(true);
              }}
            />
          )}

          {/* ================================================================ */}
          {/* 07: PERMISSION ENGINEERING & GRANULAR MATRIX                      */}
          {/* ================================================================ */}
          {(activeSection === '07_permissions' || activeSection === '06_modules') && (
            <div className="space-y-5">
              <PermissionEngine />
            </div>
          )}

          {/* ================================================================ */}
          {/* 08: VOUCHER & APPROVAL CONTROLS / CONFIGURABLE MATRIX            */}
          {/* ================================================================ */}
          {(activeSection === '08_voucher_controls' || activeSection === '08_approval_matrix') && (
            <div className="space-y-5">
              <ConfigurableApprovalMatrixModule />
            </div>
          )}

          {/* ================================================================ */}
          {/* 16: VOUCHER MANAGEMENT & AUDIT                                    */}
          {/* ================================================================ */}
          {activeSection === '16_voucher_mgmt' && (
            <div className="space-y-5">
              <BulkVoucherAndAccessManager />
            </div>
          )}

          {/* ================================================================ */}
          {/* 17: PETTY CASH & IMPREST FLOATS                                  */}
          {/* ================================================================ */}
          {activeSection === '17_petty_cash' && (
            <PettyCashImprestView
              campuses={campuses}
              pettyCashTransactions={pettyCashTransactions}
              onUpdateCampus={updateCampus}
              triggerToast={triggerToast}
            />
          )}

          {/* ================================================================ */}
          {/* 18: AI EXPENSE SUGGESTER                                         */}
          {/* ================================================================ */}
          {activeSection === '18_ai_suggester' && (
            <div className="space-y-5">
              <ExpenseCategorySuggesterWidget />
            </div>
          )}

          {/* ================================================================ */}
          {/* 19: FINANCIAL REPORTS SUITE & CLIENT PERMISSION MANAGER          */}
          {/* ================================================================ */}
          {(activeSection === '19_financial_reports' ||
            activeSection === '09_consolidated_reports' ||
            activeSection === 'financial_reports_permissions') && (
            <div className="space-y-5">
              {/* Top Sub-Tab Switcher for Platform Site Admin */}
              <div className="flex items-center justify-between gap-3 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setReportsSubTab('permissions')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      reportsSubTab === 'permissions' || activeSection === 'financial_reports_permissions'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Client Report Permissions Manager (Which Reports Show to Which Clients)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportsSubTab('viewer')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      reportsSubTab === 'viewer' && activeSection !== 'financial_reports_permissions'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <Scale className="w-4 h-4" />
                    <span>Multi-Format Financial Reports Suite & Reconciler</span>
                  </button>
                </div>

                <div className="text-[11px] font-mono text-indigo-400/90 pr-3 hidden sm:block">
                  {reportsSubTab === 'permissions' || activeSection === 'financial_reports_permissions'
                    ? 'Configuring Client Access Boundaries'
                    : 'Viewing Campus Ledgers & Statements'}
                </div>
              </div>

              {reportsSubTab === 'permissions' || activeSection === 'financial_reports_permissions' ? (
                <ClientFinancialReportsPermissionsManager triggerToast={triggerToast} />
              ) : (
                <MultiFormatReportsHub />
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* 14: GLOBAL RECYCLE BIN & FINANCIAL RECORD RECOVERY               */}
          {/* ================================================================ */}
          {(activeSection === '14_recycle_bin' || activeSection === '13_recycle_bin') && (
            <GlobalRecycleBinModule
              onRecordRestored={(item) => {
                triggerToast('success', `Restored ${item.recordType} '${item.identifier}' back to live ledger.`);
              }}
            />
          )}

          {/* ================================================================ */}
          {/* 09: DATABASE MANAGEMENT HUB                                      */}
          {/* ================================================================ */}
          {activeSection === '09_database_hub' && (
            <DatabaseHubView
              campuses={campuses}
              transactions={transactions}
              pettyCashTransactions={pettyCashTransactions}
              accountHeads={accountHeads}
              users={users}
              triggerToast={triggerToast}
            />
          )}

          {/* ================================================================ */}
          {/* 10: CLOUD SYNCHRONIZATION CENTER                                 */}
          {/* ================================================================ */}
          {activeSection === '10_cloud_sync' && (
            <CloudSyncCenterView triggerToast={triggerToast} />
          )}

          {/* ================================================================ */}
          {/* 11: INDEXEDDB & OFFLINE QUEUE                                    */}
          {/* ================================================================ */}
          {activeSection === '11_offline_indexeddb' && (
            <OfflineQueueView triggerToast={triggerToast} />
          )}

          {/* ================================================================ */}
          {/* 13: BACKUP, DISASTER RECOVERY & MASTER SNAPSHOTS                 */}
          {/* ================================================================ */}
          {(activeSection === '13_backup_dr' || activeSection === '12_backup_settings') && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <CloudDownload className="w-5 h-5 text-indigo-400" />
                  <span>Platform Disaster Recovery & Master Snapshots</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Platform owner controls, point-in-time database backups, and emergency recovery utilities.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Disaster Recovery Box */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <CloudUpload className="w-4 h-4 text-indigo-400" />
                    <span>Disaster Recovery & Master Snapshots</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Creates an encrypted point-in-time snapshot of all school clients, campus ledgers, and Chart of Accounts to Google Cloud Firestore.
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Last Cloud Backup: {settings.lastDisasterRecoveryBackupAt ? new Date(settings.lastDisasterRecoveryBackupAt).toLocaleString() : 'Never'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateDisasterRecoverySnapshot}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CloudUpload className="w-4 h-4" />
                    <span>Create Full Master Backup Snapshot</span>
                  </button>
                </div>

                {/* Maintenance Mode Box */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Radio className="w-4 h-4 text-rose-400" />
                    <span>Platform Maintenance Mode</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    When active, normal client and campus logins are locked out with a maintenance notice. Only the Platform Creator can access the system.
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-slate-300">
                      Current Mode: <strong className={settings.maintenanceMode ? 'text-rose-400' : 'text-emerald-400'}>{settings.maintenanceMode ? 'ACTIVE (Locked)' : 'NORMAL'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleMaintenanceMode}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        settings.maintenanceMode
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {settings.maintenanceMode ? 'Deactivate Lock' : 'Activate Maintenance'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 20: AUDIT LOGS & SECURITY MONITOR                                */}
          {/* ================================================================ */}
          {(activeSection === '20_audit_logs' || activeSection === '10_audit_security') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-400" />
                    <span>Cross-Campus Security & Forensic Audit Logs</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live detection of permission changes, failed logins, and cross-campus data isolation integrity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAuditLogs(getStoredPlatformAuditLogs())}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {/* Forensic Audit Trail Embedded Component */}
              <SecureAuditTrail />
            </div>
          )}

          {/* ================================================================ */}
          {/* 21: SECURITY & SESSION CONTROL                                   */}
          {/* ================================================================ */}
          {activeSection === '21_security_sessions' && (
            <SecuritySessionsView
              settings={settings}
              onUpdateSettings={setSettings}
              triggerToast={triggerToast}
            />
          )}

          {/* ================================================================ */}
          {/* 22: SYSTEM CONFIGURATION                                          */}
          {/* ================================================================ */}
          {activeSection === '22_system_config' && (
            <SystemConfigView
              settings={settings}
              onUpdateSettings={setSettings}
              triggerToast={triggerToast}
            />
          )}

          {/* ================================================================ */}
          {/* 23: INTEGRATION & API MANAGEMENT                                  */}
          {/* ================================================================ */}
          {activeSection === '23_integrations' && (
            <IntegrationsApiView triggerToast={triggerToast} />
          )}

          {/* ================================================================ */}
          {/* 24: APPLICATION HEALTH MONITORING                                */}
          {/* ================================================================ */}
          {activeSection === '24_health_monitor' && <HealthMonitorView />}

          {/* ================================================================ */}
          {/* 12: SERVICE WORKER & PWA                                          */}
          {/* ================================================================ */}
          {activeSection === '12_service_worker' && (
            <ServiceWorkerPwaView triggerToast={triggerToast} />
          )}

          {/* ================================================================ */}
          {/* 25: MAINTENANCE & RELEASES                                        */}
          {/* ================================================================ */}
          {activeSection === '25_maintenance_release' && (
            <MaintenanceReleaseView
              settings={settings}
              onToggleMaintenance={handleToggleMaintenanceMode}
              triggerToast={triggerToast}
            />
          )}

          {/* ================================================================ */}
          {/* GLOBAL MULTI-CAMPUS SEARCH                                       */}
          {/* ================================================================ */}
          {(activeSection === 'global_search' || activeSection === '14_global_search') && (
            <GlobalRecordSearchModule />
          )}
        </main>
      </div>

      {/* CLIENT REGISTRATION MODAL */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-black text-white">
                {clientFormId ? 'Edit School Client Organization' : 'Register New School Client Organization'}
              </h4>
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Institution / Network Name</label>
                <input
                  type="text"
                  value={clientFormName}
                  onChange={(e) => setClientFormName(e.target.value)}
                  placeholder="e.g. Lahore Grammar School Network"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">Client Organization Custom Logo (URL or Upload)</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                    {clientFormLogoUrl ? (
                      <img src={clientFormLogoUrl} alt="Logo Preview" className="w-full h-full object-contain p-1 bg-white" />
                    ) : (
                      <Building2 className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={clientFormLogoUrl}
                      onChange={(e) => setClientFormLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png or choose file"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
                    />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 text-[10px] font-bold cursor-pointer">
                        <span>Upload Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === 'string') {
                                  setClientFormLogoUrl(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {clientFormLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setClientFormLogoUrl('')}
                          className="text-[10px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Client Code Identifier</label>
                  <input
                    type="text"
                    value={clientFormCode}
                    onChange={(e) => setClientFormCode(e.target.value)}
                    placeholder="e.g. LGS"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500 uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Licensing Plan</label>
                  <select
                    value={clientFormTier}
                    onChange={(e: any) => setClientFormTier(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="Starter">Starter (Up to 3 Campuses)</option>
                    <option value="Professional">Professional (Up to 8 Campuses)</option>
                    <option value="Enterprise">Enterprise (Unlimited Campuses)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Contact Person</label>
                  <input
                    type="text"
                    value={clientFormContact}
                    onChange={(e) => setClientFormContact(e.target.value)}
                    placeholder="e.g. Dr. Salman Khan"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Contact Email</label>
                  <input
                    type="email"
                    value={clientFormEmail}
                    onChange={(e) => setClientFormEmail(e.target.value)}
                    placeholder="e.g. director@lgs.edu.pk"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                  />
                </div>
              </div>

              {/* Automatically register Primary Main Campus against this Organization */}
              {!clientFormId && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-400" />
                      <span className="font-black text-white text-xs">
                        🏛️ Register Main Campus Against Organization
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-[11px] text-indigo-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clientFormRegisterMainCampus}
                        onChange={(e) => setClientFormRegisterMainCampus(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>Register Main Campus</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Establishes the Primary Main Campus for this client organization. All subsequent sub-campuses will report to this Main Campus.
                  </p>

                  {clientFormRegisterMainCampus && (
                    <div className="space-y-3 pt-2 border-t border-indigo-900/60">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">Main Campus Name</label>
                          <input
                            type="text"
                            value={clientFormMainCampusName}
                            onChange={(e) => setClientFormMainCampusName(e.target.value)}
                            placeholder={clientFormName ? `${clientFormName} Main Campus` : "e.g. Central Main Campus"}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">Main Campus Code</label>
                          <input
                            type="text"
                            value={clientFormMainCampusCode}
                            onChange={(e) => setClientFormMainCampusCode(e.target.value.toUpperCase())}
                            placeholder={clientFormCode ? `${clientFormCode}-MAIN` : "e.g. MAIN"}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none uppercase focus:border-indigo-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">City / Location</label>
                          <input
                            type="text"
                            value={clientFormMainCampusCity}
                            onChange={(e) => setClientFormMainCampusCity(e.target.value)}
                            placeholder="e.g. Lahore / Islamabad"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">Imprest Float (PKR)</label>
                          <input
                            type="number"
                            value={clientFormMainCampusFloat}
                            onChange={(e) => setClientFormMainCampusFloat(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-400"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold">Admin Password</label>
                          <input
                            type="text"
                            value={clientFormMainCampusPassword}
                            onChange={(e) => setClientFormMainCampusPassword(e.target.value)}
                            placeholder="campus"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer"
                >
                  Save Client Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================================================================ */}
      {/* CAMPUS / SUB-CAMPUS REGISTRATION MODAL                            */}
      {/* ================================================================ */}
      {isCampusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">
                    {newCampusParentId !== 'none' && newCampusParentId
                      ? 'Register Sub-Campus under Parent'
                      : 'Register New Campus Branch'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {newCampusParentId !== 'none' && newCampusParentId
                      ? `Creating a child branch that reports to parent hierarchy.`
                      : `Set up a main campus branch in the institutional directory.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCampusModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCampusOrSubCampus} className="space-y-4 text-xs">
              {/* Assign to School Client Organization */}
              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  Assign to School Client Organization:
                </label>
                <select
                  value={newCampusClientId}
                  onChange={(e) => {
                    const cid = e.target.value;
                    setNewCampusClientId(cid);
                    if (cid) {
                      const clientMain = campuses.find((c: any) => c.clientId === cid && (c.isMainCampus || !c.parentCampusId));
                      if (clientMain && newCampusParentId !== 'none') {
                        setNewCampusParentId(clientMain.id);
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Platform Default (Aplus School System)</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} ({cl.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Assigning an organization isolates this campus, its vouchers, and subordinate branches to that specific client.
                </p>
              </div>

              {/* Hierarchy Level Type */}
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Campus Hierarchy Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCampusParentId('none')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors cursor-pointer ${
                      newCampusParentId === 'none'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Main Campus (Parent)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (campuses.length > 0 && newCampusParentId === 'none') {
                        const matching = newCampusClientId
                          ? campuses.find((c: any) => c.clientId === newCampusClientId && (c.isMainCampus || !c.parentCampusId))
                          : null;
                        setNewCampusParentId(matching?.id || campuses[0].id);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition-colors cursor-pointer ${
                      newCampusParentId !== 'none'
                        ? 'bg-sky-950 text-sky-300 border-sky-600'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Sub-Campus (Child Branch)
                  </button>
                </div>
              </div>

              {/* If Sub-Campus, pick Parent Campus */}
              {newCampusParentId !== 'none' && (
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800">
                  <label className="block text-sky-300 mb-1 font-bold">
                    Select Parent Campus to Report To:
                  </label>
                  <select
                    value={newCampusParentId}
                    onChange={(e) => setNewCampusParentId(e.target.value)}
                    className="w-full bg-slate-950 border border-sky-700/80 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-400 cursor-pointer"
                    required
                  >
                    {campuses
                      .filter((c: any) => !newCampusClientId || c.clientId === newCampusClientId || !c.clientId)
                      .map((c) => {
                        const campusClient = clients.find((cl) => cl.id === (c as any).clientId);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code}) {(c as any).isMainCampus || !(c as any).parentCampusId ? '— Main Campus' : '— Branch'}
                            {campusClient ? ` [${campusClient.code}]` : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>
              )}

              {/* Campus Name and Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Campus Branch Name</label>
                  <input
                    type="text"
                    value={newCampusName}
                    onChange={(e) => setNewCampusName(e.target.value)}
                    placeholder="e.g. Model Town Boys Campus"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Unique Campus Code</label>
                  <input
                    type="text"
                    value={newCampusCode}
                    onChange={(e) => setNewCampusCode(e.target.value.toUpperCase())}
                    placeholder="e.g. MTB-01"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-emerald-500 uppercase"
                    required
                  />
                </div>
              </div>

              {/* City and Accountant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">City / Location</label>
                  <input
                    type="text"
                    value={newCampusCity}
                    onChange={(e) => setNewCampusCity(e.target.value)}
                    placeholder="e.g. Gujranwala, Punjab"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Branch Accountant / In-Charge</label>
                  <input
                    type="text"
                    value={newCampusAccountant}
                    onChange={(e) => setNewCampusAccountant(e.target.value)}
                    placeholder="e.g. Muhammad Aslam"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Petty Cash Float and Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Petty Cash Float (PKR)</label>
                  <input
                    type="number"
                    value={newCampusFloat}
                    onChange={(e) => setNewCampusFloat(e.target.value)}
                    placeholder="35000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Campus Access Key / Password</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCampusPassword}
                      onChange={(e) => setNewCampusPassword(e.target.value)}
                      placeholder="e.g. CAMPUS@2026"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNewCampusPassword(generateDynamicPassword(newCampusCode || 'CAMP'))}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold shrink-0 border border-slate-700"
                      title="Generate dynamic password"
                    >
                      Gen
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCampusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {newCampusParentId !== 'none' && newCampusParentId
                      ? 'Register Sub-Campus'
                      : 'Register Main Campus'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* HIERARCHICAL LOGIN & ACCESS GENERATOR MODAL                       */}
      {/* ================================================================ */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">
                    {selectedUserToEdit ? 'Edit User Credentials & Scope' : 'Hierarchical Login & Access Generator'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Multi-tier user provisioning with permission scoping and audit tracking.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUserAccount} className="space-y-4 text-xs">
              {/* Step 1: Account Level */}
              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  1. Account Level & Authority Hierarchy
                </label>
                <select
                  value={userFormLevel}
                  onChange={(e: any) => setUserFormLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="level_1_platform_super_admin">
                    Level 1 — Platform Super Admin (Platform Creator / Full Central Access)
                  </option>
                  <option value="level_2_client_admin">
                    Level 2 — School Client / Organization Admin (Owns Institution Network)
                  </option>
                  <option value="level_3_main_campus_admin">
                    Level 3 — Main Campus Admin (Controls Main Campus + Delegated Sub-Campuses)
                  </option>
                  <option value="level_4_sub_campus_admin">
                    Level 4 — Sub-Campus Admin (Manages Single Sub-Campus Operations)
                  </option>
                  <option value="level_5_departmental_user">
                    Level 5 — Departmental Staff (Accountant, Cashier, Auditor, Viewer)
                  </option>
                </select>
              </div>

              {/* Step 2: Role and Campus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">2. Assign Role Type</label>
                  <select
                    value={userFormRole}
                    onChange={(e) => setUserFormRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Accountant">Campus Accountant</option>
                    <option value="Cashier">Petty Cashier</option>
                    <option value="Principal">Campus Principal / Director</option>
                    <option value="Auditor">Internal Auditor</option>
                    <option value="Viewer">Read-Only Viewer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">3. Assigned Campus Branch</label>
                  <select
                    value={userFormCampusId}
                    onChange={(e) => setUserFormCampusId(e.target.value)}
                    disabled={userFormLevel === 'level_1_platform_super_admin'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {userFormLevel === 'level_1_platform_super_admin' ? (
                      <option value="all">All Campuses (Central Platform)</option>
                    ) : (
                      campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code}) {(c as any).isMainCampus || !(c as any).parentCampusId ? '— Main Campus' : '— Sub-Branch'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Step 3: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">4. Full Name</label>
                  <input
                    type="text"
                    value={userFormName}
                    onChange={(e) => setUserFormName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">5. Verified Email Address</label>
                  <input
                    type="email"
                    value={userFormEmail}
                    onChange={(e) => setUserFormEmail(e.target.value)}
                    placeholder="e.g. t.mehmood@school.edu.pk"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Step 4: Login Username & Dynamic Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">6. Login Username</label>
                  <input
                    type="text"
                    value={userFormUsername}
                    onChange={(e) => setUserFormUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    placeholder="e.g. tmehmood"
                    disabled={!!selectedUserToEdit}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-500 disabled:opacity-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-bold">
                    7. Password {selectedUserToEdit ? '(Leave blank to keep existing)' : ''}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      placeholder={selectedUserToEdit ? 'Keep unchanged' : 'Secure password'}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setUserFormPassword(generateDynamicPassword('ACC'))}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold shrink-0 border border-slate-700"
                      title="Generate dynamic secure password"
                    >
                      Gen
                    </button>
                    {userFormPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            `Username: ${userFormUsername}\nPassword: ${userFormPassword}`
                          );
                          triggerToast('success', 'Credentials copied to clipboard!');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-indigo-300 font-bold shrink-0 border border-indigo-800"
                        title="Copy credentials"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{selectedUserToEdit ? 'Save Changes' : 'Generate & Activate Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* EDIT CAMPUS PARAMETERS MODAL                                      */}
      {/* ================================================================ */}
      {editingCampus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full p-6 text-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Edit Campus Branch Parameters</h3>
                  <p className="text-[11px] text-slate-400">
                    Modify branch operational details, parent hierarchy, and accountant assignment.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCampus(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditCampus} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Campus Branch Name</label>
                  <input
                    type="text"
                    value={editCampusName}
                    onChange={(e) => setEditCampusName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Campus Code</label>
                  <input
                    type="text"
                    value={editCampusCode}
                    onChange={(e) => setEditCampusCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500 uppercase"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">City / Location</label>
                  <input
                    type="text"
                    value={editCampusCity}
                    onChange={(e) => setEditCampusCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Branch Accountant</label>
                  <input
                    type="text"
                    value={editCampusAccountant}
                    onChange={(e) => setEditCampusAccountant(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Petty Cash Float (PKR)</label>
                  <input
                    type="number"
                    value={editCampusFloat}
                    onChange={(e) => setEditCampusFloat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-bold">Operational Status</label>
                  <select
                    value={editCampusStatus}
                    onChange={(e) => setEditCampusStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-bold">
                  Parent Campus Hierarchy Relationship:
                </label>
                <select
                  value={editCampusParentId}
                  onChange={(e) => setEditCampusParentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="none">-- Standalone Main Campus (No Parent) --</option>
                  {campuses
                    .filter((c) => c.id !== editingCampus.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Parent: {c.name} ({c.code}) {(c as any).isMainCampus || !(c as any).parentCampusId ? '— Main Campus' : '— Branch'}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Selecting a parent campus makes this branch a satellite sub-campus that reports financial transactions upward.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-bold text-white block">Direct Login Access</span>
                  <span className="text-[11px] text-slate-400">Allow accountants to sign in using this campus identity</span>
                </div>
                <input
                  type="checkbox"
                  checked={editCampusLoginEnabled}
                  onChange={(e) => setEditCampusLoginEnabled(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCampus(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* DELETE CAMPUS CONFIRMATION MODAL                                  */}
      {/* ================================================================ */}
      {deletingCampus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-900/80 rounded-3xl shadow-2xl max-w-lg w-full p-6 text-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-white">
                  Confirm Deletion of Campus Branch
                </h3>
                <p className="text-xs text-rose-300 font-bold mt-0.5">
                  {deletingCampus.name} ({deletingCampus.code})
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Are you sure you want to delete this campus branch from the system?
                </p>
              </div>
            </div>

            {/* Check child sub-campuses */}
            {(() => {
              const childSubs = campuses.filter((c: any) => c.parentCampusId === deletingCampus.id);
              const branchTxCount = transactions.filter((t) => t.campusId === deletingCampus.id).length;

              return (
                <div className="space-y-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
                  {childSubs.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-[11px] space-y-1">
                      <span className="font-bold flex items-center gap-1.5 text-amber-300">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{childSubs.length} Sub-Campuses Report to this Parent</span>
                      </span>
                      <p className="text-[11px] leading-relaxed">
                        To protect database integrity and prevent circular crashes, all {childSubs.length} child sub-branches will be safely detached and converted to standalone main campuses.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Linked Vouchers:</span>
                    <strong className="text-white font-mono">{branchTxCount} transactions</strong>
                  </div>

                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Imprest Cash Float:</span>
                    <strong className="text-emerald-400 font-mono">
                      PKR {(deletingCampus.pettyCashFloat || 0).toLocaleString()}
                    </strong>
                  </div>

                  <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-900 text-indigo-300 text-[10px]">
                    🛡️ <strong>Safety Guarantee:</strong> This campus and its metadata will be preserved in the <strong>Global Recycle Bin</strong> for 1-click recovery if needed.
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCampus(null)}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCampus}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Delete Campus</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* CLIENT ERP MODULES GOVERNANCE MODAL                               */}
      {/* ================================================================ */}
      {managingModulesClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full p-6 text-slate-100 max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white flex items-center gap-2">
                    <span>Manage ERP Modules</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {managingModulesClient.name} ({managingModulesClient.code})
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Control which accounting, audit, reporting, and governance modules are visible to this client organization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingModulesClient(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            {/* Quick Preset Selector Toolbar */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 mb-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-300">
                Quick Module Presets:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setClientSelectedModules(PLATFORM_CLIENT_MODULES.map((m) => m.id))}
                  className="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Enterprise (All 16)
                </button>
                <button
                  type="button"
                  onClick={() => setClientSelectedModules([...DEFAULT_CLIENT_MODULES])}
                  className="px-2.5 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Standard ERP (15)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setClientSelectedModules(['dashboard', 'transaction', 'alltransactions', 'pettycash', 'reports'])
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Minimal Cashbook (5)
                </button>
                <button
                  type="button"
                  onClick={() => setClientSelectedModules(['dashboard'])}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
                >
                  Clear Non-Core
                </button>
              </div>
            </div>

            {/* Scrollable Module Checklist by Category */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              {(['Core Financials', 'Audit & Compliance', 'Analytics & Operations', 'Governance & Tools'] as const).map(
                (category) => {
                  const categoryModules = PLATFORM_CLIENT_MODULES.filter((m) => m.category === category);
                  const activeInCategory = categoryModules.filter((m) => clientSelectedModules.includes(m.id)).length;

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-1 border-b border-slate-800">
                        <span className="uppercase tracking-wider text-[11px] text-indigo-400">
                          {category}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {activeInCategory} / {categoryModules.length} Active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {categoryModules.map((module) => {
                          const isChecked = clientSelectedModules.includes(module.id);
                          const isCore = module.isCore;

                          return (
                            <div
                              key={module.id}
                              onClick={() => !isCore && handleToggleClientModule(module.id)}
                              className={`p-3 rounded-xl border text-xs transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                                isChecked
                                  ? 'bg-slate-950 border-indigo-700/80 shadow-xs'
                                  : 'bg-slate-950/50 border-slate-800/80 opacity-70 hover:opacity-100 hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isCore}
                                onChange={() => handleToggleClientModule(module.id)}
                                className="w-4 h-4 rounded accent-indigo-600 mt-0.5 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs">{module.name}</span>
                                  {isCore && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                      Core
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                                  {module.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {/* Modal Footer with Active Summary & Save Button */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4 shrink-0">
              <div className="text-xs text-slate-400">
                Total Modules Active: <strong className="text-indigo-400">{clientSelectedModules.length}</strong> of{' '}
                {PLATFORM_CLIENT_MODULES.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingModulesClient(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClientModules}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Client Modules</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================================================================ */}
      {/* DEPLOYMENT READINESS & PRE-FLIGHT VERIFICATION MODAL              */}
      {/* ================================================================ */}
      {showDeploymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-4xl w-full max-h-[92vh] overflow-y-auto">
            <DeploymentReadinessHub
              onClose={() => setShowDeploymentModal(false)}
              onNavigateToCampusOperations={() => {
                setShowDeploymentModal(false);
                if (onSwitchToCampusView) onSwitchToCampusView();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
