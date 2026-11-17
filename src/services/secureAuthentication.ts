import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  lookupLoginDirectoryByUsername,
  findGlobalUserInCloudByEmailOrUid,
  provisionGlobalUserAccount,
  normalizeUsernameKey,
  syncUserRecordToLocalStorageCache,
} from './globalUserSyncService';

export interface AuthResolutionState {
  resolved: boolean;
  resolving: boolean;
  profile: any;
}

let verifiedProfile: any = null;
let authListenerAttached = false;
let authResolvedOnce = false;
let authResolving = false;
let interactiveAuthInProgress = false;
const pendingRestoreByUid = new Map<string, Promise<any>>();
const authStateSubscribers = new Set<(state: AuthResolutionState) => void>();

export function getVerifiedProfile() {
  return verifiedProfile;
}

export function getAuthResolutionState(): AuthResolutionState {
  return {
    resolved: authResolvedOnce,
    resolving: authResolving,
    profile: verifiedProfile,
  };
}

function notifyAuthStateSubscribers() {
  const snapshot: AuthResolutionState = {
    resolved: authResolvedOnce,
    resolving: authResolving,
    profile: verifiedProfile,
  };
  authStateSubscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

function normalizeResolvedPermissionLevel(level?: string, role?: string): string {
  const raw = String(level || '').trim();
  if (raw === 'level_2_client_admin') return 'level_2_client_super_admin';
  if (raw === 'level_3_sub_campus_admin') return 'level_4_sub_campus_admin';
  if (raw === 'level_5_departmental_user') return 'level_5_departmental_staff';
  if (raw) return raw;
  if (role === 'level_1_platform_super_admin' || role === 'admin' || role === 'super_admin') {
    return 'level_1_platform_super_admin';
  }
  if (role === 'level_2_client_super_admin') return 'level_2_client_super_admin';
  if (role === 'level_3_main_campus_admin') return 'level_3_main_campus_admin';
  if (role === 'level_3_sub_campus_admin' || role === 'level_4_sub_campus_admin' || role === 'campus_admin') {
    return 'level_4_sub_campus_admin';
  }
  return 'level_5_departmental_staff';
}

/**
 * Translates Firebase Auth error codes and institutional suspension errors into
 * clear, actionable user-facing messages.
 */
export function mapFirebaseAuthErrorMessage(err: any): string {
  const code = String(err?.code || '').trim();
  const rawMessage = String(err?.message || '').trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (
    lowerMessage.includes('suspended') ||
    lowerMessage.includes('locked') ||
    lowerMessage.includes('removed or disabled') ||
    lowerMessage.includes('not active') ||
    lowerMessage.includes('not registered for institutional access')
  ) {
    return rawMessage;
  }

  switch (code) {
    case 'auth/user-disabled':
      return 'Account locked or disabled. Contact your administrator.';
    case 'auth/too-many-requests':
      return 'Account temporarily locked due to too many failed attempts. Try again later or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled in Firebase Authentication. Contact your administrator.';
    case 'auth/network-request-failed':
      return 'Network error while contacting the authentication server. Check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing authentication.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    default:
      if (lowerMessage.includes('invalid-credential') || lowerMessage.includes('wrong-password') || lowerMessage.includes('user-not-found')) {
        return 'Invalid email or password.';
      }
      if (lowerMessage.includes('user-disabled')) {
        return 'Account locked or disabled. Contact your administrator.';
      }
      if (lowerMessage.includes('too-many-requests')) {
        return 'Account temporarily locked due to too many failed attempts. Try again later or reset your password.';
      }
      if (lowerMessage.includes('network-request-failed')) {
        return 'Network error while contacting the authentication server. Check your connection and try again.';
      }
      return rawMessage || 'Invalid email or password.';
  }
}

/**
 * Resolves usernames without '@' to institutional email conventions.
 */
export function resolveUserEmail(input: string): string {
  const clean = input.trim().toLowerCase();
  if (clean.includes('@')) return clean;
  return `${clean.replace(/[^a-z0-9._-]/g, '')}@aschoolsystem.edu.pk`;
}

/**
 * Checks synced localStorage user directory (`ams_users_v5_clean`) and dynamic campus credentials
 * to resolve a freshly created user's email from their username.
 */
export function resolveLocalUserEmailByUsername(username: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const clean = (username || '').trim().toLowerCase().replace(/\s+/g, '');
  const normKey = normalizeUsernameKey(clean);
  if (!clean) return null;

  const keysToInspect = ['ams_users_v5_clean', 'ams_current_user_v5_clean'];
  for (const storageKey of keysToInspect) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const u of list) {
        if (!u || typeof u !== 'object') continue;
        const uName = String(u.username || '').trim().toLowerCase().replace(/\s+/g, '');
        const uNorm = normalizeUsernameKey(uName);
        if ((uName && uName === clean) || (uNorm && normKey && uNorm === normKey)) {
          const candidate = String(u.email || '').trim().toLowerCase();
          if (candidate && candidate.includes('@')) {
            return candidate;
          }
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Resolves usernames dynamically via Firestore `login_directory`, server endpoint, and local user cache.
 */
export async function resolveUserEmailAsync(input: string): Promise<string> {
  const clean = input.trim().toLowerCase().replace(/\s+/g, '');
  if (clean.includes('@')) return clean;

  // 1. Live Firestore login_directory lookup (works on any browser before auth)
  try {
    const dirEntry = await lookupLoginDirectoryByUsername(clean);
    if (dirEntry?.email) {
      return dirEntry.email.toLowerCase();
    }
  } catch {}

  // 2. Server-side lookup if Admin SDK is active
  try {
    const res = await fetch('/api/platform/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: clean }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.found && data?.email) {
        return String(data.email).toLowerCase();
      }
    }
  } catch {}

  // 3. Synchronized localStorage user cache lookup (handles newly created users in same session)
  const localMatch = resolveLocalUserEmailByUsername(clean);
  if (localMatch) {
    return localMatch;
  }

  // 4. Standard institutional domain normalization
  return resolveUserEmail(input);
}

/**
 * Collects ordered candidate emails to try when authenticating via username.
 */
export async function collectCandidateEmailsForUsername(emailOrUsername: string): Promise<string[]> {
  const cleanInput = (emailOrUsername || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!cleanInput) return [];
  if (cleanInput.includes('@')) return [cleanInput];

  const candidates: string[] = [];
  const pushUnique = (email?: string | null) => {
    const normalized = String(email || '').trim().toLowerCase();
    if (normalized && normalized.includes('@') && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  try {
    const dirEntry = await lookupLoginDirectoryByUsername(cleanInput);
    if (dirEntry?.status === 'suspended' || dirEntry?.status === 'inactive') {
      throw new Error('Account locked or suspended. Contact your administrator.');
    }
    pushUnique(dirEntry?.email);
  } catch (dirErr: any) {
    if (String(dirErr?.message || '').toLowerCase().includes('suspended') || String(dirErr?.message || '').toLowerCase().includes('locked')) {
      throw dirErr;
    }
  }

  try {
    const res = await fetch('/api/platform/resolve-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanInput }),
    });
    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      if (errData?.error === 'ACCOUNT_DISABLED') {
        throw new Error('Account locked or suspended. Contact your administrator.');
      }
    }
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.found && data?.email) {
        pushUnique(data.email);
      }
    }
  } catch (srvErr: any) {
    if (String(srvErr?.message || '').toLowerCase().includes('suspended') || String(srvErr?.message || '').toLowerCase().includes('locked')) {
      throw srvErr;
    }
  }

  pushUnique(resolveLocalUserEmailByUsername(cleanInput));

  const cleanUname = cleanInput.replace(/[^a-z0-9._-]/g, '');
  if (cleanUname) {
    pushUnique(`${cleanUname}@institution.edu.pk`);
    pushUnique(`${cleanUname}@aschoolsystem.edu.pk`);
  }

  return candidates;
}

