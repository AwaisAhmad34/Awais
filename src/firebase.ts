import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  memoryLruGarbageCollector,
  setLogLevel,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence noisy internal Firestore WebChannel connection retry logs in iframe/proxy environments
try {
  setLogLevel('error');
} catch {}

// Preserve existing offline data. Cache repair must be explicit and backed up.

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb: Firestore;
export let indexedDbPersistenceStatus: 'active' | 'fallback' | 'memory' = 'memory';

try {
  // Use memoryLocalCache with LRU garbage collector.
  // This completely prevents IndexedDB cursor corruption and "prefixPath of null" crashes,
  // while retaining full real-time cloud sync with Firebase Firestore.
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: memoryLocalCache({
        garbageCollector: memoryLruGarbageCollector(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);

// Skill Directive: Test Firestore connectivity on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system_state', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
if (typeof window !== 'undefined') {
  testConnection();
}
