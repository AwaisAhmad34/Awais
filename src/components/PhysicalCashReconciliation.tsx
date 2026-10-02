import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Banknote,
  Coins,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  RotateCcw,
  Sparkles,
  Save,
  History,
  ArrowRight,
  Building2,
  ShieldCheck,
  FilePlus2,
  Eye,
} from 'lucide-react';
import {
  useAccounting,
  printOrDownloadElement,
  generateElementPdf,
} from '../core/aplusEngine';
import {
  saveCashReconciliationToCloud,
  fetchCashReconciliationsFromCloud,
} from '../services/firebaseSync';

export interface DenominationRow {
  id: string;
  label: string;
  value: number;
  kind: 'note' | 'coin';
  bundles: number; // 1 bundle = 100 pieces for notes
  looseCount: number;
}

export interface CertifiedCashCountRecord {
  id: string;
  certificateNo: string;
  date: string;
  createdAt: string;
  campusId: string;
  campusName: string;
  targetBook: 'cash_in_hand' | 'petty_cash' | 'combined_treasury' | 'custom';
  targetBookLabel: string;
  denominations: DenominationRow[];
  unpostedVouchersInSafe: number;
  iouAdvancesInSafe: number;
  mutilatedNotesInSafe: number;
  physicalNotesTotal: number;
  physicalCoinsTotal: number;
  physicalCurrencyTotal: number;
  adjustedPhysicalTotal: number;
  systemLedgerBalance: number;
  varianceAmount: number;
  status: 'Balanced' | 'Shortage' | 'Overage';
  custodianName: string;
  verifiedByName: string;
  verifiedByUserId: string;
  remarks: string;
}

const INITIAL_DENOMINATIONS: DenominationRow[] = [
  { id: 'note-5000', label: 'PKR 5,000 Note', value: 5000, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-1000', label: 'PKR 1,000 Note', value: 1000, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-500', label: 'PKR 500 Note', value: 500, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-100', label: 'PKR 100 Note', value: 100, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-75', label: 'PKR 75 Commemorative Note', value: 75, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-50', label: 'PKR 50 Note', value: 50, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-20', label: 'PKR 20 Note', value: 20, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'note-10', label: 'PKR 10 Note', value: 10, kind: 'note', bundles: 0, looseCount: 0 },
  { id: 'coin-10', label: 'PKR 10 Coin', value: 10, kind: 'coin', bundles: 0, looseCount: 0 },
  { id: 'coin-5', label: 'PKR 5 Coin', value: 5, kind: 'coin', bundles: 0, looseCount: 0 },
  { id: 'coin-2', label: 'PKR 2 Coin', value: 2, kind: 'coin', bundles: 0, looseCount: 0 },
  { id: 'coin-1', label: 'PKR 1 Coin', value: 1, kind: 'coin', bundles: 0, looseCount: 0 },
];

export const CASH_RECONCILIATION_STORAGE_KEY = 'aplus_physical_cash_reconciliations_v1';
const STORAGE_KEY = CASH_RECONCILIATION_STORAGE_KEY;

type CashRecListener = (
  records: CertifiedCashCountRecord[],
  justCertified?: CertifiedCashCountRecord
) => void;
const cashRecListeners = new Set<CashRecListener>();

export function getStoredCashReconciliations(): CertifiedCashCountRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function subscribeCashReconciliationEvents(fn: CashRecListener) {
  cashRecListeners.add(fn);
  return () => {
    cashRecListeners.delete(fn);
  };
}

export function emitCashReconciliationUpdate(
  records: CertifiedCashCountRecord[],
  justCertified?: CertifiedCashCountRecord
) {
  cashRecListeners.forEach((fn) => fn(records, justCertified));
}

export interface SevenDayCashReconciliationAlert {
  isDue: boolean;
  neverPerformed: boolean;
  daysSinceLast: number | null;
  lastRecord: CertifiedCashCountRecord | null;
  scopeLabel: string;
  headline: string;
  detailMessage: string;
}

