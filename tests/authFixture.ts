export const auth: any = { currentUser: null };
export const db = {};
export const calls: any[] = [];
let membership: any;
let failure: any;
export function resetAuthFixture(value?: any, error?: any) { auth.currentUser=null; calls.length=0; membership=value; failure=error; }
export async function signInWithEmailAndPassword(_auth: any,email: string,password: string) {
  calls.push(['signIn',email,password]);
  if (failure) throw failure;
  const user={uid:'firebase-uid',email}; auth.currentUser=user; return {user};
}
export async function signOut() { calls.push(['signOut']); auth.currentUser=null; }
export function onAuthStateChanged() { return () => {}; }
export function doc(...path: any[]) { return path; }
export async function getDocFromServer() { calls.push(['membershipRead']); return {data:()=>membership}; }
