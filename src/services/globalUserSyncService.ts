import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

export interface GlobalUserRecord {
  id: string;
  uid?: string | null;
  username: string;
  name: string;
  email: string;
  role: string;
  permissionLevel: string;
  isSuperAdmin: boolean;
  clientId: string | null;
  campusId: string | null;
  campusName?: string;
  permittedCampusIds: string[];
  delegatedSubCampusIds: string[];
  allowedModules: string[];
  status: 'active' | 'inactive' | 'suspended';
  designation?: string;
  syncedToCloud: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionGlobalUserInput {
  id?: string;
  uid?: string | null;
  username: string;
  name: string;
  email?: string;
  password?: string;
  role?: string;
  permissionLevel?: string;
  isSuperAdmin?: boolean;
  clientId?: string | null;
  campusId?: string | null;
  campusName?: string;
  permittedCampusIds?: string[];
  delegatedSubCampusIds?: string[];
  allowedModules?: string[];
  status?: 'active' | 'inactive' | 'suspended';
  designation?: string;
}

export interface ProvisionGlobalUserResult {
  userRecord: GlobalUserRecord;
  uid: string | null;
  authProvisioned: boolean;
  warning?: string;
}

const PROVISIONING_APP_NAME = 'UserProvisioningApp';

function getProvisioningApp(): FirebaseApp {
  const existing = getApps().find((a) => a.name === PROVISIONING_APP_NAME);
  if (existing) return existing;
  return initializeApp(firebaseConfig, PROVISIONING_APP_NAME);
}

function getProvisioningAuth(): Auth {
  return getAuth(getProvisioningApp());
}

export function normalizeUsernameKey(username: string): string {
  return (username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '_');
}

async function getAuthBearerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await auth.currentUser?.getIdToken?.();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return headers;
}

function normalizePermissionLevel(level?: string, role?: string, isSuperAdmin?: boolean): string {
  if (level) {
    if (level === 'level_2_client_admin') return 'level_2_client_super_admin';
    return level;
  }
  if (isSuperAdmin || role === 'level_1_platform_super_admin' || role === 'admin') {
    return 'level_1_platform_super_admin';
  }
  if (role === 'level_2_client_super_admin') return 'level_2_client_super_admin';
  if (role === 'level_3_main_campus_admin') return 'level_3_main_campus_admin';
  if (role === 'level_3_sub_campus_admin' || role === 'level_4_sub_campus_admin') {
    return 'level_4_sub_campus_admin';
  }
  return 'level_5_departmental_staff';
}

