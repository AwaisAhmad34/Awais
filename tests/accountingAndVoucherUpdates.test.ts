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
import { resolveOrganizationBrand } from '../src/utils/organizationBrand';

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

test('Update 5: QR code removed from vouchers and printable voucher columns fit single A4 page while preserving print header/footer', () => {
  const a4 = readSource('src/components/PrintableVoucherA4Layout.tsx');
  assert.equal(a4.includes('VoucherQRCodeBadge'), false);
  assert.equal(a4.includes('Verification Status'), false);
  assert.ok(a4.includes('max-w-[210mm]'));
  assert.ok(a4.includes('table-fixed'));
  assert.ok(a4.includes('break-inside-avoid'));
  assert.ok(a4.includes('voucher-print-table-wrapper'));
  assert.ok(a4.includes('voucher-print-header'));
  assert.ok(a4.includes('voucher-print-footer'));

  const detail = readSource('src/components/VoucherDetailModal.tsx');
  assert.equal(detail.includes('VoucherQRCodeBadge'), false);
  assert.ok(detail.includes('max-w-4xl'));
  assert.ok(detail.includes('table-fixed'));

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

test('Update 7: single-page A4 voucher export, bottom-only Sign Out, Account Head search, and non-blocking Petty Cash Delete', () => {
  const engine = readSource('src/core/aplusEngine.js');
  const topBar = readSource('src/components/AplusTopBar.tsx');
  const a4 = readSource('src/components/PrintableVoucherA4Layout.tsx');
  const css = readSource('src/index.css');
  const hub = readSource('src/components/MultiFormatReportsHub.tsx');
  const extMod = readSource('src/components/PlatformAdminExtendedModules.tsx');

  // 1. Voucher layout fits single A4 page per voucher without overflow clipping
  assert.ok(engine.includes('_vPages=e?.id===`vouchers-report-document`?Array.from(e.querySelectorAll(`.voucher-page-wrapper`)):[]'));
  assert.ok(engine.includes('Math.min(d/_cv.width,p/_cv.height)'));
  assert.ok(a4.includes('a4-voucher-sheet bg-white text-black max-w-[210mm]'));
  assert.ok(css.includes('.voucher-page-wrapper'));

  // 2. Top bar omits Sign Out; Sign Out appears in bottom footer and sidebar bottom
  assert.equal(topBar.includes('<span>Sign Out</span>'), false);
  assert.ok(engine.includes('onClick:()=>{_appLogout?.()},className:`px-3 py-1 rounded-lg bg-rose-50'));
  assert.ok(engine.includes('window.__APLUS_LOGOUT__?.()'));

  // 3. Account Head search filter on singleLedger & T-Account reports
  assert.ok(engine.includes('Search account head by name or code...'));
  assert.ok(hub.includes('Search account head by name or code...'));

  // 4. Petty cash Recent Transactions Delete works without blocked window.confirm
  const pwStart = engine.indexOf('Pw=()=>{');
  const pwEnd = engine.indexOf('Yw=()=>{');
  const pwFull = engine.slice(pwStart, pwEnd);
  assert.equal(pwFull.includes('window.confirm'), false);
  assert.ok(pwFull.includes('Recent Transactions ('));
  assert.ok(pwFull.includes('_confirmDelPc'));
  assert.ok(extMod.includes('deletePettyCashTransaction(pc.id)'));
});

test('Update 8: top-top organization/campus report header and contained short Particulars/Narration cells', () => {
  const engine = readSource('src/core/aplusEngine.js');
  const hub = readSource('src/components/MultiFormatReportsHub.tsx');

  // 1. Top-top text organization & campus header in Vw and MultiFormatReportsHub
  const vwStart = engine.indexOf('var Vw=');
  const vwEnd = engine.indexOf('Hw=e=>');
  const vwCode = engine.slice(vwStart, vwEnd);
  assert.ok(vwCode.includes('report-top-org-header'));
  assert.ok(vwCode.includes('Campus: '));
  assert.ok(hub.includes('report-top-org-header'));

  // 2. Opening B/F rows keep Particulars/Narration strictly in its own column with short text (no colSpan:2)
  assert.equal(engine.includes('Balance Brought Forward from Previous Period'), false);
  assert.equal(engine.includes('Balance Brought Forward from Previous Fiscal Period'), false);
  assert.equal(engine.includes('Initial Balance b/f'), false);
  assert.ok(engine.includes('children:`Balance B/F`'));
  assert.ok(engine.includes('max-w-[240px] break-words'));
});

test('Update 9: single-line wide Description/Particulars voucher columns, Trial Balance with-transactions filter, and unified executive Sidebar', () => {
  const engine = readSource('src/core/aplusEngine.js');
  const a4 = readSource('src/components/PrintableVoucherA4Layout.tsx');
  const topBar = readSource('src/components/AplusTopBar.tsx');
  const hub = readSource('src/components/MultiFormatReportsHub.tsx');
  const css = readSource('src/index.css');

  // 1. Voucher table compact columns + wide single-line Description / Particulars
  assert.ok(a4.includes('w-[4%]'));
  assert.ok(a4.includes('w-[40%] text-left whitespace-nowrap'));
  assert.ok(a4.includes('whitespace-nowrap truncate'));
  assert.ok(engine.includes('w-[4%] text-center whitespace-nowrap'));
  assert.ok(engine.includes('w-[40%] text-left whitespace-nowrap'));
  assert.ok(engine.includes('whitespace-nowrap truncate'));

  // 2. Trial Balance COA-with-transactions filter option
  assert.ok(engine.includes('_tbScope'));
  assert.ok(engine.includes('With Transactions Only'));
  assert.ok(engine.includes('_tbTotals'));
  assert.ok(hub.includes("trialBalanceScope === 'with_tx'"));
  assert.ok(hub.includes('With Transactions Only'));

  // 3. Streamlined TopBar + unified executive Sidebar housing all tool actions cleanly
  assert.ok(topBar.includes('__APLUS_OPEN_TOOL__'));
  assert.equal(topBar.includes('<span>Platform Site Admin Hub</span>'), false);
  assert.equal(topBar.includes('<span>Restore Deleted COA</span>'), false);
  assert.equal(topBar.includes('<span>Sync to Cloud</span>'), false);

  const unStart = engine.indexOf('un=({');
  const unEnd = engine.indexOf(',dn=({', unStart);
  const sidebarCode = engine.slice(unStart, unEnd);
  assert.ok(sidebarCode.includes('Filter menu & tools...'));
  assert.ok(sidebarCode.includes('__APLUS_OPEN_TOOL__'));
  assert.ok(sidebarCode.includes('Platform Site Admin Hub'));
  assert.ok(sidebarCode.includes('Restore Deleted COA'));
  assert.ok(sidebarCode.includes('Sync to Cloud'));
  assert.equal(sidebarCode.includes('animate-pulse'), false);
  assert.ok(css.includes('.sidebar-hide-min'));
});

test('Update 10: toggleSidebarMinimized does not dispatch events inside a React state updater', () => {
  const app = readSource('src/App.tsx');
  const start = app.indexOf('const toggleSidebarMinimized');
  const end = app.indexOf('useEffect(() => {', start);
  const block = app.slice(start, end);
  assert.equal(block.includes('setIsSidebarMinimized((prev)'), false);
  assert.ok(block.includes('const next = !isSidebarMinimized;'));
  assert.ok(block.includes('setIsSidebarMinimized(next);'));
});

test('Update 11: PlatformSiteAdminHub matches screen height and enables scrollable main pane with no-scrollbar', () => {
  const app = readSource('src/App.tsx');
  const hub = readSource('src/components/PlatformSiteAdminHub.tsx');

  assert.ok(app.includes('h-screen overflow-hidden flex flex-col bg-slate-950'));
  assert.equal(hub.includes('min-h-[820px]'), false);
  assert.equal(hub.includes('max-h-[700px]'), false);
  assert.ok(hub.includes('flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden'));
  assert.ok(hub.includes('<main className="flex-1 min-h-0 p-5 sm:p-6 overflow-y-auto no-scrollbar bg-slate-900/60">'));
});

test('Update 12: .no-scrollbar class, Accord Ledger platform branding, and Platform Owner Setup option in login page', () => {
  const css = readSource('src/index.css');
  const html = readSource('index.html');
  const app = readSource('src/App.tsx');
  const login = readSource('src/components/DynamicCampusLoginPortal.tsx');
  const adminSvc = readSource('src/services/platformSiteAdminService.ts');
  const engine = readSource('src/core/aplusEngine.js');

  // 1. .no-scrollbar defined in index.css and applied across main containers
  assert.ok(css.includes('.no-scrollbar'));
  assert.ok(css.includes('scrollbar-width: none !important;'));
  assert.ok(css.includes('.no-scrollbar::-webkit-scrollbar'));
  assert.ok(html.includes('<html lang="en" class="no-scrollbar">'));
  assert.ok(app.includes('no-scrollbar'));
  assert.ok(engine.includes('no-scrollbar'));

  // 2. Accord Ledger platform name across HTML, Platform settings, and Login Page
  assert.ok(html.includes('Accord Ledger'));
  assert.ok(adminSvc.includes("platformName: 'Accord Ledger'"));
  assert.ok(login.includes('Accord Ledger'));

  // 3. Platform Owner Setup option clearly available in header & login card
  assert.ok(login.includes('Platform Owner Setup'));
  assert.ok(login.includes('Accord Ledger — Platform Owner Setup'));
  assert.ok(login.includes('setIsOwnerSetupOpen(true)'));
});

test('Update 13: A4 and fallback voucher tables enforce colgroup column widths and executive sans-serif typography', () => {
  const a4 = readSource('src/components/PrintableVoucherA4Layout.tsx');
  const engine = readSource('src/core/aplusEngine.js');
  const css = readSource('src/index.css');

  // 1. Explicit <colgroup> before <thead> so table-fixed does not flatten column widths behind colSpan header row
  const colgroupPosA4 = a4.indexOf('<colgroup>');
  const theadPosA4 = a4.indexOf('<thead>', colgroupPosA4);
  assert.notEqual(colgroupPosA4, -1);
  assert.ok(theadPosA4 > colgroupPosA4);
  assert.ok(a4.includes('<col className="w-[40%]" />'));
  assert.ok(a4.includes('<col className="w-[9%]" />'));

  const colgroupPosEng = engine.indexOf('jsxs)(`colgroup`');
  const descPosEng = engine.indexOf('Description / Particulars');
  assert.notEqual(colgroupPosEng, -1);
  assert.ok(colgroupPosEng < descPosEng);

  // 2. Executive sans-serif voucher typography & crisp refined borders/shading
  assert.ok(a4.includes('a4-voucher-title font-sans font-extrabold'));
  assert.ok(a4.includes('bg-slate-100 text-slate-950'));
  assert.ok(a4.includes('leading-snug break-words'));
  assert.equal(a4.includes('a4-voucher-title font-serif'), false);
  assert.ok(css.includes('.a4-voucher-typo-10pt'));
  assert.ok(css.includes('font-size: 8.75pt;'));
});

test('Update 14: Level 2 Organization Owner can switch own campuses and open Consolidated Reports without cross-tenant leakage', () => {
  const auth = readSource('src/context/TenantAuthContext.tsx');
  const app = readSource('src/App.tsx');
  const reportsHub = readSource('src/components/MultiFormatReportsHub.tsx');
  const engine = readSource('src/core/aplusEngine.js');

  // 1. TenantAuthContext exposes isClientOwner and authorizedCampuses and does not branch-lock Level 2 owners
  assert.ok(auth.includes('isClientOwner: boolean;'));
  assert.ok(auth.includes('authorizedCampuses: Campus[];'));
  assert.ok(auth.includes('const canSwitchOwnCampuses = isSuper || isClientOwner;'));
  assert.ok(auth.includes('!canSwitchOwnCampuses && role === \'campus_admin\' && Boolean(activeCampusId)'));

  // 2. App.tsx Level 2 banner includes Consolidated All Own Campuses option and Consolidated Reports action
  assert.ok(app.includes('<option value="all">'));
  assert.ok(app.includes('Consolidated — All Own Campuses'));
  assert.ok(app.includes('Consolidated Reports'));
  assert.ok(app.includes("new CustomEvent('aplus-navigate-tab', { detail: { tab: 'reports' } })"));

  // 3. MultiFormatReportsHub isolates Consolidated Reports to authorizedCampusIdSet for Level 2 owners
  assert.ok(reportsHub.includes('isClientOwner &&'));
  assert.ok(reportsHub.includes('authorizedCampusIdSet.size > 0'));
  assert.ok(reportsHub.includes('!authorizedCampusIdSet.has(tx.campusId)'));

  // 4. aplusEngine.js enables multi-campus switching & Consolidated Reports for Level 2 in header, sidebar, dashboard, and reports
  assert.ok(engine.includes('aplus-navigate-tab'));
  assert.ok(engine.includes('_canSwitchCampuses'));
  assert.ok(engine.includes('_dnCanAll'));
  assert.ok(engine.includes('Consolidated Reports'));
  assert.ok(engine.includes('_ywCanAll'));
  assert.ok(engine.includes('_eteCanAll'));
  assert.ok(engine.includes('_mwCanAll'));
  assert.ok(engine.includes('_pwCanAll'));
});

test('Update 15: Per-campus voucher/petty-cash counting isolation, Level 2 opening balances, and organization name/logo in financial reports', () => {
  // 1. resolveOrganizationBrand runtime resolution prioritizes active client name & logo, with campus/custom fallback
  const clientBrand = resolveOrganizationBrand({
    currentUser: { clientId: 'client-beacon', role: 'level_2_client_super_admin' },
    campus: {
      id: 'campus-sub-2',
      clientId: 'client-beacon',
      name: 'South Branch',
      code: 'SB-02',
      city: 'Lahore',
      address: '',
      phone: '',
      email: '',
      accountantName: '',
      pettyCashFloat: 50000,
      currentPettyCash: 50000,
      status: 'active',
    },
    campuses: [],
    currentCampusId: 'campus-sub-2',
    orgSettings: { schoolName: 'A+ School System' },
    clients: [
      {
        id: 'client-beacon',
        name: 'Beacon Horizon Academy',
        code: 'BHA',
        logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      } as any,
    ],
  });
  assert.equal(clientBrand.name, 'Beacon Horizon Academy');
  assert.equal(clientBrand.logoUrl, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

  const campusLogoOverride = resolveOrganizationBrand({
    currentUser: { clientId: 'client-beacon' },
    campus: {
      id: 'campus-sub-2',
      clientId: 'client-beacon',
      name: 'South Branch',
      code: 'SB-02',
      city: 'Lahore',
      address: '',
      phone: '',
      email: '',
      accountantName: '',
      pettyCashFloat: 50000,
      currentPettyCash: 50000,
      status: 'active',
      logoType: 'upload',
      logoBase64: 'data:image/png;base64,CAMPUS_CUSTOM_LOGO',
    },
    orgSettings: { schoolName: 'Custom Settings School' },
    clients: [{ id: 'client-beacon', name: 'A+ School System', logoUrl: 'https://example.com/client.png' } as any],
  });
  assert.equal(campusLogoOverride.name, 'Custom Settings School');
  assert.equal(campusLogoOverride.logoUrl, 'data:image/png;base64,CAMPUS_CUSTOM_LOGO');

  // 2. Per-campus voucher & petty cash numbering + UI counting isolation
  const engine = readSource('src/core/aplusEngine.js');
  const topBar = readSource('src/components/AplusTopBar.tsx');
  const approvalHub = readSource('src/components/BulkVoucherApprovalHub.tsx');

  assert.ok(engine.includes('campusScoped=n&&n!==`all`?list.filter(x=>x.campusId===n):list'));
  assert.ok(engine.includes('pcScoped=e&&e!==`all`?h.filter(t=>t.campusId===e):h'));
  assert.ok(engine.includes('targetCid=e.campusId||d'));
  assert.ok(engine.includes('[w,y,txList]'));
  assert.ok(engine.includes('_prevPwG=(0,v.useRef)(g)'));
  assert.ok(engine.includes('let switched=_prevPwG.current!==g'));
  assert.ok(engine.includes('Safe Ledger & Float Replenishment (`,r.filter(x=>g===`all`||x.campusId===g).length,`)'));
  assert.ok(engine.includes('transactionCount:_iteTxCount,pettyCashCount:_itePcCount'));
  assert.ok(engine.includes('badge:_sbCampuses.length'));
  assert.ok(topBar.includes('effectivePendingScope'));
  assert.ok(approvalHub.includes('authorizedCampusIdSet'));

  // 3. Level 2 opening balances editability on sub-campuses
  assert.ok(engine.includes('_opEdit=Boolean(a||_opCanAll)'));
  assert.ok(engine.includes('!_opEdit&&(0,K.jsxs)(`div`'));
  assert.ok(engine.includes('_opEdit&&(0,K.jsxs)(`button`,{onClick:M'));

  // 4. Organization Name and Logo in financial reports and PDF exports
  const reportsHub = readSource('src/components/MultiFormatReportsHub.tsx');
  const pdfGen = readSource('src/services/financialReportPdfGenerator.ts');
  const ledgerPdf = readSource('src/components/FullTransactionLedgerPdfExport.tsx');

  assert.ok(reportsHub.includes('resolvedOrgBrand'));
  assert.ok(reportsHub.includes('resolvedOrgBrand.logoUrl'));
  assert.ok(reportsHub.includes('logoUrl: resolvedOrgBrand.logoUrl'));
  assert.ok(pdfGen.includes('resolvePdfLogoDataUrl'));
  assert.ok(ledgerPdf.includes('resolvedOrgBrand'));
  assert.ok(engine.includes('resolveOrganizationBrand as __resolveOrgBrand'));
  assert.ok(engine.includes('_vwBrand=__resolveOrgBrand'));
  assert.ok(engine.includes('_nwBrand=__resolveOrgBrand'));
  assert.ok(engine.includes('_awBrand=__resolveOrgBrand'));
  assert.ok(engine.includes('_jwBrand=__resolveOrgBrand'));
  assert.ok(engine.includes('_ywBrand=__resolveOrgBrand'));
});



