/**
 * Native IndexedDB Service for Recent Voucher & Transaction Searches
 * Persists user search queries, timestamp, query filters (campus, date, voucher type),
 * and query hit count with fast retrieval, deduplication, and removal.
 */

export interface RecentVoucherSearch {
  id: string;
  query: string;
  timestamp: string;
  resultCount?: number;
  campusId?: string;
  voucherType?: string;
  dateFilter?: string;
}

const DB_NAME = 'AplusVoucherSearchesDB_v1';
const DB_VERSION = 1;
const STORE_NAME = 'recent_voucher_searches';
const MAX_SEARCHES = 12;

function openSearchIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Save a search query to IndexedDB (with fallback to localStorage if IndexedDB is unavailable)
 */
export async function saveRecentVoucherSearch(search: Omit<RecentVoucherSearch, 'id' | 'timestamp'>): Promise<RecentVoucherSearch[]> {
  const cleanQuery = search.query?.trim();
  if (!cleanQuery) return await getRecentVoucherSearches();

  const id = `search-${cleanQuery.toLowerCase()}-${search.campusId || 'all'}-${search.voucherType || 'all'}`;
  const record: RecentVoucherSearch = {
    ...search,
    id,
    query: cleanQuery,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = await openSearchIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return await getRecentVoucherSearches();
    }
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('aplus_recent_voucher_searches');
    const list: RecentVoucherSearch[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((s) => s.id !== id);
    filtered.unshift(record);
    const capped = filtered.slice(0, MAX_SEARCHES);
    localStorage.setItem('aplus_recent_voucher_searches', JSON.stringify(capped));
    return capped;
  } catch {
    return [record];
  }
}

/**
 * Get all recent searches sorted newest first
 */
export async function getRecentVoucherSearches(): Promise<RecentVoucherSearch[]> {
  try {
    const db = await openSearchIndexedDB();
    if (db) {
      const records = await new Promise<RecentVoucherSearch[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      if (records && records.length > 0) {
        // Sort descending by timestamp
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return records.slice(0, MAX_SEARCHES);
      }
    }
  } catch (err) {
    console.warn('IndexedDB fetch error:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('aplus_recent_voucher_searches');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Remove a specific search query from IndexedDB
 */
export async function deleteRecentVoucherSearch(id: string): Promise<RecentVoucherSearch[]> {
  try {
    const db = await openSearchIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return await getRecentVoucherSearches();
    }
  } catch {}

  try {
    const raw = localStorage.getItem('aplus_recent_voucher_searches');
    const list: RecentVoucherSearch[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem('aplus_recent_voucher_searches', JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Clear all recent voucher searches
 */
export async function clearAllRecentVoucherSearches(): Promise<void> {
  try {
    const db = await openSearchIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {}

  try {
    localStorage.removeItem('aplus_recent_voucher_searches');
  } catch {}
}
