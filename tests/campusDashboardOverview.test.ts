import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AccountHead, Campus, Transaction } from '../src/core/aplusEngine';
import {
  computeCampusCashLedgerBalance,
  computeCampusOverviewMetrics,
  getLocalTodayIso,
  resolveCashInHandAccountHead,
} from '../src/utils/campusOverviewMetrics';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('resolveCashInHandAccountHead locates canonical Cash In Hand account head across code/id/name variants', () => {
  const headByCode: AccountHead = {
    id: 'acc-100-4-01',
    accountId: '1031',
    code: '100-4-01',
    ledgerCode: '100-4-01',
    name: 'Cash In Hand',
    category: 'Asset',
    type: 'Bank',
    balance: 0,
    mainCode: '100',
    mainAccount: 'Assets',
    groupCode: '100-4',
    groupName: 'Cash & Bank',
  };

  assert.equal(resolveCashInHandAccountHead([headByCode])?.id, 'acc-100-4-01');

  const legacyHead: AccountHead = {
    ...headByCode,
    id: 'legacy-cash',
    accountId: '1018',
    code: '1018',
    ledgerCode: '1018',
    name: 'Cash in Hand',
  };
  assert.equal(resolveCashInHandAccountHead([legacyHead])?.id, 'legacy-cash');
});

test('computeCampusOverviewMetrics combines Cash in Hand ledger + Petty Cash float and counts all today vouchers across all statuses', () => {
  const today = '2026-11-14';
  const yesterday = '2026-11-13';

  const cashHead: AccountHead = {
    id: 'acc-100-4-01',
    accountId: '1031',
    code: '100-4-01',
    ledgerCode: '100-4-01',
    name: 'Cash In Hand',
    category: 'Asset',
    type: 'Bank',
    balance: 0,
    mainCode: '100',
    mainAccount: 'Assets',
    groupCode: '100-4',
    groupName: 'Cash & Bank',
    campusBalances: {
      'campus-main': 100000,
      'campus-sub': 25000,
    },
  };

  const campuses: Campus[] = [
    {
      id: 'campus-sub',
      code: 'CVT',
      name: 'Canal View Sub-Campus',
      city: 'Gujranwala',
      pettyCashFloat: 15000,
      currentPettyCash: 12500,
      status: 'active',
      isMainCampus: false,
    },
    {
      id: 'campus-main',
      code: 'KHL',
      name: 'Khiali Main Campus',
      city: 'Gujranwala',
      pettyCashFloat: 50000,
      currentPettyCash: 40000,
      status: 'active',
      isMainCampus: true,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-1',
      voucherNo: 'CRV-001',
      voucherType: 'CRV',
      campusId: 'campus-main',
      date: today,
      narration: 'Fee receipts',
      status: 'Approved',
      totalDebit: 30000,
      totalCredit: 30000,
      entries: [
        {
          id: 'e1',
          accountId: 'acc-100-4-01',
          accountCode: '100-4-01',
          accountName: 'Cash In Hand',
          description: 'Debit cash',
          debit: 30000,
          credit: 0,
        },
      ],
    },
    {
      id: 'tx-2',
      voucherNo: 'CPV-002',
      voucherType: 'CPV',
      campusId: 'campus-main',
      date: `${today}T10:15:00`,
      narration: 'Stationery pending approval',
      status: 'Pending',
      totalDebit: 5000,
      totalCredit: 5000,
      entries: [
        {
          id: 'e2',
          accountId: 'acc-100-4-01',
          accountCode: '100-4-01',
          accountName: 'Cash In Hand',
          description: 'Credit cash',
          debit: 0,
          credit: 5000,
        },
      ],
    },
    {
      id: 'tx-3',
      voucherNo: 'JV-003',
      voucherType: 'JV',
      campusId: 'campus-main',
      date: today,
      narration: 'Rejected draft test',
      status: 'Rejected',
      totalDebit: 1000,
      totalCredit: 1000,
      entries: [],
    },
    {
      id: 'tx-4',
      voucherNo: 'CRV-004',
      voucherType: 'CRV',
      campusId: 'campus-main',
      date: yesterday,
      narration: 'Yesterday receipt',
      status: 'Posted',
      totalDebit: 20000,
      totalCredit: 20000,
      entries: [
        {
          id: 'e4',
          accountId: 'acc-100-4-01',
          accountCode: '100-4-01',
          accountName: 'Cash In Hand',
          description: 'Yesterday cash inflow',
          debit: 20000,
          credit: 0,
        },
      ],
    },
    {
      id: 'tx-5',
      voucherNo: 'BPV-005',
      voucherType: 'BPV',
      campusId: 'campus-sub',
      date: today,
      narration: 'Sub-campus bank voucher today',
      status: 'Posted',
      totalDebit: 8000,
      totalCredit: 8000,
      entries: [],
    },
  ];

  const result = computeCampusOverviewMetrics({
    campuses,
    transactions,
    accountHeads: [cashHead],
    todayIso: today,
  });

  assert.equal(result.todayIso, today);
  // Main Campus sorts first
  assert.equal(result.items[0].campusId, 'campus-main');
  assert.equal(result.items[1].campusId, 'campus-sub');

  // Main campus ledger: opening 100,000 + 30,000 - 5,000 + 20,000 = 145,000
  // Combined with petty cash currentPettyCash (40,000) = 185,000
  assert.equal(result.items[0].cashLedgerBalance, 145000);
  assert.equal(result.items[0].pettyCashBalance, 40000);
  assert.equal(result.items[0].totalCashOnHand, 185000);
  // Today's vouchers for Main Campus: Approved + Pending + Rejected = 3 (excludes yesterday tx-4)
  assert.equal(result.items[0].todayVoucherCount, 3);
  assert.equal(result.items[0].todayPendingCount, 1);

  // Sub-campus ledger: opening 25,000 + 0 movement = 25,000; petty cash = 12,500 => total = 37,500
  assert.equal(result.items[1].cashLedgerBalance, 25000);
  assert.equal(result.items[1].pettyCashBalance, 12500);
  assert.equal(result.items[1].totalCashOnHand, 37500);
  assert.equal(result.items[1].todayVoucherCount, 1);

  assert.equal(result.totalNetworkCashOnHand, 222500);
  assert.equal(result.totalTodayVouchers, 4);
});

