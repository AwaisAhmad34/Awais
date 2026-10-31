import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  School,
  KeyRound,
  HelpCircle,
  X,
  Mail,
  Send,
  LifeBuoy,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { getStoredSchoolClients } from '../services/platformSiteAdminService';
import { recordCampusLoginActivity } from '../services/campusLoginActivityService';
import {
  authenticateAccount,
  provisionInitialPlatformOwner,
  getVerifiedProfile,
  checkPlatformOwnerStatus,
  sendAccountPasswordRecovery,
} from '../services/secureAuthentication';

interface DynamicCampusLoginPortalProps {
  onSwitchToLegacy?: () => void;
}

export const DynamicCampusLoginPortal: React.FC<DynamicCampusLoginPortalProps> = () => {
  const { loginAsUser, campuses, orgSettings, users, addUser } = useAccounting();

  // Form states
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
  const [isOwnerAlreadyRegistered, setIsOwnerAlreadyRegistered] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('siteowner@platform.org');
  const [ownerName, setOwnerName] = useState('Platform Super Admin (Site Owner)');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [ownerSetupStatus, setOwnerSetupStatus] = useState<string | null>(null);
  const [isSettingUpOwner, setIsSettingUpOwner] = useState(false);

  // Administrator Support Modal
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  // Password Recovery Modal
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  // Accessibility Refs
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const ownerDialogRef = useRef<HTMLDivElement>(null);
  const ownerFirstInputRef = useRef<HTMLInputElement>(null);
  const recoveryFirstInputRef = useRef<HTMLInputElement>(null);

  // Listen for client updates
  useEffect(() => {
    const fn = () => setClientsVersion((v) => v + 1);
    window.addEventListener('aplus-clients-updated', fn);
    return () => window.removeEventListener('aplus-clients-updated', fn);
  }, []);

  // Check platform owner status from backend trusted endpoint on mount
  useEffect(() => {
    checkPlatformOwnerStatus()
      .then((status) => {
        setIsOwnerAlreadyRegistered(Boolean(status?.initialized));
      })
      .catch((err) => {
        console.warn('Could not query platform owner status:', err);
      });
  }, []);

  // Owner setup dialog focus management, accessibility trap & Escape dismissal
  useEffect(() => {
    if (isOwnerSetupOpen) {
      const timer = setTimeout(() => {
        ownerFirstInputRef.current?.focus();
      }, 50);

      const handleDialogKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isSettingUpOwner) {
          setIsOwnerSetupOpen(false);
          triggerButtonRef.current?.focus();
        }
        if (e.key === 'Tab' && ownerDialogRef.current) {
          const focusable = ownerDialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleDialogKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleDialogKeyDown);
      };
    }
  }, [isOwnerSetupOpen, isSettingUpOwner]);

  const storedClients = useMemo(() => {
    return getStoredSchoolClients();
  }, [clientsVersion]);

  const matchingClient = useMemo(() => {
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

  // Task 7: Clear stale authentication errors on input change
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (errorMessage) setErrorMessage(null);
    if (successNotice) setSuccessNotice(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
    if (successNotice) setSuccessNotice(null);
  };

  // Task 2: Correct invalid-login messaging (Generic message for nonexistent or wrong passwords)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanInput = username.trim();
    const cleanPass = password;

    if (!cleanInput) {
      setErrorMessage('Unable to sign in. Check your email/username and password.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Unable to sign in. Check your email/username and password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      // 1. Authenticate via Firebase Authentication and load verified server-side membership
      const profile = await authenticateAccount(cleanInput, cleanPass);

      setSuccessNotice('Authentication verified. Opening dashboard workspace...');

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
      console.warn('Sign-in failure (diagnostic):', err?.message);
      // Strictly generic public message prevents account enumeration and avoids recommending setup
      setErrorMessage('Unable to sign in. Check your email/username and password.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Task 1: Secure platform-owner initialization
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
      const profile = await provisionInitialPlatformOwner(
        ownerEmail,
        ownerPassword,
        ownerName,
        bootstrapSecret || undefined
      );
      setSuccessNotice(`Platform Owner account initialized successfully for ${profile.email}!`);
      setIsOwnerAlreadyRegistered(true);
      setIsOwnerSetupOpen(false);
      triggerButtonRef.current?.focus();

      if (loginAsUser) {
        loginAsUser(profile.id, true);
      }
    } catch (err: any) {
      setOwnerSetupStatus(err.message || 'Owner initialization failed.');
    } finally {
      setIsSettingUpOwner(false);
    }
  };

  // Task 9: Self-service verified password recovery
  const handlePasswordRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);
    if (!recoveryEmail || !recoveryEmail.includes('@')) {
      setRecoveryStatus('Please provide a valid email address.');
      return;
    }

    setIsSendingRecovery(true);
    try {
      const res = await sendAccountPasswordRecovery(recoveryEmail.trim());
      setRecoveryStatus(res);
      setTimeout(() => {
        setIsRecoveryModalOpen(false);
        setSuccessNotice('If that email is registered, recovery instructions have been dispatched.');
      }, 3000);
    } catch (err: any) {
      setRecoveryStatus(err?.message || 'Could not send recovery link. Contact institutional admin.');
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {matchingClient?.logoUrl ? (
            <img
              src={matchingClient.logoUrl}
              alt={matchingClient.name}
              className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-800 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <School className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate">
              {matchingClient?.name || orgSettings?.schoolName || 'Aplus School Accounting Network'}
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
              Multi-Campus Accounting & Unified Double-Entry Imprest Ledger
            </p>
          </div>
        </div>

        {/* Task 6 & 9: Mobile header button with min 44px touch target without excessive wrapping */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            ref={triggerButtonRef}
            type="button"
            onClick={() => {
              setIsOwnerSetupOpen(true);
              setOwnerSetupStatus(null);
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            title="Setup or bootstrap the Platform Site Owner account"
          >
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Platform Owner Setup</span>
            <span className="sm:hidden">Owner Setup</span>
          </button>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-2xl pointer-events-none" />

            {/* Task 9: Clean user-facing status */}
            <div className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Cloud Synchronization Active · Secure Connection
                </span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Institutional Terminal Sign In
              </h2>
              <p className="text-xs text-slate-400">
                Sign in with your verified institutional account to access multi-campus vouchers, general ledgers, and financial reports.
              </p>
            </div>

            {/* Task 5: Live Region for Authentication Errors */}
            {errorMessage && (
              <div
                id="login-error-alert"
                role="alert"
                aria-live="assertive"
                className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Sign-in Notice</div>
                  <div className="text-[11px] leading-relaxed text-rose-300">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Success Notice */}
            {successNotice && (
              <div
                role="status"
                aria-live="polite"
                className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">{successNotice}</div>
              </div>
            )}

            {/* Task 3: Accessible Form with connected htmlFor labels, aria-invalid and aria-describedby */}
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate={false}>
              <div>
                <label
                  htmlFor="login-username"
                  className="text-xs font-bold text-slate-300 block mb-1.5"
                >
                  Institutional Email or Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="e.g. director@aplus.edu.pk or username"
                    className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3 py-3 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                    autoComplete="username"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={errorMessage ? 'login-error-alert' : undefined}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="text-xs font-bold text-slate-300"
                  >
                    Password
                  </label>
                  {isCapsLockOn && (
                    <span className="text-[10px] text-amber-400 font-bold" role="status">
                      CAPS LOCK is ON
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter account password..."
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-12 py-3 text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errorMessage)}
                    aria-describedby={errorMessage ? 'login-error-alert' : undefined}
                  />
                  {/* Task 6: Touch target >= 44x44 CSS pixels */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1 bottom-1 w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Task 9: Password Recovery Link */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(username.includes('@') ? username : '');
                    setRecoveryStatus(null);
                    setIsRecoveryModalOpen(true);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer py-1"
                >
                  Forgot password?
                </button>

                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(true)}
                  className="text-slate-400 hover:text-slate-200 underline cursor-pointer py-1"
                >
                  Need administrator support?
                </button>
              </div>

              {/* Task 6: Primary Submit Button with min 44px height */}
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full min-h-[44px] py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
              >
                <span>{isAuthenticating ? 'Authenticating account...' : 'Sign In to Workspace'}</span>
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

      {/* Task 4: Accessible Owner Setup Dialog with dialog role, aria-modal, focus trap, Escape dismissal, close button name */}
      {isOwnerSetupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          role="presentation"
        >
          <div
            ref={ownerDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="owner-setup-heading"
            aria-describedby="owner-setup-description"
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 id="owner-setup-heading" className="text-base font-bold text-white">
                  Platform Owner Setup
                </h3>
              </div>
              {/* Task 6: 44x44 Close button with accessible name */}
              <button
                type="button"
                onClick={() => {
                  if (!isSettingUpOwner) {
                    setIsOwnerSetupOpen(false);
                    triggerButtonRef.current?.focus();
                  }
                }}
                disabled={isSettingUpOwner}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                aria-label="Close owner setup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p id="owner-setup-description" className="text-xs text-slate-400">
              {isOwnerAlreadyRegistered
                ? 'A Platform Owner is already registered. To update credentials, sign in as the Platform Owner or provide the authorized bootstrap installation secret.'
                : 'This privileged setup procedure bootstraps the Level 1 Platform Super Admin account in Firebase Authentication. Backend transactional verification ensures initialization can only occur once.'}
            </p>

            {ownerSetupStatus && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-200 text-xs"
              >
                {ownerSetupStatus}
              </div>
            )}

            <form onSubmit={handleOwnerSetupSubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="owner-email" className="font-bold text-slate-300 block mb-1">
                  Owner Email
                </label>
                <input
                  ref={ownerFirstInputRef}
                  id="owner-email"
                  name="ownerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label htmlFor="owner-name" className="font-bold text-slate-300 block mb-1">
                  Owner Full Name
                </label>
                <input
                  id="owner-name"
                  name="ownerName"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                  autoComplete="name"
                  required
                />
              </div>

              {/* Task 1: Optional Installation / Bootstrap Secret field */}
              <div>
                <label htmlFor="owner-secret" className="font-bold text-slate-300 block mb-1">
                  Installation / Bootstrap Secret {isOwnerAlreadyRegistered && <span className="text-amber-400">(Required for existing setup)</span>}
                </label>
                <input
                  id="owner-secret"
                  name="bootstrapSecret"
                  type="password"
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                  placeholder="Optional for fresh setup, or server installation key"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                  autoComplete="off"
                />
              </div>

              <div>
                <label htmlFor="owner-password" className="font-bold text-slate-300 block mb-1">
                  Master Password (min 8 characters)
                </label>
                <input
                  id="owner-password"
                  name="ownerPassword"
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                  placeholder="At least 8 characters..."
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label htmlFor="owner-confirm-password" className="font-bold text-slate-300 block mb-1">
                  Confirm Master Password
                </label>
                <input
                  id="owner-confirm-password"
                  name="confirmOwnerPassword"
                  type="password"
                  value={confirmOwnerPassword}
                  onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                  placeholder="Repeat password..."
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSettingUpOwner}
                  onClick={() => {
                    setIsOwnerSetupOpen(false);
                    triggerButtonRef.current?.focus();
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-slate-300 hover:text-white font-bold cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettingUpOwner}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                >
                  <span>{isSettingUpOwner ? 'Provisioning...' : 'Initialize Owner Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task 9: Administrator Support Modal */}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-heading"
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-indigo-400" />
                <h3 id="support-dialog-heading" className="text-base font-bold text-white">
                  Institutional Administrator Support
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
                aria-label="Close support dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              For campus staff credential assignments, password resets, or role upgrades, please contact your institution&apos;s centralized administration desk:
            </p>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div>
                <span className="text-slate-500">Institution:</span>{' '}
                <span className="text-white font-bold">{orgSettings?.schoolName || 'A+ School System Central Command'}</span>
              </div>
              <div>
                <span className="text-slate-500">System Support Email:</span>{' '}
                <span className="text-indigo-400 font-bold">support@institution.edu.pk</span>
              </div>
              <div>
                <span className="text-slate-500">IT Helpdesk:</span>{' '}
                <span className="text-slate-300">+92 (42) 111-APLUS-1</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
              >
                Close Support
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task 9: Self-Service Password Recovery Modal */}
      {isRecoveryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-dialog-heading"
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 id="recovery-dialog-heading" className="text-base font-bold text-white">
                  Account Password Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRecoveryModalOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg cursor-pointer"
                aria-label="Close recovery dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Enter your verified institutional email. A secure password reset link will be dispatched through Firebase Authentication.
            </p>

            {recoveryStatus && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-200 text-xs"
              >
                {recoveryStatus}
              </div>
            )}

            <form onSubmit={handlePasswordRecoverySubmit} className="space-y-3 text-xs">
              <div>
                <label htmlFor="recovery-email" className="font-bold text-slate-300 block mb-1">
                  Institutional Email Address
                </label>
                <input
                  ref={recoveryFirstInputRef}
                  id="recovery-email"
                  name="recoveryEmail"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="e.g. director@aplus.edu.pk"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecoveryModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingRecovery}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingRecovery ? 'Dispatching...' : 'Send Recovery Link'}</span>
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
