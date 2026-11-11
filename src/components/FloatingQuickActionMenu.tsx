import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Wallet,
  Search,
  BarChart3,
  PanelLeftOpen,
  PanelLeftClose,
  X,
  Coins,
  FileText,
  Building2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { ExpressVoucherModal } from './ExpressVoucherModal';
import { ExpressPettyCashModal } from './ExpressPettyCashModal';

interface FloatingQuickActionMenuProps {
  isSidebarMinimized: boolean;
  onToggleSidebar?: () => void;
  onOpenSmartSearch?: () => void;
}

export const FloatingQuickActionMenu: React.FC<FloatingQuickActionMenuProps> = ({
  isSidebarMinimized,
  onToggleSidebar,
  onOpenSmartSearch,
}) => {
  const {
    campuses,
    currentCampusId,
    transactions,
    pettyCashTransactions,
    accountHeads,
    currentUser,
  } = useAccounting();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExpressVoucherOpen, setIsExpressVoucherOpen] = useState(false);
  const [isExpressPettyCashOpen, setIsExpressPettyCashOpen] = useState(false);
  const [showSnapshotCard, setShowSnapshotCard] = useState(false);

  // Keyboard shortcut Alt+Q to toggle quick action menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        setIsMenuOpen((prev) => !prev);
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsExpressVoucherOpen(true);
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsExpressPettyCashOpen(true);
      } else if (e.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Active campus calculations
  const campus = campuses.find((c) => c.id === currentCampusId) || campuses[0];
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayVouchers = (transactions || []).filter(
    (tx) => tx.date === todayStr && (currentCampusId === 'all' || tx.campusId === currentCampusId)
  );
  const todayVolume = todayVouchers.reduce((sum, tx) => sum + Number(tx.totalDebit || 0), 0);

  const cashInHandHead = accountHeads.find((a) => a.code === '100-4-01');
  const availablePettyCash = Number(campus?.currentPettyCash || campus?.pettyCashFloat || 25000);

  // If sidebar is NOT minimized, we can still render if opened or keep minimal, but the prompt says:
  // "Create a floating 'Quick Action' menu button that appears when the sidebar is minimized, allowing immediate access to common actions like 'New Voucher' or 'Record Petty Cash' without expanding the full navigation."
  if (!isSidebarMinimized) {
    return (
      <>
        <ExpressVoucherModal
          isOpen={isExpressVoucherOpen}
          onClose={() => setIsExpressVoucherOpen(false)}
        />
        <ExpressPettyCashModal
          isOpen={isExpressPettyCashOpen}
          onClose={() => setIsExpressPettyCashOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      {/* Floating Speed-Dial Container pinned at bottom-left */}
      <div className="fixed bottom-5 left-5 z-50 print:hidden flex flex-col items-start gap-2.5">
        {/* Expanded Speed-Dial Action Fan */}
        {isMenuOpen && (
          <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-700/80 rounded-2xl p-2.5 shadow-2xl w-64 space-y-1.5 text-white animate-in slide-in-from-bottom-3 fade-in duration-150">
            <div className="px-2 py-1 flex items-center justify-between border-b border-slate-800 text-[10px] text-indigo-300 font-mono">
              <span className="flex items-center gap-1 font-bold text-white">
                <Sparkles className="w-3 h-3 text-amber-400" /> Quick Actions
              </span>
              <span>Alt+Q</span>
            </div>

            {/* Action 1: Express Voucher Overlay */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsExpressVoucherOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-900/80 to-purple-900/80 hover:from-indigo-600 hover:to-purple-600 border border-indigo-500/40 text-white font-bold text-xs flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs group"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-amber-400 text-slate-950 font-black">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <div>
                  <div className="leading-tight">Express Voucher</div>
                  <div className="text-[10px] text-indigo-200 font-normal">
                    Pre-filled campus defaults
                  </div>
                </div>
              </div>
              <kbd className="text-[9px] font-mono bg-slate-950/60 px-1.5 py-0.5 rounded text-amber-300">
                Alt+N
              </kbd>
            </button>

            {/* Action 2: Record Petty Cash */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                setIsExpressPettyCashOpen(true);
              }}
              className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-emerald-700 border border-slate-700 hover:border-emerald-500 text-slate-100 hover:text-white font-bold text-xs flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-emerald-500 text-white">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Record Petty Cash</div>
                  <div className="text-[10px] text-slate-400 group-hover:text-emerald-100 font-normal">
                    Imprest float expense slip
                  </div>
                </div>
              </div>
              <kbd className="text-[9px] font-mono bg-slate-950/60 px-1.5 py-0.5 rounded text-emerald-300">
                Alt+P
              </kbd>
            </button>

            {/* Action 3: Smart Command Search Trigger */}
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenSmartSearch?.();
              }}
              className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-between gap-2 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-slate-700 text-amber-400">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Smart Search / Jump</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Find voucher by ID/date
                  </div>
                </div>
              </div>
              <kbd className="text-[9px] font-mono bg-slate-950/60 px-1.5 py-0.5 rounded text-slate-400">
                Ctrl+K
              </kbd>
            </button>

            {/* Action 4: Quick Campus Balance Mini-Snapshot */}
            <button
              type="button"
              onClick={() => setShowSnapshotCard((prev) => !prev)}
              className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-between gap-2 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-lg bg-slate-700 text-cyan-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="leading-tight">Campus Quick Snapshot</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Today&apos;s float &amp; volume
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                {showSnapshotCard ? 'Hide' : 'View'}
              </span>
            </button>

            {/* Snapshot Mini-Card */}
            {showSnapshotCard && (
              <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-indigo-400" />
                    {campus?.name || 'Active Campus'}
                  </span>
                  <span className="font-mono text-indigo-300 text-[10px]">{campus?.code}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Today&apos;s Vouchers:</span>
                  <strong className="text-white font-mono">
                    {todayVouchers.length} (Rs. {todayVolume.toLocaleString('en-PK')})
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Petty Cash Float:</span>
                  <strong className="text-emerald-400 font-mono">
                    Rs. {availablePettyCash.toLocaleString('en-PK')}
                  </strong>
                </div>
              </div>
            )}

            {/* Action 5: Restore / Expand Sidebar Navigation */}
            {onToggleSidebar && (
              <div className="pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleSidebar();
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-semibold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <PanelLeftOpen className="w-3 h-3 text-indigo-400" />
                    <span>Expand Full Sidebar</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Toggle</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Floating Quick Action Trigger Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-2xl transition-all cursor-pointer backdrop-blur-md border ${
              isMenuOpen
                ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/30 shadow-indigo-600/30'
                : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 hover:from-slate-800 hover:via-indigo-900 hover:to-purple-900 text-white border-indigo-500/50 hover:border-indigo-400 shadow-xl'
            }`}
            title="Quick Action Menu (Sidebar Minimized) — Alt+Q"
            aria-label="Toggle Quick Action Menu"
          >
            <div className="p-1 rounded-lg bg-amber-400 text-slate-950 font-black shrink-0">
              <Zap className="w-3.5 h-3.5 fill-current" />
            </div>
            <span>Quick Actions</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </button>

          {/* Quick Expand Button Beside Trigger */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 shadow-xl transition-all cursor-pointer backdrop-blur-md"
              title="Expand side navigation bar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <ExpressVoucherModal
        isOpen={isExpressVoucherOpen}
        onClose={() => setIsExpressVoucherOpen(false)}
      />
      <ExpressPettyCashModal
        isOpen={isExpressPettyCashOpen}
        onClose={() => setIsExpressPettyCashOpen(false)}
      />
    </>
  );
};
