<template>
  <!-- Giao diện Mobile Web (1 màn hình duy nhất 100dvh) -->
  <div v-if="isMobile" class="mobile-app-shell">
    <!-- Phần 1: Header (Chọn nhạc & Xuất file) -->
    <MobileHeader
      :songs="songs"
      :filteredSongs="filteredSongs"
      :playingIndex="selectedSongIndex"
      :isLoading="isLoadingLibrarySong"
      :disabled="isLoadingSoundfont"
      v-model:searchQuery="searchQuery"
      v-model:activeFilter="activeFilter"
      :isInitialized="isInitialized"
      :isLoadingSoundfont="isLoadingSoundfont"
      :soundfontProgress="soundfontProgress"
      :initializationFailed="initializationFailed"
      :isReady="isReady"
      @selectSong="handleSongSelect"
      @toggleFavorite="toggleFavorite"
      @musicLoaded="handleMusicLoaded"
      @triggerExport="handleTriggerExport"
      @retryInit="initializeEngine"
    />

    <!-- Phần 2: Trình bài (Mixer, Thác nốt nhạc, Bản nhạc) -->
    <MobilePresentation
      :fileData="fileData"
      :fileType="fileType"
      :rawText="rawText"
      :isPlaying="isPlaying"
      :currentTime="currentTime"
      :isReady="isReady"
      :tracks="tracks"
      :playbackMode="playbackMode"
      :loading="isLoadingLibrarySong"
      :loadingProgress="songDownloadProgress"
      :fileSize="songFileSize"
      @changeMode="handleModeChange"
    />

    <!-- Phần 3: Controls (Play/Pause, Seekbar, Drawer mở rộng) -->
    <MobileControls
      :isPlaying="isPlaying"
      :isReady="isReady"
      :currentTime="currentTime"
      :duration="duration"
      :bpm="bpm"
      :songName="songName"
      :repeatMode="repeatMode"
      :volume="masterVolume"
      :playbackRate="playbackRate"
      @prev="handlePrevSong"
      @next="handleNextSong"
      @toggleRepeat="toggleRepeatMode"
    />

    <!-- PlaybackControls ẩn dùng để cung cấp Modal Export audio trên mobile -->
    <div style="display: none;">
      <PlaybackControls 
        ref="playbackControlsRef"
        :isPlaying="isPlaying"
        :isReady="isReady"
        :currentTime="currentTime"
        :duration="duration"
        :bpm="bpm"
        :songName="songName"
        :repeatMode="repeatMode"
        :volume="masterVolume"
        :playbackRate="playbackRate"
        @prev="handlePrevSong"
        @next="handleNextSong"
        @toggleRepeat="toggleRepeatMode"
      />
    </div>

    <!-- Floating Toast Notification khi bấm phím tắt -->
    <Transition name="toast-fade">
      <div v-if="isToastVisible" class="shortcut-toast-floating">
        {{ toastText }}
      </div>
    </Transition>
  </div>

  <!-- Giao diện Desktop -->
  <div v-else class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo-area">
        <div class="logo-icon-wrapper">
          <img src="./assets/logo.svg" alt="SynthScore" class="logo-icon animate-pulse" />
        </div>
        <div class="logo-text">
          <h1>SynthScore</h1>
          <p>Trình chơi nhạc tự động &amp; Xem bản nhạc tương tác cao cấp</p>
        </div>
      </div>

      <div class="header-controls">
        <!-- Thư viện bản nhạc -->
        <SongLibraryPicker 
          :songs="songs"
          :filteredSongs="filteredSongs"
          :playingIndex="selectedSongIndex" 
          :isLoading="isLoadingLibrarySong"
          :disabled="isLoadingSoundfont"
          v-model:searchQuery="searchQuery"
          v-model:activeFilter="activeFilter"
          @select="handleSongSelect"
          @toggle-favorite="toggleFavorite"
        />

        <FileUploader @musicLoaded="handleMusicLoaded" />
      </div>

      <!-- Trạng thái Audio Engine -->
      <EngineStatusBadge
        :isLoadingSoundfont="isLoadingSoundfont"
        :soundfontProgress="soundfontProgress"
        :initializationFailed="initializationFailed"
        :isInitialized="isInitialized"
        @retryInit="initializeEngine"
      />
    </header>

    <!-- Nội dung chính Dashboard -->
    <main class="dashboard-grid">
      <!-- Cột trái: Bàn trộn Mixer -->
      <div class="dashboard-sidebar">
        <OrchestraMixer 
          :tracks="tracks" 
          :currentMode="playbackMode"
          @changeMode="handleModeChange"
        />
      </div>

      <!-- Cột phải: Khung hiển thị bản nhạc (Sheet Viewer / Piano Roll) -->
      <div class="dashboard-content">
        <SheetViewer 
          :fileData="fileData"
          :fileType="fileType"
          :rawText="rawText"
          :isPlaying="isPlaying"
          :currentTime="currentTime"
          :isReady="isReady"
          :loading="isLoadingLibrarySong"
          :loadingProgress="songDownloadProgress"
          :fileSize="songFileSize"
        />
      </div>
    </main>

    <!-- Khung điều khiển phát nhạc ở đáy màn hình -->
    <footer class="app-footer">
      <PlaybackControls 
        ref="playbackControlsRef"
        :isPlaying="isPlaying"
        :isReady="isReady"
        :currentTime="currentTime"
        :duration="duration"
        :bpm="bpm"
        :songName="songName"
        :repeatMode="repeatMode"
        :volume="masterVolume"
        :playbackRate="playbackRate"
        @prev="handlePrevSong"
        @next="handleNextSong"
        @toggleRepeat="toggleRepeatMode"
      />
    </footer>

    <!-- Floating Toast Notification khi bấm phím tắt -->
    <Transition name="toast-fade">
      <div v-if="isToastVisible" class="shortcut-toast-floating">
        {{ toastText }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, computed } from 'vue';
