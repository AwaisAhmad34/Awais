import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Building2,
  CheckSquare,
  Square,
  Search,
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  Tag,
  DollarSign,
  ArrowUpDown,
  Sliders,
} from 'lucide-react';
import { useAccounting, AccountHead } from '../core/aplusEngine';
import type { TenantCampusNode } from './MultiSchoolAdminPanel';

export const CAMPUS_COA_STORAGE_KEY = 'aplus_campus_coa_scoping_v1';

export interface CampusCoaScopingRecord {
  accountId: string;
  isUniversal: boolean; // if true, visible and applicable to all campuses
  assignedCampusIds: string[]; // specific campus IDs if not universal
  campusSpecificNotes?: string;
}

export function getStoredCampusCoaScoping(): Record<string, CampusCoaScopingRecord> {
  try {
    const raw = localStorage.getItem(CAMPUS_COA_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveStoredCampusCoaScoping(
  data: Record<string, CampusCoaScopingRecord>
): void {
  try {
    localStorage.setItem(CAMPUS_COA_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(
      new CustomEvent('aplus-campus-coa-updated', { detail: data })
    );
  } catch {}
}

interface CampusChartOfAccountsManagerProps {
  tenantCampuses?: TenantCampusNode[];
  onTriggerToast?: (msg: string) => void;
}

export const CampusChartOfAccountsManager: React.FC<
  CampusChartOfAccountsManagerProps
> = ({ tenantCampuses = [], onTriggerToast }) => {
  const {
    accountHeads,
    campuses: engineCampuses,
    addAccountHead,
    updateAccountHead,
  } = useAccounting();

  const [scopingMap, setScopingMap] = useState<Record<string, CampusCoaScopingRecord>>(
    () => getStoredCampusCoaScoping()
  );

  const [selectedCampusFilter, setSelectedCampusFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scopeModalAccountId, setScopeModalAccountId] = useState<string | null>(null);

  // Add new account head form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<
    'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  >('Expense');
  const [newIsUniversal, setNewIsUniversal] = useState<boolean>(true);
  const [newAssignedCampuses, setNewAssignedCampuses] = useState<string[]>([]);

  // Effective list of campuses
  const effectiveCampuses = useMemo(() => {
    if (tenantCampuses && tenantCampuses.length > 0) {
      return tenantCampuses.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        loginId: c.campusLoginId,
      }));
    }
    return (engineCampuses || []).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      loginId: `LOGIN-${c.code}`,
    }));
  }, [tenantCampuses, engineCampuses]);

  useEffect(() => {
    const handler = () => setScopingMap(getStoredCampusCoaScoping());
    window.addEventListener('aplus-campus-coa-updated', handler);
    return () => window.removeEventListener('aplus-campus-coa-updated', handler);
  }, []);

  const updateScoping = (
    next: Record<string, CampusCoaScopingRecord>,
    toastMsg?: string
  ) => {
    setScopingMap(next);
    saveStoredCampusCoaScoping(next);
    if (toastMsg && onTriggerToast) {
      onTriggerToast(toastMsg);
    }
  };

  // Helper to check if an account is assigned to a specific campus
  const isAccountRelevantToCampus = (
    accountId: string,
    campusId: string
  ): boolean => {
    if (campusId === 'ALL') return true;
    const record = scopingMap[accountId];
    if (!record || record.isUniversal) return true; // By default universal unless scoped
    return record.assignedCampusIds.includes(campusId);
  };

  // Filtered account heads
  const filteredAccounts = useMemo(() => {
    return (accountHeads || []).filter((acc) => {
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && acc.category !== selectedCategoryFilter) {
        return false;
      }
      // Campus relevance filter
      if (
        selectedCampusFilter !== 'ALL' &&
        !isAccountRelevantToCampus(acc.id, selectedCampusFilter)
      ) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          acc.name.toLowerCase().includes(q) ||
          acc.code.toLowerCase().includes(q) ||
          (acc.ledgerCode && acc.ledgerCode.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [accountHeads, selectedCategoryFilter, selectedCampusFilter, searchQuery, scopingMap]);

  // Account currently being edited in scope modal
  const editingAccount = useMemo(() => {
    return (accountHeads || []).find((a) => a.id === scopeModalAccountId);
  }, [accountHeads, scopeModalAccountId]);

  const editingScopingRecord = useMemo((): CampusCoaScopingRecord => {
    if (!scopeModalAccountId) {
      return { accountId: '', isUniversal: true, assignedCampusIds: [] };
    }
    return (
      scopingMap[scopeModalAccountId] || {
        accountId: scopeModalAccountId,
        isUniversal: true,
        assignedCampusIds: [],
      }
    );
  }, [scopeModalAccountId, scopingMap]);

  // Toggle universal scope for an account
  const handleToggleUniversalScope = (accountId: string, isUniversal: boolean) => {
    const existing = scopingMap[accountId] || {
      accountId,
      isUniversal: true,
      assignedCampusIds: [],
    };
    const next = {
      ...scopingMap,
      [accountId]: {
        ...existing,
        isUniversal,
        assignedCampusIds: isUniversal ? [] : existing.assignedCampusIds,
      },
    };
    updateScoping(
      next,
      isUniversal
        ? 'Account set to Universal (All Campuses).'
        : 'Account scoped to specific campuses only.'
    );
  };

  // Toggle specific campus for an account
  const handleToggleCampusForAccount = (accountId: string, campusId: string) => {
    const existing = scopingMap[accountId] || {
      accountId,
      isUniversal: false,
      assignedCampusIds: [],
    };

    const hasCampus = existing.assignedCampusIds.includes(campusId);
    const updatedCampusIds = hasCampus
      ? existing.assignedCampusIds.filter((id) => id !== campusId)
      : [...existing.assignedCampusIds, campusId];

    const next = {
      ...scopingMap,
      [accountId]: {
        ...existing,
        isUniversal: false,
        assignedCampusIds: updatedCampusIds,
      },
    };

    updateScoping(next);
  };

  // Save new account head with campus scoping
  const handleCreateCampusAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    const accountId = `acc-${Date.now()}`;
    const newHead = {
      id: accountId,
      code: newCode.trim(),
      name: newName.trim(),
      category: newCategory,
      type: newCategory,
      balance: 0,
      mainCode: newCode.slice(0, 3) || '100',
      mainAccount: `${newCategory} Head`,
      groupCode: newCode.slice(0, 5) || '100-1',
      groupName: `${newCategory} Accounts`,
    };

    if (addAccountHead) {
      addAccountHead(newHead);
    }

    // Save scoping
    const next = {
      ...scopingMap,
      [accountId]: {
        accountId,
        isUniversal: newIsUniversal,
        assignedCampusIds: newIsUniversal ? [] : newAssignedCampuses,
      },
    };
    updateScoping(next, `Created campus account "${newName}" (${newCode}).`);

    // Reset form
    setNewCode('');
    setNewName('');
    setNewAssignedCampuses([]);
    setShowAddForm(false);
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-slate-900 p-5 space-y-4 shadow-sm text-xs">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Chart of Accounts Governance
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-300 font-mono font-black text-[10px]">
                Campus Relevance Engine Active
              </span>
            </div>
            <h3 className="font-black text-sm sm:text-base text-slate-900 mt-0.5">
              Manage Chart of Accounts (COA) Scoped to Relevant Campuses
            </h3>
            <p className="text-[11px] text-slate-600">
              Assign and restrict financial account heads to specific campuses (e.g. Campus-Specific Operating Expenses, Campus Petty Cash, Bank Accounts, or Universal Network Accounts).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : '+ Add Campus Account'}</span>
          </button>
        </div>
      </div>

      {/* Add New Account Head Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateCampusAccount}
          className="bg-indigo-50/70 border-2 border-indigo-200 rounded-xl p-4 space-y-3"
        >
          <div className="font-black text-indigo-950 text-xs uppercase flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Create New Account Head & Bind to Relevant Campuses</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Account Code *
              </label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. 500-1-08"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono font-bold bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Account Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Generator Maintenance - Main Campus"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Category *
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-900"
              >
                <option value="Expense">Expense</option>
                <option value="Revenue">Revenue</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
              </select>
            </div>
          </div>

          {/* Campus Relevance Assignment */}
          <div className="bg-white p-3 rounded-xl border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                Campus Relevance Scope:
              </span>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-900">
                <input
                  type="checkbox"
                  checked={newIsUniversal}
                  onChange={(e) => setNewIsUniversal(e.target.checked)}
                />
                <span>Universal (Available to All Campuses)</span>
              </label>
            </div>

            {!newIsUniversal && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Select Applicable Campus(es) for this Account:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {effectiveCampuses.map((camp) => {
                    const isSelected = newAssignedCampuses.includes(camp.id);
                    return (
                      <button
                        key={camp.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNewAssignedCampuses(
                              newAssignedCampuses.filter((id) => id !== camp.id)
                            );
                          } else {
                            setNewAssignedCampuses([...newAssignedCampuses, camp.id]);
                          }
                        }}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-100 border-indigo-400 text-indigo-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        <span className="truncate">
                          [{camp.code}] {camp.name}
                        </span>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer shadow-sm"
            >
              Save & Bind Account
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-end">
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Filter by Campus Relevance:
          </label>
          <select
            value={selectedCampusFilter}
            onChange={(e) => setSelectedCampusFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-900"
          >
            <option value="ALL">🌐 All Campuses (Universal & Scoped)</option>
            {effectiveCampuses.map((c) => (
              <option key={c.id} value={c.id}>
                📍 {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Category Filter:
          </label>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-slate-900"
          >
            <option value="ALL">All Categories ({accountHeads?.length || 0})</option>
            <option value="Expense">Expense</option>
            <option value="Revenue">Revenue</option>
            <option value="Asset">Asset</option>
            <option value="Liability">Liability</option>
            <option value="Equity">Equity</option>
          </select>
        </div>

        <div className="sm:col-span-1 lg:col-span-2">
          <label className="block font-bold text-slate-700 mb-1">
            Search Account Code or Name:
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. 500-1-01, Utility, Tuition, Cash..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 font-medium bg-white text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Account Heads Table with Campus Relevance Badge */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="p-3">Account Code</th>
              <th className="p-3">Account Title / Ledger</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Balance (PKR)</th>
              <th className="p-3">Relevant Campus Scope</th>
              <th className="p-3 text-center">Campus Management</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredAccounts.map((acc) => {
              const scopeRecord = scopingMap[acc.id];
              const isUniversal = !scopeRecord || scopeRecord.isUniversal;
              const assignedCampuses = scopeRecord?.assignedCampusIds || [];

              return (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 font-mono font-black text-slate-900">
                    {acc.code}
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{acc.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {acc.groupName || acc.mainAccount || 'General Ledger'}
                    </div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                        acc.category === 'Expense'
                          ? 'bg-rose-100 text-rose-800'
                          : acc.category === 'Revenue'
                          ? 'bg-emerald-100 text-emerald-800'
                          : acc.category === 'Asset'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {acc.category}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900">
                    PKR {(acc.balance || 0).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {isUniversal ? (
                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-900 text-amber-300">
                        🌐 Universal (All Campuses)
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {assignedCampuses.length > 0 ? (
                          assignedCampuses.map((cid) => {
                            const camp = effectiveCampuses.find((c) => c.id === cid);
                            return (
                              <span
                                key={cid}
                                className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono font-bold text-[9px]"
                              >
                                {camp?.code || cid}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-rose-600 font-bold text-[10px]">
                            ⚠️ No campus assigned
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setScopeModalAccountId(acc.id)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[10px] cursor-pointer"
                    >
                      Manage Scope →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Scope Edit Modal */}
      {scopeModalAccountId && editingAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border-2 border-indigo-600 p-5 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-700">
                  Campus Scoping Matrix
                </span>
                <h4 className="font-black text-sm text-slate-900">
                  Manage Campus Assignment for [{editingAccount.code}] {editingAccount.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setScopeModalAccountId(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">
                    Universal Availability
                  </div>
                  <div className="text-[10px] text-slate-500">
                    If enabled, this account can be used by all campuses across the network.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleUniversalScope(
                      editingAccount.id,
                      !editingScopingRecord.isUniversal
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer ${
                    editingScopingRecord.isUniversal
                      ? 'bg-slate-900 text-amber-300'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {editingScopingRecord.isUniversal ? '✓ Universal' : 'Restricted'}
                </button>
              </div>

              {!editingScopingRecord.isUniversal && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-800 text-[11px]">
                    Assign Specific Campuses Allowed to Use This Account:
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {effectiveCampuses.map((camp) => {
                      const isAssigned =
                        editingScopingRecord.assignedCampusIds.includes(camp.id);
                      return (
                        <button
                          key={camp.id}
                          type="button"
                          onClick={() =>
                            handleToggleCampusForAccount(editingAccount.id, camp.id)
                          }
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isAssigned
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded font-mono font-black text-[10px] bg-slate-900 text-amber-300">
                              {camp.code}
                            </span>
                            <span>{camp.name}</span>
                          </div>
                          {isAssigned ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setScopeModalAccountId(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer"
              >
                Done / Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
