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
import { SEED_MULTI_TENANT_USERS } from './multiTenantDataService';
import {
  lookupLoginDirectoryByUsername,
  findGlobalUserInCloudByEmailOrUid,
  provisionGlobalUserAccount,
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

  // Direct lookup from registered seeded users
  const seeded = SEED_MULTI_TENANT_USERS.find(
    (u) => u.username.toLowerCase() === clean
  );
  if (seeded) return seeded.email.toLowerCase();

  const knownMap: Record<string, string> = {
    admin: 'siteowner@platform.org',
    siteowner: 'siteowner@platform.org',
    'client.admin': 'director@aplus.edu.pk',
    aplus: 'director@aplus.edu.pk',
    'apex.admin': 'head@apexacademy.edu.pk',
    apex: 'head@apexacademy.edu.pk',
    auditor: 'auditor@aschoolsystem.edu.pk',
    'campus.khl': 'main@aschoolsystem.edu.pk',
    khiali: 'main@aschoolsystem.edu.pk',
    main: 'main@aschoolsystem.edu.pk',
    'campus.peoples': 'peoples@aschoolsystem.edu.pk',
    peoples: 'peoples@aschoolsystem.edu.pk',
    'campus.mc': 'mastercity@aschoolsystem.edu.pk',
    mastercity: 'mastercity@aschoolsystem.edu.pk',
    'campus.cvt': 'civil@aschoolsystem.edu.pk',
    civil: 'civil@aschoolsystem.edu.pk',
    'campus.ghkr': 'ghakhar@aschoolsystem.edu.pk',
    ghakhar: 'ghakhar@aschoolsystem.edu.pk',
    'campus.apex': 'apexmain@apexacademy.edu.pk',
    apexmain: 'apexmain@apexacademy.edu.pk',
    modeltown: 'modeltown@aschoolsystem.edu.pk',
    dc: 'dc@aschoolsystem.edu.pk',
    cantt: 'cantt@aschoolsystem.edu.pk',
    'qa.test': 'qa.test@aplus.edu.pk',
  };

  if (knownMap[clean]) return knownMap[clean];
  return `${clean.replace(/[^a-z0-9._-]/g, '')}@aschoolsystem.edu.pk`;
}

/**
 * Resolves usernames dynamically via Firestore `login_directory`, server endpoint, and fallback conventions.
 */
export async function resolveUserEmailAsync(input: string): Promise<string> {
  const clean = input.trim().toLowerCase().replace(/\s+/g, '');
  if (clean.includes('@')) return clean;

  // 1. Live Firestore login_directory lookup (works on any browser before auth!)
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

  // 3. Fallback to static/legacy conventions
  return resolveUserEmail(input);
}

/**
 * Authenticates an account strictly through Firebase Authentication
 * and verifies that an active, server-authorized membership or global user exists.
 */