import FileUploader from './components/FileUploader.vue';
import OrchestraMixer from './components/OrchestraMixer.vue';
import SheetViewer from './components/SheetViewer.vue';
import PlaybackControls from './components/PlaybackControls.vue';
import SongLibraryPicker from './components/SongLibraryPicker.vue';
import EngineStatusBadge from './components/header/EngineStatusBadge.vue';

import MobileHeader from './components/mobile/MobileHeader.vue';
import MobilePresentation from './components/mobile/MobilePresentation.vue';
import MobileControls from './components/mobile/MobileControls.vue';
import { useResponsive } from './composables/useResponsive';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';

import { AudioEngine, type SoundfontProgress } from './services/audioEngine';
import type { TrackInfo } from './services/midiGenerator';
import { parseMusicXmlToMidiBytes } from './services/musicXmlParser';
import { parseMxl } from './services/mxlParser';
import { getCachedSong, cacheSong, saveUploadedSong, getAllUploadedSongs, ensureUint8Array, type CachedUploadedSong } from './services/appCache';
import { songLibrary } from './data/songLibrary';
import type { SongEntry } from './data/songLibrary';

const { isMobile } = useResponsive();

function handleTriggerExport() {
  playbackControlsRef.value?.openExportModal();
}

const isInitialized = ref(false);
const isReady = ref(false);
const isLoadingSoundfont = ref(false);
const soundfontProgress = ref<SoundfontProgress | null>(null);
const isPlaying = ref(false);
const isLoadingLibrarySong = ref(false);
const songDownloadProgress = ref<number>(0);
const songFileSize = ref<number | string>(0);
const initializationFailed = ref(false);

