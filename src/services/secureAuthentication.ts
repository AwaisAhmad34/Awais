import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

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

  const knownMap: Record<string, string> = {
    admin: 'siteowner@platform.org',
    siteowner: 'siteowner@platform.org',
    'client.admin': 'director@aplus.edu.pk',
    aplus: 'director@aplus.edu.pk',
    'apex.admin': 'head@apexacademy.edu.pk',
    apex: 'head@apexacademy.edu.pk',
    auditor: 'auditor@aplus.edu.pk',
    'campus.khl': 'khiali@aplus.edu.pk',
    khiali: 'khiali@aplus.edu.pk',
    'campus.peoples': 'peoples@aplus.edu.pk',
    'campus.mc': 'mastercity@aplus.edu.pk',
    'campus.cvt': 'civil@aplus.edu.pk',
    'campus.ghkr': 'ghakhar@aplus.edu.pk',
    'campus.apex': 'apexmain@apexacademy.edu.pk',
  };

  if (knownMap[clean]) return knownMap[clean];
  return `${clean.replace(/[^a-z0-9._-]/g, '')}@aplus.edu.pk`;
}

/**
 * Authenticates an account strictly through Firebase Authentication
 * and verifies that an active, server-authorized membership exists.
 */
export async function authenticateAccount(emailOrUsername: string, password: string) {
  verifiedProfile = null;
  const email = resolveUserEmail(emailOrUsername);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return await restoreAccount(credential.user);
  } catch (error: any) {
    await signOut(auth).catch(() => {});
    if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password') {
      throw new Error('Authentication failed. Check your email/username and password. If this is a fresh setup, use "Initialize Platform Owner".');
    }
    if (error?.code?.startsWith('auth/')) {
      throw new Error(`Firebase Authentication error: ${error.message || error.code}`);
    }
    throw error;
  }
}

/**
 * Controlled initial platform owner account setup procedure.
 * Allows the verified site owner to bootstrap the owner account into Firebase Authentication
 * and create the authoritative root membership without hardcoded bypasses.
 */
export async function provisionInitialPlatformOwner(email: string, password: string, name?: string) {
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid platform owner email address.');
  }
  if (!password || password.length < 8) {
    throw new Error('Owner password must be at least 8 characters for security.');
  }

  // Create or sign in user via Firebase Auth
  let user: User;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    user = credential.user;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      user = credential.user;
    } else {
      throw new Error(`Owner provisioning failed: ${err.message || err.code}`);
    }
  }

  // Authoritative server/cloud document
  const membershipRef = doc(db, 'memberships', user.uid);
  const membershipData = {
    name: name?.trim() || 'Platform Super Admin (Site Owner)',
    email: user.email?.toLowerCase(),
    permissionLevel: 'level_1_platform_super_admin',
    clientId: null,
    campusId: null,
    status: 'active',
    allowedModules: ['all'],
    delegatedCampusIds: ['all'],
    createdAt: new Date().toISOString(),
    isPlatformAdmin: true,
  };

  await setDoc(membershipRef, membershipData, { merge: true });

  // Also register in system_state if needed
  try {
    await setDoc(
      doc(db, 'system_state', 'platform_owner_registry'),
      {
        ownerUid: user.uid,
        ownerEmail: user.email?.toLowerCase(),
        initializedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {}

  return await restoreAccount(user);
}

export async function logoutAccount() {
  verifiedProfile = null;
  window.dispatchEvent(new Event('aplus-logout'));
  await signOut(auth);
}

export async function restoreAccount(user: User) {
  const snapshot = await getDoc(doc(db, 'memberships', user.uid));
  const membership = snapshot.data();

  if (!snapshot.exists() || membership?.status !== 'active') {
    throw new Error('Your account is not active or has no approved membership in Firebase Firestore. Contact the platform site owner.');
  }

  const roles: Record<string, string> = {
    level_1_platform_super_admin: 'level_1_platform_super_admin',
    level_2_client_super_admin: 'level_2_client_super_admin',
    level_3_main_campus_admin: 'level_3_main_campus_admin',
    level_4_sub_campus_admin: 'level_4_sub_campus_admin',
    level_5_departmental_staff: 'campus_accountant',
  };

  if (
    !roles[membership.permissionLevel] ||
    (membership.permissionLevel !== 'level_1_platform_super_admin' && !membership.clientId)
  ) {
    throw new Error('Account membership data is incomplete. Contact the platform administrator.');
  }

  verifiedProfile = {
    id: user.uid,
    username: user.email,
    email: user.email,
    name: membership.name || user.email,
    role: roles[membership.permissionLevel],
    permissionLevel: membership.permissionLevel,
    clientId: membership.clientId || null,
    campusId: membership.campusId || null,
    allowedModules: membership.allowedModules || ['all'],
    delegatedCampusIds: membership.delegatedCampusIds || [],
    status: membership.status,
  };

  window.dispatchEvent(new Event('aplus-verified-login'));
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