/**
 * Authenticates an account strictly through Firebase Authentication
 * and verifies that a registered, active membership or global user exists.
 * Unregistered users cannot auto-create or bypass authentication at any level.
 */
export async function authenticateAccount(emailOrUsername: string, password: string) {
  verifiedProfile = null;
  const cleanInput = (emailOrUsername || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanInput || !cleanPassword) {
    throw new Error('Please enter both your email or username and password.');
  }

  interactiveAuthInProgress = true;
  try {
    const candidateEmails = await collectCandidateEmailsForUsername(cleanInput);
    if (candidateEmails.length === 0) {
      throw new Error('Invalid email or password.');
    }

    let authenticatedUser: User | null = null;
    let lastAuthErr: any = null;

    // Strictly attempt sign-in against Firebase Auth with registered credentials only
    for (const emailCandidate of candidateEmails) {
      try {
        const credential = await signInWithEmailAndPassword(auth, emailCandidate, cleanPassword);
        authenticatedUser = credential.user;
        break;
      } catch (authErr: any) {
        lastAuthErr = authErr;
        const code = String(authErr?.code || '');
        const isRetryableLookupFailure =
          code === 'auth/invalid-credential' ||
          code === 'auth/user-not-found' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-email';
        if (!isRetryableLookupFailure) {
          await signOut(auth).catch(() => {});
          throw new Error(mapFirebaseAuthErrorMessage(authErr));
        }
      }
    }

    if (!authenticatedUser) {
      await signOut(auth).catch(() => {});
      throw new Error(mapFirebaseAuthErrorMessage(lastAuthErr));
    }

    // Resolve authoritative user profile & campus mappings outside retry loop so domain errors surface directly
    const profile = await restoreAccount(authenticatedUser);
    authResolvedOnce = true;
    authResolving = false;
    if (latestProfileCallback) latestProfileCallback(profile);
    notifyAuthStateSubscribers();
    return profile;
  } catch (err) {
    verifiedProfile = null;
    authResolvedOnce = true;
    authResolving = false;
    notifyAuthStateSubscribers();
    throw err;
  } finally {
    interactiveAuthInProgress = false;
  }
}

