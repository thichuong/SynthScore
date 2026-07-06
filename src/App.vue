<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="logo-area">
        <div class="logo-icon-wrapper">
          <Music class="logo-icon animate-pulse" />
        </div>
        <div class="logo-text">
          <h1>SynthScore</h1>
          <p>Trình chơi nhạc tự động &amp; Xem bản nhạc tương tác cao cấp</p>
        </div>
      </div>

      <div class="header-controls">
        <!-- Thư viện bản nhạc -->
        <SongLibraryPicker 
          :playingIndex="selectedSongIndex" 
          :isLoading="isLoadingLibrarySong"
          :disabled="isLoadingSoundfont"
          @select="handleSongSelect"
        />

        <FileUploader @musicLoaded="handleMusicLoaded" />
      </div>

      <!-- Trạng thái Audio Engine -->
      <div class="engine-status">
        <span v-if="isLoadingSoundfont" class="status-badge loading">
          <span class="spinner"></span> Đang tải nhạc cụ...
        </span>
        <span v-else-if="!isInitialized" class="status-badge inactive" @click="initializeEngine">
          <Power class="status-icon" /> Nhấn để kích hoạt Audio
        </span>
        <span v-else class="status-badge active">
          <CheckCircle class="status-icon" /> Sẵn sàng (GM Synth)
        </span>
      </div>
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
        />
      </div>
    </main>

    <!-- Khung điều khiển phát nhạc ở đáy màn hình -->
    <footer class="app-footer">
      <PlaybackControls 
        :isPlaying="isPlaying"
        :isReady="isReady"
        :currentTime="currentTime"
        :duration="duration"
        :bpm="bpm"
        :songName="songName"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Music, Power, CheckCircle } from 'lucide-vue-next';
import FileUploader from './components/FileUploader.vue';
import OrchestraMixer from './components/OrchestraMixer.vue';
import SheetViewer from './components/SheetViewer.vue';
import PlaybackControls from './components/PlaybackControls.vue';
import SongLibraryPicker from './components/SongLibraryPicker.vue';

import { AudioEngine } from './services/audioEngine';
import type { TrackInfo } from './services/audioEngine';
import { parseMusicXmlToMidiBytes } from './services/musicXmlParser';
import { parseMxl } from './services/mxlParser';
import { getCachedMxl, cacheMxl } from './services/songCache';
import { songLibrary } from './data/songLibrary';
import type { SongEntry } from './data/songLibrary';
import abcjs from 'abcjs';

const isInitialized = ref(false);
const isReady = ref(false);
const isLoadingSoundfont = ref(false);
const isPlaying = ref(false);
const isLoadingLibrarySong = ref(false);

const currentTime = ref(0);
const duration = ref(0);
const bpm = ref(120);
const songName = ref('');
const tracks = ref<TrackInfo[]>([]);
const playbackMode = ref<'default' | 'symphony' | 'concerto'>('default');

const fileData = ref<Uint8Array | string | null>(null);
const fileType = ref<'xml' | 'abc' | 'midi' | null>(null);
const rawText = ref<string | null>(null);

const selectedSongIndex = ref(-1);

// Lắng nghe trạng thái thay đổi từ AudioEngine
onMounted(() => {
  AudioEngine.onStateChange(() => {
    isInitialized.value = AudioEngine.isInitialized;
    isReady.value = AudioEngine.isReady;
    isLoadingSoundfont.value = AudioEngine.isLoadingSoundfont;
    isPlaying.value = AudioEngine.isPlaying;
    duration.value = AudioEngine.duration;
    bpm.value = AudioEngine.bpm;
    songName.value = AudioEngine.currentSongName;
    tracks.value = [...AudioEngine.tracks];
    playbackMode.value = AudioEngine.playbackMode;
    if (AudioEngine.activeMidiBytes && fileData.value !== AudioEngine.activeMidiBytes) {
      fileData.value = AudioEngine.activeMidiBytes;
    }
  });

  AudioEngine.onTimeUpdate((time) => {
    currentTime.value = time;
  });
});

