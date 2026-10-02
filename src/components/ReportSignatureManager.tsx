import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  Users,
  Building2,
  FileCheck2,
  CheckCircle2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Sliders,
  Stamp,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import {
  saveSignatureConfigToCloud,
  loadSignatureConfigFromCloud,
} from '../services/firebaseSync';

export type RelevantReportKey =
  | 'all_reports'
  | 'custom_master'
  | 'ledger_register'
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet'
  | 'cash_flow'
  | 'vouchers_pettycash'
  | 'format_2_executive_board'
  | 'format_3_daily_daybook'
  | 'format_4_t_account'
  | 'format_5_10col_worksheet'
  | 'format_6_monthly_matrix'
  | 'format_7_voucher_books'
  | 'format_8_campus_columnar'
  | 'format_9_expense_pettycash'
  | 'format_10_audit_certificate';

export interface SignatoryPersonSlot {
  id: string;
  roleTitle: string; // e.g. "Prepared By", "Checked By", "Approved By"
  personName: string; // e.g. "Accounts Officer", "Campus Principal", or ""
  designation: string; // e.g. "Campus Accountant", "Internal Auditor"
  visible: boolean;
}

export interface ReportSignatureRule {
  enabled: boolean; // If false on a specific report or campus, falls back to parent rule
  personCount: number; // How many persons to display (1 to 8)
  layoutStyle: 'boxed_table' | 'signature_lines';
  includeDateColumn: boolean;
  includeStampBox: boolean;
  persons: SignatoryPersonSlot[];
}

export interface SignatureMasterConfig {
  updatedAt: string;
  // Global rules managed by Super Admin per report key
  globalRules: Record<string, ReportSignatureRule>;
  // Campus-specific rules managed by Super Admin OR Campus Accountant: campusRules[campusId][reportKey]
  campusRules: Record<string, Record<string, ReportSignatureRule>>;
}

export const RELEVANT_REPORT_OPTIONS: {
  key: RelevantReportKey;
  label: string;
  group: string;
}[] = [
  {
    key: 'all_reports',
    label: '★ Default Across All Reports (Master Rule)',
    group: 'Master Default',
  },
  {
    key: 'custom_master',
    label: 'Format 1 · Custom Master Single Report',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'ledger_register',
    label: 'Format 1 · General Ledger & Single Account Ledger',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'trial_balance',
    label: 'Format 1 · Trial Balance Statement (8-Col / 4-Col)',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'income_statement',
    label: 'Format 1 · Income Statement (Profit & Loss)',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'balance_sheet',
    label: 'Format 1 · Balance Sheet (Financial Position)',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'cash_flow',
    label: 'Format 1 · Cash Flow & Multi-Campus Summary',
    group: 'Format 1 (Main Standard)',
  },
  {
    key: 'vouchers_pettycash',
    label: 'Vouchers Report & Printed A4 Vouchers (BPV/BRV/CPV/CRV/JV)',
    group: 'Vouchers & Slips',
  },
  {
    key: 'format_2_executive_board',
    label: 'Format 2 · Executive Board & Trustee Summary',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_3_daily_daybook',
    label: 'Format 3 · Chronological Daily Daybook Scroll',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_4_t_account',
    label: 'Format 4 · T-Account (Horizontal Dr | Cr Split)',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_5_10col_worksheet',
    label: 'Format 5 · 10-Column Statutory Audit Worksheet',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_6_monthly_matrix',
    label: 'Format 6 · Month-Wise Comparative Matrix',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_7_voucher_books',
    label: 'Format 7 · Segregated 5-Voucher Books Register',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_8_campus_columnar',
    label: 'Format 8 · Multi-Campus Columnar Statement',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_9_expense_pettycash',
    label: 'Format 9 · Departmental Expense & Petty Cash',
    group: 'Formats 2 to 10',
  },
  {
    key: 'format_10_audit_certificate',
    label: 'Format 10 · Statutory Audit Certificate',
    group: 'Formats 2 to 10',
  },
];

