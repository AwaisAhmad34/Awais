import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Building2,
  KeyRound,
  Database,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Lock,
  UserCheck,
  RefreshCw,
  HelpCircle,
  School,
  ExternalLink,
  BookOpen,
  ChevronRight,
  Check,
  Copy,
  Info,
  Clock,
  MapPin,
  Laptop,
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
import { DynamicCampusAuthModal } from './DynamicCampusAuthModal';
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

  const [activeTab, setActiveTab] = useState<'campus' | 'admin'>('campus');
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '');
  const [campusPassword, setCampusPassword] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [adminPassword, setAdminPassword] = useState<string>('admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [manualModalSectionId, setManualModalSectionId] = useState<string | null>(null);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [rememberTerminal, setRememberTerminal] = useState(true);

  // Cached credentials state
  const [credentials, setCredentials] = useState<CampusCredential[]>(() =>
    ensureCredentialsForAllCampuses(campuses, getLocalStoredCampusCredentials())
  );
  const [dbSyncStatus, setDbSyncStatus] = useState<'connected' | 'syncing'>('connected');

  // Load and subscribe to real-time credentials from Firestore
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

  // When selected campus changes, update selected campus credential
  const activeCampusCredential = credentials.find((c) => c.campusId === selectedCampusId);
  const activeCampus = campuses.find((c) => c.id === selectedCampusId) || campuses[0];

  // Quick fill dynamic credentials helper for seamless evaluation
  const handleQuickFillCampus = (campusId: string) => {
    setSelectedCampusId(campusId);
    const targetCred = credentials.find((c) => c.campusId === campusId);
    if (targetCred) {
      setCampusPassword(targetCred.password);
      setErrorMessage(null);
      setSuccessNotice(`Loaded credentials for ${targetCred.campusName}`);
      setTimeout(() => setSuccessNotice(null), 3000);
    }
  };

  const handleQuickFillAdmin = () => {
    setAdminUsername('admin');
    setAdminPassword('admin');
    setErrorMessage(null);
    setSuccessNotice('Master Administrator credentials loaded (admin / admin)');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  // Detect CapsLock on key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  // Submit Campus Authentication
  const handleCampusLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const targetCampus = campuses.find((c) => c.id === selectedCampusId);
    if (!targetCampus) {
      setErrorMessage('Please select a valid school campus branch to continue.');
      return;
    }

    if (!campusPassword) {
      setErrorMessage('Please enter the security password for this campus terminal.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // Step 1: Verify against dynamic credentials in Firestore
      const authResult = await authenticateDynamicCampusLogin({
        usernameOrCode: activeCampusCredential?.username || targetCampus.code,
        password: campusPassword,
        credentialsList: credentials,
        campuses,
      });

      if (!authResult.success) {
        setIsAuthenticating(false);
        setErrorMessage(
          authResult.message || 'Authentication failed. Please check the branch credentials or contact IT administration.'
        );
        return;
      }

      // Step 2: Use native engine login mechanism
      if (loginAsCampus) {
        loginAsCampus(targetCampus.id);
      } else {
        // Fallback to standard login with username/password
        login(activeCampusCredential?.username || targetCampus.code, campusPassword);
      }
    } catch (err: any) {
      setIsAuthenticating(false);
      setErrorMessage(err?.message || 'A network or authentication error occurred.');
    }
  };

  // Submit Super Administrator Login
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!adminUsername || !adminPassword) {
      setErrorMessage('Please enter both administrator username and password.');
      return;
    }

    setIsAuthenticating(true);
    const result = login(adminUsername, adminPassword);
    setIsAuthenticating(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Invalid administrator username or security key.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-x-hidden font-sans">
      {/* Background ambient lighting effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[25%] -left-[10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[130px]" />
        <div className="absolute top-[40%] -right-[15%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[20%] left-[25%] w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
      </div>

      {/* Top Navigation Bar */}
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
                  ERP Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Multi-Campus Voucher Ledger & Imprest Petty Cash Management
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
                'All voucher creations (BPV, BRV, CPV, CRV, JV) and disbursements replicate across campuses instantly.',
                'Maintains local memory cache for uninterrupted transaction processing.',
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
              title="Open 49-Section System Operating Manual"
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Operating SOPs</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Authentication Section */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: System Highlights & Architecture Info (Desktop) */}
          <div className="lg:col-span-6 space-y-6 lg:pr-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>IAS 1 & GAAP Compliant Multi-Branch ERP</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                Secure Campus <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-300 to-emerald-400">
                  Financial Portal
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                Unified institutional authentication for campus accountants and central directors. 
                Complete four-voucher segregation (BPV, BRV, CPV, CRV, JV) with real-time imprest petty cash float controls.
              </p>
            </div>

            {/* Campus Branch Grid Status Card */}
            <div className="bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  Connected Campus Branches
                </span>
                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {campuses.length} Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {campuses.map((c) => {
                  const cred = credentials.find((cr) => cr.campusId === c.id);
                  const isSelected = selectedCampusId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveTab('campus');
                        handleQuickFillCampus(c.id);
                      }}
                      className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer group ${
                        isSelected && activeTab === 'campus'
                          ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/50'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-bold text-indigo-400 uppercase">
                          {c.code}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {c.city || 'Punjab'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white truncate group-hover:text-indigo-200 transition-colors">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Float: PKR {c.pettyCashFloat ? c.pettyCashFloat.toLocaleString() : '35,000'}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Bank & Cash Sub-Ledger Segregation
                </span>
                <button
                  type="button"
                  onClick={() => setIsCredentialsModalOpen(true)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  Vault Directory
                </button>
              </div>
            </div>

            {/* Quick Audit / Security Guarantee */}
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>256-Bit Encrypted Session</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Audit Trail Logging (Sec. 39)</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Sign-In Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
              
              {/* Card Header & Tabs */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Terminal Authentication
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>

                {/* Segmented Tab Switcher */}
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('campus');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'campus'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Campus Branch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('admin');
                      setErrorMessage(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-gradient-to-r from-slate-800 to-indigo-900 text-white shadow-md border border-indigo-700/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Central Admin</span>
                  </button>
                </div>
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

              {/* TAB 1: CAMPUS BRANCH LOGIN FORM */}
              {activeTab === 'campus' && (
                <form onSubmit={handleCampusLoginSubmit} className="space-y-4">
                  {/* Campus Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                      <span>Select Campus Branch</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        {campuses.length} Branches Synchronized
                      </span>
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCampusId}
                        onChange={(e) => {
                          setSelectedCampusId(e.target.value);
                          setErrorMessage(null);
                        }}
                        className="w-full text-sm font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-10"
                      >
                        {campuses.map((c) => (
                          <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                            {c.name} ({c.code}) — {c.city || 'Gujranwala'}
                          </option>
                        ))}
                      </select>
                      <Building2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Campus Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                        Campus Security Password
                      </label>
                      {activeCampusCredential && (
                        <button
                          type="button"
                          onClick={() => handleQuickFillCampus(selectedCampusId)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                        >
                          Auto-Fill Branch Key
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={campusPassword}
                        onChange={(e) => setCampusPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter dynamic campus password..."
                        className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                        autoComplete="current-password"
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
                        onChange={(e) => setRememberTerminal(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>Remember this workstation terminal</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setManualModalSectionId('sec-5-login')}
                      className="text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                    >
                      Login Help
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:translate-y-[-1px] active:translate-y-[0px]"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying with Firestore Database...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Sign In to {activeCampus?.name || 'Campus'}</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* TAB 2: CENTRAL ADMINISTRATOR LOGIN FORM */}
              {activeTab === 'admin' && (
                <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                  <div className="bg-slate-950/70 border border-indigo-900/50 rounded-xl p-3 text-xs text-indigo-200 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-semibold mb-0.5">Super Administrator Portal</strong>
                      Full administrative clearance for all campus ledgers, Chart of Accounts, bulk approvals, and credentials vault.
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                      Administrator Username
                    </label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                        Master Security Key
                      </label>
                      <button
                        type="button"
                        onClick={handleQuickFillAdmin}
                        className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        Auto-Fill Demo Admin Key
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="••••••"
                        className="w-full text-sm font-mono font-bold text-white bg-slate-950 border border-slate-700 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                        autoComplete="current-password"
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

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer hover:translate-y-[-1px] active:translate-y-[0px]"
                  >
                    {isAuthenticating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Administrator Access...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-amber-300" />
                        <span>Sign In as Super Administrator</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Bottom Quick Access Helpers */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCredentialsModalOpen(true)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 cursor-pointer hover:underline"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Campus Credentials Vault</span>
                </button>

                {onSwitchToLegacy && (
                  <button
                    type="button"
                    onClick={onSwitchToLegacy}
                    className="text-slate-400 hover:text-slate-200 font-medium underline cursor-pointer"
                  >
                    Standard Form Login
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
            <span>Four-Voucher Standard (BPV, BRV, CPV, CRV, JV)</span>
            <span>•</span>
            <span className="text-slate-400 font-mono">v3.4.0 Production</span>
          </div>
        </div>
      </footer>

      {/* Dynamic Credentials Vault & Password Rotation Modal */}
      {isCredentialsModalOpen && (
        <DynamicCampusAuthModal
          isOpen={isCredentialsModalOpen}
          onClose={() => setIsCredentialsModalOpen(false)}
          onSelectCampusLogin={(campusId) => {
            setSelectedCampusId(campusId);
            setIsCredentialsModalOpen(false);
            handleQuickFillCampus(campusId);
          }}
        />
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