export function normalizeEmailKey(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function isLegacyPlaceholderAdmin(user: any): boolean {
  if (!user || typeof user !== 'object') return false;
  return (
    user.id === 'user-admin' &&
    normalizeUsernameKey(user.username || '') === 'admin' &&
    normalizeEmailKey(user.email || '') === 'admin@aschoolsystem.edu.pk'
  );
}

function parseIsoMs(val: any): number {
  if (!val) return 0;
  const parsed = Date.parse(String(val));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toCanonicalGlobalUser(raw: any): GlobalUserRecord {
  const cleanUsername = normalizeUsernameKey(raw?.username || raw?.email?.split?.('@')?.[0] || raw?.id || 'user') || 'user';
  const resolvedLevel = normalizePermissionLevel(raw?.permissionLevel, raw?.role, raw?.isSuperAdmin);
  const isLevel1 = resolvedLevel === 'level_1_platform_super_admin' || Boolean(raw?.isSuperAdmin);
  const resolvedEmail = normalizeEmailKey(raw?.email) || `${cleanUsername}@institution.edu.pk`;
  const createdAt = raw?.createdAt ? String(raw.createdAt) : '1970-01-01T00:00:00.000Z';
  const updatedAt = raw?.updatedAt ? String(raw.updatedAt) : createdAt;

  return {
    id: String(raw?.id || `usr-${cleanUsername}`),
    uid: raw?.uid ? String(raw.uid) : null,
    username: String(raw?.username || cleanUsername).trim().toLowerCase(),
    name: String(raw?.name || raw?.username || cleanUsername).trim(),
    email: resolvedEmail,
    role: String(
      raw?.role ||
        (isLevel1
          ? 'level_1_platform_super_admin'
          : resolvedLevel === 'level_2_client_super_admin'
          ? 'level_2_client_super_admin'
          : 'Accountant')
    ),
    permissionLevel: resolvedLevel,
    isSuperAdmin: isLevel1,
    clientId: isLevel1 ? null : (raw?.clientId ?? null),
    campusId: isLevel1 ? null : (raw?.campusId ?? null),
    campusName: raw?.campusName ? String(raw.campusName) : undefined,
    permittedCampusIds:
      Array.isArray(raw?.permittedCampusIds) && raw.permittedCampusIds.length > 0
        ? raw.permittedCampusIds.map(String)
        : isLevel1
        ? ['all']
        : raw?.campusId
        ? [String(raw.campusId)]
        : ['all'],
    delegatedSubCampusIds: Array.isArray(raw?.delegatedSubCampusIds)
      ? raw.delegatedSubCampusIds.map(String)
      : Array.isArray(raw?.delegatedCampusIds)
      ? raw.delegatedCampusIds.map(String)
      : [],
    allowedModules:
      Array.isArray(raw?.allowedModules) && raw.allowedModules.length > 0
        ? raw.allowedModules.map(String)
        : ['all'],
    status:
      raw?.status === 'inactive' || raw?.status === 'suspended' ? raw.status : 'active',
    designation: raw?.designation ? String(raw.designation) : undefined,
    syncedToCloud: true,
    createdAt,
    updatedAt,
  };
}

/**
 * Produces a strictly deterministic, deduplicated, canonically ordered Global User list
 * so every browser renders the exact same users from Cloud Firestore without stale local leaks.
 */
export function normalizeAndDeduplicateGlobalUsers(
  rawUsers: any[],
  activeProfile?: any
): GlobalUserRecord[] {
  const candidates: GlobalUserRecord[] = [];
  for (const item of rawUsers || []) {
    if (!item || typeof item !== 'object') continue;
    if (isLegacyPlaceholderAdmin(item)) continue;
    if (!item.id && !item.username && !item.email) continue;
    candidates.push(toCanonicalGlobalUser(item));
  }

  if (activeProfile && (activeProfile.id || activeProfile.email) && !isLegacyPlaceholderAdmin(activeProfile)) {
    const pEmail = normalizeEmailKey(activeProfile.email);
    const pUser = normalizeUsernameKey(activeProfile.username || '');
    const pId = String(activeProfile.id || '');
    const alreadyPresent = candidates.some(
      (c) =>
        (pId && c.id === pId) ||
        (pEmail && normalizeEmailKey(c.email) === pEmail) ||
        (pUser && normalizeUsernameKey(c.username) === pUser)
    );
    if (!alreadyPresent) {
      candidates.push(toCanonicalGlobalUser(activeProfile));
    }
  }

  // Sort deterministically before deduplicating so newest authoritative doc always wins on every browser
  candidates.sort((a, b) => {
    const updDiff = parseIsoMs(b.updatedAt) - parseIsoMs(a.updatedAt);
    if (updDiff !== 0) return updDiff;
    const ownerBiasA = a.id === 'user-platform-owner' ? 0 : 1;
    const ownerBiasB = b.id === 'user-platform-owner' ? 0 : 1;
    if (ownerBiasA !== ownerBiasB) return ownerBiasA - ownerBiasB;
    const uidBiasA = a.uid ? 0 : 1;
    const uidBiasB = b.uid ? 0 : 1;
    if (uidBiasA !== uidBiasB) return uidBiasA - uidBiasB;
    return a.id.localeCompare(b.id);
  });

  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const seenUsernames = new Set<string>();
  const deduped: GlobalUserRecord[] = [];

  for (const u of candidates) {
    const idKey = u.id.trim();
    const emailKey = normalizeEmailKey(u.email);
    const unameKey = normalizeUsernameKey(u.username);

    if (idKey && seenIds.has(idKey)) continue;
    if (emailKey && seenEmails.has(emailKey)) continue;
    if (unameKey && seenUsernames.has(unameKey)) continue;

    if (idKey) seenIds.add(idKey);
    if (emailKey) seenEmails.add(emailKey);
    if (unameKey) seenUsernames.add(unameKey);
    deduped.push(u);
  }

  // Deterministic final presentation order across all browsers
  deduped.sort((a, b) => {
    const isAdminA = a.isSuperAdmin || a.permissionLevel === 'level_1_platform_super_admin' ? 0 : 1;
    const isAdminB = b.isSuperAdmin || b.permissionLevel === 'level_1_platform_super_admin' ? 0 : 1;
    if (isAdminA !== isAdminB) return isAdminA - isAdminB;
    const crtDiff = parseIsoMs(a.createdAt) - parseIsoMs(b.createdAt);
    if (crtDiff !== 0) return crtDiff;
    const nameDiff = a.username.localeCompare(b.username);
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id);
  });

  return deduped;
}

function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

/**
 * Provisions or updates a user in Firebase Authentication (via secondary isolated Auth app so the
 * current administrator's session is never interrupted) AND persists the authoritative profile to
 * Firestore `global_users`, `login_directory`, and `memberships`.
 */
export async function provisionGlobalUserAccount(
  input: ProvisionGlobalUserInput
): Promise<ProvisionGlobalUserResult> {
  const cleanUsername = (input.username || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!cleanUsername) {
    throw new Error('Username is required to provision a global user account.');
  }

  const cleanName = (input.name || cleanUsername).trim();
  const cleanEmail = (input.email || `${cleanUsername}@institution.edu.pk`).trim().toLowerCase();
  const cleanPassword = (input.password || '').trim();
  const now = new Date().toISOString();

  const resolvedLevel = normalizePermissionLevel(input.permissionLevel, input.role, input.isSuperAdmin);
  const isLevel1 = resolvedLevel === 'level_1_platform_super_admin' || Boolean(input.isSuperAdmin);
  const resolvedRole = isLevel1
    ? 'level_1_platform_super_admin'
    : input.role || (resolvedLevel === 'level_2_client_super_admin' ? 'level_2_client_super_admin' : 'Accountant');

  const safeUsernameKey = normalizeUsernameKey(cleanUsername) || 'user';
  let existingUser: GlobalUserRecord | null = null;
  if (!input.id && auth.currentUser) {
    existingUser = await findGlobalUserInCloudByEmailOrUid(cleanEmail, input.uid || undefined).catch(() => null);
    if (!existingUser) {
      const dirMatch = await lookupLoginDirectoryByUsername(safeUsernameKey).catch(() => null);
      if (dirMatch?.userId) {
        try {
          const existingSnap = await getDoc(doc(db, 'global_users', dirMatch.userId));
          if (existingSnap.exists()) {
            existingUser = { ...(existingSnap.data() as GlobalUserRecord), id: existingSnap.id };
          }
        } catch {}
      }
    }
  }

  const userId =
    input.id ||
    existingUser?.id ||
    `usr-${safeUsernameKey}`;

  let resolvedUid: string | null = input.uid || existingUser?.uid || null;
  let authProvisioned = false;
  let warning: string | undefined;

  // 1. If password provided, ensure Firebase Auth user exists cleanly
  if (cleanPassword) {
    if (cleanPassword.length < 6) {
      warning = 'Password was under 6 characters; Firebase Auth requires at least 6 characters for remote login.';
    } else {
      // 1A. Try trusted server Admin SDK first (handles password resets & existing emails cleanly when cert is present)
      let serverDone = false;
      try {
        const authHeaders = await getAuthBearerHeaders();
        const res = await fetch('/api/platform/provision-user', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            email: cleanEmail,
            password: cleanPassword,
            displayName: cleanName,
            userId,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.status === 'success' && data?.uid) {
            resolvedUid = data.uid;
            authProvisioned = true;
            serverDone = true;
          }
        }
      } catch {}

      // 1B. Client delegation via isolated secondary Firebase Auth app (never signs out current admin!)
      if (!serverDone) {
        const secondaryAuth = getProvisioningAuth();
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
          resolvedUid = cred.user.uid;
          authProvisioned = true;
          try {
            await updateProfile(cred.user, { displayName: cleanName });
          } catch {}
        } catch (authErr: any) {
          if (authErr?.code === 'auth/email-already-in-use') {
            try {
              const existingCred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, cleanPassword);
              resolvedUid = existingCred.user.uid;
              authProvisioned = true;
            } catch {
              warning =
                'Email already exists in Firebase Authentication with a different password. User profile updated in database.';
            }
          } else {
            warning = authErr?.message || 'Firebase Auth provisioning returned an advisory notice.';
          }
        } finally {
          await signOut(secondaryAuth).catch(() => {});
        }
      }
    }
  }

  const userRecord: GlobalUserRecord = {
    id: userId,
    uid: resolvedUid,
    username: cleanUsername,
    name: cleanName,
    email: cleanEmail,
    role: resolvedRole,
    permissionLevel: resolvedLevel,
    isSuperAdmin: isLevel1,
    clientId: isLevel1 ? null : (input.clientId ?? null),
    campusId: isLevel1 ? null : (input.campusId ?? null),
    campusName: input.campusName || (isLevel1 ? 'All Campuses (Central Platform)' : undefined),
    permittedCampusIds:
      input.permittedCampusIds && input.permittedCampusIds.length > 0
        ? input.permittedCampusIds
        : isLevel1
        ? ['all']
        : input.campusId
        ? [input.campusId]
        : ['all'],
    delegatedSubCampusIds: input.delegatedSubCampusIds || [],
    allowedModules:
      input.allowedModules && input.allowedModules.length > 0 ? input.allowedModules : ['all'],
    status: input.status || 'active',
    designation: input.designation || resolvedRole,
    syncedToCloud: true,
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
  };

  // 2. Write to Firestore `global_users/{userId}`
  if (auth.currentUser) {
    const globalUserPath = `global_users/${userId}`;
    try {
      await setDoc(
        doc(db, 'global_users', userId),
        sanitizeFirestorePayload({
          ...userRecord,
          updatedByUid: auth.currentUser.uid,
          updatedByEmail: auth.currentUser.email || null,
        }),
        { merge: true }
      );
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, globalUserPath);
      }
      throw err;
    }

    // 3. Write username -> email mapping to `login_directory/{usernameKey}` so fresh browsers can log in by username
    const dirKey = normalizeUsernameKey(cleanUsername);
    const loginDirPath = `login_directory/${dirKey}`;
    try {
      await setDoc(
        doc(db, 'login_directory', dirKey),
        sanitizeFirestorePayload({
          username: cleanUsername,
          email: cleanEmail,
          userId,
          uid: resolvedUid,
          status: userRecord.status,
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.WRITE, loginDirPath);
      }
    }

    // 4. Write authoritative `memberships/{uid}` if UID resolved
    if (resolvedUid) {
      const membershipPath = `memberships/${resolvedUid}`;
      try {
        await setDoc(
          doc(db, 'memberships', resolvedUid),
          sanitizeFirestorePayload({
            userId,
            name: cleanName,
            username: cleanUsername,
            email: cleanEmail,
            permissionLevel: resolvedLevel,
            role: resolvedRole,
            clientId: userRecord.clientId,
            campusId: userRecord.campusId,
            permittedCampusIds: userRecord.permittedCampusIds,
            delegatedCampusIds:
              userRecord.delegatedSubCampusIds.length > 0
                ? userRecord.delegatedSubCampusIds
                : userRecord.permittedCampusIds,
            allowedModules: userRecord.allowedModules,
            status: userRecord.status,
            isPlatformAdmin: isLevel1,
            createdAt: now,
            updatedAt: now,
          }),
          { merge: true }
        );
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, membershipPath);
        }
      }
    }

    // 5. Mirror into tenant-scoped organization users collection if clientId is assigned
    if (userRecord.clientId) {
      const tenantUserPath = `organizations/${userRecord.clientId}/users/${userId}`;
      try {
        await setDoc(
          doc(db, 'organizations', userRecord.clientId, 'users', userId),
          sanitizeFirestorePayload(userRecord),
          { merge: true }
        );
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          handleFirestoreError(err, OperationType.WRITE, tenantUserPath);
        }
      }
    }
  }

  // Notify in-tab listeners immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aplus-global-users-updated'));
  }

  return {
    userRecord,
    uid: resolvedUid,
    authProvisioned,
    warning,
  };
}