/**
 * Signs in securely using Google Sign-in with Firebase Auth (popup flow).
 * Seamlessly authenticates institutional users and provisions Platform Owner privileges.
 */
export async function signInWithGoogle() {
  verifiedProfile = null;
  interactiveAuthInProgress = true;
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const credential = await signInWithPopup(auth, provider);
    const profile = await restoreAccount(credential.user);
    authResolvedOnce = true;
    authResolving = false;
    if (latestProfileCallback) latestProfileCallback(profile);
    notifyAuthStateSubscribers();
    return profile;
  } catch (err) {
    verifiedProfile = null;
    authResolvedOnce = true;
    authResolving = false;
    notifyAuthStateSubscribers();
    throw err;
  } finally {
    interactiveAuthInProgress = false;
  }
}

/**
 * Checks if a Platform Owner account is already initialized in trusted server or database environment
 */
export async function checkPlatformOwnerStatus(): Promise<{ initialized: boolean; ownerEmailMasked?: string }> {
  try {
    const res = await fetch('/api/platform/owner-status');
    if (res.ok) {
      const data = await res.json();
      if (data.initialized !== undefined && data.initialized !== false) {
        return { initialized: Boolean(data.initialized), ownerEmailMasked: data.ownerEmailMasked };
      }
    }
  } catch {}

  // Check cloud Firestore registry
  try {
    const registrySnap = await getDoc(doc(db, 'system_state', 'platform_owner_registry'));
    if (registrySnap.exists()) {
      const data = registrySnap.data();
      if (data?.isInitialized) {
        const rawEmail = String(data?.ownerEmail || '');
        const maskedEmail = rawEmail.includes('@')
          ? rawEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : 'Registered Owner';
        return { initialized: true, ownerEmailMasked: maskedEmail };
      }
    }
  } catch {}

  // Check local storage marker
  if (typeof window !== 'undefined' && window.localStorage) {
    if (localStorage.getItem('aplus_owner_registered_local') === 'true') {
      const email = localStorage.getItem('aplus_owner_email_local') || '';
      return {
        initialized: true,
        ownerEmailMasked: email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Registered Owner',
      };
    }
  }

  return { initialized: false };
}

/**
 * Sends a verified password recovery email
 */
export async function sendAccountPasswordRecovery(emailOrUsername: string): Promise<string> {
  const email = await resolveUserEmailAsync(emailOrUsername);
  await sendPasswordResetEmail(auth, email);
  return `Password reset link sent to ${email}. Please check your inbox.`;
}

