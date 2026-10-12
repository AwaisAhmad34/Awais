import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Users,
  KeyRound,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Plus,
  RefreshCw,
  Lock,
  Unlock,
  Eye,
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck,
  UserX,
  Clock,
  Fingerprint,
  Check,
  AlertCircle,
  HelpCircle,
  Scale,
} from 'lucide-react';
import { useAccounting, Campus, AccountHead } from '../core/aplusEngine';
import {
  PermissionLevel,
  DepartmentalStaffRole,
  PermissionActionMatrix,
  SystemFeatureKey,
  HierarchicalRbacMasterConfig,
  UserRoleAssignment,
  getStoredHierarchicalRbacConfig,
  saveStoredHierarchicalRbacConfig,
  syncHierarchicalRbacToCloud,
  loadHierarchicalRbacFromCloud,
  DEFAULT_FEATURE_ACTION_POLICY,
  isAccountHeadPermittedForCampus,
  recordRbacAuditEvent,
  isAccountHeadSensitive,
} from '../services/campusPermissionEngine';
import firebaseConfig from '../../firebase-applet-config.json';

interface PermissionEngineProps {
  embedded?: boolean;
  onClose?: () => void;
  onNavigateToAuditTrail?: () => void;
}

type EngineTab = 'user_roles' | 'action_matrix' | 'permission_simulator' | 'rules_overview';

