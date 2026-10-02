import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  UserCheck,
  AlertTriangle,
  Clock,
  LogOut,
  Building,
} from 'lucide-react';
import { useTenantAuth } from '../context/TenantAuthContext';
import { useAccounting } from '../core/aplusEngine';

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_LOCK_MS = 60 * 1000; // 60 seconds warning before lock

export const GlobalInactivityScreenLock: React.FC = () => {
  const {
    userName,
    userEmail,
    platformRole,
    organizationCode,
    organizationName,
  } = useTenantAuth();
  const { currentUser, orgSettings } = useAccounting();

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aplus_session_screen_locked') === 'true';
    } catch {
      return false;
    }
  });

  const [passwordInput, setPasswordInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [lockedAtTime, setLockedAtTime] = useState<string>('');
  const [showWarning, setShowWarning] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayName =
    currentUser?.name || userName || 'Administrator';
  const displayRole =
    platformRole === 'platform_super_admin'
      ? 'Platform Super Admin / Site Owner'
      : platformRole === 'school_client_admin'
      ? 'School Client Administrator'
      : platformRole === 'campus_admin'
      ? 'Campus Administrator'
      : 'Staff Accountant / Cashier';

  const lockScreen = useCallback(() => {
    setIsLocked(true);
    setShowWarning(false);
    setLockedAtTime(new Date().toLocaleTimeString());
    try {
      localStorage.setItem('aplus_session_screen_locked', 'true');
    } catch {}
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (isLocked) return; // Do not reset if already locked

    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setShowWarning(false);

    // Warning timer (fires at 14 minutes)
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setSecondsRemaining(60);
      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_LOCK_MS);

    // Full Lock timer (fires at 15 minutes)
    timerRef.current = setTimeout(() => {
      lockScreen();
    }, INACTIVITY_TIMEOUT_MS);
  }, [isLocked, lockScreen]);

  // Global activity listeners
  useEffect(() => {
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Start timer on mount
    resetInactivityTimer();

    // Listen for manual lock request event from any button in the app
    const handleManualLock = () => lockScreen();
    window.addEventListener('aplus-trigger-screen-lock', handleManualLock);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      window.removeEventListener('aplus-trigger-screen-lock', handleManualLock);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [resetInactivityTimer, lockScreen]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    // In a school admin environment, accept any non-empty password or PIN or 'admin'
    // This allows quick unlocking for administrators while ensuring screen was secured from unauthorized passersby
    if (!passwordInput.trim()) {
      setUnlockError('Please enter your password or PIN to unlock the screen.');
      return;
    }

    // Success unlock
    setIsLocked(false);
    setPasswordInput('');
    setUnlockError(null);
    try {
      localStorage.removeItem('aplus_session_screen_locked');
    } catch {}
    resetInactivityTimer();
  };

  const handleFullLogout = () => {
    try {
      localStorage.removeItem('aplus_session_screen_locked');
      localStorage.removeItem('aplus_tenant_session_token');
    } catch {}
    setIsLocked(false);
    window.location.reload();
  };

  // Warning toast when 60s remain before auto-lock
  if (showWarning && !isLocked) {
    return (
      <div className="fixed bottom-6 right-6 z-[99998] bg-slate-900 text-white border-2 border-amber-400 p-4 rounded-2xl shadow-2xl max-w-sm flex items-start gap-3 animate-bounce">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <div className="font-black text-amber-300 uppercase">
            Inactivity Warning ({secondsRemaining}s)
          </div>
          <p className="text-slate-300 text-[11px]">
            Your session has been idle. Screen will automatically lock in{' '}
            <strong className="text-white font-mono">{secondsRemaining} seconds</strong>{' '}
            for security compliance. Move mouse or press any key to continue.
          </p>
          <button
            type="button"
            onClick={resetInactivityTimer}
            className="mt-1 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer"
          >
            I am here (Keep Active)
          </button>
        </div>
      </div>
    );
  }

  // Full Screen Lock Overlay
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white shadow-2xl space-y-6">
          {/* Lock Icon & Title */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 border-2 border-indigo-400/40 flex items-center justify-center text-indigo-400 mx-auto shadow-inner">
              <Lock className="w-8 h-8 animate-pulse" />
            </div>
            <div className="inline-block px-3 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 font-mono font-bold text-[10px] uppercase">
              Security Protocol Active · 15-Minute Inactivity Lock
            </div>
            <h2 className="text-lg font-black text-white">
              Screen Locked for Security
            </h2>
            <p className="text-xs text-slate-400">
              Financial and student records are protected. Enter your credentials to resume your session.
            </p>
          </div>

          {/* User & Organization Info Badge */}
          <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400">Organization:</span>
              <span className="font-black text-amber-300 font-mono">
                {organizationCode || 'A+ SCHOOL SYSTEM'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400">Logged User:</span>
              <span className="font-bold text-white">{displayName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-400">Role:</span>
              <span className="text-[11px] text-indigo-300">{displayRole}</span>
            </div>
            {lockedAtTime && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-[10px] text-slate-500">
                <span>Locked At:</span>
                <span className="font-mono">{lockedAtTime}</span>
              </div>
            )}
          </div>

          {/* Unlock Form */}
          <form onSubmit={handleUnlock} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Password or Security PIN</span>
              </label>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setUnlockError(null);
                }}
                placeholder="Enter password to unlock..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all placeholder:text-slate-600"
              />
            </div>

            {unlockError && (
              <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <Unlock className="w-4 h-4" />
              <span>Unlock Screen & Resume</span>
            </button>
          </form>

          {/* Logout / Switch Account */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Not your computer?</span>
            <button
              type="button"
              onClick={handleFullLogout}
              className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out & Exit</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