export function createDefaultPersonsList(): SignatoryPersonSlot[] {
  return [
    {
      id: 'sig-1',
      roleTitle: 'Prepared By',
      personName: 'Accounts Officer',
      designation: 'Campus Accounts',
      visible: true,
    },
    {
      id: 'sig-2',
      roleTitle: 'Checked By',
      personName: '',
      designation: 'Internal Audit',
      visible: true,
    },
    {
      id: 'sig-3',
      roleTitle: 'Verified By',
      personName: '',
      designation: 'Finance Manager',
      visible: true,
    },
    {
      id: 'sig-4',
      roleTitle: 'Recommended By',
      personName: '',
      designation: 'Campus Principal / Head',
      visible: true,
    },
    {
      id: 'sig-5',
      roleTitle: 'Approved By',
      personName: 'Authorized Controller',
      designation: 'Director Finance',
      visible: true,
    },
    {
      id: 'sig-6',
      roleTitle: 'Counter-Signed By',
      personName: '',
      designation: 'Chairman / CEO',
      visible: true,
    },
    {
      id: 'sig-7',
      roleTitle: 'Internal Auditor',
      personName: '',
      designation: 'Audit Committee',
      visible: true,
    },
    {
      id: 'sig-8',
      roleTitle: 'External Auditor',
      personName: '',
      designation: 'Statutory Auditor',
      visible: true,
    },
  ];
}

export function createDefaultSignatureRule(
  enabled = true,
  personCount = 5
): ReportSignatureRule {
  return {
    enabled,
    personCount,
    layoutStyle: 'boxed_table',
    includeDateColumn: true,
    includeStampBox: true,
    persons: createDefaultPersonsList(),
  };
}

const SIGNATURE_STORAGE_KEY = 'aplus_report_signatures_config_v1';

const DEFAULT_MASTER_CONFIG: SignatureMasterConfig = {
  updatedAt: new Date().toISOString(),
  globalRules: {
    all_reports: createDefaultSignatureRule(true, 5),
  },
  campusRules: {},
};

type SigListener = (cfg: SignatureMasterConfig) => void;
const sigListeners = new Set<SigListener>();

export function getStoredSignatureConfig(): SignatureMasterConfig {
  try {
    const raw = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.globalRules) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_MASTER_CONFIG;
}

export function saveStoredSignatureConfig(
  next: SignatureMasterConfig,
  syncCloud = true
) {
  const stamped: SignatureMasterConfig = {
    ...next,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(stamped));
  sigListeners.forEach((fn) => fn(stamped));
  if (syncCloud) {
    saveSignatureConfigToCloud(stamped);
  }
}

export function subscribeSignatureConfig(fn: SigListener) {
  sigListeners.add(fn);
  return () => {
    sigListeners.delete(fn);
  };
}

// Map a docRef from aplusEngine.js (e.g. "FIN-STMT-PL-2026-FINAL") to a RelevantReportKey
export function mapDocRefToReportKey(
  docRef?: string,
  explicitReportKey?: RelevantReportKey
): RelevantReportKey {
  if (explicitReportKey) return explicitReportKey;
  const ref = (docRef || '').toUpperCase();
  if (ref.startsWith('MASTER-')) return 'custom_master';
  if (ref.startsWith('GL-')) return 'ledger_register';
  if (ref.startsWith('TB-')) return 'trial_balance';
  if (ref.includes('FIN-STMT-PL')) return 'income_statement';
  if (ref.includes('FIN-STMT-BS')) return 'balance_sheet';
  if (ref.includes('FIN-STMT-CF') || ref.includes('CAMPUS-SUMMARY')) return 'cash_flow';
  if (ref.includes('VOUCHER')) return 'vouchers_pettycash';
  return 'all_reports';
}

// Resolve the active signature rule for a given (campusId, reportKey)
export function resolveActiveSignatureRule(
  config: SignatureMasterConfig,
  campusId?: string,
  reportKey: RelevantReportKey = 'all_reports'
): { rule: ReportSignatureRule; sourceLabel: string } {
  // 1. Check Campus-Specific Report Rule
  if (campusId && campusId !== 'all' && config.campusRules?.[campusId]) {
    const campusMap = config.campusRules[campusId];
    if (reportKey !== 'all_reports' && campusMap[reportKey]?.enabled) {
      return {
        rule: campusMap[reportKey],
        sourceLabel: `Campus Custom Rule (${reportKey})`,
      };
    }
    if (campusMap.all_reports?.enabled) {
      return {
        rule: campusMap.all_reports,
        sourceLabel: 'Campus Default Signature Rule',
      };
    }
  }

  // 2. Check Super Admin Global Report-Specific Rule
  if (reportKey !== 'all_reports' && config.globalRules?.[reportKey]?.enabled) {
    return {
      rule: config.globalRules[reportKey],
      sourceLabel: `Super Admin Report Rule (${reportKey})`,
    };
  }

  // 3. Fallback to Super Admin Global Master Rule
  return {
    rule: config.globalRules?.all_reports || createDefaultSignatureRule(true, 5),
    sourceLabel: 'Super Admin Global Standard',
  };
}

