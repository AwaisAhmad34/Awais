import React, { useState, useEffect } from 'react';
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
    loginAsUser,
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
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<CampusCredential[]>(() =>
    ensureCredentialsForAllCampuses(campuses, getLocalStoredCampusCredentials())
  );
  const [dbSyncStatus, setDbSyncStatus] = useState<'connected' | 'syncing'>('connected');

  // Load and subscribe to real-time credentials from Firestore
  useEffect(() => {
    setDbSyncStatus('syncing');
    fetchCampusCredentialsFromCloud()
      .then((cloudCreds) => {
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
      .catch(() => setDbSyncStatus('connected'));

    const unsubscribe = subscribeToCloudCampusCredentials((latest) => {
      setCredentials(latest);
      setDbSyncStatus('connected');
    });

    return unsubscribe;
  }, [campuses]);

  // When selected campus changes, pre-fill password helper if wanted
  const activeCampusCredential = credentials.find((c) => c.campusId === selectedCampusId);

  // Quick fill dynamic credentials helper
  const handleQuickFillCredential = () => {
    if (activeCampusCredential) {
      setCampusPassword(activeCampusCredential.password);
      setErrorMessage(null);
    }
  };

  // Submit Campus Authentication
  const handleCampusLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const targetCampus = campuses.find((c) => c.id === selectedCampusId);
    if (!targetCampus) {
      setErrorMessage('Please select a valid school campus branch.');
      return;
    }

    if (!campusPassword) {
      setErrorMessage('Please enter the dynamic password for this campus.');
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
          authResult.message || 'Authentication failed. Please verify the dynamic credentials.'
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
      setErrorMessage(err?.message || 'Authentication error occurred.');
    }
  };

  // Submit Super Administrator Login
  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!adminUsername || !adminPassword) {
      setErrorMessage('Please enter both administrator username and password.');
      return;
    }

    setIsAuthenticating(true);
    const result = login(adminUsername, adminPassword);
    setIsAuthenticating(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Invalid administrator credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between py-8 px-4 sm:px-6 selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SchoolLogo size="sm" />
          <div>
            <span className="text-white font-black tracking-tight text-base sm:text-lg block">
              {orgSettings?.schoolName || 'Aplus School System'}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              Multi-Campus Financial Vouchers & Imprest Petty Cash Management
            </span>
          </div>
        </div>

        {/* Database Status Indicator Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-mono text-[11px]">
              Cloud DB:{' '}
              <strong className="text-emerald-400">
                {firebaseConfig.firestoreDatabaseId.slice(0, 16)}...
              </strong>
            </span>
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Synced
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCredentialsModalOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Credentials Vault</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-xl mx-auto w-full my-8">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Card Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Dynamic Database Authentication Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Campus Branch Financial Sign In
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Dynamic multi-campus credentials synchronized across branch terminals via Google Cloud Firestore.
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('campus');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'campus'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Campus Branch Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Central Admin / Director</span>
            </button>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: CAMPUS BRANCH LOGIN FORM */}
          {activeTab === 'campus' && (
            <form onSubmit={handleCampusLoginSubmit} className="space-y-4">
              {/* Campus Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>Select Campus Branch</span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {campuses.length} Branches Synchronized
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={selectedCampusId}
                    onChange={(e) => {
                      setSelectedCampusId(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="w-full text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) — {c.city || 'Gujranwala'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Campus Info Snippet */}
              {activeCampusCredential && (
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-950 font-bold">
                      Dynamic Username: <code className="font-mono">{activeCampusCredential.username}</code>
                    </span>
                    <button
                      type="button"
                      onClick={handleQuickFillCredential}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                    >
                      Auto-Fill Dynamic Password
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Accountant: {activeCampusCredential.accountantName} · City:{' '}
                    {activeCampusCredential.city || 'Gujranwala'}
                  </div>
                </div>
              )}

              {/* Dynamic Password Field */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Dynamic Password Credential
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={campusPassword}
                    onChange={(e) => setCampusPassword(e.target.value)}
                    placeholder="Enter dynamic campus password..."
                    className="w-full text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
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
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying with Firestore Database...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In to Campus Branch</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: CENTRAL ADMINISTRATOR LOGIN FORM */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                <strong>Director / Super Administrator Portal:</strong> Full access to all campus branches,
                Chart of Accounts, bulk voucher approvals, and database credentials management.
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Administrator Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Administrator Access...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Sign In as Super Administrator</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Switcher & Legacy Option */}
          <div className="pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsCredentialsModalOpen(true)}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>View & Manage All Campus Passwords</span>
            </button>

            {onSwitchToLegacy && (
              <button
                type="button"
                onClick={onSwitchToLegacy}
                className="text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
              >
                Use Standard Login
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 space-y-1">
        <p>
          {orgSettings?.schoolName || 'Aplus School System'} • Multi-Campus Financial Voucher Architecture
        </p>
        <p className="text-[11px] text-slate-600">
          Compliant with IAS 1 & GAAP Four-Voucher Standard (BPV, BRV, CPV, CRV, JV) & Imprest Petty Cash
        </p>
      </footer>

      {/* Dynamic Credentials Modal */}
      <DynamicCampusAuthModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        onSelectCampusLogin={(campusId) => {
          setSelectedCampusId(campusId);
          setIsCredentialsModalOpen(false);
        }}
      />
    </div>
  );
};