const currentTime = ref(0);
const duration = ref(0);
const bpm = ref(120);
const songName = ref('');
const tracks = ref<TrackInfo[]>([]);
const playbackMode = ref<'default' | 'symphony' | 'concerto'>('default');
const repeatMode = ref<'off' | 'all' | 'one'>(AudioEngine.repeatMode);
const masterVolume = ref(AudioEngine.masterVolume);
const playbackRate = ref(AudioEngine.playbackRate);

const playbackControlsRef = ref<InstanceType<typeof PlaybackControls> | null>(null);

const fileData = shallowRef<Uint8Array | string | null>(null);
const fileType = ref<'xml' | 'abc' | 'midi' | null>(null);
const rawText = ref<string | null>(null);

const selectedSongIndex = ref(-1);

const { toastText, isToastVisible, showShortcutToast } = useKeyboardShortcuts({
  isReady,
  isPlaying,
  duration,
  currentTime,
  onNextSong: handleNextSong,
  onPrevSong: handlePrevSong,
  onToggleRepeat: toggleRepeatMode,
  onToggleShortcutsModal: () => playbackControlsRef.value?.toggleShortcutsModal()
});

function toggleRepeatMode() {
  const newMode = AudioEngine.toggleRepeatMode();
  repeatMode.value = newMode;
  const labels: Record<string, string> = {
    off: 'Chế độ Lặp lại: Tắt',
    all: 'Lặp lại toàn bộ danh sách',
    one: 'Lặp lại 1 bài hát'
  };
  showShortcutToast(labels[newMode]);
}

function getSongKey(song: SongEntry): string {
  if (song.url) return song.url;
  return `uploaded_${song.composer || ''}_${song.name}`;
}

const searchQuery = ref('');
const activeFilter = ref<'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'>('tất cả');

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

const songs = ref<SongEntry[]>(songLibrary.map(song => ({
  ...song,
  isFavorite: false
})));

const filteredSongs = computed<FilteredSong[]>(() => {
  const query = searchQuery.value.toLowerCase().trim();
  const results: FilteredSong[] = [];

  songs.value.forEach((song, idx) => {
    if (activeFilter.value === 'có sẵn') {
      if (!song.tags?.includes('có sẵn')) return;
    } else if (activeFilter.value === 'tải lên') {
      if (!song.tags?.includes('tải lên')) return;
    } else if (activeFilter.value === 'ưa thích') {
      if (!song.isFavorite) return;
    }

    if (query) {
      const haystack = `${song.name} ${song.composer || ''}`.toLowerCase();
      if (!haystack.includes(query)) return;
    }

    results.push({ ...song, originalIndex: idx });
  });

  return results;
});

