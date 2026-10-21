import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { contextFromMembership } from '../src/server/authentication';
import { tenantRouter } from '../src/server/tenantApiRoutes';
import { TenantIsolatedRepository, validateCampusPermission, type TenantContext, type CampusNode } from '../src/services/tenantIsolationService';

const campuses: CampusNode[] = [
  { id: 'a-main', clientId: 'a', code: 'A', name: 'A', isMainCampus: true, status: 'active' },
  { id: 'a-sub', clientId: 'a', code: 'AS', name: 'AS', parentCampusId: 'a-main', status: 'active' },
  { id: 'b-main', clientId: 'b', code: 'B', name: 'B', status: 'active' },
];
const client: TenantContext = contextFromMembership('a-user', { status: 'active', permissionLevel: 'level_2_client_super_admin', clientId: 'a', campusId: 'a-main' });
const owner = contextFromMembership('owner', { status: 'active', permissionLevel: 'level_1_platform_super_admin' });
function repository() {
  return new TenantIsolatedRepository({ campuses, vouchers: [
    { id: 'v1', voucherNo: 'A1', client_id: 'a', campus_id: 'a-main', campusId: 'a-main', totalDebit: 100, totalCredit: 100 },
    { id: 'v2', voucherNo: 'A2', client_id: 'a', campus_id: 'a-sub', campusId: 'a-sub', totalDebit: 100, totalCredit: 100 },
    { id: 'v3', voucherNo: 'B1', client_id: 'b', campus_id: 'b-main', campusId: 'b-main', totalDebit: 100, totalCredit: 100 },
  ] });
}
test('membership denies suspended, missing and unknown roles', () => {
  for (const membership of [undefined, { status: 'suspended', permissionLevel: 'level_1_platform_super_admin' }, { status: 'active', permissionLevel: 'admin' }, { status: 'active', permissionLevel: 'level_2_client_super_admin' }]) {
    assert.throws(() => contextFromMembership('u', membership));
  }
  assert.equal(client.isPlatformAdmin, false);
  assert.equal(owner.isPlatformAdmin, true);
});
test('anonymous requests cannot claim admin through headers or query', async () => {
  const app = express(); app.use(express.json()); app.use('/api/tenants', tenantRouter);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const address = server.address() as any;
    for (const route of ['/context', '/vouchers', '/users', '/reports/catalog']) {
      const result = await fetch(`http://127.0.0.1:${address.port}/api/tenants${route}?clientId=b`, { headers: { 'x-user-role': 'admin', 'x-permission-level': 'level_1_platform_super_admin' } });
      assert.equal(result.status, 401);
    }
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('tenant and campus query filters cannot leak other clients', () => {
  const repo = repository();
  assert.deepEqual(repo.queryVouchers(client, { client_id: 'b' }).map(v => v.id), ['v1', 'v2']);
  assert.throws(() => repo.getVoucherById(client, 'v3'));
  assert.deepEqual(repo.queryVouchers(owner, { client_id: 'a' }).map(v => v.id), ['v1', 'v2']);
});
test('delegation cannot smuggle campuses from another client', () => {
  const main = { ...client, permissionLevel: 'level_3_main_campus_admin', isClientAdmin: false, delegatedCampusIds: ['b-main'] } as TenantContext;
  assert.equal(validateCampusPermission(main, 'b-main', 'read', campuses).allowed, false);
  const unassigned = { ...main, permissionLevel: 'level_5_departmental_staff', campusId: null } as TenantContext;
  assert.equal(validateCampusPermission(unassigned, 'a-main', 'read', campuses).allowed, false);
});
test('voucher create and edit reject invalid money and immutable-field changes', () => {
  const repo = repository();
  for (const [debit, credit] of [[0, 10], [NaN, 10], [-10, -10], [Infinity, Infinity], [10, 9.99]]) {
    assert.throws(() => repo.createVoucher(client, { campus_id: 'a-main', totalDebit: debit, totalCredit: credit }));
  }
  assert.throws(() => repo.updateVoucher(client, 'v1', { totalCredit: 90 }));
  for (const update of [{ id: 'other' }, { campusId: 'b-main' }, { campus_id: 'a-sub' }, { client_id: 'b' }]) {
    assert.throws(() => repo.updateVoucher(client, 'v1', update));
  }
  assert.throws(() => repo.createVoucher(client, { campus_id: 'a-main', voucherNo: 'A1', totalDebit: 10, totalCredit: 10 }));
  assert.equal(repo.updateVoucher(client, 'v1', { totalDebit: 110, totalCredit: 110 }).totalDebit, 110);
});
test('account updates cannot escalate roles, move campuses or store passwords', () => {
  const repo = repository();
  const user = repo.createUser(client, { id: 'staff', campus_id: 'a-main', role: 'accountant' });
  for (const update of [{ role: 'super_admin' }, { isPlatformAdmin: true }, { permissionLevel: 'level_1_platform_super_admin' }, { campus_id: 'b-main' }, { password: 'secret' }]) {
    assert.throws(() => repo.updateUser(client, user.id, update));
  }
});
test('financial record filters honor a specific campus', () => {
  const repo = repository();
  repo.createFinancialRecord(client, { id: 'r1', campus_id: 'a-main' });
  repo.createFinancialRecord(client, { id: 'r2', campus_id: 'a-sub' });
  assert.deepEqual(repo.queryFinancialRecords(client, undefined, { campusId: 'a-main' }).map(r => r.id), ['r1']);
  assert.throws(() => repo.updateFinancialRecord(client, 'r1', { campusId: 'b-main' }));
});

test('recovery blocks missing account dependencies, non-finite totals and same-campus duplicates', async () => {
  const { validateRestorePreconditions, INITIAL_SOFT_DELETED_RECORDS } = await import('../src/services/globalRecoveryService');
  const record = structuredClone(INITIAL_SOFT_DELETED_RECORDS[0]);
  const context: any = {
    activeTransactions: [], activePettyCash: [],
    activeAccountHeads: [], activeCampuses: [{ id: record.campusId }],
  };
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, false);
  context.activeAccountHeads = record.originalPayload.entries.map((e: any) => ({ code: e.accountCode }));
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, true);
  context.activeTransactions = [{ id: 'other-campus', voucherNo: record.identifier, campusId: 'another-campus' }];
  assert.equal(validateRestorePreconditions(record, context).duplicateConflict, false);
  context.activeTransactions[0].campusId = record.campusId;
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, false);
  context.activeTransactions = [];
  record.originalPayload.totalDebit = 'not-money';
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, false);
});

