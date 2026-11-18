import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseAst } from 'rollup/parseAst';
import {
  formatAccountingNumber,
  formatAccountingInteger,
  formatAccountingPKR,
} from '../src/utils/accountingFormat';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('Update 2: negative balances display in parentheses across accountingFormat utilities and aplusEngine Q()', () => {
  assert.equal(formatAccountingNumber(-1250), '(1,250.00)');
  assert.equal(formatAccountingNumber(-1250.5), '(1,250.50)');
  assert.equal(formatAccountingNumber(1250), '1,250.00');
  assert.equal(formatAccountingNumber(0), '0.00');
  assert.equal(formatAccountingNumber(-0.001), '0.00');

  assert.equal(formatAccountingInteger(-1250), '(1,250)');
  assert.equal(formatAccountingInteger(1250), '1,250');
  assert.equal(formatAccountingInteger(0), '0');

  assert.equal(formatAccountingPKR(-1250), 'Rs. (1,250)');
  assert.equal(formatAccountingPKR(1250), 'Rs. 1,250');

  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(
    engine.includes('return t<0?`(${n})`:n}function pn('),
    'aplusEngine number formatter should wrap negative amounts in parentheses'
  );

  const hub = readSource('src/components/MultiFormatReportsHub.tsx');
  assert.ok(hub.includes('formatAccountingInteger'));
  assert.equal(hub.includes('formatNum(Math.abs(opDr))'), false);
  assert.equal(hub.includes('formatNum(Math.abs(cBal))'), false);

  const ext = readSource('src/components/ExtendedLedgerAndTrialBalanceTemplates.tsx');
  assert.ok(ext.includes('formatAccountingInteger'));

  const pdfGen = readSource('src/services/financialReportPdfGenerator.ts');
  assert.ok(pdfGen.includes('formatAccountingNumber'));

  const ledgerPdf = readSource('src/components/FullTransactionLedgerPdfExport.tsx');
  assert.ok(ledgerPdf.includes('formatAccountingInteger'));
});

test('Update 1: petty cash transactions remain internal-only and do not post GL vouchers or appear in financial reports', () => {
  const engine = readSource('src/core/aplusEngine.js');

  // Verify Pw (CorePettyCash) handlers no longer invoke GL addTransaction f(...)
  const pwStart = engine.indexOf('Pw=()=>{');
  assert.notEqual(pwStart, -1);
  const pwSlice = engine.slice(pwStart, pwStart + 5000);
  assert.equal(pwSlice.includes('VOUCHER_NUMBER_EXISTS'), false);
  assert.equal(pwSlice.includes('m(w.id'), false);
  assert.equal(pwSlice.includes('g(C.id)'), false);

  // Verify ft (replenishPettyCash) and ut (updatePettyCashBatch) do not create/update GL transactions
  const ftIdx = engine.indexOf('ft=(e,n,r,i,a)=>{');
  assert.notEqual(ftIdx, -1);
  const ftSlice = engine.slice(ftIdx, ftIdx + 650);
  assert.equal(ftSlice.includes('rt({'), false);

  const utIdx = engine.indexOf('ut=(e,r,i)=>{');
  assert.notEqual(utIdx, -1);
  const utSlice = engine.slice(utIdx, utIdx + 650);
  assert.equal(utSlice.includes('m('), false);
  assert.equal(utSlice.includes('voucherType:'), false);

  // Verify report engine excludes petty cash report sections & CSV columns
  assert.equal(engine.includes('Petty Cash Float (PKR),'), false);
  assert.equal(engine.includes('Include Petty Cash'), false);
  assert.equal(engine.includes('y.pettyCash'), false);

  // Verify MultiFormatReportsHub & financialReportPdfGenerator exclude petty cash register from reports
  const hub = readSource('src/components/MultiFormatReportsHub.tsx');
  assert.equal(hub.includes('Part B: Petty Cash Imprest Register'), false);
  assert.equal(hub.includes('scopedPettyCash'), false);

  const sigMgr = readSource('src/components/ReportSignatureManager.tsx');
  assert.equal(sigMgr.includes('Expense & Petty Cash'), false);
});

test('Update 3: editing a transaction permits changing voucherType and enforces unique voucherNo on create & edit', () => {
  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(engine.includes('VOUCHER_NUMBER_EXISTS') || engine.includes('already exists'));
  assert.ok(engine.includes('ot=(e,t)=>{'));

  const editModal = readSource('src/components/VoucherEditingModal.tsx');
  assert.ok(editModal.includes('formVoucherType'));
  assert.ok(editModal.includes('formVoucherNo'));
  assert.ok(editModal.includes('getNextVoucherNumber'));
  assert.ok(editModal.includes('voucherType: formVoucherType'));
  assert.ok(editModal.includes('voucherNo: cleanVoucherNo'));
  assert.ok(editModal.includes('is already assigned to another transaction'));

  const expressModal = readSource('src/components/ExpressVoucherModal.tsx');
  assert.ok(expressModal.includes('transactions,'));
  assert.ok(expressModal.includes('already exists'));
  assert.ok(expressModal.includes('setGeneratedVoucherNo'));
});

