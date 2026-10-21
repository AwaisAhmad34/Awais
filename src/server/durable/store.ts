import { adminDatabase } from '../adminFirebase';
import type { RecordData } from './policy';
export interface UnitOfWork {
  get(path: string): Promise<RecordData | null>;
  list(path: string): Promise<RecordData[]>;
  create(path: string, data: RecordData): void;
  set(path: string, data: RecordData): void;
}
export interface Store {
  transaction<T>(work: (tx: UnitOfWork) => Promise<T>): Promise<T>;
}
export const firestoreStore: Store = {
  transaction(work) {
    const db = adminDatabase();
    return db.runTransaction(async tx => work({
      async get(path) { const doc = await tx.get(db.doc(path)); return doc.exists ? { ...doc.data(), id: doc.id } : null; },
      async list(path) {
        // Explicit cap: reject oversize workspaces instead of silently truncating reports.
        const snapshot = await tx.get(db.collection(path).limit(5001));
        if (snapshot.size > 5000) throw Object.assign(new Error('Workspace needs paginated reporting/storage before exceeding 5000 records per collection.'), { status: 413, code: 'COLLECTION_LIMIT' });
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      },
      create(path, data) { tx.create(db.doc(path), data); },
      set(path, data) { tx.set(db.doc(path), data); },
    }));
  },
};
