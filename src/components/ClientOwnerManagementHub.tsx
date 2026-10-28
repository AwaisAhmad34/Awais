import React, { useState, useMemo } from 'react';
import {
  Building2,
  FolderTree,
  Users,
  CreditCard,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  KeyRound,
  Download,
  Printer,
  ChevronRight,
  TrendingUp,
  DollarSign,
  PieChart,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  X,
  ExternalLink,
  Layers,
  ArrowRight,
  Sparkles,
  Edit3,
  Trash2,
  Sliders,
} from 'lucide-react';
import { useAccounting, Campus, Transaction, PettyCashTransaction } from '../core/aplusEngine';
import {
  SchoolClientOrganization,
  getStoredSchoolClients,
  saveStoredSchoolClients,
  syncSchoolClientsToCloud,
  DEFAULT_CLIENT_MODULES,
} from '../services/platformSiteAdminService';
import { softDeleteRecord } from '../services/globalRecoveryService';
import {
  SubscriptionInvoice,
  getStoredSubscriptionInvoices,
  getClientBillingSummary,
} from '../services/billingAndSubscriptionService';
import {
  REPORT_CATEGORIES_REGISTRY,
  getReportsForClient,
  getReportsForCampus,
  setCampusReportPermissions,
  getStoredCampusReportMatrices,
} from '../services/reportPermissionMatrixService';
import {
  filterCampusesForUser,
  filterTransactionsForUser,
  filterPettyCashForUser,
  validateCampusCreationLimit,
} from '../services/multiTenantDataService';
import { CampusMonthlyBudgetExpenditureChart } from './CampusMonthlyBudgetExpenditureChart';

interface ClientOwnerManagementHubProps {
  onSwitchToCampusOperationalView: (campusId: string) => void;
}

