import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { profileFromMembership, resolveUserEmail } from './verifiedMembership';
export { resolveUserEmail } from './verifiedMembership';

let verifiedProfile: ReturnType<typeof profileFromMembership> | null = null;
let generation = 0;
let signingIn = false;
let listenerAttached = false;
const subscribers = new Set<(profile: typeof verifiedProfile) => void>();
export function getVerifiedProfile() { return verifiedProfile; }

function publish(profile: typeof verifiedProfile) {
  verifiedProfile = profile;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('ams_current_user_v5_clean');
    localStorage.removeItem('ams_impersonation_admin_v1');
    window.dispatchEvent(new Event(profile ? 'aplus-verified-login' : 'aplus-logout'));
  }
  subscribers.forEach(fn => fn(profile));
}

async function loadMembership(user: User, attempt: number) {
  const snapshot = await getDocFromServer(doc(db, 'memberships', user.uid));
  const profile = profileFromMembership(user.uid, user.email, snapshot.data());
  if (attempt !== generation || auth.currentUser?.uid !== user.uid) throw new Error('Sign-in was cancelled. Please try again.');
  publish(profile);
  return profile;
}

export async function authenticateAccount(emailOrUsername: string, password: string) {
  if (signingIn) throw new Error('A sign-in attempt is already in progress.');
  const email = resolveUserEmail(emailOrUsername);
  if (!email || !password.trim()) throw new Error('Enter your institutional account and password.');
  const attempt = ++generation;
  signingIn = true;
  publish(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        // One exact password attempt. Sign-in never registers accounts or grants roles.
        const credential = await signInWithEmailAndPassword(auth, email, password);
        if (attempt !== generation) {
          await signOut(auth);
          throw new Error('Sign-in was cancelled.');
        }
        return loadMembership(credential.user, attempt);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Sign-in timed out. Check your connection and try again.')), 20000);
      }),
    ]);
  } catch (error: any) {
    ++generation; // Late responses cannot restore a rejected attempt.
    publish(null);
    await signOut(auth).catch(() => {});
    if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email'].includes(error?.code)) throw new Error('The account or password is incorrect.');
    if (error?.code === 'auth/too-many-requests') throw new Error('Too many sign-in attempts. Please try again later.');
    if (error?.code === 'auth/network-request-failed') throw new Error('Unable to connect. Check your connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
    signingIn = false;
  }
}

// Import compatibility only. Privileged provisioning requires a trusted Admin SDK process.
export async function provisionInitialPlatformOwner(_email: string, _password: string, _name?: string): Promise<never> {
  throw new Error('Owner accounts must be provisioned through the trusted server setup.');
}
export async function logoutAccount() {
  ++generation;
  publish(null);
  await signOut(auth);
}
export async function restoreAccount(user: User) { return loadMembership(user, generation); }

export function initAuthListener(onProfileReady?: (profile: typeof verifiedProfile) => void) {
  if (onProfileReady) {
    subscribers.add(onProfileReady);
    onProfileReady(verifiedProfile);
  }
  if (!listenerAttached) {
    listenerAttached = true;
    onAuthStateChanged(auth, async user => {
      if (signingIn) return;
      const attempt = ++generation;
      if (!user) { publish(null); return; }
      try { await loadMembership(user, attempt); }
      catch {
        if (attempt !== generation) return;
        publish(null);
        await signOut(auth).catch(() => {});
      }
    });
  }
  return () => { if (onProfileReady) subscribers.delete(onProfileReady); };
}
