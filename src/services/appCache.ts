/**
 * Cache bản nhạc và SoundFonts đã tải về vào IndexedDB để tránh fetch lại từ mạng.
 * Dùng IndexedDB thay vì localStorage vì file âm thanh/nhạc có thể rất lớn (> 5MB limit).
 */

const DB_NAME = 'synthscore-cache';
const DB_VERSION = 3; // Tăng version để thêm store mới cho User Settings
const STORE_SONGS = 'mxl-files';
const STORE_SOUNDFONTS = 'soundfonts';
const STORE_SETTINGS = 'user-settings';
const LOCAL_STORAGE_SETTINGS_KEY = 'synthscore_media_settings';

export interface UserMediaSettings {
  masterVolume: number;
  playbackRate: number;
  repeatMode: 'off' | 'all' | 'one';
}

const DEFAULT_SETTINGS: UserMediaSettings = {
  masterVolume: 100,
  playbackRate: 1.0,
  repeatMode: 'off'
};

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

      // Tạo store cho Cấu hình Người dùng
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Helper lấy dữ liệu từ một store cụ thể.
 */
async function getCachedData(storeName: string, key: string): Promise<any> {
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
async function cacheData(storeName: string, key: string, data: any): Promise<void> {
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

/**
 * Tải Cấu hình Media Người Dùng đã lưu (Volume, PlaybackRate, RepeatMode).
 * Kết hợp IndexedDB và LocalStorage làm fallback tốc độ cao.
 */
export async function loadUserSettings(): Promise<UserMediaSettings> {
  let settings = { ...DEFAULT_SETTINGS };

  // 1. Thử đọc nhanh từ localStorage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      settings = { ...settings, ...parsed };
    }
  } catch (e) {
    console.warn('Lỗi đọc settings từ localStorage:', e);
  }

  // 2. Thử đọc từ IndexedDB làm nơi lưu trữ chính
  try {
    const idbSettings = await getCachedData(STORE_SETTINGS, 'media_settings');
    if (idbSettings && typeof idbSettings === 'object') {
      settings = { ...settings, ...idbSettings };
    }
  } catch (e) {
    console.warn('Lỗi đọc settings từ IndexedDB:', e);
  }

  return settings;
}

/**
 * Lưu Cấu hình Media Người Dùng vào cả IndexedDB và LocalStorage.
 */
export async function saveUserSettings(newSettings: Partial<UserMediaSettings>): Promise<void> {
  try {
    const current = await loadUserSettings();
    const updated: UserMediaSettings = {
      ...current,
      ...newSettings
    };

    // Đăng ký lưu vào localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));
    } catch {}

    // Đăng ký lưu vào IndexedDB
    await cacheData(STORE_SETTINGS, 'media_settings', updated);
  } catch (e) {
    console.warn('Không thể lưu UserMediaSettings:', e);
  }
}
