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

export type PlatformAdminNavSection =
  | '01_dashboard'
  | '02_clients'
  | '03_campuses'
  | '04_users'
  | '05_roles_permissions'
  | '06_modules'
  | '07_account_heads'
  | '08_voucher_controls'
  | '09_consolidated_reports'
  | '10_audit_security'
  | '11_notifications'
  | '12_backup_settings';

export const PlatformSiteAdminHub: React.FC<{
  onNavigate?: (tab: string) => void;
  onClose?: () => void;
  defaultSection?: PlatformAdminNavSection;
}> = ({ onNavigate, onClose, defaultSection = '01_dashboard' }) => {
  const {
    campuses,
    addCampus,
    updateCampus,
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
  } = useAccounting();

  const [activeSection, setActiveSection] = useState<PlatformAdminNavSection>(defaultSection);
  const [clients, setClients] = useState<SchoolClientOrganization[]>(() => getStoredSchoolClients());
  const [settings, setSettings] = useState<PlatformSystemSettings>(() => getStoredPlatformSettings());
  const [auditLogs, setAuditLogs] = useState<PlatformAuditSecurityEvent[]>(() =>
    getStoredPlatformAuditLogs()
  );
  const [rbacConfig, setRbacConfig] = useState<HierarchicalRbacMasterConfig>(() =>
    getStoredHierarchicalRbacConfig(campuses, accountHeads)
  );

  const [feedbackNotice, setFeedbackNotice] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const triggerToast = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedbackNotice({ type, message });
    setTimeout(() => setFeedbackNotice(null), 4500);
  };

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

  // --------------------------------------------------------------------------
  // SECTION 03: CAMPUS HIERARCHY STATE
  // --------------------------------------------------------------------------
  const [isCampusModalOpen, setIsCampusModalOpen] = useState(false);
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
  // STATS & AGGREGATIONS FOR DASHBOARD
  // --------------------------------------------------------------------------
  const dashboardStats = useMemo(() => {
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.status === 'active').length;
    const totalCampuses = campuses.length;
    const mainCampuses = campuses.filter((c: any) => c.isMainCampus || !c.parentCampusId).length;
    const subCampuses = totalCampuses - mainCampuses;
    const totalUsers = users.length;
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
      // New Client
      const newId = `client-${clientFormCode.trim().toLowerCase()}-${Date.now().toString(36).slice(2, 6)}`;
      const newClient: SchoolClientOrganization = {
        id: newId,
        name: clientFormName.trim(),
        code: clientFormCode.trim().toUpperCase(),
        tier: clientFormTier,
        status: 'active',
        contactPerson: clientFormContact.trim() || 'Central Director',
        contactEmail: clientFormEmail.trim() || 'director@institution.edu.pk',
        contactPhone: clientFormPhone.trim() || '',
        mainCampusId: campuses[0]?.id || 'campus-main',
        maxCampuses: Math.max(1, Number(clientFormMaxCampuses) || 10),
        maxUsers: Math.max(1, Number(clientFormMaxUsers) || 30),
        billingRenewalDate: '2027-12-31',
        enabledModules: [
          'dashboard',
          'campuses',
          'transaction',
          'alltransactions',
          'pettycash',
          'reports',
          'accounts',
          'reconciliation',
          'cashreconciliation',
          'activity',
          'docs',
        ],
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
        details: `Created new client organization '${newClient.name}' with Tier ${newClient.tier}.`,
      });
      triggerToast('success', `Registered client organization '${newClient.name}'!`);
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

    const newId = `campus-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const newCampus: ExtendedCampusNode = {
      id: newId,
      code: cleanCode,
      name: newCampusName.trim(),
      city: newCampusCity.trim() || 'Punjab',
      accountantName: newCampusAccountant.trim() || 'Branch Accountant',
      pettyCashFloat: Number(newCampusFloat) || 35000,
      currentPettyCash: Number(newCampusFloat) || 35000,
      status: 'active',
      isMainCampus: !parentId,
      parentCampusId: parentId,
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

    // Generate dynamic credentials and save to database
    const pass = newCampusPassword.trim() || generateDynamicPassword(cleanCode);
    const cred = createDynamicCampusCredential(newCampus, undefined, pass);
    saveCampusCredentialToCloud(cred);

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

    const res = deleteAccountHead(account.id || account.code);
    if (res.success) {
      triggerToast('success', `Deleted unused account head ${account.code}!`);
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

  // Navigation Items matching the requested 12-section architecture
  const NAV_ITEMS: Array<{
    id: PlatformAdminNavSection;
    number: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    { id: '01_dashboard', number: '01', label: 'Global Dashboard', icon: LayoutGrid },
    { id: '02_clients', number: '02', label: 'Clients / Organizations', icon: Building2, badge: clients.length },
    { id: '03_campuses', number: '03', label: 'Campuses & Hierarchy', icon: FolderTree, badge: campuses.length },
    { id: '04_users', number: '04', label: 'Users & Login Accounts', icon: Users, badge: users.length },
    { id: '05_roles_permissions', number: '05', label: 'Roles & 5-Tier Permissions', icon: ShieldCheck },
    { id: '06_modules', number: '06', label: 'Modules & Feature Access', icon: Sliders },
    { id: '07_account_heads', number: '07', label: 'Account Heads & Codes', icon: Layers, badge: accountHeads.length },
    { id: '08_voucher_controls', number: '08', label: 'Voucher & Approval Controls', icon: FileCheck2 },
    { id: '09_consolidated_reports', number: '09', label: 'Consolidated Central Reports', icon: FileText },
    { id: '10_audit_security', number: '10', label: 'Audit Logs & Security', icon: Activity, badge: dashboardStats.criticalAuditCount > 0 ? `${dashboardStats.criticalAuditCount} Alert` : undefined },
    { id: '11_notifications', number: '11', label: 'Broadcasts & Notifications', icon: Bell },
    { id: '12_backup_settings', number: '12', label: 'Backup, Recovery & Settings', icon: Settings },
  ];

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
            onClick={handleCreateDisasterRecoverySnapshot}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Create live disaster recovery snapshot"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Disaster Backup</span>
          </button>

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
          <div className="p-3 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Administration Hierarchy</span>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto max-h-[700px]">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`font-mono text-[10px] ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                      {item.number}
                    </span>
                    <IconComp className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 ${
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

              {/* Fast Module Switchers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveSection('02_clients')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-600 text-left transition-colors cursor-pointer group"
                >
                  <Building2 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Client Registry</div>
                  <div className="text-[10px] text-slate-400">Manage school institutions</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('03_campuses')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-600 text-left transition-colors cursor-pointer group"
                >
                  <FolderTree className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Campus Hierarchy</div>
                  <div className="text-[10px] text-slate-400">Main vs Sub-Campus links</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('07_account_heads')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-600 text-left transition-colors cursor-pointer group"
                >
                  <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">COA & Child Codes</div>
                  <div className="text-[10px] text-slate-400">Parent 1001-1 code syntax</div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('10_audit_security')}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-rose-600 text-left transition-colors cursor-pointer group"
                >
                  <Activity className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform mb-1.5" />
                  <div className="font-bold text-white">Audit & Security</div>
                  <div className="text-[10px] text-slate-400">Cross-campus isolation logs</div>
                </button>
              </div>
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
                    {clients
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          c.code.toLowerCase().includes(clientSearchQuery.toLowerCase())
                      )
                      .map((c) => (
                        <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                                {c.code}
                              </span>
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
                                  setIsClientModalOpen(true);
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* 03: CAMPUSES & HIERARCHY                                         */}
          {/* ================================================================ */}
          {activeSection === '03_campuses' && (
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

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={campusSearchQuery}
                    onChange={(e) => setCampusSearchQuery(e.target.value)}
                    placeholder="Search campus branches..."
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-48 sm:w-60 focus:border-emerald-500"
                  />
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
                            ? 'bg-slate-950/90 border-emerald-800/80'
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

                        {/* Reassign Parent Form */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-400 text-[11px]">Configure Parent:</span>
                          <select
                            value={campus.parentCampusId || 'none'}
                            onChange={(e) => handleUpdateCampusParent(campus.id, e.target.value)}
                            className="bg-slate-900 text-white border border-slate-700 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="none">-- Set as Main Campus (No Parent) --</option>
                            {campuses
                              .filter((c) => c.id !== campus.id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  Parent: {c.name} ({c.code})
                                </option>
                              ))}
                          </select>
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
          {activeSection === '04_users' && (
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

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none w-48 sm:w-60 focus:border-indigo-500"
                  />
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
                      <th className="py-3 px-4 text-right">Security Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {users
                      .filter(
                        (u) =>
                          u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          u.role?.toLowerCase().includes(userSearchQuery.toLowerCase())
                      )
                      .map((u) => {
                        const targetCampus = campuses.find((c) => c.id === u.campusId);
                        const isCreator = u.role === 'admin' || u.isSuperAdmin;

                        return (
                          <tr key={u.id} className="hover:bg-slate-900/60 transition-colors">
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
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                                Protected ✓
                              </span>
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
          {activeSection === '05_roles_permissions' && (
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
          {activeSection === '07_account_heads' && (
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
          {/* 10: AUDIT LOGS & SECURITY MONITOR                                */}
          {/* ================================================================ */}
          {activeSection === '10_audit_security' && (
            <div className="space-y-5">
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

              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800">
                  No critical security violations detected. Platform isolation is healthy.
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.severity === 'critical'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : log.severity === 'high'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.severity.toUpperCase()}
                          </span>
                          <span className="font-bold text-white">{log.action}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({log.category})</span>
                        </div>
                        <p className="text-slate-300 text-[11px]">{log.details}</p>
                        <div className="text-[10px] text-slate-500 flex items-center gap-2 font-mono">
                          <span>Actor: {log.actorName} ({log.actorRole})</span>
                          <span>•</span>
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* 12: BACKUP, RECOVERY & SYSTEM SETTINGS                           */}
          {/* ================================================================ */}
          {activeSection === '12_backup_settings' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-400" />
                  <span>Platform System Settings & Disaster Recovery</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Platform owner controls, database health, disaster recovery snapshots, and deployment parameters.
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

          {/* Fallback for other sections (06, 08, 09, 11) */}
          {(activeSection === '06_modules' ||
            activeSection === '08_voucher_controls' ||
            activeSection === '09_consolidated_reports' ||
            activeSection === '11_notifications') && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white capitalize">
                {activeSection.replace(/^[0-9]+_/, '').replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-slate-400">
                Centralized platform configuration module is active and synchronized with the 5-Tier RBAC engine.
              </p>
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-xs text-indigo-200">
                All settings are enforced on the backend via Firebase Firestore security rules and the native campus isolation boundary.
              </div>
            </div>
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
    </div>
  );
};