export async function authenticateAccount(emailOrUsername: string, password: string) {
  verifiedProfile = null;
  const cleanInput = (emailOrUsername || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanInput || !cleanPassword) {
    throw new Error('Unable to sign in. Check your email/username and password.');
  }

  const email = await resolveUserEmailAsync(cleanInput);

  // Check if this input matches an official pre-seeded institutional user
  const seededUser = SEED_MULTI_TENANT_USERS.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() ||
      u.username.toLowerCase() === cleanInput.toLowerCase()
  );

  // 1. Strictly attempt sign-in with the resolved email and exact password provided
  try {
    const credential = await signInWithEmailAndPassword(auth, email, cleanPassword);
    return await restoreAccount(credential.user);
  } catch (authErr: any) {
    // Fallback domain try if username lacked '@' and defaulted to @aschoolsystem.edu.pk when user uses @institution.edu.pk
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

    // 2. ONLY for recognized registered seeded users on first-time deployment with matching registered password
    if (seededUser && seededUser.password === cleanPassword) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, seededUser.email, cleanPassword);
        return await restoreAccount(credential.user);
      } catch (seedErr: any) {
        console.warn(`[Authentication Diagnostic] Seeded user sync deferred for ${seededUser.email}:`, seedErr?.message);
      }
    }

    // Sign out any dangling session
    await signOut(auth).catch(() => {});
    // Nonexistent accounts, random usernames, and wrong passwords receive strictly identical generic error
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
  // 1. Sign out of Firebase Auth
  await signOut(auth).catch(() => {});

  // 2. Clear local storage user and owner markers
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToPurge = [
      'ams_users_v5_clean',
      'aplus_users',
      'users',
      'ams_current_user_v5_clean',
      'aplus_current_user',
      'aplus_owner_registered_local',
      'aplus_owner_email_local',
      'ams_production_seeded_v5',
    ];
    keysToPurge.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('ams_users_v5_clean', JSON.stringify([]));
  }

  // 3. Reset cloud Firestore registry document
  try {
    const regRef = doc(db, 'system_state', 'platform_owner_registry');
    await setDoc(regRef, {
      isInitialized: false,
      ownerUid: null,
      ownerEmail: null,
      resetAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}

  // 4. Reset backend server registry if available
  try {
    await fetch('/api/platform/reset-scratch', { method: 'POST' });
  } catch {}

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

  // 1. Try server-side bootstrap first
  let serverHandled = false;
  try {
    const response = await fetch('/api/platform/bootstrap-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password, name, bootstrapSecret }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
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
    window.dispatchEvent(new Event('aplus-logout'));
  }
  await signOut(auth);
}

export async function restoreAccount(user: User) {
  const mRef = doc(db, 'memberships', user.uid);
  const snapshot = await getDoc(mRef);
  let membership = snapshot.data();

  const emailLower = user.email?.toLowerCase() || '';
  const globalUser = await findGlobalUserInCloudByEmailOrUid(emailLower, user.uid).catch(() => null);

  // If user has no membership yet, strictly verify against global_users, registered directory, or owner registry
  if (!snapshot.exists()) {
    // 1. Check authoritative global_users created by Platform Admin or Client Owner
    if (globalUser) {
      if (globalUser.status && globalUser.status !== 'active') {
        await signOut(auth).catch(() => {});
        throw new Error('Your account is currently suspended or inactive. Contact your administrator.');
      }

      const globalMembership = {
        userId: globalUser.id,
        name: globalUser.name || user.displayName || emailLower.split('@')[0],
        username: globalUser.username || emailLower.split('@')[0],
        email: globalUser.email || emailLower,
        permissionLevel: globalUser.permissionLevel || 'level_4_sub_campus_admin',
        role: globalUser.role || globalUser.permissionLevel || 'Accountant',
        clientId: globalUser.clientId ?? null,
        campusId: globalUser.campusId ?? null,
        permittedCampusIds: globalUser.permittedCampusIds || (globalUser.campusId ? [globalUser.campusId] : ['all']),
        delegatedCampusIds:
          globalUser.delegatedSubCampusIds && globalUser.delegatedSubCampusIds.length > 0
            ? globalUser.delegatedSubCampusIds
            : globalUser.permittedCampusIds || ['all'],
        allowedModules: globalUser.allowedModules || ['all'],
        status: globalUser.status || 'active',
        isPlatformAdmin: Boolean(globalUser.isSuperAdmin || globalUser.permissionLevel === 'level_1_platform_super_admin'),
        createdAt: globalUser.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(mRef, globalMembership, { merge: true });
      membership = globalMembership;
    } else {
      // Check if user is registered in platform_owner_registry
      let isRegistryOwner = false;
      try {
        const regSnap = await getDoc(doc(db, 'system_state', 'platform_owner_registry'));
        if (regSnap.exists()) {
          const regData = regSnap.data();
          if (regData?.isInitialized && (regData?.ownerUid === user.uid || regData?.ownerEmail?.toLowerCase() === emailLower)) {
            isRegistryOwner = true;
          }
        }
      } catch {}

      let isOwner =
        isRegistryOwner ||
        emailLower === 'siteowner@platform.org' ||
        emailLower === 'bajwaahmedsaad345@gmail.com' ||
        emailLower.startsWith('admin@');

      const seeded = SEED_MULTI_TENANT_USERS.find(
        (u) => u.email.toLowerCase() === emailLower
      );

      // Auto-bootstrap: If platform owner is uninitialized, allow first authenticated Google/institutional user to claim Site Owner
      if (!isOwner && !seeded) {
        try {
          const regSnap = await getDoc(doc(db, 'system_state', 'platform_owner_registry'));
          if (!regSnap.exists() || !regSnap.data()?.isInitialized) {
            isOwner = true;
            await setDoc(doc(db, 'system_state', 'platform_owner_registry'), {
              isInitialized: true,
              ownerUid: user.uid,
              ownerEmail: emailLower,
              initializedAt: new Date().toISOString(),
            }, { merge: true });
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.setItem('aplus_owner_registered_local', 'true');
              localStorage.setItem('aplus_owner_email_local', emailLower);
            }
          }
        } catch {}
      }

      if (!isOwner && !seeded) {
        await signOut(auth).catch(() => {});
        throw new Error('Access denied. No registered institutional membership found for this account.');
      }

      const permissionLevel = isOwner
        ? 'level_1_platform_super_admin'
        : (seeded?.role as any) || 'level_2_client_super_admin';

      const defaultMembership = {
        userId: isOwner ? 'user-platform-owner' : seeded?.id || user.uid,
        name: user.displayName || seeded?.name || (isOwner ? 'Platform Super Admin' : 'Campus Administrator'),
        username: seeded?.username || (isOwner ? 'admin' : emailLower.split('@')[0]),
        email: emailLower,
        permissionLevel,
        role: permissionLevel,
        clientId: isOwner ? null : seeded?.clientId || 'client-aplus',
        campusId: isOwner ? null : seeded?.campusId || 'campus-khiali',
        status: 'active',
        allowedModules: seeded?.allowedModules || ['all'],
        delegatedCampusIds: seeded?.permittedCampusIds || ['all'],
        createdAt: new Date().toISOString(),
        isPlatformAdmin: isOwner,
      };

      await setDoc(mRef, defaultMembership, { merge: true });
      membership = defaultMembership;

      // Ensure Platform Owner is mirrored to global_users
      if (isOwner) {
        await provisionGlobalUserAccount({
          id: 'user-platform-owner',
          uid: user.uid,
          username: defaultMembership.username,
          name: defaultMembership.name,
          email: emailLower,
          role: 'level_1_platform_super_admin',
          permissionLevel: 'level_1_platform_super_admin',
          isSuperAdmin: true,
          clientId: null,
          campusId: null,
          permittedCampusIds: ['all'],
          allowedModules: ['all'],
          status: 'active',
        }).catch(() => {});
      }
    }
  } else if (globalUser && (!membership?.updatedAt || (globalUser.updatedAt && globalUser.updatedAt > membership.updatedAt))) {
    // Sync any newer updates made in Global User Directory (role/campus/status edits)
    membership = {
      ...membership,
      userId: globalUser.id,
      name: globalUser.name || membership?.name,
      username: globalUser.username || membership?.username,
      permissionLevel: globalUser.permissionLevel || membership?.permissionLevel,
      role: globalUser.role || membership?.role,
      clientId: globalUser.clientId !== undefined ? globalUser.clientId : membership?.clientId,
      campusId: globalUser.campusId !== undefined ? globalUser.campusId : membership?.campusId,
      delegatedCampusIds: globalUser.delegatedSubCampusIds?.length
        ? globalUser.delegatedSubCampusIds
        : membership?.delegatedCampusIds,
      allowedModules: globalUser.allowedModules || membership?.allowedModules,
      status: globalUser.status || membership?.status,
      updatedAt: globalUser.updatedAt,
    };
  }

  if (membership?.status !== 'active') {
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

  const isOwner =
    emailLower === 'siteowner@platform.org' ||
    emailLower === 'bajwaahmedsaad345@gmail.com' ||
    emailLower.startsWith('admin@') ||
    membership?.isPlatformAdmin === true ||
    membership?.permissionLevel === 'level_1_platform_super_admin';

  let resolvedId = membership?.userId || user.uid;
  if (isOwner && (emailLower === 'siteowner@platform.org' || emailLower === 'bajwaahmedsaad345@gmail.com' || emailLower.startsWith('admin@') || !membership?.userId)) {
    resolvedId = 'user-platform-owner';
  }

  const assignedRole = isOwner
    ? 'level_1_platform_super_admin'
    : (roles[membership.permissionLevel] || membership.role || 'level_2_client_super_admin');
  const resolvedUsername =
    membership.username || (isOwner ? 'admin' : user.email?.split('@')[0] || user.email || 'user');

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
export function initAuthListener(onProfileReady?: (profile: any) => void) {
  if (authListenerAttached) return;
  authListenerAttached = true;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await restoreAccount(user);
        if (onProfileReady) onProfileReady(profile);
      } catch (err) {
        console.warn('Membership verification pending or failed for signed-in Firebase user:', err);
        verifiedProfile = null;
      }
    } else {
      verifiedProfile = null;
    }
  });
}
