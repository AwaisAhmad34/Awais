import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Zap,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  ArrowRight,
  Sparkles,
  Command,
  X,
  ExternalLink,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import {
  useAccounting,
  Transaction,
  Campus,
  AccountHead,
} from '../core/aplusEngine';

interface SmartCommandBarProps {
  onNavigate?: (tab: string) => void;
  onOpenExpressVoucher?: () => void;
  onOpenExpressPettyCash?: () => void;
  onSelectVoucher?: (voucher: Transaction) => void;
  className?: string;
}

export const SmartCommandBar: React.FC<SmartCommandBarProps> = ({
  onNavigate,
  onOpenExpressVoucher,
  onOpenExpressPettyCash,
  onSelectVoucher,
  className = '',
}) => {
  const {
    transactions,
    campuses,
    currentCampusId,
    setCurrentCampusId,
    accountHeads,
    pettyCashTransactions,
    currentUser,
  } = useAccounting();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut: Ctrl+K or Cmd+K to focus command bar, or custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    const handleCustomOpen = () => {
      inputRef.current?.focus();
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('aplus-open-smart-command', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('aplus-open-smart-command', handleCustomOpen);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Parse natural language query
  const parsedResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        vouchers: (transactions || []).slice(0, 4),
        campuses: [],
        dateFilters: [],
        actions: [
          {
            id: 'act-express-voucher',
            type: 'action',
            title: '⚡ Create Express Voucher (Overlay)',
            description: 'Fast double-entry data entry with prefilled campus defaults',
            action: () => onOpenExpressVoucher?.(),
          },
          {
            id: 'act-petty-cash',
            type: 'action',
            title: '💵 Record Petty Cash Expense',
            description: 'Instant imprest disbursement without reloading page',
            action: () => onOpenExpressPettyCash?.(),
          },
          {
            id: 'act-all-vouchers',
            type: 'action',
            title: '📋 Open Voucher Audit & Ledger Table',
            description: 'View and filter all historical vouchers across campuses',
            action: () => onNavigate?.('alltransactions'),
          },
        ],
      };
    }

    // 1. Matched Campuses
    const matchedCampuses = campuses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city && c.city.toLowerCase().includes(q))
    );

    // 2. Date expression detection
    const dateFilters: { label: string; dateQuery: string; description: string }[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const currentMonthPrefix = todayStr.slice(0, 7);

    if (q.includes('today')) {
      dateFilters.push({
        label: `Filter by Date: Today (${todayStr})`,
        dateQuery: todayStr,
        description: `Show all vouchers posted on ${todayStr}`,
      });
    }
    if (q.includes('yesterday')) {
      dateFilters.push({
        label: `Filter by Date: Yesterday (${yesterday})`,
        dateQuery: yesterday,
        description: `Show all vouchers posted on ${yesterday}`,
      });
    }
    if (q.includes('month') || q.includes('this month')) {
      dateFilters.push({
        label: `Filter by Date: Current Month (${currentMonthPrefix})`,
        dateQuery: currentMonthPrefix,
        description: `Show all transactions in ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      });
    }

    // 3. Matched Vouchers (ID, voucher number, narration, chequeNo, type, amounts)
    const matchedVouchers = (transactions || []).filter((tx) => {
      const vNo = (tx.voucherNo || '').toLowerCase();
      const vType = (tx.voucherType || '').toLowerCase();
      const narration = (tx.narration || '').toLowerCase();
      const cheque = (tx.chequeNo || '').toLowerCase();
      const amount = String(tx.totalDebit || '');

      return (
        vNo.includes(q) ||
        vType.includes(q) ||
        narration.includes(q) ||
        cheque.includes(q) ||
        amount.includes(q) ||
        (tx.id && tx.id.toLowerCase().includes(q))
      );
    });

    // 4. Quick Actions based on query
    const actions: any[] = [];
    if (q.includes('voucher') || q.includes('new') || q.includes('create') || q.includes('express')) {
      actions.push({
        id: 'act-express-voucher',
        type: 'action',
        title: '⚡ Open Express Voucher Overlay',
        description: 'Rapid data entry modal with prefilled defaults',
        action: () => onOpenExpressVoucher?.(),
      });
    }
    if (q.includes('petty') || q.includes('cash') || q.includes('float')) {
      actions.push({
        id: 'act-petty-cash',
        type: 'action',
        title: '💵 Record Petty Cash Expense',
        description: 'Instant imprest disbursement without reloading page',
        action: () => onOpenExpressPettyCash?.(),
      });
    }
    if (q.includes('report') || q.includes('trial') || q.includes('balance') || q.includes('ledger')) {
      actions.push({
        id: 'act-reports',
        type: 'action',
        title: '📊 Open Multi-Format Financial Reports Suite',
        description: '8-Column Trial Balance, General Ledgers & Financial Position',
        action: () => onNavigate?.('reports'),
      });
    }

    return {
      vouchers: matchedVouchers.slice(0, 8),
      campuses: matchedCampuses.slice(0, 4),
      dateFilters,
      actions,
    };
  }, [query, transactions, campuses, onOpenExpressVoucher, onOpenExpressPettyCash, onNavigate]);

  const flatList = useMemo(() => {
    const list: any[] = [];
    parsedResults.vouchers.forEach((v) => list.push({ type: 'voucher', item: v }));
    parsedResults.campuses.forEach((c) => list.push({ type: 'campus', item: c }));
    parsedResults.dateFilters.forEach((d) => list.push({ type: 'date', item: d }));
    parsedResults.actions.forEach((a) => list.push({ type: 'action', item: a }));
    return list;
  }, [parsedResults]);

  const handleSelect = (entry: any) => {
    setIsOpen(false);
    if (!entry) return;

    if (entry.type === 'voucher') {
      onSelectVoucher?.(entry.item);
    } else if (entry.type === 'campus') {
      if (setCurrentCampusId) {
        setCurrentCampusId(entry.item.id);
      }
      onNavigate?.('alltransactions');
    } else if (entry.type === 'date') {
      onNavigate?.('alltransactions');
    } else if (entry.type === 'action') {
      entry.item.action?.();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, flatList.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatList.length) % Math.max(1, flatList.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatList[selectedIndex]) {
        handleSelect(flatList[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative max-w-xl w-full min-w-0 ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center">
          <Search className="w-3.5 h-3.5 text-amber-400" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onKeyDown={handleInputKeyDown}
          placeholder='Smart Search: voucher # (CPV-001), campus name ("khiali"), date ("today")...'
          className="w-full bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-900 text-white placeholder:text-slate-400 text-xs font-medium pl-9 pr-20 py-1.5 rounded-xl border border-slate-700/80 focus:border-amber-400/80 focus:ring-2 focus:ring-amber-400/20 focus:outline-hidden transition-all shadow-inner"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[9px] text-amber-300 shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </div>
      </div>

      {/* Smart Command Dropdown Results Palette */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 text-xs max-h-96 flex flex-col backdrop-blur-md animate-in fade-in duration-100">
          <div className="p-2 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 bg-slate-950/60 px-3 font-mono">
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Sparkles className="w-3 h-3" /> Smart Command Results
            </span>
            <span>Use ↑↓ to navigate • Enter to jump</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 p-1.5">
            {flatList.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs space-y-1">
                <p>No matching vouchers, campuses, or commands found for &ldquo;{query}&rdquo;.</p>
                <p className="text-[11px] text-slate-500">
                  Try searching by voucher number like &ldquo;CPV-001&rdquo;, or &ldquo;khiali&rdquo;, or &ldquo;today&rdquo;.
                </p>
              </div>
            ) : (
              flatList.map((entry, idx) => {
                const isSelected = idx === selectedIndex;

                if (entry.type === 'voucher') {
                  const tx = entry.item;
                  const cObj = campuses.find((c) => c.id === tx.campusId);
                  return (
                    <button
                      key={`v-${tx.id}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-black text-[10px] ${
                            isSelected ? 'bg-white text-indigo-950' : 'bg-indigo-950 border border-indigo-700 text-indigo-300'
                          }`}
                        >
                          {tx.voucherNo}
                        </span>
                        <div className="truncate">
                          <div className="font-bold truncate text-xs">{tx.narration || `${tx.voucherType} Entry`}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {tx.date} • {cObj?.name || tx.campusId} • {tx.voucherType}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs block">
                          Rs. {Number(tx.totalDebit || 0).toLocaleString('en-PK')}
                        </span>
                        <span className={`text-[9px] ${isSelected ? 'text-indigo-200' : 'text-emerald-400'}`}>
                          Jump &rarr;
                        </span>
                      </div>
                    </button>
                  );
                }

                if (entry.type === 'campus') {
                  const c = entry.item;
                  return (
                    <button
                      key={`c-${c.id}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-400'}`}>
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">Switch & Filter to {c.name} ({c.code})</div>
                          <div className={`text-[10px] ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                            Subordinate campus branch • City: {c.city || 'Punjab'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-black">Filter Campus</span>
                    </button>
                  );
                }

                if (entry.type === 'date') {
                  const d = entry.item;
                  return (
                    <button
                      key={`d-${d.label}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white text-emerald-700' : 'bg-slate-800 text-emerald-400'}`}>
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">{d.label}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {d.description}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-black">Apply Filter</span>
                    </button>
                  );
                }

                if (entry.type === 'action') {
                  const act = entry.item;
                  return (
                    <button
                      key={`a-${act.id}`}
                      type="button"
                      onClick={() => handleSelect(entry)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected ? 'bg-purple-600 text-white font-bold' : 'hover:bg-slate-800/80 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white text-purple-700' : 'bg-slate-800 text-purple-400'}`}>
                          <Zap className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <div>
                          <div className="font-bold text-xs">{act.title}</div>
                          <div className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                            {act.description}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  );
                }

                return null;
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
