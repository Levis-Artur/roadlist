const DB_NAME = 'route-sheet-photo-db';
const STORE_NAME = 'odometer-photos';
const DB_VERSION = 1;

interface PhotoRecord {
  id: string;
  dataUrl: string;
  createdAt: string;
  expiresAt: string;
}

let databasePromise: Promise<IDBDatabase> | undefined;

export function initPhotoDb(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error('IndexedDB недоступна.'));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error('IndexedDB заблокована.'));
    };
  });
  return databasePromise;
}

function completeTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Помилка IndexedDB.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Операцію IndexedDB скасовано.'));
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не вдалося прочитати фото.'));
    reader.readAsDataURL(file);
  });
}

export async function savePhoto(fileOrDataUrl: File | string, expiresAt?: string): Promise<string> {
  const dataUrl = fileOrDataUrl instanceof File ? await fileToDataUrl(fileOrDataUrl) : fileOrDataUrl;
  const id = crypto.randomUUID();
  const database = await initPhotoDb();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const createdAt = new Date();
  const defaultExpiresAt = new Date(createdAt);
  defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 30);
  const record: PhotoRecord = {
    id,
    dataUrl,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt ?? defaultExpiresAt.toISOString(),
  };
  transaction.objectStore(STORE_NAME).put(record);
  await completeTransaction(transaction);
  return id;
}

export async function getPhoto(photoId: string): Promise<string | null> {
  const database = await initPhotoDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(photoId);
    request.onsuccess = () => resolve((request.result as PhotoRecord | undefined)?.dataUrl ?? null);
    request.onerror = () => reject(request.error ?? new Error('Не вдалося прочитати фото.'));
  });
}

export async function deletePhoto(photoId: string): Promise<void> {
  const database = await initPhotoDb();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).delete(photoId);
  await completeTransaction(transaction);
}

export async function clearPhotos(): Promise<void> {
  const database = await initPhotoDb();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).clear();
  await completeTransaction(transaction);
}

export async function deleteExpiredPhotos(now = new Date()): Promise<void> {
  const database = await initPhotoDb();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const photo = cursor.value as PhotoRecord;
    if (photo.expiresAt && new Date(photo.expiresAt).getTime() < now.getTime()) cursor.delete();
    cursor.continue();
  };
  await completeTransaction(transaction);
}