export const ClientOwnerManagementHub: React.FC<ClientOwnerManagementHubProps> = ({
  onSwitchToCampusOperationalView,
}) => {
  const {
    currentUser,
    campuses,
    addCampus,
    updateCampus,
    deleteCampus,
    users,
    addUser,
    updateUser,
    resetUserPassword,
    transactions,
    pettyCashTransactions,
    logActivity,
  } = useAccounting();

  // Active Hub Tab: Overview | Sub-Campuses & Logins | Report Permissions Matrix | Subscription & Billing | Consolidated Reports
  const [activeTab, setActiveTab] = useState<
    'overview' | 'sub_campuses' | 'report_permissions' | 'billing' | 'consolidated_reports'
  >('overview');

  // Trigger re-render when client organization profile is customized
  const [clientRefreshKey, setClientRefreshKey] = useState(0);

  // Client resolution from currentUser
  const userClientId = currentUser?.clientId || 'client-aplus';

  // Client metadata (reads live from Platform Admin configuration if present)
  const clientInfo: SchoolClientOrganization = useMemo(() => {
    const liveClient = getStoredSchoolClients().find((c) => c.id === userClientId);
    if (liveClient) return liveClient;

    if (userClientId === 'client-apex') {
      return {
        id: 'client-apex',
        name: 'Apex School System',
        code: 'APEX',
        tier: 'Professional',
        status: 'active',
        contactPerson: 'Principal M. Siddique (Apex Main)',
        contactEmail: 'admin@apex.edu.pk',
        contactPhone: '+92 321 7773344',
        mainCampusId: 'campus-apex-main',
        maxCampuses: 6,
        maxUsers: 20,
        billingRenewalDate: '2027-08-31',
        enabledModules: ['dashboard', 'campuses', 'transaction', 'alltransactions', 'pettycash', 'reports'],
        createdAt: '2026-02-15T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      id: 'client-aplus',
      name: 'Aplus School System',
      code: 'APLUS',
      tier: 'Professional',
      status: 'active',
      contactPerson: 'Director Finance & Operations',
      contactEmail: 'admin@aplus.edu.pk',
      contactPhone: '+92 300 5551122',
      mainCampusId: 'campus-aplus-main',
      maxCampuses: 8,
      maxUsers: 30,
      billingRenewalDate: '2027-10-31',
      enabledModules: ['dashboard', 'campuses', 'transaction', 'alltransactions', 'pettycash', 'reports'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };
  }, [userClientId, clientRefreshKey]);

  // Strictly filter client's own campuses (Never leak other client's campuses!)
  const myCampuses = useMemo(() => {
    return filterCampusesForUser(campuses, currentUser);
  }, [campuses, currentUser]);

  const mainCampus = useMemo(() => {
    return myCampuses.find((c) => c.isMainCampus || !c.parentCampusId) || myCampuses[0];
  }, [myCampuses]);

  const subCampuses = useMemo(() => {
    return myCampuses.filter((c) => c.id !== mainCampus?.id);
  }, [myCampuses, mainCampus]);

  // Billing statistics & invoices for this client
  const billingSummary = useMemo(() => {
    return getClientBillingSummary(clientInfo.id, campuses);
  }, [clientInfo.id, campuses]);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // --------------------------------------------------------------------------
  // CREATE SUB-CAMPUS & LOGIN MODAL STATE
  // --------------------------------------------------------------------------
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [newBranchAccountant, setNewBranchAccountant] = useState('');
  const [newBranchFloat, setNewBranchFloat] = useState(35000);
  const [newBranchPassword, setNewBranchPassword] = useState('');
  const [newBranchModules, setNewBranchModules] = useState<string[]>([
    'dashboard',
    'transaction',
    'alltransactions',
    'pettycash',
    'reports',
  ]);

  // Edit Organization Client Profile / Brand Modal State
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [orgCodeInput, setOrgCodeInput] = useState('');
  const [orgContactInput, setOrgContactInput] = useState('');
  const [orgEmailInput, setOrgEmailInput] = useState('');
  const [orgPhoneInput, setOrgPhoneInput] = useState('');

  const handleOpenEditOrgModal = () => {
    setOrgNameInput(clientInfo.name);
    setOrgCodeInput(clientInfo.code);
    setOrgContactInput(clientInfo.contactPerson || '');
    setOrgEmailInput(clientInfo.contactEmail || '');
    setOrgPhoneInput(clientInfo.contactPhone || '');
    setIsEditOrgModalOpen(true);
  };

  const handleSaveOrganizationProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = orgNameInput.trim();
    const cleanCode = orgCodeInput.trim().toUpperCase();

    if (!cleanName || !cleanCode) {
      showToast('error', 'Organization Name and Code are required.');
      return;
    }

    const allClients = getStoredSchoolClients();
    const existingIndex = allClients.findIndex((c) => c.id === clientInfo.id);

    const updatedOrg: SchoolClientOrganization = {
      ...clientInfo,
      name: cleanName,
      code: cleanCode,
      contactPerson: orgContactInput.trim() || clientInfo.contactPerson,
      contactEmail: orgEmailInput.trim() || clientInfo.contactEmail,
      contactPhone: orgPhoneInput.trim() || clientInfo.contactPhone,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      allClients[existingIndex] = updatedOrg;
    } else {
      allClients.push(updatedOrg);
    }

    saveStoredSchoolClients(allClients);
    syncSchoolClientsToCloud(allClients).catch(() => {});

    try {
      const rawSettings = localStorage.getItem('ams_org_settings_v5');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        localStorage.setItem('ams_org_settings_v5', JSON.stringify({ ...parsed, schoolName: cleanName }));
      }
    } catch {}

    setClientRefreshKey((prev) => prev + 1);
    setIsEditOrgModalOpen(false);
    showToast('success', `Organization client profile updated to "${cleanName}" (${cleanCode}).`);

    logActivity(
      'SYSTEM_SETTINGS',
      'Organization',
      cleanCode,
      `Updated Level 2 Organization Client Name to '${cleanName}' (${cleanCode})`,
      clientInfo.id
    );
  };

  // Register Primary Main Campus Modal State
  const [isRegisterMainModalOpen, setIsRegisterMainModalOpen] = useState(false);
  const [mainCampusNameInput, setMainCampusNameInput] = useState('');
  const [mainCampusCodeInput, setMainCampusCodeInput] = useState('');
  const [mainCampusCityInput, setMainCampusCityInput] = useState('');
  const [mainCampusAccountantInput, setMainCampusAccountantInput] = useState('');
  const [mainCampusFloatInput, setMainCampusFloatInput] = useState('50000');

  const handleOpenRegisterMainCampusModal = () => {
    setMainCampusNameInput(`${clientInfo.name} Main Campus`);
    setMainCampusCodeInput(`${clientInfo.code}-MAIN`);
    setMainCampusCityInput('Head Office');
    setMainCampusAccountantInput(currentUser?.name || 'Head Campus Administrator');
    setMainCampusFloatInput('50000');
    setIsRegisterMainModalOpen(true);
  };

  const handleRegisterMainCampusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = mainCampusCodeInput.trim().toUpperCase();
    const cleanName = mainCampusNameInput.trim();

    if (!cleanCode || !cleanName) {
      showToast('error', 'Main campus code and name are required.');
      return;
    }

    if (myCampuses.some((c) => c.code.toUpperCase() === cleanCode)) {
      showToast('error', `Campus code '${cleanCode}' is already registered in your organization.`);
      return;
    }

    const newMainId = `campus-${clientInfo.code.toLowerCase()}-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newMainCampusObj: Campus = {
      id: newMainId,
      code: cleanCode,
      name: cleanName,
      city: mainCampusCityInput.trim() || 'Head Office',
      accountantName: mainCampusAccountantInput.trim() || 'Head Campus Administrator',
      pettyCashFloat: Number(mainCampusFloatInput) || 50000,
      currentPettyCash: Number(mainCampusFloatInput) || 50000,
      status: 'active',
      isMainCampus: true,
      parentCampusId: null,
      clientId: clientInfo.id,
      loginEnabled: true,
      allowedModules: DEFAULT_CLIENT_MODULES,
    };

    addCampus(newMainCampusObj);

    // Link this newly registered main campus to client organization
    const allClients = getStoredSchoolClients();
    const existingIndex = allClients.findIndex((c) => c.id === clientInfo.id);
    const updatedClient: SchoolClientOrganization = {
      ...clientInfo,
      mainCampusId: newMainId,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      allClients[existingIndex] = updatedClient;
    } else {
      allClients.push(updatedClient);
    }
    saveStoredSchoolClients(allClients);
    syncSchoolClientsToCloud(allClients).catch(() => {});

    setClientRefreshKey((prev) => prev + 1);
    setIsRegisterMainModalOpen(false);
    showToast('success', `Primary Main Campus '${cleanName}' (${cleanCode}) registered successfully!`);

    logActivity(
      'CAMPUS_UPDATE',
      'Campus',
      cleanCode,
      `Registered primary Main Campus '${cleanName}' (${cleanCode}) for organization ${clientInfo.name}.`,
      newMainId
    );
  };

  // Password Reset / Account Management Modal State
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Edit Branch Details Modal State
  const [branchToEdit, setBranchToEdit] = useState<Campus | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchCode, setEditBranchCode] = useState('');
  const [editBranchCity, setEditBranchCity] = useState('');
  const [editBranchAccountant, setEditBranchAccountant] = useState('');
  const [editBranchFloat, setEditBranchFloat] = useState<number>(35000);
  const [editBranchStatus, setEditBranchStatus] = useState<'active' | 'inactive'>('active');

  // Delete Branch Confirmation State
  const [branchToDelete, setBranchToDelete] = useState<Campus | null>(null);

  // Invoice Inspection / Printable Modal State
  const [inspectInvoice, setInspectInvoice] = useState<SubscriptionInvoice | null>(null);

  // Sub-Campus Report Permission Target
  const [selectedSubCampusForReports, setSelectedSubCampusForReports] = useState<string>(
    subCampuses[0]?.id || myCampuses[0]?.id || ''
  );

  // Available reports granted by Platform Super Admin to this client
  const clientAllowedReports = useMemo(() => {
    return getReportsForClient(clientInfo.id);
  }, [clientInfo.id]);

  // Sub-campus report matrices
  const [campusMatrices, setCampusMatrices] = useState(getStoredCampusReportMatrices());

  const handleToggleSubCampusReport = (reportId: string) => {
    if (!selectedSubCampusForReports) return;
    const currentEnabled = campusMatrices[selectedSubCampusForReports]?.enabledReportIds || clientAllowedReports.map((r) => r.id);
    const set = new Set(currentEnabled);
    if (set.has(reportId)) {
      set.delete(reportId);
    } else {
      set.add(reportId);
    }
    const targetCampus = myCampuses.find((c) => c.id === selectedSubCampusForReports);
    const updatedIds = Array.from(set);
    const res = setCampusReportPermissions(
      selectedSubCampusForReports,
      targetCampus?.name || 'Branch',
      clientInfo.id,
      updatedIds,
      undefined,
      currentUser?.name || 'Main Campus Administrator'
    );
    setCampusMatrices(getStoredCampusReportMatrices());
    showToast('success', res.message);
  };

  // Handle Sub-Campus Creation (Enforcing Subscription Limits & Main Campus Hierarchy)
  const handleCreateSubCampus = (e: React.FormEvent) => {
    e.preventDefault();

    if (!mainCampus) {
      showToast('error', "Please register your organization's Primary Main Campus before creating subordinate sub-campuses.");
      setIsCreateModalOpen(false);
      handleOpenRegisterMainCampusModal();
      return;
    }

    // Validate Subscription Campus Limit
    const limitCheck = validateCampusCreationLimit({
      user: currentUser,
      client: clientInfo,
      currentCampuses: myCampuses,
    });

    if (!limitCheck.allowed) {
      showToast('error', limitCheck.message);
      return;
    }

    const cleanCode = newBranchCode.trim().toUpperCase();
    if (!cleanCode || !newBranchName.trim()) {
      showToast('error', 'Branch code and name are required.');
      return;
    }

    if (myCampuses.some((c) => c.code.toUpperCase() === cleanCode)) {
      showToast('error', `Campus code '${cleanCode}' is already registered in your organization.`);
      return;
    }

    const newId = `campus-${clientInfo.code.toLowerCase()}-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const newCampusObj: Campus = {
      id: newId,
      code: cleanCode,
      name: newBranchName.trim(),
      city: newBranchCity.trim() || 'Punjab',
      accountantName: newBranchAccountant.trim() || 'Branch Accountant',
      pettyCashFloat: Number(newBranchFloat) || 35000,
      currentPettyCash: Number(newBranchFloat) || 35000,
      status: 'active',
      isMainCampus: false,
      parentCampusId: mainCampus.id,
      clientId: clientInfo.id,
      loginEnabled: true,
      allowedModules: newBranchModules,
    };

    addCampus(newCampusObj);

    // Create sub-campus administrator login
    const autoUsername = `${clientInfo.code.toLowerCase()}.${cleanCode.toLowerCase()}`;
    const autoPassword = newBranchPassword.trim() || `${cleanCode}@2026`;

    if (addUser) {
      addUser({
        id: `user-${newId}`,
        username: autoUsername,
        name: newBranchAccountant.trim() || `${newBranchName.trim()} Accountant`,
        email: `${autoUsername}@${clientInfo.code.toLowerCase()}.edu.pk`,
        role: 'level_3_sub_campus_admin',
        status: 'active',
        password: autoPassword,
        clientId: clientInfo.id,
        campusId: newId,
        permittedCampusIds: [newId],
        allowedModules: newBranchModules,
        designation: `Sub-Campus Administrator (${cleanCode})`,
      });
    }

    logActivity(
      'CAMPUS_UPDATE',
      'Campus',
      cleanCode,
      `Created authorized sub-campus '${newBranchName}' (${cleanCode}) under ${clientInfo.name}.`,
      newId
    );

    showToast('success', `Sub-campus '${newBranchName}' and login account (${autoUsername}) created successfully!`);
    setIsCreateModalOpen(false);
    setNewBranchCode('');
    setNewBranchName('');
    setNewBranchCity('');
    setNewBranchAccountant('');
    setNewBranchPassword('');
  };

  // Toggle Campus Activation Status
  const handleToggleCampusStatus = (campus: Campus) => {
    const nextStatus = campus.status === 'active' ? 'inactive' : 'active';
    updateCampus(campus.id, { status: nextStatus, loginEnabled: nextStatus === 'active' });
    logActivity(
      'STATUS_CHANGE',
      'Campus',
      campus.code,
      `Campus ${campus.name} status updated to ${nextStatus}.`,
      campus.id
    );
    showToast('success', `Campus ${campus.name} is now ${nextStatus}.`);
  };

  // Reset Sub-Campus Password
  const handlePerformPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampus || !resetPasswordInput.trim()) return;

    setIsResetting(true);
    const targetUser = users.find((u) => u.campusId === editingCampus.id);
    if (targetUser && resetUserPassword) {
      resetUserPassword(targetUser.id, resetPasswordInput.trim());
    }

    logActivity(
      'CAMPUS_UPDATE',
      'Security',
      editingCampus.code,
      `Password reset for sub-campus ${editingCampus.name} (${editingCampus.code}).`,
      editingCampus.id
    );

    setIsResetting(false);
    showToast('success', `Password for ${editingCampus.name} reset successfully!`);
    setEditingCampus(null);
    setResetPasswordInput('');
  };

  // Open Edit Branch Modal
  const handleOpenEditBranch = (campus: Campus) => {
    setBranchToEdit(campus);
    setEditBranchName(campus.name || '');
    setEditBranchCode(campus.code || '');
    setEditBranchCity(campus.city || 'Punjab');
    setEditBranchAccountant(campus.accountantName || '');
    setEditBranchFloat(campus.pettyCashFloat || 35000);
    setEditBranchStatus((campus.status as any) || 'active');
  };

  // Save Edit Branch
  const handleSaveEditBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchToEdit) return;
    if (!editBranchName.trim() || !editBranchCode.trim()) {
      showToast('error', 'Branch name and unique code are required.');
      return;
    }

    const cleanCode = editBranchCode.trim().toUpperCase();
    if (campuses.some((c) => c.id !== branchToEdit.id && c.code.toUpperCase() === cleanCode)) {
      showToast('error', `Campus code '${cleanCode}' is already registered to another branch.`);
      return;
    }

    const updates: Partial<Campus> = {
      name: editBranchName.trim(),
      code: cleanCode,
      city: editBranchCity.trim() || 'Punjab',
      accountantName: editBranchAccountant.trim() || 'Branch Accountant',
      pettyCashFloat: Number(editBranchFloat) || 35000,
      status: editBranchStatus,
    };

    updateCampus(branchToEdit.id, updates);

    try {
      const raw = localStorage.getItem('aplus_campuses');
      if (raw) {
        const list = JSON.parse(raw);
        const updatedList = list.map((c: any) => (c.id === branchToEdit.id ? { ...c, ...updates } : c));
        localStorage.setItem('aplus_campuses', JSON.stringify(updatedList));
      }
    } catch {}

    logActivity(
      'CAMPUS_UPDATE',
      'Branch',
      cleanCode,
      `Updated details for branch ${updates.name} (${cleanCode}).`,
      branchToEdit.id
    );

    showToast('success', `Branch '${updates.name}' updated successfully!`);
    setBranchToEdit(null);
  };

  // Open Delete Branch Confirmation
  const handleOpenDeleteBranch = (campus: Campus) => {
    setBranchToDelete(campus);
  };

  // Confirm Delete Branch
  const handleConfirmDeleteBranch = () => {
    if (!branchToDelete) return;
    const campusId = branchToDelete.id;
    const campusName = branchToDelete.name;
    const campusCode = branchToDelete.code;

    // Gracefully decouple any child sub-campuses reporting to this campus
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
        originalPayload: branchToDelete,
        organizationId: clientInfo.id,
        organizationName: clientInfo.name,
        campusId: campusId,
        campusName: campusName,
        campusCode: campusCode,
        identifier: campusCode,
        title: `Campus: ${campusName} (${campusCode})`,
        deletedByUserId: currentUser?.id || 'client-admin',
        deletedByUserName: currentUser?.name || 'Client Super Admin',
        deletedByUserRole: 'Client Super Admin',
        deletionReason: 'Branch deletion by client organization owner',
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

    logActivity(
      'CAMPUS_DELETE',
      'Branch',
      campusCode,
      `Deleted campus branch ${campusName} (${campusCode}). Detached ${childCampuses.length} child branches. Preserved in Global Recycle Bin.`,
      campusId
    );

    showToast('success', `Branch '${campusName}' deleted and moved to Global Recycle Bin.`);
    setBranchToDelete(null);
  };

  // Filtered transactions for consolidated reports
  const clientTransactions = useMemo(() => {
    return filterTransactionsForUser(transactions, currentUser, campuses);
  }, [transactions, currentUser, campuses]);

  const clientPettyCash = useMemo(() => {
    return filterPettyCashForUser(pettyCashTransactions, currentUser, campuses);
  }, [pettyCashTransactions, currentUser, campuses]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Main Campus Admin Header with Prominent Organization Client Name */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                {clientInfo.name}
              </h1>
              <button
                type="button"
                onClick={handleOpenEditOrgModal}
                className="px-2 py-0.5 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                title="Build or Edit Organization Client Name & Profile"
              >
                <Edit3 className="w-3 h-3" />
                <span>Build / Edit Name</span>
              </button>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-900/90 text-purple-200 border border-purple-500/60 uppercase">
                Level 2 Client Super Admin
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px] font-bold">
                Code: {clientInfo.code}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Organization Owner Hub • Displaying exclusively your own <strong>{myCampuses.length}</strong> subordinate campuses (1 Main + {subCampuses.length} Sub-Campuses)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {!mainCampus ? (
            <button
              type="button"
              onClick={handleOpenRegisterMainCampusModal}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md animate-pulse"
              title="Register Primary Main Campus for this organization"
            >
              <Plus className="w-4 h-4" />
              <span>Register Main Campus</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-800 text-purple-300 text-[11px] font-bold">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span>HQ: {mainCampus.name} ({mainCampus.code})</span>
              </span>
              <button
                type="button"
                onClick={() => onSwitchToCampusOperationalView(mainCampus.id)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                title="Open Operational Ledger and Voucher Entry for your Main Campus"
              >
                <span>Open Main Campus Ledger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Subordinate Campuses Quick Jump Bar (Strictly Only Own Subordinates) */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
            Your Subordinate Branches ({myCampuses.length} Active):
          </span>
          <span className="text-[10px] text-slate-400 hidden md:inline">
            Exclusively subordinate to <strong className="text-white">{clientInfo.name}</strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {myCampuses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSwitchToCampusOperationalView(c.id)}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                c.isMainCampus
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600'
              }`}
              title={`Switch to ${c.name} (${c.code}) branch operational ledger`}
            >
              <span>{c.code}</span>
              <span className="text-[10px] font-normal text-slate-300">
                ({c.isMainCampus ? 'Main' : c.city || 'Branch'})
              </span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-6 py-2.5 flex flex-wrap items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Organization Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sub_campuses')}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'sub_campuses'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Campus & User Management</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
            {myCampuses.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('report_permissions')}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'report_permissions'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Report Access Matrix</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
            {clientAllowedReports.length} Available
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 text-purple-300" />
          <span>Subscription & Billing</span>
          {billingSummary.outstandingBalance > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-900/80 text-amber-300 text-[10px] font-bold">
              Due: PKR {billingSummary.outstandingBalance.toLocaleString()}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('consolidated_reports')}
          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'consolidated_reports'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>Consolidated Financial Reports</span>
        </button>
      </nav>

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`mx-6 mt-4 p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-950 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Body */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB 1: Organization Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {!mainCampus && (
              <div className="bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-slate-900 border border-purple-600/70 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 uppercase tracking-wider">
                      Setup Required
                    </span>
                    <h3 className="text-base font-black text-white">Register Organization Main Campus</h3>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    Your organization <strong className="text-white">{clientInfo.name}</strong> ({clientInfo.code}) does not have a designated Main Campus headquarters yet. Registering your Main Campus sets up your primary root accounting ledger and enables branch sub-campuses to be created subordinate to it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenRegisterMainCampusModal}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shrink-0 flex items-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Main Campus Now</span>
                </button>
              </div>
            )}

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
                  <span>Registered Campuses</span>
                  <Building2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  {myCampuses.length}{' '}
                  <span className="text-xs text-slate-500 font-normal">/ {clientInfo.maxCampuses} max</span>
                </div>
                <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{billingSummary.activeCampuses} active branches</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
                  <span>Subscription Plan</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-white">{clientInfo.tier}</div>
                <div className="mt-2 text-[11px] text-purple-400 font-medium">
                  Renewal: {clientInfo.billingRenewalDate}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
                  <span>Latest Monthly Invoice</span>
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white">
                  PKR {(billingSummary.latestInvoice?.grandTotal || 0).toLocaleString()}
                </div>
                <div className="mt-2 text-[11px] text-emerald-400 font-bold">
                  Paid: PKR {(billingSummary.latestInvoice?.amountPaid || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
                <div className="flex items-center justify-between text-slate-400 text-xs mb-2 font-medium">
                  <span>Outstanding Balance</span>
                  <DollarSign className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-300">
                  PKR {billingSummary.outstandingBalance.toLocaleString()}
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  {billingSummary.outstandingBalance === 0 ? 'All invoices settled' : 'Due on 25th of month'}
                </div>
              </div>
            </div>

            {/* Comparative Bar Chart: Monthly Expenditures vs Budget Limits */}
            <CampusMonthlyBudgetExpenditureChart
              campuses={myCampuses}
              transactions={transactions}
              onCampusSelect={(campusId) => {
                onSwitchToCampusOperationalView(campusId);
              }}
            />

            {/* Organization & Campus Multi-Tier Hierarchy Tree */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/80 border border-purple-800 flex items-center justify-center text-purple-300">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Organization & Campus Hierarchy Structure</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Multi-tier governance: Organization Client &rarr; Main Campus Headquarters &rarr; Subordinate Branch Campuses
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!mainCampus && (
                    <button
                      type="button"
                      onClick={handleOpenRegisterMainCampusModal}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register Main Campus</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!mainCampus) {
                        showToast('error', 'Please register your Primary Main Campus before creating sub-campuses.');
                        handleOpenRegisterMainCampusModal();
                      } else {
                        setIsCreateModalOpen(true);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register Sub-Campus</span>
                  </button>
                </div>
              </div>

              {/* Hierarchy Tree Visualizer */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3 font-sans">
                {/* Level 1: Organization Client Root */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-indigo-900/60 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white">{clientInfo.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {clientInfo.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/80 text-purple-200 border border-purple-700/60 uppercase">
                          Organization Client Root
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tier: <span className="text-slate-200 font-semibold uppercase">{clientInfo.tier}</span> • Contact: <span className="text-slate-200">{clientInfo.contactPerson || 'Super Admin'}</span> • Capacity: <span className="text-emerald-400 font-bold">{myCampuses.length}</span> / {clientInfo.maxCampuses} Campuses
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenEditOrgModal}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Edit Organization
                  </button>
                </div>

                {/* Level 2: Main Campus (HQ) */}
                <div className="pl-6 md:pl-10 relative">
                  <div className="absolute left-2.5 md:left-4 top-0 bottom-4 w-0.5 bg-indigo-900/60" />
                  <div className="absolute left-2.5 md:left-4 top-6 w-4 border-t-2 border-indigo-900/60" />

                  {mainCampus ? (
                    <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-700/60 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-purple-100">{mainCampus.name}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-900 text-purple-200 border border-purple-700">
                              {mainCampus.code}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 uppercase">
                              ★ Primary Main Campus (HQ)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Location: <span className="text-slate-200">{mainCampus.city || 'Head Office'}</span> • Safe Float: <span className="text-emerald-400 font-mono font-bold">PKR {(mainCampus.pettyCashFloat || 0).toLocaleString()}</span> • Head Admin: <span className="text-slate-200">{mainCampus.accountantName || 'Admin'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSwitchToCampusOperationalView(mainCampus.id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>Open Main Ledger</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-amber-200 text-xs">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>No Primary Main Campus designated yet for this organization.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenRegisterMainCampusModal}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register Main Campus</span>
                      </button>
                    </div>
                  )}

                  {/* Level 3: Subordinate Sub-Campuses */}
                  <div className="pl-6 md:pl-10 mt-3 space-y-2 relative">
                    <div className="absolute left-2.5 md:left-4 top-0 bottom-4 w-0.5 bg-slate-800" />
                    
                    {subCampuses.length === 0 ? (
                      <div className="text-xs text-slate-500 py-1 pl-2 italic">
                        No subordinate sub-campuses registered under this Main Campus yet.
                      </div>
                    ) : (
                      subCampuses.map((sub) => (
                        <div key={sub.id} className="relative">
                          <div className="absolute -left-3.5 md:-left-6 top-5 w-3.5 md:w-6 border-t-2 border-slate-800" />
                          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 transition-all">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white text-xs">{sub.name}</span>
                                  <span className="font-mono text-[10px] text-slate-400 font-bold bg-slate-800 px-1.5 py-0.2 rounded">
                                    {sub.code}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    &bull; {sub.city || 'Branch'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Accountant: <span className="text-slate-300">{sub.accountantName || 'Branch Accountant'}</span> • Float: <span className="text-emerald-400 font-mono">PKR {(sub.pettyCashFloat || 0).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSwitchToCampusOperationalView(sub.id)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>View Ledger</span>
                                <ExternalLink className="w-3 h-3 opacity-70" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Branches Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>{clientInfo.name} Subordinate Campuses</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Showing Strictly Own Subordinates ({myCampuses.length})
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exclusively subordinate branches and accounting nodes operating under {clientInfo.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Sub-Campus</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-300 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Branch Name & Code</th>
                      <th className="p-3">Branch Type</th>
                      <th className="p-3">City</th>
                      <th className="p-3">Assigned Accountant</th>
                      <th className="p-3">Petty Cash Float</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {myCampuses.map((campus) => (
                      <tr key={campus.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{campus.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{campus.code}</div>
                        </td>
                        <td className="p-3">
                          {campus.isMainCampus || !campus.parentCampusId ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/80 text-purple-200 border border-purple-700/60">
                              Main Campus
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-700/60">
                              Sub-Branch
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-300">{campus.city || 'Punjab'}</td>
                        <td className="p-3 text-slate-300">{campus.accountantName || 'Designated Accountant'}</td>
                        <td className="p-3 font-mono font-bold text-slate-200">
                          PKR {(campus.pettyCashFloat || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                              campus.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                campus.status === 'active' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span>{campus.status === 'active' ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditBranch(campus)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                              title={`Edit branch ${campus.name}`}
                            >
                              <Edit3 className="w-3 h-3 text-indigo-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteBranch(campus)}
                              className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[10px] border border-rose-800 flex items-center gap-1 transition-colors cursor-pointer"
                              title={`Delete branch ${campus.name}`}
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Delete</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSwitchToCampusOperationalView(campus.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Enter Ledger
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Sub-Campus & Login Management */}
        {activeTab === 'sub_campuses' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-indigo-400" />
                  <span>{clientInfo.name} Subordinate Campuses & Staff Logins</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Strict Subordinate Isolation
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage subordinate branches reporting exclusively to {clientInfo.name}, configure branch login credentials, and assign permission scopes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Sub-Campus</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-300 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Campus Branch</th>
                    <th className="p-3">Login Username</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Modules Permitted</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Security & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {myCampuses.map((campus) => {
                    const assignedUser = users.find((u) => u.campusId === campus.id);
                    return (
                      <tr key={campus.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{campus.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">Code: {campus.code}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/80">
                            {assignedUser?.username || `${clientInfo.code.toLowerCase()}.${campus.code.toLowerCase()}`}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{campus.city || 'Punjab'}</td>
                        <td className="p-3">
                          <span className="text-[11px] text-slate-300">
                            {(campus.allowedModules || ['dashboard', 'transaction', 'pettycash']).length} modules active
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleToggleCampusStatus(campus)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              campus.status === 'active'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                            title="Click to toggle activation status"
                          >
                            {campus.status === 'active' ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEditBranch(campus)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Edit branch ${campus.name}`}
                            >
                              <Edit3 className="w-3 h-3 text-indigo-400" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteBranch(campus)}
                              className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[10px] border border-rose-800 flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Delete branch ${campus.name}`}
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" />
                              <span>Delete</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCampus(campus);
                                setResetPasswordInput('');
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Reset login password"
                            >
                              <KeyRound className="w-3 h-3 text-indigo-400" />
                              <span>Reset Pass</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onSwitchToCampusOperationalView(campus.id)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Audit Branch
                            </button>
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

        {/* TAB 3: Report Access & Permission Matrix */}
        {activeTab === 'report_permissions' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Sub-Campus Report Visibility & Permission Matrix</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Configure which permitted financial statements and ledger reports are accessible to each sub-campus.
                </p>
              </div>

              {/* Sub-campus selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold">Select Sub-Campus:</span>
                <select
                  value={selectedSubCampusForReports}
                  onChange={(e) => setSelectedSubCampusForReports(e.target.value)}
                  className="text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {myCampuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-300 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3">Report Category</th>
                    <th className="p-3">Domain</th>
                    <th className="p-3">Platform Authority</th>
                    <th className="p-3">Sub-Campus Status</th>
                    <th className="p-3 text-right">Toggle Visibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {REPORT_CATEGORIES_REGISTRY.map((rep) => {
                    const isPlatformAllowed = clientAllowedReports.some((r) => r.id === rep.id);
                    const campusReports = campusMatrices[selectedSubCampusForReports]?.enabledReportIds || clientAllowedReports.map((r) => r.id);
                    const isCampusEnabled = isPlatformAllowed && campusReports.includes(rep.id);

                    return (
                      <tr key={rep.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{rep.name}</div>
                          <div className="text-[11px] text-slate-400">{rep.description}</div>
                        </td>
                        <td className="p-3 text-slate-300">{rep.category}</td>
                        <td className="p-3">
                          {isPlatformAllowed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Permitted by Platform Owner</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Restricted by Platform Owner</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              isCampusEnabled
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {isCampusEnabled ? 'Visible in Campus Reports' : 'Hidden from Campus'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            disabled={!isPlatformAllowed}
                            onClick={() => handleToggleSubCampusReport(rep.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              !isPlatformAllowed
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : isCampusEnabled
                                ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200'
                                : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
                            }`}
                          >
                            {isCampusEnabled ? 'Revoke' : 'Grant'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: Subscription & Billing */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Billing Overview Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span>{clientInfo.name} — Subscription & Billing Profile</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Review your monthly subscription plan, campus quotas, outstanding balances, and invoice history.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Plan: {clientInfo.tier} Network
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Included Campuses</div>
                  <div className="text-xl font-black text-white mt-1">
                    2 <span className="text-xs text-slate-400 font-normal">base campuses</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Extra: PKR 1,500/campus</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Total Campuses Registered</div>
                  <div className="text-xl font-black text-white mt-1">
                    {myCampuses.length}{' '}
                    <span className="text-xs text-indigo-400 font-bold">
                      ({Math.max(0, myCampuses.length - 2)} additional)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Cap: {clientInfo.maxCampuses} allowed</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Latest Billed Amount</div>
                  <div className="text-xl font-black text-emerald-400 mt-1">
                    PKR {(billingSummary.latestInvoice?.grandTotal || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Period: {billingSummary.latestInvoice?.billingMonth} {billingSummary.latestInvoice?.billingYear}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-bold uppercase">Outstanding Balance</div>
                  <div className="text-xl font-black text-amber-300 mt-1">
                    PKR {billingSummary.outstandingBalance.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-amber-400 font-medium mt-1">
                    Due: {billingSummary.latestInvoice?.dueDate || '25th of month'}
                  </div>
                </div>
              </div>
            </div>

            {/* Invoices History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Monthly Subscription Invoice History
              </h4>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-300 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Billing Period</th>
                      <th className="p-3">Campuses Billed</th>
                      <th className="p-3">Grand Total</th>
                      <th className="p-3">Paid Amount</th>
                      <th className="p-3">Remaining Balance</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">View & Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {billingSummary.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-300">{inv.invoiceNo}</td>
                        <td className="p-3 text-slate-200">
                          {inv.billingMonth} {inv.billingYear}
                        </td>
                        <td className="p-3 text-slate-300">
                          {inv.totalRegisteredCampuses} branches ({inv.includedCampuses} incl. + {inv.additionalCampusesCount} addl.)
                        </td>
                        <td className="p-3 font-mono font-bold text-white">
                          PKR {inv.grandTotal.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          PKR {inv.amountPaid.toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold text-amber-300">
                          PKR {inv.remainingBalance.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              inv.status === 'Paid'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : inv.status === 'Partially Paid'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectInvoice(inv)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Invoice Slip</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Consolidated Financial Reports */}
        {activeTab === 'consolidated_reports' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-400" />
                <span>{clientInfo.name} — Consolidated Financial Summary</span>
              </h3>
              <p className="text-xs text-slate-400">
                Consolidated ledger postings across your authorized branches exclusively.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-bold">Total Vouchers Logged</div>
                <div className="text-2xl font-black text-white mt-1">{clientTransactions.length}</div>
                <div className="text-[11px] text-slate-500 mt-1">Across all authorized sub-campuses</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-bold">Total Ledger Debit Volume</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  PKR {clientTransactions.reduce((sum, tx) => sum + (tx.totalDebit || 0), 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Mathematical double-entry verified</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400 font-bold">Active Imprest Safe Cash</div>
                <div className="text-2xl font-black text-purple-400 mt-1">
                  PKR {myCampuses.reduce((sum, c) => sum + (c.currentPettyCash || 0), 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Combined petty cash floats</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE SUB-CAMPUS MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-900/60 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Create New Sub-Campus Branch</h4>
                  <p className="text-[11px] text-slate-400">Client: {clientInfo.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Parent Organization & Main Campus indicator */}
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200 flex items-center justify-between">
              <div>
                <span className="font-bold block text-white">Hierarchical Subordination</span>
                <span className="text-[11px] text-slate-300">
                  Client: <strong className="text-purple-300">{clientInfo.name}</strong> &rarr; Main HQ: <strong className="text-purple-300">{mainCampus?.name} ({mainCampus?.code})</strong>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900 text-purple-200 border border-purple-700 uppercase">
                Sub-Campus Node
              </span>
            </div>

            <form onSubmit={handleCreateSubCampus} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Unique Branch Code
                  </label>
                  <input
                    type="text"
                    value={newBranchCode}
                    onChange={(e) => setNewBranchCode(e.target.value.toUpperCase())}
                    placeholder="e.g. C4 or KHIALI2"
                    className="w-full text-xs font-mono font-bold bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Campus Name
                  </label>
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="e.g. Aplus Campus 4"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    City Location
                  </label>
                  <input
                    type="text"
                    value={newBranchCity}
                    onChange={(e) => setNewBranchCity(e.target.value)}
                    placeholder="e.g. Gujranwala"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Accountant Full Name
                  </label>
                  <input
                    type="text"
                    value={newBranchAccountant}
                    onChange={(e) => setNewBranchAccountant(e.target.value)}
                    placeholder="e.g. M. Tariq"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Petty Cash Float (PKR)
                  </label>
                  <input
                    type="number"
                    value={newBranchFloat}
                    onChange={(e) => setNewBranchFloat(Number(e.target.value))}
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Initial Login Password
                  </label>
                  <input
                    type="text"
                    value={newBranchPassword}
                    onChange={(e) => setNewBranchPassword(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Create Sub-Campus & Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER PRIMARY MAIN CAMPUS MODAL */}
      {isRegisterMainModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-purple-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Register Organization Main Campus</h4>
                  <p className="text-[11px] text-purple-300">Client: {clientInfo.name} ({clientInfo.code})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterMainModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200">
              🏛️ <strong>Headquarters Ledger Root:</strong> This Main Campus serves as your institution's primary headquarters. All subsequent sub-campuses will report directly under this Main Campus.
            </div>

            <form onSubmit={handleRegisterMainCampusSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Main Campus Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mainCampusCodeInput}
                    onChange={(e) => setMainCampusCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. MAIN or HO"
                    className="w-full text-xs font-mono font-bold uppercase bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Main Campus Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mainCampusNameInput}
                    onChange={(e) => setMainCampusNameInput(e.target.value)}
                    placeholder="e.g. Apex Main Campus"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    City Location
                  </label>
                  <input
                    type="text"
                    value={mainCampusCityInput}
                    onChange={(e) => setMainCampusCityInput(e.target.value)}
                    placeholder="e.g. Lahore / Gujranwala"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Head Campus Admin / Accountant
                  </label>
                  <input
                    type="text"
                    value={mainCampusAccountantInput}
                    onChange={(e) => setMainCampusAccountantInput(e.target.value)}
                    placeholder="e.g. Principal / Lead Accountant"
                    className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Imprest Safe Cash Float (PKR)
                </label>
                <input
                  type="number"
                  value={mainCampusFloatInput}
                  onChange={(e) => setMainCampusFloatInput(e.target.value)}
                  placeholder="50000"
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterMainModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Confirm & Register Main Campus</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL */}
      {editingCampus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white">
                Reset Login Password for {editingCampus.name}
              </h4>
              <button
                type="button"
                onClick={() => setEditingCampus(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePerformPasswordReset} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 5 chars)..."
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCampus(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVOICE DETAIL & PRINT SLIP MODAL */}
      {inspectInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-mono font-bold text-indigo-600 uppercase tracking-wider">
                  Official Subscription Invoice
                </span>
                <h3 className="text-xl font-black text-slate-900">{inspectInvoice.invoiceNo}</h3>
                <p className="text-xs text-slate-500">
                  Client: {inspectInvoice.clientName} ({inspectInvoice.clientCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectInvoice(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Billing Period</span>
                <span className="font-bold">{inspectInvoice.billingMonth} {inspectInvoice.billingYear}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Due Date</span>
                <span className="font-bold text-amber-700">{inspectInvoice.dueDate}</span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-600">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectInvoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="p-3 font-medium">{item.description}</td>
                      <td className="p-3 text-right font-mono">{item.quantity}</td>
                      <td className="p-3 text-right font-mono">PKR {item.unitPrice.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold">PKR {item.total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">PKR {inspectInvoice.subtotal.toLocaleString()}</span>
              </div>
              {inspectInvoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Discount:</span>
                  <span className="font-mono">- PKR {inspectInvoice.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono">PKR {inspectInvoice.grandTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Amount Paid:</span>
                <span className="font-mono">PKR {inspectInvoice.amountPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Remaining Balance:</span>
                <span className="font-mono">PKR {inspectInvoice.remainingBalance.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BRANCH DETAILS MODAL */}
      {branchToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">
                  Edit Branch: {branchToEdit.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setBranchToEdit(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBranch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={editBranchName}
                    onChange={(e) => setEditBranchName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Unique Branch Code
                  </label>
                  <input
                    type="text"
                    value={editBranchCode}
                    onChange={(e) => setEditBranchCode(e.target.value.toUpperCase())}
                    className="w-full font-mono uppercase bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    City / Location
                  </label>
                  <input
                    type="text"
                    value={editBranchCity}
                    onChange={(e) => setEditBranchCity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Assigned Accountant
                  </label>
                  <input
                    type="text"
                    value={editBranchAccountant}
                    onChange={(e) => setEditBranchAccountant(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Petty Cash Float (PKR)
                  </label>
                  <input
                    type="number"
                    value={editBranchFloat}
                    onChange={(e) => setEditBranchFloat(Number(e.target.value))}
                    className="w-full font-mono bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Branch Status
                  </label>
                  <select
                    value={editBranchStatus}
                    onChange={(e) => setEditBranchStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="active">Active (Operational)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBranchToEdit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Save Branch Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE BRANCH CONFIRMATION MODAL */}
      {branchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-900/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Delete Campus Branch
                </h4>
                <p className="text-xs text-rose-300 font-bold mt-0.5">
                  {branchToDelete.name} ({branchToDelete.code})
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Are you sure you want to delete this campus branch from your organization?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Imprest Cash Float:</span>
                <strong className="text-emerald-400 font-mono">
                  PKR {(branchToDelete.pettyCashFloat || 0).toLocaleString()}
                </strong>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Location:</span>
                <strong className="text-white">{branchToDelete.city || 'Punjab'}</strong>
              </div>
              <div className="p-2 rounded-xl bg-indigo-950/40 border border-indigo-900 text-indigo-300 text-[10px]">
                🛡️ <strong>Safety Guarantee:</strong> This record will be safely moved to the <strong>Global Recycle Bin</strong> for recovery if needed.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBranch}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete Branch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUILD & CUSTOMIZE ORGANIZATION CLIENT NAME MODAL */}
      {isEditOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-indigo-700/80 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Build & Customize Organization Name
                  </h3>
                  <p className="text-xs text-indigo-300">
                    Level 2 Client Super Admin & Institution Branding
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOrgModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrganizationProfile} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Organization Client Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={orgNameInput}
                  onChange={(e) => setOrgNameInput(e.target.value)}
                  placeholder="e.g. Aplus School System / Apex Grammar Academy"
                  className="w-full bg-slate-950 border border-indigo-600/70 rounded-xl px-3.5 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This Organization Client Name appears prominently at the very top of your portal, top bars, and vouchers.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Organization Code <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={orgCodeInput}
                    onChange={(e) => setOrgCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. APLUS"
                    className="w-full font-mono uppercase bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={orgContactInput}
                    onChange={(e) => setOrgContactInput(e.target.value)}
                    placeholder="e.g. Managing Director"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={orgPhoneInput}
                    onChange={(e) => setOrgPhoneInput(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={orgEmailInput}
                    onChange={(e) => setOrgEmailInput(e.target.value)}
                    placeholder="admin@school.edu.pk"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800 text-[11px] text-indigo-200">
                🛡️ <strong>Subordinate Campus Isolation:</strong> Updating your organization client name strictly maintains data boundaries. Only your own subordinate branches report under this identity.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditOrgModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Save & Apply Organization Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
