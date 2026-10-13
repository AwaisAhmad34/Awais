import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Filter,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Wallet,
  Building2,
  Clock,
  Sparkles,
  FileText,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Layers,
  Sliders,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { useAccounting } from '../core/aplusEngine';

export interface DailyCashRecordItem {
  id: string;
  source: 'CRV' | 'CPV' | 'PettyCash' | 'VoucherEntry';
  voucherNo: string;
  voucherType: string;
  campusId: string;
  campusName: string;
  date: string;
  category: 'inflow' | 'outflow';
  amount: number;
  narration: string;
  payeeOrReceivedFrom: string;
  status: string;
  time?: string;
  accountHeadName?: string;
}

export interface CampusDailyCashSummaryData {
  campusId: string;
  campusName: string;
  campusCode: string;
  city?: string;
  accountantName?: string;
  inflowTotal: number;
  outflowTotal: number;
  netFlow: number;
  inflowCount: number;
  outflowCount: number;
  crvAmount: number;
  pettyReplenishAmount: number;
  cpvAmount: number;
  pettyDisburseAmount: number;
  currentPettyCash: number;
  pettyCashFloat: number;
  estimatedCashInHand: number;
  items: DailyCashRecordItem[];
}

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const DailyCashSummary: React.FC<{
  onNavigate?: (tab: string) => void;
  defaultCollapsed?: boolean;
}> = ({ onNavigate, defaultCollapsed = false }) => {
  const {
    campuses,
    currentCampusId,
    setCurrentCampusId,
    transactions,
    pettyCashTransactions,
    accountHeads,
    addTransaction,
    addPettyCashTransaction,
    getNextVoucherNumber,
    getNextPettyCashNumber,
    currentUser,
    isSuperAdmin,
    orgSettings,
    logActivity,
  } = useAccounting();

  // Selected date: default to today's date formatted as YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeCampusFilter, setActiveCampusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table' | 'chart'>('cards');
  const [isExpanded, setIsExpanded] = useState<boolean>(!defaultCollapsed);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recordFilter, setRecordFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Quick Action Modal state for fast cash entry directly from dashboard
  const [quickEntryModal, setQuickEntryModal] = useState<{
    isOpen: boolean;
    type: 'inflow' | 'outflow';
    campusId: string;
    amount: string;
    narration: string;
    payee: string;
    accountHeadId: string;
  }>({
    isOpen: false,
    type: 'inflow',
    campusId: campuses[0]?.id || '',
    amount: '',
    narration: '',
    payee: '',
    accountHeadId: '',
  });

  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Keep live clock updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeStr(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 4500);
  };

  // Find latest date in transactions or petty cash to offer instant 1-click jump if today is fresh
  const latestActivityDate = useMemo(() => {
    const allDates = [
      ...(transactions || []).map((t) => (t.date ? t.date.split('T')[0] : '')),
      ...(pettyCashTransactions || []).map((p) => (p.date ? p.date.split('T')[0] : '')),
    ].filter(Boolean);

    if (allDates.length === 0) return null;
    allDates.sort().reverse();
    return allDates[0];
  }, [transactions, pettyCashTransactions]);

  // Find cash-in-hand accounts for fallback lookups
  const cashInHandAccount = useMemo(() => {
    return (
      accountHeads.find(
        (a) =>
          a.accountId === '1031' ||
          a.code === '100-4-01' ||
          a.name?.toLowerCase().includes('cash in hand')
      ) || null
    );
  }, [accountHeads]);

  // Aggregate daily cash movements for the chosen date
  const { campusSummaries, consolidatedTotals, allDailyRecords } = useMemo(() => {
    const records: DailyCashRecordItem[] = [];
    const dateQuery = selectedDate;

    // Helper map of campus names
    const campusMap = new Map<string, any>();
    campuses.forEach((c) => campusMap.set(c.id, c));

    // 1. Process main voucher transactions for selected date
    (transactions || []).forEach((tx: any) => {
      if (tx.status === 'Rejected' || tx.status === 'Cancelled') return;
      const txDate = tx.date ? tx.date.split('T')[0] : '';
      if (txDate !== dateQuery) return;

      const cId = tx.campusId || campuses[0]?.id || 'unknown';
      const cObj = campusMap.get(cId);
      const campusName = cObj?.name || 'Central Campus';

      if (tx.voucherType === 'CRV') {
        // Cash Receipt Voucher = Definitive Cash Inflow
        const amt = Number(tx.totalCredit || tx.totalDebit) || 0;
        records.push({
          id: `tx-${tx.id}`,
          source: 'CRV',
          voucherNo: tx.voucherNo || `CRV-${tx.id.slice(0, 6)}`,
          voucherType: 'CRV (Cash Receipt)',
          campusId: cId,
          campusName,
          date: txDate,
          category: 'inflow',
          amount: amt,
          narration: tx.narration || 'Cash Receipt Collection',
          payeeOrReceivedFrom: tx.entries?.[0]?.accountName || 'Cash Collection',
          status: tx.status || 'Posted',
          accountHeadName: tx.entries?.[0]?.accountName,
        });
      } else if (tx.voucherType === 'CPV') {
        // Cash Payment Voucher = Definitive Cash Outflow
        const amt = Number(tx.totalDebit || tx.totalCredit) || 0;
        records.push({
          id: `tx-${tx.id}`,
          source: 'CPV',
          voucherNo: tx.voucherNo || `CPV-${tx.id.slice(0, 6)}`,
          voucherType: 'CPV (Cash Payment)',
          campusId: cId,
          campusName,
          date: txDate,
          category: 'outflow',
          amount: amt,
          narration: tx.narration || 'Cash Payment Disbursement',
          payeeOrReceivedFrom: tx.entries?.[0]?.accountName || 'Cash Expense Payee',
          status: tx.status || 'Posted',
          accountHeadName: tx.entries?.[0]?.accountName,
        });
      } else {
        // Check if entries touch Cash In Hand
        (tx.entries || []).forEach((ent: any, idx: number) => {
          const isCashHead =
            ent.accountCode === '1031' ||
            ent.accountCode === '100-4-01' ||
            ent.accountName?.toLowerCase() === 'cash in hand' ||
            (cashInHandAccount && ent.accountId === cashInHandAccount.id);

          if (isCashHead) {
            const deb = Number(ent.debit) || 0;
            const cred = Number(ent.credit) || 0;
            if (deb > 0) {
              records.push({
                id: `ent-${tx.id}-${idx}-dr`,
                source: 'VoucherEntry',
                voucherNo: tx.voucherNo || `${tx.voucherType}-${tx.id.slice(0, 6)}`,
                voucherType: `${tx.voucherType} (Cash Dr)`,
                campusId: cId,
                campusName,
                date: txDate,
                category: 'inflow',
                amount: deb,
                narration: ent.description || tx.narration || 'Cash Inflow Entry',
                payeeOrReceivedFrom: ent.accountName || 'Cash Account',
                status: tx.status || 'Posted',
                accountHeadName: ent.accountName,
              });
            }
            if (cred > 0) {
              records.push({
                id: `ent-${tx.id}-${idx}-cr`,
                source: 'VoucherEntry',
                voucherNo: tx.voucherNo || `${tx.voucherType}-${tx.id.slice(0, 6)}`,
                voucherType: `${tx.voucherType} (Cash Cr)`,
                campusId: cId,
                campusName,
                date: txDate,
                category: 'outflow',
                amount: cred,
                narration: ent.description || tx.narration || 'Cash Outflow Entry',
                payeeOrReceivedFrom: ent.accountName || 'Cash Account',
                status: tx.status || 'Posted',
                accountHeadName: ent.accountName,
              });
            }
          }
        });
      }
    });

    // 2. Process petty cash transactions for selected date
    (pettyCashTransactions || []).forEach((pc: any) => {
      const pcDate = pc.date ? pc.date.split('T')[0] : '';
      if (pcDate !== dateQuery) return;

      const cId = pc.campusId || campuses[0]?.id || 'unknown';
      const cObj = campusMap.get(cId);
      const campusName = cObj?.name || 'Central Campus';
      const amt = Number(pc.amount) || 0;

      if (pc.type === 'Replenishment') {
        // Float replenishment = Cash Inflow into petty cash desk
        records.push({
          id: `pc-${pc.id}`,
          source: 'PettyCash',
          voucherNo: pc.voucherNo || `PC-REP-${pc.id.slice(0, 6)}`,
          voucherType: 'Petty Cash Replenishment (Float In)',
          campusId: cId,
          campusName,
          date: pcDate,
          category: 'inflow',
          amount: amt,
          narration: pc.narration || 'Petty Cash Box Float Top-Up',
          payeeOrReceivedFrom: pc.payee || 'Bank / Main Safe',
          status: 'Replenished',
          accountHeadName: 'Petty Cash Float',
        });
      } else if (pc.type === 'Disbursement') {
        // Daily expense disbursed = Cash Outflow
        records.push({
          id: `pc-${pc.id}`,
          source: 'PettyCash',
          voucherNo: pc.voucherNo || `PC-DIS-${pc.id.slice(0, 6)}`,
          voucherType: 'Petty Cash Expense (Outflow)',
          campusId: cId,
          campusName,
          date: pcDate,
          category: 'outflow',
          amount: amt,
          narration: pc.narration || pc.category || 'Petty Cash Operating Expense',
          payeeOrReceivedFrom: pc.payee || 'Expense Payee',
          status: 'Disbursed',
          accountHeadName: pc.category || 'Office Expense',
        });
      }
    });

    // 3. Compute per-campus summaries
    const summaries: CampusDailyCashSummaryData[] = campuses.map((campus) => {
      const campusRecords = records.filter((r) => r.campusId === campus.id);
      let inflowTotal = 0;
      let outflowTotal = 0;
      let crvAmount = 0;
      let pettyReplenishAmount = 0;
      let cpvAmount = 0;
      let pettyDisburseAmount = 0;
      let inflowCount = 0;
      let outflowCount = 0;

      campusRecords.forEach((rec) => {
        if (rec.category === 'inflow') {
          inflowTotal += rec.amount;
          inflowCount++;
          if (rec.source === 'CRV') crvAmount += rec.amount;
          if (rec.source === 'PettyCash') pettyReplenishAmount += rec.amount;
        } else {
          outflowTotal += rec.amount;
          outflowCount++;
          if (rec.source === 'CPV') cpvAmount += rec.amount;
          if (rec.source === 'PettyCash') pettyDisburseAmount += rec.amount;
        }
      });

      return {
        campusId: campus.id,
        campusName: campus.name,
        campusCode: campus.code,
        city: campus.city,
        accountantName: campus.accountantName,
        inflowTotal,
        outflowTotal,
        netFlow: inflowTotal - outflowTotal,
        inflowCount,
        outflowCount,
        crvAmount,
        pettyReplenishAmount,
        cpvAmount,
        pettyDisburseAmount,
        currentPettyCash: Number(campus.currentPettyCash) || 0,
        pettyCashFloat: Number(campus.pettyCashFloat) || 50000,
        estimatedCashInHand: Math.max(0, inflowTotal - outflowTotal),
        items: campusRecords,
      };
    });

    // Consolidated across all campuses
    const totalInflow = summaries.reduce((acc, s) => acc + s.inflowTotal, 0);
    const totalOutflow = summaries.reduce((acc, s) => acc + s.outflowTotal, 0);
    const netTotal = totalInflow - totalOutflow;
    const totalCRV = summaries.reduce((acc, s) => acc + s.crvAmount, 0);
    const totalCPV = summaries.reduce((acc, s) => acc + s.cpvAmount, 0);
    const totalPettyReplenish = summaries.reduce((acc, s) => acc + s.pettyReplenishAmount, 0);
    const totalPettyDisburse = summaries.reduce((acc, s) => acc + s.pettyDisburseAmount, 0);
    const totalActiveCampuses = summaries.filter(
      (s) => s.inflowTotal > 0 || s.outflowTotal > 0
    ).length;
    const totalCashVault = campuses.reduce(
      (acc, c) => acc + (Number(c.currentPettyCash) || 0),
      0
    );

    return {
      campusSummaries: summaries,
      consolidatedTotals: {
        totalInflow,
        totalOutflow,
        netTotal,
        totalCRV,
        totalCPV,
        totalPettyReplenish,
        totalPettyDisburse,
        totalInflowCount: records.filter((r) => r.category === 'inflow').length,
        totalOutflowCount: records.filter((r) => r.category === 'outflow').length,
        totalActiveCampuses,
        totalCashVault,
      },
      allDailyRecords: records,
    };
  }, [
    campuses,
    transactions,
    pettyCashTransactions,
    selectedDate,
    cashInHandAccount,
  ]);

  // Filtered campuses for view
  const displayedCampuses = useMemo(() => {
    if (activeCampusFilter === 'all') return campusSummaries;
    return campusSummaries.filter((c) => c.campusId === activeCampusFilter);
  }, [campusSummaries, activeCampusFilter]);

  // Chart data for Recharts comparison
  const chartData = useMemo(() => {
    return campusSummaries.map((c) => ({
      name: c.campusCode || c.campusName.slice(0, 10),
      fullName: c.campusName,
      inflow: c.inflowTotal,
      outflow: c.outflowTotal,
      net: c.netFlow,
    }));
  }, [campusSummaries]);

  // Filtered items list
  const filteredRecordsList = useMemo(() => {
    return allDailyRecords.filter((rec) => {
      if (activeCampusFilter !== 'all' && rec.campusId !== activeCampusFilter) return false;
      if (recordFilter !== 'all' && rec.category !== recordFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.voucherNo.toLowerCase().includes(q) ||
          rec.narration.toLowerCase().includes(q) ||
          rec.payeeOrReceivedFrom.toLowerCase().includes(q) ||
          rec.campusName.toLowerCase().includes(q) ||
          (rec.accountHeadName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allDailyRecords, activeCampusFilter, recordFilter, searchQuery]);

  // 1-Click Quick Sample Seed for the selected date if the user wants to see populated data immediately
  const handleSeedQuickSample = () => {
    const targetCampus = campuses[0];
    if (!targetCampus) return;

    const nextCRVNo = getNextVoucherNumber('CRV', targetCampus.id);
    const nextCPVNo = getNextVoucherNumber('CPV', targetCampus.id);

    // 1. Add sample CRV (e.g. Student fee cash collection)
    const crvTx = {
      id: `crv-demo-${Date.now()}`,
      voucherNo: nextCRVNo,
      voucherType: 'CRV' as const,
      campusId: targetCampus.id,
      date: selectedDate,
      narration: `Daily Student Tuition & Admission Cash Collection — ${targetCampus.name}`,
      entries: [
        {
          id: `crv-ent-1-${Date.now()}`,
          accountId: cashInHandAccount?.id || '1031',
          accountCode: '100-4-01',
          accountName: 'Cash In Hand',
          description: 'Cash received at admission counter',
          debit: 45000,
          credit: 0,
        },
        {
          id: `crv-ent-2-${Date.now()}`,
          accountId: '4001',
          accountCode: '400-1-01',
          accountName: 'Tuition Fee Income',
          description: 'Monthly student tuition fees collected',
          debit: 0,
          credit: 45000,
        },
      ],
      totalDebit: 45000,
      totalCredit: 45000,
      status: 'Posted' as const,
      preparedBy: currentUser?.name || 'Cashier Desk',
    };
    addTransaction(crvTx);

    // 2. Add sample CPV (e.g. Daily maintenance & utilities cash payment)
    const cpvTx = {
      id: `cpv-demo-${Date.now() + 1}`,
      voucherNo: nextCPVNo,
      voucherType: 'CPV' as const,
      campusId: targetCampus.id,
      date: selectedDate,
      narration: `Daily Generator Fuel & Electrical Maintenance Cash Payment — ${targetCampus.name}`,
      entries: [
        {
          id: `cpv-ent-1-${Date.now()}`,
          accountId: '5005',
          accountCode: '500-2-01',
          accountName: 'Campus Utilities & Fuel',
          description: 'Generator diesel emergency purchase',
          debit: 12500,
          credit: 0,
        },
        {
          id: `cpv-ent-2-${Date.now()}`,
          accountId: cashInHandAccount?.id || '1031',
          accountCode: '100-4-01',
          accountName: 'Cash In Hand',
          description: 'Cash paid out to fuel vendor',
          debit: 0,
          credit: 12500,
        },
      ],
      totalDebit: 12500,
      totalCredit: 12500,
      status: 'Posted' as const,
      preparedBy: currentUser?.name || 'Cashier Desk',
    };
    addTransaction(cpvTx);

    // 3. Add sample Petty Cash disbursement
    const nextPettyNo = getNextPettyCashNumber(targetCampus.id);
    addPettyCashTransaction({
      id: `petty-demo-${Date.now()}`,
      voucherNo: nextPettyNo,
      campusId: targetCampus.id,
      date: selectedDate,
      type: 'Disbursement',
      payee: 'City Stationers & Printing',
      category: 'Exam Papers & Printing',
      amount: 3200,
      narration: 'Urgent mock test paper xerox and binding supplies',
      balanceAfter: Math.max(0, (targetCampus.currentPettyCash || 50000) - 3200),
      approvedBy: 'Campus Supervisor',
    });

    logActivity(
      'CREATE_VOUCHER',
      'DailyCashSummary',
      crvTx.voucherNo,
      `Recorded sample daily cash transactions (CRV Rs. 45,000, CPV Rs. 12,500, Petty Cash Rs. 3,200) for ${selectedDate}`,
      targetCampus.id,
      45000
    );

    triggerNotice(
      `Recorded live sample cash flow for ${selectedDate} (+Rs. 45,000 Inflow, -Rs. 15,700 Outflow)!`
    );
  };

  // Quick Action form submission from the dashboard
  const handleQuickEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(quickEntryModal.amount) || 0;
    if (amt <= 0) {
      triggerNotice('Please enter a valid amount greater than zero.');
      return;
    }

    const targetCampusId = quickEntryModal.campusId || campuses[0]?.id;
    const targetCampus = campuses.find((c) => c.id === targetCampusId) || campuses[0];
    if (!targetCampus) return;

    if (quickEntryModal.type === 'inflow') {
      const vNo = getNextVoucherNumber('CRV', targetCampus.id);
      const newTx = {
        id: `crv-quick-${Date.now()}`,
        voucherNo: vNo,
        voucherType: 'CRV' as const,
        campusId: targetCampus.id,
        date: selectedDate,
        narration: quickEntryModal.narration.trim() || `Cash Receipt — ${targetCampus.name}`,
        entries: [
          {
            id: `crv-q-1-${Date.now()}`,
            accountId: cashInHandAccount?.id || '1031',
            accountCode: '100-4-01',
            accountName: 'Cash In Hand',
            description: quickEntryModal.narration.trim() || 'Cash received',
            debit: amt,
            credit: 0,
          },
          {
            id: `crv-q-2-${Date.now()}`,
            accountId: quickEntryModal.accountHeadId || '4001',
            accountCode: '400-1-01',
            accountName: quickEntryModal.payee.trim() || 'Tuition Fee Income',
            description: `Cash received from ${quickEntryModal.payee.trim() || 'Client'}`,
            debit: 0,
            credit: amt,
          },
        ],
        totalDebit: amt,
        totalCredit: amt,
        status: 'Posted' as const,
        preparedBy: currentUser?.name || 'Cashier',
      };
      addTransaction(newTx);
      logActivity(
        'CREATE_VOUCHER',
        'Voucher',
        vNo,
        `Quick Cash Receipt of Rs. ${amt.toLocaleString()} recorded for ${targetCampus.name}`,
        targetCampus.id,
        amt
      );
      triggerNotice(`Successfully created Cash Receipt ${vNo} for ${formatPKR(amt)}!`);
    } else {
      const vNo = getNextVoucherNumber('CPV', targetCampus.id);
      const newTx = {
        id: `cpv-quick-${Date.now()}`,
        voucherNo: vNo,
        voucherType: 'CPV' as const,
        campusId: targetCampus.id,
        date: selectedDate,
        narration: quickEntryModal.narration.trim() || `Cash Payment — ${targetCampus.name}`,
        entries: [
          {
            id: `cpv-q-1-${Date.now()}`,
            accountId: quickEntryModal.accountHeadId || '5001',
            accountCode: '500-1-01',
            accountName: quickEntryModal.payee.trim() || 'Operational Expense',
            description: `Payment to ${quickEntryModal.payee.trim() || 'Vendor'}`,
            debit: amt,
            credit: 0,
          },
          {
            id: `cpv-q-2-${Date.now()}`,
            accountId: cashInHandAccount?.id || '1031',
            accountCode: '100-4-01',
            accountName: 'Cash In Hand',
            description: 'Cash disbursed from campus safe',
            debit: 0,
            credit: amt,
          },
        ],
        totalDebit: amt,
        totalCredit: amt,
        status: 'Posted' as const,
        preparedBy: currentUser?.name || 'Cashier',
      };
      addTransaction(newTx);
      logActivity(
        'CREATE_VOUCHER',
        'Voucher',
        vNo,
        `Quick Cash Payment of Rs. ${amt.toLocaleString()} recorded for ${targetCampus.name}`,
        targetCampus.id,
        amt
      );
      triggerNotice(`Successfully created Cash Payment ${vNo} for ${formatPKR(amt)}!`);
    }

    setQuickEntryModal({
      isOpen: false,
      type: 'inflow',
      campusId: targetCampusId,
      amount: '',
      narration: '',
      payee: '',
      accountHeadId: '',
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Campus Code',
      'Campus Name',
      'Date',
      'Cash Inflows (PKR)',
      'Cash Outflows (PKR)',
      'Net Daily Flow (PKR)',
      'CRV Inflow (PKR)',
      'Petty Float In (PKR)',
      'CPV Outflow (PKR)',
      'Petty Expense (PKR)',
      'Inflow Tx Count',
      'Outflow Tx Count',
      'Current Petty Cash Box (PKR)',
      'Cashier Name',
    ];

    const rows = campusSummaries.map((c) => [
      `"${c.campusCode}"`,
      `"${c.campusName}"`,
      `"${selectedDate}"`,
      c.inflowTotal,
      c.outflowTotal,
      c.netFlow,
      c.crvAmount,
      c.pettyReplenishAmount,
      c.cpvAmount,
      c.pettyDisburseAmount,
      c.inflowCount,
      c.outflowCount,
      c.currentPettyCash,
      `"${c.accountantName || 'Accountant'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daily_Cash_Summary_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotice(`Downloaded CSV summary for ${selectedDate}!`);
  };

  // Print Daily Summary Sheet
  const handlePrintDailySheet = () => {
    window.print();
  };

  const isToday = selectedDate === todayStr;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-6 transition-all duration-300">
      {/* Top Banner & Control Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Badge */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  Treasury Desk
                </span>
                <span className="text-xs text-slate-300 flex items-center gap-1.5 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live {currentTimeStr}</span>
                </span>
                {isToday ? (
                  <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    Current Date: Today
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                    Inspecting: {selectedDate}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5 flex items-center gap-2">
                <span>Daily Cash Summary</span>
                <span className="text-xs font-normal text-slate-400 hidden sm:inline">
                  — Real-Time Inflows & Outflows Per Campus
                </span>
              </h2>
            </div>
          </div>

          {/* Date Selector & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Date Switchers */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700/80 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedDate === todayStr
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayStr)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedDate === yesterdayStr
                    ? 'bg-emerald-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <div className="flex items-center pl-1.5 pr-2 gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="bg-transparent text-white font-mono text-xs border-none outline-none cursor-pointer focus:ring-0"
                  title="Choose specific date to inspect"
                />
              </div>
            </div>

            {/* Jump to latest active date if today is empty */}
            {consolidatedTotals.totalInflow === 0 &&
              consolidatedTotals.totalOutflow === 0 &&
              latestActivityDate &&
              latestActivityDate !== selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(latestActivityDate)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={`View latest active date with transactions (${latestActivityDate})`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>View Latest Activity ({latestActivityDate})</span>
                </button>
              )}

            {/* Quick Actions */}
            <button
              type="button"
              onClick={() =>
                setQuickEntryModal({
                  isOpen: true,
                  type: 'inflow',
                  campusId: campuses[0]?.id || '',
                  amount: '',
                  narration: '',
                  payee: '',
                  accountHeadId: '',
                })
              }
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Quick record a Cash Receipt (CRV) for today"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Record Inflow</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setQuickEntryModal({
                  isOpen: true,
                  type: 'outflow',
                  campusId: campuses[0]?.id || '',
                  amount: '',
                  narration: '',
                  payee: '',
                  accountHeadId: '',
                })
              }
              className="px-3 py-1.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Quick record a Cash Payment (CPV) for today"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>- Record Outflow</span>
            </button>

            {/* Print & CSV buttons */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Download Daily Cash CSV Report"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handlePrintDailySheet}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title="Print Daily Cash Summary Sheet"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Expand / Collapse toggle */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse Summary' : 'Expand Summary'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Feedback notice toast */}
        {feedbackNotice && (
          <div className="mt-3 py-2 px-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              className="text-emerald-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Quick Glace Top KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Cash Inflow */}
            <div className="bg-gradient-to-br from-emerald-50/90 to-emerald-100/40 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xs hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Total Cash Inflows
                </span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
                {formatPKR(consolidatedTotals.totalInflow)}
              </div>
              <div className="mt-2 text-[11px] text-emerald-700 font-medium flex flex-wrap items-center justify-between gap-1 border-t border-emerald-200/60 pt-2">
                <span>
                  CRV: {formatPKR(consolidatedTotals.totalCRV)}
                </span>
                <span>
                  Replenish: {formatPKR(consolidatedTotals.totalPettyReplenish)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-emerald-600/80 font-mono">
                {consolidatedTotals.totalInflowCount} receipt transaction(s) recorded
              </div>
            </div>

            {/* KPI 2: Total Cash Outflow */}
            <div className="bg-gradient-to-br from-rose-50/90 to-rose-100/40 border border-rose-200/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xs hover:border-rose-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                  Total Cash Outflows
                </span>
                <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-rose-950 font-mono tracking-tight">
                {formatPKR(consolidatedTotals.totalOutflow)}
              </div>
              <div className="mt-2 text-[11px] text-rose-700 font-medium flex flex-wrap items-center justify-between gap-1 border-t border-rose-200/60 pt-2">
                <span>
                  CPV: {formatPKR(consolidatedTotals.totalCPV)}
                </span>
                <span>
                  Disbursed: {formatPKR(consolidatedTotals.totalPettyDisburse)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-rose-600/80 font-mono">
                {consolidatedTotals.totalOutflowCount} payment transaction(s) recorded
              </div>
            </div>

            {/* KPI 3: Net Cash Movement */}
            <div
              className={`rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xs border transition-all ${
                consolidatedTotals.netTotal >= 0
                  ? 'bg-gradient-to-br from-teal-50/90 to-teal-100/40 border-teal-200/80'
                  : 'bg-gradient-to-br from-amber-50/90 to-amber-100/40 border-amber-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    consolidatedTotals.netTotal >= 0 ? 'text-teal-800' : 'text-amber-800'
                  }`}
                >
                  Net Daily Movement
                </span>
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    consolidatedTotals.netTotal >= 0
                      ? 'bg-teal-500/15 text-teal-700'
                      : 'bg-amber-500/15 text-amber-700'
                  }`}
                >
                  {consolidatedTotals.netTotal >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </span>
              </div>
              <div
                className={`text-2xl font-black font-mono tracking-tight ${
                  consolidatedTotals.netTotal >= 0 ? 'text-teal-950' : 'text-amber-950'
                }`}
              >
                {consolidatedTotals.netTotal >= 0 ? '+' : ''}
                {formatPKR(consolidatedTotals.netTotal)}
              </div>
              <div
                className={`mt-2 text-[11px] font-semibold flex items-center justify-between border-t pt-2 ${
                  consolidatedTotals.netTotal >= 0
                    ? 'border-teal-200/60 text-teal-700'
                    : 'border-amber-200/60 text-amber-700'
                }`}
              >
                <span>
                  {consolidatedTotals.netTotal > 0
                    ? 'Net Cash Surplus'
                    : consolidatedTotals.netTotal < 0
                    ? 'Net Cash Deficit'
                    : 'Balanced Flow'}
                </span>
                <span className="font-mono text-[10px]">
                  {consolidatedTotals.totalInflow > 0
                    ? `${Math.round(
                        (consolidatedTotals.netTotal / consolidatedTotals.totalInflow) * 100
                      )}% retain rate`
                    : 'No inflow'}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">
                {selectedDate} Net Treasury Shift
              </div>
            </div>

            {/* KPI 4: Active Campus Desks & Petty Vault */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Campus Desks & Vault
                </span>
                <span className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {consolidatedTotals.totalActiveCampuses}{' '}
                <span className="text-sm font-normal text-slate-500">
                  / {campuses.length} Active Today
                </span>
              </div>
              <div className="mt-2 text-[11px] text-slate-600 font-medium flex items-center justify-between border-t border-slate-200/80 pt-2">
                <span>Imprest Vault Balance:</span>
                <span className="font-bold font-mono text-purple-900">
                  {formatPKR(consolidatedTotals.totalCashVault)}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 font-mono">
                Across {campuses.length} registered campus safe boxes
              </div>
            </div>
          </div>

          {/* Empty state helper with 1-click test populator */}
          {consolidatedTotals.totalInflow === 0 && consolidatedTotals.totalOutflow === 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    No cash transactions recorded for {selectedDate} yet
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Campus cashier registers are currently balanced. You can record a live Cash Receipt
                    (CRV), issue a Cash Payment (CPV), or click below to populate sample transactions for
                    immediate testing.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSeedQuickSample}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Populate Sample Day Flow</span>
                </button>
                {latestActivityDate && latestActivityDate !== selectedDate && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(latestActivityDate)}
                    className="px-3 py-2 rounded-xl bg-white hover:bg-amber-100/50 border border-amber-300 text-amber-900 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Switch to {latestActivityDate}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section Controls: View Switcher (Cards / Table / Chart) + Campus Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Per-Campus Breakdown for {selectedDate}</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                ({displayedCampuses.length} Campus Branches)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Campus Filter Dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 font-medium">Campus:</span>
                <select
                  value={activeCampusFilter}
                  onChange={(e) => setActiveCampusFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="all">All Campuses (Consolidated)</option>
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Card Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Table Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    viewMode === 'chart'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bar Chart
                </button>
              </div>
            </div>
          </div>

          {/* MODE 1: CARD GRID VIEW */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedCampuses.map((campusSummary) => {
                const totalActivity =
                  campusSummary.inflowTotal + campusSummary.outflowTotal;
                const inflowPercent =
                  totalActivity > 0
                    ? Math.round((campusSummary.inflowTotal / totalActivity) * 100)
                    : 50;

                return (
                  <div
                    key={campusSummary.campusId}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Campus Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {campusSummary.campusCode}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {campusSummary.city || 'Branch'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                            {campusSummary.campusName}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Cashier: {campusSummary.accountantName || 'Assigned Accountant'}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {campusSummary.inflowTotal > 0 || campusSummary.outflowTotal > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <span>Idle Today</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inflows & Outflows 2-Column Block */}
                      <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50/70 border border-slate-100 mb-3">
                        {/* Inflow */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                            <span>Inflow</span>
                          </span>
                          <div className="text-base font-black text-emerald-950 font-mono">
                            {formatPKR(campusSummary.inflowTotal)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {campusSummary.inflowCount} tx ({formatPKR(campusSummary.crvAmount)} CRV)
                          </div>
                        </div>

                        {/* Outflow */}
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] font-bold text-rose-800 uppercase flex items-center justify-end gap-1">
                            <span>Outflow</span>
                            <ArrowUpRight className="w-3 h-3 text-rose-600" />
                          </span>
                          <div className="text-base font-black text-rose-950 font-mono">
                            {formatPKR(campusSummary.outflowTotal)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {campusSummary.outflowCount} tx ({formatPKR(campusSummary.cpvAmount)} CPV)
                          </div>
                        </div>
                      </div>

                      {/* Inflow vs Outflow Visual Ratio Bar */}
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span className="text-emerald-700 font-bold">
                            Inflow: {inflowPercent}%
                          </span>
                          <span className="text-rose-700 font-bold">
                            Outflow: {100 - inflowPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 transition-all duration-300"
                            style={{ width: `${inflowPercent}%` }}
                            title={`Inflow: ${formatPKR(campusSummary.inflowTotal)}`}
                          ></div>
                          <div
                            className="bg-rose-500 transition-all duration-300"
                            style={{ width: `${100 - inflowPercent}%` }}
                            title={`Outflow: ${formatPKR(campusSummary.outflowTotal)}`}
                          ></div>
                        </div>
                      </div>

                      {/* Net Flow & Vault */}
                      <div className="flex items-center justify-between text-xs py-2 border-t border-slate-100">
                        <span className="text-slate-600 font-medium">Net Daily Flow:</span>
                        <span
                          className={`font-black font-mono ${
                            campusSummary.netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {campusSummary.netFlow >= 0 ? '+' : ''}
                          {formatPKR(campusSummary.netFlow)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>Petty Cash Box Float:</span>
                        <span className="font-mono text-slate-700 font-bold">
                          {formatPKR(campusSummary.currentPettyCash)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions for This Campus */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setQuickEntryModal({
                            isOpen: true,
                            type: 'inflow',
                            campusId: campusSummary.campusId,
                            amount: '',
                            narration: '',
                            payee: '',
                            accountHeadId: '',
                          });
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Inflow</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setQuickEntryModal({
                            isOpen: true,
                            type: 'outflow',
                            campusId: campusSummary.campusId,
                            amount: '',
                            narration: '',
                            payee: '',
                            accountHeadId: '',
                          });
                        }}
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/70 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <TrendingDown className="w-3 h-3" />
                        <span>- Outflow</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigate) {
                            setCurrentCampusId(campusSummary.campusId);
                            onNavigate('transaction');
                          }
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-auto flex items-center gap-0.5"
                      >
                        <span>Open Vouchers</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODE 2: TABLE MATRIX VIEW */}
          {viewMode === 'table' && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Campus Branch</th>
                      <th className="py-3 px-4 text-right">Cash Inflows (PKR)</th>
                      <th className="py-3 px-4 text-right">Cash Outflows (PKR)</th>
                      <th className="py-3 px-4 text-right">Net Daily Movement</th>
                      <th className="py-3 px-4 text-center">Inflow / Outflow Ratio</th>
                      <th className="py-3 px-4 text-right">Petty Cash Safe</th>
                      <th className="py-3 px-4">Accountant</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedCampuses.map((c) => {
                      const totalActivity = c.inflowTotal + c.outflowTotal;
                      const inflowPercent =
                        totalActivity > 0
                          ? Math.round((c.inflowTotal / totalActivity) * 100)
                          : 50;

                      return (
                        <tr
                          key={c.campusId}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                {c.campusCode}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900">{c.campusName}</div>
                                <div className="text-[10px] text-slate-400">{c.city || 'Campus Branch'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                            <div>{formatPKR(c.inflowTotal)}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {c.inflowCount} tx ({formatPKR(c.crvAmount)} CRV)
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-700">
                            <div>{formatPKR(c.outflowTotal)}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {c.outflowCount} tx ({formatPKR(c.cpvAmount)} CPV)
                            </div>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-black ${
                              c.netFlow >= 0 ? 'text-teal-700' : 'text-rose-700'
                            }`}
                          >
                            {c.netFlow >= 0 ? '+' : ''}
                            {formatPKR(c.netFlow)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-24 mx-auto space-y-1">
                              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
                                <div
                                  className="bg-emerald-500"
                                  style={{ width: `${inflowPercent}%` }}
                                ></div>
                                <div
                                  className="bg-rose-500"
                                  style={{ width: `${100 - inflowPercent}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                <span>{inflowPercent}% In</span>
                                <span>{100 - inflowPercent}% Out</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                            {formatPKR(c.currentPettyCash)}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {c.accountantName || 'Accountant'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEntryModal({
                                    isOpen: true,
                                    type: 'inflow',
                                    campusId: c.campusId,
                                    amount: '',
                                    narration: '',
                                    payee: '',
                                    accountHeadId: '',
                                  });
                                }}
                                className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] transition-colors cursor-pointer"
                                title="Quick Record Inflow (CRV)"
                              >
                                + In
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickEntryModal({
                                    isOpen: true,
                                    type: 'outflow',
                                    campusId: c.campusId,
                                    amount: '',
                                    narration: '',
                                    payee: '',
                                    accountHeadId: '',
                                  });
                                }}
                                className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] transition-colors cursor-pointer"
                                title="Quick Record Outflow (CPV)"
                              >
                                - Out
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td className="py-3 px-4">
                        Consolidated Total ({displayedCampuses.length} Campuses)
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-800">
                        {formatPKR(
                          displayedCampuses.reduce((acc, c) => acc + c.inflowTotal, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-800">
                        {formatPKR(
                          displayedCampuses.reduce((acc, c) => acc + c.outflowTotal, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-teal-800">
                        {formatPKR(
                          displayedCampuses.reduce((acc, c) => acc + c.netFlow, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        Total {consolidatedTotals.totalInflowCount + consolidatedTotals.totalOutflowCount} tx
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-900">
                        {formatPKR(
                          displayedCampuses.reduce((acc, c) => acc + c.currentPettyCash, 0)
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* MODE 3: RECHARTS BAR CHART VIEW */}
          {viewMode === 'chart' && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Comparative Cash Flow by Campus ({selectedDate})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Side-by-side comparison of cash inflows (green) vs cash outflows (red) per campus branch
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                    <span>Inflow</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
                    <span>Outflow</span>
                  </span>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={(val) => `Rs. ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        formatPKR(Number(val) || 0),
                        String(name) === 'inflow' ? 'Cash Inflow' : 'Cash Outflow',
                      ]}
                      labelFormatter={(label) => {
                        const match = chartData.find((c) => c.name === label);
                        return match ? match.fullName : label;
                      }}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="inflow"
                      name="Cash Inflow"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="outflow"
                      name="Cash Outflow"
                      fill="#f43f5e"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* DETAILED TRANSACTION AUDIT LOG FOR SELECTED DATE */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Itemized Cash Transactions for {selectedDate} ({filteredRecordsList.length} Entries)
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search payee, narration, voucher #..."
                    className="pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none w-48 sm:w-60 focus:border-emerald-500"
                  />
                </div>

                {/* Filter category */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRecordFilter('all')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      recordFilter === 'all'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordFilter('inflow')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      recordFilter === 'inflow'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-emerald-700'
                    }`}
                  >
                    Inflows
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordFilter('outflow')}
                    className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                      recordFilter === 'outflow'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'text-rose-700'
                    }`}
                  >
                    Outflows
                  </button>
                </div>
              </div>
            </div>

            {filteredRecordsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching cash transaction items found for {selectedDate}.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 max-h-80 overflow-y-auto">
                {filteredRecordsList.map((rec) => {
                  const isInflow = rec.category === 'inflow';
                  return (
                    <div
                      key={rec.id}
                      className="px-4 py-2.5 hover:bg-white transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isInflow
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {rec.voucherNo}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 font-medium">
                              {rec.campusName}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                isInflow
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : 'bg-rose-50 text-rose-800'
                              }`}
                            >
                              {rec.voucherType}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            {rec.narration}
                            {rec.payeeOrReceivedFrom && (
                              <span className="text-slate-400 font-medium">
                                {' '}
                                • {rec.payeeOrReceivedFrom}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-black ${
                            isInflow ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isInflow ? '+' : '-'} {formatPKR(rec.amount)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {rec.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK CASH RECORD MODAL */}
      {quickEntryModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-300 shadow-2xl overflow-hidden space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    quickEntryModal.type === 'inflow'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {quickEntryModal.type === 'inflow' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {quickEntryModal.type === 'inflow'
                      ? 'Record Cash Receipt (CRV)'
                      : 'Record Cash Payment (CPV)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct entry for {selectedDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setQuickEntryModal({ ...quickEntryModal, isOpen: false })
                }
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickEntrySubmit} className="space-y-3.5 text-xs">
              {/* Campus Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Campus Branch
                </label>
                <select
                  value={quickEntryModal.campusId}
                  onChange={(e) =>
                    setQuickEntryModal({
                      ...quickEntryModal,
                      campusId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:border-emerald-500 outline-none"
                  required
                >
                  {campuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cash Amount (PKR)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quickEntryModal.amount}
                  onChange={(e) =>
                    setQuickEntryModal({
                      ...quickEntryModal,
                      amount: e.target.value,
                    })
                  }
                  placeholder="e.g. 25000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold text-sm focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              {/* Payee / Received From */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {quickEntryModal.type === 'inflow'
                    ? 'Received From (Student / Parent / Head)'
                    : 'Paid To (Vendor / Employee / Utility)'}
                </label>
                <input
                  type="text"
                  value={quickEntryModal.payee}
                  onChange={(e) =>
                    setQuickEntryModal({
                      ...quickEntryModal,
                      payee: e.target.value,
                    })
                  }
                  placeholder={
                    quickEntryModal.type === 'inflow'
                      ? 'e.g. Grade 10 Tuition Fee'
                      : 'e.g. Janitorial Maintenance Supply'
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              {/* Narration */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Official Narration / Description
                </label>
                <textarea
                  rows={2}
                  value={quickEntryModal.narration}
                  onChange={(e) =>
                    setQuickEntryModal({
                      ...quickEntryModal,
                      narration: e.target.value,
                    })
                  }
                  placeholder="State the official purpose for cash entry log..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:border-emerald-500 outline-none resize-none"
                  required
                />
              </div>

              {/* Account Head select */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chart of Account Classification
                </label>
                <select
                  value={quickEntryModal.accountHeadId}
                  onChange={(e) =>
                    setQuickEntryModal({
                      ...quickEntryModal,
                      accountHeadId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-emerald-500"
                >
                  <option value="">-- Auto-Assign Standard Account --</option>
                  {accountHeads.map((a) => (
                    <option key={a.id || a.code} value={a.id || a.code}>
                      {a.code} — {a.name} ({a.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() =>
                    setQuickEntryModal({ ...quickEntryModal, isOpen: false })
                  }
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-white font-bold transition-colors cursor-pointer shadow-sm ${
                    quickEntryModal.type === 'inflow'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  Save & Post Cash Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