/**
 * Completely resets and clears all user accounts and platform owner registry.
 * Enables creating the entire system hierarchy from scratch.
 */
export async function resetAllUsersAndOwner(): Promise<void> {
  verifiedProfile = null;
  let idToken: string | undefined;
  try {
    idToken = await auth.currentUser?.getIdToken?.();
  } catch {}

  // 1. Clear local storage user and owner markers
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToPurge = [
      'ams_users_v5_clean',
      'aplus_users',
      'users',
      'ams_current_user_v5_clean',
      'ams_impersonation_admin_v1',
      'aplus_current_user',
      'aplus_owner_registered_local',
      'aplus_owner_email_local',
      'ams_production_seeded_v5',
    ];
    keysToPurge.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('ams_users_v5_clean', JSON.stringify([]));
  }

  // 2. Reset cloud Firestore registry document (while still signed in as owner if possible)
  try {
    const regRef = doc(db, 'system_state', 'platform_owner_registry');
    await setDoc(regRef, {
      isInitialized: false,
      ownerUid: null,
      ownerEmail: null,
      resetAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}

  // 3. Reset backend server registry if available
  try {
    await fetch('/api/platform/reset-scratch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
    });
  } catch {}

  // 4. Sign out of Firebase Auth
  await signOut(auth).catch(() => {});

  // 5. Notify application to reset states
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('aplus-logout'));
    window.dispatchEvent(new Event('aplus-users-purged'));
  }
}

/**
 * Controlled initial platform owner account setup procedure.
 * Enforces transactional execution in a trusted environment with client fallback.
 */
export async function provisionInitialPlatformOwner(
  email: string,
  password: string,
  name?: string,
  bootstrapSecret?: string
) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please provide a valid platform owner email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Owner password must be at least 8 characters for security.');
  }

  // 1. Check cloud registry first so already-initialized instances reject unauthenticated overwrites
  try {
    const existingReg = await getDoc(doc(db, 'system_state', 'platform_owner_registry'));
    if (existingReg.exists() && existingReg.data()?.isInitialized) {
      const regEmail = String(existingReg.data()?.ownerEmail || '').toLowerCase();
      const currentUid = auth.currentUser?.uid;
      const regUid = existingReg.data()?.ownerUid;
      if (!currentUid || (regUid && currentUid !== regUid && regEmail !== cleanEmail)) {
        throw new Error(
          'Platform owner account has already been established. Sign in with the registered Platform Owner account.'
        );
      }
    }
  } catch (preErr: any) {
    if (preErr?.message?.includes('already been established')) {
      throw preErr;
    }
  }

  // 2. Try server-side bootstrap first
  let serverHandled = false;
  try {
    const response = await fetch('/api/platform/bootstrap-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, name, bootstrapSecret }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.status !== 'client_fallback') {
      serverHandled = true;
    } else if (response.status === 409 || data.error === 'ALREADY_INITIALIZED') {
      throw new Error(
        'Platform owner account has already been established. Privilege elevation can only be performed by an existing authenticated Platform Owner or through verified password recovery.'
      );
    }
  } catch (err: any) {
    if (err.message?.includes('already been established') || err.message?.includes('ALREADY_INITIALIZED')) {
      throw err;
    }
  }

  // 2. Client-side Firebase account creation / sign-in
  interactiveAuthInProgress = true;
  try {
    let user: User;
    if (serverHandled) {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      user = credential.user;
    } else {
      try {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        user = credential.user;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
          user = credential.user;
        } else {
          throw createErr;
        }
      }
    }

    // 3. Create or update authoritative membership in Firestore
    const mRef = doc(db, 'memberships', user.uid);
    const ownerMembership = {
      name: name || user.displayName || 'Platform Super Admin (Site Owner)',
      username: cleanEmail.split('@')[0] || 'admin',
      email: cleanEmail,
      permissionLevel: 'level_1_platform_super_admin',
      clientId: null,
      campusId: null,
      status: 'active',
      allowedModules: ['all'],
      delegatedCampusIds: ['all'],
      isPlatformAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(mRef, ownerMembership, { merge: true });

    // 4. Update cloud platform owner registry
    try {
      const regRef = doc(db, 'system_state', 'platform_owner_registry');
      await setDoc(regRef, {
        isInitialized: true,
        ownerUid: user.uid,
        ownerEmail: cleanEmail,
        initializedAt: new Date().toISOString(),
      }, { merge: true });
    } catch {}

    // 5. Mirror Platform Owner into global_users & login_directory so owner appears globally in DB
    try {
      await provisionGlobalUserAccount({
        id: 'user-platform-owner',
        uid: user.uid,
        username: ownerMembership.username,
        name: ownerMembership.name,
        email: cleanEmail,
        role: 'level_1_platform_super_admin',
        permissionLevel: 'level_1_platform_super_admin',
        isSuperAdmin: true,
        clientId: null,
        campusId: null,
        permittedCampusIds: ['all'],
        allowedModules: ['all'],
        status: 'active',
      });
    } catch {}

    // 6. Update local storage marker
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('aplus_owner_registered_local', 'true');
      localStorage.setItem('aplus_owner_email_local', cleanEmail);
    }

    const profile = await restoreAccount(user);
    authResolvedOnce = true;
    authResolving = false;
    if (latestProfileCallback) latestProfileCallback(profile);
    notifyAuthStateSubscribers();
    return profile;
  } finally {
    interactiveAuthInProgress = false;
  }
}