onMounted(() => {
  try {
    const saved = localStorage.getItem('synthscore_favorites');
    if (saved) {
      const favoriteKeys = JSON.parse(saved);
      songs.value = songs.value.map(song => ({
        ...song,
        isFavorite: favoriteKeys.includes(getSongKey(song))
      }));
    }
  } catch (e) {
    console.error('Không thể đọc danh sách ưa thích từ localStorage:', e);
  }

  // Tải các bản nhạc người dùng đã tải lên trước đó từ IndexedDB
  getAllUploadedSongs().then(async cachedUploadedSongs => {
    if (cachedUploadedSongs && cachedUploadedSongs.length > 0) {
      let favoriteKeys: string[] = [];
      try {
        const saved = localStorage.getItem('synthscore_favorites');
        if (saved) favoriteKeys = JSON.parse(saved);
      } catch {}

      const existingKeys = new Set(songs.value.map(s => getSongKey(s)));
      const restoredEntries: SongEntry[] = [];

      for (const item of cachedUploadedSongs) {
        const midiBytes = ensureUint8Array(item.midiBytes);
        const data = item.type === 'midi' ? ensureUint8Array(item.data) : item.data;
        const songKey = `uploaded_${item.composer || ''}_${item.name}`;

        const entry: SongEntry = {
          name: item.name,
          composer: item.composer,
          tags: ['tải lên'],
          isUploaded: true,
          isFavorite: favoriteKeys.includes(songKey),
          uploadedData: {
            data,
            type: item.type,
            midiBytes,
            rawText: item.rawText
          }
        };

        if (!existingKeys.has(getSongKey(entry))) {
          restoredEntries.push(entry);
          existingKeys.add(getSongKey(entry));
        }
      }

      if (restoredEntries.length > 0) {
        songs.value.push(...restoredEntries);
      }
    }

    // Tự động chọn lại bản nhạc đã nghe lần gần nhất
    try {
      const lastSongKey = localStorage.getItem('synthscore_last_song');
      if (lastSongKey) {
        const targetIdx = songs.value.findIndex(s => getSongKey(s) === lastSongKey);
        if (targetIdx !== -1) {
          await handleSongSelect(targetIdx);
        }
      }
    } catch (e) {
      console.warn('Không thể khôi phục bản nhạc đã chọn trước đó:', e);
    }
  }).catch(e => {
    console.warn('Lỗi tải danh sách bản nhạc đã lưu từ IndexedDB:', e);
  });

  AudioEngine.onStateChange(() => {
    isInitialized.value = AudioEngine.isInitialized;
    isReady.value = AudioEngine.isReady;
    isLoadingSoundfont.value = AudioEngine.isLoadingSoundfont;
    soundfontProgress.value = AudioEngine.soundfontProgress ? { ...AudioEngine.soundfontProgress } : null;
    isPlaying.value = AudioEngine.isPlaying;
    duration.value = AudioEngine.duration;
    bpm.value = AudioEngine.bpm;
    songName.value = AudioEngine.currentSongName;
    tracks.value = [...AudioEngine.tracks];
    playbackMode.value = AudioEngine.playbackMode;
    repeatMode.value = AudioEngine.repeatMode;
    masterVolume.value = AudioEngine.masterVolume;
    playbackRate.value = AudioEngine.playbackRate;
    if (AudioEngine.activeMidiBytes && fileData.value !== AudioEngine.activeMidiBytes) {
      fileData.value = AudioEngine.activeMidiBytes;
    }
  });

  AudioEngine.onTimeUpdate((time) => {
    currentTime.value = time;
  });

  AudioEngine.onPreviousTrack(() => handlePrevSong());
  AudioEngine.onNextTrack(() => handleNextSong());

  AudioEngine.onSongEnded(async () => {
    if (repeatMode.value === 'one') {
      AudioEngine.seek(0);
      AudioEngine.play();
      return;
    }

    if (filteredSongs.value.length > 0) {
      const currentFilteredIdx = filteredSongs.value.findIndex(
        s => s.originalIndex === selectedSongIndex.value
      );

      if (repeatMode.value === 'off' && currentFilteredIdx === filteredSongs.value.length - 1) {
        AudioEngine.stop();
        return;
      }

      let nextFilteredIdx = 0;
      if (currentFilteredIdx !== -1) {
        nextFilteredIdx = (currentFilteredIdx + 1) % filteredSongs.value.length;
      }
      const nextSongOriginalIdx = filteredSongs.value[nextFilteredIdx].originalIndex;
      await handleSongSelect(nextSongOriginalIdx);
      AudioEngine.play();
    }
  });

  initializeEngine();

  AudioEngine.preloadAllSoundfonts().catch(e => {
    console.warn('Không thể tiền tải đầy đủ các soundfont:', e);
  });
});

async function initializeEngine() {
  try {
    initializationFailed.value = false;
    await AudioEngine.init();
  } catch (e) {
    console.error('Không thể kích hoạt Audio Engine:', e);
    initializationFailed.value = true;
  }
}

async function handleModeChange(mode: 'default' | 'symphony' | 'concerto') {
  await AudioEngine.setPlaybackMode(mode);
}

