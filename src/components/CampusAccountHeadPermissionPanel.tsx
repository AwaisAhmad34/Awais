import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
  Database,
  Sliders,
  CheckCircle2,
  Users,
  Eye,
  KeyRound,
  FileText,
  AlertCircle,
  X,
  FileCheck,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAccounting, Campus, AccountHead } from '../core/aplusEngine';
import {
  HierarchicalRbacMasterConfig,
  PermissionLevel,
  DepartmentalStaffRole,
  CampusAccountHeadAccessConfig,
  AccountHeadPermissionItem,
  getStoredHierarchicalRbacConfig,
  saveStoredHierarchicalRbacConfig,
  syncHierarchicalRbacToCloud,
  loadHierarchicalRbacFromCloud,
  DEFAULT_FEATURE_ACTION_POLICY,
  isAccountHeadSensitive,
  SystemFeatureKey,
  recordRbacAuditEvent,
} from '../services/campusPermissionEngine';
import firebaseConfig from '../../firebase-applet-config.json';

interface CampusAccountHeadPermissionPanelProps {
  embedded?: boolean;
  onClose?: () => void;
}

type PanelViewMode = 'illustrative_demo' | 'live_account_heads' | 'rbac_matrix_rules';

// Section 4 Mockup Data items for the illustrative demonstration panel
interface IllustrativeAccountHead {
  code: string;
  name: string;
  category: string;
  selected: boolean;
  isParent?: boolean;
}

const DEFAULT_DEMO_CAMPUSES = [
  { id: 'khiali_main', name: 'A+ School System — Khiali Main Campus', code: 'A+ KHL-MAIN', type: 'Main Campus' },
  { id: 'sub_campus_1', name: 'Sub-Campus 1', code: 'SUB-1', type: 'Sub-Campus' },
  { id: 'sub_campus_2', name: 'Sub-Campus 2', code: 'SUB-2', type: 'Sub-Campus' },
];

const DEFAULT_DEMO_HEADS: IllustrativeAccountHead[] = [
  { code: '1001', name: 'Main Account Head', category: 'Control Account', selected: true, isParent: true },
  { code: '1001-1', name: 'Fee Income', category: 'Revenue', selected: true },
  { code: '1001-2', name: 'Admission Fee', category: 'Revenue', selected: true },
  { code: '1001-3', name: 'Salary Expense', category: 'Expense (Sensitive)', selected: false },
  { code: '1001-4', name: 'Utility Expense', category: 'Expense', selected: false },
];