test('recovery override cannot bypass missing account dependencies', async () => {
  const { executeRecordRestore, INITIAL_SOFT_DELETED_RECORDS, RECYCLE_BIN_STORAGE_KEY } = await import('../src/services/globalRecoveryService');
  const previousWindow = (globalThis as any).window;
  const previousStorage = (globalThis as any).localStorage;
  const record = structuredClone(INITIAL_SOFT_DELETED_RECORDS[0]);
  (globalThis as any).window = {};
  (globalThis as any).localStorage = { getItem: (key: string) => key === RECYCLE_BIN_STORAGE_KEY ? JSON.stringify([record]) : null };
  try {
    let wrote = false;
    const result = executeRecordRestore(record.id, { name: 'Owner', role: 'super_admin', isSiteOwner: true }, {
      activeTransactions: [], activePettyCash: [], activeAccountHeads: [], activeCampuses: [{ id: record.campusId }] as any,
      addTransaction: () => { wrote = true; }, addPettyCashTransaction: () => {}, addAccountHead: () => {}, addCampus: () => {},
    }, { overrideDuplicateVoucherNo: 'NEW-001', autoRecreateMissingAccountHeads: true });
    assert.equal(result.success, false);
    assert.equal(wrote, false);
  } finally {
    if (previousWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = previousWindow;
    if (previousStorage === undefined) delete (globalThis as any).localStorage; else (globalThis as any).localStorage = previousStorage;
  }
});

test('a deleted campus can be restored once its parent exists', async () => {
  const { validateRestorePreconditions, INITIAL_SOFT_DELETED_RECORDS } = await import('../src/services/globalRecoveryService');
  const record: any = { ...structuredClone(INITIAL_SOFT_DELETED_RECORDS[0]), recordType: 'CAMPUS', campusId: 'deleted-campus', originalPayload: { id: 'deleted-campus', code: 'RESTORE', parentCampusId: 'parent' } };
  const context: any = { activeTransactions: [], activePettyCash: [], activeAccountHeads: [], activeCampuses: [] };
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, false);
  context.activeCampuses = [{ id: 'parent', code: 'PARENT' }];
  assert.equal(validateRestorePreconditions(record, context).canRestoreSafely, true);
});
