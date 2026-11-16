import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AccountHead, Campus, Transaction } from '../src/core/aplusEngine';
import { OFFICIAL_157_CHART_OF_ACCOUNTS } from '../src/data/officialChartOfAccounts157';
import {
  applyCampusOpeningBalanceToAccountHeads,
  getConfiguredCampusOpeningBalance,
  isCashInHandAccountHead,
  resolveCapitalFundsAccountHead,
  resolveCashInHandAccountHeadFromList,
  resolveEffectiveAccountOpeningBalance,
  resolveEffectiveAccountOpeningDrCr,
} from '../src/utils/campusOpeningBalance';
import { computeCampusOverviewMetrics } from '../src/utils/campusOverviewMetrics';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('Campus schema types and PlatformSiteAdminHub expose Opening Balance field across create, edit, client main campus, and directory cards', () => {
  const dts = readSource('src/core/aplusEngine.d.ts');
  assert.ok(dts.includes('openingBalance?: number;'));
  assert.ok(dts.includes('openingBalanceFiscalYear?: string;'));

  const hub = readSource('src/components/PlatformSiteAdminHub.tsx');
  assert.ok(hub.includes('newCampusOpeningBalance'));
  assert.ok(hub.includes('editCampusOpeningBalance'));
  assert.ok(hub.includes('clientFormMainCampusOpeningBalance'));
  assert.ok(hub.includes('Opening Balance (PKR)'));
  assert.ok(hub.includes('Opening Bal: PKR'));

  const extended = readSource('src/components/PlatformAdminExtendedModules.tsx');
  assert.ok(extended.includes('Opening Balance'));
  assert.ok(extended.includes('sub.openingBalance'));
});

test('applyCampusOpeningBalanceToAccountHeads maintains strict IAS-1 Trial Balance equilibrium (Cash In Hand Dr = Capital Funds Cr)', () => {
  const baseCoa: AccountHead[] = OFFICIAL_157_CHART_OF_ACCOUNTS.map((h) => ({ ...h }));
  const updatedCoa = applyCampusOpeningBalanceToAccountHeads(
    baseCoa,
    'campus-khiali',
    450000
  );

  const cashHead = resolveCashInHandAccountHeadFromList(updatedCoa)!;
  const capitalHead = resolveCapitalFundsAccountHead(updatedCoa)!;

  assert.equal(isCashInHandAccountHead(cashHead), true);
  assert.equal(cashHead.campusDebitBalances?.['campus-khiali'], 450000);
  assert.equal(cashHead.campusCreditBalances?.['campus-khiali'], 0);
  assert.equal(cashHead.campusBalances?.['campus-khiali'], 450000);

  assert.equal(capitalHead.campusDebitBalances?.['campus-khiali'], 0);
  assert.equal(capitalHead.campusCreditBalances?.['campus-khiali'], 450000);
  assert.equal(capitalHead.campusBalances?.['campus-khiali'], 450000);

  // Verify updating opening balance preserves existing Bank / other asset opening balances in Equity
  const withBank = updatedCoa.map((h) =>
    h.code === '100-4-02'
      ? {
          ...h,
          campusDebitBalances: { ...(h.campusDebitBalances || {}), 'campus-khiali': 100000 },
          campusBalances: { ...(h.campusBalances || {}), 'campus-khiali': 100000 },
        }
      : h.id === capitalHead.id
      ? {
          ...h,
          campusCreditBalances: { ...(h.campusCreditBalances || {}), 'campus-khiali': 550000 },
          campusBalances: { ...(h.campusBalances || {}), 'campus-khiali': 550000 },
        }
      : h
  );

  // Now adjust Cash opening balance from 450,000 down to 200,000 (delta = -250,000)
  const adjustedCoa = applyCampusOpeningBalanceToAccountHeads(
    withBank,
    'campus-khiali',
    200000
  );

  const cashAfter = resolveCashInHandAccountHeadFromList(adjustedCoa)!;
  const capAfter = resolveCapitalFundsAccountHead(adjustedCoa)!;

  assert.equal(cashAfter.campusBalances?.['campus-khiali'], 200000);
  // Bank 100,000 + Cash 200,000 = 300,000 Equity
  assert.equal(capAfter.campusCreditBalances?.['campus-khiali'], 300000);

  // Consolidated Trial Balance Check
  let totalDr = 0;
  let totalCr = 0;
  for (const h of adjustedCoa) {
    const res = resolveEffectiveAccountOpeningDrCr(h, 'campus-khiali', [], adjustedCoa);
    totalDr += res.debit;
    totalCr += res.credit;
  }
  assert.equal(totalDr, 300000);
  assert.equal(totalCr, 300000);
});