export async function logoutAccount() {
  verifiedProfile = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('ams_current_user_v5_clean');
      localStorage.removeItem('ams_impersonation_admin_v1');
      localStorage.removeItem('aplus_current_user');
    } catch {}
    window.dispatchEvent(new Event('aplus-logout'));
  }
  await signOut(auth).catch(() => {});
}

export async function restoreAccount(user: User) {
  const uid = String(user?.uid || '').trim();
  if (!uid) {
    throw new Error('Invalid authentication session.');
  }
  const existingPromise = pendingRestoreByUid.get(uid);
  if (existingPromise) {
    return await existingPromise;
  }

  const promise = restoreAccountInternal(user).finally(() => {
    if (pendingRestoreByUid.get(uid) === promise) {
      pendingRestoreByUid.delete(uid);
    }
  });
  pendingRestoreByUid.set(uid, promise);
  return await promise;
}

async function restoreAccountInternal(user: User) {
  const mRef = doc(db, 'memberships', user.uid);
  const snapshot = await getDoc(mRef);
  let membership = snapshot.data();

  const emailLower = user.email?.toLowerCase() || '';
  const membershipUserIdHint = membership?.userId ? String(membership.userId) : undefined;
  const globalUser = await findGlobalUserInCloudByEmailOrUid(
    emailLower,
    user.uid,
    membershipUserIdHint
  ).catch(() => null);

  // Enforce authoritative status from Global User Directory when present
  if (globalUser && globalUser.status && globalUser.status !== 'active') {
    verifiedProfile = null;
    await signOut(auth).catch(() => {});
    throw new Error('Account locked or suspended. Contact your administrator.');
  }

  // Check registered Platform Owner registry status strictly (no hardcoded emails or admin@ bypass)
  let regData: any = null;
  let isRegistryOwner = false;
  try {
    const regSnap = await getDoc(doc(db, 'system_state', 'platform_owner_registry'));
    if (regSnap.exists()) {
      regData = regSnap.data();
      if (
        regData?.isInitialized &&
        (regData?.ownerUid === user.uid || regData?.ownerEmail?.toLowerCase() === emailLower)
      ) {
        isRegistryOwner = true;
      }
    }
  } catch {}

  // If user has no membership yet, strictly require registered global_users or initialized platform_owner_registry
  if (!snapshot.exists()) {
    if (globalUser) {
      const normalizedGlobalLevel = normalizeResolvedPermissionLevel(globalUser.permissionLevel, globalUser.role);
      const isGlobalOwner =
        isRegistryOwner ||
        Boolean(globalUser.isSuperAdmin || normalizedGlobalLevel === 'level_1_platform_super_admin');

      const globalMembership = {
        userId: globalUser.id,
        name: globalUser.name || user.displayName || emailLower.split('@')[0],
        username: globalUser.username || emailLower.split('@')[0],
        email: globalUser.email || emailLower,
        permissionLevel: isGlobalOwner
          ? 'level_1_platform_super_admin'
          : normalizedGlobalLevel || 'level_4_sub_campus_admin',
        role: isGlobalOwner
          ? 'level_1_platform_super_admin'
          : globalUser.role || normalizedGlobalLevel || 'Accountant',
        clientId: isGlobalOwner ? null : (globalUser.clientId ?? null),
        campusId: isGlobalOwner ? null : (globalUser.campusId ?? null),
        permittedCampusIds: globalUser.permittedCampusIds || (globalUser.campusId ? [globalUser.campusId] : ['all']),
        delegatedCampusIds:
          globalUser.delegatedSubCampusIds && globalUser.delegatedSubCampusIds.length > 0
            ? globalUser.delegatedSubCampusIds
            : globalUser.permittedCampusIds || ['all'],
        allowedModules: globalUser.allowedModules || ['all'],
        status: globalUser.status || 'active',
        isPlatformAdmin: isGlobalOwner,
        createdAt: globalUser.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(mRef, globalMembership, { merge: true });
      membership = globalMembership;
    } else if (isRegistryOwner) {
      const ownerMembership = {
        userId: 'user-platform-owner',
        name: user.displayName || 'Platform Super Admin (Site Owner)',
        username: emailLower.split('@')[0] || 'owner',
        email: emailLower,
        permissionLevel: 'level_1_platform_super_admin',
        role: 'level_1_platform_super_admin',
        clientId: null,
        campusId: null,
        status: 'active',
        allowedModules: ['all'],
        delegatedCampusIds: ['all'],
        createdAt: new Date().toISOString(),
        isPlatformAdmin: true,
      };
      await setDoc(mRef, ownerMembership, { merge: true });
      membership = ownerMembership;
    } else {
      verifiedProfile = null;
      await signOut(auth).catch(() => {});
      throw new Error('Access denied. Account is not registered for institutional access.');
    }
  } else if (globalUser) {
    const normalizedGlobalLevel = normalizeResolvedPermissionLevel(globalUser.permissionLevel, globalUser.role);
    const isGlobalOwner =
      isRegistryOwner ||
      Boolean(globalUser.isSuperAdmin || normalizedGlobalLevel === 'level_1_platform_super_admin');

    const syncedMembership = {
      ...membership,
      userId: globalUser.id,
      name: globalUser.name || membership?.name,
      username: globalUser.username || membership?.username,
      email: globalUser.email || membership?.email || emailLower,
      permissionLevel: isGlobalOwner
        ? 'level_1_platform_super_admin'
        : normalizedGlobalLevel || normalizeResolvedPermissionLevel(membership?.permissionLevel, membership?.role),
      role: isGlobalOwner
        ? 'level_1_platform_super_admin'
        : globalUser.role || membership?.role,
      clientId: isGlobalOwner ? null : (globalUser.clientId !== undefined ? globalUser.clientId : membership?.clientId),
      campusId: isGlobalOwner ? null : (globalUser.campusId !== undefined ? globalUser.campusId : membership?.campusId),
      permittedCampusIds:
        globalUser.permittedCampusIds && globalUser.permittedCampusIds.length > 0
          ? globalUser.permittedCampusIds
          : membership?.permittedCampusIds,
      delegatedCampusIds: globalUser.delegatedSubCampusIds?.length
        ? globalUser.delegatedSubCampusIds
        : membership?.delegatedCampusIds,
      allowedModules: globalUser.allowedModules || membership?.allowedModules,
      isPlatformAdmin: isGlobalOwner || Boolean(membership?.isPlatformAdmin && isRegistryOwner),
      status: globalUser.status || membership?.status,
      updatedAt: globalUser.updatedAt || membership?.updatedAt,
    };

    if (
      membership?.userId !== syncedMembership.userId ||
      membership?.permissionLevel !== syncedMembership.permissionLevel ||
      membership?.status !== syncedMembership.status ||
      membership?.campusId !== syncedMembership.campusId ||
      membership?.clientId !== syncedMembership.clientId
    ) {
      setDoc(mRef, syncedMembership, { merge: true }).catch(() => {});
    }
    membership = syncedMembership;
  }

  // Strictly block unregistered/removed users even if a stale memberships document exists
  if (snapshot.exists() && membership?.status === 'active') {
    const isVerifiedOwnerMember =
      isRegistryOwner ||
      ((membership?.isPlatformAdmin === true ||
        membership?.permissionLevel === 'level_1_platform_super_admin') &&
        (!regData?.isInitialized || regData?.ownerUid === user.uid || regData?.ownerEmail?.toLowerCase() === emailLower));

    if (!globalUser) {
      if (isVerifiedOwnerMember) {
        const mirrorUsername = membership.username || emailLower.split('@')[0] || 'owner';
        await provisionGlobalUserAccount({
          id: 'user-platform-owner',
          uid: user.uid,
          username: mirrorUsername,
          name: membership.name || user.displayName || mirrorUsername,
          email: emailLower,
          role: 'level_1_platform_super_admin',
          permissionLevel: 'level_1_platform_super_admin',
          isSuperAdmin: true,
          clientId: null,
          campusId: null,
          permittedCampusIds: ['all'],
          delegatedSubCampusIds: ['all'],
          allowedModules: ['all'],
          status: 'active',
        }).catch(() => {});
      } else {
        // Levels 2-5 MUST exist as an active registered user in global_users
        verifiedProfile = null;
        await signOut(auth).catch(() => {});
        throw new Error('This registered user account has been removed or disabled. Contact your administrator.');
      }
    } else if (!globalUser.uid) {
      setDoc(
        doc(db, 'global_users', globalUser.id),
        { uid: user.uid, updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch(() => {});
    }
  }

  // Enforce campus login access control if user is bound to a specific campus
  const boundCampusId = membership?.campusId;
  if (
    boundCampusId &&
    boundCampusId !== 'all' &&
    membership?.permissionLevel !== 'level_1_platform_super_admin' &&
    !membership?.isPlatformAdmin
  ) {
    try {
      const campCredSnap = await getDoc(doc(db, 'campus_credentials', String(boundCampusId)));
      if (campCredSnap.exists()) {
        const cData = campCredSnap.data();
        if (cData?.status === 'suspended' || cData?.status === 'locked') {
          verifiedProfile = null;
          await signOut(auth).catch(() => {});
          throw new Error('Campus login portal is currently suspended or locked by the administrator.');
        }
      }
    } catch (campErr: any) {
      if (String(campErr?.message || '').includes('Campus login portal')) {
        throw campErr;
      }
    }
  }

  if (membership?.status !== 'active') {
    verifiedProfile = null;
    await signOut(auth).catch(() => {});
    throw new Error('Account locked or suspended. Contact your administrator.');
  }

  const roles: Record<string, string> = {
    level_1_platform_super_admin: 'level_1_platform_super_admin',
    level_2_client_super_admin: 'level_2_client_super_admin',
    level_3_main_campus_admin: 'level_3_main_campus_admin',
    level_4_sub_campus_admin: 'level_4_sub_campus_admin',
    level_5_departmental_staff: 'campus_accountant',
    level_5_departmental_user: 'campus_accountant',
  };

  const normalizedLevel = normalizeResolvedPermissionLevel(membership?.permissionLevel, membership?.role);
  const isOwner = Boolean(
    isRegistryOwner ||
    Boolean(globalUser && (globalUser.isSuperAdmin || normalizeResolvedPermissionLevel(globalUser.permissionLevel, globalUser.role) === 'level_1_platform_super_admin')) ||
    ((membership?.isPlatformAdmin === true || normalizedLevel === 'level_1_platform_super_admin') &&
      (!regData?.isInitialized || regData?.ownerUid === user.uid || regData?.ownerEmail?.toLowerCase() === emailLower))
  );

  let resolvedId = membership?.userId || user.uid;
  if (isOwner && !membership?.userId) {
    resolvedId = 'user-platform-owner';
  }

  const assignedRole = isOwner
    ? 'level_1_platform_super_admin'
    : (roles[normalizedLevel] || membership.role || 'level_2_client_super_admin');
  const resolvedUsername =
    membership.username || (user.email?.split('@')[0] || user.email || 'user');
  const effectivePermissionLevel = isOwner ? 'level_1_platform_super_admin' : normalizedLevel;
  const resolvedCampusId = isOwner ? null : (membership.campusId ?? null);
  const resolvedPermittedCampuses =
    Array.isArray(membership.permittedCampusIds) && membership.permittedCampusIds.length > 0
      ? membership.permittedCampusIds
      : resolvedCampusId
      ? [resolvedCampusId]
      : ['all'];

  verifiedProfile = {
    id: resolvedId,
    uid: user.uid,
    username: resolvedUsername,
    email: user.email || emailLower,
    name: membership.name || (isOwner ? 'Platform Super Admin (Site Owner)' : user.email || 'Campus Administrator'),
    role: assignedRole,
    permissionLevel: effectivePermissionLevel,
    isSuperAdmin: isOwner,
    clientId: isOwner ? null : (membership.clientId ?? null),
    campusId: resolvedCampusId,
    permittedCampusIds: resolvedPermittedCampuses,
    allowedModules: membership.allowedModules || ['all'],
    delegatedCampusIds: membership.delegatedCampusIds || [],
    delegatedSubCampusIds: membership.delegatedCampusIds || [],
    status: membership.status,
  };

  // Synchronize verified session profile to both session & directory localStorage keys before signaling ready
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('ams_current_user_v5_clean', JSON.stringify(verifiedProfile));
    } catch {}
    syncUserRecordToLocalStorageCache({
      id: verifiedProfile.id,
      uid: verifiedProfile.uid,
      username: verifiedProfile.username,
      name: verifiedProfile.name,
      email: verifiedProfile.email,
      role: verifiedProfile.role,
      permissionLevel: verifiedProfile.permissionLevel,
      isSuperAdmin: verifiedProfile.isSuperAdmin,
      clientId: verifiedProfile.clientId,
      campusId: verifiedProfile.campusId,
      permittedCampusIds: verifiedProfile.permittedCampusIds,
      delegatedSubCampusIds: verifiedProfile.delegatedSubCampusIds,
      allowedModules: verifiedProfile.allowedModules,
      status: 'active',
      syncedToCloud: true,
      createdAt: membership?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    window.dispatchEvent(new Event('aplus-verified-login'));
  }
  return verifiedProfile;
}

/**
 * Initializes automatic background session recovery and ensures full profile, permission level,
 * and campus mapping resolution completes cleanly before InnerApp finishes rendering.
 */
let latestProfileCallback: ((profile: any) => void) | undefined;

export function initAuthListener(
  onProfileReady?: (profile: any) => void,
  onResolutionStateChange?: (state: AuthResolutionState) => void
) {
  if (onProfileReady) {
    latestProfileCallback = onProfileReady;
  }
  if (onResolutionStateChange) {
    authStateSubscribers.add(onResolutionStateChange);
  }

  // If Firebase auth state has already resolved once on a prior mount, emit synchronized snapshot immediately
  if (authResolvedOnce) {
    if (onProfileReady) {
      onProfileReady(verifiedProfile);
    }
    if (onResolutionStateChange) {
      onResolutionStateChange(getAuthResolutionState());
    }
  }

  if (authListenerAttached) {
    return () => {
      if (onResolutionStateChange) {
        authStateSubscribers.delete(onResolutionStateChange);
      }
    };
  }
  authListenerAttached = true;
  authResolving = true;
  notifyAuthStateSubscribers();

  onAuthStateChanged(auth, async (user) => {
    if (interactiveAuthInProgress) {
      return;
    }

    authResolving = true;
    notifyAuthStateSubscribers();

    if (user) {
      try {
        const profile = await restoreAccount(user);
        authResolvedOnce = true;
        authResolving = false;
        if (latestProfileCallback) latestProfileCallback(profile);
        notifyAuthStateSubscribers();
      } catch (err) {
        console.warn('Membership verification pending or failed for signed-in Firebase user:', err);
        verifiedProfile = null;
        authResolvedOnce = true;
        authResolving = false;
        if (latestProfileCallback) latestProfileCallback(null);
        notifyAuthStateSubscribers();
      }
    } else {
      verifiedProfile = null;
      authResolvedOnce = true;
      authResolving = false;
      if (latestProfileCallback) latestProfileCallback(null);
      notifyAuthStateSubscribers();
    }
  });

  return () => {
    if (onResolutionStateChange) {
      authStateSubscribers.delete(onResolutionStateChange);
    }
  };
}
