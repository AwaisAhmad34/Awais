import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSchoolClients,
  type SchoolClientOrganization,
} from '../src/services/platformSiteAdminService';
import {
  normalizeUsernameKey,
  normalizeAndDeduplicateGlobalUsers,
  isLegacyPlaceholderAdmin,
} from '../src/services/globalUserSyncService';

const SAMPLE_CLIENTS: SchoolClientOrganization[] = [
  {
    id: 'client-aplus',
    name: 'Aplus School System',
    code: 'APLUS',
    tier: 'Professional',
    status: 'active',
    contactPerson: 'Tariq Mahmood',
    contactEmail: 'director@aplus.edu.pk',
    contactPhone: '+92 300 5551122',
    address: 'Khiali Bypass Road, Gujranwala',
    mainCampusId: 'campus-aplus-main',
    maxCampuses: 8,
    maxUsers: 30,
    billingRenewalDate: '2027-10-31',
    enabledModules: ['dashboard', 'transaction'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'client-apex',
    name: 'Apex Grammar Academy',
    code: 'APEX-99',
    tier: 'Enterprise',
    status: 'suspended',
    contactPerson: 'M. Siddique',
    contactEmail: 'principal@apex.edu.pk',
    contactPhone: '+92 321 7773344',
    address: 'Model Town, Lahore',
    mainCampusId: 'campus-apex-main',
    maxCampuses: 12,
    maxUsers: 40,
    billingRenewalDate: '2027-08-31',
    enabledModules: ['dashboard', 'reports'],
    createdAt: '2026-02-15T00:00:00.000Z',
    updatedAt: '2026-02-15T00:00:00.000Z',
  },
  {
    id: 'client-beacon',
    name: 'Beacon Horizon College',
    code: 'BHC',
    tier: 'Starter',
    status: 'active',
    contactPerson: 'Sana Fatima',
    contactEmail: 'finance@beaconhorizon.pk',
    contactPhone: '+92 333 1119988',
    address: 'Satellite Town, Rawalpindi',
    mainCampusId: 'campus-bhc-main',
    maxCampuses: 4,
    maxUsers: 12,
    billingRenewalDate: '2027-12-31',
    enabledModules: ['dashboard'],
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-10T00:00:00.000Z',
  },
];

test('filterSchoolClients returns all clients when query is empty or whitespace', () => {
  assert.equal(filterSchoolClients(SAMPLE_CLIENTS, '').length, 3);
  assert.equal(filterSchoolClients(SAMPLE_CLIENTS, '   ').length, 3);
});

test('filterSchoolClients filters case-insensitively by client name and code', () => {
  const byName = filterSchoolClients(SAMPLE_CLIENTS, 'apex grammar');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, 'client-apex');

  const byCode = filterSchoolClients(SAMPLE_CLIENTS, 'bhc');
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].id, 'client-beacon');
});

test('filterSchoolClients matches contact person, email, tier, status, and address', () => {
  assert.deepEqual(
    filterSchoolClients(SAMPLE_CLIENTS, 'Tariq').map((c) => c.id),
    ['client-aplus']
  );
  assert.deepEqual(
    filterSchoolClients(SAMPLE_CLIENTS, 'finance@beaconhorizon.pk').map((c) => c.id),
    ['client-beacon']
  );
  assert.deepEqual(
    filterSchoolClients(SAMPLE_CLIENTS, 'suspended').map((c) => c.id),
    ['client-apex']
  );
  assert.deepEqual(
    filterSchoolClients(SAMPLE_CLIENTS, 'Lahore').map((c) => c.id),
    ['client-apex']
  );
});

test('filterSchoolClients returns empty array when no client matches', () => {
  assert.deepEqual(filterSchoolClients(SAMPLE_CLIENTS, 'nonexistent-school-xyz'), []);
});

test('normalizeUsernameKey normalizes casing, whitespace, and disallowed document id characters', () => {
  assert.equal(normalizeUsernameKey('  Admin.Main  '), 'admin.main');
  assert.equal(normalizeUsernameKey('campus cvt@01'), 'campuscvt_01');
  assert.equal(normalizeUsernameKey('user/bad:key'), 'user_bad_key');
});

test('isLegacyPlaceholderAdmin flags hardcoded demo admin without affecting real platform owner', () => {
  assert.equal(
    isLegacyPlaceholderAdmin({
      id: 'user-admin',
      username: 'admin',
      email: 'admin@aschoolsystem.edu.pk',
      name: 'Sir Nadeem / Administrator',
    }),
    true
  );
  assert.equal(
    isLegacyPlaceholderAdmin({
      id: 'user-platform-owner',
      username: 'bajwa123',
      email: 'bajwa123@gmail.com',
      isSuperAdmin: true,
    }),
    false
  );
});

test('normalizeAndDeduplicateGlobalUsers yields identical lists across browsers regardless of snapshot order or legacy demo leaks', () => {
  const owner = {
    id: 'user-platform-owner',
    uid: 'uid-owner',
    username: 'bajwa',
    name: 'Platform Owner',
    email: 'bajwa@platform.org',
    role: 'level_1_platform_super_admin',
    permissionLevel: 'level_1_platform_super_admin',
    isSuperAdmin: true,
    clientId: null,
    campusId: null,
    status: 'active',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-01T10:00:00.000Z',
  };
  const staffOld = {
    id: 'usr-ali-old',
    username: 'ali.khl',
    name: 'Ali Old',
    email: 'ali.khl@institution.edu.pk',
    role: 'level_3_sub_campus_admin',
    permissionLevel: 'level_4_sub_campus_admin',
    clientId: 'client-aplus',
    campusId: 'campus-khl',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  };
  const staffNew = {
    id: 'usr-ali.khl',
    uid: 'uid-ali',
    username: 'Ali.KHL',
    name: 'Ali Updated',
    email: 'ALI.KHL@institution.edu.pk',
    role: 'level_3_main_campus_admin',
    permissionLevel: 'level_3_main_campus_admin',
    clientId: 'client-aplus',
    campusId: 'campus-khl',
    status: 'active',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
  };
  const demoGhost = {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@aschoolsystem.edu.pk',
    name: 'Sir Nadeem / Administrator',
    role: 'super_admin',
  };

  // Browser A receives stale order + demoGhost
  const browserA = normalizeAndDeduplicateGlobalUsers([demoGhost, staffOld, staffNew, owner]);
  // Browser B receives reverse snapshot order without demoGhost
  const browserB = normalizeAndDeduplicateGlobalUsers([staffNew, owner, staffOld]);

  assert.deepEqual(browserA, browserB);
  assert.equal(browserA.length, 2);
  assert.equal(browserA[0].id, 'user-platform-owner');
  assert.equal(browserA[1].id, 'usr-ali.khl');
  assert.equal(browserA[1].name, 'Ali Updated');
});

test('normalizeAndDeduplicateGlobalUsers clears stale users when cloud list is empty', () => {
  const demoGhost = {
    id: 'user-admin',
    username: 'admin',
    email: 'admin@aschoolsystem.edu.pk',
  };
  assert.deepEqual(normalizeAndDeduplicateGlobalUsers([demoGhost]), []);
});
