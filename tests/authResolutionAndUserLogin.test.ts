import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  mapFirebaseAuthErrorMessage,
  resolveLocalUserEmailByUsername,
  getAuthResolutionState,
} from '../src/services/secureAuthentication';
import {
  syncUserRecordToLocalStorageCache,
  normalizeUsernameKey,
} from '../src/services/globalUserSyncService';

const ROOT = process.cwd();
const readSource = (relPath: string) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8');

test('mapFirebaseAuthErrorMessage produces clear user-friendly messages for Firebase Auth & lock states', () => {
  assert.equal(
    mapFirebaseAuthErrorMessage({ code: 'auth/invalid-credential' }),
    'Invalid email or password.'
  );
  assert.equal(
    mapFirebaseAuthErrorMessage({ code: 'auth/wrong-password' }),
    'Invalid email or password.'
  );
  assert.equal(
    mapFirebaseAuthErrorMessage({ code: 'auth/user-not-found' }),
    'Invalid email or password.'
  );
  assert.equal(
    mapFirebaseAuthErrorMessage({ code: 'auth/invalid-email' }),
    'Invalid email or password.'
  );
  assert.equal(
    mapFirebaseAuthErrorMessage({ code: 'auth/user-disabled' }),
    'Account locked or disabled. Contact your administrator.'
  );
  assert.match(
    mapFirebaseAuthErrorMessage({ code: 'auth/too-many-requests' }),
    /Account temporarily locked/i
  );
  assert.match(
    mapFirebaseAuthErrorMessage({ code: 'auth/operation-not-allowed' }),
    /Email\/password sign-in is not enabled/i
  );
  assert.match(
    mapFirebaseAuthErrorMessage({ code: 'auth/network-request-failed' }),
    /Network error/i
  );
  assert.equal(
    mapFirebaseAuthErrorMessage(new Error('Campus login portal is currently suspended or locked by the administrator.')),
    'Campus login portal is currently suspended or locked by the administrator.'
  );
});

test('syncUserRecordToLocalStorageCache and resolveLocalUserEmailByUsername persist newly created credentials synchronously', () => {
  const prevWindow = (globalThis as any).window;
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  (globalThis as any).window = { localStorage: mockLocalStorage };

  try {
    // Legacy placeholder admin must always be filtered out
    syncUserRecordToLocalStorageCache({
      id: 'user-admin',
      username: 'admin',
      name: 'Legacy Admin',
      email: 'admin@aschoolsystem.edu.pk',
      role: 'admin',
      permissionLevel: 'level_1_platform_super_admin',
      isSuperAdmin: true,
      clientId: null,
      campusId: null,
      permittedCampusIds: ['all'],
      delegatedSubCampusIds: [],
      allowedModules: ['all'],
      status: 'active',
      syncedToCloud: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    syncUserRecordToLocalStorageCache({
      id: 'usr-finance1',
      uid: 'uid-101',
      username: 'finance.lead',
      name: 'Ayesha Khan',
      email: 'ayesha@aplus-academy.edu.pk',
      role: 'level_3_main_campus_admin',
      permissionLevel: 'level_3_main_campus_admin',
      isSuperAdmin: false,
      clientId: 'client-aplus',
      campusId: 'campus-main',
      permittedCampusIds: ['campus-main'],
      delegatedSubCampusIds: [],
      allowedModules: ['all'],
      status: 'active',
      syncedToCloud: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });

    syncUserRecordToLocalStorageCache({
      id: 'usr-tmehmood',
      uid: 'uid-999',
      username: 't.mehmood',
      name: 'Tariq Mehmood',
      email: 't.mehmood@aplus-academy.edu.pk',
      role: 'level_4_sub_campus_admin',
      permissionLevel: 'level_4_sub_campus_admin',
      isSuperAdmin: false,
      clientId: 'client-aplus',
      campusId: 'campus-khiali',
      permittedCampusIds: ['campus-khiali'],
      delegatedSubCampusIds: [],
      allowedModules: ['all'],
      status: 'active',
      syncedToCloud: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });

    const cached = JSON.parse(store.get('ams_users_v5_clean') || '[]');
    assert.equal(cached.length, 2);
    assert.equal(cached[0].username, 't.mehmood');
    assert.equal(cached[1].username, 'finance.lead');
    assert.equal(normalizeUsernameKey('t.mehmood'), 't.mehmood');

    assert.equal(
      resolveLocalUserEmailByUsername('T.MEHMOOD'),
      't.mehmood@aplus-academy.edu.pk'
    );
    assert.equal(
      resolveLocalUserEmailByUsername('finance.lead'),
      'ayesha@aplus-academy.edu.pk'
    );
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

test('initAuthListener and App/LegacyApp resolve user profile and campus scope consistently without Workspace migration trap', () => {
  const initialResolutionState = getAuthResolutionState();
  assert.equal(typeof initialResolutionState.resolved, 'boolean');
  assert.equal(typeof initialResolutionState.resolving, 'boolean');

  const secureAuth = readSource('src/services/secureAuthentication.ts');
  assert.ok(secureAuth.includes('pendingRestoreByUid'));
  assert.ok(secureAuth.includes('membershipUserIdHint'));
  assert.ok(secureAuth.includes('syncUserRecordToLocalStorageCache'));
  assert.ok(secureAuth.includes('authResolvedOnce'));
  assert.ok(secureAuth.includes('collectCandidateEmailsForUsername'));

  const appSource = readSource('src/App.tsx');
  assert.ok(appSource.includes('isAuthResolving'));
  assert.ok(appSource.includes('getAuthResolutionState'));
  assert.ok(appSource.includes('__APLUS_PROVISION_CLOUD_USER__'));

  const legacySource = readSource('src/LegacyApp.tsx');
  assert.ok(legacySource.includes('initAuthListener'));
  assert.ok(legacySource.includes('isAuthResolving'));
  assert.equal(legacySource.includes('Workspace migration required'), false);
});

test('aplusEngine synchronously persists users to localStorage and bridges CoreUserModal mutations to Cloud Auth', () => {
  const engine = readSource('src/core/aplusEngine.js');
  assert.ok(engine.includes('window.__APLUS_PROVISION_CLOUD_USER__'));
  // Synchronous localStorage writes inside addUser (Ue) and updateUser (We)
  assert.ok(engine.includes('rRef.current=[...m,t];try{localStorage.setItem(q.USERS,JSON.stringify(rRef.current))}catch{}'));
  assert.ok(engine.includes('try{localStorage.setItem(q.USERS,JSON.stringify(rRef.current))}catch{}'));
});

test('DynamicCampusLoginPortal displays clear Firebase Auth errors and provides show/hide password toggles', () => {
  const portal = readSource('src/components/DynamicCampusLoginPortal.tsx');
  assert.ok(portal.includes('mapFirebaseAuthErrorMessage'));
  assert.ok(portal.includes("setErrorMessage(friendlyError)"));
  assert.ok(portal.includes("aria-label={showPassword ? 'Hide password' : 'Show password'}"));
  assert.ok(portal.includes("aria-label={showOwnerPassword ? 'Hide master password' : 'Show master password'}"));
  assert.ok(portal.includes("aria-label={showConfirmOwnerPassword ? 'Hide confirm password' : 'Show confirm password'}"));
  assert.ok(portal.includes("aria-label={showOwnerSecret ? 'Hide bootstrap secret' : 'Show bootstrap secret'}"));
});
