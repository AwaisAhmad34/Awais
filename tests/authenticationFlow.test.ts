import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticateAccount, getVerifiedProfile, logoutAccount, provisionInitialPlatformOwner } from '../src/services/secureAuthentication';
import { resetAuthFixture, calls } from './authFixture';

// The isolated loader replaces only secureAuthentication's Firebase imports with
// authFixture. These tests never register accounts or contact a real datastore.
test('wrong password makes one exact attempt and leaves no verified profile', async () => {
  resetAuthFixture(undefined,{code:'auth/invalid-credential'});
  await assert.rejects(authenticateAccount('admin','wrong'),/incorrect/);
  assert.deepEqual(calls.filter(call=>call[0]==='signIn'),[['signIn','siteowner@platform.org','wrong']]);
  assert.equal(getVerifiedProfile(),null);
});
test('authenticated identity without membership is rejected rather than provisioned', async () => {
  resetAuthFixture();
  await assert.rejects(authenticateAccount('nobody@example.invalid','test-password'),/membership/);
  assert.equal(getVerifiedProfile(),null);
  assert.deepEqual(calls.map(call=>call[0]),['signIn','membershipRead','signOut']);
});
test('active membership is installed and logout invalidates it', async () => {
  resetAuthFixture({status:'active',permissionLevel:'level_5_departmental_staff',clientId:'tenant-a',campusId:'campus-a',allowedModules:['reports']});
  const profile=await authenticateAccount('admin@example.org','exact-password');
  assert.equal(profile.role,'campus_accountant');
  assert.equal(profile.clientId,'tenant-a');
  assert.equal(getVerifiedProfile()?.uid,'firebase-uid');
  await logoutAccount();
  assert.equal(getVerifiedProfile(),null);
});
test('browser owner provisioning is rejected without an auth or database operation', async () => {
  resetAuthFixture();
  await assert.rejects(provisionInitialPlatformOwner('owner@example.org','test-password'),/trusted server/);
  assert.equal(calls.length,0);
});