function extractMetadata(data: string, type: 'xml' | 'abc'): { name?: string; composer?: string } {
  const result: { name?: string; composer?: string } = {};
  
  if (type === 'xml') {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, 'text/xml');
      
      const titleNode = xmlDoc.getElementsByTagNameNS('*', 'work-title')[0] || 
                        xmlDoc.getElementsByTagNameNS('*', 'movement-title')[0];
      if (titleNode?.textContent) {
        result.name = titleNode.textContent.trim();
      }
      
      const creators = xmlDoc.getElementsByTagNameNS('*', 'creator');
      for (let i = 0; i < creators.length; i++) {
        const creator = creators[i];
        if (creator.getAttribute('type') === 'composer') {
          result.composer = creator.textContent?.trim();
          break;
        }
      }
      if (!result.composer && creators.length > 0) {
        result.composer = creators[0].textContent?.trim();
      }
    } catch (e) {
      console.warn('Không thể phân tích metadata từ MusicXML:', e);
    }
  } 
  else if (type === 'abc') {
    try {
      const lines = data.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('T:')) {
          result.name = trimmed.substring(2).trim();
        } else if (trimmed.startsWith('C:')) {
          result.composer = trimmed.substring(2).trim();
        }
      }
    } catch (e) {
      console.warn('Không thể phân tích metadata từ ABC:', e);
    }
  }
  
  return result;
}

async function handleMusicLoaded(payload: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string }) {
  if (!isInitialized.value) {
    await initializeEngine();
  }

  let midiBytes: Uint8Array;
  let rawTextValue: string | null = null;
  
  if (payload.type === 'midi') {
    midiBytes = payload.data as Uint8Array;
  } 
  else if (payload.type === 'xml') {
    const xmlText = payload.data as string;
    midiBytes = parseMusicXmlToMidiBytes(xmlText);
    rawTextValue = xmlText;
  } 
  else {
    const abcText = payload.data as string;
    const abcjs = await import('abcjs');
    const midiBin = abcjs.default.synth.getMidiFile(abcText, { midiOutputType: 'binary' }) as any;
    let raw = Array.isArray(midiBin) ? midiBin[0] : midiBin;
    if (typeof raw === 'string') {
      const buf = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i) & 0xff;
      midiBytes = buf;
    } else if (raw instanceof Uint8Array) {
      midiBytes = raw;
    } else if (raw && raw.buffer) {
      midiBytes = new Uint8Array(raw.buffer);
    } else {
      midiBytes = new Uint8Array(0);
    }
    rawTextValue = abcText;
  }

  let extractedName = payload.name.replace(/\.[^/.]+$/, "");
  let extractedComposer = 'Tải lên bởi bạn';

  if (payload.type === 'xml' || payload.type === 'abc') {
    const meta = extractMetadata(payload.data as string, payload.type);
    if (meta.name) {
      extractedName = meta.name;
    }
    if (meta.composer) {
      extractedComposer = meta.composer;
    }
  }

  const uploadedSongKey = `uploaded_${extractedComposer}_${extractedName}`;
  let isFav = false;
  try {
    const saved = localStorage.getItem('synthscore_favorites');
    if (saved) {
      isFav = JSON.parse(saved).includes(uploadedSongKey);
    }
  } catch {}

  const newUploadedSong: SongEntry = {
    name: extractedName,
    composer: extractedComposer,
    tags: ['tải lên'],
    isUploaded: true,
    isFavorite: isFav,
    uploadedData: {
      data: payload.data,
      type: payload.type,
      midiBytes,
      rawText: rawTextValue
    }
  };

  // Lưu bản nhạc vào IndexedDB để lần sau mở lên vẫn còn
  const uploadedSongId = `uploaded_${Date.now()}_${extractedName}`;
  const cachedItem: CachedUploadedSong = {
    id: uploadedSongId,
    name: extractedName,
    composer: extractedComposer,
    type: payload.type,
    data: payload.data,
    midiBytes,
    rawText: rawTextValue,
    createdAt: Date.now()
  };
  try {
    await saveUploadedSong(cachedItem);
    console.log('[IndexedDB] Đã lưu tệp tải lên thành công:', cachedItem.name);
  } catch (e) {
    console.error('Lỗi khi lưu bản nhạc tải lên vào IndexedDB:', e);
  }

  songs.value.push(newUploadedSong);
  const newIndex = songs.value.length - 1;
  
  await handleSongSelect(newIndex);
}