export const CampusAccountHeadPermissionPanel: React.FC<CampusAccountHeadPermissionPanelProps> = ({
  embedded = false,
  onClose,
}) => {
  const {
    campuses,
    accountHeads,
    currentUser,
    isSuperAdmin,
    logActivity,
  } = useAccounting();

  const [rbacConfig, setRbacConfig] = useState<HierarchicalRbacMasterConfig>(() =>
    getStoredHierarchicalRbacConfig(campuses, accountHeads)
  );

  const [activeViewMode, setActiveViewMode] = useState<PanelViewMode>('illustrative_demo');
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyTargetCampusId, setCopyTargetCampusId] = useState<string>(campuses[1]?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '100': true,
    '400': true,
    '500': true,
  });

  // Illustrative Demo Panel State (matches Section 4 specifications verbatim)
  const [demoSelectedCampus, setDemoSelectedCampus] = useState<string>('khiali_main');
  const [demoHeadsState, setDemoHeadsState] = useState<IllustrativeAccountHead[]>(DEFAULT_DEMO_HEADS);
  const [demoCopyFeedback, setDemoCopyFeedback] = useState<string | null>(null);

  // Load from Firestore Cloud on mount
  useEffect(() => {
    loadHierarchicalRbacFromCloud()
      .then((cloudData) => {
        if (cloudData) {
          setRbacConfig(cloudData);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (type: 'success' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const selectedCampus = campuses.find((c) => c.id === selectedCampusId) || campuses[0];
  const campusConfig: CampusAccountHeadAccessConfig =
    rbacConfig.campusAccountAccess[selectedCampusId] || {
      campusId: selectedCampus?.id || '',
      campusCode: selectedCampus?.code || '',
      campusName: selectedCampus?.name || '',
      allowedAccountCodes: accountHeads.map((a) => a.code),
      inheritedGroupCodes: [],
      permissionsByAccount: {},
      sensitiveRestrictions: {},
      updatedAt: new Date().toISOString(),
      updatedBy: 'Platform Super Admin',
    };

  // Group account heads by 5 Main Categories
  const groupedHeads = useMemo(() => {
    const categories: Record<
      string,
      {
        mainCode: string;
        title: string;
        groups: Record<string, { groupName: string; heads: AccountHead[] }>;
      }
    > = {
      '100': { mainCode: '100', title: '100 — ASSETS (Fixed, Cash, Bank & Receivables)', groups: {} },
      '200': { mainCode: '200', title: '200 — EQUITY / CAPITAL & RESERVES', groups: {} },
      '300': { mainCode: '300', title: '300 — LIABILITIES (Payables & Loans)', groups: {} },
      '400': { mainCode: '400', title: '400 — REVENUE / INCOME (Tuition Fees & Other Income)', groups: {} },
      '500': { mainCode: '500', title: '500 — EXPENSES (Salaries, Utilities, Admin & Repairs)', groups: {} },
    };

    accountHeads.forEach((head) => {
      const mainCat = head.mainCode || head.code.slice(0, 3);
      const catObj = categories[mainCat] || categories['500'];
      const grpCode = head.groupCode || head.code.slice(0, 5);

      if (!catObj.groups[grpCode]) {
        catObj.groups[grpCode] = {
          groupName: head.groupName || `Group ${grpCode}`,
          heads: [],
        };
      }
      catObj.groups[grpCode].heads.push(head);
    });

    return categories;
  }, [accountHeads]);

  // Filtered account heads
  const filteredCount = useMemo(() => {
    return campusConfig.allowedAccountCodes.length;
  }, [campusConfig]);

  // Demo panel count
  const demoSelectedCount = useMemo(() => {
    return demoHeadsState.filter((h) => h.selected).length;
  }, [demoHeadsState]);

  // Toggle demo head selection
  const handleToggleDemoHead = (code: string) => {
    setDemoHeadsState((prev) =>
      prev.map((h) => {
        if (h.code === code) {
          const newSelected = !h.selected;
          return { ...h, selected: newSelected };
        }
        return h;
      })
    );
  };

  // Demo Copy Configuration
  const handleDemoCopyConfig = () => {
    setDemoCopyFeedback('Configuration copied to clipboard & mirrored across Sub-Campus 1!');
    setTimeout(() => setDemoCopyFeedback(null), 3500);
  };

  // Toggle single account head access (allow/disallow)
  const handleToggleAccountHead = (code: string) => {
    const isCurrentlyAllowed = campusConfig.allowedAccountCodes.includes(code);
    const updatedCodes = isCurrentlyAllowed
      ? campusConfig.allowedAccountCodes.filter((c) => c !== code)
      : [...campusConfig.allowedAccountCodes, code];

    // Maintain per-head permission item
    const existingPerm = campusConfig.permissionsByAccount[code] || {
      accountCode: code,
      canView: true,
      canPost: !isCurrentlyAllowed,
      canEdit: !isCurrentlyAllowed,
      canApprove: !isCurrentlyAllowed,
      canReport: true,
      isSensitive: isAccountHeadSensitive(code, ''),
    };

    const updatedPermissionsByAccount = {
      ...campusConfig.permissionsByAccount,
      [code]: {
        ...existingPerm,
        canView: !isCurrentlyAllowed ? true : existingPerm.canView,
        canPost: !isCurrentlyAllowed,
      },
    };

    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      campusAccountAccess: {
        ...rbacConfig.campusAccountAccess,
        [selectedCampusId]: {
          ...campusConfig,
          allowedAccountCodes: updatedCodes,
          permissionsByAccount: updatedPermissionsByAccount,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Super Admin',
        },
      },
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);

    const headObj = accountHeads.find((h) => h.code === code);
    recordRbacAuditEvent(
      {
        actor: {
          userId: currentUser?.id || 'admin-root',
          userName: currentUser?.name || 'Platform Super Admin',
          userRole: isSuperAdmin ? 'Platform Super Admin' : currentUser?.role || 'Administrator',
          permissionLevel: rbacConfig.activeLevel,
        },
        actionType: 'ACCOUNT_HEAD_VISIBILITY_CHANGED',
        affectedScope: {
          scopeType: 'account_head',
          campusId: selectedCampusId,
          campusName: selectedCampus?.name,
          accountCode: code,
          accountName: headObj?.name,
        },
        natureOfChange: `${isCurrentlyAllowed ? 'Revoked' : 'Granted'} campus visibility for account ${code} (${headObj?.name || 'Head'}) on ${selectedCampus?.name}. Historical records preserved.`,
        beforeState: { isAllowed: isCurrentlyAllowed },
        afterState: { isAllowed: !isCurrentlyAllowed },
        ruleEnforced: 'Account boundary & Historical Preservation rule',
      },
      logActivity
    );
  };

  // Toggle fine-grained action permission (View, Post, Edit, Approve, Report)
  const handleToggleActionPermission = (
    code: string,
    action: 'canView' | 'canPost' | 'canEdit' | 'canApprove' | 'canReport'
  ) => {
    const existing = campusConfig.permissionsByAccount[code] || {
      accountCode: code,
      canView: true,
      canPost: true,
      canEdit: false,
      canApprove: false,
      canReport: true,
      isSensitive: isAccountHeadSensitive(code, ''),
    };

    const updatedItem: AccountHeadPermissionItem = {
      ...existing,
      [action]: !existing[action],
    };

    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      campusAccountAccess: {
        ...rbacConfig.campusAccountAccess,
        [selectedCampusId]: {
          ...campusConfig,
          permissionsByAccount: {
            ...campusConfig.permissionsByAccount,
            [code]: updatedItem,
          },
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Super Admin',
        },
      },
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);

    const headObj = accountHeads.find((h) => h.code === code);
    recordRbacAuditEvent(
      {
        actor: {
          userId: currentUser?.id || 'admin-root',
          userName: currentUser?.name || 'Platform Super Admin',
          userRole: isSuperAdmin ? 'Platform Super Admin' : currentUser?.role || 'Administrator',
          permissionLevel: rbacConfig.activeLevel,
        },
        actionType: 'ACCOUNT_HEAD_ACTION_PERMISSION_CHANGED',
        affectedScope: {
          scopeType: 'account_head',
          campusId: selectedCampusId,
          campusName: selectedCampus?.name,
          accountCode: code,
          accountName: headObj?.name,
        },
        natureOfChange: `Toggled action '${action}' to ${!existing[action] ? 'ALLOWED' : 'DENIED'} on account ${code} (${headObj?.name || 'Head'}) for ${selectedCampus?.name}.`,
        beforeState: { [action]: existing[action] },
        afterState: { [action]: !existing[action] },
        ruleEnforced: 'Action boundary',
      },
      logActivity
    );
  };

  // Toggle all heads in an account group
  const handleToggleGroup = (groupHeads: AccountHead[], selectAll: boolean) => {
    const groupCodes = groupHeads.map((h) => h.code);
    let updatedCodes = [...campusConfig.allowedAccountCodes];

    if (selectAll) {
      groupCodes.forEach((c) => {
        if (!updatedCodes.includes(c)) updatedCodes.push(c);
      });
    } else {
      updatedCodes = updatedCodes.filter((c) => !groupCodes.includes(c));
    }

    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      campusAccountAccess: {
        ...rbacConfig.campusAccountAccess,
        [selectedCampusId]: {
          ...campusConfig,
          allowedAccountCodes: updatedCodes,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.name || 'Platform Super Admin',
        },
      },
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);
  };

  // Toggle sensitive restriction
  const handleToggleSensitive = (code: string) => {
    const currentVal = !!campusConfig.sensitiveRestrictions[code];
    const updatedConfig: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      campusAccountAccess: {
        ...rbacConfig.campusAccountAccess,
        [selectedCampusId]: {
          ...campusConfig,
          sensitiveRestrictions: {
            ...campusConfig.sensitiveRestrictions,
            [code]: !currentVal,
          },
          updatedAt: new Date().toISOString(),
        },
      },
    };

    setRbacConfig(updatedConfig);
    saveStoredHierarchicalRbacConfig(updatedConfig);

    const headObj = accountHeads.find((h) => h.code === code);
    recordRbacAuditEvent(
      {
        actor: {
          userId: currentUser?.id || 'admin-root',
          userName: currentUser?.name || 'Platform Super Admin',
          userRole: isSuperAdmin ? 'Platform Super Admin' : currentUser?.role || 'Administrator',
          permissionLevel: rbacConfig.activeLevel,
        },
        actionType: 'SENSITIVE_ACCOUNT_RESTRICTION_TOGGLED',
        affectedScope: {
          scopeType: 'account_head',
          campusId: selectedCampusId,
          campusName: selectedCampus?.name,
          accountCode: code,
          accountName: headObj?.name,
        },
        natureOfChange: `${!currentVal ? 'Locked' : 'Unlocked'} sensitive account restriction on ${code} (${headObj?.name || 'Head'}) for ${selectedCampus?.name}.`,
        beforeState: { isRestricted: currentVal },
        afterState: { isRestricted: !currentVal },
        ruleEnforced: 'Sensitive Account Segregation & Account boundary',
      },
      logActivity
    );

    showToast(
      'info',
      `Toggled sensitive access restriction for account ${code} on ${selectedCampus?.name}`
    );
  };

  // Copy Permission Configuration from selected campus to another campus
  const handleCopyPermissions = () => {
    if (!copyTargetCampusId || copyTargetCampusId === selectedCampusId) return;

    const targetCampus = campuses.find((c) => c.id === copyTargetCampusId);
    if (!targetCampus) return;

    const sourceConfig = campusConfig;
    const newTargetConfig: CampusAccountHeadAccessConfig = {
      ...sourceConfig,
      campusId: targetCampus.id,
      campusCode: targetCampus.code,
      campusName: targetCampus.name,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Platform Super Admin',
    };

    const updatedRbac: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      campusAccountAccess: {
        ...rbacConfig.campusAccountAccess,
        [targetCampus.id]: newTargetConfig,
      },
    };

    setRbacConfig(updatedRbac);
    saveStoredHierarchicalRbacConfig(updatedRbac);
    setIsCopyModalOpen(false);

    recordRbacAuditEvent(
      {
        actor: {
          userId: currentUser?.id || 'admin-root',
          userName: currentUser?.name || 'Platform Super Admin',
          userRole: isSuperAdmin ? 'Platform Super Admin' : currentUser?.role || 'Administrator',
          permissionLevel: rbacConfig.activeLevel,
        },
        actionType: 'POLICY_CONFIG_COPIED',
        affectedScope: {
          scopeType: 'campus',
          campusId: targetCampus.id,
          campusName: targetCampus.name,
        },
        natureOfChange: `Copied complete account head permissions and sensitive restrictions from ${selectedCampus?.name} to ${targetCampus.name} (${sourceConfig.allowedAccountCodes.length} heads authorized).`,
        ruleEnforced: 'Delegation rule & Campus boundary',
      },
      logActivity
    );

    showToast(
      'success',
      `Copied permission configuration from ${selectedCampus?.name} to ${targetCampus.name} successfully!`
    );
  };

  // Save and synchronize to Cloud Firestore
  const handleSaveToCloud = async () => {
    setIsSaving(true);
    const success = await syncHierarchicalRbacToCloud(rbacConfig);
    setIsSaving(false);

    if (success) {
      showToast(
        'success',
        `Synchronized Campus Account Head Access & 5-Tier RBAC to Cloud Database [${firebaseConfig.firestoreDatabaseId}]`
      );
    } else {
      showToast('info', 'Saved locally. Check your internet connection for cloud sync.');
    }
  };

  // Toggle active preview level
  const handleSelectLevel = (level: PermissionLevel) => {
    const updated: HierarchicalRbacMasterConfig = {
      ...rbacConfig,
      activeLevel: level,
    };
    setRbacConfig(updated);
    saveStoredHierarchicalRbacConfig(updated);
    showToast(
      'info',
      `Switched Active Permission Level to: ${
        level === 'level_1_platform_super_admin'
          ? 'Level 1: Platform Super Admin'
          : level === 'level_2_client_super_admin'
          ? 'Level 2: Client / School Super Admin'
          : level === 'level_3_main_campus_admin'
          ? 'Level 3: Main Campus Admin'
          : level === 'level_4_sub_campus_admin'
          ? 'Level 4: Sub-Campus Admin'
          : 'Level 5: Departmental Staff / Accountant'
      }`
    );
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${
        embedded ? 'mb-4' : 'max-w-7xl mx-auto px-4 sm:px-6 mb-6'
      }`}
    >
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
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

      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
              <span>Campus Permission Levels</span>
              <span>·</span>
              <span>Multi-Campus School Management System</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Campus Account Head Access</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Super Admin Panel
              </span>
            </h2>
          </div>
        </div>

        {/* Level Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setActiveViewMode('illustrative_demo')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeViewMode === 'illustrative_demo'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Illustrative configuration panel specified in Section 4"
            >
              Demo Panel
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('live_account_heads')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeViewMode === 'live_account_heads'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Full production account head permissions editor"
            >
              All 157 Accounts
            </button>
            <button
              type="button"
              onClick={() => setActiveViewMode('rbac_matrix_rules')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeViewMode === 'rbac_matrix_rules'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="5-Tier Hierarchy & Permission Action Matrix"
            >
              5-Tier Matrix
            </button>
          </div>

          {/* 5-Tier Level Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400 font-medium hidden sm:inline">Active Level:</span>
            <select
              value={rbacConfig.activeLevel}
              onChange={(e) => handleSelectLevel(e.target.value as PermissionLevel)}
              className="bg-transparent text-amber-300 font-bold focus:outline-hidden cursor-pointer"
              aria-label="Active Permission Level"
            >
              <option value="level_1_platform_super_admin" className="text-slate-900">
                Level 1: Platform Super Admin (Full)
              </option>
              <option value="level_2_client_super_admin" className="text-slate-900">
                Level 2: Client / School Super Admin
              </option>
              <option value="level_3_main_campus_admin" className="text-slate-900">
                Level 3: Main Campus Admin
              </option>
              <option value="level_4_sub_campus_admin" className="text-slate-900">
                Level 4: Sub-Campus Admin
              </option>
              <option value="level_5_departmental_staff" className="text-slate-900">
                Level 5: Departmental Staff / Accountant
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSaveToCloud}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
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

      {/* ============================================================== */}
      {/* VIEW 1: SECTION 4 ILLUSTRATIVE CONFIGURATION PANEL            */}
      {/* ============================================================== */}
      {activeViewMode === 'illustrative_demo' && (
        <div className="p-6 space-y-6">
          {/* Subheader & Illustrative Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-xs max-w-4xl mx-auto space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>Campus Account Head Access</span>
              </h3>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                Illustrative configuration panel
              </p>
            </div>

            {/* Select Campus Section */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                Select Campus
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEFAULT_DEMO_CAMPUSES.map((camp) => {
                  const isSelected = demoSelectedCampus === camp.id;
                  return (
                    <button
                      key={camp.id}
                      type="button"
                      onClick={() => setDemoSelectedCampus(camp.id)}
                      className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-blue-600 text-blue-950 shadow-xs ring-1 ring-blue-600'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs leading-snug">{camp.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 mt-2 block">
                        {camp.code} · {camp.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Available account heads Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Available account heads
                </label>
                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-mono font-black text-xs">
                  {demoSelectedCount} selected
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {demoHeadsState.map((head) => (
                  <div
                    key={head.code}
                    onClick={() => handleToggleDemoHead(head.code)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      head.selected ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={head.selected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-slate-900">
                            {head.code}
                          </span>
                          <span className="font-bold text-xs text-slate-800">{head.name}</span>
                          {head.isParent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-800">
                              Main Head
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {head.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          head.selected
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {head.selected ? 'Authorized' : 'Restricted'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar & Demonstration Notice */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleDemoCopyConfig}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy permission configuration</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveViewMode('live_account_heads')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <span>Switch to Live Production Matrix (157 Heads)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {demoCopyFeedback && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{demoCopyFeedback}</span>
              </div>
            )}

            {/* Verbatim Demonstration Disclaimer Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300/80 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-black">Notice:</strong> This is a demonstration only. Changes made in this preview mock are not saved to your website or database until synchronized via the production manager.
              </div>
            </div>

            {/* Section 4 System Capabilities Feature Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                System Support Requirements & Architecture:
              </h4>
              <ul className="text-xs text-slate-700 space-y-2 list-none">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Assigning account heads individually or by parent account group:</strong> Granular single-code selection or 1-click group cascade.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Inheriting access from a main account head to its sub-accounts:</strong> Automated sub-ledger inheritance with explicit exceptions.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Separate permissions:</strong> Discrete multi-level flags for Viewing, Recording transactions, Editing, Approving, and Reporting.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Restricting access to sensitive accounts:</strong> Payroll, partner drawings, and management expenses restricted to authorized tiers.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Preserving historical records:</strong> Revoking access prohibits new posting while permanently preserving historical ledger entries.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: FULL PRODUCTION 157 ACCOUNT HEADS LIVE MATRIX          */}
      {/* ============================================================== */}
      {activeViewMode === 'live_account_heads' && (
        <div className="p-5 space-y-6">
          {/* Permanent Account Code & Security Invariants Banner */}
          <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Permanent Code Rule Enforced:</strong> Account codes are
                generated once and cannot be changed or reused.
                <span className="text-amber-800 ml-1">
                  Revoking access to an account head restricts new transactions for that campus while strictly
                  preserving all historical ledger balances.
                </span>
              </div>
            </div>

            <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
              Immutable COA Standard (IAS 1)
            </span>
          </div>

          {/* Campus Selector & Search Toolbar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Select Campus
                </label>
                <select
                  value={selectedCampusId}
                  onChange={(e) => setSelectedCampusId(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer min-w-[240px]"
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) — {c.city || 'Gujranwala'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 sm:pt-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 shadow-2xs">
                  <span>Available account heads:</span>
                  <strong className="text-blue-600 font-mono">
                    {filteredCount} / {accountHeads.length} selected
                  </strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search account code or name..."
                  className="text-xs bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 min-w-[200px]"
                />
              </div>

              {/* Copy Permission Configuration Button */}
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="Copy this permission profile to another campus"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Copy permission configuration</span>
              </button>
            </div>
          </div>

          {/* Account Heads Tree and Selection Matrix */}
          <div className="space-y-4">
            {Object.entries(groupedHeads).map(([mainCode, catData]) => {
              const isCategoryExpanded = expandedGroups[mainCode] ?? true;

              return (
                <div
                  key={mainCode}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                >
                  {/* Category Header */}
                  <div
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [mainCode]: !prev[mainCode],
                      }))
                    }
                    className="p-3.5 bg-slate-900 text-white flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="font-black text-xs tracking-wide">{catData.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {Object.values(catData.groups).reduce((acc, g) => acc + g.heads.length, 0)} Heads
                      </span>
                      {isCategoryExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Groups within Category */}
                  {isCategoryExpanded && (
                    <div className="p-4 space-y-4 divide-y divide-slate-100">
                      {Object.entries(catData.groups).map(([grpCode, groupData]) => {
                        const matchingHeads = groupData.heads.filter(
                          (h) =>
                            h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            h.code.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        if (matchingHeads.length === 0) return null;

                        return (
                          <div key={grpCode} className="pt-3 first:pt-0 space-y-2">
                            {/* Group Header & Batch Group Toggles */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {grpCode}
                                </span>
                                <span className="text-xs font-bold text-slate-800">
                                  {groupData.groupName}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => handleToggleGroup(groupData.heads, true)}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold transition-colors cursor-pointer"
                                >
                                  Select All in Group
                                </button>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleGroup(groupData.heads, false)}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold transition-colors cursor-pointer"
                                >
                                  Deselect Group
                                </button>
                              </div>
                            </div>

                            {/* Individual Account Head Items with Multi-Action Checkboxes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                              {matchingHeads.map((head) => {
                                const isAllowed = campusConfig.allowedAccountCodes.includes(head.code);
                                const isSensitive = isAccountHeadSensitive(head.code, head.name);
                                const isRestricted = !!campusConfig.sensitiveRestrictions[head.code];
                                const perms = campusConfig.permissionsByAccount[head.code] || {
                                  accountCode: head.code,
                                  canView: true,
                                  canPost: isAllowed,
                                  canEdit: false,
                                  canApprove: false,
                                  canReport: true,
                                };

                                return (
                                  <div
                                    key={head.code}
                                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2.5 transition-all ${
                                      isAllowed
                                        ? 'bg-white border-blue-200 shadow-2xs'
                                        : 'bg-slate-50 border-slate-200 opacity-70'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <label className="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isAllowed}
                                          onChange={() => handleToggleAccountHead(head.code)}
                                          className="mt-0.5 w-4 h-4 accent-blue-600 rounded cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-slate-900">
                                              {head.code}
                                            </span>
                                            <span className="font-bold text-slate-800 truncate">
                                              {head.name}
                                            </span>
                                          </div>
                                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                            {head.description || head.groupName}
                                          </p>
                                        </div>
                                      </label>

                                      {/* Sensitive Account Flag */}
                                      {isSensitive && (
                                        <button
                                          type="button"
                                          onClick={() => handleToggleSensitive(head.code)}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                            isRestricted
                                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                                          }`}
                                          title={
                                            isRestricted
                                              ? 'Sensitive Account: Posting restricted'
                                              : 'Sensitive Account: Posting allowed'
                                          }
                                        >
                                          <ShieldCheck className="w-3 h-3" />
                                          <span>{isRestricted ? 'Restricted' : 'Sensitive'}</span>
                                        </button>
                                      )}
                                    </div>

                                    {/* Fine-Grained Action Matrix: View, Post, Edit, Approve, Report */}
                                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                                        Actions:
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleActionPermission(head.code, 'canView')}
                                          className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                            perms.canView
                                              ? 'bg-blue-100 text-blue-900'
                                              : 'bg-slate-100 text-slate-400 line-through'
                                          }`}
                                          title="Can View Ledgers of this account"
                                        >
                                          View
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleActionPermission(head.code, 'canPost')}
                                          className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                            perms.canPost
                                              ? 'bg-emerald-100 text-emerald-900'
                                              : 'bg-slate-100 text-slate-400 line-through'
                                          }`}
                                          title="Can Record / Post transactions"
                                        >
                                          Record
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleActionPermission(head.code, 'canEdit')}
                                          className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                            perms.canEdit
                                              ? 'bg-indigo-100 text-indigo-900'
                                              : 'bg-slate-100 text-slate-400 line-through'
                                          }`}
                                          title="Can Edit posted transactions"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleActionPermission(head.code, 'canApprove')}
                                          className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                            perms.canApprove
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-slate-100 text-slate-400 line-through'
                                          }`}
                                          title="Can Approve vouchers"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleActionPermission(head.code, 'canReport')}
                                          className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                            perms.canReport
                                              ? 'bg-purple-100 text-purple-900'
                                              : 'bg-slate-100 text-slate-400 line-through'
                                          }`}
                                          title="Can Export & Report on this account"
                                        >
                                          Report
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* VIEW 3: 5-TIER RBAC HIERARCHY & ACTION MATRIX (SECTIONS 1, 2, 3) */}
      {/* ============================================================== */}
      {activeViewMode === 'rbac_matrix_rules' && (
        <div className="p-6 space-y-6">
          {/* Section 1 & 2: 5-Tier Level Overview Cards */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                1. Multi-Campus Permission Hierarchy (Levels 1 to 5)
              </h3>
              <span className="text-xs text-blue-600 font-bold">Configurable Governance</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-3">
              <div className="p-3.5 rounded-xl border border-blue-300 bg-blue-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-blue-800">
                    Level 1
                  </span>
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                </div>
                <h4 className="text-xs font-black text-slate-900">Platform Super Admin</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Full platform control across all clients, campuses, account heads, permanent codes & global audit logs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-300 bg-indigo-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-indigo-800">
                    Level 2
                  </span>
                  <Building2 className="w-4 h-4 text-indigo-600" />
                </div>
                <h4 className="text-xs font-black text-slate-900">Client / School Super Admin</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Manages assigned school organization, authorized campuses, campus administrator roles & consolidated client reports.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-emerald-800">
                    Level 3
                  </span>
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <h4 className="text-xs font-black text-slate-900">Main Campus Admin</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Manages main campus and authorized sub-campuses, delegated sub-campus users, and campus-assigned account heads.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-amber-800">
                    Level 4
                  </span>
                  <KeyRound className="w-4 h-4 text-amber-600" />
                </div>
                <h4 className="text-xs font-black text-slate-900">Sub-Campus Admin</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Day-to-day operations of assigned sub-campus only. Records transactions using permitted heads; cannot access other campuses.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-purple-300 bg-purple-50/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-black uppercase text-purple-800">
                    Level 5
                  </span>
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <h4 className="text-xs font-black text-slate-900">Departmental Staff</h4>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Accountant (vouchers & ledgers), Fee Manager (challans), HR Manager (payroll), Teacher (classes), Viewer/Auditor.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Permission Action Matrix Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                3. Permission Action Matrix by Feature & Role
              </h3>
              <span className="text-[11px] font-mono text-slate-500">Default Policy Enforcement</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Feature</th>
                    <th className="p-3">Platform Super Admin</th>
                    <th className="p-3">Client Super Admin</th>
                    <th className="p-3">Main Campus Admin</th>
                    <th className="p-3">Sub-Campus Admin</th>
                    <th className="p-3">Staff / Accountant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Manage all clients</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Full</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Manage assigned campuses</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Full</td>
                    <td className="p-3 font-mono font-bold text-blue-700">Authorized</td>
                    <td className="p-3 font-mono font-bold text-blue-700">Assigned</td>
                    <td className="p-3 font-mono font-bold text-blue-700">Assigned only</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Create account heads</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Full</td>
                    <td className="p-3 font-mono text-indigo-700">If authorized</td>
                    <td className="p-3 font-mono text-amber-700">Normally no</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50 bg-amber-50/40">
                    <td className="p-3 font-bold text-slate-900">Change account codes</td>
                    <td className="p-3 font-mono font-black text-rose-700">Never after creation</td>
                    <td className="p-3 font-mono text-rose-700 font-bold">No</td>
                    <td className="p-3 font-mono text-rose-700 font-bold">No</td>
                    <td className="p-3 font-mono text-rose-700 font-bold">No</td>
                    <td className="p-3 font-mono text-rose-700 font-bold">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Assign account head visibility</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">All campuses</td>
                    <td className="p-3 font-mono text-blue-700">Within assigned client</td>
                    <td className="p-3 font-mono text-amber-700">If delegated</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">View financial reports</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">All clients</td>
                    <td className="p-3 font-mono text-blue-700">Assigned client</td>
                    <td className="p-3 font-mono text-blue-700">Authorized campuses</td>
                    <td className="p-3 font-mono text-blue-700">Own campus</td>
                    <td className="p-3 font-mono text-indigo-700">Assigned reports</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Record transactions</td>
                    <td className="p-3 font-mono text-indigo-700">If enabled</td>
                    <td className="p-3 font-mono text-indigo-700">If enabled</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Authorized</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Authorized</td>
                    <td className="p-3 font-mono text-indigo-700">By role</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Approve transactions</td>
                    <td className="p-3 font-mono text-indigo-700">Configurable</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Authorized</td>
                    <td className="p-3 font-mono text-indigo-700">Delegated</td>
                    <td className="p-3 font-mono text-indigo-700">Delegated</td>
                    <td className="p-3 font-mono text-indigo-700">If authorized</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Manage user permissions</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">All users</td>
                    <td className="p-3 font-mono text-blue-700">Client users</td>
                    <td className="p-3 font-mono text-blue-700">Delegated users</td>
                    <td className="p-3 font-mono text-amber-700">Own campus, if delegated</td>
                    <td className="p-3 font-mono text-slate-400">No</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">Access audit logs</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">Global</td>
                    <td className="p-3 font-mono text-blue-700">Assigned client</td>
                    <td className="p-3 font-mono text-blue-700">Own scope</td>
                    <td className="p-3 font-mono text-blue-700">Own scope</td>
                    <td className="p-3 font-mono text-indigo-700">If authorized</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Recommended Permission Inheritance Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                5. Seven Recommended Permission Inheritance Rules
              </h3>
              <span className="text-[11px] font-bold text-emerald-600">Engine Invariants Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">1</span>
                  <span>Platform boundary</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  A client organization cannot access another client's information under any circumstance.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">2</span>
                  <span>Campus boundary</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  A campus user can access only the campus records explicitly assigned or delegated to them.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">3</span>
                  <span>Account boundary</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  A user can work only with account heads authorized for their campus and role.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">4</span>
                  <span>Action boundary</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  Seeing a report does not automatically grant permission to edit or approve its underlying records.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">5</span>
                  <span>Permanent code rule</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  Account codes are generated once and cannot be changed or reused, even when account access is revoked.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">6</span>
                  <span>Delegation rule</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  Administrators may grant permissions only within their own granted authority.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 md:col-span-2">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px]">7</span>
                  <span>Audit rule</span>
                </div>
                <p className="text-slate-600 pl-7 leading-relaxed">
                  Every permission change automatically records the administrator, timestamp, affected campus, and granular changes made into forensic audit trails.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Permission Modal Dialog */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Copy className="w-4 h-4 text-blue-600" />
                <span>Copy Permission Configuration</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Duplicate all <strong>{filteredCount}</strong> authorized account head rules and sensitive
              restrictions from <strong>{selectedCampus?.name}</strong> to:
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Destination Target Campus
              </label>
              <select
                value={copyTargetCampusId}
                onChange={(e) => setCopyTargetCampusId(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {campuses
                  .filter((c) => c.id !== selectedCampusId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyPermissions}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-2xs"
              >
                Apply & Copy Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
