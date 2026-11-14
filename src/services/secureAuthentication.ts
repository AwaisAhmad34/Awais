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
} from './globalUserSyncService';

let verifiedProfile: any = null;
let authListenerAttached = false;

export function getVerifiedProfile() {
  return verifiedProfile;
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
 * Resolves usernames dynamically via Firestore `login_directory` and server endpoint.
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

  // 3. Standard institutional domain normalization
  return resolveUserEmail(input);
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
    throw new Error('Unable to sign in. Check your email/username and password.');
  }

  const email = await resolveUserEmailAsync(cleanInput);

  // Strictly attempt sign-in against Firebase Auth with registered credentials only
  try {
    const credential = await signInWithEmailAndPassword(auth, email, cleanPassword);
    return await restoreAccount(credential.user);
  } catch {
    if (!cleanInput.includes('@')) {
      const cleanUname = cleanInput.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9._-]/g, '');
      const altEmail = `${cleanUname}@institution.edu.pk`;
      if (altEmail !== email) {
        try {
          const altCred = await signInWithEmailAndPassword(auth, altEmail, cleanPassword);
          return await restoreAccount(altCred.user);
        } catch {}
      }
    }

    await signOut(auth).catch(() => {});
    throw new Error('Unable to sign in. Check your email/username and password.');
  }
}

/**
 * Signs in securely using Google Sign-in with Firebase Auth (popup flow).
 * Seamlessly authenticates institutional users and provisions Platform Owner privileges.
 */
export async function signInWithGoogle() {
  verifiedProfile = null;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return await restoreAccount(credential.user);
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

  return await restoreAccount(user);
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
  const mRef = doc(db, 'memberships', user.uid);
  const snapshot = await getDoc(mRef);
  let membership = snapshot.data();

  const emailLower = user.email?.toLowerCase() || '';
  const globalUser = await findGlobalUserInCloudByEmailOrUid(emailLower, user.uid).catch(() => null);

  // Enforce authoritative status from Global User Directory when present
  if (globalUser && globalUser.status && globalUser.status !== 'active') {
    verifiedProfile = null;
    await signOut(auth).catch(() => {});
    throw new Error('Your account is currently suspended or inactive. Contact your administrator.');
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
      const isGlobalOwner =
        Boolean(globalUser.isSuperAdmin || globalUser.permissionLevel === 'level_1_platform_super_admin') &&
        (!regData?.isInitialized || isRegistryOwner);

      const globalMembership = {
        userId: globalUser.id,
        name: globalUser.name || user.displayName || emailLower.split('@')[0],
        username: globalUser.username || emailLower.split('@')[0],
        email: globalUser.email || emailLower,
        permissionLevel: isGlobalOwner
          ? 'level_1_platform_super_admin'
          : globalUser.permissionLevel || 'level_4_sub_campus_admin',
        role: isGlobalOwner
          ? 'level_1_platform_super_admin'
          : globalUser.role || globalUser.permissionLevel || 'Accountant',
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
    const isGlobalOwner =
      Boolean(globalUser.isSuperAdmin || globalUser.permissionLevel === 'level_1_platform_super_admin') &&
      (!regData?.isInitialized || isRegistryOwner);

    membership = {
      ...membership,
      userId: globalUser.id,
      name: globalUser.name || membership?.name,
      username: globalUser.username || membership?.username,
      permissionLevel: isGlobalOwner
        ? 'level_1_platform_super_admin'
        : globalUser.permissionLevel || membership?.permissionLevel,
      role: isGlobalOwner
        ? 'level_1_platform_super_admin'
        : globalUser.role || membership?.role,
      clientId: isGlobalOwner ? null : (globalUser.clientId !== undefined ? globalUser.clientId : membership?.clientId),
      campusId: isGlobalOwner ? null : (globalUser.campusId !== undefined ? globalUser.campusId : membership?.campusId),
      delegatedCampusIds: globalUser.delegatedSubCampusIds?.length
        ? globalUser.delegatedSubCampusIds
        : membership?.delegatedCampusIds,
      allowedModules: globalUser.allowedModules || membership?.allowedModules,
      isPlatformAdmin: isGlobalOwner || Boolean(membership?.isPlatformAdmin && isRegistryOwner),
      status: globalUser.status || membership?.status,
      updatedAt: globalUser.updatedAt || membership?.updatedAt,
    };
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
    throw new Error('Your account is not active. Contact the platform site owner.');
  }

  const roles: Record<string, string> = {
    level_1_platform_super_admin: 'level_1_platform_super_admin',
    level_2_client_super_admin: 'level_2_client_super_admin',
    level_3_main_campus_admin: 'level_3_main_campus_admin',
    level_4_sub_campus_admin: 'level_4_sub_campus_admin',
    level_5_departmental_staff: 'campus_accountant',
    level_5_departmental_user: 'campus_accountant',
  };

  const isOwner = Boolean(
    isRegistryOwner ||
    ((membership?.isPlatformAdmin === true ||
      membership?.permissionLevel === 'level_1_platform_super_admin') &&
      (!regData?.isInitialized || regData?.ownerUid === user.uid || regData?.ownerEmail?.toLowerCase() === emailLower))
  );

  let resolvedId = membership?.userId || user.uid;
  if (isOwner && !membership?.userId) {
    resolvedId = 'user-platform-owner';
  }

  const assignedRole = isOwner
    ? 'level_1_platform_super_admin'
    : (roles[membership.permissionLevel] || membership.role || 'level_2_client_super_admin');
  const resolvedUsername =
    membership.username || (user.email?.split('@')[0] || user.email || 'user');

  verifiedProfile = {
    id: resolvedId,
    uid: user.uid,
    username: resolvedUsername,
    email: user.email,
    name: membership.name || (isOwner ? 'Platform Super Admin (Site Owner)' : user.email || 'Campus Administrator'),
    role: assignedRole,
    permissionLevel: isOwner ? 'level_1_platform_super_admin' : (membership.permissionLevel || 'level_2_client_super_admin'),
    clientId: isOwner ? null : (membership.clientId ?? null),
    campusId: isOwner ? null : (membership.campusId ?? null),
    permittedCampusIds: membership.permittedCampusIds || (membership.campusId ? [membership.campusId] : ['all']),
    allowedModules: membership.allowedModules || ['all'],
    delegatedCampusIds: membership.delegatedCampusIds || [],
    status: membership.status,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ams_current_user_v5_clean', JSON.stringify(verifiedProfile));
    } catch {}
    window.dispatchEvent(new Event('aplus-verified-login'));
  }
  return verifiedProfile;
}

/**
 * Initializes automatic background session recovery on page reload
 */
let latestProfileCallback: ((profile: any) => void) | undefined;

export function initAuthListener(onProfileReady?: (profile: any) => void) {
  if (onProfileReady) {
    latestProfileCallback = onProfileReady;
  }
  if (authListenerAttached) return;
  authListenerAttached = true;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await restoreAccount(user);
        if (latestProfileCallback) latestProfileCallback(profile);
      } catch (err) {
        console.warn('Membership verification pending or failed for signed-in Firebase user:', err);
        verifiedProfile = null;
        if (latestProfileCallback) latestProfileCallback(null);
      }
    } else {
      verifiedProfile = null;
      if (latestProfileCallback) latestProfileCallback(null);
    }
  });
}
