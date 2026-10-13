import { Campus } from '../core/aplusEngine';
import { db } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';

export interface CampusCredential {
  id: string; // matches campusId
  campusId: string;
  campusCode: string;
  campusName: string;
  city?: string;
  accountantName?: string;
  username: string; // e.g., 'campus.cvt' or 'cvt'
  password: string; // dynamic secure password
  role: 'campus_accountant' | 'campus_head';
  status: 'active' | 'suspended' | 'locked';
  allowedModules?: string[];
  dynamicToken?: string;
  lastLoginAt?: string | null;
  lastSyncedAt: string;
  generatedAt: string;
  syncedToDatabase: boolean;
  notes?: string;
}

const LOCAL_STORAGE_KEY = 'aplus_dynamic_campus_credentials_v1';
const SYNC_SUBSCRIBERS = new Set<(creds: CampusCredential[]) => void>();
let cachedCredentials: CampusCredential[] = [];
let firestoreListenerActive = false;

// Helpers to generate dynamic alphanumeric passwords
export function generateDynamicPassword(campusCode: string = 'AP'): string {
  const codePrefix = campusCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'CAMP';
  const symbols = ['@', '#', '$', '!', '&'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${codePrefix}${symbol}${randomNum}`;
}

export function generateDynamicUsername(campusCode: string): string {
  const cleanCode = campusCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `campus.${cleanCode}`;
}

export function generateDynamicAuthToken(campusId: string): string {
  return `tok_${campusId.slice(0, 6)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Local Storage Cache Management
export function getLocalStoredCampusCredentials(): CampusCredential[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveLocalStoredCampusCredentials(
  creds: CampusCredential[],
  notifySubscribers: boolean = true
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(creds));
    cachedCredentials = creds;
    if (notifySubscribers && SYNC_SUBSCRIBERS.size > 0) {
      // Defer subscriber invocation to the next tick so it never triggers during React render phase
      setTimeout(() => {
        SYNC_SUBSCRIBERS.forEach((cb) => {
          try {
            cb(creds);
          } catch (err) {
            console.warn('Error notifying campus credential subscriber:', err);
          }
        });
      }, 0);
    }
  } catch {}
}

/**
 * Generate a dynamic credential record for a given Campus
 */
export function createDynamicCampusCredential(
  campus: Campus,
  existingCred?: Partial<CampusCredential>,
  customPassword?: string
): CampusCredential {
  const username = existingCred?.username || generateDynamicUsername(campus.code);
  const password = customPassword || existingCred?.password || generateDynamicPassword(campus.code);
  const now = new Date().toISOString();

  return {
    id: campus.id,
    campusId: campus.id,
    campusCode: campus.code,
    campusName: campus.name,
    city: campus.city || 'Gujranwala',
    accountantName: campus.accountantName || `${campus.name} Accountant`,
    username,
    password,
    role: 'campus_accountant',
    status: campus.status === 'inactive' ? 'suspended' : 'active',
    allowedModules: campus.allowedModules || [
      'dashboard',
      'pettycash',
      'transaction',
      'alltransactions',
      'reports',
      'accounts',
      'reconciliation',
      'cashreconciliation',
      'activity',
      'docs',
    ],
    dynamicToken: existingCred?.dynamicToken || generateDynamicAuthToken(campus.id),
    lastLoginAt: existingCred?.lastLoginAt || null,
    lastSyncedAt: now,
    generatedAt: existingCred?.generatedAt || now,
    syncedToDatabase: true,
    notes: `Dynamically provisioned for ${campus.name} (${campus.code})`,
  };
}

/**
 * Ensure all campuses have dynamic credentials generated and cached
 */
export function ensureCredentialsForAllCampuses(
  campuses: Campus[],
  existingList: CampusCredential[] = []
): CampusCredential[] {
  const credMap = new Map<string, CampusCredential>();
  existingList.forEach((c) => credMap.set(c.campusId, c));

  const result: CampusCredential[] = [];
  campuses.forEach((camp) => {
    const existing = credMap.get(camp.id);
    if (existing) {
      result.push({
        ...existing,
        campusName: camp.name,
        campusCode: camp.code,
        city: camp.city || existing.city,
        accountantName: camp.accountantName || existing.accountantName,
      });
    } else {
      const newCred = createDynamicCampusCredential(camp);
      result.push(newCred);
    }
  });

  saveLocalStoredCampusCredentials(result, false);
  return result;
}

/**
 * Save a single campus credential to Firestore collection 'campus_credentials'
 */
export async function saveCampusCredentialToCloud(credential: CampusCredential): Promise<boolean> {
  try {
    const docRef = doc(db, 'campus_credentials', credential.id);
    await setDoc(
      docRef,
      {
        ...credential,
        syncedToDatabase: true,
        lastSyncedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Update local list
    const local = getLocalStoredCampusCredentials();
    const idx = local.findIndex((c) => c.id === credential.id);
    if (idx >= 0) {
      local[idx] = { ...credential, syncedToDatabase: true };
    } else {
      local.push({ ...credential, syncedToDatabase: true });
    }
    saveLocalStoredCampusCredentials(local);
    return true;
  } catch (err) {
    console.warn('Could not save campus credential to Firestore:', err);
    return false;
  }
}

/**
 * Batch synchronize all campus credentials to Firestore collection 'campus_credentials'
 */
export async function syncAllCampusCredentialsToCloud(
  credentials: CampusCredential[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    credentials.forEach((cred) => {
      const docRef = doc(db, 'campus_credentials', cred.id);
      batch.set(
        docRef,
        {
          ...cred,
          syncedToDatabase: true,
          lastSyncedAt: now,
        },
        { merge: true }
      );
    });

    await batch.commit();

    const updated = credentials.map((c) => ({
      ...c,
      syncedToDatabase: true,
      lastSyncedAt: now,
    }));
    saveLocalStoredCampusCredentials(updated);

    return { success: true, count: credentials.length };
  } catch (err: any) {
    console.warn('Error during batch sync of campus credentials to Firestore:', err);
    return { success: false, count: 0, error: err?.message || 'Failed to sync to database' };
  }
}

/**
 * Fetch all campus credentials directly from Firestore collection 'campus_credentials'
 */
export async function fetchCampusCredentialsFromCloud(): Promise<CampusCredential[]> {
  try {
    const snap = await getDocs(collection(db, 'campus_credentials'));
    if (!snap.empty) {
      const cloudCreds = snap.docs.map((d) => d.data() as CampusCredential);
      saveLocalStoredCampusCredentials(cloudCreds);
      return cloudCreds;
    }
  } catch (err) {
    console.warn('Could not fetch campus credentials from Firestore:', err);
  }
  return getLocalStoredCampusCredentials();
}

/**
 * Delete a campus credential document from Firestore
 */
export async function deleteCampusCredentialFromCloud(campusId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'campus_credentials', campusId));
    const local = getLocalStoredCampusCredentials().filter((c) => c.campusId !== campusId);
    saveLocalStoredCampusCredentials(local);
  } catch (err) {
    console.warn('Could not delete campus credential from Firestore:', err);
  }
}

/**
 * Real-time listener: Subscribes to changes in Firestore 'campus_credentials'
 */
export function subscribeToCloudCampusCredentials(
  callback: (credentials: CampusCredential[]) => void
): () => void {
  SYNC_SUBSCRIBERS.add(callback);

  // Send cached credentials asynchronously to prevent updating state during render
  const initial = getLocalStoredCampusCredentials();
  if (initial.length > 0) {
    setTimeout(() => {
      if (SYNC_SUBSCRIBERS.has(callback)) {
        callback(initial);
      }
    }, 0);
  }

  if (!firestoreListenerActive) {
    firestoreListenerActive = true;
    try {
      onSnapshot(
        collection(db, 'campus_credentials'),
        (snap) => {
          if (!snap.empty) {
            const list = snap.docs.map((d) => d.data() as CampusCredential);
            saveLocalStoredCampusCredentials(list);
          }
        },
        (error) => {
          console.warn('Firestore campus_credentials onSnapshot listener error:', error);
        }
      );
    } catch {}
  }

  return () => {
    SYNC_SUBSCRIBERS.delete(callback);
  };
}

/**
 * Dynamic Authentication Resolver:
 * Verifies username and password against dynamic database credentials.
 * Also checks live Firestore if offline/cache does not immediately match.
 */
export async function authenticateDynamicCampusLogin(params: {
  usernameOrCode: string;
  password?: string;
  credentialsList?: CampusCredential[];
  campuses: Campus[];
}): Promise<{
  success: boolean;
  message?: string;
  credential?: CampusCredential;
  campus?: Campus;
}> {
  const { usernameOrCode, password = '', campuses } = params;
  const rawInput = usernameOrCode.trim().toLowerCase();
  const inputPass = password.trim();

  // Step 1: Check local cached credentials first
  let creds = params.credentialsList && params.credentialsList.length > 0
    ? params.credentialsList
    : getLocalStoredCampusCredentials();

  let matched = creds.find(
    (c) =>
      c.username.toLowerCase() === rawInput ||
      c.campusCode.toLowerCase() === rawInput ||
      c.campusId.toLowerCase() === rawInput
  );

  // Step 2: If not found locally or password mismatch, query Firestore directly in real-time
  if (!matched || (inputPass && matched.password !== inputPass)) {
    try {
      const snap = await getDocs(collection(db, 'campus_credentials'));
      if (!snap.empty) {
        const cloudCreds = snap.docs.map((d) => d.data() as CampusCredential);
        saveLocalStoredCampusCredentials(cloudCreds);
        matched = cloudCreds.find(
          (c) =>
            c.username.toLowerCase() === rawInput ||
            c.campusCode.toLowerCase() === rawInput ||
            c.campusId.toLowerCase() === rawInput
        );
      }
    } catch {}
  }

  if (!matched) {
    return {
      success: false,
      message: `No dynamic campus credentials found matching identifier '${usernameOrCode}'. Contact Central Administration.`,
    };
  }

  if (matched.status === 'suspended' || matched.status === 'locked') {
    return {
      success: false,
      message: `Campus login access for ${matched.campusName} (${matched.campusCode}) is currently ${matched.status} by Super Administrator.`,
    };
  }

  // Password verification
  if (inputPass && matched.password !== inputPass) {
    return {
      success: false,
      message: 'Invalid password. Please check your dynamic campus credentials or request credentials re-sync.',
    };
  }

  const campus = campuses.find((c) => c.id === matched?.campusId);

  // Update last login timestamp in Firestore in the background
  const now = new Date().toISOString();
  saveCampusCredentialToCloud({ ...matched, lastLoginAt: now }).catch(() => {});

  return {
    success: true,
    credential: { ...matched, lastLoginAt: now },
    campus,
  };
}

/**
 * Synchronize dynamic credentials with the engine's in-memory `users` array
 * so the engine's built-in `login()` and RBAC recognizes all dynamic credentials.
 */
export function synchronizeCredentialsWithEngineUsers(params: {
  credentials: CampusCredential[];
  users: any[];
  addUser: (u: any) => any;
  updateUser: (id: string, updates: any) => void;
  resetUserPassword?: (userId: string, pass: string) => void;
}): void {
  const { credentials, users = [], addUser, updateUser, resetUserPassword } = params;
  if (!credentials || credentials.length === 0) return;

  // Defer execution outside React's render/reconciliation phase
  setTimeout(() => {
    try {
      credentials.forEach((cred) => {
        // Find user by campusId and role campus_accountant or username
        const existingUser = users.find(
          (u) =>
            (u.campusId === cred.campusId && u.role === 'campus_accountant') ||
            u.username?.toLowerCase() === cred.username.toLowerCase()
        );

        const targetName = cred.accountantName || `${cred.campusName} Accountant`;

        if (existingUser) {
          const needsUpdate =
            existingUser.username !== cred.username ||
            existingUser.password !== cred.password ||
            existingUser.status !== cred.status ||
            existingUser.name !== targetName;

          if (needsUpdate) {
            updateUser(existingUser.id, {
              username: cred.username,
              name: targetName,
              password: cred.password,
              status: cred.status,
              allowedModules: cred.allowedModules,
            });
            if (resetUserPassword && cred.password) {
              resetUserPassword(existingUser.id, cred.password);
            }
          }
        } else {
          addUser({
            id: `user-${cred.campusId}`,
            username: cred.username,
            name: targetName,
            email: `${cred.username}@aschoolsystem.edu.pk`,
            role: 'campus_accountant',
            campusId: cred.campusId,
            password: cred.password,
            status: cred.status,
            designation: `Campus Accountant (${cred.campusCode})`,
            allowedModules: cred.allowedModules,
          });
        }
      });
    } catch (err) {
      console.warn('Error synchronizing credentials with engine users:', err);
    }
  }, 0);
}