async function initializeEngine() {
  try {
    await AudioEngine.init();
  } catch (e) {
    console.error('Không thể kích hoạt Audio Engine:', e);
  }
}

async function handleModeChange(mode: 'default' | 'symphony' | 'concerto') {
  await AudioEngine.setPlaybackMode(mode);
}

// Xử lý nạp nhạc từ người dùng tải lên
async function handleMusicLoaded(payload: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string }) {
  // Đảm bảo AudioEngine đã được khởi tạo
  if (!isInitialized.value) {
    await initializeEngine();
  }

  let midiBytes: Uint8Array;
  
  if (payload.type === 'midi') {
    midiBytes = payload.data as Uint8Array;
    fileData.value = midiBytes;
    fileType.value = 'midi';
    rawText.value = null;
  } 
  else if (payload.type === 'xml') {
    const xmlText = payload.data as string;
    midiBytes = parseMusicXmlToMidiBytes(xmlText);
    fileData.value = midiBytes;
    fileType.value = 'xml';
    rawText.value = xmlText;
  } 
  else { // abc
    const abcText = payload.data as string;
    const midiBin = abcjs.synth.getMidiFile(abcText, { midiOutputType: 'binary' }) as any;
    midiBytes = new Uint8Array(midiBin);
    fileData.value = midiBytes;
    fileType.value = 'abc';
    rawText.value = abcText;
  }

  await AudioEngine.loadSong(midiBytes, payload.name);
}

// Xử lý chọn bản nhạc từ SongLibraryPicker
async function handleSongSelect(index: number) {
  selectedSongIndex.value = index;
  const song: SongEntry = songLibrary[index];
  await loadFromLibrary(song);
}

async function loadFromLibrary(song: SongEntry) {
  if (!isInitialized.value) {
    await initializeEngine();
  }

  isLoadingLibrarySong.value = true;

  try {
    let buffer: ArrayBuffer;

    // Kiểm tra cache trước
    const cached = await getCachedMxl(song.url);
    if (cached) {
      buffer = cached;
    } else {
      // Tải từ mạng và lưu cache
      const response = await fetch(song.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
      // Lưu vào IndexedDB để lần sau không cần tải lại
      await cacheMxl(song.url, buffer);
    }
    
    // Giải nén MXL → MusicXML text
    const xmlText = await parseMxl(buffer);

    // Chuyển đổi MusicXML → MIDI bytes
    const midiBytes = parseMusicXmlToMidiBytes(xmlText);

    const displayName = song.composer 
      ? `${song.composer} — ${song.name}` 
      : song.name;

    fileData.value = midiBytes;
    fileType.value = 'xml';
    rawText.value = xmlText;

    await AudioEngine.loadSong(midiBytes, displayName);
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

/* Header */
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
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #ff007f 0%, #7f00ff 100%);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(255, 0, 127, 0.3);
}

.logo-icon {
  width: 20px;
  height: 20px;
  color: #ffffff;
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


/* Engine Status */
.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 8px;
}

.status-badge.inactive {
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.2);
  color: #ffaa00;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-badge.inactive:hover {
  background: rgba(255, 170, 0, 0.15);
  box-shadow: 0 0 10px rgba(255, 170, 0, 0.2);
}

.status-badge.loading {
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.2);
  color: #00f0ff;
}

.status-badge.active {
  background: rgba(57, 255, 20, 0.1);
  border: 1px solid rgba(57, 255, 20, 0.2);
  color: #39ff14;
}

.status-icon {
  width: 14px;
  height: 14px;
}

.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

/* Dashboard Grid */
.dashboard-grid {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
  margin-bottom: 16px;
}

.dashboard-sidebar {
  width: 320px;
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

/* Footer Control */
.app-footer {
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Custom Scrollbars */
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
</style>