test('computeCampusCashLedgerBalance uses engine getAccountBalance callback when provided', () => {
  const cashHead = {
    id: 'acc-100-4-01',
    code: '100-4-01',
    name: 'Cash In Hand',
    category: 'Asset',
    type: 'Bank',
    balance: 0,
    mainCode: '100',
    mainAccount: 'Assets',
    groupCode: '100-4',
    groupName: 'Cash & Bank',
  } as AccountHead;

  const balance = computeCampusCashLedgerBalance(
    'campus-main',
    cashHead,
    [],
    (head, campusId) => (head.id === 'acc-100-4-01' && campusId === 'campus-main' ? 76500 : 0)
  );
  assert.equal(balance, 76500);
});

test('getLocalTodayIso formats YYYY-MM-DD in local calendar time', () => {
  const d = new Date(2026, 10, 5, 23, 45, 0); // Nov 5, 2026 23:45 local
  assert.equal(getLocalTodayIso(d), '2026-11-05');
});

test('PlatformSiteAdminHub renders CampusDashboardOverview inside 01_dashboard', () => {
  const hubSource = readSource('src/components/PlatformSiteAdminHub.tsx');
  assert.ok(hubSource.includes("import { CampusDashboardOverview } from './CampusDashboardOverview';"));
  assert.ok(hubSource.includes('<CampusDashboardOverview'));

  const dashboardStart = hubSource.indexOf("activeSection === '01_dashboard'");
  const nextSectionStart = hubSource.indexOf("activeSection === '02_clients'");
  assert.notEqual(dashboardStart, -1);
  assert.notEqual(nextSectionStart, -1);
  const dashboardSlice = hubSource.slice(dashboardStart, nextSectionStart);
  assert.ok(dashboardSlice.includes('<CampusDashboardOverview'));
});
