import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (Boolean(clientEmail) !== Boolean(privateKey)) throw new Error('Incomplete Firebase Admin configuration.');
  return initializeApp({
    projectId,
    credential: clientEmail && privateKey ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
  });
}
export function adminDatabase() {
  return getFirestore(adminApp(), process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId);
}
