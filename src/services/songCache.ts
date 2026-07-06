/**
 * Cache bản nhạc đã tải về vào IndexedDB để tránh fetch lại từ mạng.
 * Dùng IndexedDB thay vì localStorage vì file MXL có thể lớn (> 5MB limit của localStorage).
 */

const DB_NAME = 'synthscore-cache';
const DB_VERSION = 1;
const STORE_NAME = 'mxl-files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lấy file MXL đã cache từ IndexedDB.
 * @returns ArrayBuffer nếu đã cache, null nếu chưa có.
 */
export async function getCachedMxl(url: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Lưu file MXL vào IndexedDB cache.
 */
export async function cacheMxl(url: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(data, url);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Cache thất bại — bỏ qua, không ảnh hưởng hoạt động chính
    console.warn('Không thể lưu cache MXL:', url);
  }
}
