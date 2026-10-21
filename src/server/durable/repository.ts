import { randomUUID } from 'node:crypto';
import type { Store, UnitOfWork } from './store';
import { ApiError, type Context, type RecordData, identifier, tenantFor, manages, requireManager, requireCampus, authorizedCampuses, textField, dateField, cents, voucherPayload, numberKey, assertRevision, requireOpenPeriod } from './policy';

export class DurableRepository {
  constructor(private store: Store) {}
  private async scope(tx: UnitOfWork, context: Context, clientId: string) {
    tenantFor(context, clientId);
    const organization = await tx.get(`organizations/${clientId}`);
    if (!organization || organization.status !== 'active' || organization.migrationStatus !== 'ready') throw new ApiError(409, 'WORKSPACE_NOT_READY', 'This organization needs an active, verified migration before use.');
    const campuses = await tx.list(`organizations/${clientId}/campuses`);
    return { organization, campuses, allowed: authorizedCampuses(context, campuses) };
  }
  private audit(tx: UnitOfWork, context: Context, clientId: string, action: string, targetId: string, details: RecordData = {}) {
    const id = randomUUID();
    tx.create(`organizations/${clientId}/audit/${id}`, { id, action, targetId, actorId: context.userId, actorName: context.userName, timestamp: new Date().toISOString(), details });
  }
  async clients(context: Context) {
    return this.store.transaction(async tx => {
      if (context.isPlatformAdmin) return tx.list('organizations');
      const org = await tx.get(`organizations/${identifier(context.clientId)}`);
      return org ? [org] : [];
    });
  }
  async createClient(context: Context, body: RecordData) {
    if (!context.isPlatformAdmin) throw new ApiError(403, 'OWNER_REQUIRED');
    const id = identifier(body.id), name = textField(body.name, 'Organization name');
    return this.store.transaction(async tx => {
      if (await tx.get(`organizations/${id}`)) throw new ApiError(409, 'CLIENT_EXISTS');
      const organization = { id, name, status: 'active', migrationStatus: 'ready', createdAt: new Date().toISOString(), revision: 1 };
      tx.create(`organizations/${id}`, organization);
      this.audit(tx, context, id, 'client.create', id);
      return organization;
    });
  }
  async list(context: Context, clientId: string, collection: string) {
    const allowedCollections = ['campuses','vouchers','petty_cash','account_heads','invoices','trash','periods','audit'];
    if (!allowedCollections.includes(collection)) throw new ApiError(404, 'NOT_FOUND');
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      if (['invoices','periods','audit','trash'].includes(collection)) requireManager(context);
      let rows = await tx.list(`organizations/${clientId}/${collection}`);
      if (collection === 'campuses') rows = rows.filter(r => scope.allowed.includes(r.id));
      if (['vouchers','petty_cash'].includes(collection)) rows = rows.filter(r => scope.allowed.includes(r.campusId) && !r.deletedAt);
      if (collection === 'account_heads') rows = rows.filter(r => !r.deletedAt && (manages(context) || !r.allowedCampusIds || r.allowedCampusIds.some((id: string) => scope.allowed.includes(id))));
      return rows;
    });
  }
  async createCampus(context: Context, clientId: string, body: RecordData) {
    requireManager(context);
    const id = identifier(body.id || randomUUID()), code = textField(body.code, 'Campus code', 40).toUpperCase();
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      if (scope.campuses.some(c => c.code === code || c.id === id)) throw new ApiError(409, 'CAMPUS_EXISTS');
      const parentCampusId = body.parentCampusId ? identifier(body.parentCampusId) : null;
      if (parentCampusId && !scope.campuses.some(c => c.id === parentCampusId && c.status === 'active')) throw new ApiError(400, 'INVALID_PARENT');
      const campus = { id, clientId, code, name: textField(body.name, 'Campus name'), parentCampusId, isMainCampus: !parentCampusId, status: 'active', createdAt: new Date().toISOString(), revision: 1 };
      tx.create(`organizations/${clientId}/campuses/${id}`, campus);
      this.audit(tx, context, clientId, 'campus.create', id);
      return campus;
    });
  }
  async createAccount(context: Context, clientId: string, body: RecordData) {
    requireManager(context);
    const group = String(body.group || '');
    if (!/^\d{4}$/.test(group) || !['Asset','Liability','Equity','Revenue','Expense'].includes(body.category)) throw new ApiError(400, 'INVALID_ACCOUNT_GROUP');
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      const counterPath = `organizations/${clientId}/counters/accounts-${group}`;
      const counter = await tx.get(counterPath);
      const accounts = await tx.list(`organizations/${clientId}/account_heads`);
      const maximum = accounts.reduce((n, row) => { const m = new RegExp(`^${group}-(\\d+)$`).exec(row.code || ''); return m ? Math.max(n, Number(m[1])) : n; }, Number(counter?.value || 0));
      const next = maximum + 1, code = `${group}-${next}`, id = randomUUID();
      const allowedCampusIds = Array.isArray(body.allowedCampusIds) ? body.allowedCampusIds.map(identifier) : scope.campuses.map(c => c.id);
      if (allowedCampusIds.some((id: string) => !scope.campuses.some(c => c.id === id))) throw new ApiError(400, 'INVALID_CAMPUS');
      const account = { id, clientId, code, name: textField(body.name,'Account name'), category: body.category, allowedCampusIds, revision: 1, createdAt: new Date().toISOString() };
      tx.set(counterPath, { value: next }); tx.create(`organizations/${clientId}/account_heads/${id}`, account);
      this.audit(tx, context, clientId, 'account.create', id, { code });
      return account;
    });
  }
  async saveVoucher(context: Context, clientId: string, body: RecordData, id?: string, expectedRevision?: number) {
    const payload = voucherPayload(body);
    const recordId = id ? identifier(id) : randomUUID();
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      requireCampus(context, scope.campuses, payload.campusId);
      const path = `organizations/${clientId}/vouchers/${recordId}`;
      const existing = await tx.get(path);
      const periods = await tx.list(`organizations/${clientId}/periods`);
      const accounts = await tx.list(`organizations/${clientId}/account_heads`);
      const reservationPath = `organizations/${clientId}/voucher_numbers/${numberKey(payload.campusId, payload.voucherNo)}`;
      const reservation = await tx.get(reservationPath);
      requireOpenPeriod(periods, payload.date);
      for (const entry of payload.entries) if (!accounts.some(a => a.code === entry.accountCode && !a.deletedAt && (!a.allowedCampusIds || a.allowedCampusIds.includes(payload.campusId)))) throw new ApiError(400, 'ACCOUNT_UNAVAILABLE', `Account ${entry.accountCode} is unavailable for this campus.`);
      if (id && (!existing || existing.deletedAt)) throw new ApiError(404, 'NOT_FOUND');
      if (existing) {
        assertRevision(existing, expectedRevision!); requireOpenPeriod(periods, existing.date);
        if (existing.status === 'Posted') throw new ApiError(409, 'POSTED_VOUCHER_IMMUTABLE', 'Reverse the posted voucher; do not rewrite financial history.');
        if (existing.campusId !== payload.campusId || existing.voucherNo !== payload.voucherNo) throw new ApiError(400, 'IMMUTABLE_VOUCHER_IDENTITY');
        if (!manages(context) && existing.createdBy !== context.userId) throw new ApiError(403, 'AUTHOR_REQUIRED');
      }
      if (['Posted','Rejected'].includes(payload.status) && !manages(context)) throw new ApiError(403, 'APPROVER_REQUIRED');
      if (reservation && reservation.recordId !== recordId) throw new ApiError(409, 'VOUCHER_NUMBER_EXISTS');
      const voucher = { ...payload, id: recordId, clientId, revision: (existing?.revision || 0) + 1, createdBy: existing?.createdBy || context.userId, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: context.userId };
      if (existing) tx.set(path, voucher); else tx.create(path, voucher);
      if (!reservation) tx.create(reservationPath, { recordId });
      this.audit(tx, context, clientId, existing ? 'voucher.update' : 'voucher.create', recordId, { revision: voucher.revision, status: voucher.status });
      return voucher;
    });
  }
  async deleteVoucher(context: Context, clientId: string, id: string, expected: number, reason: string) {
    requireManager(context); identifier(id); textField(reason, 'Deletion reason', 1000);
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      const path = `organizations/${clientId}/vouchers/${id}`;
      const row = await tx.get(path), periods = await tx.list(`organizations/${clientId}/periods`);
      if (!row || row.deletedAt) throw new ApiError(404, 'NOT_FOUND');
      requireCampus(context, scope.campuses, row.campusId); assertRevision(row, expected); requireOpenPeriod(periods, row.date);
      if (row.status === 'Posted') throw new ApiError(409, 'POSTED_VOUCHER_IMMUTABLE');
      const trashId = randomUUID(), now = new Date().toISOString();
      tx.create(`organizations/${clientId}/trash/${trashId}`, { id: trashId, recordId: id, type: 'voucher', clientId, campusId: row.campusId, original: row, reason, deletedAt: now, deletedBy: context.userId, status: 'deleted', revision: 1 });
      tx.set(path, { ...row, deletedAt: now, revision: row.revision + 1 });
      this.audit(tx, context, clientId, 'voucher.delete', id, { trashId, reason });
      return { id, trashId };
    });
  }
  async restore(context: Context, clientId: string, trashId: string) {
    requireManager(context); identifier(trashId);
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId);
      const trashPath = `organizations/${clientId}/trash/${trashId}`, trash = await tx.get(trashPath);
      if (!trash || trash.status !== 'deleted' || trash.type !== 'voucher') throw new ApiError(409, 'RESTORE_UNAVAILABLE');
      const path = `organizations/${clientId}/vouchers/${identifier(trash.recordId)}`;
      const existing = await tx.get(path), periods = await tx.list(`organizations/${clientId}/periods`), accounts = await tx.list(`organizations/${clientId}/account_heads`);
      const reservation = await tx.get(`organizations/${clientId}/voucher_numbers/${numberKey(trash.original.campusId, trash.original.voucherNo)}`);
      if (!existing?.deletedAt || reservation?.recordId !== trash.recordId) throw new ApiError(409, 'RESTORE_CONFLICT');
      requireCampus(context, scope.campuses, trash.campusId); requireOpenPeriod(periods, trash.original.date);
      if (trash.original.entries.some((e: RecordData) => !accounts.some(a => a.code === e.accountCode && !a.deletedAt && (!a.allowedCampusIds || a.allowedCampusIds.includes(trash.campusId))))) throw new ApiError(409, 'MISSING_ACCOUNT_DEPENDENCY');
      const restored = { ...trash.original, revision: existing.revision + 1, restoredAt: new Date().toISOString(), restoredBy: context.userId };
      tx.set(path, restored); tx.set(trashPath, { ...trash, status: 'restored', restoredAt: restored.restoredAt, revision: trash.revision + 1 });
      this.audit(tx, context, clientId, 'voucher.restore', trash.recordId);
      return restored;
    });
  }
  async createPettyCash(context: Context, clientId: string, body: RecordData) {
    const amount = cents(body.amount); if (!amount) throw new ApiError(400, 'INVALID_AMOUNT');
    const direction = body.direction; if (!['in','out'].includes(direction)) throw new ApiError(400, 'INVALID_DIRECTION');
    if (direction === 'in') requireManager(context);
    const date = dateField(body.date), id = identifier(body.requestId), campusId = identifier(body.campusId);
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx, context, clientId); requireCampus(context, scope.campuses, campusId);
      const path = `organizations/${clientId}/petty_cash/${id}`, existing = await tx.get(path);
      const balancePath = `organizations/${clientId}/cash_balances/${campusId}`, balance = await tx.get(balancePath);
      const periods = await tx.list(`organizations/${clientId}/periods`); requireOpenPeriod(periods,date);
      if (existing) {
        if (existing.campusId !== campusId || existing.amount !== amount/100 || existing.direction !== direction || existing.createdBy !== context.userId || existing.date !== date || existing.description !== body.description?.trim()) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT');
        return existing;
      }
      const newBalance = Number(balance?.amountCents || 0) + (direction === 'in' ? amount : -amount);
      if (newBalance < 0 || !Number.isSafeInteger(newBalance)) throw new ApiError(409, 'INSUFFICIENT_CASH');
      const record = { id, clientId, campusId, direction, amount: amount/100, date, description: textField(body.description,'Description',1000), createdBy: context.userId, createdAt: new Date().toISOString(), revision: 1, balanceAfter: newBalance/100 };
      tx.create(path, record); tx.set(balancePath, { amountCents: newBalance, revision: Number(balance?.revision || 0) + 1 });
      this.audit(tx, context, clientId, 'petty_cash.create', id); return record;
    });
  }
  async issueInvoice(context: Context, clientId: string, body: RecordData) {
    if (!context.isPlatformAdmin) throw new ApiError(403, 'OWNER_REQUIRED');
    const month = String(body.month || ''); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError(400, 'INVALID_MONTH');
    const rate = cents(body.ratePerCampus);
    return this.store.transaction(async tx => {
      const scope = await this.scope(tx,context,clientId), path = `organizations/${clientId}/invoices/${month}`;
      const existing = await tx.get(path);
      if (existing) { if (existing.ratePerCampus !== rate/100) throw new ApiError(409,'INVOICE_EXISTS'); return existing; }
      const active = scope.campuses.filter(c => c.status === 'active');
      if (!Number.isSafeInteger(rate * active.length)) throw new ApiError(400,'INVALID_AMOUNT');
      const invoice = { id: month, clientId, month, currency: 'PKR', campusCount: active.length, campusIds: active.map(c=>c.id), ratePerCampus: rate/100, total: rate*active.length/100, status: 'unpaid', issuedAt: new Date().toISOString(), revision: 1 };
      tx.create(path,invoice); this.audit(tx,context,clientId,'invoice.issue',month); return invoice;
    });
  }
  async closePeriod(context: Context, clientId: string, body: RecordData) {
    requireManager(context); const start = dateField(body.start), end = dateField(body.end);
    if (start > end) throw new ApiError(400,'INVALID_PERIOD');
    return this.store.transaction(async tx => {
      await this.scope(tx,context,clientId);
      const vouchers = await tx.list(`organizations/${clientId}/vouchers`);
      if (vouchers.some(v => !v.deletedAt && v.date >= start && v.date <= end && ['Draft','Pending'].includes(v.status))) throw new ApiError(409,'UNPOSTED_VOUCHERS');
      const id = `${start}_${end}`, period = { id, clientId, start, end, status:'Closed', closedBy:context.userId, closedAt:new Date().toISOString() };
      tx.set(`organizations/${clientId}/periods/${id}`,period); this.audit(tx,context,clientId,'period.close',id); return period;
    });
  }
}