async function handleSongSelect(index: number) {
  if (index < 0 || index >= songs.value.length) return;
  selectedSongIndex.value = index;
  const song: SongEntry = songs.value[index];

  // Lưu bài hát được chọn gần nhất vào localStorage
  try {
    localStorage.setItem('synthscore_last_song', getSongKey(song));
  } catch (e) {
    console.warn('Không thể lưu last_song vào localStorage:', e);
  }

  if (song.isUploaded && song.uploadedData) {
    const midiBytes = ensureUint8Array(song.uploadedData.midiBytes);
    fileData.value = midiBytes;
    fileType.value = song.uploadedData.type;
    rawText.value = song.uploadedData.rawText;
    await AudioEngine.loadSong(midiBytes, song.name, song.composer);
  } else {
    await loadFromLibrary(song);
  }
}

async function handlePrevSong() {
  if (filteredSongs.value.length === 0) return;
  
  const currentFilteredIdx = filteredSongs.value.findIndex(
    s => s.originalIndex === selectedSongIndex.value
  );
  
  let prevFilteredIdx = filteredSongs.value.length - 1;
  if (currentFilteredIdx !== -1) {
    prevFilteredIdx = (currentFilteredIdx - 1 + filteredSongs.value.length) % filteredSongs.value.length;
  }
  
  const prevSongOriginalIdx = filteredSongs.value[prevFilteredIdx].originalIndex;
  const wasPlaying = isPlaying.value;
  await handleSongSelect(prevSongOriginalIdx);
  if (wasPlaying) {
    AudioEngine.play();
  }
}

async function handleNextSong() {
  if (filteredSongs.value.length === 0) return;
  
  const currentFilteredIdx = filteredSongs.value.findIndex(
    s => s.originalIndex === selectedSongIndex.value
  );
  
  let nextFilteredIdx = 0;
  if (currentFilteredIdx !== -1) {
    nextFilteredIdx = (currentFilteredIdx + 1) % filteredSongs.value.length;
  }
  
  const nextSongOriginalIdx = filteredSongs.value[nextFilteredIdx].originalIndex;
  const wasPlaying = isPlaying.value;
  await handleSongSelect(nextSongOriginalIdx);
  if (wasPlaying) {
    AudioEngine.play();
  }
}

function toggleFavorite(originalIndex: number) {
  if (originalIndex < 0 || originalIndex >= songs.value.length) return;
  const song = songs.value[originalIndex];
  song.isFavorite = !song.isFavorite;

  const favoriteKeys = songs.value
    .filter(s => s.isFavorite)
    .map(s => getSongKey(s));
  try {
    localStorage.setItem('synthscore_favorites', JSON.stringify(favoriteKeys));
  } catch (e) {
    console.error('Không thể ghi danh sách ưa thích vào localStorage:', e);
  }
}

