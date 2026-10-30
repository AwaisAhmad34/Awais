import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFromMembership } from '../src/services/verifiedMembership';
import { allowedModulesForUser } from '../src/services/moduleAccess';

test('unprovisioned, inactive and unknown-role identities never receive a workspace', () => {
  for (const membership of [undefined, {}, {status:'inactive',permissionLevel:'level_1_platform_super_admin'}, {status:'active',permissionLevel:'admin'}, {status:'active',permissionLevel:'level_2_client_super_admin'}]) {
    assert.throws(() => profileFromMembership('uid', 'admin@example.org', membership));
  }
});
test('email and display name cannot elevate a departmental membership', () => {
  const profile = profileFromMembership('uid', 'admin@example.org', {status:'active',name:'Platform Super Admin',permissionLevel:'level_5_departmental_staff',clientId:'tenant-a',campusId:'campus-a',allowedModules:['reports']});
  assert.equal(profile.role, 'campus_accountant');
  assert.equal(profile.clientId, 'tenant-a');
  assert.equal(profile.id, 'uid');
  assert.deepEqual(profile.allowedModules, ['reports']);
});
test('membership missing permissions does not acquire an all-modules fallback', () => {
  const profile = profileFromMembership('uid', 'director@example.org', {status:'active',permissionLevel:'level_2_client_super_admin',clientId:'tenant-a'});
  assert.deepEqual(profile.allowedModules, []);
  assert.deepEqual(profile.permittedCampusIds, []);
});
test('all expands to real ledger modules while an explicit empty grant stays empty', () => {
  const available = ['dashboard','transaction','reports','campuses'];
  assert.deepEqual(allowedModulesForUser({status:'active',role:'level_2_client_super_admin',allowedModules:['all']},available), ['dashboard','transaction','reports']);
  assert.deepEqual(allowedModulesForUser({status:'active',role:'campus_accountant',allowedModules:[]},available), []);
  assert.deepEqual(allowedModulesForUser({status:'active',role:'campus_accountant',allowedModules:['reports','fake-module']},available), ['reports']);
  assert.deepEqual(allowedModulesForUser({status:'inactive',role:'level_1_platform_super_admin'},available), []);
});