// DYNAMIC REPORT SIGNATURE BLOCK COMPONENT
// Used by Format 1 (via window.__APLUS_REPORT_SIGNATURES_BLOCK__), Formats 2–10, and Printed Vouchers
export const DynamicReportSignatureBlock: React.FC<{
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  receiptBy?: string;
  postedBy?: string;
  dateText?: string;
  docRef?: string;
  periodText?: string;
  includeStampBox?: boolean;
  campusRef?: string;
  className?: string;
  reportKey?: RelevantReportKey;
  campusIdOverride?: string;
}> = ({
  dateText = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }),
  docRef,
  periodText = 'FY 2026-2027',
  campusRef = 'MAIN',
  className = '',
  reportKey,
  campusIdOverride,
}) => {
  const { currentCampusId, campuses, orgSettings } = useAccounting();
  const [sigConfig, setSigConfig] = useState<SignatureMasterConfig>(() =>
    getStoredSignatureConfig()
  );

  useEffect(() => {
    return subscribeSignatureConfig(setSigConfig);
  }, []);

  const effectiveCampusId = useMemo(() => {
    if (campusIdOverride) return campusIdOverride;
    if (currentCampusId && currentCampusId !== 'all') return currentCampusId;
    if (campusRef) {
      const matched = campuses.find(
        (c) =>
          c.code?.toLowerCase() === campusRef.toLowerCase() ||
          c.name?.toLowerCase() === campusRef.toLowerCase()
      );
      if (matched) return matched.id;
    }
    return currentCampusId || 'all';
  }, [campusIdOverride, currentCampusId, campusRef, campuses]);

  const resolvedKey = mapDocRefToReportKey(docRef, reportKey);
  const { rule } = resolveActiveSignatureRule(
    sigConfig,
    effectiveCampusId,
    resolvedKey
  );

  // Determine active visible persons up to rule.personCount
  const activePersons = useMemo(() => {
    const visibleList = (rule.persons || []).filter((p) => p.visible);
    return visibleList.slice(0, Math.max(0, Math.min(8, rule.personCount)));
  }, [rule]);

  if (rule.personCount === 0 || activePersons.length === 0) {
    return null;
  }

  return (
    <div
      className={`official-report-signatures-block mt-8 break-inside-avoid text-black font-sans ${className}`}
    >
      {rule.layoutStyle === 'boxed_table' ? (
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[320px] overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black text-xs font-sans">
              <thead>
                <tr className="border-b-2 border-black font-bold text-center bg-white text-black">
                  {activePersons.map((p, idx) => (
                    <th
                      key={p.id}
                      className={`${
                        idx < activePersons.length - 1 || rule.includeDateColumn
                          ? 'border-r-2 border-black'
                          : ''
                      } py-1.5 px-2`}
                    >
                      {p.roleTitle}
                    </th>
                  ))}
                  {rule.includeDateColumn && (
                    <th className="py-1.5 px-2">Date</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="text-center h-14 bg-white text-black">
                  {activePersons.map((p, idx) => (
                    <td
                      key={p.id}
                      className={`${
                        idx < activePersons.length - 1 || rule.includeDateColumn
                          ? 'border-r-2 border-black'
                          : ''
                      } py-2 px-2 align-middle`}
                    >
                      {p.personName && (
                        <div className="font-bold text-[11px] text-black leading-tight">
                          {p.personName}
                        </div>
                      )}
                      {p.designation && (
                        <div className="text-[9px] font-semibold text-slate-600 uppercase mt-0.5">
                          {p.designation}
                        </div>
                      )}
                    </td>
                  ))}
                  {rule.includeDateColumn && (
                    <td className="py-2 px-2 font-medium font-mono text-[11px] align-middle">
                      {dateText}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {rule.includeStampBox && (
            <div className="w-36 h-20 border-2 border-black text-center flex flex-col justify-between p-1 bg-white shrink-0">
              <span className="text-[9px] font-bold text-black uppercase tracking-wider">
                Official Stamp
              </span>
              <div className="text-[9px] font-black text-gray-400 uppercase leading-none">
                [ AFFIX SEAL ]
              </div>
              <span className="text-[9px] text-black font-mono">
                Ref: {(campusRef || 'MAIN').slice(0, 12).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="pt-6 border-t-2 border-black">
          <div
            className="grid gap-4 text-center text-[10px] font-bold text-black"
            style={{
              gridTemplateColumns: `repeat(${Math.min(
                activePersons.length + (rule.includeDateColumn ? 1 : 0),
                6
              )}, minmax(110px, 1fr))`,
            }}
          >
            {activePersons.map((p) => (
              <div key={p.id} className="pt-8 border-t border-black">
                {p.personName && (
                  <div className="text-[11px] font-black text-black mb-0.5">
                    {p.personName}
                  </div>
                )}
                <div className="uppercase tracking-wider">{p.roleTitle}</div>
                {p.designation && (
                  <div className="text-[9px] font-normal text-slate-600">
                    {p.designation}
                  </div>
                )}
              </div>
            ))}
            {rule.includeDateColumn && (
              <div className="pt-8 border-t border-black">
                <div className="text-[11px] font-mono font-bold text-black mb-0.5">
                  {dateText}
                </div>
                <div className="uppercase tracking-wider">Date</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between text-[10px] text-gray-700 border-t border-black pt-1.5 font-mono">
        <div>
          <span>
            {orgSettings?.schoolName || 'A+ School System'} · Authorized Signatories:{' '}
            <strong>{activePersons.length} Person(s)</strong>
          </span>
          {docRef && <span> · Doc Ref: {docRef}</span>}
        </div>
        <div>
          <span>Period: {periodText}</span>
        </div>
      </div>
    </div>
  );
};

// INTERACTIVE SUPER ADMIN & CAMPUS SIGNATURE CONFIGURATION PANEL
export const ReportSignatureConfigPanel: React.FC<{
  activeFormatKey?: RelevantReportKey;
}> = ({ activeFormatKey = 'all_reports' }) => {
  const {
    campuses,
    currentCampusId,
    currentUser,
    isSuperAdmin,
  } = useAccounting();

  const [config, setConfig] = useState<SignatureMasterConfig>(() =>
    getStoredSignatureConfig()
  );
  const [isOpen, setIsOpen] = useState(false);

  // Scope: 'global' (Super Admin default) or a specific campusId
  const [selectedScope, setSelectedScope] = useState<string>(() => {
    if (!isSuperAdmin && currentUser?.campusId) return currentUser.campusId;
    return currentCampusId !== 'all' ? currentCampusId : 'global';
  });

  const [selectedReportKey, setSelectedReportKey] =
    useState<RelevantReportKey>(activeFormatKey);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeSignatureConfig(setConfig);
    loadSignatureConfigFromCloud().then((cloudCfg) => {
      if (cloudCfg && cloudCfg.globalRules) {
        saveStoredSignatureConfig(cloudCfg, false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeFormatKey) {
      setSelectedReportKey(activeFormatKey);
    }
  }, [activeFormatKey]);

  // Retrieve current rule being edited
  const currentRule: ReportSignatureRule = useMemo(() => {
    if (selectedScope === 'global') {
      return (
        config.globalRules?.[selectedReportKey] ||
        createDefaultSignatureRule(selectedReportKey === 'all_reports', 5)
      );
    }
    const campusMap = config.campusRules?.[selectedScope] || {};
    return (
      campusMap[selectedReportKey] ||
      createDefaultSignatureRule(false, 5)
    );
  }, [config, selectedScope, selectedReportKey]);

  const updateCurrentRule = (updater: (prev: ReportSignatureRule) => ReportSignatureRule) => {
    const nextRule = updater({
      ...currentRule,
      persons: (currentRule.persons || createDefaultPersonsList()).map((p) => ({ ...p })),
    });

    const nextConfig: SignatureMasterConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      globalRules: { ...(config.globalRules || {}) },
      campusRules: { ...(config.campusRules || {}) },
    };

    if (selectedScope === 'global') {
      nextConfig.globalRules[selectedReportKey] = {
        ...nextRule,
        enabled:
          selectedReportKey === 'all_reports' ? true : nextRule.enabled,
      };
    } else {
      nextConfig.campusRules[selectedScope] = {
        ...(nextConfig.campusRules[selectedScope] || {}),
        [selectedReportKey]: nextRule,
      };
    }

    saveStoredSignatureConfig(nextConfig, true);
    setSavedNotice(
      `Saved signature rule (${nextRule.personCount} Person${
        nextRule.personCount === 1 ? '' : 's'
      }) for ${
        selectedScope === 'global'
          ? 'Super Admin Global Standard'
          : campuses.find((c) => c.id === selectedScope)?.name || 'Campus'
      }!`
    );
    setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleSetPersonCount = (count: number) => {
    updateCurrentRule((prev) => {
      const persons = [...(prev.persons || createDefaultPersonsList())];
      // Ensure at least `count` persons are marked visible
      let visibleSoFar = 0;
      const updatedPersons = persons.map((p) => {
        if (p.visible) visibleSoFar++;
        return p;
      });
      if (visibleSoFar < count) {
        for (let i = 0; i < updatedPersons.length && visibleSoFar < count; i++) {
          if (!updatedPersons[i].visible) {
            updatedPersons[i].visible = true;
            visibleSoFar++;
          }
        }
      }
      return {
        ...prev,
        enabled: true,
        personCount: count,
        persons: updatedPersons,
      };
    });
  };

  const handleUpdatePersonField = (
    personId: string,
    field: 'roleTitle' | 'personName' | 'designation' | 'visible',
    value: any
  ) => {
    updateCurrentRule((prev) => ({
      ...prev,
      enabled: true,
      persons: prev.persons.map((p) =>
        p.id === personId ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleAddCustomPersonSlot = () => {
    updateCurrentRule((prev) => {
      if (prev.persons.length >= 8) return prev;
      const nextNum = prev.persons.length + 1;
      const nextPersons = [
        ...prev.persons,
        {
          id: `sig-${Date.now()}`,
          roleTitle: `Signatory #${nextNum}`,
          personName: '',
          designation: 'Authorized Officer',
          visible: true,
        },
      ];
      return {
        ...prev,
        enabled: true,
        personCount: Math.min(8, prev.personCount + 1),
        persons: nextPersons,
      };
    });
  };

  // Resolve what is currently active on the page right now
  const effectiveResolved = useMemo(
    () =>
      resolveActiveSignatureRule(
        config,
        selectedScope === 'global' ? currentCampusId : selectedScope,
        selectedReportKey
      ),
    [config, selectedScope, currentCampusId, selectedReportKey]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:hidden">
      {/* Compact Header Bar */}
      <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              <span>Super Admin & Campus Signature Controller</span>
              <span>·</span>
              <span>
                Showing{' '}
                <strong className="text-white">
                  {effectiveResolved.rule.personCount} Person(s)
                </strong>{' '}
                on Relevant Report ({effectiveResolved.sourceLabel})
              </span>
            </div>
            <h3 className="text-sm font-black text-white">
              Manage How Many Persons (1–8 Signatories), Titles & Names Appear on Each Report & Campus
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick 1-Click Person Count Selector Pills directly in header */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <span className="text-[10px] font-bold text-slate-400 px-2">
              Persons on Report:
            </span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
              const isCurrent = effectiveResolved.rule.personCount === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSetPersonCount(num)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-black transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={`Show ${num} signatory person(s) on the selected report`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isOpen ? 'Close Signature Manager' : 'Customize Signatory Persons & Campus Rules'}</span>
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{savedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedNotice(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {isOpen && (
        <div className="p-5 space-y-5 bg-slate-50/60">
          {/* Step 1: Select Authority Scope (Super Admin Global vs Campus-Specific) & Relevant Report */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200">
            {/* Authority Scope Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                1. Authority Scope (Super Admin or Campus)
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
                <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <select
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {isSuperAdmin && (
                    <option value="global">
                      ★ Super Admin Global Standard (All Campuses Default)
                    </option>
                  )}
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Campus Rule: {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {selectedScope === 'global'
                  ? 'Sets the institution-wide signature count and titles across all campuses.'
                  : 'Overrides signature count and officer names specifically for this campus branch.'}
              </p>
            </div>

            {/* Relevant Report Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                2. Relevant Report / Format
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
                <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <select
                  value={selectedReportKey}
                  onChange={(e) =>
                    setSelectedReportKey(e.target.value as RelevantReportKey)
                  }
                  className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                >
                  {RELEVANT_REPORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Configure a master default for all reports or customize a specific report format.
              </p>
            </div>

            {/* Number of Persons (1–8) & Layout Style */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                3. How Many Persons Shown on Report (0 to 8)
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSetPersonCount(cnt)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border transition-all cursor-pointer ${
                      currentRule.personCount === cnt && currentRule.enabled
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {cnt === 0 ? 'None (0)' : `${cnt}P`}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-700">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRule.includeDateColumn}
                    onChange={(e) =>
                      updateCurrentRule((r) => ({
                        ...r,
                        enabled: true,
                        includeDateColumn: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Show Date Column</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRule.includeStampBox}
                    onChange={(e) =>
                      updateCurrentRule((r) => ({
                        ...r,
                        enabled: true,
                        includeStampBox: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Show Official Stamp Box</span>
                </label>

                <select
                  value={currentRule.layoutStyle}
                  onChange={(e) =>
                    updateCurrentRule((r) => ({
                      ...r,
                      enabled: true,
                      layoutStyle: e.target.value as any,
                    }))
                  }
                  className="px-2 py-1 rounded border border-slate-300 text-[11px] font-bold bg-white"
                >
                  <option value="boxed_table">Boxed Grid Table (Standard)</option>
                  <option value="signature_lines">Classic Signature Lines</option>
                </select>
              </div>
            </div>
          </div>

          {/* Override Activation Banner for Campus or Specific Report */}
          {(selectedScope !== 'global' || selectedReportKey !== 'all_reports') && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950">
              <div className="font-semibold">
                Custom Rule Status for{' '}
                <strong>
                  {selectedScope === 'global'
                    ? 'Super Admin'
                    : campuses.find((c) => c.id === selectedScope)?.name || 'Campus'}
                </strong>{' '}
                on{' '}
                <strong>
                  {RELEVANT_REPORT_OPTIONS.find((o) => o.key === selectedReportKey)?.label}
                </strong>
                :{' '}
                <span
                  className={`font-black uppercase ${
                    currentRule.enabled ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {currentRule.enabled
                    ? `Active (${currentRule.personCount} Persons)`
                    : 'Using Inherited Default Rule'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateCurrentRule((r) => ({ ...r, enabled: !r.enabled }))
                  }
                  className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                    currentRule.enabled
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {currentRule.enabled
                    ? 'Disable Custom Rule (Use Default)'
                    : 'Enable Custom Rule for This Scope'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Edit Signatory Persons (1 to 8) */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Signatory Persons List — Showing First {currentRule.personCount} Visible Person(s) on Relevant Report
                </h4>
                <p className="text-[11px] text-slate-500">
                  Customize each person&apos;s Column Header (e.g., Prepared By, Principal, Approved By), Officer Name, and Designation.
                </p>
              </div>

              {currentRule.persons.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddCustomPersonSlot}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Signatory Person</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentRule.persons.map((person, index) => {
                const visiblePersonsBefore = currentRule.persons
                  .slice(0, index)
                  .filter((p) => p.visible).length;
                const isShownOnReport =
                  person.visible && visiblePersonsBefore < currentRule.personCount;

                return (
                  <div
                    key={person.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      isShownOnReport
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isShownOnReport
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        Person #{index + 1} · {isShownOnReport ? 'SHOWN ON REPORT' : 'HIDDEN'}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdatePersonField(
                            person.id,
                            'visible',
                            !person.visible
                          )
                        }
                        className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                        title="Toggle whether this person is included"
                      >
                        {person.visible ? (
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">
                        Column Header / Role
                      </label>
                      <input
                        type="text"
                        value={person.roleTitle}
                        onChange={(e) =>
                          handleUpdatePersonField(
                            person.id,
                            'roleTitle',
                            e.target.value
                          )
                        }
                        placeholder="e.g. Prepared By"
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">
                        Person Name (Optional)
                      </label>
                      <input
                        type="text"
                        value={person.personName}
                        onChange={(e) =>
                          handleUpdatePersonField(
                            person.id,
                            'personName',
                            e.target.value
                          )
                        }
                        placeholder="Leave blank for manual signature..."
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">
                        Designation / Stamp Title
                      </label>
                      <input
                        type="text"
                        value={person.designation}
                        onChange={(e) =>
                          handleUpdatePersonField(
                            person.id,
                            'designation',
                            e.target.value
                          )
                        }
                        placeholder="e.g. Campus Principal"
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] text-slate-700"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Preview of how the Signature Block looks on the selected Report */}
          <div className="bg-white rounded-xl border border-slate-300 p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
              Live Report Signature Preview ({effectiveResolved.rule.personCount} Signatory Person(s))
            </div>
            <DynamicReportSignatureBlock
              reportKey={selectedReportKey}
              campusIdOverride={
                selectedScope === 'global' ? currentCampusId : selectedScope
              }
              docRef={`PREVIEW-${selectedReportKey.toUpperCase()}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
