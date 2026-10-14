import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  CloudUpload,
  Check,
  FileCheck2,
  Banknote,
  Sparkles,
  Info,
  Scale,
  Users,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ApprovalMatrixConfig,
  RoleApprovalThreshold,
  CampusHierarchyTier,
  VoucherTypeCode,
  getStoredApprovalMatrixConfig,
  saveStoredApprovalMatrixConfig,
  syncApprovalMatrixToCloud,
  subscribeApprovalMatrixConfig,
  evaluateVoucherApprovalAuthorization,
  DEFAULT_APPROVAL_MATRIX,
} from '../services/approvalMatrixService';

interface ConfigurableApprovalMatrixModuleProps {
  onClose?: () => void;
  compact?: boolean;
}

export const ConfigurableApprovalMatrixModule: React.FC<ConfigurableApprovalMatrixModuleProps> = ({
  onClose,
  compact = false,
}) => {
  const [matrix, setMatrix] = useState<ApprovalMatrixConfig>(getStoredApprovalMatrixConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Live Simulator state
  const [testAmount, setTestAmount] = useState<number>(65000);
  const [testVoucherType, setTestVoucherType] = useState<VoucherTypeCode>('CPV');
  const [testRole, setTestRole] = useState<string>('Sub-Campus Principal');
  const [testHierarchyTier, setTestHierarchyTier] = useState<CampusHierarchyTier>('level_4_sub_campus');
  const [testIsCreator, setTestIsCreator] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeApprovalMatrixConfig((cfg) => {
      setMatrix(cfg);
    });
    return unsub;
  }, []);

  const triggerToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleUpdatePolicy = <K extends keyof ApprovalMatrixConfig>(
    key: K,
    value: ApprovalMatrixConfig[K]
  ) => {
    const updated = {
      ...matrix,
      [key]: value,
      updatedAt: new Date().toISOString(),
    };
    setMatrix(updated);
    saveStoredApprovalMatrixConfig(updated);
  };

  const handleUpdateTierLimit = (tier: CampusHierarchyTier, amount: number) => {
    const updatedLimits = {
      ...matrix.hierarchyTierLimits,
      [tier]: Math.max(0, amount),
    };
    handleUpdatePolicy('hierarchyTierLimits', updatedLimits);
  };

  const handleUpdateRoleLimit = (roleId: string, updates: Partial<RoleApprovalThreshold>) => {
    const updatedRoles = matrix.roleThresholds.map((r) =>
      r.roleId === roleId ? { ...r, ...updates } : r
    );
    handleUpdatePolicy('roleThresholds', updatedRoles);
  };

  const handleToggleVoucherTypeForRole = (roleId: string, type: VoucherTypeCode) => {
    const updatedRoles = matrix.roleThresholds.map((r) => {
      if (r.roleId !== roleId) return r;
      const exists = r.allowedVoucherTypes.includes(type);
      const newTypes = exists
        ? r.allowedVoucherTypes.filter((t) => t !== type)
        : [...r.allowedVoucherTypes, type];
      return { ...r, allowedVoucherTypes: newTypes };
    });
    handleUpdatePolicy('roleThresholds', updatedRoles);
  };

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    const success = await syncApprovalMatrixToCloud(matrix);
    setIsSaving(false);
    if (success) {
      triggerToast('success', 'Approval Matrix Policy securely synced to Cloud Firestore!');
    } else {
      triggerToast('error', 'Saved locally. Cloud Firestore sync will retry on network availability.');
    }
  };

  const handleResetDefaults = () => {
    setMatrix(DEFAULT_APPROVAL_MATRIX);
    saveStoredApprovalMatrixConfig(DEFAULT_APPROVAL_MATRIX);
    triggerToast('success', 'Restored standard institutional approval matrix policies.');
  };

  // Evaluation simulation result
  const simulationResult = evaluateVoucherApprovalAuthorization({
    amount: Number(testAmount) || 0,
    voucherType: testVoucherType,
    userRole: testRole,
    permissionLevel: testHierarchyTier,
    isSuperAdmin: testHierarchyTier === 'level_1_platform_admin',
    voucherCreator: testIsCreator ? 'current_user' : 'other_staff',
    currentUserUsername: 'current_user',
    isMainCampus: testHierarchyTier === 'level_3_main_campus',
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold bg-indigo-900/80 text-indigo-300 px-2 py-0.5 rounded border border-indigo-700">
                Level 1 to 5 Delegation Matrix
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Updated: {new Date(matrix.updatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h3 className="text-base font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
              <span>Configurable Voucher Approval & Authorization Matrix</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
            title="Restore default standard limits"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Syncing...' : 'Save & Sync Policy'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 text-slate-400 hover:text-white text-xs font-bold"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div
          className={`p-3 text-xs font-bold flex items-center gap-2 ${
            toastMsg.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-200 border-b border-emerald-800'
              : 'bg-rose-950/80 text-rose-200 border-b border-rose-800'
          }`}
        >
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      <div className="p-5 sm:p-6 space-y-6">
        {/* Global Policy Settings Switches */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Core Institutional Authorization Controls</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Dual Approval Threshold */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">Dual Approval Threshold (PKR)</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-mono">Rs.</span>
                <input
                  type="number"
                  value={matrix.dualApprovalThreshold}
                  onChange={(e) => handleUpdatePolicy('dualApprovalThreshold', Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Vouchers above this require countersignature by Principal or Director.
              </span>
            </div>

            {/* Segregation of Duties */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-medium">Segregation of Duties</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matrix.preventSelfApproval}
                  onChange={(e) => handleUpdatePolicy('preventSelfApproval', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-white font-bold">Prevent Self-Approval</span>
              </label>
              <span className="text-[10px] text-slate-500 block">
                Disallow voucher creators from approving their own financial entries.
              </span>
            </div>

            {/* Bulk Batch Limit */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="text-slate-400 block font-medium">Max Bulk Approve Limit (PKR)</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-mono">Rs.</span>
                <input
                  type="number"
                  value={matrix.allowBulkApprovalLimit}
                  onChange={(e) => handleUpdatePolicy('allowBulkApprovalLimit', Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>
              <span className="text-[10px] text-slate-500 block">
                Ceiling limit for simultaneous 1-click batch approvals.
              </span>
            </div>

            {/* Strict Limit Enforcement */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-slate-400 block font-medium">Policy Enforcement</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matrix.enforceStrictLimits}
                  onChange={(e) => handleUpdatePolicy('enforceStrictLimits', e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-white font-bold">Strict Backend Lock</span>
              </label>
              <span className="text-[10px] text-slate-500 block">
                Hard block approval if threshold is exceeded instead of warning.
              </span>
            </div>
          </div>
        </div>

        {/* Hierarchy Tier Maximum Ceilings */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Campus Hierarchy Maximum Authorization Ceilings</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            {/* Level 1 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-emerald-800/60">
              <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase block">
                Level 1: Platform Creator
              </span>
              <span className="text-white font-bold block mt-1">Unlimited / Master</span>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">Rs. 100,000,000+</span>
            </div>

            {/* Level 2 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-mono text-[10px] font-bold text-sky-400 uppercase block">
                Level 2: School Network
              </span>
              <input
                type="number"
                value={matrix.hierarchyTierLimits.level_2_client_admin}
                onChange={(e) => handleUpdateTierLimit('level_2_client_admin', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs mt-1 outline-none"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Client network ceiling</span>
            </div>

            {/* Level 3 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-mono text-[10px] font-bold text-indigo-400 uppercase block">
                Level 3: Main Campus
              </span>
              <input
                type="number"
                value={matrix.hierarchyTierLimits.level_3_main_campus}
                onChange={(e) => handleUpdateTierLimit('level_3_main_campus', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs mt-1 outline-none"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Controls child branches</span>
            </div>

            {/* Level 4 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-mono text-[10px] font-bold text-purple-400 uppercase block">
                Level 4: Sub-Campus
              </span>
              <input
                type="number"
                value={matrix.hierarchyTierLimits.level_4_sub_campus}
                onChange={(e) => handleUpdateTierLimit('level_4_sub_campus', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs mt-1 outline-none"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Single branch branch limit</span>
            </div>

            {/* Level 5 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-mono text-[10px] font-bold text-amber-400 uppercase block">
                Level 5: Departmental
              </span>
              <input
                type="number"
                value={matrix.hierarchyTierLimits.level_5_departmental}
                onChange={(e) => handleUpdateTierLimit('level_5_departmental', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs mt-1 outline-none"
              />
              <span className="text-[10px] text-slate-500 block mt-1">Cashier & Accountant</span>
            </div>
          </div>
        </div>

        {/* Detailed Role Threshold Table */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Varying Role Authorization Thresholds</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {matrix.roleThresholds.length} Configured Institutional Profiles
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] font-bold border-b border-slate-800">
                  <th className="py-2.5 px-4">Role Title & Authority</th>
                  <th className="py-2.5 px-4">Hierarchy Tier</th>
                  <th className="py-2.5 px-4">Single Voucher Limit</th>
                  <th className="py-2.5 px-4">Petty Cash Limit</th>
                  <th className="py-2.5 px-4">Permitted Voucher Codes</th>
                  <th className="py-2.5 px-4 text-center">Dual Exemption</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {matrix.roleThresholds.map((role) => (
                  <tr key={role.roleId} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-xs">{role.roleName}</div>
                      <div className="text-[10px] text-slate-400">{role.notes}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {role.hierarchyTier.replace('level_', 'L').replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-[11px]">Rs.</span>
                        <input
                          type="number"
                          value={role.maxVoucherAmount}
                          onChange={(e) =>
                            handleUpdateRoleLimit(role.roleId, {
                              maxVoucherAmount: Number(e.target.value),
                            })
                          }
                          className="w-28 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-mono font-bold text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-mono text-[11px]">Rs.</span>
                        <input
                          type="number"
                          value={role.maxPettyCashPerVoucher}
                          onChange={(e) =>
                            handleUpdateRoleLimit(role.roleId, {
                              maxPettyCashPerVoucher: Number(e.target.value),
                            })
                          }
                          className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-mono text-xs outline-none focus:border-indigo-500"
                        />
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {(['CPV', 'CRV', 'BPV', 'BRV', 'JV'] as VoucherTypeCode[]).map((type) => {
                          const isAllowed = role.allowedVoucherTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleToggleVoucherTypeForRole(role.roleId, type)}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold cursor-pointer transition-colors ${
                                isAllowed
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-400'
                              }`}
                              title={`Toggle permission for ${type}`}
                            >
                              {type}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={role.canAuthorizeWithoutDualApproval}
                        onChange={(e) =>
                          handleUpdateRoleLimit(role.roleId, {
                            canAuthorizeWithoutDualApproval: e.target.checked,
                          })
                        }
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                        title="Allow single sign-off without requiring countersignature"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Voucher Authorization Simulator & Verifier */}
        <div className="bg-slate-950/80 border border-indigo-900/60 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Live Voucher Authorization Simulator</span>
            </h4>
            <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
              Real-time Policy Evaluation Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs mb-4">
            <div>
              <label className="block text-slate-400 mb-1 font-bold">Voucher Amount (PKR)</label>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(Number(e.target.value))}
                placeholder="65000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-bold">Voucher Type</label>
              <select
                value={testVoucherType}
                onChange={(e: any) => setTestVoucherType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
              >
                <option value="CPV">CPV — Cash Payment Voucher</option>
                <option value="CRV">CRV — Cash Receipt Voucher</option>
                <option value="BPV">BPV — Bank Payment Voucher</option>
                <option value="BRV">BRV — Bank Receipt Voucher</option>
                <option value="JV">JV — Journal Voucher</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-bold">Approver Role</label>
              <select
                value={testRole}
                onChange={(e) => setTestRole(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
              >
                {matrix.roleThresholds.map((r) => (
                  <option key={r.roleId} value={r.roleName}>
                    {r.roleName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-bold">Hierarchy Tier</label>
              <select
                value={testHierarchyTier}
                onChange={(e: any) => setTestHierarchyTier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none cursor-pointer"
              >
                <option value="level_1_platform_admin">Level 1: Platform Super Admin</option>
                <option value="level_2_client_admin">Level 2: School Client Admin</option>
                <option value="level_3_main_campus">Level 3: Main Campus Admin</option>
                <option value="level_4_sub_campus">Level 4: Sub-Campus Admin</option>
                <option value="level_5_departmental">Level 5: Departmental Staff</option>
              </select>
            </div>
          </div>

          {/* Verdict Card */}
          <div
            className={`p-4 rounded-xl border text-xs flex items-start gap-3 transition-all ${
              simulationResult.isAuthorized
                ? simulationResult.requiresDualApproval
                  ? 'bg-amber-950/40 border-amber-600/60 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-600/60 text-emerald-200'
                : 'bg-rose-950/40 border-rose-600/60 text-rose-200'
            }`}
          >
            {simulationResult.isAuthorized ? (
              simulationResult.requiresDualApproval ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}

            <div className="space-y-1 flex-1">
              <div className="font-extrabold text-white text-sm flex items-center justify-between">
                <span>
                  {simulationResult.isAuthorized
                    ? simulationResult.requiresDualApproval
                      ? 'Approval Permitted with Dual Countersignature'
                      : 'Single-Signer Approval Authorized'
                    : 'Authorization Exceeded — Escalation Required'}
                </span>
                <span className="font-mono text-xs">
                  Limit: Rs. {simulationResult.maxAuthorizedAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-slate-300">{simulationResult.reason}</p>
              {simulationResult.requiresEscalation && (
                <div className="pt-1.5 flex items-center gap-1.5 text-rose-300 font-bold">
                  <span>↳ Automatic Workflow Routing:</span>
                  <span className="bg-rose-950 px-2 py-0.5 rounded border border-rose-800 text-white font-mono">
                    {simulationResult.escalationTarget}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
