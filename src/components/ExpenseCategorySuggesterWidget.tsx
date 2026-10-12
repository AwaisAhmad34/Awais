import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wallet,
  Building2,
  TrendingUp,
  Brain,
  History,
  Tag,
  Layers,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Check,
  X,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { useAccounting, Transaction, AccountHead } from '../core/aplusEngine';
import {
  suggestExpenseCategory,
  batchAnalyzeVouchers,
  getHistoricalPatternSummary,
  CategorySuggestionResult,
  saveLearnedPatternToFirestore,
  loadExpensePatternsFromFirestore,
} from '../services/expenseCategorySuggester';

interface ExpenseCategorySuggesterWidgetProps {
  onNavigate?: (tab: string) => void;
  defaultNarration?: string;
  onApplyCategory?: (result: CategorySuggestionResult) => void;
  embedded?: boolean;
}

export const ExpenseCategorySuggesterWidget: React.FC<ExpenseCategorySuggesterWidgetProps> = ({
  onNavigate,
  defaultNarration = '',
  onApplyCategory,
  embedded = false,
}) => {
  const {
    accountHeads,
    transactions,
    pettyCashTransactions,
    campuses,
    currentCampusId,
    addTransaction,
    addPettyCashTransaction,
    logActivity,
    updateTransaction,
  } = useAccounting();

  const [activeTab, setActiveTab] = useState<'interactive' | 'batch' | 'patterns'>('interactive');
  const [inputNarration, setInputNarration] = useState(
    defaultNarration || 'Paid Rs. 18,500 for 50 liters generator diesel fuel and filter change'
  );
  const [inputPayee, setInputPayee] = useState('Campus Generator Supplier');
  const [inputAmount, setInputAmount] = useState('18500');
  const [selectedCampus, setSelectedCampus] = useState(
    currentCampusId && currentCampusId !== 'all' ? currentCampusId : campuses[0]?.id || ''
  );
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);
  const [customKeyword, setCustomKeyword] = useState('');
  const [customAccountCode, setCustomAccountCode] = useState('');
  const [isSavingPattern, setIsSavingPattern] = useState(false);

  useEffect(() => {
    loadExpensePatternsFromFirestore().catch(() => {});
  }, []);

  const showToast = (type: 'success' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Real-time category suggestion calculation
  const currentSuggestion = useMemo(() => {
    return suggestExpenseCategory({
      narration: inputNarration,
      payee: inputPayee,
      amount: Number(inputAmount) || 0,
      campusId: selectedCampus,
      historicalTransactions: transactions,
      historicalPettyCash: pettyCashTransactions,
      accountHeads,
    });
  }, [
    inputNarration,
    inputPayee,
    inputAmount,
    selectedCampus,
    transactions,
    pettyCashTransactions,
    accountHeads,
  ]);

  // Historical pattern telemetry
  const patternSummary = useMemo(() => {
    return getHistoricalPatternSummary(transactions, pettyCashTransactions);
  }, [transactions, pettyCashTransactions]);

  // Pending vouchers in current campus for batch categorization
  const pendingVouchers = useMemo(() => {
    return (transactions || []).filter(
      (tx) =>
        (selectedCampus === 'all' || !selectedCampus || tx.campusId === selectedCampus) &&
        (tx.status === 'Pending' || tx.status === 'Draft')
    );
  }, [transactions, selectedCampus]);

  const batchAnalysisResults = useMemo(() => {
    return batchAnalyzeVouchers({
      vouchers: pendingVouchers,
      accountHeads,
      historicalTransactions: transactions,
      historicalPettyCash: pettyCashTransactions,
    });
  }, [pendingVouchers, accountHeads, transactions, pettyCashTransactions]);

  // 1-Click Create & Post Voucher with suggested categories
  const handleCreateVoucherFromSuggestion = () => {
    const amt = Number(inputAmount) || 1000;
    const campusObj = campuses.find((c) => c.id === selectedCampus) || campuses[0];
    const today = new Date().toISOString().slice(0, 10);
    const vType = currentSuggestion.suggestedVoucherType;
    const vNo = `${vType}-${Date.now().toString().slice(-4)}`;

    const drHead = currentSuggestion.accountHead || {
      id: `acc-${currentSuggestion.accountCode}`,
      code: currentSuggestion.accountCode,
      name: currentSuggestion.accountName,
    };

    const crHead = accountHeads.find(
      (a) => a.code === currentSuggestion.suggestedCreditAccountCode
    ) || {
      id: 'acc-cr-default',
      code: currentSuggestion.suggestedCreditAccountCode,
      name: currentSuggestion.suggestedCreditAccountName,
    };

    const newTx = addTransaction({
      voucherNo: vNo,
      voucherType: vType,
      campusId: campusObj?.id || 'campus-1',
      date: today,
      narration: inputNarration || 'Suggested Expense Transaction',
      status: 'Pending',
      preparedBy: 'AI Auto-Suggester Assistant',
      totalDebit: amt,
      totalCredit: amt,
      entries: [
        {
          id: `entry-dr-${Date.now()}`,
          accountId: drHead.id,
          accountCode: drHead.code,
          accountName: drHead.name,
          description: inputNarration,
          debit: amt,
          credit: 0,
        },
        {
          id: `entry-cr-${Date.now()}`,
          accountId: crHead.id,
          accountCode: crHead.code,
          accountName: crHead.name,
          description: `Payment per ${vNo}`,
          debit: 0,
          credit: amt,
        },
      ],
    });

    logActivity(
      'CREATE_VOUCHER',
      'Voucher',
      vNo,
      `Created ${vType} voucher ${vNo} using AI Expense Suggestion [${currentSuggestion.accountName} (${currentSuggestion.accountCode})]. Confidence: ${currentSuggestion.confidence}%.`,
      campusObj?.id,
      amt,
      {
        suggestedAccountCode: currentSuggestion.accountCode,
        confidence: currentSuggestion.confidence,
        matchedKeywords: currentSuggestion.matchedKeywords,
      }
    );

    if (onApplyCategory) {
      onApplyCategory(currentSuggestion);
    }

    showToast(
      'success',
      `Created Voucher ${vNo} with Expense Category: ${currentSuggestion.accountName} (${currentSuggestion.accountCode})`
    );
  };

  // 1-Click Create Petty Cash Disbursement
  const handleCreatePettyCashFromSuggestion = () => {
    const amt = Number(inputAmount) || 500;
    const campusObj = campuses.find((c) => c.id === selectedCampus) || campuses[0];
    const today = new Date().toISOString().slice(0, 10);
    const pNo = `PC-EXP-${Date.now().toString().slice(-4)}`;

    addPettyCashTransaction({
      voucherNo: pNo,
      campusId: campusObj?.id || 'campus-1',
      date: today,
      type: 'Disbursement',
      payee: inputPayee || 'General Vendor',
      category: currentSuggestion.accountName,
      accountCode: currentSuggestion.accountCode,
      amount: amt,
      narration: inputNarration,
      balanceAfter: Math.max(0, (campusObj?.currentPettyCash || 25000) - amt),
    });

    logActivity(
      'PETTY_CASH_EXPENSE',
      'PettyCash',
      pNo,
      `Petty Cash expense ${pNo} categorized as [${currentSuggestion.accountName} (${currentSuggestion.accountCode})]`,
      campusObj?.id,
      amt
    );

    showToast(
      'success',
      `Logged Petty Cash Slip ${pNo} under ${currentSuggestion.accountName} (Rs. ${amt.toLocaleString()})`
    );
  };

  // Apply batch suggestions to a pending voucher
  const handleApplySingleBatchSuggestion = (item: (typeof batchAnalysisResults)[0]) => {
    const targetTx = transactions.find((t) => t.id === item.voucherId);
    if (!targetTx) return;

    const drEntry = targetTx.entries?.find((e) => e.debit > 0);
    const updatedEntries = (targetTx.entries || []).map((e) => {
      if (e.id === drEntry?.id || e.debit > 0) {
        return {
          ...e,
          accountCode: item.suggestion.accountCode,
          accountName: item.suggestion.accountName,
        };
      }
      return e;
    });

    updateTransaction(item.voucherId, {
      ...targetTx,
      entries: updatedEntries,
    });

    showToast(
      'success',
      `Updated ${item.voucherNo} with Category: ${item.suggestion.accountName} (${item.suggestion.accountCode})`
    );
  };

  // Batch auto-assign all suggestions
  const handleApplyAllBatchSuggestions = () => {
    let count = 0;
    batchAnalysisResults.forEach((item) => {
      handleApplySingleBatchSuggestion(item);
      count++;
    });
    showToast('success', `Applied auto-suggested expense categories to ${count} pending voucher(s)!`);
  };

  // Add custom keyword pattern rule
  const handleAddCustomPattern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKeyword.trim() || !customAccountCode) return;

    const matchedHead = accountHeads.find(
      (a) => a.code === customAccountCode || a.accountId === customAccountCode
    );
    if (!matchedHead) return;

    setIsSavingPattern(true);
    const newPattern = {
      id: `pat-${Date.now()}`,
      keyword: customKeyword.trim().toLowerCase(),
      category: matchedHead.groupName || 'Expenses',
      accountCode: matchedHead.code,
      accountName: matchedHead.name,
      frequency: 1,
      confidence: 95,
      campusId: selectedCampus,
      updatedAt: new Date().toISOString(),
    };

    await saveLearnedPatternToFirestore(newPattern);
    setIsSavingPattern(false);
    setCustomKeyword('');
    showToast(
      'success',
      `Rule saved: Keyword '${newPattern.keyword}' now automatically maps to ${newPattern.accountName} (${newPattern.accountCode})`
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
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 text-white'
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

      {/* Header Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
              <span>Smart Accounting AI</span>
              <span>·</span>
              <span>Historical Pattern Recognition</span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Automatic Expense Category & Account Suggester</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Active ({patternSummary.totalAnalyzedTransactions} Patterns Learned)
              </span>
            </h2>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('interactive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'interactive'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Live Suggestion & Voucher Creator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Categorizer ({pendingVouchers.length} Pending)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('patterns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'patterns'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Learned Patterns & Rules</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5">
        {/* TAB 1: LIVE INTERACTIVE ANALYZER & VOUCHER GENERATOR */}
        {activeTab === 'interactive' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Input Form */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Transaction Description / Narration</span>
                  </label>
                  <span className="text-[11px] text-slate-500">Live Real-Time Prediction</span>
                </div>

                <textarea
                  value={inputNarration}
                  onChange={(e) => setInputNarration(e.target.value)}
                  rows={3}
                  placeholder="e.g. Paid Rs. 14,000 for 5 reams A4 paper and whiteboard markers for exam department"
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />

                {/* Quick Preset Samples */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">Try Sample:</span>
                  {[
                    { label: 'Diesel Fuel', text: '50 liters generator diesel fuel and filter change' },
                    { label: 'Paper & Stationery', text: '10 reams A4 paper and printing cartridges for exam cell' },
                    { label: 'Electric Bill', text: 'Campus monthly GEPCO electricity utility bill settlement' },
                    { label: 'Lab Chemicals', text: 'Chemistry lab apparatus, beakers and science chemicals' },
                    { label: 'Building Paint', text: 'Campus classrooms whitewash paint and plumber sanitary repairs' },
                    { label: 'PTCL Broadband', text: 'Monthly PTCL internet broadband and landline telephone bill' },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        setInputNarration(s.text);
                        if (s.label === 'Diesel Fuel') setInputAmount('18500');
                        else if (s.label === 'Paper & Stationery') setInputAmount('14200');
                        else if (s.label === 'Electric Bill') setInputAmount('94500');
                        else setInputAmount('6500');
                      }}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Payee / Vendor
                    </label>
                    <input
                      type="text"
                      value={inputPayee}
                      onChange={(e) => setInputPayee(e.target.value)}
                      placeholder="e.g. Al-Madina Stationers"
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Amount (PKR)
                    </label>
                    <input
                      type="number"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      placeholder="e.g. 15000"
                      className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Campus Branch
                    </label>
                    <select
                      value={selectedCampus}
                      onChange={(e) => setSelectedCampus(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Real-Time Suggestion Output Card */}
            <div className="lg:col-span-6">
              <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-2 border-indigo-300/80 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                      Recommended Expense Category
                    </span>
                  </div>

                  {/* Confidence Badge */}
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 ${
                      currentSuggestion.confidenceTier === 'high'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : currentSuggestion.confidenceTier === 'medium'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{currentSuggestion.confidence}% Match Confidence</span>
                  </div>
                </div>

                {/* Primary Suggested Head */}
                <div className="bg-white border border-indigo-200/80 rounded-xl p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                        {currentSuggestion.categoryGroup}
                      </div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        {currentSuggestion.accountName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                          COA Code: {currentSuggestion.accountCode}
                        </span>
                        <span className="text-xs text-slate-500">
                          Classification: 500-Series Expense
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500 font-semibold">Suggested Voucher</div>
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-slate-900 text-white">
                        {currentSuggestion.suggestedVoucherType}
                      </span>
                    </div>
                  </div>

                  {/* Reasoning & Keyword Pills */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{currentSuggestion.reason}</span>
                    </p>

                    {currentSuggestion.matchedKeywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] text-slate-500 font-semibold">Keywords:</span>
                        {currentSuggestion.matchedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg font-mono">
                      <span>Debit Dr:</span>
                      <strong className="text-slate-900">{currentSuggestion.accountName}</strong>
                      <span className="mx-1">·</span>
                      <span>Credit Cr:</span>
                      <strong className="text-slate-900">
                        {currentSuggestion.suggestedCreditAccountName}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Alternative Suggestions */}
                {currentSuggestion.alternatives.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Alternative Categorization Options:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {currentSuggestion.alternatives.map((alt) => (
                        <button
                          key={alt.accountCode}
                          type="button"
                          onClick={() => {
                            const found = accountHeads.find((a) => a.code === alt.accountCode);
                            if (found) {
                              setInputNarration((prev) => `${prev} (${alt.accountName})`);
                            }
                          }}
                          className="text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg p-2.5 transition-all cursor-pointer group"
                        >
                          <div className="text-[11px] font-bold text-slate-900 group-hover:text-indigo-900 truncate">
                            {alt.accountName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {alt.accountCode} · {alt.confidence}%
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1-Click Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCreateVoucherFromSuggestion}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Auto-Generate & Post {currentSuggestion.suggestedVoucherType} Voucher</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreatePettyCashFromSuggestion}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Record Petty Cash Slip</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BATCH CATEGORIZER FOR PENDING VOUCHERS */}
        {activeTab === 'batch' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Batch Categorization Queue for Pending Vouchers
                </h3>
                <p className="text-xs text-slate-600">
                  Scans unclassified or draft vouchers and infers the optimal General Ledger account head based on transaction narration
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAllBatchSuggestions}
                  disabled={batchAnalysisResults.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Apply All {batchAnalysisResults.length} Category Suggestions</span>
                </button>
              </div>
            </div>

            {batchAnalysisResults.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="font-bold text-sm text-slate-800">All Vouchers Categorized</div>
                <p className="text-xs text-slate-500 mt-1">
                  No pending vouchers requiring category assignment in the selected campus.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Voucher No</th>
                      <th className="p-3">Transaction Narration</th>
                      <th className="p-3">Current Line Head</th>
                      <th className="p-3">AI Suggested Category</th>
                      <th className="p-3">Confidence</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                    {batchAnalysisResults.map((item) => (
                      <tr key={item.voucherId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">{item.voucherNo}</td>
                        <td className="p-3 max-w-xs truncate text-slate-800 font-medium">
                          {item.narration}
                        </td>
                        <td className="p-3">
                          <span className="text-slate-600 font-mono text-[11px]">
                            {item.currentExpenseHeadName || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-indigo-900">
                              {item.suggestion.accountName}
                            </span>
                            <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {item.suggestion.accountCode}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              item.suggestion.confidence >= 75
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.suggestion.confidence}%
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleApplySingleBatchSuggestion(item)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Apply Category
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LEARNED HISTORICAL PATTERNS & PERSISTENT RULES */}
        {activeTab === 'patterns' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Analyzed Historical Ledger Records
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {patternSummary.totalAnalyzedTransactions.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Vouchers & Petty Cash slips indexed for continuous pattern learning
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Recognized Expense Vocabulary
                </div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {patternSummary.uniqueVocabularyCount.toLocaleString()} keywords
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  N-grams & semantic token associations extracted from school operations
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Top Active Category
                </div>
                <div className="text-lg font-black text-slate-900 mt-1 truncate">
                  {patternSummary.topCategories[0]?.category || 'General Expenses'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {patternSummary.topCategories[0]?.count || 0} transactions (
                  {patternSummary.topCategories[0]?.percentage || 0}% of all entries)
                </p>
              </div>
            </div>

            {/* Custom Rule Creator */}
            <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4">
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Add Persistent Category Mapping Rule (Synced to Cloud Database)</span>
              </h4>
              <form onSubmit={handleAddCustomPattern} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={customKeyword}
                    onChange={(e) => setCustomKeyword(e.target.value)}
                    placeholder="Trigger keyword (e.g. 'canteen milk', 'sports trophy', 'ac gas')"
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex-1 min-w-[240px]">
                  <select
                    value={customAccountCode}
                    onChange={(e) => setCustomAccountCode(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">Select Target Expense Head...</option>
                    {accountHeads
                      .filter((a) => a.category === 'Expense')
                      .map((head) => (
                        <option key={head.code} value={head.code}>
                          {head.code} — {head.name} ({head.groupName})
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!customKeyword.trim() || !customAccountCode || isSavingPattern}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {isSavingPattern ? 'Saving...' : 'Save Rule to Cloud'}
                </button>
              </form>
            </div>

            {/* Top Learned Recurring Patterns */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Top Recurring Expense Patterns Identified in Ledger
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {patternSummary.topRecurringExpenses.map((p, idx) => (
                  <div
                    key={p.pattern || idx}
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                      <span className="capitalize font-mono text-indigo-700">{p.pattern}</span>
                      <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                        {p.count} entries
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Avg Amount: <strong className="text-slate-800">Rs. {p.avgAmount.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
