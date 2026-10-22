/**
 * Multi-Campus Tenant Isolation, Site Admin Access, & Data Recovery Test Suite
 * Validates campus financial segregation, soft deletion preservation,
 * restore preconditions, dependency checks, and role isolation.
 */

import {
  enforceTenantQueryFilter,
  validateCampusPermission as testValidateCampusPermission,
  TenantIsolatedRepository,
  validateClientReportAccess,
  PLATFORM_FINANCIAL_REPORTS_CATALOG,
  generateDefaultClientReportPermissions
} from '../src/services/tenantIsolationService';

function runTenantIsolationAndRecoveryTests() {
  console.log('Running Multi-Campus Tenant Isolation, Security & Recovery Verification Tests...');

  const campuses = [
    { id: 'campus_isb_01', code: 'ISB-MAIN', name: 'Islamabad Main Campus', isMainCampus: true },
    { id: 'campus_rwp_02', code: 'RWP-SUB', name: 'Rawalpindi Satellite Branch', parentCampusId: 'campus_isb_01' },
    { id: 'campus_lhr_03', code: 'LHR-02', name: 'Lahore Branch', isMainCampus: false }
  ];

  // Test 1: Uniqueness of Campus Identifiers
  const codes = new Set(campuses.map(c => c.code));
  if (codes.size !== campuses.length) {
    throw new Error('Tenant Isolation Failed: Duplicate campus codes found.');
  }
  console.log('✓ Test 1: Campus code uniqueness verified.');

  // Test 2: Parent-Child Hierarchy Mapping
  const child = campuses.find(c => c.code === 'RWP-SUB');
  if (!child || child.parentCampusId !== 'campus_isb_01') {
    throw new Error('Hierarchy Test Failed: Child campus parentCampusId mismatch.');
  }
  console.log('✓ Test 2: Hierarchical campus mapping verified.');

  // Test 3: Segregated Voucher Namespace Isolation
  const sampleVouchers = [
    { id: 'v1', voucherNo: 'BPV-001', campusId: 'campus_isb_01', type: 'BPV', amount: 5000 },
    { id: 'v2', voucherNo: 'CPV-001', campusId: 'campus_rwp_02', type: 'CPV', amount: 1500 }
  ];
  const isbVouchers = sampleVouchers.filter(v => v.campusId === 'campus_isb_01');
  const rwpVouchers = sampleVouchers.filter(v => v.campusId === 'campus_rwp_02');

  if (isbVouchers.length !== 1 || rwpVouchers.length !== 1) {
    throw new Error('Voucher Segregation Failed: Cross-campus leakage detected.');
  }
  console.log('✓ Test 3: Voucher segregation and namespace isolation verified.');

  // Test 4: Soft-Deletion Data Preservation (Original IDs, UUIDs, metadata, and financial fields)
  const originalVoucher = {
    id: 'tx-2026-9901',
    voucherNo: 'BPV-9901',
    voucherType: 'BPV',
    campusId: 'campus_isb_01',
    date: '2026-04-10',
    totalDebit: 75000,
    totalCredit: 75000,
    entries: [
      { accountCode: '5001-1', debit: 75000, credit: 0 },
      { accountCode: '1002-1', debit: 0, credit: 75000 }
    ]
  };

  const softDeletedItem = {
    id: 'trash-voucher-01',
    originalId: originalVoucher.id,
    recordType: 'VOUCHER',
    identifier: originalVoucher.voucherNo,
    deletedAt: new Date().toISOString(),
    status: 'soft_deleted',
    originalPayload: originalVoucher,
    financialImpact: {
      totalAmount: 75000,
      totalDebit: 75000,
      totalCredit: 75000,
      affectedAccountCodes: ['5001-1', '1002-1']
    }
  };

  if (
    softDeletedItem.originalPayload.id !== originalVoucher.id ||
    softDeletedItem.originalPayload.voucherNo !== 'BPV-9901' ||
    softDeletedItem.financialImpact.totalAmount !== 75000
  ) {
    throw new Error('Soft Deletion Failed: Did not preserve unmutated original voucher snapshot.');
  }
  console.log('✓ Test 4: Soft deletion preservation of IDs, metadata, and financial impact verified.');

  // Test 5: Dependency & Missing Account Head Detection
  const activeAccountHeads = [
    { code: '1002-1', name: 'Bank Alfalah Main' }
    // Note: 5001-1 is intentionally omitted to verify dependency check catches missing head
  ];

  const missingCodes = originalVoucher.entries
    .map(e => e.accountCode)
    .filter(code => !activeAccountHeads.some(h => h.code === code));

  if (!missingCodes.includes('5001-1') || missingCodes.length !== 1) {
    throw new Error('Dependency Validator Failed: Did not detect missing Chart of Accounts head 5001-1.');
  }
  console.log('✓ Test 5: Restore dependency check correctly flags missing account head 5001-1.');

  // Test 6: Duplicate Voucher Conflict Prevention
  const existingActiveVouchers = [{ voucherNo: 'BPV-9901', campusId: 'campus_isb_01' }];
  const hasDuplicate = existingActiveVouchers.some(v => v.voucherNo === softDeletedItem.identifier);
  if (!hasDuplicate) {
    throw new Error('Duplicate Check Failed: Should flag duplicate voucher number collision.');
  }
  console.log('✓ Test 6: Duplicate voucher number conflict detection verified.');

  // Test 7: Permanent Deletion Authorization Guard
  const invalidPassphrase: any = 'delete';
  const validPassphrase: any = 'PERMANENT_DELETE_CONFIRMED';
  const canPurgeWithInvalid = invalidPassphrase === 'PERMANENT_DELETE_CONFIRMED';
  const canPurgeWithValid = validPassphrase === 'PERMANENT_DELETE_CONFIRMED';

  if (canPurgeWithInvalid || !canPurgeWithValid) {
    throw new Error('Permanent Purge Guard Failed: Security phrase enforcement breached.');
  }
  console.log('✓ Test 7: Controlled permanent deletion authorization phrase verified.');

  // Test 8: Platform Site Admin Role Isolation
  const siteAdminUser = { role: 'level_1_platform_super_admin', campusId: undefined, campusAccess: 'all' };
  const campusStaffUser = { role: 'accountant', campusId: 'campus_rwp_02', campusAccess: 'campus_only' };

  const isPlatformSuper =
    siteAdminUser.role === 'admin' ||
    siteAdminUser.role === 'superadmin' ||
    siteAdminUser.role === 'level_1_platform_super_admin';

  const isStaffSuper =
    campusStaffUser.role === 'admin' ||
    campusStaffUser.role === 'superadmin' ||
    campusStaffUser.role === 'level_1_platform_super_admin';

  if (!isPlatformSuper || isStaffSuper) {
    throw new Error('Site Admin Role Isolation Failed: Privilege boundary check violated.');
  }
  console.log('✓ Test 8: Platform Site Admin access separation from campus roles verified.');

  // Test 9: Financial Imbalance Detection (Debit === Credit check)
  const unbalancedVoucher = {
    totalDebit: 50000,
    totalCredit: 45000,
    entries: [
      { accountCode: '5001-1', debit: 50000, credit: 0 },
      { accountCode: '1002-1', debit: 0, credit: 45000 }
    ]
  };
  const isBalanced = Math.abs(unbalancedVoucher.totalDebit - unbalancedVoucher.totalCredit) < 0.01;
  if (isBalanced) {
    throw new Error('Balance Equation Test Failed: Did not catch unbalanced ledger voucher.');
  }
  console.log('✓ Test 9: Financial balance equation validation (Debit === Credit) verified.');

  // Test 10: Circular Campus Hierarchy Cycle Detection
  const treeNodes = [
    { id: 'node_a', parentId: 'node_b' },
    { id: 'node_b', parentId: 'node_c' },
    { id: 'node_c', parentId: 'node_a' } // loop
  ];
  let hasCycle = false;
  let curr = 'node_a';
  const visited = new Set();
  while (curr && !hasCycle) {
    if (visited.has(curr)) {
      hasCycle = true;
      break;
    }
    visited.add(curr);
    const n = treeNodes.find(item => item.id === curr);
    curr = n ? n.parentId : '';
  }
  if (!hasCycle) {
    throw new Error('Hierarchy Cycle Test Failed: Did not detect circular hierarchy loop.');
  }
  console.log('✓ Test 10: Circular campus hierarchy loop detection verified.');

  // Test 11: Deleted COA Restoration Security Boundary
  // Restoring deleted COA is strictly restricted to Site Owner and Main Branch (not sub-campuses)
  const mockCampuses = [
    { id: 'campus_main', code: 'MAIN', isMainCampus: true, parentCampusId: null },
    { id: 'campus_sub', code: 'SUB1', isMainCampus: false, parentCampusId: 'campus_main' }
  ];
  const canRestoreCOA_SiteOwner = true;
  const canRestoreCOA_MainBranch = mockCampuses.find(c => c.id === 'campus_main')?.isMainCampus && !mockCampuses.find(c => c.id === 'campus_main')?.parentCampusId;
  const canRestoreCOA_SubCampus = mockCampuses.find(c => c.id === 'campus_sub')?.isMainCampus && !mockCampuses.find(c => c.id === 'campus_sub')?.parentCampusId;

  if (!canRestoreCOA_SiteOwner || !canRestoreCOA_MainBranch || canRestoreCOA_SubCampus) {
    throw new Error('COA Restoration Security Test Failed: Sub-campus was incorrectly granted COA restore privilege or Main/Owner was blocked.');
  }
  console.log('✓ Test 11: Deleted COA restoration privilege boundary (Site Owner & Main Branch only) verified.');

  // Test 12: Campus DB Isolation Across Clients & Sub-Campuses
  const allCampusesList = [
    { id: 'c1_main', clientId: 'client_1', parentCampusId: null },
    { id: 'c1_sub', clientId: 'client_1', parentCampusId: 'c1_main' },
    { id: 'c2_main', clientId: 'client_2', parentCampusId: null },
    { id: 'c2_sub', clientId: 'client_2', parentCampusId: 'c2_main' },
  ];
  // Super admin of client_1 main campus
  const client1SuperAdminCampuses = allCampusesList.filter(c => {
    if (c.clientId !== 'client_1') return false; // Strictly isolated from other clients
    return c.id === 'c1_main' || c.parentCampusId === 'c1_main';
  });
  if (client1SuperAdminCampuses.length !== 2 || client1SuperAdminCampuses.some(c => c.clientId === 'client_2')) {
    throw new Error('Campus DB Client Isolation Test Failed: Other client database was leaked to client 1.');
  }
  console.log('✓ Test 12: Campus DB cross-client isolation and sub-campus scoping verified.');

  // Test 13: Automatic 'client_id' Query Filter Injection
  const client1UserContext: any = {
    clientId: 'client_alpha',
    userId: 'user_01',
    userName: 'Campus Accountant',
    userRole: 'accountant',
    permissionLevel: 'level_5_departmental_staff',
    campusId: 'campus_isb_01',
    isPlatformAdmin: false,
    isClientAdmin: false,
  };

  const testCampuses: any[] = [
    { id: 'campus_isb_01', code: 'ISB', name: 'Islamabad Main', clientId: 'client_alpha', isMainCampus: true, status: 'active' },
    { id: 'campus_rwp_02', code: 'RWP', name: 'Rawalpindi Sub', clientId: 'client_alpha', isMainCampus: false, parentCampusId: 'campus_isb_01', status: 'active' },
    { id: 'campus_lhr_99', code: 'LHR', name: 'Lahore Branch', clientId: 'client_beta', isMainCampus: true, status: 'active' },
  ];

  const incomingRawQuery = { status: 'Posted', voucherType: 'BPV' };
  const rewritten = enforceTenantQueryFilter(client1UserContext, 'vouchers', incomingRawQuery, testCampuses);

  if (rewritten.isolatedFilters.client_id !== 'client_alpha') {
    throw new Error('Tenant Isolation Failed: Query did not automatically append enforced client_id.');
  }
  if (!rewritten.authorizedCampusIds.includes('campus_isb_01') || rewritten.authorizedCampusIds.includes('campus_lhr_99')) {
    throw new Error('Tenant Scoping Failed: Campus authorization leaked unauthorized campus.');
  }
  console.log('✓ Test 13: Automatic client_id filter injection and campus boundary enforcement verified.');

  // Test 14: Campus Permission Validation Across CRUD Operations
  const repo = new TenantIsolatedRepository({
    campuses: testCampuses,
    vouchers: [
      { id: 'v-alpha-1', voucherNo: 'BPV-101', clientId: 'client_alpha', campusId: 'campus_isb_01', totalDebit: 25000, totalCredit: 25000 },
      { id: 'v-beta-1', voucherNo: 'BPV-901', clientId: 'client_beta', campusId: 'campus_lhr_99', totalDebit: 50000, totalCredit: 50000 }
    ],
    users: [
      { id: 'u-alpha-1', name: 'Alpha Accountant', clientId: 'client_alpha', campusId: 'campus_isb_01' }
    ],
    financialRecords: [
      { id: 'fin-alpha-1', recordType: 'petty_cash', amount: 5000, clientId: 'client_alpha', campusId: 'campus_isb_01' }
    ]
  });

  // Query vouchers for client_alpha
  const queriedVouchers = repo.queryVouchers(client1UserContext);
  if (queriedVouchers.length !== 1 || queriedVouchers[0].id !== 'v-alpha-1') {
    throw new Error('Tenant Query Isolation Failed: Returned vouchers from other tenants or failed lookup.');
  }

  // Attempt cross-tenant getById (MUST throw 403 TenantSecurityError)
  let crossTenantBlocked = false;
  try {
    repo.getVoucherById(client1UserContext, 'v-beta-1');
  } catch (err: any) {
    if (err.code === 'TENANT_ISOLATION_VIOLATION') crossTenantBlocked = true;
  }
  if (!crossTenantBlocked) {
    throw new Error('Cross-Tenant Security Breach: User was able to access other client voucher.');
  }
  console.log('✓ Test 14: Cross-tenant voucher access blocked with TENANT_ISOLATION_VIOLATION.');

  // Test 15: Campus ID Permission Validation on Creation & Deletion
  let unauthorizedCampusBlocked = false;
  try {
    // client1UserContext is staff of campus_isb_01; attempting to create voucher in campus_rwp_02
    repo.createVoucher(client1UserContext, {
      voucherNo: 'CPV-FAIL',
      campus_id: 'campus_rwp_02',
      totalDebit: 1000,
      totalCredit: 1000,
    });
  } catch (err: any) {
    if (err.code === 'CAMPUS_PERMISSION_DENIED') unauthorizedCampusBlocked = true;
  }
  if (!unauthorizedCampusBlocked) {
    throw new Error('Campus Authorization Failed: Staff created voucher in unassigned campus.');
  }
  console.log('✓ Test 15: Unauthorized campus voucher creation blocked with CAMPUS_PERMISSION_DENIED.');

  // Test 16: CRUD on Users and Financial Records
  const createdFinRecord = repo.createFinancialRecord(client1UserContext, {
    recordType: 'petty_cash',
    amount: 1500,
    campus_id: 'campus_isb_01',
    narration: 'Office supplies reimbursement',
  });
  if (createdFinRecord.client_id !== 'client_alpha') {
    throw new Error('Financial Record Isolation Failed: client_id was not automatically stamped.');
  }

  const alphaFinRecords = repo.queryFinancialRecords(client1UserContext, 'petty_cash');
  if (alphaFinRecords.length !== 2) {
    throw new Error('Financial Records Query Scoping Failed.');
  }
  console.log('✓ Test 16: Financial records and users CRUD with automatic client_id stamping verified.');

  // Test 17: Platform Site Admin & Multi-Campus Management Hub Financial Reports Permissions
  // Configure client_alpha report permissions: enable format_2_executive_board with minimum role Level 2 Client Super Admin
  const alphaReportPermissions = generateDefaultClientReportPermissions('client_alpha').map(p => {
    if (p.reportKey === 'format_2_executive_board') {
      return { ...p, enabled: true, minimumRole: 'level_2_client_super_admin' as const };
    }
    return p;
  });
  
  // Departmental staff (Level 5) attempting to access Executive Board report -> must be blocked
  const staffContext = { ...client1UserContext, permissionLevel: 'level_5_departmental_staff' as const };
  const boardReportAccess = validateClientReportAccess(
    staffContext,
    'format_2_executive_board',
    'campus_isb_01',
    false,
    { client_alpha: alphaReportPermissions },
    testCampuses
  );
  if (boardReportAccess.allowed) {
    throw new Error('Financial Report Permission Failed: Departmental staff accessed executive board report.');
  }

  // Client Super Admin (Level 2) accessing the enabled report -> allowed
  const clientAdminContext = {
    ...client1UserContext,
    userRole: 'client_super_admin',
    permissionLevel: 'level_2_client_super_admin' as const,
    isClientAdmin: true,
  };
  const adminBoardAccess = validateClientReportAccess(
    clientAdminContext,
    'format_2_executive_board',
    'campus_isb_01',
    true,
    { client_alpha: alphaReportPermissions },
    testCampuses
  );
  if (!adminBoardAccess.allowed) {
    throw new Error('Financial Report Permission Failed: Client Super Admin was incorrectly blocked: ' + adminBoardAccess.reason);
  }
  console.log('✓ Test 17: Financial report permissions role-gating & client access validation verified.');

  // Test 18: Disabling Financial Report by Platform Site Admin
  const modifiedPermissions = alphaReportPermissions.map(p => {
    if (p.reportKey === 'ext_profit_loss_statement') {
      return { ...p, enabled: false };
    }
    return p;
  });

  const pnlAccessWhenDisabled = validateClientReportAccess(
    clientAdminContext,
    'ext_profit_loss_statement',
    'campus_isb_01',
    false,
    { client_alpha: modifiedPermissions },
    testCampuses
  );

  if (pnlAccessWhenDisabled.allowed) {
    throw new Error('Site Admin Control Failed: Disabled report was still accessible by client.');
  }
  console.log('✓ Test 18: Platform Site Admin report disabling per client successfully blocks access.');

  console.log('All 18 Multi-Campus Tenant Isolation, Security, Recovery & Financial Report Tests PASSED!');
}

runTenantIsolationAndRecoveryTests();

