import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSyncFingerprint,
  RealtimeAutoSyncScheduler,
  type SyncFingerprintInput,
} from '../src/services/realtimeSyncScheduler';

function createBaseSnapshot(): SyncFingerprintInput {
  return {
    transactions: [
      {
        id: 'v-1',
        voucherNo: 'CPV-001',
        status: 'Pending',
        totalDebit: 5000,
        updatedAt: '2026-04-01T10:00:00.000Z',
        revision: 1,
        entries: [{ accountCode: '5010', debit: 5000, credit: 0 }],
      },
    ],
    campuses: [
      {
        id: 'campus-1',
        code: 'MAIN',
        name: 'Main Campus',
        status: 'active',
        pettyCashFloat: 50000,
        currentPettyCash: 45000,
      },
    ],
    pettyCashTransactions: [
      { id: 'pc-1', voucherNo: 'PC-001', amount: 1200, updatedAt: '2026-04-01T09:00:00.000Z' },
    ],
    accountHeads: [{ id: 'coa-1', code: '5010', name: 'Utilities Expense', balance: 5000 }],
    users: [{ id: 'u-1', username: 'admin', role: 'level_1_platform_super_admin', status: 'active' }],
    schoolClients: [{ id: 'client-aplus', code: 'APLUS', name: 'Aplus School', status: 'active' }],
    orgSettings: { schoolName: 'Aplus School System', currency: 'PKR' },
    periods: [{ id: '2026-04', status: 'Open' }],
  };
}

test('computeSyncFingerprint is deterministic and detects mutations across all collections', () => {
  const s1 = createBaseSnapshot();
  const s2 = createBaseSnapshot();
  assert.equal(computeSyncFingerprint(s1), computeSyncFingerprint(s2));

  const txMutated = createBaseSnapshot();
  txMutated.transactions![0].status = 'Approved';
  assert.notEqual(computeSyncFingerprint(s1), computeSyncFingerprint(txMutated));

  const campusMutated = createBaseSnapshot();
  campusMutated.campuses![0].currentPettyCash = 40000;
  assert.notEqual(computeSyncFingerprint(s1), computeSyncFingerprint(campusMutated));

  const pettyMutated = createBaseSnapshot();
  pettyMutated.pettyCashTransactions!.push({ id: 'pc-2', voucherNo: 'PC-002', amount: 500 });
  assert.notEqual(computeSyncFingerprint(s1), computeSyncFingerprint(pettyMutated));

  const userMutated = createBaseSnapshot();
  userMutated.users!.push({ id: 'u-2', username: 'branch1', role: 'accountant', status: 'active' });
  assert.notEqual(computeSyncFingerprint(s1), computeSyncFingerprint(userMutated));
});

test('RealtimeAutoSyncScheduler does not flush unchanged hydrated state and flushes mutations quickly', async () => {
  let state = createBaseSnapshot();
  let flushCount = 0;
  let pullCount = 0;

  const scheduler = new RealtimeAutoSyncScheduler({
    tickIntervalMs: 1000,
    debounceMs: 30,
    maxWaitMs: 100,
    cloudLoadIntervalMs: 2000,
    getSnapshot: () => state,
    canSyncNetwork: () => true,
    onFlushChanges: async () => {
      flushCount++;
    },
    onPullLatest: async () => {
      pullCount++;
    },
  });

  scheduler.markHydratedFromCloud(state);

  // Ticking with unchanged state should not push redundant writes
  const flushedIdle = await scheduler.flushIfDirty();
  assert.equal(flushedIdle, false);
  assert.equal(flushCount, 0);

  // Mutate state and markDirty -> debounce triggers quick flush
  state = {
    ...state,
    transactions: [
      ...state.transactions!,
      { id: 'v-2', voucherNo: 'CPV-002', status: 'Approved', totalDebit: 2500, entries: [] },
    ],
  };
  scheduler.markDirty(state);

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(flushCount, 1);
  assert.equal(scheduler.getDebugState().dirty, false);

  // Repeated 1s tick should trigger periodic cloud pull after cloudLoadIntervalMs
  const t0 = Date.now() + 2500;
  await scheduler.tick(t0);
  assert.equal(pullCount, 1);
});

test('RealtimeAutoSyncScheduler detects unnotified state changes on 1s tick and flushes within tick', async () => {
  const state = createBaseSnapshot();
  let flushCount = 0;
  let pullCount = 0;

  const scheduler = new RealtimeAutoSyncScheduler({
    tickIntervalMs: 1000,
    debounceMs: 50,
    maxWaitMs: 1000,
    cloudLoadIntervalMs: 2000,
    getSnapshot: () => state,
    canSyncNetwork: () => true,
    onFlushChanges: async () => {
      flushCount++;
    },
    onPullLatest: async () => {
      pullCount++;
    },
  });

  scheduler.markHydratedFromCloud(state);

  // Simulate state change without calling markDirty explicitly
  state.campuses![0].name = 'Main Campus Updated';
  await scheduler.tick(Date.now() + 2500);

  assert.equal(flushCount, 1);
  assert.equal(pullCount, 1);
});

test('RealtimeAutoSyncScheduler respects offline guard and drains outbox when back online', async () => {
  const state = createBaseSnapshot();
  let networkEligible = false;
  let hasOutbox = true;
  let flushCount = 0;
  let pullCount = 0;

  const scheduler = new RealtimeAutoSyncScheduler({
    tickIntervalMs: 1000,
    debounceMs: 25,
    maxWaitMs: 100,
    cloudLoadIntervalMs: 1000,
    getSnapshot: () => state,
    canSyncNetwork: () => networkEligible,
    hasPendingOutbox: () => hasOutbox,
    onFlushChanges: async () => {
      flushCount++;
      hasOutbox = false;
    },
    onPullLatest: async () => {
      pullCount++;
    },
  });

  scheduler.markHydratedFromCloud(state);
  scheduler.markDirty(state);
  await scheduler.tick(Date.now() + 2000);
  assert.equal(flushCount, 0);
  assert.equal(pullCount, 0);

  // Restore network eligibility
  networkEligible = true;
  await scheduler.tick(Date.now() + 4000);
  assert.equal(flushCount, 1);
  assert.equal(pullCount, 1);
});

test('RealtimeAutoSyncScheduler enters quota backoff on Firestore resource-exhausted error', async () => {
  const state = createBaseSnapshot();
  let flushAttempts = 0;

  const scheduler = new RealtimeAutoSyncScheduler({
    tickIntervalMs: 1000,
    debounceMs: 25,
    maxWaitMs: 100,
    cloudLoadIntervalMs: 2000,
    getSnapshot: () => state,
    canSyncNetwork: () => true,
    onFlushChanges: async () => {
      flushAttempts++;
      throw new Error('FirebaseError: Quota exceeded (resource-exhausted)');
    },
    onPullLatest: async () => {},
  });

  scheduler.markHydratedFromCloud(state);
  state.transactions![0].totalDebit = 9999;
  scheduler.markDirty(state);

  const ok = await scheduler.flushIfDirty();
  assert.equal(ok, false);
  assert.equal(flushAttempts, 1);

  // Subsequent immediate flush within backoff window must be suppressed
  const secondOk = await scheduler.flushIfDirty();
  assert.equal(secondOk, false);
  assert.equal(flushAttempts, 1);
});
