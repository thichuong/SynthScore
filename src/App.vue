<template>
  <div class="app-container">
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
      <div class="engine-status">
        <span v-if="isLoadingSoundfont" class="status-badge loading">
          <span class="spinner"></span> Đang tải nhạc cụ...
        </span>
        <span v-else-if="initializationFailed" class="status-badge error clickable" @click="initializeEngine" title="Nhấp để thử khởi tạo lại Audio Engine">
          <AlertCircle class="status-icon" /> Lỗi âm thanh (Nhấp để thử lại)
        </span>
        <span v-else-if="!isInitialized" class="status-badge loading">
          <span class="spinner"></span> Đang khởi tạo...
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
          :isReady="isReady"
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
import { ref, shallowRef, onMounted, onBeforeUnmount, computed } from 'vue';
import { CheckCircle, AlertCircle } from 'lucide-vue-next';
import FileUploader from './components/FileUploader.vue';
import OrchestraMixer from './components/OrchestraMixer.vue';
import SheetViewer from './components/SheetViewer.vue';
import PlaybackControls from './components/PlaybackControls.vue';
import SongLibraryPicker from './components/SongLibraryPicker.vue';

import { AudioEngine } from './services/audioEngine';
import type { TrackInfo } from './services/midiGenerator';
import { parseMusicXmlToMidiBytes } from './services/musicXmlParser';
import { parseMxl } from './services/mxlParser';
import { getCachedSong, cacheSong } from './services/appCache';
import { songLibrary } from './data/songLibrary';
import type { SongEntry } from './data/songLibrary';

const isInitialized = ref(false);
const isReady = ref(false);
const isLoadingSoundfont = ref(false);
const isPlaying = ref(false);
const isLoadingLibrarySong = ref(false);
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

// Hiển thị Toast phản hồi phím tắt
const toastText = ref('');
const isToastVisible = ref(false);
let toastTimeout: any = null;
let lastMasterVolumeBeforeMute = 100;

function showShortcutToast(msg: string) {
  toastText.value = msg;
  isToastVisible.value = true;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    isToastVisible.value = false;
  }, 1500);
}

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

