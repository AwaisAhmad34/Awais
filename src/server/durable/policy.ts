import { createHash } from 'node:crypto';
import type { TenantContext } from '../../services/tenantIsolationService';
export type Context = TenantContext;
export type RecordData = Record<string, any>;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message = code) { super(message); }
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new ApiError(400, 'INVALID_ID');
  return value;
}
export function tenantFor(context: Context, requested?: unknown): string {
  if (context.isPlatformAdmin) return identifier(requested || context.clientId);
  if (requested && requested !== context.clientId) throw new ApiError(403, 'TENANT_ACCESS_DENIED');
  return identifier(context.clientId);
}
export function manages(context: Context) {
  return context.isPlatformAdmin || context.permissionLevel === 'level_2_client_super_admin';
}
export function requireManager(context: Context) {
  if (!manages(context)) throw new ApiError(403, 'MANAGER_REQUIRED');
}
export function authorizedCampuses(context: Context, campuses: RecordData[]): string[] {
  if (context.isPlatformAdmin || context.isClientAdmin) return campuses.filter(c => c.status === 'active').map(c => c.id);
  const own = campuses.find(c => c.id === context.campusId && c.status === 'active' && c.clientId === context.clientId);
  if (!own) return [];
  if (context.permissionLevel !== 'level_3_main_campus_admin') return [own.id];
  const permitted = new Set([own.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const campus of campuses) if (campus.status === 'active' && campus.clientId === context.clientId && (permitted.has(campus.parentCampusId) || context.delegatedCampusIds?.includes(campus.id)) && !permitted.has(campus.id)) {
      permitted.add(campus.id); changed = true;
    }
  }
  return [...permitted];
}
export function requireCampus(context: Context, campuses: RecordData[], campusId: unknown) {
  const id = identifier(campusId);
  if (!authorizedCampuses(context, campuses).includes(id)) throw new ApiError(403, 'CAMPUS_ACCESS_DENIED');
  return id;
}
export function textField(value: unknown, label: string, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(400, 'INVALID_FIELD', `${label} is required (maximum ${max} characters).`);
  return value.trim();
}
export function dateField(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || (typeof value === 'string' && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value)) throw new ApiError(400, 'INVALID_DATE');
  return value;
}
export function cents(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100)) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new ApiError(400, 'INVALID_AMOUNT', 'Amounts must be nonnegative numbers with at most two decimal places.');
  return Math.round(value * 100);
}
export function voucherPayload(body: RecordData) {
  const allowed = ['voucherNo','campusId','date','voucherType','narration','entries','status'];
  for (const key of Object.keys(body)) if (!allowed.includes(key)) throw new ApiError(400, 'UNKNOWN_FIELD', `Field not accepted: ${key}`);
  if (!['BPV','BRV','CPV','CRV','JV'].includes(body.voucherType)) throw new ApiError(400, 'INVALID_VOUCHER_TYPE');
  if (!Array.isArray(body.entries) || body.entries.length < 2 || body.entries.length > 100) throw new ApiError(400, 'INVALID_ENTRIES');
  let debit = 0, credit = 0;
  const entries = body.entries.map((entry: RecordData) => {
    const dr = cents(entry.debit ?? 0), cr = cents(entry.credit ?? 0);
    if ((dr > 0) === (cr > 0)) throw new ApiError(400, 'INVALID_ENTRY', 'Each entry requires either a debit or a credit.');
    debit += dr; credit += cr;
    return { accountCode: textField(entry.accountCode, 'Account code', 40), debit: dr / 100, credit: cr / 100, description: String(entry.description || '').slice(0,500) };
  });
  if (debit !== credit || debit <= 0 || !Number.isSafeInteger(debit)) throw new ApiError(400, 'UNBALANCED_VOUCHER');
  const status = body.status || 'Draft';
  if (!['Draft','Pending','Posted','Rejected'].includes(status)) throw new ApiError(400, 'INVALID_STATUS');
  return { voucherNo: textField(body.voucherNo,'Voucher number',80), campusId: identifier(body.campusId), date: dateField(body.date), voucherType: body.voucherType, narration: String(body.narration || '').slice(0,2000), entries, totalDebit: debit/100, totalCredit: credit/100, status };
}
export function numberKey(campusId: string, number: string) {
  return createHash('sha256').update(campusId + '\0' + number.trim().toUpperCase()).digest('hex');
}
export function revision(body: RecordData) {
  if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1) throw new ApiError(400, 'REVISION_REQUIRED');
  return body.expectedRevision;
}
export function assertRevision(record: RecordData, expected: number) {
  if (record.revision !== expected) throw new ApiError(409, 'REVISION_CONFLICT', 'This record changed. Reload it before saving.');
}
export function requireOpenPeriod(periods: RecordData[], date: string) {
  if (periods.some(p => p.status === 'Closed' && p.start <= date && p.end >= date)) throw new ApiError(409, 'PERIOD_CLOSED');
}
