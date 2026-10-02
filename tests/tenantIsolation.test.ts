import assert from 'node:assert/strict';
import {
  issueSignedTenantToken,
  evaluateServerTenantRequest,
  executeAutomatedServerIsolationTestSuite,
} from '../server';

console.log('====================================================================');
console.log(' RUNNING SERVER-SIDE MULTI-TENANT DATA ISOLATION AUTOMATED TEST SUITE');
console.log('====================================================================');

// 1. Issue a server-signed session token for Client A ('inst-aplus-main' / 'ORG-APLUS-001')
const clientAToken = issueSignedTenantToken({
  userId: 'usr-client-a-admin',
  userName: 'Sir Nadeem (Client A Admin)',
  email: 'admin@aplusschool.edu.pk',
  role: 'school_client_admin',
  organizationId: 'inst-aplus-main',
  organizationCode: 'ORG-APLUS-001',
  assignedCampusIds: ['tcamp-aplus-main-1', 'tcamp-aplus-sub-1'],
  accountStatus: 'Active',
});

// Assertion 1: Client A can read its own records (HTTP 200)
const ownRead = evaluateServerTenantRequest({
  token: clientAToken,
  method: 'GET',
  endpoint: 'READ_ORG_RECORDS',
  targetOrganizationId: 'inst-aplus-main',
});
assert.equal(ownRead.statusCode, 200, 'Client A must be allowed to read its own records');
assert.equal(ownRead.allowed, true);

// Assertion 2: Client A attempting to read Client B ('inst-apex-college') records MUST be blocked (HTTP 403)
const crossTenantRead = evaluateServerTenantRequest({
  token: clientAToken,
  method: 'GET',
  endpoint: 'READ_ORG_RECORDS',
  targetOrganizationId: 'inst-apex-college',
});
assert.equal(
  crossTenantRead.statusCode,
  403,
  'Server must block Client A from reading Client B records with HTTP 403'
);
assert.equal(crossTenantRead.allowed, false);
assert.equal(crossTenantRead.code, 'CROSS_TENANT_ISOLATION_VIOLATION');

// Assertion 3: Client A attempting to write/modify a voucher in Client B MUST be blocked (HTTP 403)
const crossTenantWrite = evaluateServerTenantRequest({
  token: clientAToken,
  method: 'POST',
  endpoint: 'WRITE_ORG_VOUCHER',
  targetOrganizationId: 'inst-apex-college',
});
assert.equal(
  crossTenantWrite.statusCode,
  403,
  'Server must block Client A from writing to Client B ledger with HTTP 403'
);
assert.equal(crossTenantWrite.allowed, false);

// Assertion 4: Client A attempting to spoof organizationId='inst-apex-college' in request body MUST be blocked (HTTP 403)
const spoofedBodyWrite = evaluateServerTenantRequest({
  token: clientAToken,
  method: 'POST',
  endpoint: 'WRITE_ORG_VOUCHER',
  targetOrganizationId: 'inst-aplus-main',
  spoofedBodyOrganizationId: 'inst-apex-college',
});
assert.equal(
  spoofedBodyWrite.statusCode,
  403,
  'Server must block spoofed organizationId parameter tampering with HTTP 403'
);
assert.equal(spoofedBodyWrite.code, 'TENANT_ID_SPOOFING_BLOCKED');

// Execute the full 10-scenario automated suite
const suiteReport = executeAutomatedServerIsolationTestSuite();
suiteReport.results.forEach((r) => {
  console.log(
    `[PASS] ${r.id} | ${r.name} -> Expected HTTP ${r.expectedStatus}, Got HTTP ${r.actualStatus} (${r.errorCode})`
  );
  assert.equal(r.passed, true, `Scenario ${r.id} failed`);
});

console.log('--------------------------------------------------------------------');
console.log(
  `ALL ${suiteReport.passedCount}/${suiteReport.totalTests} SERVER-SIDE DATA ISOLATION TESTS PASSED!`
);
console.log('====================================================================');
