import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  ArrowUpDown,
  Search,
  Filter,
  Server,
  Building2,
  Users,
  CheckCircle2,
  PauseCircle,
  Lock,
  Layers,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import type {
  SchoolInstituteAccount,
  TenantUserRecord,
  TenantCampusNode,
  InstituteAccountStatus,
  PlatformRoleType,
} from './MultiSchoolAdminPanel';
import { useTenantAuth } from '../context/TenantAuthContext';

export interface SortRule {
  column: string;
  direction: 'asc' | 'desc';
}

interface SchoolClientsAndUsersTablesProps {
  mode: 'clients' | 'users';
  institutes: SchoolInstituteAccount[];
  tenantUsers: TenantUserRecord[];
  tenantCampuses: TenantCampusNode[];
  onSwitchInstitute: (inst: SchoolInstituteAccount) => void;
  onSetInstituteStatus: (instId: string, status: InstituteAccountStatus) => void;
  onToggleClientPermission: (
    instId: string,
    permKey: keyof SchoolInstituteAccount['permissions']
  ) => void;
  onBulkUpdateClients: (
    clientIds: string[],
    action:
      | 'ACTIVATE'
      | 'SUSPEND'
      | 'CLOSE'
      | 'ENABLE_ALL_MODULES'
      | 'DISABLE_POSTING'
  ) => void;
  onBulkUpdateUsers: (
    userIds: string[],
    action:
      | 'ACTIVATE'
      | 'SUSPEND'
      | 'GRANT_APPROVAL_RIGHTS'
      | 'REVOKE_WRITE_RIGHTS'
      | 'SET_ROLE_ACCOUNTANT'
  ) => void;
  onCreateTenantUser?: (newUser: Omit<TenantUserRecord, 'id' | 'createdAt'>) => void;
}

