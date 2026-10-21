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
  Database,
  Layers,
  KeyRound,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { SEED_MULTI_TENANT_USERS, SEED_MULTI_TENANT_CAMPUSES, SEED_CLIENTS } from '../services/multiTenantDataService';
import { recordCampusLoginActivity } from '../services/campusLoginActivityService';
import firebaseConfig from '../../firebase-applet-config.json';

interface DynamicCampusLoginPortalProps {
  onSwitchToLegacy?: () => void;
}

export const DynamicCampusLoginPortal: React.FC<DynamicCampusLoginPortalProps> = () => {
  const {
    users,
    addUser,
    updateUser,
    login,
    loginAsCampus,
    campuses,
    orgSettings,
  } = useAccounting();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password;

    if (!cleanUser) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsAuthenticating(true);

    try {
      const result = await login(cleanUser, cleanPass);
      if (!result.success) setErrorMessage(result.message || 'Sign-in failed.');
    } catch {
      setErrorMessage('Unable to sign in. Check your connection and try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between selection:bg-indigo-600 selection:text-white">
      {/* Top Subtle Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
              <span>{orgSettings?.schoolName || 'Multi-Tenant Enterprise ERP'}</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                v4.5-MultiClient
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Autonomous Client Isolation & Multi-Campus Access System
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>DB: {firebaseConfig.firestoreDatabaseId}</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Section */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Card Wrapper */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            {/* Subtle Gradient Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2 mb-6">
              <span className="text-[11px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Unified Security Gateway</span>
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Sign in to your Workspace
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enter your credentials. The platform will automatically identify your organization, campus, and clearance level.
              </p>
            </div>

            {/* Error & Success Banners */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successNotice && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successNotice}</span>
              </div>
            )}

            {/* Unified Login Form - ONLY Username & Password! */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username or email..."
                    className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
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
                    placeholder="Enter your secure password..."
                    className="w-full text-xs font-mono bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
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
                <span>{isAuthenticating ? 'Authenticating Gateway...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>


          </div>

          {/* Privacy & Multi-Tenant Isolation Guarantee Badge */}
          <div className="text-center space-y-1 text-slate-500 text-xs">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>School Financial Workspace</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Use your approved account email to sign in.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3 text-center text-[11px] text-slate-500">
        Enterprise Multi-Campus Financial Accounting & Imprest Cashbook Platform • {new Date().getFullYear()}
      </footer>
    </div>
  );
};