// Bắt phím tắt bàn phím toàn cục (Global Keyboard Shortcuts)
function handleGlobalKeydown(e: KeyboardEvent) {
  // Bỏ qua nếu đang gõ văn bản trong các ô input / textarea / select
  const activeEl = document.activeElement;
  const isInputActive = activeEl && (
    activeEl.tagName === 'INPUT' ||
    activeEl.tagName === 'TEXTAREA' ||
    activeEl.tagName === 'SELECT' ||
    (activeEl as HTMLElement).isContentEditable
  );

  if (isInputActive) {
    return;
  }

  const key = e.key;
  const code = e.code;
  const isShift = e.shiftKey;

  // 1. Play / Pause: Space or K or MediaPlayPause
  if ((code === 'Space' && !isShift) || key.toLowerCase() === 'k' || code === 'MediaPlayPause') {
    e.preventDefault();
    if (!isReady.value) return;
    if (isPlaying.value) {
      AudioEngine.pause();
      showShortcutToast('Tạm dừng phát');
    } else {
      AudioEngine.play();
      showShortcutToast('Đang phát nhạc');
    }
  }
  // 2. Stop: Shift + Space or S or MediaStop
  else if ((code === 'Space' && isShift) || key.toLowerCase() === 's' || code === 'MediaStop') {
    e.preventDefault();
    if (!isReady.value) return;
    AudioEngine.stop();
    showShortcutToast('Dừng phát nhạc');
  }
  // 3. Next song: N or Shift + ArrowRight or MediaTrackNext
  else if (key.toLowerCase() === 'n' || (code === 'ArrowRight' && isShift) || code === 'MediaTrackNext') {
    e.preventDefault();
    handleNextSong();
    showShortcutToast('Bài tiếp theo');
  }
  // 4. Previous song: P or Shift + ArrowLeft or MediaTrackPrevious
  else if (key.toLowerCase() === 'p' || (code === 'ArrowLeft' && isShift) || code === 'MediaTrackPrevious') {
    e.preventDefault();
    handlePrevSong();
    showShortcutToast('Bài trước đó');
  }
  // 5. Seek Forward (5s): ArrowRight or L or .
  else if ((code === 'ArrowRight' && !isShift) || key.toLowerCase() === 'l' || key === '.') {
    e.preventDefault();
    if (!isReady.value) return;
    const newTime = Math.min(duration.value, currentTime.value + 5);
    AudioEngine.seek(newTime);
    showShortcutToast('Tua +5s');
  }
  // 6. Seek Backward (5s): ArrowLeft or J or ,
  else if ((code === 'ArrowLeft' && !isShift) || key.toLowerCase() === 'j' || key === ',') {
    e.preventDefault();
    if (!isReady.value) return;
    const newTime = Math.max(0, currentTime.value - 5);
    AudioEngine.seek(newTime);
    showShortcutToast('Tua -5s');
  }
  // 7. Volume Up: ArrowUp
  else if (code === 'ArrowUp') {
    e.preventDefault();
    const newVol = Math.min(150, AudioEngine.masterVolume + 10);
    AudioEngine.setMasterVolume(newVol);
    showShortcutToast(`Âm lượng: ${newVol}%`);
  }
  // 8. Volume Down: ArrowDown
  else if (code === 'ArrowDown') {
    e.preventDefault();
    const newVol = Math.max(0, AudioEngine.masterVolume - 10);
    AudioEngine.setMasterVolume(newVol);
    showShortcutToast(`Âm lượng: ${newVol}%`);
  }
  // 9. Mute toggle: M
  else if (key.toLowerCase() === 'm') {
    e.preventDefault();
    if (AudioEngine.masterVolume > 0) {
      lastMasterVolumeBeforeMute = AudioEngine.masterVolume;
      AudioEngine.setMasterVolume(0);
      showShortcutToast('Đã tắt tiếng (Mute)');
    } else {
      const restoreVol = lastMasterVolumeBeforeMute || 80;
      AudioEngine.setMasterVolume(restoreVol);
      showShortcutToast(`Bật tiếng: ${restoreVol}%`);
    }
  }
  // 10. Speed Down: [
  else if (key === '[') {
    e.preventDefault();
    const newRate = Math.max(0.5, Math.round((AudioEngine.playbackRate - 0.1) * 10) / 10);
    AudioEngine.setPlaybackRate(newRate);
    showShortcutToast(`Tốc độ: ${newRate.toFixed(1)}x`);
  }
  // 11. Speed Up: ]
  else if (key === ']') {
    e.preventDefault();
    const newRate = Math.min(2.0, Math.round((AudioEngine.playbackRate + 0.1) * 10) / 10);
    AudioEngine.setPlaybackRate(newRate);
    showShortcutToast(`Tốc độ: ${newRate.toFixed(1)}x`);
  }
  // 12. Toggle Repeat mode: R
  else if (key.toLowerCase() === 'r') {
    e.preventDefault();
    toggleRepeatMode();
  }
  // 13. Toggle Shortcuts guide modal: ? or H
  else if (key === '?' || key.toLowerCase() === 'h') {
    e.preventDefault();
    playbackControlsRef.value?.toggleShortcutsModal();
  }
}

// Định danh bài hát duy nhất bằng khóa
function getSongKey(song: SongEntry): string {
  if (song.url) return song.url;
  return `uploaded_${song.composer || ''}_${song.name}`;
}

const searchQuery = ref('');
const activeFilter = ref<'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'>('tất cả');

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

// Danh sách bài hát (reactive) khởi tạo bằng các bài hát mặc định từ songLibrary
const songs = ref<SongEntry[]>(songLibrary.map(song => ({
  ...song,
  isFavorite: false
})));

const filteredSongs = computed<FilteredSong[]>(() => {
  const query = searchQuery.value.toLowerCase().trim();
  const results: FilteredSong[] = [];

  songs.value.forEach((song, idx) => {
    // 1. Lọc theo bộ lọc tab
    if (activeFilter.value === 'có sẵn') {
      if (!song.tags?.includes('có sẵn')) return;
    } else if (activeFilter.value === 'tải lên') {
      if (!song.tags?.includes('tải lên')) return;
    } else if (activeFilter.value === 'ưa thích') {
      if (!song.isFavorite) return;
    }

    // 2. Lọc theo tìm kiếm
    if (query) {
      const haystack = `${song.name} ${song.composer || ''}`.toLowerCase();
      if (!haystack.includes(query)) return;
    }

    results.push({ ...song, originalIndex: idx });
  });

  return results;
});

