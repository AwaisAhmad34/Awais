import React, { useState } from 'react';
import {
  ShieldCheck,
  Building2,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  School,
  KeyRound,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { getStoredSchoolClients } from '../services/platformSiteAdminService';
import { recordCampusLoginActivity } from '../services/campusLoginActivityService';
import {
  authenticateAccount,
  provisionInitialPlatformOwner,
  getVerifiedProfile,
} from '../services/secureAuthentication';

interface DynamicCampusLoginPortalProps {
  onSwitchToLegacy?: () => void;
}

export const DynamicCampusLoginPortal: React.FC<DynamicCampusLoginPortalProps> = () => {
  const { loginAsUser, campuses, orgSettings, users, addUser } = useAccounting();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [clientsVersion, setClientsVersion] = useState(0);

  // Controlled Platform Owner Setup Modal
  const [isOwnerSetupOpen, setIsOwnerSetupOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('siteowner@platform.org');
  const [ownerName, setOwnerName] = useState('Platform Super Admin (Site Owner)');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [ownerSetupStatus, setOwnerSetupStatus] = useState<string | null>(null);
  const [isSettingUpOwner, setIsSettingUpOwner] = useState(false);

  React.useEffect(() => {
    const fn = () => setClientsVersion((v) => v + 1);
    window.addEventListener('aplus-clients-updated', fn);
    return () => window.removeEventListener('aplus-clients-updated', fn);
  }, []);

  const storedClients = React.useMemo(() => {
    return getStoredSchoolClients();
  }, [clientsVersion]);

  const matchingClient = React.useMemo(() => {
    if (!username.trim()) return storedClients.find((c) => c.logoUrl);
    const prefix = username.trim().toLowerCase().split(/[@.]/)[0];
    return (
      storedClients.find(
        (c) => c.code.toLowerCase() === prefix || c.name.toLowerCase().includes(prefix)
      ) || storedClients.find((c) => c.logoUrl)
    );
  }, [username, storedClients]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanInput = username.trim();
    const cleanPass = password;

    if (!cleanInput) {
      setErrorMessage('Please enter your institutional email or username.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // 1. Strictly authenticate via Firebase Authentication and load verified server-side membership
      const profile = await authenticateAccount(cleanInput, cleanPass);

      setSuccessNotice(`Authentication verified. Opening dashboard workspace...`);

      // 2. Map verified cloud membership to local session
      const isSuper = profile.permissionLevel === 'level_1_platform_super_admin';
      
      let targetUser = users?.find(
        (u: any) =>
          u.id === profile.id ||
          (profile.email && u.email?.toLowerCase() === profile.email.toLowerCase()) ||
          (profile.username && u.username?.toLowerCase() === profile.username.toLowerCase())
      );

      if (!targetUser && addUser) {
        targetUser = addUser({
          id: profile.id,
          username: profile.username || profile.email?.split('@')[0] || 'user',
          name: profile.name || 'Campus Administrator',
          email: profile.email || `${profile.username}@institution.edu.pk`,
          role: profile.role || (isSuper ? 'level_1_platform_super_admin' : 'level_2_client_super_admin'),
          status: 'active',
          clientId: profile.clientId || null,
          campusId: profile.campusId || null,
          permittedCampusIds: profile.permittedCampusIds || ['all'],
          allowedModules: profile.allowedModules || ['all'],
        });
      }

      const effectiveId = targetUser?.id || profile.id;
      if (loginAsUser) {
        loginAsUser(effectiveId, isSuper);
      }

      // 3. Record audit activity
      const userCamp = campuses.find((c) => c.id === profile.campusId) || campuses[0];
      recordCampusLoginActivity({
        campusId: profile.campusId || userCamp?.id || 'campus-khiali',
        campusName: userCamp?.name || (isSuper ? 'Platform Central Command' : 'Main Campus'),
        campusCode: userCamp?.code || 'HQ',
        clientId: profile.clientId || (isSuper ? undefined : 'client-aplus'),
        clientName: matchingClient?.name || (isSuper ? 'Platform Site Owner' : 'Aplus School System'),
        userName: profile.name || profile.username,
        userRole: profile.role || profile.permissionLevel,
        userEmail: profile.email || cleanInput,
        ipAddress: '127.0.0.1 (Firebase Auth Verified)',
        device: navigator.userAgent.slice(0, 45),
        status: 'success',
        method: 'portal_login',
        remarks: `Authenticated via Firebase Auth (${profile.permissionLevel})`,
      });
    } catch (err: any) {
      console.error('Sign-in failure:', err);
      setErrorMessage(
        err?.message ||
          'Sign-in failed. Please verify your email and password, or use "Initialize Platform Owner" for fresh setups.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOwnerSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerSetupStatus(null);

    if (!ownerEmail || !ownerEmail.includes('@')) {
      setOwnerSetupStatus('Please provide a valid owner email.');
      return;
    }
    if (ownerPassword.length < 8) {
      setOwnerSetupStatus('Password must be at least 8 characters.');
      return;
    }
    if (ownerPassword !== confirmOwnerPassword) {
      setOwnerSetupStatus('Passwords do not match.');
      return;
    }

    setIsSettingUpOwner(true);
    try {
      const profile = await provisionInitialPlatformOwner(ownerEmail, ownerPassword, ownerName);
      setSuccessNotice(`Platform Owner account initialized successfully for ${profile.email}!`);
      setIsOwnerSetupOpen(false);

      if (loginAsUser) {
        loginAsUser(profile.id, true);
      }
    } catch (err: any) {
      setOwnerSetupStatus(err.message || 'Owner initialization failed.');
    } finally {
      setIsSettingUpOwner(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {matchingClient?.logoUrl ? (
            <img
              src={matchingClient.logoUrl}
              alt={matchingClient.name}
              className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-800 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <School className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black text-white tracking-wide uppercase">
              {matchingClient?.name || orgSettings?.schoolName || 'Aplus School Accounting Network'}
            </h1>
            <p className="text-[11px] text-slate-400">
              Multi-Campus Accounting & Unified Double-Entry Imprest Ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOwnerSetupOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="Setup or bootstrap the Platform Site Owner account in Firebase Authentication"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Platform Owner Setup</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-2xl pointer-events-none" />

            <div className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Firebase Authentication Active
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Institutional Terminal Sign In
              </h2>
              <p className="text-xs text-slate-400">
                Sign in with your verified institutional account. All operations are synchronized to central persistent cloud datastores.
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">Access Verification Notice</div>
                  <div className="text-[11px] leading-relaxed text-rose-300">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Success Notice */}
            {successNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">{successNotice}</div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Institutional Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. director@aplus.edu.pk or username"
                    className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Password
                  </label>
                  {isCapsLockOn && (
                    <span className="text-[10px] text-amber-400 font-bold">
                      CAPS LOCK is ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter account password..."
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <span>{isAuthenticating ? 'Authenticating via Firebase...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Tenant Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center space-y-1 text-slate-500 text-xs">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Verified Multi-Tenant & Campus Hierarchy Enforcement</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Staff accounts are provisioned and managed centrally by each organization&apos;s administrator.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Controlled Owner Setup Modal */}
      {isOwnerSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Platform Owner Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOwnerSetupOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              This controlled setup procedure establishes or updates the Level 1 Platform Super Admin account in Firebase Authentication. No local-only fallback or hardcoded passwords are used.
            </p>

            {ownerSetupStatus && (
              <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-200 text-xs">
                {ownerSetupStatus}
              </div>
            )}

            <form onSubmit={handleOwnerSetupSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Owner Email</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Owner Full Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Master Password (min 8 characters)</label>
                <input
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  placeholder="At least 8 characters..."
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Confirm Master Password</label>
                <input
                  type="password"
                  value={confirmOwnerPassword}
                  onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  placeholder="Repeat password..."
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOwnerSetupOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettingUpOwner}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <span>{isSettingUpOwner ? 'Provisioning...' : 'Initialize Owner Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-[11px] text-slate-500">
        Enterprise Multi-Campus Financial Accounting & Imprest Cashbook Platform • {new Date().getFullYear()}
      </footer>
    </div>
  );
};