test('Update 4: financial reports omit bottom narration and unnecessary boilerplate text', () => {
  const engine = readSource('src/core/aplusEngine.js');
  assert.equal(engine.includes('Official Physical Audit Record'), false);
  assert.equal(engine.includes('IAS 1 & IFRS COMPLIANT'), false);
  assert.equal(engine.includes('Closed into Institutional Capital Fund'), false);

  const hub = readSource('src/components/MultiFormatReportsHub.tsx');
  assert.equal(hub.includes('Official Report Format #'), false);

  const pdfGen = readSource('src/services/financialReportPdfGenerator.ts');
  assert.equal(pdfGen.includes('Official Institutional Financial Report'), false);

  const ledgerPdf = readSource('src/components/FullTransactionLedgerPdfExport.tsx');
  assert.equal(ledgerPdf.includes('Double-Entry Verified'), false);
});

test('Update 5: QR code removed from vouchers and printable voucher columns are widened while preserving print header/footer', () => {
  const a4 = readSource('src/components/PrintableVoucherA4Layout.tsx');
  assert.equal(a4.includes('VoucherQRCodeBadge'), false);
  assert.equal(a4.includes('Verification Status'), false);
  assert.ok(a4.includes('max-w-5xl'));
  assert.ok(a4.includes('min-w-[230px]'));
  assert.ok(a4.includes('w-32'));
  assert.ok(a4.includes('voucher-print-table-wrapper'));
  assert.ok(a4.includes('voucher-print-header'));
  assert.ok(a4.includes('voucher-print-footer'));

  const detail = readSource('src/components/VoucherDetailModal.tsx');
  assert.equal(detail.includes('VoucherQRCodeBadge'), false);
  assert.ok(detail.includes('max-w-4xl'));
  assert.ok(detail.includes('min-w-[240px]'));

  const engine = readSource('src/core/aplusEngine.js');
  assert.equal(engine.includes('VoucherQRCodeBadge'), false);
});

test('Update 6: newly created users resolve via email or username, dispatch verified login cleanly, and enforce manual login on refresh', () => {
  const secAuth = readSource('src/services/secureAuthentication.ts');
  assert.ok(secAuth.includes('.edu.pk'));
  assert.ok(secAuth.includes('aplus-verified-login'));
  assert.ok(secAuth.includes('memberships'));

  const firebaseSrc = readSource('src/firebase.ts');
  assert.ok(firebaseSrc.includes('inMemoryPersistence'));

  const appSrc = readSource('src/App.tsx');
  assert.ok(appSrc.includes('hadAuthenticatedUserRef'));

  const syncSrc = readSource('src/services/globalUserSyncService.ts');
  assert.ok(syncSrc.includes(".replace(/\\//g, '_')"));
});

test('Regression Guard: every jsxs/jsxDEV call in aplusEngine.js passes static children as an Array', () => {
  const code = readSource('src/core/aplusEngine.js');
  const ast = parseAst(code);
  const bad: string[] = [];

  const isJsxsCallee = (callee: any): boolean => {
    if (!callee) return false;
    if (callee.type === 'Identifier') return callee.name === 'jsxs' || callee.name === 'jsxDEV';
    if (callee.type === 'MemberExpression') {
      return callee.property?.name === 'jsxs' || callee.property?.name === 'jsxDEV';
    }
    if (callee.type === 'SequenceExpression') {
      return isJsxsCallee(callee.expressions[callee.expressions.length - 1]);
    }
    return false;
  };

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node.type === 'CallExpression' && isJsxsCallee(node.callee)) {
      const props = node.arguments?.[1];
      const ch =
        props?.type === 'ObjectExpression'
          ? props.properties.find(
              (p: any) =>
                p.type === 'Property' &&
                (p.key?.name === 'children' || p.key?.value === 'children')
            )
          : null;
      if (!ch || ch.value?.type !== 'ArrayExpression') {
        bad.push(code.slice(node.start, node.start + 140));
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'start' || k === 'end' || k === 'type') continue;
      const v = node[k];
      if (v && typeof v === 'object') walk(v);
    }
  };

  walk(ast);
  assert.deepEqual(bad, []);
});
