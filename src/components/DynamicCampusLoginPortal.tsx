import React, { useRef, useState } from 'react';
import { Eye, EyeOff, School, ShieldCheck } from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { authenticateAccount } from '../services/secureAuthentication';
import { AccessibleDialog } from './AccessibleDialog';

export const DynamicCampusLoginPortal: React.FC<{ onSwitchToLegacy?: () => void }> = () => {
  const { orgSettings } = useAccounting();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHelp, setSetupHelp] = useState(false);
  const submitting = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (!username.trim() || !password.trim()) { setError('Enter your institutional account and password.'); return; }
    submitting.current = true;
    setBusy(true);
    try {
      // The application auth subscription installs only the verified membership.
      await authenticateAccount(username, password);
    } catch (failure: any) {
      setError(failure?.message || 'Unable to sign in. Please try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60';
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <header className="border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <School aria-hidden="true" className="w-9 h-9 shrink-0 text-purple-400" />
          <div>
            <h1 className="text-sm font-black uppercase">{orgSettings?.schoolName || 'Aplus School System'}</h1>
            <p className="text-xs text-slate-400">Multi-Campus Accounting & Unified Double-Entry Imprest Ledger</p>
          </div>
        </div>
        <button type="button" onClick={() => setSetupHelp(true)} className="rounded-xl border border-slate-600 px-3 py-2 text-sm">Account setup help</button>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <section aria-labelledby="login-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
          <p className="text-xs font-bold text-emerald-400 mb-3">INSTITUTIONAL WORKSPACE</p>
          <h2 id="login-title" className="text-xl font-bold">Institutional Terminal Sign In</h2>
          <p className="text-sm text-slate-400 mt-2 mb-6">Sign in with the account provisioned by your organization administrator.</p>
          {error && <div id="login-error" role="alert" className="mb-4 rounded-xl border border-rose-700 bg-rose-950 p-3 text-sm text-rose-200">{error}</div>}
          <form onSubmit={submit} aria-busy={busy} className="space-y-4">
            <div>
              <label htmlFor="login-account" className="block text-sm font-bold mb-2">Institutional Email or Username</label>
              <input id="login-account" name="username" value={username} disabled={busy} onChange={e => { setUsername(e.target.value); setError(null); }} autoComplete="username" required className={inputClass} aria-describedby={error ? 'login-error' : undefined} />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-bold mb-2">Password</label>
              <div className="relative">
                <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} value={password} disabled={busy} onChange={e => { setPassword(e.target.value); setError(null); }} autoComplete="current-password" required className={`${inputClass} pr-14`} aria-describedby={error ? 'login-error' : undefined} />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="login-password" className="absolute right-1 top-1 p-3 text-slate-300">
                  {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-sm disabled:opacity-50">{busy ? 'Verifying your account…' : 'Sign In to Workspace'}</button>
            <p role="status" className="text-sm text-slate-300">{busy ? 'Connecting securely. This may take up to 20 seconds.' : ''}</p>
          </form>
          <p className="mt-5 text-xs text-slate-400 flex items-start gap-2"><ShieldCheck aria-hidden="true" className="w-4 h-4 shrink-0" />Staff accounts and workspace access are managed by your organization administrator.</p>
        </section>
      </main>
      <footer className="border-t border-slate-800 p-4 text-center text-xs text-slate-400">Enterprise Multi-Campus Financial Accounting & Imprest Cashbook Platform • {new Date().getFullYear()}</footer>
      {setupHelp && <AccessibleDialog title="Account setup help" onClose={() => setSetupHelp(false)}>
        <p className="text-sm text-slate-300">Contact your organization administrator to create or restore your account. Platform owner accounts are provisioned through a trusted server process; this sign-in page cannot create or elevate accounts.</p>
      </AccessibleDialog>}
    </div>
  );
};