// Lắng nghe trạng thái thay đổi từ AudioEngine
onMounted(() => {
  // Tải danh sách ưa thích từ localStorage
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

  // Đăng ký nhận sự kiện chuyển bài từ Media Session API hoặc phím tắt
  AudioEngine.onPreviousTrack(() => handlePrevSong());
  AudioEngine.onNextTrack(() => handleNextSong());

  // Tự động chuyển bài khi kết thúc bài hát (xử lý theo repeatMode: 'one' | 'all' | 'off')
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

      // Nếu không bật lặp lại ('off') và đã đến bài cuối cùng trong danh sách -> Dừng phát
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

  // Đăng ký sự kiện bàn phím toàn cục
  window.addEventListener('keydown', handleGlobalKeydown);

  // Chủ động khởi tạo Audio Engine khi mount
  initializeEngine();

  // Tiền tải bộ âm thanh nhạc cụ Piano mặc định khi mount để tránh trễ âm thanh
  AudioEngine.preloadSoundfont(0).catch(e => {
    console.warn('Không thể tiền tải soundfont mặc định:', e);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
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

// Hàm trích xuất metadata (tên bài hát, tác giả) từ định dạng .xml hoặc .abc
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

// Xử lý nạp nhạc từ người dùng tải lên
async function handleMusicLoaded(payload: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string }) {
  // Đảm bảo AudioEngine đã được khởi tạo
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
  else { // abc
    const abcText = payload.data as string;
    const abcjs = await import('abcjs');
    const midiBin = abcjs.default.synth.getMidiFile(abcText, { midiOutputType: 'binary' }) as any;
    midiBytes = new Uint8Array(midiBin);
    rawTextValue = abcText;
  }

  // Trích xuất thông tin bài hát nếu có thể
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

  // Tạo một SongEntry mới có gắn thẻ "tải lên" và lưu dữ liệu tệp đã nạp
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

  // Thêm vào danh sách bài hát và tự động kích hoạt
  songs.value.push(newUploadedSong);
  const newIndex = songs.value.length - 1;
  
  await handleSongSelect(newIndex);
}

// Xử lý chọn bản nhạc từ SongLibraryPicker
async function handleSongSelect(index: number) {
  if (index < 0 || index >= songs.value.length) return;
  selectedSongIndex.value = index;
  const song: SongEntry = songs.value[index];

  if (song.isUploaded && song.uploadedData) {
    // Nếu là bài hát người dùng tải lên, dùng luôn dữ liệu đã lưu trong bộ nhớ
    fileData.value = song.uploadedData.midiBytes;
    fileType.value = song.uploadedData.type;
    rawText.value = song.uploadedData.rawText;
    await AudioEngine.loadSong(song.uploadedData.midiBytes, song.name, song.composer);
  } else {
    // Bài hát thư viện chuẩn thì tải từ mạng
    await loadFromLibrary(song);
  }
}

// Xử lý chuyển sang bài hát phía trước trong danh sách đã lọc
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

// Xử lý chuyển sang bài hát kế tiếp trong danh sách đã lọc
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

// Xử lý đánh dấu ưa thích
function toggleFavorite(originalIndex: number) {
  if (originalIndex < 0 || originalIndex >= songs.value.length) return;
  const song = songs.value[originalIndex];
  song.isFavorite = !song.isFavorite;

  // Cập nhật localStorage
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

  try {
    let buffer: ArrayBuffer;

    // Kiểm tra cache trước
    const cached = await getCachedSong(url);
    if (cached) {
      buffer = cached;
    } else {
      // Tải từ mạng và lưu cache
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      buffer = await response.arrayBuffer();
      // Lưu vào IndexedDB để lần sau không cần tải lại
      await cacheSong(url, buffer);
    }
    
    // Giải nén MXL → MusicXML text
    const xmlText = await parseMxl(buffer);

    // Chuyển đổi MusicXML → MIDI bytes
    const midiBytes = parseMusicXmlToMidiBytes(xmlText);

    fileData.value = midiBytes;
    fileType.value = 'xml';
    rawText.value = xmlText;

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

.status-badge.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.status-badge.clickable:hover {
  filter: brightness(1.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 59, 48, 0.2);
}

.status-badge.clickable:active {
  transform: translateY(0);
}

.status-badge.error {
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.2);
  color: #ff3b30;
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

/* Floating Shortcut Toast Notification */
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
</style>