export function evaluateSevenDayCashReconciliationStatus(
  campusId: string,
  campuses: any[] = [],
  recordsInput?: CertifiedCashCountRecord[]
): SevenDayCashReconciliationAlert {
  const allRecords = recordsInput ?? getStoredCashReconciliations();
  const scopedRecords =
    !campusId || campusId === 'all'
      ? allRecords
      : allRecords.filter((r) => r.campusId === campusId || r.campusId === 'all');

  const campusObj = (campuses || []).find((c) => c.id === campusId);
  const scopeLabel =
    !campusId || campusId === 'all'
      ? 'All Campuses (Consolidated Safe)'
      : campusObj?.name || 'Current Campus';

  if (scopedRecords.length === 0) {
    return {
      isDue: true,
      neverPerformed: true,
      daysSinceLast: null,
      lastRecord: null,
      scopeLabel,
      headline: 'Physical Cash Reconciliation Required (7-Day Policy)',
      detailMessage: `No physical cash reconciliation has been certified for ${scopeLabel} within the last 7 days. Please count physical PKR notes & coins in the safe and reconcile against the Cash Ledger.`,
    };
  }

  // Sort descending by date / createdAt to find the most recent count
  const sorted = [...scopedRecords].sort((a, b) => {
    const tA = new Date(a.createdAt || a.date).getTime() || 0;
    const tB = new Date(b.createdAt || b.date).getTime() || 0;
    return tB - tA;
  });

  const latest = sorted[0];
  const latestTimestamp =
    new Date(latest.createdAt || latest.date).getTime() || Date.now();
  const diffMs = Math.max(0, Date.now() - latestTimestamp);
  const daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isDue = daysSinceLast >= 7;

  return {
    isDue,
    neverPerformed: false,
    daysSinceLast,
    lastRecord: latest,
    scopeLabel,
    headline: isDue
      ? `Physical Cash Reconciliation Overdue (${daysSinceLast} Days Elapsed)`
      : `Physical Cash Safe Reconciled (${daysSinceLast === 0 ? 'Today' : `${daysSinceLast}d ago`})`,
    detailMessage: isDue
      ? `It has been ${daysSinceLast} days since the last certified physical cash count (${latest.certificateNo} on ${latest.date}) for ${scopeLabel}. Institutional policy requires a physical safe count at least once every 7 days.`
      : `Last certified count ${latest.certificateNo} on ${latest.date} (${latest.status}). Next mandatory count due in ${Math.max(0, 7 - daysSinceLast)} day(s).`,
  };
}

