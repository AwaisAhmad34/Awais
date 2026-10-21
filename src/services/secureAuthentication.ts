import { signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

let verifiedProfile: any = null;
export function getVerifiedProfile() { return verifiedProfile; }

// Membership documents are writable only through a trusted administrator SDK.
export async function authenticateAccount(email: string, password: string) {
  verifiedProfile = null;
  if (!email.includes('@')) throw new Error('Use the email address provisioned in Firebase Authentication. Demo usernames are disabled.');
  try {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return await restoreAccount(credential.user);
  } catch (error: any) {
    await signOut(auth);
    if (error?.code?.startsWith('auth/')) throw new Error('Sign-in failed. Check your email, password and Firebase Authentication configuration.');
    throw error;
  }
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
      throw new Error('Your account is not active or has no approved membership. Contact the site owner.');
    }
    const roles: Record<string, string> = {
      level_1_platform_super_admin: 'super_admin',
      level_2_client_super_admin: 'level_2_client_super_admin',
      level_3_main_campus_admin: 'campus_admin',
      level_4_sub_campus_admin: 'campus_admin',
      level_5_departmental_staff: 'campus_accountant',
    };
    if (!roles[membership.permissionLevel] || (membership.permissionLevel !== 'level_1_platform_super_admin' && !membership.clientId)) {
      throw new Error('Account membership is incomplete. Contact the site owner.');
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
      allowedModules: membership.allowedModules || [],
      status: membership.status,
    };
    window.dispatchEvent(new Event('aplus-verified-login'));
    return verifiedProfile;
}
