import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  enableIndexedDbPersistence,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence noisy internal Firestore WebChannel connection retry logs in iframe/proxy environments
try {
  setLogLevel('silent');
} catch {}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb: Firestore;
export let indexedDbPersistenceStatus: 'active' | 'fallback' = 'active';

try {
  // Primary: initialize Firestore with persistent IndexedDB cache & multi-tab synchronization
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  // Explicit enableIndexedDbPersistence fallback if Firestore instance was already created
  enableIndexedDbPersistence(firestoreDb).catch((err) => {
    if (err?.code === 'failed-precondition' || err?.code === 'unimplemented') {
      indexedDbPersistenceStatus = 'fallback';
    }
  });
}

export const db = firestoreDb;
export const auth = getAuth(app);
