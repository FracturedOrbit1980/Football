/** Minimal promise wrapper over IndexedDB for the offline sync queue. */

const DB_NAME = "football-sync";
const VERSION = 1;
export const OUTBOX = "outbox";
export const META = "meta";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "key" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut<T extends { key: string }>(store: string, value: T) {
  const db = await open();
  await done(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open();
  return done(db.transaction(store, "readonly").objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function idbAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return done(db.transaction(store, "readonly").objectStore(store).getAll()) as Promise<T[]>;
}

export async function idbDelete(store: string, key: string) {
  const db = await open();
  await done(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

export async function idbClear() {
  const db = await open();
  await Promise.all([OUTBOX, META].map((store) => done(db.transaction(store, "readwrite").objectStore(store).clear())));
}