export const PermissionEngine: React.FC<PermissionEngineProps> = ({
  embedded = false,
  onClose,
  onNavigateToAuditTrail,
}) => {
  const {
    currentUser,
    users,
    campuses,
    accountHeads,
    isSuperAdmin,
    logActivity,
  } = useAccounting();

  const [activeTab, setActiveTab] = useState<EngineTab>('user_roles');
  const [rbacConfig, setRbacConfig] = useState<HierarchicalRbacMasterConfig>(() =>
    getStoredHierarchicalRbacConfig(campuses, accountHeads)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );

  // User Roles Tab State
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserRoleAssignment | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Edit/Assignment Form State
  const [formUserId, setFormUserId] = useState('');
  const [formUserName, setFormUserName] = useState('');
  const [formUserEmail, setFormUserEmail] = useState('');
  const [formLevel, setFormLevel] = useState<PermissionLevel>('level_4_sub_campus_admin');
  const [formStaffRole, setFormStaffRole] = useState<DepartmentalStaffRole>('accountant');
  const [formCampusId, setFormCampusId] = useState<string>(campuses[0]?.id || '');
  const [formDelegatedSubCampuses, setFormDelegatedSubCampuses] = useState<string[]>([]);
  const [formCanManageSubUsers, setFormCanManageSubUsers] = useState(true);
  const [formCanApproveSubTx, setFormCanApproveSubTx] = useState(true);
  const [formCanViewConsolidated, setFormCanViewConsolidated] = useState(true);
  const [formChangeReason, setFormChangeReason] = useState('');

  // Permission Simulator State
  const [simTargetLevel, setSimTargetLevel] = useState<PermissionLevel>('level_4_sub_campus_admin');
  const [simStaffRole, setSimStaffRole] = useState<DepartmentalStaffRole>('accountant');
  const [simCampusId, setSimCampusId] = useState<string>(campuses[0]?.id || '');
  const [simAccountCode, setSimAccountCode] = useState<string>(accountHeads[0]?.code || '1001');
  const [simAction, setSimAction] = useState<'view' | 'post' | 'edit' | 'approve' | 'report'>('post');
  const [simResult, setSimResult] = useState<{
    allowed: boolean;
    ruleEnforced: string;
    reason: string;
    tierBoundary: string;
    timestamp: string;
  } | null>(null);

  // Matrix Tab Overrides State
  const [activeMatrixLevel, setActiveMatrixLevel] = useState<PermissionLevel>('level_3_main_campus_admin');

  // Load from Cloud Firestore on mount
  useEffect(() => {
    loadHierarchicalRbacFromCloud()
      .then((cloudData) => {
        if (cloudData) {
          setRbacConfig(cloudData);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const actorMeta = useMemo(() => {
    return {
      userId: currentUser?.id || 'admin-root',
      userName: currentUser?.name || 'Platform Super Admin',
      userEmail: currentUser?.username ? `${currentUser.username}@aplus.edu.pk` : 'admin@aplus.edu.pk',
      userRole: isSuperAdmin ? 'Platform Super Admin' : currentUser?.role || 'Administrator',
      permissionLevel: (isSuperAdmin ? 'level_1_platform_super_admin' : 'level_2_client_super_admin') as PermissionLevel,
    };
  }, [currentUser, isSuperAdmin]);

  // Combined User Roster (merging users from accounting engine + stored assignments)
  const combinedUserRoster: UserRoleAssignment[] = useMemo(() => {
    const list: UserRoleAssignment[] = [];
    const assignmentMap = rbacConfig.userRoleAssignments || {};

    // 1. Existing stored assignments
    Object.values(assignmentMap).forEach((item) => {
      list.push(item);
    });

    // 2. Add users from engine that don't have an explicit entry yet
    (users || []).forEach((u) => {
      if (!assignmentMap[u.id]) {
        const campusObj = campuses.find((c) => c.id === u.campusId);
        let defaultLevel: PermissionLevel = 'level_4_sub_campus_admin';
        if (u.role === 'super_admin') defaultLevel = 'level_1_platform_super_admin';
        else if (u.role === 'administration') defaultLevel = 'level_3_main_campus_admin';
        else if (u.role === 'campus_accountant') defaultLevel = 'level_5_departmental_staff';

        list.push({
          userId: u.id,
          userName: u.name || u.username,
          userEmail: u.username ? `${u.username}@aplus.edu.pk` : 'staff@aplus.edu.pk',
          permissionLevel: defaultLevel,
          departmentalRole: defaultLevel === 'level_5_departmental_staff' ? 'accountant' : undefined,
          assignedCampusId: u.campusId || campuses[0]?.id || 'all',
          assignedCampusName: campusObj?.name || 'Central Campus',
          assignedAt: new Date().toISOString(),
          assignedBy: 'System Engine Sync',
          assignedByRole: 'Root Authority',
          status: 'active',
        });
      }
    });

    // Filter by search, role, campus
    return list.filter((item) => {
      if (roleFilter !== 'ALL' && item.permissionLevel !== roleFilter) return false;
      if (campusFilter !== 'ALL' && item.assignedCampusId !== campusFilter && item.assignedCampusId !== 'all') {
        return false;
      }
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        return (
          item.userName.toLowerCase().includes(q) ||
          item.userId.toLowerCase().includes(q) ||
          (item.userEmail || '').toLowerCase().includes(q) ||
          item.assignedCampusName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rbacConfig.userRoleAssignments, users, campuses, roleFilter, campusFilter, userSearchQuery]);

  // Open modal for editing user
  const handleOpenAssignModal = (assignment?: UserRoleAssignment) => {
    if (assignment) {
      setSelectedUserForEdit(assignment);
      setFormUserId(assignment.userId);
      setFormUserName(assignment.userName);
      setFormUserEmail(assignment.userEmail || '');
      setFormLevel(assignment.permissionLevel);
      setFormStaffRole(assignment.departmentalRole || 'accountant');
      setFormCampusId(assignment.assignedCampusId || campuses[0]?.id || '');
      setFormDelegatedSubCampuses(assignment.delegatedSubCampusIds || []);
      setFormCanManageSubUsers(assignment.delegatedPermissions?.canManageSubCampusUsers ?? true);
      setFormCanApproveSubTx(assignment.delegatedPermissions?.canApproveSubCampusTransactions ?? true);
      setFormCanViewConsolidated(assignment.delegatedPermissions?.canViewConsolidatedReports ?? true);
    } else {
      setSelectedUserForEdit(null);
      const newId = `user-cmp-${Date.now().toString().slice(-4)}`;
      setFormUserId(newId);
      setFormUserName('');
      setFormUserEmail('');
      setFormLevel('level_4_sub_campus_admin');
      setFormStaffRole('accountant');
      setFormCampusId(campuses[0]?.id || '');
      setFormDelegatedSubCampuses([]);
      setFormCanManageSubUsers(true);
      setFormCanApproveSubTx(true);
      setFormCanViewConsolidated(true);
    }
    setFormChangeReason('');
    setIsAssignModalOpen(true);
  };

  // Submit User Role Assignment & Log Audit Trail
  const handleSaveUserAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUserName.trim()) {
      showToast('error', 'Please provide a valid user name.');
      return;
    }

    const targetCampus = campuses.find((c) => c.id === formCampusId);
    const assignedCampusName =
      formCampusId === 'all'
        ? 'All Campuses (Consolidated Scope)'
        : targetCampus?.name || 'Assigned Campus';

    const previousAssignment = rbacConfig.userRoleAssignments[formUserId];
    const now = new Date().toISOString();

    const updatedAssignment: UserRoleAssignment = {
      userId: formUserId,
      userName: formUserName.trim(),
      userEmail: formUserEmail.trim() || `${formUserId}@aplus.edu.pk`,
      permissionLevel: formLevel,
      departmentalRole: formLevel === 'level_5_departmental_staff' ? formStaffRole : undefined,
      assignedCampusId: formCampusId,
      assignedCampusName,
      delegatedSubCampusIds: formLevel === 'level_3_main_campus_admin' ? formDelegatedSubCampuses : undefined,
      delegatedPermissions:
        formLevel === 'level_3_main_campus_admin'
          ? {
              canManageSubCampusUsers: formCanManageSubUsers,
              canApproveSubCampusTransactions: formCanApproveSubTx,
              canViewConsolidatedReports: formCanViewConsolidated,
              canAssignAccountVisibility: false,
            }
          : undefined,
      assignedAt: now,
      assignedBy: actorMeta.userName,
      assignedByRole: actorMeta.userRole,
      status: 'active',
    };

    const newConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      userRoleAssignments: {
        ...rbacConfig.userRoleAssignments,
        [formUserId]: updatedAssignment,
      },
      updatedAt: now,
    };

    setRbacConfig(newConfig);
    saveStoredHierarchicalRbacConfig(newConfig);
    setIsAssignModalOpen(false);

    // Record forensic audit event
    const changeDescription = previousAssignment
      ? `Updated role for ${formUserName} (ID: ${formUserId}) from ${previousAssignment.permissionLevel} to ${formLevel} on ${assignedCampusName}. Reason: ${
          formChangeReason || 'Administrative promotion/reassignment'
        }.`
      : `Assigned new role ${formLevel} to ${formUserName} (ID: ${formUserId}) with scope: ${assignedCampusName}. Reason: ${
          formChangeReason || 'Initial user onboarding'
        }.`;

    await recordRbacAuditEvent(
      {
        actor: actorMeta,
        actionType: 'ROLE_ASSIGNED',
        affectedScope: {
          scopeType: 'user',
          campusId: formCampusId,
          campusName: assignedCampusName,
          targetUserId: formUserId,
          targetUserName: formUserName,
          targetUserRole: formLevel === 'level_5_departmental_staff' ? formStaffRole : formLevel,
          targetPermissionLevel: formLevel,
        },
        natureOfChange: changeDescription,
        beforeState: previousAssignment || null,
        afterState: updatedAssignment,
        ruleEnforced: 'Delegation rule & Campus boundary',
      },
      logActivity
    );

    showToast('success', `Assigned ${formLevel.replace(/_/g, ' ')} to ${formUserName} successfully!`);
  };

  // Toggle User Status (Active / Suspended)
  const handleToggleUserStatus = async (userItem: UserRoleAssignment) => {
    const newStatus = userItem.status === 'active' ? 'suspended' : 'active';
    const updated: UserRoleAssignment = {
      ...userItem,
      status: newStatus,
      assignedAt: new Date().toISOString(),
      assignedBy: actorMeta.userName,
    };

    const newConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      userRoleAssignments: {
        ...rbacConfig.userRoleAssignments,
        [userItem.userId]: updated,
      },
      updatedAt: new Date().toISOString(),
    };

    setRbacConfig(newConfig);
    saveStoredHierarchicalRbacConfig(newConfig);

    await recordRbacAuditEvent(
      {
        actor: actorMeta,
        actionType: newStatus === 'suspended' ? 'ROLE_REVOKED' : 'ROLE_ASSIGNED',
        affectedScope: {
          scopeType: 'user',
          campusId: userItem.assignedCampusId,
          campusName: userItem.assignedCampusName,
          targetUserId: userItem.userId,
          targetUserName: userItem.userName,
          targetPermissionLevel: userItem.permissionLevel,
        },
        natureOfChange: `${newStatus === 'suspended' ? 'Suspended' : 'Re-activated'} access for user ${
          userItem.userName
        } (${userItem.userId}). Historical records preserved.`,
        beforeState: { status: userItem.status },
        afterState: { status: newStatus },
        ruleEnforced: 'Audit rule & Historical Preservation rule',
      },
      logActivity
    );

    showToast('info', `User ${userItem.userName} status set to ${newStatus.toUpperCase()}`);
  };

  // Toggle Policy Override on Action Matrix
  const handleToggleMatrixPolicy = async (
    featureKey: SystemFeatureKey,
    actionKey: keyof PermissionActionMatrix
  ) => {
    // Permanent Code Rule: Changing account codes is strictly disabled
    if (featureKey === 'change_account_codes' && (actionKey === 'create' || actionKey === 'edit' || actionKey === 'delete')) {
      showToast(
        'error',
        'Permanent Code Rule Violation: Account codes cannot be modified after creation under IAS 1 compliance.'
      );
      return;
    }

    const currentDefault =
      DEFAULT_FEATURE_ACTION_POLICY[activeMatrixLevel]?.[featureKey]?.[actionKey] ?? false;
    const currentOverride =
      rbacConfig.featurePolicyOverrides[`${activeMatrixLevel}:${featureKey}`]?.[actionKey];
    const effectiveVal = currentOverride !== undefined ? currentOverride : currentDefault;
    const newVal = !effectiveVal;

    const overrideKey = `${activeMatrixLevel}:${featureKey}`;
    const existingFeatureOverrides = rbacConfig.featurePolicyOverrides[overrideKey] || {};

    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      featurePolicyOverrides: {
        ...rbacConfig.featurePolicyOverrides,
        [overrideKey]: {
          ...existingFeatureOverrides,
          [actionKey]: newVal,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);

    await recordRbacAuditEvent(
      {
        actor: actorMeta,
        actionType: 'PERMISSION_MATRIX_OVERRIDE',
        affectedScope: {
          scopeType: 'global_matrix',
          targetPermissionLevel: activeMatrixLevel,
        },
        natureOfChange: `Overrode action '${actionKey}' on feature '${featureKey}' for ${activeMatrixLevel} to ${
          newVal ? 'ALLOWED' : 'DENIED'
        }.`,
        beforeState: { [actionKey]: effectiveVal },
        afterState: { [actionKey]: newVal },
        ruleEnforced: 'Action boundary & Delegation rule',
      },
      logActivity
    );

    showToast('info', `Updated ${featureKey} [${actionKey}] → ${newVal ? 'Allowed' : 'Denied'}`);
  };

  // Reset Overrides for Active Level
  const handleResetLevelOverrides = async () => {
    const cleanedOverrides: Record<string, Partial<PermissionActionMatrix>> = {};
    Object.entries(rbacConfig.featurePolicyOverrides).forEach(([k, v]) => {
      if (!k.startsWith(`${activeMatrixLevel}:`)) {
        cleanedOverrides[k] = v;
      }
    });

    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      featurePolicyOverrides: cleanedOverrides,
      updatedAt: new Date().toISOString(),
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);

    await recordRbacAuditEvent(
      {
        actor: actorMeta,
        actionType: 'PERMISSION_MATRIX_OVERRIDE',
        affectedScope: {
          scopeType: 'global_matrix',
          targetPermissionLevel: activeMatrixLevel,
        },
        natureOfChange: `Reset all action matrix overrides for ${activeMatrixLevel} to system defaults.`,
        ruleEnforced: 'Platform policy standard',
      },
      logActivity
    );

    showToast('success', `Reset action matrix policy for ${activeMatrixLevel} to defaults.`);
  };

  // Run Live Permission Simulation
  const handleRunSimulation = () => {
    const selectedCamp = campuses.find((c) => c.id === simCampusId);
    const selectedHead = accountHeads.find((h) => h.code === simAccountCode);

    // 1. Check Platform Super Admin
    if (simTargetLevel === 'level_1_platform_super_admin') {
      if (simAction === 'edit' && simAccountCode === 'change_account_codes') {
        setSimResult({
          allowed: false,
          ruleEnforced: 'Rule 5: Permanent Code Rule',
          reason: 'Permanent code rule: Account codes cannot be modified or deleted even by Super Admin.',
          tierBoundary: 'Level 1: Platform Super Admin Boundary',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      setSimResult({
        allowed: true,
        ruleEnforced: 'Platform Super Admin Absolute Authority',
        reason: 'Level 1 Platform Super Admin holds unrestricted authority across all clients and campuses.',
        tierBoundary: 'Unrestricted Global Scope',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 2. Check Client Super Admin (Level 2)
    if (simTargetLevel === 'level_2_client_super_admin') {
      if (simAction === 'post') {
        setSimResult({
          allowed: true,
          ruleEnforced: 'Rule 1: Platform boundary & Rule 2: Campus boundary',
          reason: 'Client Super Admin is permitted to record transactions across all campuses within assigned school organization.',
          tierBoundary: 'Level 2: Client Organization Boundary',
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    // 3. Check Account Head Level Authorization
    const headCheck = isAccountHeadPermittedForCampus({
      campusId: simCampusId,
      accountCode: simAccountCode,
      action: simAction,
      rbacConfig: {
        ...rbacConfig,
        activeLevel: simTargetLevel,
      },
    });

    if (!headCheck.allowed) {
      setSimResult({
        allowed: false,
        ruleEnforced: 'Rule 3: Account boundary',
        reason: headCheck.reason || 'Account head access denied by Super Admin campus policy.',
        tierBoundary: `${simTargetLevel} Scope Boundary`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 4. Sensitive account check
    const isSensitive = isAccountHeadSensitive(simAccountCode, selectedHead?.name || '');
    if (isSensitive && simTargetLevel === 'level_4_sub_campus_admin' && (simAction === 'post' || simAction === 'approve')) {
      setSimResult({
        allowed: false,
        ruleEnforced: 'Rule 3 & 4: Sensitive Account Restriction',
        reason: `Account ${simAccountCode} is classified as confidential/management sensitive. Sub-Campus Admin cannot post without Main Campus Admin or Super Admin delegation.`,
        tierBoundary: 'Sensitive Head Segregation',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // 5. Action boundary check
    if (simTargetLevel === 'level_5_departmental_staff' && simStaffRole === 'viewer_auditor' && simAction !== 'view' && simAction !== 'report') {
      setSimResult({
        allowed: false,
        ruleEnforced: 'Rule 4: Action boundary',
        reason: 'Viewer / Auditor role is strictly read-only. Viewing reports does not grant permission to record, edit, or approve.',
        tierBoundary: 'Level 5 Departmental Role Constraint',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setSimResult({
      allowed: true,
      ruleEnforced: 'Rule 1-7 Invariants Passed',
      reason: `Action '${simAction.toUpperCase()}' is fully authorized on account ${simAccountCode} (${selectedHead?.name}) for ${selectedCamp?.name}.`,
      tierBoundary: `${simTargetLevel} Permitted Execution Window`,
      timestamp: new Date().toISOString(),
    });
  };

  // Save to Cloud Firestore
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    const success = await syncHierarchicalRbacToCloud(rbacConfig);
    setIsSaving(false);

    if (success) {
      await recordRbacAuditEvent(
        {
          actor: actorMeta,
          actionType: 'SECURITY_OVERRIDE_ENFORCED',
          affectedScope: {
            scopeType: 'global_matrix',
          },
          natureOfChange: `Synchronized entire Hierarchical RBAC Master State and User Roles to Cloud Database [${firebaseConfig.firestoreDatabaseId}].`,
          ruleEnforced: 'Cloud persistence invariant',
        },
        logActivity
      );

      showToast(
        'success',
        `Synchronized RBAC Engine State to Firestore Database [${firebaseConfig.firestoreDatabaseId}]!`
      );
    } else {
      showToast('info', 'Saved locally. Check your internet connection for Cloud sync.');
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${
        embedded ? 'mb-4' : 'max-w-7xl mx-auto px-4 sm:px-6 mb-6'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 text-white'
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

      {/* Main Top Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              <span>Centralized RBAC Engine</span>
              <span>·</span>
              <span>Levels 1 - 5 Access Architecture</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Hierarchical Permission Engine</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Live Enforcer
              </span>
            </h2>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToAuditTrail && (
            <button
              type="button"
              onClick={onNavigateToAuditTrail}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Jump to Forensic Secure Audit Trail to inspect permission changes"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Audit Trail Logs</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>Save to Cloud</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-900 px-5 pt-1 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('user_roles')}
          className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'user_roles'
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-400" />
          <span>Campus Administrators & User Role Assignments ({combinedUserRoster.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('action_matrix')}
          className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'action_matrix'
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Permission Action Matrix (Enforcement & Overrides)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('permission_simulator')}
          className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'permission_simulator'
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Scale className="w-4 h-4 text-amber-400" />
          <span>Live Permission Simulator & Probe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules_overview')}
          className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'rules_overview'
              ? 'border-indigo-400 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span>7 Recommended Permission Inheritance Rules</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CAMPUS ADMINISTRATOR & USER ROLE ASSIGNMENT INTERFACE  */}
      {/* ============================================================== */}
      {activeTab === 'user_roles' && (
        <div className="p-5 space-y-4">
          {/* Controls Bar: Search, Filters & Add User Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search user name, ID, or campus..."
                  className="text-xs bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 min-w-[220px]"
                />
              </div>

              <div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Permission Levels</option>
                  <option value="level_1_platform_super_admin">Level 1: Platform Super Admin</option>
                  <option value="level_2_client_super_admin">Level 2: Client Super Admin</option>
                  <option value="level_3_main_campus_admin">Level 3: Main Campus Admin</option>
                  <option value="level_4_sub_campus_admin">Level 4: Sub-Campus Admin</option>
                  <option value="level_5_departmental_staff">Level 5: Departmental Staff</option>
                </select>
              </div>

              <div>
                <select
                  value={campusFilter}
                  onChange={(e) => setCampusFilter(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Campus Scopes</option>
                  <option value="all">Consolidated / All Campuses</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenAssignModal()}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Role to Administrator</span>
            </button>
          </div>

          {/* User Role Assignment Roster Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">User & Officer Details</th>
                  <th className="p-3">Assigned Permission Level</th>
                  <th className="p-3">Campus Jurisdiction Scope</th>
                  <th className="p-3">Delegated Capabilities</th>
                  <th className="p-3">Assignment Audit</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                {combinedUserRoster.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No users match the search filter. Click 'Assign Role to Administrator' to create an assignment.
                    </td>
                  </tr>
                ) : (
                  combinedUserRoster.map((item) => {
                    const isSuspended = item.status === 'suspended';

                    return (
                      <tr key={item.userId} className={`hover:bg-slate-50 ${isSuspended ? 'opacity-60 bg-slate-50' : ''}`}>
                        {/* User Details */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{item.userName}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            ID: {item.userId} · {item.userEmail}
                          </div>
                        </td>

                        {/* Permission Level */}
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              item.permissionLevel === 'level_1_platform_super_admin'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : item.permissionLevel === 'level_2_client_super_admin'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                : item.permissionLevel === 'level_3_main_campus_admin'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : item.permissionLevel === 'level_4_sub_campus_admin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-purple-100 text-purple-900 border border-purple-300'
                            }`}
                          >
                            {item.permissionLevel.replace(/level_[0-9]_/, '').replace(/_/g, ' ').toUpperCase()}
                          </span>
                          {item.departmentalRole && (
                            <span className="block text-[10px] font-mono text-slate-500 mt-1 capitalize">
                              Role: {item.departmentalRole.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>

                        {/* Campus Jurisdiction Scope */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.assignedCampusName}</span>
                          </div>
                          {item.delegatedSubCampusIds && item.delegatedSubCampusIds.length > 0 && (
                            <div className="text-[10px] text-blue-700 font-semibold mt-0.5">
                              + Manages {item.delegatedSubCampusIds.length} Authorized Sub-Campuses
                            </div>
                          )}
                        </td>

                        {/* Delegated Capabilities */}
                        <td className="p-3 text-[10px]">
                          {item.permissionLevel === 'level_3_main_campus_admin' ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-emerald-800">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Sub-campus users management</span>
                              </div>
                              <div className="flex items-center gap-1 text-emerald-800">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Sub-campus transaction approvals</span>
                              </div>
                            </div>
                          ) : item.permissionLevel === 'level_1_platform_super_admin' ? (
                            <span className="text-blue-800 font-bold">Full Unrestricted Platform Control</span>
                          ) : (
                            <span className="text-slate-500">Standard Tier Policies Apply</span>
                          )}
                        </td>

                        {/* Assignment Audit */}
                        <td className="p-3 text-[10px]">
                          <div className="font-medium text-slate-700">By: {item.assignedBy}</div>
                          <div className="font-mono text-slate-400 mt-0.5">
                            {new Date(item.assignedAt).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSuspended ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(item)}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Edit Role
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(item)}
                              className={`px-2 py-1 rounded font-bold text-[11px] transition-colors cursor-pointer ${
                                isSuspended
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                              title={isSuspended ? 'Activate User' : 'Suspend Role Access'}
                            >
                              {isSuspended ? 'Activate' : 'Suspend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PERMISSION ACTION MATRIX ENFORCEMENT & OVERRIDES        */}
      {/* ============================================================== */}
      {activeTab === 'action_matrix' && (
        <div className="p-5 space-y-4">
          {/* Level Switcher & Reset Button */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Permission Level to Inspect & Enforce:
              </span>
              <select
                value={activeMatrixLevel}
                onChange={(e) => setActiveMatrixLevel(e.target.value as PermissionLevel)}
                className="text-xs font-bold text-indigo-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="level_1_platform_super_admin">Level 1: Platform Super Admin</option>
                <option value="level_2_client_super_admin">Level 2: Client / School Super Admin</option>
                <option value="level_3_main_campus_admin">Level 3: Main Campus Admin</option>
                <option value="level_4_sub_campus_admin">Level 4: Sub-Campus Admin</option>
                <option value="level_5_departmental_staff">Level 5: Departmental Staff</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetLevelOverrides}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Reset Overrides to Policy Defaults
            </button>
          </div>

          {/* Action Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-56">Feature</th>
                  <th className="p-3 text-center w-20">View</th>
                  <th className="p-3 text-center w-20">Create</th>
                  <th className="p-3 text-center w-20">Edit</th>
                  <th className="p-3 text-center w-20">Delete</th>
                  <th className="p-3 text-center w-20">Approve</th>
                  <th className="p-3 text-center w-20">Export</th>
                  <th className="p-3 text-center w-28">Manage Access</th>
                  <th className="p-3">Governance Rule & Boundary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                {(
                  [
                    'manage_all_clients',
                    'manage_assigned_campuses',
                    'create_account_heads',
                    'change_account_codes',
                    'assign_account_head_visibility',
                    'view_financial_reports',
                    'record_transactions',
                    'approve_transactions',
                    'manage_user_permissions',
                    'access_audit_logs',
                  ] as SystemFeatureKey[]
                ).map((featureKey) => {
                  const defaultPolicy =
                    DEFAULT_FEATURE_ACTION_POLICY[activeMatrixLevel]?.[featureKey] || {
                      view: false,
                      create: false,
                      edit: false,
                      delete: false,
                      approve: false,
                      export: false,
                      manageAccess: false,
                    };

                  const overrideItem =
                    rbacConfig.featurePolicyOverrides[`${activeMatrixLevel}:${featureKey}`] || {};

                  const actionsList: (keyof PermissionActionMatrix)[] = [
                    'view',
                    'create',
                    'edit',
                    'delete',
                    'approve',
                    'export',
                    'manageAccess',
                  ];

                  const isPermanentCodeLocked = featureKey === 'change_account_codes';

                  return (
                    <tr
                      key={featureKey}
                      className={`hover:bg-slate-50 ${
                        isPermanentCodeLocked ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <td className="p-3 font-bold text-slate-900">
                        {featureKey.replace(/_/g, ' ').toUpperCase()}
                        {isPermanentCodeLocked && (
                          <span className="block text-[10px] font-bold text-amber-800 mt-0.5">
                            (Rule 5: Permanent Code Rule — Immutable)
                          </span>
                        )}
                      </td>

                      {actionsList.map((actionKey) => {
                        const effective =
                          overrideItem[actionKey] !== undefined
                            ? overrideItem[actionKey]
                            : defaultPolicy[actionKey];
                        const isOverridden = overrideItem[actionKey] !== undefined;

                        if (isPermanentCodeLocked && (actionKey === 'create' || actionKey === 'edit' || actionKey === 'delete')) {
                          return (
                            <td key={actionKey} className="p-3 text-center">
                              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                LOCKED
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={actionKey} className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleMatrixPolicy(featureKey, actionKey)}
                              className={`w-7 h-7 rounded-lg font-bold text-[11px] transition-all cursor-pointer inline-flex items-center justify-center ${
                                effective
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-400'
                              } ${isOverridden ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                              title={`${featureKey} [${actionKey}]: ${
                                effective ? 'Allowed' : 'Denied'
                              }${isOverridden ? ' (Custom Override Active)' : ''}`}
                            >
                              {effective ? '✓' : '—'}
                            </button>
                          </td>
                        );
                      })}

                      <td className="p-3 text-[11px] text-slate-600">
                        {featureKey === 'change_account_codes'
                          ? 'Never after creation. Immutable COA standard (IAS 1).'
                          : featureKey === 'manage_all_clients'
                          ? 'Platform Super Admin boundary only.'
                          : featureKey === 'assign_account_head_visibility'
                          ? 'Controlled by Super Admin & delegated Main Campus Admin.'
                          : featureKey === 'view_financial_reports'
                          ? 'Scoped strictly to assigned campus boundary.'
                          : 'Configurable role policy enforced.'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: LIVE PERMISSION SIMULATOR & PROBE                      */}
      {/* ============================================================== */}
      {activeTab === 'permission_simulator' && (
        <div className="p-6 space-y-6">
          <div className="max-w-4xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Scale className="w-4 h-4 text-indigo-600" />
                  <span>Real-Time Permission Probe & Simulation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Test whether an action on a specific account head is permitted for a campus role under current RBAC rules before executing transactions.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded bg-indigo-100 text-indigo-800">
                Sandbox Inspector
              </span>
            </div>

            {/* Probe Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Target Role Level
                </label>
                <select
                  value={simTargetLevel}
                  onChange={(e) => setSimTargetLevel(e.target.value as PermissionLevel)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value="level_1_platform_super_admin">Level 1: Platform Super Admin</option>
                  <option value="level_2_client_super_admin">Level 2: Client Super Admin</option>
                  <option value="level_3_main_campus_admin">Level 3: Main Campus Admin</option>
                  <option value="level_4_sub_campus_admin">Level 4: Sub-Campus Admin</option>
                  <option value="level_5_departmental_staff">Level 5: Departmental Staff</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Campus Jurisdiction
                </label>
                <select
                  value={simCampusId}
                  onChange={(e) => setSimCampusId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Target Account Head
                </label>
                <select
                  value={simAccountCode}
                  onChange={(e) => setSimAccountCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  {accountHeads.map((h) => (
                    <option key={h.code} value={h.code}>
                      {h.code} — {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Requested Action
                </label>
                <select
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value="view">VIEW (Inspect Ledger)</option>
                  <option value="post">POST (Record Voucher)</option>
                  <option value="edit">EDIT (Modify Entry)</option>
                  <option value="approve">APPROVE (Audit Clearance)</option>
                  <option value="report">REPORT (Export Data)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleRunSimulation}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Evaluate & Probe Permission Engine</span>
              </button>
            </div>

            {/* Probe Output Card */}
            {simResult && (
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  simResult.allowed
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50/80 border-rose-300 text-rose-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-sm ${
                        simResult.allowed ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      {simResult.allowed ? '✓' : '✗'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider">
                        {simResult.allowed ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                      </h4>
                      <p className="text-xs font-semibold mt-0.5">{simResult.ruleEnforced}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                    {simResult.tierBoundary}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs leading-relaxed font-medium">
                  <strong>Evaluator Reasoning:</strong> {simResult.reason}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: 7 RECOMMENDED INHERITANCE RULES OVERVIEW               */}
      {/* ============================================================== */}
      {activeTab === 'rules_overview' && (
        <div className="p-6 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Recommended Permission Inheritance Rules (System Constitution)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Immutable security boundary rules enforced by the PermissionEngine kernel across all database operations, exports, and direct routes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">1</span>
                <span>Platform boundary</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                A client cannot access another client's information. Multi-tenant isolation is enforced at the database query level.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">2</span>
                <span>Campus boundary</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                A campus user can access only the campus records explicitly assigned or delegated to them. Cross-campus data leakage is strictly prohibited.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">3</span>
                <span>Account boundary</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                A user can work only with account heads authorized for their campus and role. Sensitive heads (payroll, drawings) require higher-tier authorization.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">4</span>
                <span>Action boundary</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                Seeing a report does not automatically grant permission to edit or approve its records. Discrete flags are required for each verb.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold">5</span>
                <span>Permanent code rule</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                Account codes are generated once and cannot be changed or reused, even when account access is revoked. Preserves IAS 1 compliance.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold">6</span>
                <span>Delegation rule</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                Administrators may grant permissions only within their own authority. No lower-level user can expand their own privileges.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5 md:col-span-2">
              <div className="font-black text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">7</span>
                <span>Audit rule</span>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">
                Every permission change records the administrator, timestamp, affected campus/account head scope, and nature of the change into the forensic SecureAuditTrail with SHA256 integrity signatures.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN / EDIT USER ROLE DIALOG                          */}
      {/* ============================================================== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>
                  {selectedUserForEdit ? 'Edit Campus Administrator Role' : 'Assign New Administrator Role'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUserAssignment} className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  User Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formUserName}
                  onChange={(e) => setFormUserName(e.target.value)}
                  placeholder="e.g. Professor Tariq Mehmood"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    User ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    disabled={!!selectedUserForEdit}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-700 disabled:opacity-75"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formUserEmail}
                    onChange={(e) => setFormUserEmail(e.target.value)}
                    placeholder="officer@aplus.edu.pk"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Permission Level
                </label>
                <select
                  value={formLevel}
                  onChange={(e) => setFormLevel(e.target.value as PermissionLevel)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value="level_1_platform_super_admin">Level 1: Platform Super Admin (Full Control)</option>
                  <option value="level_2_client_super_admin">Level 2: Client / School Super Admin</option>
                  <option value="level_3_main_campus_admin">Level 3: Main Campus Admin (Main + Sub-Campuses)</option>
                  <option value="level_4_sub_campus_admin">Level 4: Sub-Campus Admin (Assigned Campus Only)</option>
                  <option value="level_5_departmental_staff">Level 5: Departmental Staff (Module Specific)</option>
                </select>
              </div>

              {formLevel === 'level_5_departmental_staff' && (
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Departmental Staff Role
                  </label>
                  <select
                    value={formStaffRole}
                    onChange={(e) => setFormStaffRole(e.target.value as DepartmentalStaffRole)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="accountant">Accountant (Permitted Vouchers & Ledgers)</option>
                    <option value="fee_manager">Fee Manager (Student Fee Collection & Challans)</option>
                    <option value="hr_manager">HR Manager (Payroll & Staff Records)</option>
                    <option value="teacher">Teacher (Attendance & Academic Records)</option>
                    <option value="viewer_auditor">Viewer / Auditor (Read-Only Authorized Reports)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Assigned Campus Jurisdiction Scope
                </label>
                <select
                  value={formCampusId}
                  onChange={(e) => setFormCampusId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-bold text-slate-900 cursor-pointer"
                >
                  {(formLevel === 'level_1_platform_super_admin' || formLevel === 'level_2_client_super_admin') && (
                    <option value="all">Consolidated (All Campuses)</option>
                  )}
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) — {c.city || 'Punjab'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delegated Controls for Level 3 Main Campus Admin */}
              {formLevel === 'level_3_main_campus_admin' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <span className="font-black text-slate-800 uppercase tracking-wider block">
                    Main Campus Delegation Privileges:
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formCanManageSubUsers}
                      onChange={(e) => setFormCanManageSubUsers(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span>Can manage sub-campus users and permissions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formCanApproveSubTx}
                      onChange={(e) => setFormCanApproveSubTx(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span>Can approve sub-campus transactions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formCanViewConsolidated}
                      onChange={(e) => setFormCanViewConsolidated(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span>Can view consolidated reports for authorized campuses</span>
                  </label>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Change Rationale / Audit Memo
                </label>
                <input
                  type="text"
                  value={formChangeReason}
                  onChange={(e) => setFormChangeReason(e.target.value)}
                  placeholder="e.g. Authorized by Principal under Annual Governance Directive"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer shadow-2xs"
                >
                  Save & Log Role Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