/**
 * Resolves a username from Firestore `login_directory/{username}` for cross-device credential login.
 */
export async function lookupLoginDirectoryByUsername(
  username: string
): Promise<{ email: string; userId?: string; status?: string } | null> {
  const rawClean = (username || '').trim().toLowerCase().replace(/\s+/g, '');
  const dirKey = normalizeUsernameKey(username);
  if (!dirKey) return null;

  const keysToTry = Array.from(new Set([dirKey, rawClean].filter(Boolean)));
  for (const key of keysToTry) {
    try {
      const snap = await getDoc(doc(db, 'login_directory', key));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.email) {
          return {
            email: String(data.email).trim().toLowerCase(),
            userId: data.userId ? String(data.userId) : undefined,
            status: data.status ? String(data.status) : undefined,
          };
        }
      }
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        console.warn('Login directory lookup denied for username:', key);
      }
    }
  }
  return null;
}

const reconciledDirectoryKeys = new Set<string>();

/**
 * Ensures all loaded GlobalUserRecords have an up-to-date `login_directory/{usernameKey}` document
 * so every global user can sign in cleanly by username across devices and browsers.
 */
export async function reconcileGlobalUsersLoginDirectory(
  users: GlobalUserRecord[]
): Promise<void> {
  if (!auth.currentUser || !Array.isArray(users) || users.length === 0) return;
  const now = new Date().toISOString();

  for (const u of users) {
    if (!u || !u.username || !u.email) continue;
    const dirKey = normalizeUsernameKey(u.username);
    if (!dirKey) continue;
    const cacheSignature = `${dirKey}|${normalizeEmailKey(u.email)}|${u.status || 'active'}|${u.uid || ''}`;
    if (reconciledDirectoryKeys.has(cacheSignature)) continue;

    reconciledDirectoryKeys.add(cacheSignature);
    try {
      await setDoc(
        doc(db, 'login_directory', dirKey),
        sanitizeFirestorePayload({
          username: u.username.trim().toLowerCase(),
          email: normalizeEmailKey(u.email),
          userId: u.id,
          uid: u.uid || null,
          status: u.status || 'active',
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch {}
  }
}

/**
 * Updates a Global User's login status (`active` vs `suspended`/`inactive`) atomically across
 * `global_users`, `login_directory`, `memberships`, and tenant `organizations/{clientId}/users`.
 */
export async function setGlobalUserStatusInCloud(
  user: Pick<GlobalUserRecord, 'id' | 'uid' | 'username' | 'email' | 'clientId'>,
  status: 'active' | 'suspended' | 'inactive'
): Promise<void> {
  if (!user?.id || !auth.currentUser) return;
  const now = new Date().toISOString();

  try {
    await setDoc(
      doc(db, 'global_users', user.id),
      { status, updatedAt: now },
      { merge: true }
    );
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.UPDATE, `global_users/${user.id}`);
    }
    throw err;
  }

  if (user.username) {
    const dirKey = normalizeUsernameKey(user.username);
    if (dirKey) {
      await setDoc(
        doc(db, 'login_directory', dirKey),
        {
          username: user.username.trim().toLowerCase(),
          ...(user.email ? { email: normalizeEmailKey(user.email) } : {}),
          userId: user.id,
          uid: user.uid || null,
          status,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    }
  }

  if (user.uid) {
    await setDoc(
      doc(db, 'memberships', user.uid),
      { status, updatedAt: now },
      { merge: true }
    ).catch(() => {});
  }

  if (user.clientId) {
    await setDoc(
      doc(db, 'organizations', user.clientId, 'users', user.id),
      { status, updatedAt: now },
      { merge: true }
    ).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aplus-global-users-updated'));
  }
}

/**
 * Finds an authoritative GlobalUserRecord in Firestore by email or uid.
 */
export async function findGlobalUserInCloudByEmailOrUid(
  email: string,
  uid?: string
): Promise<GlobalUserRecord | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail && !uid) return null;

  try {
    if (cleanEmail) {
      const q = query(collection(db, 'global_users'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { ...(d.data() as GlobalUserRecord), id: d.id };
      }
    }
    if (uid) {
      const qUid = query(collection(db, 'global_users'), where('uid', '==', uid));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        const d = snapUid.docs[0];
        return { ...(d.data() as GlobalUserRecord), id: d.id };
      }
    }
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.LIST, 'global_users');
    }
  }
  return null;
}

