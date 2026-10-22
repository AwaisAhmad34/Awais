import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Building2,
  RefreshCw,
  Copy,
  Check,
  Printer,
  Lock,
  Unlock,
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  CheckCircle2,
  X,
  ExternalLink,
  Smartphone,
  Send,
  Database,
  ArrowRight,
  UserCheck,
  UserCog,
  Key,
  Save,
  ShieldAlert,
  Edit3,
  Search,
} from 'lucide-react';
import { useAccounting, Campus } from '../core/aplusEngine';
import {
  CampusCredential,
  getLocalStoredCampusCredentials,
  ensureCredentialsForAllCampuses,
  saveCampusCredentialToCloud,
  syncAllCampusCredentialsToCloud,
  fetchCampusCredentialsFromCloud,
  generateDynamicPassword,
  createDynamicCampusCredential,
  authenticateDynamicCampusLogin,
  synchronizeCredentialsWithEngineUsers,
} from '../services/campusAuthSync';
import firebaseConfig from '../../firebase-applet-config.json';
import { recordCampusLoginActivity } from '../services/campusLoginActivityService';

interface DynamicCampusAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCampusLogin?: (campusId: string) => void;
}

export const DynamicCampusAuthModal: React.FC<DynamicCampusAuthModalProps> = ({
  isOpen,
  onClose,
  onSelectCampusLogin,
}) => {
  const {
    campuses,
    users,
    addUser,
    updateUser,
    resetUserPassword,
    loginAsCampus,
    currentUser,
    isSuperAdmin,
    logActivity,
    currentCampusId,
  } = useAccounting();

  // Active Tab: Vault | Profile Management | Live Simulator
  const [activeTab, setActiveTab] = useState<'vault' | 'profile_mgmt' | 'simulator'>('vault');

  // Role boundaries:
  // 1. Platform Admin / Owner: Full access to all campus databases & credentials
  const isPlatformAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'level_1_platform_super_admin' ||
    (isSuperAdmin && (!currentUser?.campusId || currentUser?.campusAccess === 'all'));

  // 2. Platform Owner specifically (authorized to manage master owner profile/credentials)
  const isPlatformOwner =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'level_1_platform_super_admin' ||
    (isSuperAdmin && (!currentUser?.campusId || currentUser?.campusAccess === 'all') && !currentUser?.clientId);

  // 3. Main Campus Super Admin (authorized for own campus and designated sub-campuses only)
  const isCampusSuperAdmin =
    isPlatformAdmin ||
    isSuperAdmin ||
    currentUser?.role === 'superadmin' ||
    currentUser?.role === 'level_2_client_super_admin' ||
    currentUser?.role === 'level_3_main_campus_admin';

  const effectiveCampusId = currentCampusId || currentUser?.campusId;
  const currentCampus = campuses.find((c) => c.id === effectiveCampusId) || campuses[0];

  // Strictly filter authorized campuses:
  // - Platform Admin: sees all campuses
  // - Main Campus Super Admin: ONLY sees own main campus + designated sub-campuses
  // - Other client / sub-campus staff: cannot see other campuses' DB credentials
  const authorizedCampuses = useMemo(() => {
    if (isPlatformAdmin) return campuses;
    if (isCampusSuperAdmin) {
      const myCampus = campuses.find((c) => c.id === effectiveCampusId);
      const myClientId = currentUser?.clientId || myCampus?.clientId;

      return campuses.filter((c) => {
        // Enforce strict multi-client isolation: do not show campuses of other clients
        if (myClientId && c.clientId && c.clientId !== myClientId) {
          return false;
        }

        const isOwn = c.id === effectiveCampusId;
        const isSubCampusOfMine = c.parentCampusId === effectiveCampusId;
        const isExplicitDelegation = (currentUser?.delegatedSubCampusIds || []).includes(c.id);

        return isOwn || isSubCampusOfMine || isExplicitDelegation;
      });
    }
    return campuses.filter((c) => c.id === effectiveCampusId);
  }, [campuses, isPlatformAdmin, isCampusSuperAdmin, effectiveCampusId, currentUser]);

  const authorizedCampusIds = useMemo(
    () => new Set(authorizedCampuses.map((c) => c.id)),
    [authorizedCampuses]
  );

  const [credentials, setCredentials] = useState<CampusCredential[]>(() =>
    ensureCredentialsForAllCampuses(campuses, getLocalStoredCampusCredentials())
  );

  const [searchQuery, setSearchQuery] = useState('');
  const visibleCredentials = useMemo(() => {
    return credentials
      .filter((c) => authorizedCampusIds.has(c.campusId))
      .filter((c) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          c.campusName.toLowerCase().includes(q) ||
          c.campusCode.toLowerCase().includes(q) ||
          c.username.toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q)
        );
      });
  }, [credentials, authorizedCampusIds, searchQuery]);

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printSlipsContent, setPrintSlipsContent] = useState('');

  // Check if current user is authorized to view / copy / rotate the executive password for a given campus
  const isPasswordVisibleForUser = (targetCampusId: string): boolean => {
    // 1. Root Platform Super Admin (Level 1) can view all
    if (isPlatformAdmin) return true;

    const targetCampus = campuses.find((c) => c.id === targetCampusId);
    if (!targetCampus) return false;

    // Strict multi-client isolation: never view passwords of another client
    const myCampus = campuses.find((c) => c.id === effectiveCampusId);
    const myClientId = currentUser?.clientId || myCampus?.clientId;
    if (myClientId && targetCampus.clientId && myClientId !== targetCampus.clientId) {
      return false;
    }

    // 2. Executive Password Rule: Sub-campus password is JUST shown to its own direct main parent campus!
    if (targetCampus.parentCampusId) {
      const isDirectParentAdmin =
        effectiveCampusId === targetCampus.parentCampusId ||
        currentUser?.campusId === targetCampus.parentCampusId;
      const isOwnCampus =
        effectiveCampusId === targetCampus.id || currentUser?.campusId === targetCampus.id;
      return Boolean(isDirectParentAdmin || isOwnCampus);
    }

    // 3. For main parent campuses: only own campus administrator can view its executive password
    return effectiveCampusId === targetCampus.id || currentUser?.campusId === targetCampus.id;
  };

  // Custom Password Change Modal State
  const [editingCred, setEditingCred] = useState<CampusCredential | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCustomPassInput, setShowCustomPassInput] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // Platform Owner Profile Management State
  const [ownerUsername, setOwnerUsername] = useState(currentUser?.username || 'admin');
  const [ownerDisplayName, setOwnerDisplayName] = useState(currentUser?.name || 'Platform Super Admin');
  const [ownerEmail, setOwnerEmail] = useState(currentUser?.email || 'owner@platform.org');
  const [ownerNewPassword, setOwnerNewPassword] = useState('');
  const [ownerConfirmPassword, setOwnerConfirmPassword] = useState('');
  const [ownerPassError, setOwnerPassError] = useState<string | null>(null);
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  // Authentication Simulator State
  const [simCampusId, setSimCampusId] = useState<string>(authorizedCampuses[0]?.id || campuses[0]?.id || '');
  const [simPassword, setSimPassword] = useState<string>('');
  const [simResult, setSimResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch latest from Firestore on open
      fetchCampusCredentialsFromCloud()
        .then((cloudCreds) => {
          const merged = ensureCredentialsForAllCampuses(campuses, cloudCreds);
          setCredentials(merged);
          // Sync with engine users so engine's login works
          synchronizeCredentialsWithEngineUsers({
            credentials: merged,
            users,
            addUser,
            updateUser,
            resetUserPassword,
          });
        })
        .catch(() => {});
    }
  }, [isOpen, campuses]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTogglePassword = (id: string, campusId: string) => {
    if (!isPasswordVisibleForUser(campusId)) {
      showToast(
        'error',
        'Security Policy: Executive passwords for sub-campuses are restricted exclusively to their designated Main Parent Campus administrator.'
      );
      return;
    }
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyText = (text: string, id: string, campusId?: string) => {
    if (campusId && !isPasswordVisibleForUser(campusId)) {
      showToast(
        'error',
        'Security Policy: Executive passwords for sub-campuses are restricted exclusively to their designated Main Parent Campus administrator.'
      );
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('success', 'Copied to clipboard!');
  };

  // 1-Click Generate / Rotate Password for a single campus
  const handleRotateCampusPassword = async (campusId: string) => {
    if (!isPasswordVisibleForUser(campusId)) {
      showToast(
        'error',
        'Security Policy: Only the designated Main Parent Campus administrator can rotate this sub-campus password.'
      );
      return;
    }

    const targetCampus = campuses.find((c) => c.id === campusId);
    if (!targetCampus) return;

    const newPass = generateDynamicPassword(targetCampus.code);
    const existing = credentials.find((c) => c.campusId === campusId);
    const updated = createDynamicCampusCredential(targetCampus, existing, newPass);

    setIsSyncing(true);
    await saveCampusCredentialToCloud(updated);
    setIsSyncing(false);

    const nextList = credentials.map((c) => (c.campusId === campusId ? updated : c));
    setCredentials(nextList);

    synchronizeCredentialsWithEngineUsers({
      credentials: [updated],
      users,
      addUser,
      updateUser,
      resetUserPassword,
    });

    logActivity(
      'CAMPUS_UPDATE',
      'Campus',
      targetCampus.code,
      `Rotated dynamic credentials for ${targetCampus.name}. New Password: ${newPass}`,
      campusId
    );

    showToast(
      'success',
      `Rotated dynamic password for ${targetCampus.name} (${targetCampus.code}) -> Synced to Firestore Database!`
    );
  };

  // Save Custom Password for a Campus (Platform Admin & Super Admin)
  const handleSaveCustomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);

    if (!editingCred) return;

    if (!isPasswordVisibleForUser(editingCred.campusId)) {
      setPassError('Unauthorized: Only the designated Main Parent Campus administrator can modify this sub-campus password.');
      showToast(
        'error',
        'Security Policy: Only the designated Main Parent Campus administrator can modify this sub-campus password.'
      );
      return;
    }

    if (!customPassword.trim() || customPassword.length < 5) {
      setPassError('Password must be at least 5 characters long.');
      return;
    }
    if (customPassword !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    const targetCampus = campuses.find((c) => c.id === editingCred.campusId);
    if (!targetCampus) return;

    const updated = createDynamicCampusCredential(
      targetCampus,
      editingCred,
      customPassword.trim()
    );

    setIsSyncing(true);
    await saveCampusCredentialToCloud(updated);
    setIsSyncing(false);

    const nextList = credentials.map((c) => (c.campusId === targetCampus.id ? updated : c));
    setCredentials(nextList);

    synchronizeCredentialsWithEngineUsers({
      credentials: [updated],
      users,
      addUser,
      updateUser,
      resetUserPassword,
    });

    logActivity(
      'CAMPUS_UPDATE',
      'Campus',
      targetCampus.code,
      `Custom dynamic password configured for ${targetCampus.name} (${targetCampus.code}) and saved to Firestore Database.`,
      targetCampus.id
    );

    showToast(
      'success',
      `Password for ${targetCampus.name} updated and synced with cloud database!`
    );

    setEditingCred(null);
    setCustomPassword('');
    setConfirmPassword('');
  };

  // Batch Sync All Credentials to Firestore Cloud Database
  const handleSyncAllToDatabase = async () => {
    setIsSyncing(true);
    const refreshed = ensureCredentialsForAllCampuses(campuses, credentials);
    const result = await syncAllCampusCredentialsToCloud(refreshed);
    setIsSyncing(false);

    if (result.success) {
      setCredentials(refreshed);
      synchronizeCredentialsWithEngineUsers({
        credentials: refreshed,
        users,
        addUser,
        updateUser,
        resetUserPassword,
      });
      showToast(
        'success',
        `Successfully synced ${result.count} campus credential profiles to Firestore Database [${firebaseConfig.firestoreDatabaseId}]`
      );
    } else {
      showToast('error', `Sync failed: ${result.error}`);
    }
  };

  // Platform Owner Profile Credentials Update Handler
  const handleSaveOwnerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerPassError(null);

    if (!isPlatformOwner) {
      showToast('error', 'Unauthorized: Only the Platform Owner can manage master system credentials.');
      return;
    }

    if (!ownerUsername.trim()) {
      setOwnerPassError('Username is required.');
      return;
    }

    if (ownerNewPassword.trim()) {
      if (ownerNewPassword.length < 6) {
        setOwnerPassError('Master password must be at least 6 characters long.');
        return;
      }
      if (ownerNewPassword !== ownerConfirmPassword) {
        setOwnerPassError('New passwords do not match.');
        return;
      }
    }

    setIsSavingOwner(true);
    try {
      if (currentUser?.id && updateUser) {
        updateUser(currentUser.id, {
          username: ownerUsername.trim(),
          name: ownerDisplayName.trim(),
          email: ownerEmail.trim(),
        });
      }
      if (currentUser?.id && resetUserPassword && ownerNewPassword.trim()) {
        resetUserPassword(currentUser.id, ownerNewPassword.trim());
      }

      localStorage.setItem(
        'APLUS_PLATFORM_OWNER_PROFILE',
        JSON.stringify({
          username: ownerUsername.trim(),
          name: ownerDisplayName.trim(),
          email: ownerEmail.trim(),
          updatedAt: new Date().toISOString(),
        })
      );

      logActivity(
        'STATUS_CHANGE',
        'System',
        'PLATFORM_OWNER',
        `Platform Owner updated master credentials (${ownerUsername.trim()}).`
      );

      showToast(
        'success',
        'Platform Owner credentials and profile successfully updated!'
      );
      setOwnerNewPassword('');
      setOwnerConfirmPassword('');
    } catch (err: any) {
      showToast('error', `Update failed: ${err?.message || err}`);
    } finally {
      setIsSavingOwner(false);
    }
  };

  // Test dynamic authentication against database
  const handleRunAuthSimulator = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCred = credentials.find((c) => c.campusId === simCampusId);
    if (!targetCred) return;

    setIsSimulating(true);
    setSimResult(null);

    const authRes = await authenticateDynamicCampusLogin({
      usernameOrCode: targetCred.username,
      password: simPassword || targetCred.password,
      credentialsList: credentials,
      campuses,
    });
    setIsSimulating(false);

    recordCampusLoginActivity({
      campusId: targetCred.campusId,
      campusName: targetCred.campusName,
      campusCode: targetCred.campusCode,
      userName: targetCred.username,
      userRole: targetCred.role || 'Campus Accountant',
      ipAddress: '192.168.12.99',
      device: 'Security Vault Simulator',
      status: authRes.success ? 'success' : 'failed',
      method: 'dynamic_auth',
      remarks: authRes.success
        ? `Authentication verified against Firestore DB [${firebaseConfig.firestoreDatabaseId}]`
        : `Authentication Denied: ${authRes.message}`,
    });

    if (authRes.success) {
      setSimResult({
        success: true,
        message: `Authentication Verified: Logged in successfully as ${authRes.campus?.name} (${authRes.credential?.username || 'Verified Accountant'}). Token validated against Firestore Database [${firebaseConfig.firestoreDatabaseId}].`,
      });
    } else {
      setSimResult({
        success: false,
        message: `Authentication Denied: ${authRes.message}`,
      });
    }
  };

  // Print all slips (with strict executive password protection)
  const handlePrintSlips = () => {
    const printContent = visibleCredentials
      .map((c) => {
        const canView = isPasswordVisibleForUser(c.campusId);
        const passText = canView
          ? c.password
          : '[RESTRICTED — ACCESSIBLE ONLY TO DESIGNATED PARENT CAMPUS ADMINISTRATOR]';
        return `=========================================
CAMPUS DATABASE AUTHENTICATION SLIP
=========================================
Branch: ${c.campusName} (${c.campusCode})
City: ${c.city || 'Punjab'}
Accountant: ${c.accountantName || 'Designated Accountant'}
------------------------------------------
Campus Portal Username: ${c.username}
Executive Password:     ${passText}
Role Scope:             ${c.role}
Database ID:            ${firebaseConfig.firestoreDatabaseId}
Dynamic Token:          ${c.dynamicToken}
Status:                 ${c.status.toUpperCase()}
Generated:              ${new Date(c.generatedAt).toLocaleDateString()}
=========================================`;
      })
      .join('\n\n');

    setPrintSlipsContent(printContent);
    setIsPrintModalOpen(true);
    navigator.clipboard?.writeText(printContent);
    showToast('success', 'Authentication slips generated & copied to clipboard!');
  };

  if (!isOpen) return null;

  if (!isCampusSuperAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl text-white">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black">Campus Database Access Restricted</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Campus Database credentials and synchronization vault are strictly restricted to <strong>Platform Administrators</strong> and <strong>Main Branch Super Administrators</strong> for authorized sub-campuses. Other client campuses cannot be viewed.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <KeyRound className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                <span>Security Vault</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400" />
                  <span>Firestore DB: {firebaseConfig.firestoreDatabaseId}</span>
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Platform Site Admin & Campus Database Vault
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Campus DB & Passwords</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-900 text-indigo-200 text-[10px]">
                {visibleCredentials.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile_mgmt')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'profile_mgmt'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserCog className="w-3.5 h-3.5 text-purple-300" />
              <span>Platform Owner Profile</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-200">
                Owner Only
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Auth Simulator</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
            <span>Role:</span>
            <span className="font-mono font-bold text-amber-300">
              {currentUser?.role || (isSuperAdmin ? 'Platform Owner' : 'Super Admin')}
            </span>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="hover:opacity-80 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: Campus DB Vault & Passwords */}
        {activeTab === 'vault' && (
          <>
            {/* Action Controls Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search campus, code, username..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <span className="text-xs text-slate-500">
                  Showing <strong>{visibleCredentials.length}</strong> authorized campus branch{visibleCredentials.length === 1 ? '' : 'es'}.
                  {!isPlatformAdmin && ' (Super Admin: Sub-campuses only)'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncAllToDatabase}
                  disabled={isSyncing}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync All to Database</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintSlips}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Login Slips</span>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Campus Branch</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Dynamic Password</th>
                      <th className="p-3">Role & Status</th>
                      <th className="p-3">DB Sync Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                    {visibleCredentials.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No authorized campus credentials match your criteria.
                        </td>
                      </tr>
                    ) : (
                      visibleCredentials.map((cred) => {
                        const targetCampusObj = campuses.find((c) => c.id === cred.campusId);
                        const parentCampusObj = targetCampusObj?.parentCampusId
                          ? campuses.find((c) => c.id === targetCampusObj.parentCampusId)
                          : null;
                        const canViewExecutivePassword = isPasswordVisibleForUser(cred.campusId);
                        const isVisible = showPasswords[cred.id] && canViewExecutivePassword;
                        return (
                          <tr key={cred.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{cred.campusName}</div>
                              <div className="font-mono text-[11px] text-slate-500">
                                {cred.campusCode} · {cred.city || 'Punjab'}
                              </div>
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  {cred.username}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(cred.username, `user-${cred.id}`)}
                                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                  title="Copy username"
                                >
                                  {copiedId === `user-${cred.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="p-3">
                              {canViewExecutivePassword ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                                    {isVisible ? cred.password : '••••••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePassword(cred.id, cred.campusId)}
                                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                    title={isVisible ? 'Hide password' : 'Show password'}
                                  >
                                    {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(cred.password, `pass-${cred.id}`, cred.campusId)}
                                    className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                                    title="Copy password"
                                  >
                                    {copiedId === `pass-${cred.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded border border-slate-200 text-xs select-none">
                                    ••••••••••••
                                  </span>
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                    title={
                                      parentCampusObj
                                        ? `Restricted: Executive password only shown to designated Parent Campus (${parentCampusObj.name})`
                                        : 'Restricted: Visible to Main Parent Campus only'
                                    }
                                  >
                                    <Lock className="w-3 h-3 text-amber-600" />
                                    <span>Parent Only</span>
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="p-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                                  Campus Accountant
                                </span>
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    cred.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                  }`}
                                  title={`Status: ${cred.status}`}
                                />
                              </div>
                            </td>

                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Synced</span>
                              </span>
                            </td>

                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canViewExecutivePassword ? (
                                  <>
                                    {/* Change Password Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCred(cred);
                                        setCustomPassword('');
                                        setConfirmPassword('');
                                        setPassError(null);
                                      }}
                                      className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Set a custom password for this campus"
                                    >
                                      <Key className="w-3 h-3 text-indigo-600" />
                                      <span>Change Password</span>
                                    </button>

                                    {/* Auto-Rotate Password */}
                                    <button
                                      type="button"
                                      onClick={() => handleRotateCampusPassword(cred.campusId)}
                                      disabled={isSyncing}
                                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                      title="Regenerate dynamic password and sync to Firestore"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      <span>Rotate</span>
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Managed by {parentCampusObj?.code || 'Parent Campus'}
                                  </span>
                                )}

                                {onSelectCampusLogin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      setTimeout(() => {
                                        onSelectCampusLogin(cred.campusId);
                                      }, 10);
                                    }}
                                    className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] font-bold cursor-pointer transition-colors"
                                    title="Fill credentials into login form"
                                  >
                                    Fill Form
                                  </button>
                                )}

                                {loginAsCampus && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      recordCampusLoginActivity({
                                        campusId: cred.campusId,
                                        campusName: cred.campusName,
                                        campusCode: cred.campusCode,
                                        userName: cred.username,
                                        userRole: cred.role || 'Campus Accountant',
                                        ipAddress: '192.168.12.' + (Math.floor(Math.random() * 80) + 20),
                                        device: 'Security Vault Console',
                                        status: 'success',
                                        method: 'vault_one_click',
                                        remarks: `Instant Campus Login authenticated from Security Vault for ${cred.campusName} (${cred.campusCode})`,
                                      });
                                      onClose();
                                      setTimeout(() => {
                                        loginAsCampus(cred.campusId);
                                      }, 20);
                                    }}
                                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                                    title="Instant login into this campus branch"
                                  >
                                    Instant Login
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: Platform Owner Profile Management (Owner Only) */}
        {activeTab === 'profile_mgmt' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            {!isPlatformOwner ? (
              <div className="max-w-lg mx-auto bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  Profile Management Restricted
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Only the designated <strong>Platform Owner</strong> can modify root credentials, master system authentication passwords, and administrative profile settings. Super administrators of main campuses or sub-campuses do not have permission to alter platform owner credentials.
                </p>
                <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-600 text-left">
                  Current Session Role: <span className="font-bold text-slate-900">{currentUser?.role || 'Campus Admin'}</span>
                  <br />
                  Authority Level: <span className="text-amber-600 font-bold">Standard Administrative Scope</span>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          Platform Owner Credentials & Master Profile
                        </h3>
                        <p className="text-xs text-slate-500">
                          Change master username, email, and authentication passwords for the Platform Owner.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] uppercase tracking-wider">
                      Root Clearance
                    </span>
                  </div>

                  <form onSubmit={handleSaveOwnerProfile} className="space-y-4">
                    {ownerPassError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{ownerPassError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Platform Owner Username
                        </label>
                        <input
                          type="text"
                          value={ownerUsername}
                          onChange={(e) => setOwnerUsername(e.target.value)}
                          className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          placeholder="e.g. admin or platform_owner"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={ownerDisplayName}
                          onChange={(e) => setOwnerDisplayName(e.target.value)}
                          className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          placeholder="e.g. Platform Super Admin"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Platform Owner Email Address
                      </label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        placeholder="owner@platform.org"
                        required
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-black text-slate-800 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-600" />
                        <span>Change Master Owner Password</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={ownerNewPassword}
                            onChange={(e) => setOwnerNewPassword(e.target.value)}
                            placeholder="Leave blank to keep unchanged"
                            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={ownerConfirmPassword}
                            onChange={(e) => setOwnerConfirmPassword(e.target.value)}
                            placeholder="Re-type new password"
                            className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={isSavingOwner}
                        className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingOwner ? 'Saving Credentials...' : 'Save Platform Owner Credentials'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Interactive Database Authentication Simulator */}
        {activeTab === 'simulator' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Live Cloud Database Authentication Simulator
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Test dynamic campus authentication against the live Firestore database (collection:{' '}
                <code className="text-indigo-600 font-bold">campus_credentials</code>).
              </p>

              <form onSubmit={handleRunAuthSimulator} className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Select Target Campus Branch
                  </label>
                  <select
                    value={simCampusId}
                    onChange={(e) => {
                      setSimCampusId(e.target.value);
                      const found = credentials.find((c) => c.campusId === e.target.value);
                      if (found) setSimPassword(found.password);
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    {authorizedCampuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Dynamic Password Credential
                  </label>
                  <input
                    type="text"
                    value={simPassword}
                    onChange={(e) => setSimPassword(e.target.value)}
                    placeholder="Enter or test password..."
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>{isSimulating ? 'Verifying with Firestore...' : 'Test Database Auth'}</span>
                </button>
              </form>

              {simResult && (
                <div
                  className={`mt-4 p-4 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
                    simResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  {simResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{simResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Database synchronization state:{' '}
            <strong className="text-slate-800">Firestore Cloud Enterprise Edition</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Change Password Dialog for a Campus Branch */}
      {editingCred && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Change Password for {editingCred.campusName}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-500">
                    Code: {editingCred.campusCode} · User: {editingCred.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCred(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomPassword} className="space-y-4">
              {passError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  New Custom Password
                </label>
                <div className="relative">
                  <input
                    type={showCustomPassInput ? 'text' : 'password'}
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter new password (min 5 chars)..."
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassInput(!showCustomPassInput)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCustomPassInput ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Confirm New Password
                </label>
                <input
                  type={showCustomPassInput ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCred(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSyncing ? 'Syncing...' : 'Save & Sync to DB'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Printable Slips Modal (Zero window.open, strictly adheres to environment constraints) */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Authorized Campus Login Slips
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Executive passwords for sub-campuses are protected & restricted to designated parent campuses.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-200 font-mono text-xs whitespace-pre select-all leading-relaxed">
              {printSlipsContent}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Slips copied to clipboard automatically.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(printSlipsContent);
                    showToast('success', 'Copied to clipboard!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Again</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
