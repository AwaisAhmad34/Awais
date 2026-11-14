import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_157_CHART_OF_ACCOUNTS,
  mergeOfficial157ChartOfAccounts,
  buildZeroedOfficial157ChartOfAccounts,
} from '../src/data/officialChartOfAccounts157';
import {
  collectAllTargetOrganizationIds,
  isPreservedMainCampus,
  filterPreservedMainCampuses,
  zeroOutAccountHeads,
  buildZeroDataLiveSnapshot,
} from '../src/services/productionResetService';
import { INITIAL_CAMPUS_LOGIN_ACTIVITIES } from '../src/services/campusLoginActivityService';
import { INITIAL_SOFT_DELETED_RECORDS } from '../src/services/globalRecoveryService';

test('OFFICIAL_157_CHART_OF_ACCOUNTS contains exactly 157 unique institutional heads at 0 balance', () => {
  assert.equal(OFFICIAL_157_CHART_OF_ACCOUNTS.length, 157);
  const codes = new Set(OFFICIAL_157_CHART_OF_ACCOUNTS.map((a) => a.code));
  const ids = new Set(OFFICIAL_157_CHART_OF_ACCOUNTS.map((a) => a.id));
  assert.equal(codes.size, 157);
  assert.equal(ids.size, 157);

  const categories = new Set(OFFICIAL_157_CHART_OF_ACCOUNTS.map((a) => a.category));
  for (const cat of ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']) {
    assert.ok(categories.has(cat as any), `Missing category ${cat}`);
  }

  for (const head of OFFICIAL_157_CHART_OF_ACCOUNTS) {
    assert.equal(head.balance, 0);
  }
});

test('mergeOfficial157ChartOfAccounts imports missing heads while preserving custom heads and balances', () => {
  const partial: any[] = [
    {
      ...OFFICIAL_157_CHART_OF_ACCOUNTS[0],
      balance: 25000,
      campusBalances: { 'campus-main': 25000 },
    },
    {
      id: 'acc-custom-999',
      code: '500-99-01',
      name: 'Custom Robotics Lab Expense',
      category: 'Expense',
      type: 'Expense',
      balance: 1200,
      campusBalances: { 'campus-main': 1200 },
    },
  ];

  const res = mergeOfficial157ChartOfAccounts(partial);
  assert.equal(res.totalOfficial, 157);
  assert.equal(res.added, 156);
  assert.equal(res.updated, 1);
  assert.equal(res.merged.length, 158);

  const first = res.merged.find((h) => h.code === OFFICIAL_157_CHART_OF_ACCOUNTS[0].code);
  assert.equal(first?.balance, 25000);
  assert.equal(first?.campusBalances?.['campus-main'], 25000);

  const custom = res.merged.find((h) => h.id === 'acc-custom-999');
  assert.ok(custom);
  assert.equal(custom?.balance, 1200);
});

test('selective zero-data reset preserves Organizations, Main Campuses, and zeroes operational data', () => {
  const clients: any[] = [
    { id: 'org-alpha', name: 'Alpha Academy', mainCampusId: 'camp-main-alpha' },
    { id: 'org-beta', name: 'Beta School', mainCampusId: 'camp-main-beta' },
  ];

  const campuses: any[] = [
    {
      id: 'camp-main-alpha',
      name: 'Alpha Main Campus',
      code: 'AMC',
      clientId: 'org-alpha',
      isMainCampus: true,
      parentCampusId: null,
      pettyCashFloat: 50000,
      currentPettyCash: 12345,
    },
    {
      id: 'camp-sub-alpha-1',
      name: 'Alpha Junior Wing',
      code: 'AJW',
      clientId: 'org-alpha',
      isMainCampus: false,
      parentCampusId: 'camp-main-alpha',
      pettyCashFloat: 20000,
      currentPettyCash: 5000,
    },
    {
      id: 'camp-main-beta',
      name: 'Beta Flagship Campus',
      code: 'BFC',
      clientId: 'org-beta',
      parentCampusId: null,
      pettyCashFloat: 0,
      currentPettyCash: 999,
    },
  ];

  assert.equal(isPreservedMainCampus(campuses[0], clients), true);
  assert.equal(isPreservedMainCampus(campuses[1], clients), false);
  assert.equal(isPreservedMainCampus(campuses[2], clients), true);

  const preservedCampuses = filterPreservedMainCampuses(campuses, clients);
  assert.equal(preservedCampuses.length, 2);
  assert.deepEqual(
    preservedCampuses.map((c) => c.id),
    ['camp-main-alpha', 'camp-main-beta']
  );
  assert.equal(preservedCampuses[0].currentPettyCash, 50000);
  assert.equal(preservedCampuses[1].currentPettyCash, 0);

  const orgIds = collectAllTargetOrganizationIds(clients, campuses, 'org-alpha');
  assert.ok(orgIds.includes('client-aplus'));
  assert.ok(orgIds.includes('org-alpha'));
  assert.ok(orgIds.includes('org-beta'));

  const zeroedCoa = zeroOutAccountHeads(buildZeroedOfficial157ChartOfAccounts());
  assert.equal(zeroedCoa.length, 157);
  for (const head of zeroedCoa) {
    assert.equal(head.balance, 0);
    assert.deepEqual(head.campusBalances, {});
  }

  const snap = buildZeroDataLiveSnapshot({
    clientId: 'org-alpha',
    campuses: preservedCampuses,
    accountHeads: zeroedCoa,
    dataResetEpoch: 1700000000000,
  });

  assert.equal(snap.transactions.length, 0);
  assert.equal(snap.pettyCashTransactions.length, 0);
  assert.equal(snap.activityLogs.length, 0);
  assert.deepEqual(snap.reconciledBankTxIds, {});
  assert.equal(snap.campuses.length, 2);
  assert.equal(snap.accountHeads.length, 157);
});

test('mock login telemetry and dummy recycle bin seed arrays remain empty for 0-data production', () => {
  assert.deepEqual(INITIAL_CAMPUS_LOGIN_ACTIVITIES, []);
  assert.deepEqual(INITIAL_SOFT_DELETED_RECORDS, []);
});
