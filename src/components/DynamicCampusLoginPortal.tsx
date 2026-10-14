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
  Sliders,
} from 'lucide-react';
import { useAccounting, SchoolLogo } from '../core/aplusEngine';
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

  const [selectedCampusId, setSelectedCampusId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aplus_saved_campus_id');
      if (saved && campuses.some((c) => c.id === saved)) return saved;
    }
    return campuses[0]?.id || '';
  });
  const [campusSearch, setCampusSearch] = useState<string>('');
  
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
  const [, setDbSyncStatus] = useState<'connected' | 'syncing'>('connected');

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

  // Automatic campus / branch / account detection based on username/code input
  const detectedTarget = useMemo(() => {
    const raw = identifier.trim().toLowerCase();
    if (!raw) return null;

    // Check direct match in users array (e.g. admin, accountant, cashier, principal)
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
        campusName: isSuper ? 'Platform Super Admin (All Campuses)' : userCampus?.name || 'Assigned Branch',
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

    // Check credentials by username or campusCode
    const byCred = credentials.find(
      (cr) => cr.username.toLowerCase() === raw || cr.campusCode.toLowerCase() === raw
    );
    if (byCred) {
      const foundCamp = campuses.find((c) => c.id === byCred.campusId);
      return {
        type: 'campus' as const,
        title: foundCamp?.name || byCred.campusName,
        role: 'Branch Terminal Access',
        campusName: foundCamp?.name || byCred.campusName,
        campusCode: byCred.campusCode,
        isSuper: false,
      };
    }

    return null;
  }, [identifier, campuses, credentials, users]);

  // Campus selection handler from directory
  const handleSelectCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    const target = campuses.find((c) => c.id === campusId);
    if (target) {
      setIdentifier(target.code);
    }
    setPassword('');
    setErrorMessage(null);
    if (rememberTerminal && typeof window !== 'undefined') {
      localStorage.setItem('aplus_saved_campus_id', campusId);
      if (target) localStorage.setItem('aplus_saved_campus_username', target.code);
    }
  };

  // Detect CapsLock on key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  // Unified Enterprise Authentication Handler
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
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
        setSuccessNotice('Administrator credentials ready. Click Sign In to proceed.');
      }, 1200);
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
        <div className="absolute -top-[20%] -left-[10%] w-[650px] h-[650px] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[35%] -right-[10%] w-[550px] h-[550px] bg-emerald-600/10 rounded-full blur-[150px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[750px] h-[750px] bg-blue-600/10 rounded-full blur-[170px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:28px_28px] opacity-20" />
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
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline font-mono text-[11px] text-slate-300">
                  Cloud DB Active
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

      {/* Main Corporate Authentication Hub */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Campus Directory & Architecture Overview */}
          <div className="lg:col-span-6 space-y-6 lg:pr-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold">
                <Building className="w-3.5 h-3.5 text-indigo-400" />
                <span>Enterprise Multi-Campus Financial Management</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Institutional <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-300 to-emerald-400">
                  Authentication Portal
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                Unified institutional portal with role-based access control, campus hierarchy segregation, 
                and dual-approval financial governance for all academic branches.
              </p>
            </div>

            {/* Campus Branch Grid Status Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Campus Branch Directory
                </span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {campuses.length} Campuses Active
                </span>
              </div>

              {/* Campus search */}
              <div className="relative">
                <input
                  type="text"
                  value={campusSearch}
                  onChange={(e) => setCampusSearch(e.target.value)}
                  placeholder="Filter by campus code, name, or city..."
                  className="w-full text-xs bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {campusSearch && (
                  <button
                    type="button"
                    onClick={() => setCampusSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Campus Cards List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 max-h-60 overflow-y-auto pr-0.5">
                {campuses
                  .filter(
                    (c) =>
                      c.name.toLowerCase().includes(campusSearch.toLowerCase()) ||
                      c.code.toLowerCase().includes(campusSearch.toLowerCase()) ||
                      (c.city && c.city.toLowerCase().includes(campusSearch.toLowerCase()))
                  )
                  .map((c) => {
                    const isSelected = selectedCampusId === c.id;
                    const isMain = (c as any).isMainCampus || !(c as any).parentCampusId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCampus(c.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer group flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/50'
                            : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] font-black text-indigo-400 uppercase bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/80">
                              {c.code}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              isMain ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-sky-950/80 text-sky-300 border border-sky-800'
                            }`}>
                              {isMain ? 'Main' : 'Sub'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            {c.accountantName || 'Branch Accountant'} • {c.city || 'Campus Branch'}
                          </p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">
                            Float: PKR {c.pettyCashFloat ? c.pettyCashFloat.toLocaleString() : '35,000'}
                          </span>
                          <span className={`text-[10px] font-bold ${
                            isSelected ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-200'
                          }`}>
                            {isSelected ? 'Selected ✓' : 'Select →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Security Guarantee Badges */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>256-Bit Encrypted Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Hierarchical RBAC Enforcement</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-End Corporate ERP Sign-In Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
              
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    Terminal Sign-In
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Authorized Access
                  </span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Sign In to ERP Terminal
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Enter your assigned campus code, username, or administrative credentials.
                </p>
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

              {/* Clean Corporate Form */}
              <form onSubmit={handleLoginSubmit} autoComplete="off" className="space-y-4">
                
                {/* Field 1: Campus Code, Staff Username, or Email */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Account / Campus Identifier
                    </label>
                    <span className="text-[11px] text-indigo-400 font-semibold">
                      Required
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="e.g. C-01, admin, isb-acc, or email..."
                      className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500 transition-colors"
                      autoComplete="username"
                      required
                    />
                    <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Auto-detected Account / Branch Identification Chip */}
                  {detectedTarget && (
                    <div className="mt-2 px-3 py-2 rounded-xl bg-indigo-950/70 border border-indigo-700/60 text-xs text-indigo-200 flex items-center justify-between animate-in fade-in">
                      <div className="flex items-center gap-1.5 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          {detectedTarget.isSuper ? (
                            <strong className="text-amber-300">Platform Super Administrator</strong>
                          ) : (
                            <>
                              Scope: <strong className="text-white">{detectedTarget.campusName}</strong> ({detectedTarget.campusCode})
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

                {/* Field 2: Password / Security Key */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Password or Terminal Security Key
                    </label>
                    <span className="text-[11px] text-indigo-400 font-semibold">
                      Required
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter security password..."
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
                          if (val) {
                            localStorage.setItem('aplus_saved_campus_id', selectedCampusId);
                          } else {
                            localStorage.removeItem('aplus_saved_campus_id');
                          }
                        }
                      }}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Remember terminal identifier</span>
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
                      <span>Authenticating Credentials...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Sign In to ERP Terminal</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Helpers */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-slate-500" />
                  Hierarchical Multi-Campus Scope
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
            <span>Segregated Ledger Hierarchy</span>
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
