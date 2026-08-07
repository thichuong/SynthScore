/**
 * Cache bản nhạc và SoundFonts đã tải về vào IndexedDB để tránh fetch lại từ mạng.
 * Dùng IndexedDB thay vì localStorage vì file âm thanh/nhạc có thể rất lớn (> 5MB limit).
 */

const DB_NAME = 'synthscore-cache';
const DB_VERSION = 5; // Tăng version lên 5 để ép trình duyệt tạo store uploaded-songs nếu chưa có
const STORE_SONGS = 'mxl-files';
const STORE_SOUNDFONTS = 'soundfonts';
const STORE_SETTINGS = 'user-settings';
const STORE_UPLOADED_SONGS = 'uploaded-songs';
const LOCAL_STORAGE_SETTINGS_KEY = 'synthscore_media_settings';

export interface UserMediaSettings {
  masterVolume: number;
  playbackRate: number;
  repeatMode: 'off' | 'all' | 'one';
}

export interface CachedUploadedSong {
  id: string;
  name: string;
  composer?: string;
  type: 'xml' | 'abc' | 'midi';
  data: Uint8Array | string;
  midiBytes: Uint8Array;
  rawText: string | null;
  createdAt: number;
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

      // Tạo store cho Bản nhạc Tải lên
      if (!db.objectStoreNames.contains(STORE_UPLOADED_SONGS)) {
        db.createObjectStore(STORE_UPLOADED_SONGS);
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
    if (!db.objectStoreNames.contains(storeName)) {
      return null;
    }
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
    if (!db.objectStoreNames.contains(storeName)) {
      console.error(`Store '${storeName}' không tồn tại trong IndexedDB synthscore-cache (v${db.version})`);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data, key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error(`Lỗi ghi dữ liệu vào store ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  } catch (e) {
    console.warn(`Không thể lưu cache trong store ${storeName}:`, key, e);
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

/**
 * Helper chuẩn hóa dữ liệu sang Uint8Array an toàn cho IndexedDB và Web Worker.
 */
export function ensureUint8Array(input: any): Uint8Array {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (typeof input === 'object') {
    if ('buffer' in input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, (input as any).byteOffset || 0, (input as any).byteLength || (input as any).length);
    }
    const values = Object.values(input);
    return new Uint8Array(values as number[]);
  }
  return new Uint8Array(0);
}

/**
 * Lưu bản nhạc người dùng tải lên vào IndexedDB.
 */
export async function saveUploadedSong(song: CachedUploadedSong): Promise<void> {
  const preparedSong: CachedUploadedSong = {
    ...song,
    midiBytes: ensureUint8Array(song.midiBytes),
    data: song.type === 'midi' ? ensureUint8Array(song.data) : song.data
  };
  return cacheData(STORE_UPLOADED_SONGS, preparedSong.id, preparedSong);
}

/**
 * Lấy tất cả các bản nhạc người dùng đã tải lên và lưu trữ trong IndexedDB.
 */
export async function getAllUploadedSongs(): Promise<CachedUploadedSong[]> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_UPLOADED_SONGS)) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_UPLOADED_SONGS, 'readonly');
      const store = tx.objectStore(STORE_UPLOADED_SONGS);
      const request = store.getAll();

      request.onsuccess = () => {
        const results: CachedUploadedSong[] = (request.result ?? []).map((item: any) => ({
          ...item,
          midiBytes: ensureUint8Array(item.midiBytes),
          data: item.type === 'midi' ? ensureUint8Array(item.data) : item.data
        }));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

/**
 * Xóa một bản nhạc đã tải lên khỏi IndexedDB.
 */
export async function deleteUploadedSong(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_UPLOADED_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_UPLOADED_SONGS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`Không thể xóa bản nhạc ${id} trong IndexedDB:`, e);
  }
}