export const PhysicalCashReconciliation: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const {
    accountHeads,
    transactions,
    pettyCashTransactions,
    campuses,
    currentCampusId,
    currentCampus,
    currentUser,
    isSuperAdmin,
    orgSettings,
    addTransaction,
    getNextVoucherNumber,
    logActivity,
  } = useAccounting() as any;

  const [selectedCampusId, setSelectedCampusId] = useState<string>(
    !isSuperAdmin && currentUser?.campusId
      ? currentUser.campusId
      : currentCampusId || 'all'
  );

  useEffect(() => {
    if (!isSuperAdmin && currentUser?.campusId) {
      setSelectedCampusId(currentUser.campusId);
    } else if (currentCampusId) {
      setSelectedCampusId(currentCampusId);
    }
  }, [currentCampusId, isSuperAdmin, currentUser]);

  const [targetBook, setTargetBook] = useState<
    'cash_in_hand' | 'petty_cash' | 'combined_treasury' | 'custom'
  >('cash_in_hand');
  const [customLedgerBalance, setCustomLedgerBalance] = useState<number>(0);
  const [countDate, setCountDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );

  const [denominations, setDenominations] = useState<DenominationRow[]>(
    INITIAL_DENOMINATIONS
  );

  // Reconciling cash equivalents held inside the physical safe
  const [unpostedVouchersInSafe, setUnpostedVouchersInSafe] = useState<number>(0);
  const [iouAdvancesInSafe, setIouAdvancesInSafe] = useState<number>(0);
  const [mutilatedNotesInSafe, setMutilatedNotesInSafe] = useState<number>(0);

  const activeCampusObj =
    campuses.find((c: any) => c.id === selectedCampusId) || currentCampus || campuses[0];

  const [custodianName, setCustodianName] = useState<string>(
    activeCampusObj?.accountantName || currentUser?.name || 'Campus Cashier'
  );
  const [verifiedByName, setVerifiedByName] = useState<string>(
    currentUser?.name || 'Director Finance / Internal Auditor'
  );
  const [remarks, setRemarks] = useState<string>(
    'Physical cash in safe counted denomination-by-denomination and verified against system ledger book balance.'
  );

  const [savedRecords, setSavedRecords] = useState<CertifiedCashCountRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const printSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCashReconciliationsFromCloud().then((cloudList) => {
      if (Array.isArray(cloudList) && cloudList.length > 0) {
        setSavedRecords((prev) => {
          const map = new Map<string, CertifiedCashCountRecord>();
          prev.forEach((r) => map.set(r.id, r));
          cloudList.forEach((r: any) => {
            if (r?.id && !map.has(r.id)) {
              map.set(r.id, r as CertifiedCashCountRecord);
            }
          });
          const merged = Array.from(map.values()).sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {}
          emitCashReconciliationUpdate(merged);
          return merged;
        });
      }
    });
  }, []);

  // Locate 100-4-01 [1031] Cash In Hand account head
  const cashInHandAccount = useMemo(() => {
    return (
      accountHeads.find(
        (a: any) =>
          a.code === '100-4-01' ||
          a.accountId === '1031' ||
          a.code === '1031' ||
          a.name?.toLowerCase() === 'cash in hand'
      ) || accountHeads[0]
    );
  }, [accountHeads]);

  // Compute detailed Cash In Hand (100-4-01) Ledger Breakdown & Petty Cash Imprest Balance
  const ledgerBreakdown = useMemo(() => {
    // 1. Cash In Hand (100-4-01) from vouchers + base balance
    let totalCashDebits = 0;
    let totalCashCredits = 0;
    let cashTxCount = 0;

    const relevantTxs = (transactions || []).filter((tx: any) => {
      if (tx.status === 'Rejected' || tx.status === 'Cancelled') return false;
      if (selectedCampusId !== 'all' && tx.campusId !== selectedCampusId) {
        return false;
      }
      return true;
    });

    relevantTxs.forEach((tx: any) => {
      (tx.entries || []).forEach((ent: any) => {
        const isCashHead =
          (cashInHandAccount &&
            (ent.accountId === cashInHandAccount.id ||
              ent.accountCode === cashInHandAccount.code ||
              ent.accountCode === '1031' ||
              ent.accountCode === '100-4-01')) ||
          ent.accountName?.toLowerCase() === 'cash in hand';
        if (isCashHead) {
          totalCashDebits += Number(ent.debit) || 0;
          totalCashCredits += Number(ent.credit) || 0;
          cashTxCount++;
        }
      });
    });

    const netVoucherMovement = totalCashDebits - totalCashCredits;
    const baseAccountBalance = Number(cashInHandAccount?.balance) || 0;
    const cashInHandLedgerBalance =
      selectedCampusId === 'all'
        ? Math.max(baseAccountBalance, netVoucherMovement)
        : netVoucherMovement !== 0
        ? netVoucherMovement
        : Math.round(baseAccountBalance / Math.max(1, campuses.length));

    // 2. Petty Cash Imprest Balance
    const pettyCashLedgerBalance =
      selectedCampusId === 'all'
        ? campuses.reduce(
            (sum: number, c: any) => sum + (Number(c.currentPettyCash) || 0),
            0
          )
        : Number(activeCampusObj?.currentPettyCash) || 0;

    const combinedTreasuryBalance =
      cashInHandLedgerBalance + pettyCashLedgerBalance;

    return {
      cashInHandLedgerBalance,
      totalCashDebits,
      totalCashCredits,
      cashTxCount,
      pettyCashLedgerBalance,
      combinedTreasuryBalance,
    };
  }, [
    transactions,
    cashInHandAccount,
    selectedCampusId,
    campuses,
    activeCampusObj,
  ]);

  const systemLedgerBalance = useMemo(() => {
    if (targetBook === 'cash_in_hand') {
      return ledgerBreakdown.cashInHandLedgerBalance;
    }
    if (targetBook === 'petty_cash') {
      return ledgerBreakdown.pettyCashLedgerBalance;
    }
    if (targetBook === 'combined_treasury') {
      return ledgerBreakdown.combinedTreasuryBalance;
    }
    return Number(customLedgerBalance) || 0;
  }, [targetBook, ledgerBreakdown, customLedgerBalance]);

  const targetBookLabel = useMemo(() => {
    switch (targetBook) {
      case 'cash_in_hand':
        return `100-4-01 [1031] — Cash In Hand (General Ledger)`;
      case 'petty_cash':
        return `Imprest Petty Cash Box Balance`;
      case 'combined_treasury':
        return `Combined Campus Treasury (Cash In Hand + Petty Cash Box)`;
      case 'custom':
        return `Custom / Cut-Off Book Balance`;
    }
  }, [targetBook]);

  // Calculate physical currency totals
  const physicalTotals = useMemo(() => {
    let notesTotal = 0;
    let coinsTotal = 0;
    let totalPieces = 0;

    denominations.forEach((row) => {
      const pieces =
        row.kind === 'note'
          ? (Number(row.bundles) || 0) * 100 + (Number(row.looseCount) || 0)
          : Number(row.looseCount) || 0;
      const subtotal = pieces * row.value;
      totalPieces += pieces;
      if (row.kind === 'note') notesTotal += subtotal;
      else coinsTotal += subtotal;
    });

    const currencyTotal = notesTotal + coinsTotal;
    const reconcilingItemsTotal =
      (Number(unpostedVouchersInSafe) || 0) +
      (Number(iouAdvancesInSafe) || 0) +
      (Number(mutilatedNotesInSafe) || 0);
    const adjustedPhysicalTotal = currencyTotal + reconcilingItemsTotal;
    const variance = adjustedPhysicalTotal - systemLedgerBalance;

    let status: 'Balanced' | 'Shortage' | 'Overage' = 'Balanced';
    if (Math.abs(variance) < 1) status = 'Balanced';
    else if (variance < 0) status = 'Shortage';
    else status = 'Overage';

    return {
      notesTotal,
      coinsTotal,
      totalPieces,
      currencyTotal,
      reconcilingItemsTotal,
      adjustedPhysicalTotal,
      variance,
      status,
    };
  }, [
    denominations,
    unpostedVouchersInSafe,
    iouAdvancesInSafe,
    mutilatedNotesInSafe,
    systemLedgerBalance,
  ]);

  const handleUpdateDenomination = (
    id: string,
    field: 'bundles' | 'looseCount',
    rawVal: number
  ) => {
    const cleanVal = Math.max(0, Math.floor(Number(rawVal) || 0));
    setDenominations((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: cleanVal } : row))
    );
  };

  // Smart helper: Distribute target ledger balance across standard PKR denominations
  const handleAutoMatchLedger = () => {
    let remaining = Math.max(
      0,
      Math.round(
        systemLedgerBalance -
          ((Number(unpostedVouchersInSafe) || 0) +
            (Number(iouAdvancesInSafe) || 0) +
            (Number(mutilatedNotesInSafe) || 0))
      )
    );

    const updated = INITIAL_DENOMINATIONS.map((row) => ({ ...row }));
    const setPieces = (id: string, pieces: number) => {
      const target = updated.find((r) => r.id === id);
      if (!target) return;
      if (target.kind === 'note') {
        target.bundles = Math.floor(pieces / 100);
        target.looseCount = pieces % 100;
      } else {
        target.bundles = 0;
        target.looseCount = pieces;
      }
    };

    // Allocate realistic mix across 5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1
    const order = [
      'note-5000',
      'note-1000',
      'note-500',
      'note-100',
      'note-50',
      'note-20',
      'note-10',
      'coin-5',
      'coin-2',
      'coin-1',
    ];
    order.forEach((id) => {
      const row = updated.find((r) => r.id === id);
      if (!row || remaining <= 0) return;
      const count = Math.floor(remaining / row.value);
      setPieces(id, count);
      remaining -= count * row.value;
    });

    setDenominations(updated);
    setBannerMessage(
      `Denominations auto-populated to match system ledger balance of PKR ${systemLedgerBalance.toLocaleString()}. Adjust any individual note counts as counted from the safe.`
    );
    setTimeout(() => setBannerMessage(null), 5000);
  };

  const handleClearCounts = () => {
    setDenominations(INITIAL_DENOMINATIONS.map((r) => ({ ...r })));
    setUnpostedVouchersInSafe(0);
    setIouAdvancesInSafe(0);
    setMutilatedNotesInSafe(0);
  };

  const handleCertifyAndSave = async () => {
    const certNo = `PCR-${
      activeCampusObj?.code?.replace('CAMPUS-', 'C') || 'ALL'
    }-${new Date().getFullYear().toString().slice(-2)}-${String(
      savedRecords.length + 1
    ).padStart(3, '0')}`;

    const record: CertifiedCashCountRecord = {
      id: `cashrec-${Date.now()}`,
      certificateNo: certNo,
      date: countDate,
      createdAt: new Date().toISOString(),
      campusId: selectedCampusId,
      campusName:
        selectedCampusId === 'all'
          ? 'All Campuses (Consolidated)'
          : activeCampusObj?.name || 'Campus Branch',
      targetBook,
      targetBookLabel,
      denominations: denominations.map((d) => ({ ...d })),
      unpostedVouchersInSafe: Number(unpostedVouchersInSafe) || 0,
      iouAdvancesInSafe: Number(iouAdvancesInSafe) || 0,
      mutilatedNotesInSafe: Number(mutilatedNotesInSafe) || 0,
      physicalNotesTotal: physicalTotals.notesTotal,
      physicalCoinsTotal: physicalTotals.coinsTotal,
      physicalCurrencyTotal: physicalTotals.currencyTotal,
      adjustedPhysicalTotal: physicalTotals.adjustedPhysicalTotal,
      systemLedgerBalance,
      varianceAmount: physicalTotals.variance,
      status: physicalTotals.status,
      custodianName,
      verifiedByName,
      verifiedByUserId: currentUser?.id || 'user-admin',
      remarks,
    };

    const nextList = [record, ...savedRecords];
    setSavedRecords(nextList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch {}
    emitCashReconciliationUpdate(nextList, record);

    await saveCashReconciliationToCloud(record);

    logActivity(
      'CASH_RECONCILIATION',
      'System',
      certNo,
      `Certified Physical Cash Reconciliation ${certNo} (${record.targetBookLabel}): Physical Count PKR ${record.adjustedPhysicalTotal.toLocaleString()} vs Ledger PKR ${record.systemLedgerBalance.toLocaleString()} | Variance: PKR ${record.varianceAmount.toLocaleString()} (${record.status})`,
      selectedCampusId,
      record.adjustedPhysicalTotal,
      {
        certificateNo: certNo,
        physicalTotal: record.adjustedPhysicalTotal,
        ledgerBalance: record.systemLedgerBalance,
        variance: record.varianceAmount,
        status: record.status,
      }
    );

    setBannerMessage(
      `Certified Physical Cash Reconciliation ${certNo} saved to Ledger & Firebase Cloud and logged in the Secure Audit Trail!`
    );
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // Post adjustment voucher (CPV for Shortage, CRV for Overage)
  const handlePostVarianceAdjustmentVoucher = () => {
    const absDiff = Math.abs(Math.round(physicalTotals.variance));
    if (absDiff < 1) return;

    const isShortage = physicalTotals.variance < 0;
    const vType = isShortage ? 'CPV' : 'CRV';
    const campusTarget =
      selectedCampusId === 'all'
        ? campuses[0]?.id || 'campus-khiali'
        : selectedCampusId;
    const vNo = getNextVoucherNumber(vType, campusTarget);

    const miscExpenseHead =
      accountHeads.find(
        (a: any) =>
          a.code === '500-4-16' ||
          a.accountId === '5028' ||
          a.name?.toLowerCase().includes('miscellaneous')
      ) || accountHeads.find((a: any) => a.category === 'Expense');

    const otherIncomeHead =
      accountHeads.find(
        (a: any) =>
          a.code === '400-5-01' ||
          a.accountId === '4008' ||
          a.name?.toLowerCase().includes('other income')
      ) || accountHeads.find((a: any) => a.category === 'Revenue');

    const entries = isShortage
      ? [
          {
            id: '1',
            accountId: miscExpenseHead?.id || 'acc-5028',
            accountCode: miscExpenseHead?.code || '500-4-16',
            accountName: miscExpenseHead?.name || 'Miscellaneous Expense',
            description: `Physical cash shortage adjustment on ${countDate}`,
            debit: absDiff,
            credit: 0,
            refCheckNo: 'CASH-ADJ',
          },
          {
            id: '2',
            accountId: cashInHandAccount?.id || 'acc-1031',
            accountCode: cashInHandAccount?.code || '100-4-01',
            accountName: cashInHandAccount?.name || 'Cash In Hand',
            description: `Physical cash shortage adjustment on ${countDate}`,
            debit: 0,
            credit: absDiff,
            refCheckNo: 'CASH-ADJ',
          },
        ]
      : [
          {
            id: '1',
            accountId: cashInHandAccount?.id || 'acc-1031',
            accountCode: cashInHandAccount?.code || '100-4-01',
            accountName: cashInHandAccount?.name || 'Cash In Hand',
            description: `Physical cash overage adjustment on ${countDate}`,
            debit: absDiff,
            credit: 0,
            refCheckNo: 'CASH-ADJ',
          },
          {
            id: '2',
            accountId: otherIncomeHead?.id || 'acc-4008',
            accountCode: otherIncomeHead?.code || '400-5-01',
            accountName: otherIncomeHead?.name || 'Other Income',
            description: `Physical cash overage adjustment on ${countDate}`,
            debit: 0,
            credit: absDiff,
            refCheckNo: 'CASH-ADJ',
          },
        ];

    addTransaction({
      voucherNo: vNo,
      voucherType: vType,
      campusId: campusTarget,
      date: countDate,
      narration: `Physical Cash Reconciliation ${
        isShortage ? 'Shortage' : 'Overage'
      } Adjustment (${targetBookLabel}) verified by ${verifiedByName}`,
      chequeNo: 'CASH-ADJ',
      entries,
      totalDebit: absDiff,
      totalCredit: absDiff,
      status: 'Approved',
      preparedBy: custodianName,
      approvedBy: verifiedByName,
    });

    setBannerMessage(
      `Posted ${vType} Adjustment Voucher ${vNo} for PKR ${absDiff.toLocaleString()} to reconcile System Ledger with Physical Cash!`
    );
    setTimeout(() => setBannerMessage(null), 5000);
  };

  const handlePrintCertificate = async () => {
    if (!printSheetRef.current) return;
    await printOrDownloadElement(printSheetRef.current, {
      title: `${orgSettings?.schoolName || 'A+ School System'} — Physical Cash Reconciliation Certificate`,
      fallbackFileName: `Physical_Cash_Reconciliation_${countDate}`,
      orientation: 'portrait',
    });
  };

  const handleDownloadPdf = async () => {
    if (!printSheetRef.current || busyPdf) return;
    setBusyPdf(true);
    try {
      await generateElementPdf(
        printSheetRef.current,
        `Physical_Cash_Reconciliation_${countDate}.pdf`,
        'portrait'
      );
    } finally {
      setBusyPdf(false);
    }
  };

  const loadHistoricalRecord = (rec: CertifiedCashCountRecord) => {
    setSelectedCampusId(rec.campusId);
    setTargetBook(rec.targetBook);
    setCountDate(rec.date);
    setDenominations(rec.denominations.map((d) => ({ ...d })));
    setUnpostedVouchersInSafe(rec.unpostedVouchersInSafe || 0);
    setIouAdvancesInSafe(rec.iouAdvancesInSafe || 0);
    setMutilatedNotesInSafe(rec.mutilatedNotesInSafe || 0);
    setCustodianName(rec.custodianName);
    setVerifiedByName(rec.verifiedByName);
    setRemarks(rec.remarks);
    setBannerMessage(`Loaded certified cash count ${rec.certificateNo} (${rec.date}).`);
    setTimeout(() => setBannerMessage(null), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
      {/* Top Executive Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
              <Banknote className="w-4 h-4 shrink-0" />
              <span>
                TREASURY & SAFE VERIFICATION • PKR DENOMINATION MATRIX VS SYSTEM LEDGER
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              Physical Cash Reconciliation & Denomination Count
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Count physical Pakistani Rupee (PKR) currency notes and coins in the campus treasury safe and reconcile directly against{' '}
              <strong className="text-white">
                100-4-01 [1031] Cash In Hand
              </strong>{' '}
              or the <strong className="text-white">Imprest Petty Cash Float</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAutoMatchLedger}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Pre-fill PKR note denominations to match current system ledger balance"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Fill Notes from Ledger</span>
            </button>
            <button
              type="button"
              onClick={handleClearCounts}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Count</span>
            </button>
            <button
              type="button"
              onClick={handleCertifyAndSave}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Certify & Save Count</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={busyPdf}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-300" />
              <span>{busyPdf ? 'Generating...' : 'PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintCertificate}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span>Print A4 Certificate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-950 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{bannerMessage}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Configuration & Live Reconciliation KPI Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
        {/* Left: Campus, Ledger Book & Date Selectors */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3.5">
          <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
            1. Select Campus & System Ledger Book
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Campus Treasury Scope
              </label>
              <select
                value={selectedCampusId}
                onChange={(e) => setSelectedCampusId(e.target.value)}
                disabled={!isSuperAdmin}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-60"
              >
                <option value="all">All Campuses (Consolidated)</option>
                {campuses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Verification Cut-Off Date
              </label>
              <input
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              System Ledger Book to Compare Against
            </label>
            <select
              value={targetBook}
              onChange={(e) => setTargetBook(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
            >
              <option value="cash_in_hand">
                100-4-01 [1031] — Cash In Hand (PKR{' '}
                {ledgerBreakdown.cashInHandLedgerBalance.toLocaleString()})
              </option>
              <option value="petty_cash">
                Imprest Petty Cash Float Box (PKR{' '}
                {ledgerBreakdown.pettyCashLedgerBalance.toLocaleString()})
              </option>
              <option value="combined_treasury">
                Combined Campus Treasury: Cash In Hand + Petty Cash (PKR{' '}
                {ledgerBreakdown.combinedTreasuryBalance.toLocaleString()})
              </option>
              <option value="custom">
                Custom / Manual Cut-Off Book Balance Override
              </option>
            </select>
          </div>

          {targetBook === 'custom' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Enter Custom Ledger Balance (PKR)
              </label>
              <input
                type="number"
                value={customLedgerBalance || ''}
                onChange={(e) => setCustomLedgerBalance(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
              />
            </div>
          )}
        </div>

        {/* Right: Live Comparison KPI Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Physical Cash Counted */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Physical Cash in Safe
              </div>
              <div className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1.5">
                PKR {physicalTotals.adjustedPhysicalTotal.toLocaleString()}
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5 font-mono">
              <div>Notes: PKR {physicalTotals.notesTotal.toLocaleString()}</div>
              <div>Coins: PKR {physicalTotals.coinsTotal.toLocaleString()}</div>
              {physicalTotals.reconcilingItemsTotal > 0 && (
                <div className="text-blue-700 font-bold">
                  + Safe Vouchers: PKR{' '}
                  {physicalTotals.reconcilingItemsTotal.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: System Ledger Balance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                System Ledger Balance
              </div>
              <div className="text-2xl font-black font-mono tabular-nums text-blue-700 mt-1.5">
                PKR {systemLedgerBalance.toLocaleString()}
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5 font-mono">
              <div className="truncate font-sans font-semibold text-slate-800">
                {targetBookLabel}
              </div>
              <div>
                CRV Receipts: PKR {ledgerBreakdown.totalCashDebits.toLocaleString()}
              </div>
              <div>
                CPV Payments: PKR {ledgerBreakdown.totalCashCredits.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 3: Variance & Status */}
          <div
            className={`rounded-2xl border p-5 shadow-2xs flex flex-col justify-between ${
              physicalTotals.status === 'Balanced'
                ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                : physicalTotals.status === 'Shortage'
                ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                : 'bg-amber-50/90 border-amber-300 text-amber-950'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Reconciliation Variance
              </div>
              <div className="text-2xl font-black font-mono tabular-nums mt-1.5">
                {physicalTotals.variance > 0 ? '+' : ''}PKR{' '}
                {physicalTotals.variance.toLocaleString()}
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-current/15 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-black">
                {physicalTotals.status === 'Balanced' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>RECONCILED & BALANCED</span>
                  </>
                ) : physicalTotals.status === 'Shortage' ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>CASH SHORTAGE (DEFICIT)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>CASH OVERAGE (SURPLUS)</span>
                  </>
                )}
              </div>

              {physicalTotals.status !== 'Balanced' && (
                <button
                  type="button"
                  onClick={handlePostVarianceAdjustmentVoucher}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  <span>
                    Post {physicalTotals.status === 'Shortage' ? 'CPV' : 'CRV'}{' '}
                    Adjustment
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Printable A4 Physical Cash Verification Sheet */}
      <div
        ref={printSheetRef}
        id="physical-cash-reconciliation-sheet"
        className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden p-5 sm:p-8 space-y-6"
      >
        {/* Sheet Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b-2 border-slate-900">
          <div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-600">
              {orgSettings?.schoolName || 'A+ School System'} • Treasury Verification Standard
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-0.5">
              Physical Cash Reconciliation & Currency Denomination Statement
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Target Ledger Book: <strong>{targetBookLabel}</strong>
            </p>
          </div>

          <div className="text-right font-mono text-xs space-y-0.5">
            <div className="font-bold text-slate-900">
              Campus:{' '}
              {selectedCampusId === 'all'
                ? 'All Campuses (Consolidated)'
                : activeCampusObj?.name || 'Campus'}
            </div>
            <div className="text-slate-600">Verification Date: {countDate}</div>
            <div className="text-slate-600">
              Status:{' '}
              <strong
                className={
                  physicalTotals.status === 'Balanced'
                    ? 'text-emerald-700'
                    : physicalTotals.status === 'Shortage'
                    ? 'text-rose-700'
                    : 'text-amber-700'
                }
              >
                {physicalTotals.status.toUpperCase()}
              </strong>
            </div>
          </div>
        </div>

        {/* Denomination Count Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-bold text-[11px] divide-x divide-slate-700">
                <th className="py-2.5 px-3 w-12 text-center">Sr #</th>
                <th className="py-2.5 px-3">Currency Denomination (PKR)</th>
                <th className="py-2.5 px-3 w-24 text-center">Type</th>
                <th className="py-2.5 px-3 w-28 text-right font-mono">Face Value</th>
                <th className="py-2.5 px-3 w-40 text-center">
                  Bundles (×100 Notes)
                </th>
                <th className="py-2.5 px-3 w-44 text-center">
                  Loose Notes / Coins
                </th>
                <th className="py-2.5 px-3 w-28 text-right font-mono">
                  Total Pieces
                </th>
                <th className="py-2.5 px-3 w-36 text-right font-mono">
                  Total Amount (PKR)
                </th>
                <th className="py-2.5 px-3 w-20 text-right font-mono">Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {denominations.map((row, idx) => {
                const totalPieces =
                  row.kind === 'note'
                    ? (Number(row.bundles) || 0) * 100 +
                      (Number(row.looseCount) || 0)
                    : Number(row.looseCount) || 0;
                const rowSubtotal = totalPieces * row.value;
                const pct =
                  physicalTotals.currencyTotal > 0
                    ? ((rowSubtotal / physicalTotals.currencyTotal) * 100).toFixed(1)
                    : '0.0';

                return (
                  <tr
                    key={row.id}
                    className={`divide-x divide-slate-200 ${
                      totalPieces > 0 ? 'bg-blue-50/30' : 'bg-white'
                    } hover:bg-slate-50 transition-colors`}
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900 flex items-center gap-2">
                      {row.kind === 'note' ? (
                        <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Coins className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{row.label}</span>
                    </td>
                    <td className="py-2 px-3 text-center text-[11px] text-slate-600 capitalize">
                      {row.kind}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                      Rs. {row.value.toLocaleString()}
                    </td>

                    {/* Bundles Input (Notes Only) */}
                    <td className="py-1.5 px-3 text-center">
                      {row.kind === 'note' ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDenomination(
                                row.id,
                                'bundles',
                                row.bundles - 1
                              )
                            }
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold print:hidden cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={row.bundles || ''}
                            placeholder="0"
                            onChange={(e) =>
                              handleUpdateDenomination(
                                row.id,
                                'bundles',
                                Number(e.target.value)
                              )
                            }
                            className="w-16 text-center py-1 px-1.5 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                          />
                          <span className="hidden print:inline font-mono font-bold">
                            {row.bundles}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateDenomination(
                                row.id,
                                'bundles',
                                row.bundles + 1
                              )
                            }
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold print:hidden cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Loose Count Input */}
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDenomination(
                              row.id,
                              'looseCount',
                              row.looseCount - 1
                            )
                          }
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold print:hidden cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          value={row.looseCount || ''}
                          placeholder="0"
                          onChange={(e) =>
                            handleUpdateDenomination(
                              row.id,
                              'looseCount',
                              Number(e.target.value)
                            )
                          }
                          className="w-20 text-center py-1 px-1.5 border border-slate-300 rounded font-mono font-bold text-slate-900 bg-white"
                        />
                        <span className="hidden print:inline font-mono font-bold">
                          {row.looseCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateDenomination(
                              row.id,
                              'looseCount',
                              row.looseCount + 1
                            )
                          }
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold print:hidden cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    {/* Total Pieces */}
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 tabular-nums">
                      {totalPieces.toLocaleString()}
                    </td>

                    {/* Subtotal PKR */}
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-900 tabular-nums">
                      {rowSubtotal.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Share % */}
                    <td className="py-2 px-3 text-right font-mono text-slate-500 tabular-nums">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-900 font-black text-slate-900 divide-x divide-slate-300">
                <td colSpan={6} className="py-2.5 px-3 text-right uppercase">
                  Total Physical Currency Counted (Notes + Coins):
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {physicalTotals.totalPieces.toLocaleString()} pcs
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-sm tabular-nums">
                  PKR{' '}
                  {physicalTotals.currencyTotal.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-2.5 px-3 text-right font-mono">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Safe Reconciling Items & Final Reconciliation Summary Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Left: Safe Reconciling Items & Custodian Inputs */}
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Cash-Equivalent Reconciling Items in Safe (Optional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Unposted Vouchers in Safe (PKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={unpostedVouchersInSafe || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setUnpostedVouchersInSafe(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Staff IOUs / Advances in Safe
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={iouAdvancesInSafe || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setIouAdvancesInSafe(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Mutilated / Damaged Notes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={mutilatedNotesInSafe || ''}
                    placeholder="0"
                    onChange={(e) =>
                      setMutilatedNotesInSafe(Math.max(0, Number(e.target.value)))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Cashier / Treasury Custodian Name
                </label>
                <input
                  type="text"
                  value={custodianName}
                  onChange={(e) => setCustodianName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Verifying Officer / Internal Auditor
                </label>
                <input
                  type="text"
                  value={verifiedByName}
                  onChange={(e) => setVerifiedByName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Verification Remarks & Audit Observations
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          </div>

          {/* Right: Formal Reconciliation Statement Box */}
          <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 font-black uppercase tracking-wider">
              Formal Cash Book vs. Physical Safe Reconciliation Summary
            </div>
            <div className="divide-y divide-slate-200">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-700 font-medium">
                  A. Physical Currency Notes Counted
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  PKR {physicalTotals.notesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-700 font-medium">
                  B. Physical Metallic Coins Counted
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  PKR {physicalTotals.coinsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-700 font-medium">
                  C. Cash-Equivalent Vouchers / IOUs in Safe
                </span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  PKR {physicalTotals.reconcilingItemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-slate-100 font-black text-slate-900">
                <span>Total Adjusted Physical Cash in Safe (A + B + C)</span>
                <span className="font-mono tabular-nums">
                  PKR {physicalTotals.adjustedPhysicalTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between bg-blue-50/60 font-bold text-blue-950">
                <span>Less: System Ledger Balance ({targetBookLabel})</span>
                <span className="font-mono tabular-nums">
                  PKR {systemLedgerBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div
                className={`px-4 py-3 flex justify-between font-black text-sm ${
                  physicalTotals.status === 'Balanced'
                    ? 'bg-emerald-100 text-emerald-950'
                    : physicalTotals.status === 'Shortage'
                    ? 'bg-rose-100 text-rose-950'
                    : 'bg-amber-100 text-amber-950'
                }`}
              >
                <span>
                  Net Difference / Variance ({physicalTotals.status.toUpperCase()})
                </span>
                <span className="font-mono tabular-nums">
                  {physicalTotals.variance > 0 ? '+' : ''}PKR{' '}
                  {physicalTotals.variance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Column Institutional Signatory Matrix */}
        <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs break-inside-avoid">
          <div className="border-t-2 border-slate-900 pt-2">
            <div className="font-black text-slate-900">{custodianName}</div>
            <div className="text-[11px] text-slate-600">
              Cashier / Safe Custodian
            </div>
          </div>
          <div className="border-t-2 border-slate-900 pt-2">
            <div className="font-black text-slate-900">
              {activeCampusObj?.accountantName || 'Campus Accountant'}
            </div>
            <div className="text-[11px] text-slate-600">Campus Accountant</div>
          </div>
          <div className="border-t-2 border-slate-900 pt-2">
            <div className="font-black text-slate-900">{verifiedByName}</div>
            <div className="text-[11px] text-slate-600">
              Verifying Officer / Auditor
            </div>
          </div>
          <div className="border-t-2 border-slate-900 pt-2">
            <div className="font-black text-slate-900">Director Finance</div>
            <div className="text-[11px] text-slate-600">
              Executive Authorization
            </div>
          </div>
        </div>
      </div>

      {/* Saved / Certified Cash Count Certificates History */}
      {savedRecords.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-300 shadow-xs overflow-hidden print:hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700" />
              <h3 className="text-sm font-black text-slate-900">
                Certified Physical Cash Count History ({savedRecords.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">
              Click any certificate to reload its denomination breakdown
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-3">Certificate No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Campus</th>
                  <th className="py-2.5 px-3">Target Book</th>
                  <th className="py-2.5 px-3 text-right">Physical Count</th>
                  <th className="py-2.5 px-3 text-right">Ledger Balance</th>
                  <th className="py-2.5 px-3 text-right">Variance</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Verified By</th>
                  <th className="py-2.5 px-3 text-center">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {savedRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => loadHistoricalRecord(rec)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-800">
                      {rec.certificateNo}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{rec.date}</td>
                    <td className="py-2.5 px-3 font-semibold">{rec.campusName}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {rec.targetBookLabel}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      PKR {Number(rec.adjustedPhysicalTotal).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      PKR {Number(rec.systemLedgerBalance).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold">
                      {rec.varianceAmount > 0 ? '+' : ''}PKR{' '}
                      {Number(rec.varianceAmount).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      <span
                        className={
                          rec.status === 'Balanced'
                            ? 'text-emerald-700'
                            : rec.status === 'Shortage'
                            ? 'text-rose-700'
                            : 'text-amber-700'
                        }
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {rec.verifiedByName}{' '}
                      <span className="font-mono text-[10px] text-slate-400">
                        ({rec.verifiedByUserId})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        className="p-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
