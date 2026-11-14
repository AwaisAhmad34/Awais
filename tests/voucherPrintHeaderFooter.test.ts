import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatPrintRequestTimestamp,
  resolveVoucherCampusInfo,
} from '../src/utils/voucherPrintUtils';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('formatPrintRequestTimestamp formats explicit dates with date and time', () => {
  const formatted = formatPrintRequestTimestamp(new Date('2026-11-13T09:15:30'));
  assert.ok(formatted.includes('2026'));
  assert.ok(formatted.includes('13'));
  assert.ok(/\d{1,2}:\d{2}:\d{2}/.test(formatted));
});

test('resolveVoucherCampusInfo resolves current school campus name from campuses list and fallback fields', () => {
  const campuses = [
    { id: 'c-main', name: 'Khiali Main Campus', code: 'KHL' },
    { id: 'c-sub', name: 'Canal View Branch', code: 'CVT' },
  ];

  const byVoucherCampus = resolveVoucherCampusInfo({
    voucher: { campusId: 'c-sub' },
    currentCampusId: 'c-main',
    campuses,
  });
  assert.equal(byVoucherCampus.campusName, 'Canal View Branch');
  assert.equal(byVoucherCampus.campusCode, 'CVT');
  assert.equal(byVoucherCampus.campusDisplayLabel, 'Canal View Branch (CVT)');

  const byCurrentCampus = resolveVoucherCampusInfo({
    currentCampusId: 'c-main',
    campuses,
  });
  assert.equal(byCurrentCampus.campusName, 'Khiali Main Campus');
  assert.equal(byCurrentCampus.campusCode, 'KHL');
  assert.equal(byCurrentCampus.campusDisplayLabel, 'Khiali Main Campus (KHL)');

  const byExplicitCampus = resolveVoucherCampusInfo({
    campus: { name: 'Model Town Girls Campus' },
    campuses: [],
  });
  assert.equal(byExplicitCampus.campusDisplayLabel, 'Model Town Girls Campus');
});

test('index.css print styles preserve custom voucher headers and footers on every page', () => {
  const css = readSource('src/index.css');

  assert.match(css, /@page\s*\{[\s\S]*?margin:\s*10mm\s+10mm\s+12mm/i);
  assert.match(css, /header:not\(\.voucher-print-header\)/);
  assert.match(css, /footer:not\(\.voucher-print-footer\)/);
  assert.match(css, /\.voucher-print-header\s*\{/);
  assert.match(css, /\.voucher-print-footer\s*\{/);
  assert.match(css, /thead\.voucher-print-thead\s*\{[\s\S]*?display:\s*table-header-group/);
  assert.match(css, /tfoot\.voucher-print-tfoot\s*\{[\s\S]*?display:\s*table-footer-group/);
  assert.match(css, /body:has\(#printable-voucher-document\)/);
});

test('all voucher print surfaces include custom voucher header/footer with campus name and print timestamp', () => {
  const a4Layout = readSource('src/components/PrintableVoucherA4Layout.tsx');
  assert.ok(a4Layout.includes('voucher-print-table-wrapper'));
  assert.ok(a4Layout.includes('voucher-print-header'));
  assert.ok(a4Layout.includes('voucher-print-footer'));
  assert.ok(a4Layout.includes('campusInfo.campusDisplayLabel'));
  assert.ok(a4Layout.includes('printTimestamp'));
  assert.ok(a4Layout.includes('Print Request Timestamp'));

  const detailModal = readSource('src/components/VoucherDetailModal.tsx');
  assert.ok(detailModal.includes('printable-voucher-document'));
  assert.ok(detailModal.includes('voucher-print-header'));
  assert.ok(detailModal.includes('voucher-print-footer'));
  assert.ok(detailModal.includes('campusInfo.campusDisplayLabel'));
  assert.ok(detailModal.includes('printTimestamp'));

  const expressModal = readSource('src/components/ExpressVoucherModal.tsx');
  assert.ok(expressModal.includes('printable-voucher-document'));
  assert.ok(expressModal.includes('PrintableVoucherA4Layout'));
  assert.ok(expressModal.includes('printTimestamp'));
  assert.ok(expressModal.includes('refreshPrintTimestamp'));

  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(engine.includes('data-voucher-campus-name'));
  assert.ok(engine.includes('data-print-timestamp'));
  assert.ok(engine.includes('Printed:'));
});

test('Print Report (printOrDownloadElement / Dw) strictly opens native print dialog without creating or downloading a PDF', () => {
  const engine = readSource('src/core/aplusEngine.js');
  const dwStart = engine.indexOf('async function Dw(');
  assert.notEqual(dwStart, -1);
  const dwSnippet = engine.slice(dwStart, dwStart + 500);
  assert.ok(dwSnippet.includes('window.print()'));
  assert.ok(dwSnippet.includes('downloadedPdf:!1'));
  assert.equal(dwSnippet.includes('Ew('), false);
  assert.equal(dwSnippet.includes('downloadedPdf:!0'), false);
  assert.equal(engine.includes('`Print Report (PDF)`'), false);
});

