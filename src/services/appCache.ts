/**
 * Cache bản nhạc và SoundFonts đã tải về vào IndexedDB để tránh fetch lại từ mạng.
 * Dùng IndexedDB thay vì localStorage vì file âm thanh/nhạc có thể rất lớn (> 5MB limit).
 */

const DB_NAME = 'synthscore-cache';
const DB_VERSION = 2; // Tăng version để thêm store mới cho Soundfonts
const STORE_SONGS = 'mxl-files';
const STORE_SOUNDFONTS = 'soundfonts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Tạo store cũ để đảm bảo tính tương thích ngược
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS);
      }
      
      // Tạo store mới cho SoundFonts
      if (!db.objectStoreNames.contains(STORE_SOUNDFONTS)) {
        db.createObjectStore(STORE_SOUNDFONTS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper lấy dữ liệu từ một store cụ thể.
 */
async function getCachedData(storeName: string, key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/**
 * Helper lưu dữ liệu vào một store cụ thể.
 */
async function cacheData(storeName: string, key: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    console.warn(`Không thể lưu cache trong store ${storeName}:`, key);
  }
}

/**
 * Lấy file bản nhạc đã cache từ IndexedDB.
 */
export async function getCachedSong(url: string): Promise<ArrayBuffer | null> {
  return getCachedData(STORE_SONGS, url);
}

/**
 * Lưu file bản nhạc vào IndexedDB cache.
 */
export async function cacheSong(url: string, data: ArrayBuffer): Promise<void> {
  return cacheData(STORE_SONGS, url, data);
}

/**
 * Lấy file Soundfont đã cache từ IndexedDB.
 */
export async function getCachedSoundfont(url: string): Promise<ArrayBuffer | null> {
  return getCachedData(STORE_SOUNDFONTS, url);
}

/**
 * Lưu file Soundfont vào IndexedDB cache.
 */
export async function cacheSoundfont(url: string, data: ArrayBuffer): Promise<void> {
  return cacheData(STORE_SOUNDFONTS, url, data);
}
