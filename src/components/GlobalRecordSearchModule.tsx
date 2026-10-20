import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  FileText,
  Building2,
  Users,
  Layers,
  Activity,
  RotateCcw,
  Eye,
  Download,
  Calendar,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag,
  CreditCard,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { getStoredRecycleBinRecords } from '../services/globalRecoveryService';

export const GlobalRecordSearchModule: React.FC = () => {
  const {
    transactions,
    pettyCashTransactions,
    accountHeads,
    campuses,
    users,
    activityLogs,
  } = useAccounting();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityCategory, setSelectedEntityCategory] = useState<string>('all');
  const [selectedCampusId, setSelectedCampusId] = useState<string>('all');
  const [inspectedItem, setInspectedItem] = useState<{ type: string; payload: any } | null>(null);

  const recycleBinRecords = useMemo(() => getStoredRecycleBinRecords(), []);

  // Aggregate multi-source index
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && selectedEntityCategory === 'all' && selectedCampusId === 'all') {
      // return top 20 recent items
      return [];
    }

    const results: Array<{
      id: string;
      category: 'Voucher' | 'PettyCash' | 'AccountHead' | 'Campus' | 'User' | 'RecycleBin' | 'AuditLog';
      identifier: string;
      title: string;
      subtitle: string;
      campusName: string;
      campusId: string;
      dateOrTime: string;
      amount?: number;
      payload: any;
    }> = [];

    // 1. Transactions (GL Vouchers)
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'Voucher') {
      transactions.forEach((tx) => {
        if (selectedCampusId !== 'all' && tx.campusId !== selectedCampusId) return;
        const c = campuses.find((cmp) => cmp.id === tx.campusId);
        const match =
          !q ||
          tx.voucherNo?.toLowerCase().includes(q) ||
          tx.narration?.toLowerCase().includes(q) ||
          tx.chequeNo?.toLowerCase().includes(q) ||
          tx.entries?.some(
            (e) =>
              e.accountName?.toLowerCase().includes(q) ||
              e.accountCode?.toLowerCase().includes(q) ||
              e.description?.toLowerCase().includes(q)
          );

        if (match) {
          results.push({
            id: `tx-${tx.id}`,
            category: 'Voucher',
            identifier: tx.voucherNo,
            title: `${tx.voucherType} - ${tx.narration || 'Journal Voucher'}`,
            subtitle: `${tx.entries?.length || 0} entry lines • Status: ${tx.status}`,
            campusName: c?.name || tx.campusId,
            campusId: tx.campusId,
            dateOrTime: tx.date,
            amount: tx.totalDebit,
            payload: tx,
          });
        }
      });
    }

    // 2. Petty Cash
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'PettyCash') {
      pettyCashTransactions.forEach((pc) => {
        if (selectedCampusId !== 'all' && pc.campusId !== selectedCampusId) return;
        const c = campuses.find((cmp) => cmp.id === pc.campusId);
        const match =
          !q ||
          pc.voucherNo?.toLowerCase().includes(q) ||
          pc.payee?.toLowerCase().includes(q) ||
          pc.narration?.toLowerCase().includes(q) ||
          pc.category?.toLowerCase().includes(q) ||
          pc.receiptNo?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `pc-${pc.id}`,
            category: 'PettyCash',
            identifier: pc.voucherNo,
            title: `${pc.type} to ${pc.payee || 'Payee'}`,
            subtitle: `${pc.category || 'General'} • Receipt: ${pc.receiptNo || 'N/A'}`,
            campusName: c?.name || pc.campusId,
            campusId: pc.campusId,
            dateOrTime: pc.date,
            amount: pc.amount,
            payload: pc,
          });
        }
      });
    }

    // 3. Chart of Accounts Heads
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'AccountHead') {
      accountHeads.forEach((head) => {
        const match =
          !q ||
          head.code?.toLowerCase().includes(q) ||
          head.name?.toLowerCase().includes(q) ||
          head.groupName?.toLowerCase().includes(q) ||
          head.mainAccount?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `head-${head.id}`,
            category: 'AccountHead',
            identifier: head.code,
            title: head.name,
            subtitle: `${head.category} • Group: ${head.groupName} (${head.groupCode})`,
            campusName: 'Global Chart of Accounts',
            campusId: 'all',
            dateOrTime: 'Active Master',
            amount: head.balance,
            payload: head,
          });
        }
      });
    }

    // 4. Campuses
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'Campus') {
      campuses.forEach((cmp) => {
        const match =
          !q ||
          cmp.name?.toLowerCase().includes(q) ||
          cmp.code?.toLowerCase().includes(q) ||
          cmp.city?.toLowerCase().includes(q) ||
          cmp.accountantName?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `cmp-${cmp.id}`,
            category: 'Campus',
            identifier: cmp.code,
            title: cmp.name,
            subtitle: `${cmp.city || 'Punjab'} • Float: PKR ${(cmp.pettyCashFloat || 0).toLocaleString()}`,
            campusName: cmp.name,
            campusId: cmp.id,
            dateOrTime: cmp.status === 'active' ? 'Active' : 'Inactive',
            payload: cmp,
          });
        }
      });
    }

    // 5. Users
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'User') {
      users.forEach((u) => {
        const c = campuses.find((cmp) => cmp.id === u.campusId);
        const match =
          !q ||
          u.name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.role?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `usr-${u.id}`,
            category: 'User',
            identifier: u.username || u.name,
            title: u.name || u.username,
            subtitle: `Role: ${u.role} • Access: ${u.campusAccess || 'Campus'}`,
            campusName: c?.name || 'All Campuses',
            campusId: u.campusId || 'all',
            dateOrTime: u.status || 'Active',
            payload: u,
          });
        }
      });
    }

    // 6. Recycle Bin Records
    if (selectedEntityCategory === 'all' || selectedEntityCategory === 'RecycleBin') {
      recycleBinRecords.forEach((rb) => {
        if (selectedCampusId !== 'all' && rb.campusId !== selectedCampusId) return;
        const match =
          !q ||
          rb.identifier?.toLowerCase().includes(q) ||
          rb.title?.toLowerCase().includes(q) ||
          rb.deletionReason?.toLowerCase().includes(q);

        if (match) {
          results.push({
            id: `rb-${rb.id}`,
            category: 'RecycleBin',
            identifier: rb.identifier,
            title: `[In Recycle Bin] ${rb.title}`,
            subtitle: `Reason: ${rb.deletionReason} • Status: ${rb.status}`,
            campusName: rb.campusName,
            campusId: rb.campusId,
            dateOrTime: rb.deletedAt.slice(0, 10),
            amount: rb.financialImpact?.totalAmount,
            payload: rb,
          });
        }
      });
    }

    return results.slice(0, 80);
  }, [
    searchQuery,
    selectedEntityCategory,
    selectedCampusId,
    transactions,
    pettyCashTransactions,
    accountHeads,
    campuses,
    users,
    recycleBinRecords,
  ]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
            Enterprise Index Engine
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            Real-Time Cross-Campus Query
          </span>
        </div>
        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-400" />
          <span>Global Multi-Campus Record Search & Explorer</span>
        </h3>
        <p className="text-xs text-slate-300 max-w-2xl">
          Search across the entire multi-tenant platform in real time. Query vouchers, petty cash transactions, chart of accounts codes, campus configurations, user accounts, and deleted trash records from a single central terminal.
        </p>
      </div>

      {/* Query Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Search Query Input */}
          <div className="md:col-span-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Voucher #, code, payee, narration, user..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Entity Category Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Entity Category
            </label>
            <select
              value={selectedEntityCategory}
              onChange={(e) => setSelectedEntityCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Entity Categories</option>
              <option value="Voucher">General Ledger Vouchers (BPV, BRV, CPV, CRV, JV)</option>
              <option value="PettyCash">Petty Cash Vouchers & Disbursements</option>
              <option value="AccountHead">Chart of Accounts Heads & Codes</option>
              <option value="Campus">Campuses & Regional Branches</option>
              <option value="User">User Accounts & Credentials</option>
              <option value="RecycleBin">Recycle Bin Soft-Deleted Items</option>
            </select>
          </div>

          {/* Campus Scope Filter */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Campus Scope
            </label>
            <select
              value={selectedCampusId}
              onChange={(e) => setSelectedCampusId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Campuses (Consolidated)</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Search Results ({searchResults.length})
          </span>
          <span className="text-[11px] text-slate-400">
            {searchQuery
              ? `Filtered by query: "${searchQuery}"`
              : 'Enter keywords or choose category filters to search'}
          </span>
        </div>

        {searchResults.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              {searchQuery
                ? 'No records found matching your search criteria.'
                : 'Type any voucher number, account head, payee or keyword above to query all records.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {searchResults.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.category === 'Voucher'
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : item.category === 'PettyCash'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : item.category === 'AccountHead'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : item.category === 'Campus'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : item.category === 'RecycleBin'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}
                  >
                    {item.category === 'Voucher' && <FileText className="w-4 h-4" />}
                    {item.category === 'PettyCash' && <CreditCard className="w-4 h-4" />}
                    {item.category === 'AccountHead' && <Layers className="w-4 h-4" />}
                    {item.category === 'Campus' && <Building2 className="w-4 h-4" />}
                    {item.category === 'User' && <Users className="w-4 h-4" />}
                    {item.category === 'RecycleBin' && <RotateCcw className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white">
                        {item.identifier}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.dateOrTime}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-200 truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.subtitle} • <span className="text-indigo-300">{item.campusName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {item.amount !== undefined && (
                    <span className="font-mono font-bold text-xs text-emerald-400">
                      PKR {item.amount.toLocaleString()}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectedItem({ type: item.category, payload: item.payload })}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                    title="Inspect complete payload"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON / Entity Inspection Modal */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase">
                  {inspectedItem.type} Details
                </span>
                <span className="text-sm font-bold text-white">Record Payload Inspector</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs">
              <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-emerald-300 overflow-x-auto">
                {JSON.stringify(inspectedItem.payload, null, 2)}
              </pre>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
