import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeUsernameKey } from '../src/services/globalUserSyncService';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('root entry shells strictly block unauthenticated access before rendering any panel', () => {
  const appSource = readSource('src/App.tsx');
  assert.ok(appSource.includes('isSessionVerified'));
  assert.ok(appSource.includes('hasVerifiedSession'));
  assert.ok(appSource.includes('if (!hasVerifiedSession)'));
  assert.ok(appSource.includes('<DynamicCampusLoginPortal'));

  const legacySource = readSource('src/LegacyApp.tsx');
  assert.ok(legacySource.includes('getVerifiedProfile'));
  assert.ok(legacySource.includes('if (!currentUser || !verifiedProfile)'));
  assert.ok(legacySource.includes('<DynamicCampusLoginPortal'));
});

test('TenantAuthContext fails closed with zero admin privileges when unauthenticated', () => {
  const tenantAuthSource = readSource('src/context/TenantAuthContext.tsx');
  assert.ok(tenantAuthSource.includes('if (!currentUser)'));
  assert.ok(tenantAuthSource.includes("platformRole: 'accountant'"));
  assert.ok(tenantAuthSource.includes('isSuperAdmin: false'));
  assert.ok(tenantAuthSource.includes('isCampusAdmin: false'));
  assert.ok(tenantAuthSource.includes("campusName: 'Authentication Required'"));
  // Ensure both unauthenticated and missing-provider runtime fallbacks never grant super_admin
  const unauthenticatedBlock = tenantAuthSource.split('if (!currentUser)')[1].split('const isSuper')[0];
  assert.equal(unauthenticatedBlock.includes("'super_admin'"), false);
  const missingProviderBlock = tenantAuthSource.split('if (!context)')[1];
  assert.equal(missingProviderBlock.includes("'super_admin'"), false);
});

test('all privileged UI panels enforce verified session checks before rendering', () => {
  const platformHub = readSource('src/components/PlatformSiteAdminHub.tsx');
  assert.ok(platformHub.includes('verifiedSessionProfile = getVerifiedProfile()'));
  assert.ok(platformHub.includes('if (!isSuperAdminAccountOnly)'));
  assert.ok(platformHub.includes('reconcileGlobalUsersLoginDirectory'));
  assert.ok(platformHub.includes('handleToggleGlobalUserStatus'));

  const clientHub = readSource('src/components/ClientOwnerManagementHub.tsx');
  assert.ok(clientHub.includes('verifiedProfile = getVerifiedProfile()'));
  assert.ok(clientHub.includes('if (!isAuthorizedClientOwner)'));

  const authModal = readSource('src/components/DynamicCampusAuthModal.tsx');
  assert.ok(authModal.includes('!isOpen || !currentUser || !getVerifiedProfile()'));

  const bulkManager = readSource('src/components/BulkVoucherAndAccessManager.tsx');
  assert.ok(bulkManager.includes('!currentUser || !getVerifiedProfile()'));

  const permEngine = readSource('src/components/PermissionEngine.tsx');
  assert.ok(permEngine.includes('!currentUser || !getVerifiedProfile()'));
});

test('global user sync, login directory lookup, and secure authentication enforce status and cross-browser login', () => {
  assert.equal(normalizeUsernameKey(' Campus.Admin@01 '), 'campus.admin_01');

  const globalSync = readSource('src/services/globalUserSyncService.ts');
  assert.ok(globalSync.includes('export async function reconcileGlobalUsersLoginDirectory'));
  assert.ok(globalSync.includes('export async function setGlobalUserStatusInCloud'));
  assert.ok(globalSync.includes('getAuthBearerHeaders'));

  const secureAuth = readSource('src/services/secureAuthentication.ts');
  assert.ok(secureAuth.includes("globalUser.status !== 'active'"));
  assert.ok(secureAuth.includes("cData?.status === 'suspended' || cData?.status === 'locked'"));
  assert.ok(secureAuth.includes("'ams_current_user_v5_clean'"));

  const platformRoutes = readSource('src/server/platformOwnerRoutes.ts');
  assert.ok(platformRoutes.includes('verifyPlatformAdminCaller'));
  assert.ok(platformRoutes.includes('ACCOUNT_DISABLED'));
});

test('no unregistered bypass, no seeded auto-creation, and compulsory registered login across all levels', () => {
  const secureAuth = readSource('src/services/secureAuthentication.ts');
  assert.equal(secureAuth.includes('SEED_MULTI_TENANT_USERS'), false);
  assert.equal(secureAuth.includes("emailLower.startsWith('admin@')"), false);
  assert.equal(secureAuth.includes('createUserWithEmailAndPassword(auth, seededUser.email'), false);
  assert.equal(secureAuth.includes('allow first authenticated Google/institutional user to claim Site Owner'), false);
  assert.ok(secureAuth.includes('Access denied. Account is not registered for institutional access.'));

  const appSource = readSource('src/App.tsx');
  assert.equal(appSource.includes('bootstrapProductionDefaultAccounts'), false);
  assert.equal(appSource.includes("currentUser.username?.toLowerCase() === 'admin'"), false);

  const loginPortal = readSource('src/components/DynamicCampusLoginPortal.tsx');
  assert.ok(loginPortal.includes('Compulsory Registered Login — All Levels (1 to 5)'));
  assert.ok(loginPortal.includes('{!isOwnerAlreadyRegistered && ('));
});

test('Site Owner panel exposes Relevant Campus & Consolidated Campus switcher and Voucher Entry Deletion', () => {
  const platformHub = readSource('src/components/PlatformSiteAdminHub.tsx');
  assert.ok(platformHub.includes('Site Owner Campus Scope Selector'));
  assert.ok(platformHub.includes('Consolidated (All Campuses)'));
  assert.ok(platformHub.includes("setCurrentCampusId('all')"));
  assert.ok(platformHub.includes('isConsolidatedCampusView'));
  assert.ok(platformHub.includes('<BulkVoucherAndAccessManager defaultStatusFilter="ALL" />'));
  assert.ok(platformHub.includes('Voucher Deletion &amp; Audit'));

  const bulkManager = readSource('src/components/BulkVoucherAndAccessManager.tsx');
  assert.ok(bulkManager.includes("defaultStatusFilter?: 'Pending' | 'Approved' | 'Rejected' | 'ALL'"));
  assert.ok(bulkManager.includes('confirmBulkDeleteSelected'));
  assert.ok(bulkManager.includes('confirmDeleteSingleVoucher'));
  assert.ok(bulkManager.includes('Consolidated — All Campuses'));

  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(engine.includes('window.__APLUS_FIRESTORE_API__?.deleteVoucher?.(e)'));
});

