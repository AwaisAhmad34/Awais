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
  } = useAccounting();

  const [credentials, setCredentials] = useState<CampusCredential[]>(() =>
    ensureCredentialsForAllCampuses(campuses, getLocalStoredCampusCredentials())
  );
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Authentication Simulator State
  const [simCampusId, setSimCampusId] = useState<string>(campuses[0]?.id || '');
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

  const handleTogglePassword = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1-Click Generate / Rotate Password for a single campus
  const handleRotateCampusPassword = async (campusId: string) => {
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
    if (authRes.success) {
      setSimResult({
        success: true,
        message: `Authentication Successful: Verified against Firestore collection 'campus_credentials' for ${authRes.campus?.name}. Token: ${authRes.credential?.dynamicToken?.slice(0, 16)}...`,
      });
    } else {
      setSimResult({
        success: false,
        message: authRes.message || 'Authentication failed against database records.',
      });
    }
  };

  // Print / Export Slip for distribution
  const handlePrintSlips = () => {
    const printContent = credentials
      .map(
        (c) => `
=========================================
APLUS SCHOOL SYSTEM — CAMPUS LOGIN SLIP
Branch: ${c.campusName} (${c.campusCode})
City: ${c.city || 'Gujranwala'}
Accountant: ${c.accountantName || 'Designated Accountant'}
-----------------------------------------
Campus Portal Username: ${c.username}
Dynamic Password:       ${c.password}
Role Scope:             ${c.role}
Database ID:            ${firebaseConfig.firestoreDatabaseId}
Dynamic Token:          ${c.dynamicToken}
Status:                 ${c.status.toUpperCase()}
Generated:              ${new Date(c.generatedAt).toLocaleDateString()}
=========================================
`
      )
      .join('\n\n');

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(
        `<pre style="font-family: monospace; padding: 20px; font-size: 13px;">${printContent}</pre>`
      );
      win.document.close();
      win.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
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
                Dynamic Campus Authentication & Credentials Sync
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

        {/* Action Controls Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Managing dynamic credentials for <strong>{credentials.length}</strong> school campus branches.
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Credentials Table */}
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
                {credentials.map((cred) => {
                  const isVisible = showPasswords[cred.id] || false;
                  return (
                    <tr key={cred.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{cred.campusName}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {cred.campusCode} · {cred.city || 'Gujranwala'}
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                            {isVisible ? cred.password : '••••••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePassword(cred.id)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                            title={isVisible ? 'Hide password' : 'Show password'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyText(cred.password, `pass-${cred.id}`)}
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

                          {loginAsCampus && (
                            <button
                              type="button"
                              onClick={() => {
                                loginAsCampus(cred.campusId);
                                onClose();
                                if (onSelectCampusLogin) onSelectCampusLogin(cred.campusId);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              Login As
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Interactive Database Authentication Simulator */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Live Cloud Database Authentication Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Test dynamic campus authentication against the live Firestore database (collection:{' '}
              <code className="text-indigo-600 font-bold">campus_credentials</code>).
            </p>

            <form onSubmit={handleRunAuthSimulator} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Select Campus
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
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
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
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isSimulating ? 'Verifying with Firestore...' : 'Test DB Auth'}</span>
              </button>
            </form>

            {simResult && (
              <div
                className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                  simResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border border-rose-200 text-rose-900'
                }`}
              >
                {simResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{simResult.message}</span>
              </div>
            )}
          </div>
        </div>

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
    </div>
  );
};