test('resolveEffectiveAccountOpeningDrCr utilizes Campus.openingBalance fallback without double-counting and balances Consolidated totals', () => {
  const coa: AccountHead[] = OFFICIAL_157_CHART_OF_ACCOUNTS.map((h) => ({ ...h }));

  // Sync campus-main via COA, leave campus-sub only on Campus.openingBalance (unsynced COA scenario)
  const syncedCoa = applyCampusOpeningBalanceToAccountHeads(coa, 'campus-main', 300000);

  const campuses: Campus[] = [
    {
      id: 'campus-main',
      code: 'MAIN',
      name: 'Main Campus',
      pettyCashFloat: 50000,
      currentPettyCash: 50000,
      openingBalance: 300000,
      openingBalanceFiscalYear: '2026-2027',
      status: 'active',
      isMainCampus: true,
    },
    {
      id: 'campus-sub',
      code: 'SUB',
      name: 'Sub Campus',
      pettyCashFloat: 20000,
      currentPettyCash: 20000,
      openingBalance: 125000,
      openingBalanceFiscalYear: '2026-2027',
      status: 'active',
      isMainCampus: false,
      parentCampusId: 'campus-main',
    },
  ];

  const cashHead = resolveCashInHandAccountHeadFromList(syncedCoa)!;
  const capHead = resolveCapitalFundsAccountHead(syncedCoa)!;

  // Main campus must be 300,000 (NOT 600,000 double-counted!)
  assert.equal(
    resolveEffectiveAccountOpeningBalance(cashHead, 'campus-main', campuses, syncedCoa),
    300000
  );
  // Sub campus falls back cleanly to 125,000
  assert.equal(
    resolveEffectiveAccountOpeningBalance(cashHead, 'campus-sub', campuses, syncedCoa),
    125000
  );
  assert.equal(
    resolveEffectiveAccountOpeningDrCr(capHead, 'campus-sub', campuses, syncedCoa).credit,
    125000
  );

  // Consolidated ('all') must be exact sum: 300,000 + 125,000 = 425,000
  const allCash = resolveEffectiveAccountOpeningDrCr(cashHead, 'all', campuses, syncedCoa);
  const allCap = resolveEffectiveAccountOpeningDrCr(capHead, 'all', campuses, syncedCoa);
  assert.equal(allCash.debit, 425000);
  assert.equal(allCash.net, 425000);
  assert.equal(allCap.credit, 425000);
});

test('computeCampusOverviewMetrics incorporates Campus.openingBalance + fiscal-year voucher movements + Petty Cash float', () => {
  const cashHead = OFFICIAL_157_CHART_OF_ACCOUNTS.find((h) => h.code === '100-4-01')!;
  const campuses: Campus[] = [
    {
      id: 'campus-alpha',
      code: 'ALP',
      name: 'Alpha Campus',
      pettyCashFloat: 40000,
      currentPettyCash: 40000,
      openingBalance: 250000,
      openingBalanceFiscalYear: '2026-2027',
      status: 'active',
      isMainCampus: true,
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 'tx-fee-1',
      voucherNo: 'CRV-001',
      voucherType: 'CRV',
      campusId: 'campus-alpha',
      date: '2026-07-05',
      narration: 'Tuition fee received in cash',
      status: 'Posted',
      totalDebit: 50000,
      totalCredit: 50000,
      entries: [
        {
          id: 'ent-1',
          accountId: cashHead.id,
          accountCode: cashHead.code,
          accountName: cashHead.name,
          description: 'Cash receipt',
          debit: 50000,
          credit: 0,
        },
      ],
    },
  ];

  const metrics = computeCampusOverviewMetrics({
    campuses,
    transactions,
    accountHeads: [cashHead],
    todayIso: '2026-07-05',
  });

  assert.equal(getConfiguredCampusOpeningBalance(campuses[0]), 250000);
  // Opening 250,000 + Voucher +50,000 = 300,000 GL Cash + 40,000 Petty = 340,000 Total Cash on Hand
  assert.equal(metrics.items[0].cashLedgerBalance, 300000);
  assert.equal(metrics.items[0].pettyCashBalance, 40000);
  assert.equal(metrics.items[0].totalCashOnHand, 340000);
  assert.equal(metrics.items[0].todayVoucherCount, 1);
});

test('aplusEngine.js and MultiFormatReportsHub wire Campus.openingBalance into engine opening helpers and reports', () => {
  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(engine.includes('__resolveEffectiveOpeningDrCr'));
  assert.ok(engine.includes('__resolveEffectiveOpeningBalance'));
  assert.ok(engine.includes('__applyCampusOpeningToCoa'));

  const reports = readSource('src/components/MultiFormatReportsHub.tsx');
  assert.ok(reports.includes('resolveEffectiveAccountOpeningDrCr'));
  assert.ok(reports.includes('effectiveReportCampusId'));
});