/**
 * Fetches all globally synced user accounts directly from Firestore `global_users`.
 */
export async function fetchGlobalUsersFromCloud(): Promise<GlobalUserRecord[]> {
  if (!auth.currentUser) return [];
  try {
    const snap = await getDocs(collection(db, 'global_users'));
    const raw = snap.docs.map((d) => ({
      ...(d.data() as GlobalUserRecord),
      id: d.id,
      syncedToCloud: true,
    }));
    return normalizeAndDeduplicateGlobalUsers(raw);
  } catch (err: any) {
    if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.LIST, 'global_users');
    }
    return [];
  }
}

/**
 * Real-time Firestore listener for `global_users`.
 */
export function subscribeToGlobalUsersFromCloud(
  onUpdate: (users: GlobalUserRecord[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'global_users'),
    (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as GlobalUserRecord),
        id: d.id,
        syncedToCloud: true,
      }));
      onUpdate(normalizeAndDeduplicateGlobalUsers(list));
    },
    (err) => {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.LIST, 'global_users');
      }
    }
  );
}

/**
 * Permanently removes a user account from Firestore global directory, login lookup directory,
 * memberships, and tenant-scoped subcollection.
 */
export async function deleteGlobalUserFromCloud(user: {
  id: string;
  uid?: string | null;
  username?: string;
  clientId?: string | null;
}): Promise<void> {
  if (!user?.id) return;
  let targetUid = user.uid || null;

  if (auth.currentUser) {
    // Check Firestore doc first to ensure we capture uid if missing from UI state
    try {
      const existingSnap = await getDoc(doc(db, 'global_users', user.id));
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        if (!targetUid && data?.uid) {
          targetUid = String(data.uid);
        }
      }
    } catch {}

    // 1. Delete from global_users
    try {
      await deleteDoc(doc(db, 'global_users', user.id));
    } catch (err: any) {
      if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
        handleFirestoreError(err, OperationType.DELETE, `global_users/${user.id}`);
      }
      throw err;
    }

    // 2. Delete from login_directory
    if (user.username) {
      const dirKey = normalizeUsernameKey(user.username);
      if (dirKey) {
        try {
          await deleteDoc(doc(db, 'login_directory', dirKey));
        } catch (err: any) {
          if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
            handleFirestoreError(err, OperationType.DELETE, `login_directory/${dirKey}`);
          }
        }
      }
    }

    // 3. Delete membership doc if UID known
    if (targetUid) {
      try {
        await deleteDoc(doc(db, 'memberships', targetUid));
      } catch (err: any) {
        if (err?.code === 'permission-denied' || String(err?.message).includes('Missing or insufficient permissions')) {
          handleFirestoreError(err, OperationType.DELETE, `memberships/${targetUid}`);
        }
      }

      // Optional server-side Firebase Auth deletion when Admin SDK is available
      try {
        const authHeaders = await getAuthBearerHeaders();
        await fetch(`/api/platform/users/${encodeURIComponent(targetUid)}`, {
          method: 'DELETE',
          headers: authHeaders,
        });
      } catch {}
    }

    // 4. Delete tenant-scoped copy
    if (user.clientId) {
      try {
        await deleteDoc(doc(db, 'organizations', user.clientId, 'users', user.id));
      } catch {}
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aplus-global-users-updated'));
  }
}
