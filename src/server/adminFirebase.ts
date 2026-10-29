import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

function resolveProjectId(): string {
  const envVal = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envVal && envVal.length > 5 && envVal !== '12') return envVal;
  return firebaseConfig.projectId;
}

function resolveDatabaseId(): string {
  const envVal = process.env.FIRESTORE_DATABASE_ID?.trim();
  if (envVal && envVal.length > 5 && envVal !== '12') return envVal;
  return firebaseConfig.firestoreDatabaseId;
}

export function getAdminConfigStatus() {
  const projectId = resolveProjectId();
  const databaseId = resolveDatabaseId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const hasValidCert = Boolean(
    clientEmail &&
    clientEmail.includes('@') &&
    rawKey &&
    rawKey.includes('-----BEGIN')
  );

  return {
    projectId,
    databaseId,
    clientEmailConfigured: Boolean(clientEmail && clientEmail.includes('@')),
    privateKeyConfigured: Boolean(rawKey && rawKey.includes('-----BEGIN')),
    mode: hasValidCert ? 'service_account_cert' : 'application_default',
    recommendation: hasValidCert
      ? 'Firebase Admin SDK configured with dedicated service account credentials.'
      : 'Using Application Default Credentials (ADC). For external deployment (e.g., Vercel), provide FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
  };
}

export function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = resolveProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim()?.replace(/\\n/g, '\n');

  const hasValidCert = Boolean(
    clientEmail &&
    clientEmail.includes('@') &&
    rawKey &&
    rawKey.includes('-----BEGIN')
  );

  if (hasValidCert && clientEmail && rawKey) {
    try {
      return initializeApp({
        projectId,
        credential: cert({ projectId, clientEmail, privateKey: rawKey }),
      });
    } catch (e: any) {
      console.warn('Could not initialize Firebase Admin with provided cert, falling back to applicationDefault:', e?.message);
    }
  }

  return initializeApp({
    projectId,
    credential: applicationDefault(),
  });
}

export function adminDatabase() {
  return getFirestore(adminApp(), resolveDatabaseId());
}
