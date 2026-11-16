import type { AccountHead, Campus, Transaction } from '../core/aplusEngine';
import {
  resolveCashInHandAccountHeadFromList,
  resolveEffectiveAccountOpeningDrCr,
} from './campusOpeningBalance';

export interface CampusOverviewMetric {
  campusId: string;
  campusName: string;
  campusCode: string;
  city: string;
  isMainCampus: boolean;
  status: Campus['status'];
  cashLedgerBalance: number;
  pettyCashBalance: number;
  totalCashOnHand: number;
  todayVoucherCount: number;
  todayPendingCount: number;
}

export interface CampusDashboardOverviewResult {
  todayIso: string;
  items: CampusOverviewMetric[];
  totalNetworkCashOnHand: number;
  totalCashLedger: number;
  totalPettyCash: number;
  totalTodayVouchers: number;
}

export function getLocalTodayIso(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function resolveCashInHandAccountHead(
  accountHeads: AccountHead[] = []
): AccountHead | undefined {
  return resolveCashInHandAccountHeadFromList(accountHeads);
}

function isCashInHandEntry(entry: any, cashInHandHead?: AccountHead): boolean {
  const entryAccountId = String(entry?.accountId || '').trim();
  const entryCode = String(entry?.accountCode || '').trim();
  const entryName = String(entry?.accountName || '').trim().toLowerCase();

  if (cashInHandHead) {
    if (
      entryAccountId === cashInHandHead.id ||
      entryCode === cashInHandHead.code ||
      (cashInHandHead.accountId && entryCode === cashInHandHead.accountId)
    ) {
      return true;
    }
  }

  return (
    entryAccountId === 'acc-100-4-01' ||
    entryCode === '100-4-01' ||
    entryCode === '1031' ||
    entryCode === '1018' ||
    entryName === 'cash in hand'
  );
}

export function computeCampusCashLedgerBalance(
  campusId: string,
  cashInHandHead: AccountHead | undefined,
  transactions: Transaction[] = [],
  getAccountBalance?: (head: AccountHead, campusId?: string) => number,
  campuses: Campus[] = [],
  accountHeads: AccountHead[] = []
): number {
  if (cashInHandHead && typeof getAccountBalance === 'function') {
    const engineBalance = Number(getAccountBalance(cashInHandHead, campusId));
    if (Number.isFinite(engineBalance)) {
      return engineBalance;
    }
  }

  let openingBalance = 0;
  if (cashInHandHead) {
    openingBalance = resolveEffectiveAccountOpeningDrCr(
      cashInHandHead,
      campusId,
      campuses,
      accountHeads.length > 0 ? accountHeads : [cashInHandHead]
    ).net;
  } else {
    const matchingCampus = campuses.find((c) => c.id === campusId);
    openingBalance = Number(matchingCampus?.openingBalance) || 0;
  }

  let ledgerNet = 0;
  for (const tx of transactions) {
    if (tx.campusId !== campusId) continue;
    for (const entry of tx.entries || []) {
      if (isCashInHandEntry(entry, cashInHandHead)) {
        ledgerNet += (Number(entry.debit) || 0) - (Number(entry.credit) || 0);
      }
    }
  }

  return openingBalance + ledgerNet;
}

export function computeCampusOverviewMetrics({
  campuses = [],
  transactions = [],
  accountHeads = [],
  getAccountBalance,
  todayIso = getLocalTodayIso(),
}: {
  campuses: Campus[];
  transactions: Transaction[];
  accountHeads: AccountHead[];
  getAccountBalance?: (head: AccountHead, campusId?: string) => number;
  todayIso?: string;
}): CampusDashboardOverviewResult {
  const cashInHandHead = resolveCashInHandAccountHead(accountHeads);

  const orderedCampuses = [...campuses].sort((a, b) => {
    const mainDiff = Number(Boolean(b.isMainCampus)) - Number(Boolean(a.isMainCampus));
    if (mainDiff !== 0) return mainDiff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const items: CampusOverviewMetric[] = orderedCampuses.map((campus) => {
    const cashLedgerBalance = computeCampusCashLedgerBalance(
      campus.id,
      cashInHandHead,
      transactions,
      getAccountBalance,
      campuses,
      accountHeads
    );

    const rawPetty =
      campus.currentPettyCash !== undefined && campus.currentPettyCash !== null
        ? campus.currentPettyCash
        : campus.pettyCashFloat;
    const pettyCashBalance = Number(rawPetty) || 0;
    const totalCashOnHand = cashLedgerBalance + pettyCashBalance;

    let todayVoucherCount = 0;
    let todayPendingCount = 0;
    for (const tx of transactions) {
      if (tx.campusId !== campus.id) continue;
      const txDate = String(tx.date || '').slice(0, 10);
      if (txDate !== todayIso) continue;
      todayVoucherCount += 1;
      if (tx.status === 'Pending') {
        todayPendingCount += 1;
      }
    }

    return {
      campusId: campus.id,
      campusName: campus.name || campus.code || 'Unnamed Campus',
      campusCode: campus.code || 'CMP',
      city: campus.city || '',
      isMainCampus: Boolean(campus.isMainCampus),
      status: campus.status || 'active',
      cashLedgerBalance,
      pettyCashBalance,
      totalCashOnHand,
      todayVoucherCount,
      todayPendingCount,
    };
  });

  const totalCashLedger = items.reduce((sum, item) => sum + item.cashLedgerBalance, 0);
  const totalPettyCash = items.reduce((sum, item) => sum + item.pettyCashBalance, 0);
  const totalNetworkCashOnHand = totalCashLedger + totalPettyCash;
  const totalTodayVouchers = items.reduce((sum, item) => sum + item.todayVoucherCount, 0);

  return {
    todayIso,
    items,
    totalNetworkCashOnHand,
    totalCashLedger,
    totalPettyCash,
    totalTodayVouchers,
  };
}

export function formatPkrAmount(amount: number): string {
  const rounded = Math.round(amount || 0);
  const absFormatted = Math.abs(rounded).toLocaleString('en-PK');
  return rounded < 0 ? `-PKR ${absFormatted}` : `PKR ${absFormatted}`;
}
