import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Building2,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  UserCheck,
  RefreshCw,
  BookOpen,
  RotateCcw,
  Building,
  KeyRound,
  Check,
  Sparkles,
  ChevronRight,
  Search,
  School,
  FileText,
  SlidersHorizontal,
  Layers,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useAccounting, SchoolLogo, Campus } from '../core/aplusEngine';
import {
  CampusCredential,
  getLocalStoredCampusCredentials,
  ensureCredentialsForAllCampuses,
  authenticateDynamicCampusLogin,
  fetchCampusCredentialsFromCloud,
  subscribeToCloudCampusCredentials,
  synchronizeCredentialsWithEngineUsers,
} from '../services/campusAuthSync';
import firebaseConfig from '../../firebase-applet-config.json';
import { ManualGuidanceTooltip } from './ManualGuidanceTooltip';
import { AplusSystemManual } from './AplusSystemManual';

interface DynamicCampusLoginPortalProps {
  onSwitchToLegacy?: () => void;
}

export const DynamicCampusLoginPortal: React.FC<DynamicCampusLoginPortalProps> = ({
  onSwitchToLegacy,
}) => {
  const {
    campuses,
    users,
    addUser,
    updateUser,
    resetUserPassword,
    login,
    loginAsCampus,
    orgSettings,
  } = useAccounting();

  // Remembered campus from previous session
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aplus_saved_campus_id');
      if (saved && campuses.some((c) => c.id === saved)) return saved;
    }
    // If there's only 1 campus, select it by default; otherwise allow selection
    return campuses.length > 0 ? campuses[0].id : null;
  });

  // Flow step: 'select_campus' or 'credentials'
  const [currentStep, setCurrentStep] = useState<'select_campus' | 'credentials'>(() => {
    if (typeof window !== 'undefined') {
      const savedId = localStorage.getItem('aplus_saved_campus_id');
      if (savedId && campuses.some((c) => c.id === savedId)) return 'credentials';
    }
    return 'credentials'; // Default to credentials with active campus, or can toggle
  });

  const [campusSearch, setCampusSearch] = useState<string>('');
  const [isSuperAdminMode, setIsSuperAdminMode] = useState<boolean>(false);

  // Single Unified Enterprise Credential Fields
  const [identifier, setIdentifier] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('aplus_saved_campus_username');
      if (savedUser) return savedUser;
      const savedId = localStorage.getItem('aplus_saved_campus_id');
      const found = campuses.find((c) => c.id === savedId);
      if (found) return found.code;
    }
    return campuses[0]?.code || '';
  });

  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [manualModalSectionId, setManualModalSectionId] = useState<string | null>(null);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aplus_remember_terminal') !== 'false';
    }
    return true;
  });

  // Cached credentials state for cloud validation
  const [credentials, setCredentials] = useState<CampusCredential[]>(() =>
    ensureCredentialsForAllCampuses(campuses, getLocalStoredCampusCredentials())
  );
  const [dbSyncStatus, setDbSyncStatus] = useState<'connected' | 'syncing'>('connected');

  // Load and subscribe to real-time credentials from Firestore for validation
  useEffect(() => {
    setDbSyncStatus('syncing');
    let isMounted = true;

    fetchCampusCredentialsFromCloud()
      .then((cloudCreds) => {
        if (!isMounted) return;
        const merged = ensureCredentialsForAllCampuses(campuses, cloudCreds);
        setCredentials(merged);
        setDbSyncStatus('connected');
        synchronizeCredentialsWithEngineUsers({
          credentials: merged,
          users,
          addUser,
          updateUser,
          resetUserPassword,
        });
      })
      .catch(() => {
        if (isMounted) setDbSyncStatus('connected');
      });

    const unsubscribe = subscribeToCloudCampusCredentials((latest) => {
      if (!isMounted) return;
      setCredentials(latest);
      setDbSyncStatus('connected');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [campuses]);

  // Selected campus entity
  const activeCampus = useMemo(() => {
    if (isSuperAdminMode) return null;
    return campuses.find((c) => c.id === selectedCampusId) || campuses[0] || null;
  }, [campuses, selectedCampusId, isSuperAdminMode]);

  // Parent campus of the selected active campus if it's a sub-branch
  const activeParentCampus = useMemo(() => {
    if (!activeCampus || !(activeCampus as any).parentCampusId) return null;
    return campuses.find((c) => c.id === (activeCampus as any).parentCampusId) || null;
  }, [campuses, activeCampus]);

  // Sub-campuses under active campus if it is a main parent
  const activeSubCampuses = useMemo(() => {
    if (!activeCampus) return [];
    return campuses.filter((c: any) => c.parentCampusId === activeCampus.id);
  }, [campuses, activeCampus]);

  // Detect user or campus based on entered identifier
  const detectedTarget = useMemo(() => {
    const raw = identifier.trim().toLowerCase();
    if (!raw) return null;

    // Check direct match in users array
    const byUser = users.find(
      (u) => u.username?.toLowerCase() === raw || u.email?.toLowerCase() === raw
    );
    if (byUser) {
      const isSuper = byUser.role === 'superadmin' || byUser.campusAccess === 'all';
      const userCampus = campuses.find((c) => c.id === byUser.campusId);
      return {
        type: 'user' as const,
        title: byUser.name || byUser.username,
        role: byUser.role,
        campusName: isSuper ? 'Platform Super Administrator (All Campuses)' : userCampus?.name || 'Assigned Branch',
        campusCode: isSuper ? 'CENTRAL' : userCampus?.code || 'CAMPUS',
        isSuper,
      };
    }

    // Check campuses by code, id, or name
    const byCampus = campuses.find(
      (c) =>
        c.code.toLowerCase() === raw ||
        c.id.toLowerCase() === raw ||
        c.name.toLowerCase() === raw
    );
    if (byCampus) {
      const isMain = (byCampus as any).isMainCampus || !(byCampus as any).parentCampusId;
      return {
        type: 'campus' as const,
        title: byCampus.name,
        role: isMain ? 'Main Campus (Parent)' : 'Sub-Campus Branch',
        campusName: byCampus.name,
        campusCode: byCampus.code,
        isSuper: false,
      };
    }

    return null;
  }, [identifier, campuses, users]);

  // Handle selection of a campus: automatically transitions to credentials step and populates fields
  const handleSelectCampus = (campus: Campus) => {
    setIsSuperAdminMode(false);
    setSelectedCampusId(campus.id);
    setIdentifier(campus.code);
    setPassword('');
    setErrorMessage(null);
    setCurrentStep('credentials');

    if (rememberTerminal && typeof window !== 'undefined') {
      localStorage.setItem('aplus_saved_campus_id', campus.id);
      localStorage.setItem('aplus_saved_campus_username', campus.code);
    }
  };

  // Handle selection of Central Super Administrator mode
  const handleSelectSuperAdmin = () => {
    setIsSuperAdminMode(true);
    setSelectedCampusId(null);
    setIdentifier('admin');
    setPassword('');
    setErrorMessage(null);
    setCurrentStep('credentials');
  };

  // Detect CapsLock on key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  // Submit Authentication
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const inputUser = identifier.trim();
    const inputPass = password.trim();

    if (!inputUser) {
      setErrorMessage('Please enter your Campus Code or User Credentials.');
      return;
    }

    if (!inputPass) {
      setErrorMessage('Please enter your secure access password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // Step 1: Check users database (including admin / staff / accountants)
      const matchedUser = users.find(
        (u) =>
          u.username?.toLowerCase() === inputUser.toLowerCase() ||
          u.email?.toLowerCase() === inputUser.toLowerCase()
      );

      // Step 2: Check campus credentials
      const matchedCred = credentials.find(
        (c) =>
          c.username.toLowerCase() === inputUser.toLowerCase() ||
          c.campusCode.toLowerCase() === inputUser.toLowerCase() ||
          c.campusId.toLowerCase() === inputUser.toLowerCase()
      );

      // Step 3: Check campus list
      const matchedCampus = campuses.find(
        (c) =>
          c.code.toLowerCase() === inputUser.toLowerCase() ||
          c.id.toLowerCase() === inputUser.toLowerCase() ||
          c.name.toLowerCase() === inputUser.toLowerCase()
      );

      // Determine target campus
      const targetCampusId =
        matchedUser?.campusId && matchedUser.campusId !== 'all'
          ? matchedUser.campusId
          : matchedCred?.campusId || matchedCampus?.id || selectedCampusId;

      const targetCampus = campuses.find((c) => c.id === targetCampusId) || campuses[0];

      // Authenticate via authenticateDynamicCampusLogin
      const authResult = await authenticateDynamicCampusLogin({
        usernameOrCode: inputUser,
        password: inputPass,
        credentialsList: credentials,
        campuses,
      });

      // Direct user password match
      const directUserPassMatch = matchedUser && (matchedUser.password === inputPass || !matchedUser.password);

      if (!authResult.success && !directUserPassMatch) {
        setIsAuthenticating(false);
        setErrorMessage(
          authResult.message || 'Authentication failed. Please verify your credentials or contact Central Administration.'
        );
        return;
      }

      // Remember terminal
      if (typeof window !== 'undefined' && rememberTerminal) {
        localStorage.setItem('aplus_saved_campus_username', inputUser);
        if (targetCampus) {
          localStorage.setItem('aplus_saved_campus_id', targetCampus.id);
        }
      }

      // Perform login in engine
      if (matchedUser) {
        const userLoginRes = login(matchedUser.username, inputPass);
        if (!userLoginRes.success && loginAsCampus && targetCampus) {
          loginAsCampus(targetCampus.id);
        }
      } else if (loginAsCampus && targetCampus) {
        loginAsCampus(targetCampus.id);
      } else {
        login(inputUser, inputPass);
      }
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMessage(err?.message || 'A network or authentication error occurred.');
    }
  };

  // Safe Super Administrator Emergency Account Recovery
  const handleRecoverSuperAdmin = async () => {
    setIsAuthenticating(true);
    setRecoveryFeedback(null);
    try {
      const existingAdmin = users?.find((u: any) => u.username?.toLowerCase() === 'admin');
      if (!existingAdmin) {
        addUser({
          id: 'user_master_superadmin_01',
          username: 'admin',
          email: 'admin@aplus.edu.pk',
          name: 'Super Administrator',
          role: 'superadmin',
          status: 'active',
          password: 'admin',
          campusAccess: 'all',
          permissions: ['all'],
        });
      } else {
        if (updateUser) {
          updateUser(existingAdmin.id, {
            role: 'superadmin',
            status: 'active',
            password: 'admin',
            campusAccess: 'all',
            permissions: ['all'],
          });
        }
        if (resetUserPassword) {
          resetUserPassword(existingAdmin.id, 'admin');
        }
      }

      setRecoveryFeedback('Central Super Admin account successfully verified and restored.');
      setIdentifier('admin');
      setPassword('admin');
      setIsSuperAdminMode(true);
      setCurrentStep('credentials');
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
        setSuccessNotice('Administrator credentials ready. Click Sign In to proceed.');
      }, 1000);
    } catch (err: any) {
      setRecoveryFeedback(`Recovery Error: ${err?.message || 'Could not recover Super Admin account.'}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[25%] -left-[10%] w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -right-[15%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[25%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[180px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
      </div>

      {/* Top Enterprise Navigation Bar */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Institution Crest & Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative p-1 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-slate-800 border border-indigo-500/30 shadow-inner">
              <SchoolLogo size="sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-extrabold tracking-tight text-base sm:text-lg">
                  {orgSettings?.schoolName || 'Aplus School System'}
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                  Institutional ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Multi-Campus Financial Voucher Architecture & Unified Access Portal
              </p>
            </div>
          </div>

          {/* Right Header Controls: Cloud Status & Manual */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-time Cloud Firestore Indicator */}
            <ManualGuidanceTooltip
              sectionNumber={6}
              sectionId="sec-6-dashboard"
              title="Cloud Firestore Real-Time Synchronization Engine"
              category="Foundations & Scope"
              purpose="Live health monitor tracking bidirectional cloud replication with Google Cloud Firestore database."
              guidanceBullets={[
                `Database: ${firebaseConfig.firestoreDatabaseId} (${(firebaseConfig as any).region || 'asia-southeast1'}).`,
                'All voucher creations (BPV, BRV, CPV, CRV, JV) replicate across campuses instantly.',
                'Role-based permissions and hierarchical campus assignments enforced.',
              ]}
              standardRef="Section 6 · Aplus 49-Section Manual"
              onOpenManual={(secId) => setManualModalSectionId(secId)}
              position="bottom"
              align="end"
            >
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 shadow-xs cursor-pointer hover:border-slate-700 transition-colors">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dbSyncStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${dbSyncStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </span>
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline font-mono text-[11px] text-slate-300">
                  Cloud DB Synced
                </span>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Live
                </span>
              </div>
            </ManualGuidanceTooltip>

            {/* 49-Section Manual Compliance Button */}
            <button
              type="button"
              onClick={() => setManualModalSectionId('sec-5-login')}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-slate-800 shadow-xs hover:border-slate-700"
              title="Open System Operating Procedures"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Operating SOPs</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Corporate ERP Authentication Workspace */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex items-center justify-center">
        
        {/* Grand Corporate ERP Card Container */}
        <div className="w-full max-w-5xl rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          
          {/* ================================================================ */}
          {/* LEFT SIDEBAR: CAMPUS BRANDING & INSTITUTIONAL CONTEXT           */}
          {/* ================================================================ */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/40 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between relative overflow-hidden">
            {/* Subtle brand glow behind crest */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              
              {/* Institution Emblem Header */}
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 shadow-md">
                  <SchoolLogo size="md" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    {orgSettings?.schoolName || 'Aplus School System'}
                  </h3>
                  <p className="text-[11px] text-indigo-300 font-mono">
                    Financial ERP Control Engine
                  </p>
                </div>
              </div>

              {/* Dynamic Campus Branding Card */}
              {isSuperAdminMode ? (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-amber-500/40 shadow-lg space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-500/30">
                      Platform Level 0
                    </span>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">Central Super Admin</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Master financial oversight across all campuses, charts of accounts, and system settings.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Access Scope:</span>
                    <span className="font-semibold text-emerald-400">Unrestricted Enterprise</span>
                  </div>
                </div>
              ) : activeCampus ? (
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-indigo-700/60 shadow-lg space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                  
                  {/* Branch Code and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                        {activeCampus.code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        (activeCampus as any).isMainCampus || !(activeCampus as any).parentCampusId
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                          : 'bg-sky-950/70 text-sky-300 border border-sky-800'
                      }`}>
                        {(activeCampus as any).isMainCampus || !(activeCampus as any).parentCampusId
                          ? 'Main Campus (Parent)'
                          : 'Sub-Campus (Child)'}
                      </span>
                    </div>

                    <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Terminal
                    </span>
                  </div>

                  {/* Campus Name and Location */}
                  <div>
                    <h4 className="text-base font-black text-white tracking-tight">
                      {activeCampus.name}
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {activeCampus.city || 'Punjab Region'} • {activeCampus.accountantName || 'Branch Accountant'}
                    </p>
                  </div>

                  {/* Hierarchy Parent / Child Indicator */}
                  {activeParentCampus && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-[11px] text-sky-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">
                        Reports to Parent: <strong>{activeParentCampus.name}</strong>
                      </span>
                    </div>
                  )}

                  {activeSubCampuses.length > 0 && (
                    <div className="px-2.5 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 text-[11px] text-indigo-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        Oversees {activeSubCampuses.length} Sub-Campuses ({activeSubCampuses.map(s => s.code).join(', ')})
                      </span>
                    </div>
                  )}

                  {/* Float & Segregation Specs */}
                  <div className="pt-2.5 border-t border-slate-800/90 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Petty Cash Float:</span>
                      <span className="font-mono font-bold text-white">
                        PKR {activeCampus.pettyCashFloat ? activeCampus.pettyCashFloat.toLocaleString() : '35,000'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Ledger Scope:</span>
                      <span className="font-bold text-emerald-400">Segregated Vault</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                  <Building2 className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">
                    Select a campus branch from the list to display its branding and credentials terminal.
                  </p>
                </div>
              )}

              {/* ERP Architecture Standard Badges */}
              <div className="space-y-2 pt-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>IAS 1 & GAAP Compliant Segregated Ledgers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Four-Voucher Standard (BPV, BRV, CPV, CRV, JV)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Imprest Petty Cash & Dual-Authorization Control</span>
                </div>
              </div>
            </div>

            {/* Bottom Institutional Accreditation */}
            <div className="pt-6 border-t border-slate-800/80 mt-6 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono">v3.4 Production</span>
              <span className="text-slate-400">256-Bit Encrypted</span>
            </div>
          </div>

          {/* ================================================================ */}
          {/* RIGHT COLUMN: INTERACTIVE AUTHENTICATION & CAMPUS FLOW          */}
          {/* ================================================================ */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
            <div className="space-y-5">
              
              {/* Card Flow Header & Progress Indicator */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-1">
                    <KeyRound className="w-3.5 h-3.5" />
                    Authentication Workflow
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {currentStep === 'select_campus' ? 'Select Campus Branch' : 'Terminal Credentials'}
                  </h2>
                </div>

                {/* Stage switcher / back action */}
                {currentStep === 'credentials' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep('select_campus');
                      setErrorMessage(null);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Change Branch</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-mono">
                    Step 1 of 2
                  </span>
                )}
              </div>

              {/* Toast / Status Banner */}
              {successNotice && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-200 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successNotice}</span>
                </div>
              )}

              {/* Error Message Alert */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-rose-400 hover:text-rose-200 cursor-pointer"
                  >
                    &times;
                  </button>
                </div>
              )}

              {/* CapsLock Warning */}
              {isCapsLockOn && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Caps Lock is ON</span>
                </div>
              )}

              {/* ================================================================ */}
              {/* FLOW VIEW 1: CAMPUS SELECTION CARDS DIRECTLY IN THE WORKFLOW      */}
              {/* ================================================================ */}
              {currentStep === 'select_campus' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs text-slate-400">
                    Choose your assigned campus branch to unlock its dedicated login terminal:
                  </p>

                  {/* Campus search input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={campusSearch}
                      onChange={(e) => setCampusSearch(e.target.value)}
                      placeholder="Filter by campus code, branch name, or city..."
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2.5 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    {campusSearch && (
                      <button
                        type="button"
                        onClick={() => setCampusSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Campus Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[310px] overflow-y-auto pr-1">
                    {campuses
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(campusSearch.toLowerCase()) ||
                          c.code.toLowerCase().includes(campusSearch.toLowerCase()) ||
                          (c.city && c.city.toLowerCase().includes(campusSearch.toLowerCase()))
                      )
                      .map((c) => {
                        const isMain = (c as any).isMainCampus || !(c as any).parentCampusId;
                        const isSelected = selectedCampusId === c.id && !isSuperAdminMode;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCampus(c)}
                            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer group flex flex-col justify-between ${
                              isSelected
                                ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                                : 'bg-slate-950/70 border-slate-800 hover:border-indigo-600/70 hover:bg-slate-900/80 hover:-translate-y-0.5'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                                  {c.code}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  isMain ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-sky-950 text-sky-300 border border-sky-800'
                                }`}>
                                  {isMain ? 'Parent' : 'Sub-Campus'}
                                </span>
                              </div>
                              <h4 className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors">
                                {c.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                {c.city || 'Punjab'} • {c.accountantName || 'Branch Accountant'}
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-mono">
                                Float: PKR {c.pettyCashFloat ? c.pettyCashFloat.toLocaleString() : '35,000'}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-0.5">
                                <span>Select</span>
                                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Master Super Admin Option */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleSelectSuperAdmin}
                      className="w-full p-3 rounded-2xl bg-gradient-to-r from-slate-950 to-indigo-950/60 border border-amber-500/30 hover:border-amber-500/60 transition-all text-left flex items-center justify-between cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            Central Platform Super Administrator
                          </p>
                          <p className="text-[10px] text-slate-400">
                            System-wide authorization, all campus ledgers, and site management
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {/* ================================================================ */}
              {/* FLOW VIEW 2: CREDENTIALS APPEAR AUTOMATICALLY ON SELECTION        */}
              {/* ================================================================ */}
              {currentStep === 'credentials' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-3 duration-200">
                  
                  {/* Selected Campus Identity Banner */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-indigo-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                        {isSuperAdminMode ? (
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Building2 className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {isSuperAdminMode ? 'Central Super Administrator' : activeCampus?.name}
                          </span>
                          {!isSuperAdminMode && activeCampus && (
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {activeCampus.code}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {isSuperAdminMode
                            ? 'Master administrative access across all campus ledgers'
                            : `${activeCampus?.city || 'Punjab'} • ${activeCampus?.accountantName || 'Branch Accountant'}`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep('select_campus');
                        setErrorMessage(null);
                      }}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                    >
                      Switch
                    </button>
                  </div>

                  {/* Credentials Form */}
                  <form onSubmit={handleLoginSubmit} autoComplete="off" className="space-y-4">
                    
                    {/* Identifier Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Campus Identifier or Username
                        </label>
                        <span className="text-[10px] text-indigo-400 font-semibold">
                          Required
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g. Campus code (ISB-MAIN) or username (admin)..."
                          className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 transition-colors"
                          autoComplete="username"
                          required
                        />
                        <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Live Target Resolution Chip */}
                      {detectedTarget && (
                        <div className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-xs text-indigo-200 flex items-center justify-between animate-in fade-in">
                          <div className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {detectedTarget.isSuper ? (
                                <strong className="text-amber-300">Central Master Admin</strong>
                              ) : (
                                <>
                                  Scope: <strong className="text-white">{detectedTarget.campusName}</strong>
                                </>
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 shrink-0">
                            {detectedTarget.role}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Security Password / Key
                        </label>
                        <span className="text-[10px] text-indigo-400 font-semibold">
                          Required
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Enter your security password..."
                          className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 transition-colors"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Terminal Checkbox */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberTerminal}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setRememberTerminal(val);
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('aplus_remember_terminal', val ? 'true' : 'false');
                              if (val && activeCampus) {
                                localStorage.setItem('aplus_saved_campus_id', activeCampus.id);
                              } else {
                                localStorage.removeItem('aplus_saved_campus_id');
                              }
                            }
                          }}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Remember this campus terminal</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setIsRecoveryModalOpen(true)}
                        className="text-slate-400 hover:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Emergency Access</span>
                      </button>
                    </div>

                    {/* Primary Sign-In Button */}
                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:translate-y-[-1px] active:translate-y-[0px]"
                    >
                      {isAuthenticating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Authenticating Terminal...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>
                            {isSuperAdminMode
                              ? 'Sign In as Super Administrator'
                              : activeCampus
                              ? `Sign In to ${activeCampus.name} Terminal`
                              : 'Sign In with Credentials'}
                          </span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Bottom Card Footer */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs mt-6">
              <span className="text-slate-500 text-[11px] flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                Segregated Financial Voucher Vault
              </span>

              {onSwitchToLegacy && (
                <button
                  type="button"
                  onClick={onSwitchToLegacy}
                  className="text-slate-400 hover:text-slate-200 font-medium underline cursor-pointer"
                >
                  Legacy Form
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Institutional Enterprise Footer */}
      <footer className="relative z-10 w-full border-t border-slate-900 bg-slate-950/90 px-4 sm:px-8 py-4 text-center text-xs text-slate-500 space-y-1">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-slate-400">
            {orgSettings?.schoolName || 'Aplus School System'} • Multi-Campus Financial Voucher Architecture
          </p>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>IAS 1 & GAAP Compliant</span>
            <span>•</span>
            <span>Hierarchical Access Isolation</span>
            <span>•</span>
            <span className="text-slate-400 font-mono">v3.4.0 Production</span>
          </div>
        </div>
      </footer>

      {/* Emergency Super Admin Recovery Modal */}
      {isRecoveryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-800 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">Emergency Admin Recovery</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If the central Super Administrator record was cleared or credentials were lost, click below to verify and restore the platform master administrator account.
            </p>

            {recoveryFeedback && (
              <div className="p-3 rounded-xl bg-slate-950 border border-indigo-700/60 text-xs font-mono text-indigo-200">
                {recoveryFeedback}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRecoverSuperAdmin}
                disabled={isAuthenticating}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/30"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Verify & Restore Master Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 49-Section System Manual & Procedures Modal */}
      {manualModalSectionId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 w-full max-w-6xl max-h-[94vh] rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
            <div className="overflow-y-auto flex-1">
              <AplusSystemManual
                LegacyDocs={() => null}
                initialSectionId={manualModalSectionId}
                onClose={() => setManualModalSectionId(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