function localSortAndFilterClients(
  clients: SchoolInstituteAccount[],
  filters: { search: string; status: string; plan: string; city: string },
  sortRules: SortRule[]
): SchoolInstituteAccount[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    if (filters.status !== 'ALL' && c.status !== filters.status) return false;
    if (filters.plan !== 'ALL' && c.subscriptionPlan !== filters.plan) return false;
    if (
      filters.city !== 'ALL' &&
      String(c.city || '').toLowerCase() !== filters.city.toLowerCase()
    ) {
      return false;
    }
    if (q) {
      const hay = `${c.code} ${c.name} ${c.adminEmail} ${c.ownerContactName} ${c.city}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return [...filtered].sort((a: any, b: any) => {
    for (const rule of sortRules) {
      const dir = rule.direction === 'desc' ? -1 : 1;
      const va = a?.[rule.column];
      const vb = b?.[rule.column];
      if (va === vb) continue;
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return (
        String(va ?? '').localeCompare(String(vb ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * dir
      );
    }
    return 0;
  });
}

function localSortAndFilterUsers(
  users: TenantUserRecord[],
  filters: { search: string; organizationId: string; role: string; status: string },
  sortRules: SortRule[]
): TenantUserRecord[] {
  const q = filters.search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    if (
      filters.organizationId !== 'ALL' &&
      u.organizationId !== filters.organizationId
    ) {
      return false;
    }
    if (filters.role !== 'ALL' && u.role !== filters.role) return false;
    if (filters.status !== 'ALL' && u.status !== filters.status) return false;
    if (q) {
      const hay = `${u.name} ${u.email} ${u.role} ${u.organizationId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return [...filtered].sort((a: any, b: any) => {
    for (const rule of sortRules) {
      const dir = rule.direction === 'desc' ? -1 : 1;
      const va = a?.[rule.column];
      const vb = b?.[rule.column];
      if (va === vb) continue;
      return (
        String(va ?? '').localeCompare(String(vb ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        }) * dir
      );
    }
    return 0;
  });
}

export const SchoolClientsAndUsersTables: React.FC<
  SchoolClientsAndUsersTablesProps
> = ({
  mode,
  institutes,
  tenantUsers,
  tenantCampuses,
  onSwitchInstitute,
  onSetInstituteStatus,
  onToggleClientPermission,
  onBulkUpdateClients,
  onBulkUpdateUsers,
  onCreateTenantUser,
}) => {
  const { organizationId, organizationCode, permissionScope } = useTenantAuth();

  // =========================================================================
  // SCHOOL CLIENTS TABLE STATE (Server-Side Filtering, Multi-Sort, Bulk)
  // =========================================================================
  const [clientSearch, setClientSearch] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('ALL');
  const [clientPlanFilter, setClientPlanFilter] = useState('ALL');
  const [clientCityFilter, setClientCityFilter] = useState('ALL');
  const [clientSortRules, setClientSortRules] = useState<SortRule[]>([
    { column: 'status', direction: 'asc' },
    { column: 'name', direction: 'asc' },
  ]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [queriedClients, setQueriedClients] =
    useState<SchoolInstituteAccount[]>(institutes);
  const [clientQuerySource, setClientQuerySource] = useState<string>(
    'Express Server-Side Multi-Column Query Engine'
  );

  // =========================================================================
  // USERS TABLE STATE (Server-Side Filtering, Multi-Sort, Bulk)
  // =========================================================================
  const [userSearch, setUserSearch] = useState('');
  const [userOrgFilter, setUserOrgFilter] = useState('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [userSortRules, setUserSortRules] = useState<SortRule[]>([
    { column: 'role', direction: 'asc' },
    { column: 'name', direction: 'asc' },
  ]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [queriedUsers, setQueriedUsers] =
    useState<TenantUserRecord[]>(tenantUsers);

  // New user form
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserOrgId, setNewUserOrgId] = useState(
    institutes[0]?.id || 'inst-aplus-main'
  );
  const [newUserRole, setNewUserRole] =
    useState<PlatformRoleType>('school_client_admin');

  // Execute Server-Side Client Query whenever filters/sortRules/institutes change
  useEffect(() => {
    if (mode !== 'clients') return;
    let cancelled = false;
    const filters = {
      search: clientSearch,
      status: clientStatusFilter,
      plan: clientPlanFilter,
      city: clientCityFilter,
    };

    // Instant local preview while server query executes
    setQueriedClients(
      localSortAndFilterClients(institutes, filters, clientSortRules)
    );

    fetch('/api/tenant/admin/query-clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clients: institutes,
        filters,
        sortRules: clientSortRules,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.items)) {
          setQueriedClients(data.items);
          setClientQuerySource(
            data.executedBy || 'Express Server-Side Multi-Column Query Engine'
          );
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    institutes,
    clientSearch,
    clientStatusFilter,
    clientPlanFilter,
    clientCityFilter,
    clientSortRules,
  ]);

  // Execute Server-Side Users Query whenever filters/sortRules/tenantUsers change
  useEffect(() => {
    if (mode !== 'users') return;
    let cancelled = false;
    const filters = {
      search: userSearch,
      organizationId: userOrgFilter,
      role: userRoleFilter,
      status: userStatusFilter,
    };

    setQueriedUsers(
      localSortAndFilterUsers(tenantUsers, filters, userSortRules)
    );

    fetch('/api/tenant/admin/query-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: tenantUsers,
        filters,
        sortRules: userSortRules,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.items)) {
          setQueriedUsers(data.items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    tenantUsers,
    userSearch,
    userOrgFilter,
    userRoleFilter,
    userStatusFilter,
    userSortRules,
  ]);

  // Toggle multi-column sort when clicking a column header (Shift+Click adds secondary sort, regular click sets primary sort)
  const handleToggleColumnSort = (
    column: string,
    shiftKey: boolean,
    isClients: boolean
  ) => {
    const updater = (prev: SortRule[]): SortRule[] => {
      const existingIdx = prev.findIndex((r) => r.column === column);
      if (shiftKey) {
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            column,
            direction: updated[existingIdx].direction === 'asc' ? 'desc' : 'asc',
          };
          return updated;
        }
        const nextArr: SortRule[] = [...prev, { column, direction: 'asc' }];
        return nextArr.slice(0, 3);
      } else {
        if (existingIdx === 0) {
          return [
            {
              column,
              direction: prev[0].direction === 'asc' ? 'desc' : 'asc',
            },
            ...prev.slice(1),
          ];
        }
        return [
          { column, direction: 'asc' as const },
          ...prev.filter((r) => r.column !== column).slice(0, 1),
        ];
      }
    };

    if (isClients) {
      setClientSortRules(updater);
    } else {
      setUserSortRules(updater);
    }
  };

  const getSortBadge = (column: string, rules: SortRule[]) => {
    const idx = rules.findIndex((r) => r.column === column);
    if (idx === -1) return null;
    const dirArrow = rules[idx].direction === 'asc' ? '↑' : '↓';
    return (
      <span className="ml-1 px-1 py-0.2 rounded bg-indigo-100 text-indigo-900 font-mono text-[9px] font-black">
        {idx + 1}
        {dirArrow}
      </span>
    );
  };

  const uniqueCities = useMemo(() => {
    return Array.from(
      new Set(institutes.map((i) => i.city).filter(Boolean))
    ).sort();
  }, [institutes]);

  // =========================================================================
  // RENDER MODE 1: SCHOOL CLIENTS TABLE
  // =========================================================================
  if (mode === 'clients') {
    const allSelected =
      queriedClients.length > 0 &&
      queriedClients.every((c) => selectedClientIds.includes(c.id));

    return (
      <div className="space-y-4 text-xs">
        {/* TenantAuthContext Scope Banner */}
        <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">
              TenantAuthContext Injected Scope:
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold">
              organizationId: {organizationId} ({organizationCode})
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              role: {permissionScope.platformRole}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            <span>{clientQuerySource}</span>
          </div>
        </div>

        {/* Server-Side Filter & Multi-Column Sort Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-300 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Server-Side Search (Name, Org ID, Email, Owner)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Filter school clients on server..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Account Status
              </label>
              <select
                value={clientStatusFilter}
                onChange={(e) => setClientStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Pending">Pending</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Subscription Plan
              </label>
              <select
                value={clientPlanFilter}
                onChange={(e) => setClientPlanFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
              >
                <option value="ALL">All Plans</option>
                <option value="Enterprise Multi-Campus">Enterprise Multi-Campus</option>
                <option value="Standard Institutional">Standard Institutional</option>
                <option value="Starter / Trial">Starter / Trial</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                City Filter
              </label>
              <select
                value={clientCityFilter}
                onChange={(e) => setClientCityFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
              >
                <option value="ALL">All Cities</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Primary + Secondary Sort
              </label>
              <div className="flex items-center gap-1">
                <select
                  value={clientSortRules[0]?.column || 'name'}
                  onChange={(e) =>
                    setClientSortRules([
                      {
                        column: e.target.value,
                        direction: clientSortRules[0]?.direction || 'asc',
                      },
                      clientSortRules[1] || { column: 'code', direction: 'asc' },
                    ])
                  }
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white text-[11px]"
                >
                  <option value="name">1st: Name</option>
                  <option value="code">1st: Org ID</option>
                  <option value="status">1st: Status</option>
                  <option value="monthlyBaseFeePKR">1st: Monthly Fee</option>
                  <option value="city">1st: City</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setClientSortRules([
                      {
                        column: clientSortRules[0]?.column || 'name',
                        direction:
                          clientSortRules[0]?.direction === 'asc' ? 'desc' : 'asc',
                      },
                      ...clientSortRules.slice(1),
                    ])
                  }
                  className="px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-300 font-mono font-black cursor-pointer"
                  title="Toggle Primary Sort Direction"
                >
                  {clientSortRules[0]?.direction === 'asc' ? 'ASC ↑' : 'DESC ↓'}
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-black text-indigo-900">
                {selectedClientIds.length} of {queriedClients.length} School Clients Selected
              </span>
              <span className="text-[11px] text-slate-500">
                Tip: Click any column header to sort; Shift+Click to add a secondary multi-column sort.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={selectedClientIds.length === 0}
                onClick={() => {
                  onBulkUpdateClients(selectedClientIds, 'ACTIVATE');
                  setSelectedClientIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-black cursor-pointer"
              >
                Bulk Activate ({selectedClientIds.length})
              </button>
              <button
                type="button"
                disabled={selectedClientIds.length === 0}
                onClick={() => {
                  onBulkUpdateClients(selectedClientIds, 'SUSPEND');
                  setSelectedClientIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
              >
                Bulk Suspend / Pause
              </button>
              <button
                type="button"
                disabled={selectedClientIds.length === 0}
                onClick={() => {
                  onBulkUpdateClients(selectedClientIds, 'ENABLE_ALL_MODULES');
                  setSelectedClientIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-40 text-white font-black cursor-pointer"
              >
                Bulk Enable All Modules
              </button>
              <button
                type="button"
                disabled={selectedClientIds.length === 0}
                onClick={() => {
                  onBulkUpdateClients(selectedClientIds, 'CLOSE');
                  setSelectedClientIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 disabled:opacity-40 text-white font-black cursor-pointer"
              >
                Bulk Close Access
              </button>
            </div>
          </div>
        </div>

        {/* Refactored School Clients Multi-Sort & Bulk Action Table */}
        <div className="bg-white rounded-2xl border border-slate-300 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 font-black uppercase text-slate-700 border-b border-slate-300">
                <th className="p-2.5 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClientIds(queriedClients.map((c) => c.id));
                      } else {
                        setSelectedClientIds([]);
                      }
                    }}
                    className="cursor-pointer"
                  />
                </th>
                <th
                  onClick={(e) => handleToggleColumnSort('code', e.shiftKey, true)}
                  className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
                >
                  Org ID {getSortBadge('code', clientSortRules)}
                </th>
                <th
                  onClick={(e) => handleToggleColumnSort('name', e.shiftKey, true)}
                  className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
                >
                  School Client & Owner {getSortBadge('name', clientSortRules)}
                </th>
                <th
                  onClick={(e) => handleToggleColumnSort('city', e.shiftKey, true)}
                  className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
                >
                  City & Plan {getSortBadge('city', clientSortRules)}
                </th>
                <th
                  onClick={(e) =>
                    handleToggleColumnSort('monthlyBaseFeePKR', e.shiftKey, true)
                  }
                  className="p-2.5 text-right cursor-pointer hover:bg-slate-200 select-none"
                >
                  Monthly Rate {getSortBadge('monthlyBaseFeePKR', clientSortRules)}
                </th>
                <th
                  onClick={(e) => handleToggleColumnSort('status', e.shiftKey, true)}
                  className="p-2.5 text-center cursor-pointer hover:bg-slate-200 select-none"
                >
                  Status {getSortBadge('status', clientSortRules)}
                </th>
                <th className="p-2.5 text-center">Module Access Matrix</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {queriedClients.map((inst) => {
                const isChecked = selectedClientIds.includes(inst.id);
                const campCount = tenantCampuses.filter(
                  (c) => c.organizationId === inst.id
                ).length;
                return (
                  <tr
                    key={inst.id}
                    className={`border-b border-slate-200 hover:bg-slate-50 ${
                      isChecked ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedClientIds((prev) => [...prev, inst.id]);
                          } else {
                            setSelectedClientIds((prev) =>
                              prev.filter((id) => id !== inst.id)
                            );
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 font-mono font-black text-indigo-950">
                      {inst.code}
                      <div className="text-[10px] text-slate-500">
                        {campCount}/{inst.maxCampusesAllowed} Campuses
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-black text-slate-900">{inst.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {inst.ownerContactName} · {inst.adminEmail}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{inst.city}</div>
                      <div className="text-[10px] text-slate-500">
                        {inst.subscriptionPlan}
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      <div className="font-black text-slate-900">
                        PKR {(inst.monthlyBaseFeePKR ?? 12000).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        + PKR {(inst.monthlyPerCampusFeePKR ?? 4000).toLocaleString()}/camp
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                          inst.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-900'
                            : inst.status === 'Suspended'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}
                      >
                        {inst.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {(
                          [
                            ['allowVoucherPosting', 'Vouchers'],
                            ['allowPettyCash', 'PettyCash'],
                            ['allowModernErp', 'ERP'],
                            ['allowRecurringVouchers', 'Recurring'],
                            ['allowReportExports', 'Reports'],
                          ] as const
                        ).map(([k, lbl]) => {
                          const on = inst.permissions?.[k] !== false;
                          return (
                            <button
                              key={k}
                              type="button"
                              onClick={() => onToggleClientPermission(inst.id, k)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                on
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-400 line-through'
                              }`}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSwitchInstitute(inst)}
                          className="px-2 py-1 rounded bg-slate-900 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Switch View
                        </button>
                        {inst.status !== 'Active' ? (
                          <button
                            type="button"
                            onClick={() => onSetInstituteStatus(inst.id, 'Active')}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onSetInstituteStatus(inst.id, 'Suspended')
                            }
                            className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer"
                          >
                            Suspend
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
      </div>
    );
  }

  // =========================================================================
  // RENDER MODE 2: USERS & RBAC TABLE (Server-Side Filtering, Multi-Sort, Bulk)
  // =========================================================================
  const allUsersSelected =
    queriedUsers.length > 0 &&
    queriedUsers.every((u) => selectedUserIds.includes(u.id));

  return (
    <div className="space-y-4 text-xs">
      {/* Quick Add User Bar */}
      {onCreateTenantUser && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newUserName.trim() || !newUserEmail.trim()) return;
            onCreateTenantUser({
              organizationId: newUserOrgId,
              name: newUserName.trim(),
              email: newUserEmail.trim().toLowerCase(),
              role: newUserRole,
              assignedCampusIds: ['ALL'],
              permissions: {
                view: true,
                create: newUserRole !== 'viewer',
                edit: newUserRole !== 'viewer',
                approve:
                  newUserRole === 'school_client_admin' ||
                  newUserRole === 'campus_admin',
                export: true,
                deactivate: newUserRole === 'school_client_admin',
              },
              status: 'Active',
            });
            setNewUserName('');
            setNewUserEmail('');
          }}
          className="bg-white rounded-2xl border border-slate-300 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end"
        >
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              User Full Name *
            </label>
            <input
              type="text"
              required
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="e.g. Bilal Ahmed"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@school.edu.pk"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Assigned Organization *
            </label>
            <select
              value={newUserOrgId}
              onChange={(e) => setNewUserOrgId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
            >
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.code} — {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              RBAC Role *
            </label>
            <select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value as PlatformRoleType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
            >
              <option value="school_client_admin">School Client Admin</option>
              <option value="campus_admin">Campus Admin</option>
              <option value="principal">Principal</option>
              <option value="accountant">Accountant</option>
              <option value="cashier">Cashier</option>
              <option value="viewer">Viewer / Auditor</option>
            </select>
          </div>
          <div>
            <button
              type="submit"
              className="w-full py-1.5 rounded-xl bg-indigo-600 text-white font-black cursor-pointer"
            >
              + Add Scoped User
            </button>
          </div>
        </form>
      )}

      {/* Server-Side Filter & Multi-Column Sort Bar for Users */}
      <div className="bg-white rounded-2xl border border-slate-300 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Server-Side User Search
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search name, email, role..."
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Filter by Client Organization
            </label>
            <select
              value={userOrgFilter}
              onChange={(e) => setUserOrgFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
            >
              <option value="ALL">All Client Organizations</option>
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.code} — {inst.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Filter by RBAC Role
            </label>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
            >
              <option value="ALL">All Roles</option>
              <option value="platform_super_admin">Platform Super Admin</option>
              <option value="school_client_admin">School Client Admin</option>
              <option value="campus_admin">Campus Admin</option>
              <option value="accountant">Accountant</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Filter by Status
            </label>
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Invited">Invited</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Primary Sort Column
            </label>
            <div className="flex items-center gap-1">
              <select
                value={userSortRules[0]?.column || 'name'}
                onChange={(e) =>
                  setUserSortRules([
                    {
                      column: e.target.value,
                      direction: userSortRules[0]?.direction || 'asc',
                    },
                    ...userSortRules.slice(1),
                  ])
                }
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-bold bg-white"
              >
                <option value="name">Sort: Name</option>
                <option value="email">Sort: Email</option>
                <option value="role">Sort: Role</option>
                <option value="organizationId">Sort: Organization</option>
                <option value="status">Sort: Status</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  setUserSortRules([
                    {
                      column: userSortRules[0]?.column || 'name',
                      direction:
                        userSortRules[0]?.direction === 'asc' ? 'desc' : 'asc',
                    },
                    ...userSortRules.slice(1),
                  ])
                }
                className="px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-300 font-mono font-black cursor-pointer"
              >
                {userSortRules[0]?.direction === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Bulk User Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-black text-indigo-900">
            {selectedUserIds.length} of {queriedUsers.length} Users Selected
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={selectedUserIds.length === 0}
              onClick={() => {
                onBulkUpdateUsers(selectedUserIds, 'ACTIVATE');
                setSelectedUserIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-40 text-white font-black cursor-pointer"
            >
              Bulk Activate Users
            </button>
            <button
              type="button"
              disabled={selectedUserIds.length === 0}
              onClick={() => {
                onBulkUpdateUsers(selectedUserIds, 'SUSPEND');
                setSelectedUserIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 disabled:opacity-40 text-slate-950 font-black cursor-pointer"
            >
              Bulk Suspend Users
            </button>
            <button
              type="button"
              disabled={selectedUserIds.length === 0}
              onClick={() => {
                onBulkUpdateUsers(selectedUserIds, 'GRANT_APPROVAL_RIGHTS');
                setSelectedUserIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-40 text-white font-black cursor-pointer"
            >
              Bulk Grant Approve & Export
            </button>
            <button
              type="button"
              disabled={selectedUserIds.length === 0}
              onClick={() => {
                onBulkUpdateUsers(selectedUserIds, 'REVOKE_WRITE_RIGHTS');
                setSelectedUserIds([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-white font-black cursor-pointer"
            >
              Bulk Set Read-Only
            </button>
          </div>
        </div>
      </div>

      {/* Refactored Users & RBAC Table */}
      <div className="bg-white rounded-2xl border border-slate-300 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 font-black uppercase text-slate-700 border-b border-slate-300">
              <th className="p-2.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={allUsersSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUserIds(queriedUsers.map((u) => u.id));
                    } else {
                      setSelectedUserIds([]);
                    }
                  }}
                  className="cursor-pointer"
                />
              </th>
              <th
                onClick={(e) => handleToggleColumnSort('name', e.shiftKey, false)}
                className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
              >
                User Name {getSortBadge('name', userSortRules)}
              </th>
              <th
                onClick={(e) => handleToggleColumnSort('email', e.shiftKey, false)}
                className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
              >
                Email {getSortBadge('email', userSortRules)}
              </th>
              <th
                onClick={(e) =>
                  handleToggleColumnSort('organizationId', e.shiftKey, false)
                }
                className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
              >
                Organization Scope {getSortBadge('organizationId', userSortRules)}
              </th>
              <th
                onClick={(e) => handleToggleColumnSort('role', e.shiftKey, false)}
                className="p-2.5 text-left cursor-pointer hover:bg-slate-200 select-none"
              >
                Role {getSortBadge('role', userSortRules)}
              </th>
              <th className="p-2.5 text-center">Granular Permissions</th>
              <th
                onClick={(e) => handleToggleColumnSort('status', e.shiftKey, false)}
                className="p-2.5 text-center cursor-pointer hover:bg-slate-200 select-none"
              >
                Status {getSortBadge('status', userSortRules)}
              </th>
            </tr>
          </thead>
          <tbody>
            {queriedUsers.map((u) => {
              const isChecked = selectedUserIds.includes(u.id);
              const org = institutes.find((i) => i.id === u.organizationId);
              return (
                <tr
                  key={u.id}
                  className={`border-b border-slate-200 hover:bg-slate-50 ${
                    isChecked ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <td className="p-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserIds((prev) => [...prev, u.id]);
                        } else {
                          setSelectedUserIds((prev) =>
                            prev.filter((id) => id !== u.id)
                          );
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="p-2.5 font-bold text-slate-900">{u.name}</td>
                  <td className="p-2.5 font-mono text-slate-700">{u.email}</td>
                  <td className="p-2.5 font-bold">
                    [{org?.code || u.organizationId}] {org?.name || ''}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-indigo-800">
                    {u.role}
                  </td>
                  <td className="p-2.5 text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {Object.entries(u.permissions || {}).map(([k, v]) => (
                        <span
                          key={k}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            v
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-400 line-through'
                          }`}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                        u.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