async function loadFromLibrary(song: SongEntry) {
  if (!isInitialized.value) {
    await initializeEngine();
  }

  if (!song.url) {
    console.error('Không tìm thấy URL của bài hát từ thư viện:', song);
    return;
  }

  const url = song.url;
  isLoadingLibrarySong.value = true;
  songDownloadProgress.value = 10;
  songFileSize.value = 0;

  try {
    let buffer: ArrayBuffer;

    const cached = await getCachedSong(url);
    if (cached) {
      buffer = cached;
      songFileSize.value = cached.byteLength;
      songDownloadProgress.value = 100;
    } else {
      songDownloadProgress.value = 30;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      if (total > 0) songFileSize.value = total;

      if (response.body && total > 0) {
        const reader = response.body.getReader();
        let loaded = 0;
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.byteLength;
            songDownloadProgress.value = Math.min(95, Math.round(30 + (loaded / total) * 65));
          }
        }
        const concatenated = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
          concatenated.set(chunk, offset);
          offset += chunk.byteLength;
        }
        buffer = concatenated.buffer;
      } else {
        buffer = await response.arrayBuffer();
        songFileSize.value = buffer.byteLength;
      }
      songDownloadProgress.value = 100;
      await cacheSong(url, buffer);
    }
    
    const lowerUrl = url.toLowerCase();
    let midiBytes: Uint8Array;
    let type: 'xml' | 'abc' | 'midi' = 'xml';
    let text: string | null = null;

    if (lowerUrl.endsWith('.mid') || lowerUrl.endsWith('.midi')) {
      type = 'midi';
      midiBytes = new Uint8Array(buffer);
    } else if (lowerUrl.endsWith('.abc')) {
      type = 'abc';
      text = new TextDecoder('utf-8').decode(buffer);
      const abcjs = await import('abcjs');
      const midiBin = abcjs.default.synth.getMidiFile(text, { midiOutputType: 'binary' }) as any;
      let raw = Array.isArray(midiBin) ? midiBin[0] : midiBin;
      if (typeof raw === 'string') {
        const buf = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i) & 0xff;
        midiBytes = buf;
      } else if (raw instanceof Uint8Array) {
        midiBytes = raw;
      } else if (raw && raw.buffer) {
        midiBytes = new Uint8Array(raw.buffer);
      } else {
        midiBytes = new Uint8Array(0);
      }
    } else if (lowerUrl.endsWith('.xml') || lowerUrl.endsWith('.musicxml')) {
      type = 'xml';
      text = new TextDecoder('utf-8').decode(buffer);
      midiBytes = parseMusicXmlToMidiBytes(text);
    } else {
      type = 'xml';
      text = await parseMxl(buffer);
      midiBytes = parseMusicXmlToMidiBytes(text);
    }

    fileData.value = midiBytes;
    fileType.value = type;
    rawText.value = text;

    await AudioEngine.loadSong(midiBytes, song.name, song.composer);
  } catch (error) {
    console.error('Lỗi khi nạp bản nhạc từ thư viện:', error);
  } finally {
    isLoadingLibrarySong.value = false;
  }
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  box-sizing: border-box;
  background: radial-gradient(circle at top right, #1d1b26, #09090e 60%);
  color: #f1f1f7;
  overflow: hidden;
  font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  background: rgba(18, 18, 24, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 24px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 100;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.logo-icon {
  width: 38px;
  height: 38px;
  object-fit: contain;
}

.logo-text h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  background: linear-gradient(90deg, #ffffff 30%, #a0a0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.5px;
}

.logo-text p {
  margin: 2px 0 0 0;
  font-size: 0.7rem;
  color: #8c8c9e;
  font-weight: 500;
}

.dashboard-grid {
  flex: 1;
  display: flex;
  gap: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.dashboard-sidebar {
  width: 420px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.dashboard-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-footer {
  flex-shrink: 0;
}

.dashboard-sidebar::-webkit-scrollbar {
  width: 4px;
}

.dashboard-sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.dashboard-sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.dashboard-sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.shortcut-toast-floating {
  position: fixed;
  bottom: 95px;
  right: 28px;
  background: rgba(15, 23, 42, 0.92);
  color: #00f0ff;
  border: 1px solid rgba(0, 240, 255, 0.35);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 240, 255, 0.25);
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 700;
  z-index: 1200;
  backdrop-filter: blur(12px);
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 0.3px;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}

.mobile-app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  background-color: #09090e;
  box-sizing: border-box;
}
</style>
