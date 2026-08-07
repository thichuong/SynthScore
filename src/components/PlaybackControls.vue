<template>
  <div class="playback-controls glass-card">
    <!-- Hàng 1: Tiến độ và tua thời gian -->
    <ProgressBar 
      :currentTime="currentTime"
      :duration="duration"
      :isReady="isReady"
      @prev="emit('prev')"
      @next="emit('next')"
      @seek="handleSeek"
    />

    <!-- Hàng 2: Nút bấm và các thanh trượt -->
    <div class="controls-row">
      <!-- Cụm Nút Play/Pause/Stop/Repeat -->
      <div class="buttons-group">
        <button 
          class="play-btn" 
          :class="{ playing: isPlaying }"
          @click="togglePlay"
          :title="isPlaying ? 'Tạm dừng (Space / K)' : 'Phát nhạc (Space / K)'"
          :disabled="!isReady"
        >
          <Pause v-if="isPlaying" class="icon" />
          <Play v-else class="icon play-icon" />
        </button>
        
        <button 
          class="stop-btn" 
          @click="stopPlay" 
          title="Dừng phát (Shift+Space / S)"
          :disabled="!isReady"
        >
          <Square class="icon" />
        </button>

        <button 
          class="repeat-btn" 
          :class="{ active: repeatMode !== 'off', single: repeatMode === 'one' }"
          @click="emit('toggleRepeat')"
          :title="repeatMode === 'off' ? 'Chế độ Lặp lại: Tắt (Nhấn R để bật lặp danh sách)' : (repeatMode === 'all' ? 'Chế độ Lặp lại: Tất cả bài (Nhấn R để lặp 1 bài)' : 'Chế độ Lặp lại: 1 bài (Nhấn R để tắt lặp)')"
          :disabled="!isReady"
        >
          <Repeat1 v-if="repeatMode === 'one'" class="icon" />
          <Repeat v-else class="icon" />
          <span v-if="repeatMode === 'one'" class="repeat-badge">1</span>
        </button>
      </div>

      <!-- Tên bài nhạc hiện tại -->
      <div class="song-title-display">
        <Music class="title-icon" />
        <span class="title-text">{{ songName || 'Chưa nạp bài hát' }}</span>
      </div>

      <!-- Trực Quan Hóa Tần Số (Audio Spectrum) -->
      <AudioSpectrumCanvas />

      <!-- Điều khiển Tốc độ (Tempo) -->
      <div class="slider-control speed-control">
        <Gauge class="slider-icon" />
        <span class="slider-label">Tốc độ:</span>
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1" 
          v-model.number="localPlaybackRate" 
          @input="updatePlaybackRate"
          class="slider-input"
          title="Tăng/Giảm tốc độ phát (Phím [ và ])"
        />
        <span class="slider-value">{{ localPlaybackRate.toFixed(1) }}x ({{ Math.round(bpm * localPlaybackRate) }} BPM)</span>
      </div>

      <!-- Điều khiển Âm lượng tổng (Master Volume) -->
      <div class="slider-control volume-control">
        <button 
          class="volume-btn" 
          @click="toggleMute" 
          :title="localVolume === 0 ? 'Bật tiếng (Phím M)' : 'Tắt tiếng (Phím M)'"
        >
          <VolumeX v-if="localVolume === 0" class="slider-icon muted" />
          <Volume1 v-else-if="localVolume <= 50" class="slider-icon" />
          <Volume2 v-else class="slider-icon" />
        </button>
        <span class="slider-label">Âm lượng:</span>
        <input 
          type="range" 
          min="0" 
          max="150" 
          v-model.number="localVolume" 
          @input="updateVolume"
          class="slider-input"
          title="Âm lượng tổng (Phím Mũi tên Lên/Xuống, M để Mute)"
        />
        <span class="slider-value">{{ localVolume }}%</span>
      </div>

      <!-- Cụm tiện ích phụ & xuất âm thanh -->
      <div class="actions-control">
        <button 
          class="shortcuts-btn"
          @click="openShortcutsModal"
          title="Bảng hướng dẫn phím tắt (Phím ? hoặc H)"
        >
          <Keyboard class="action-btn-icon" />
          <span>Phím tắt</span>
        </button>

        <button 
          class="export-btn"
          @click="openExportModal"
          :disabled="!isReady || !songName"
          title="Xuất âm thanh (WAV, MP3, FLAC, ALAC, DSD)"
        >
          <Download class="export-btn-icon" />
          <span>Xuất âm thanh</span>
        </button>
      </div>
    </div>

    <!-- Modals -->
    <ExportAudioModal 
      :isOpen="isExportModalOpen" 
      :songName="songName" 
      @close="closeExportModal" 
    />
    
    <ShortcutsModal 
      :isOpen="isShortcutsModalOpen" 
      @close="closeShortcutsModal" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { 
  Play, Pause, Square, Volume2, Volume1, VolumeX, Gauge, Music, 
  Download, Repeat, Repeat1, Keyboard 
} from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import ProgressBar from './controls/ProgressBar.vue';
import AudioSpectrumCanvas from './controls/AudioSpectrumCanvas.vue';
import ExportAudioModal from './controls/ExportAudioModal.vue';
import ShortcutsModal from './controls/ShortcutsModal.vue';

const props = withDefaults(defineProps<{
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  songName: string;
  repeatMode?: 'off' | 'all' | 'one';
  volume?: number;
  playbackRate?: number;
}>(), {
  repeatMode: 'off',
  volume: 100,
  playbackRate: 1.0
});

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'toggleRepeat'): void;
}>();

const localPlaybackRate = ref(props.playbackRate);
const localVolume = ref(props.volume);
const isShortcutsModalOpen = ref(false);
const isExportModalOpen = ref(false);

watch(() => props.volume, (newVol) => {
  if (newVol !== undefined) {
    localVolume.value = newVol;
  }
}, { immediate: true });

watch(() => props.playbackRate, (newRate) => {
  if (newRate !== undefined) {
    localPlaybackRate.value = newRate;
  }
}, { immediate: true });

watch(() => props.songName, () => {
  localPlaybackRate.value = 1.0;
});

function openShortcutsModal() {
  isShortcutsModalOpen.value = true;
}

function closeShortcutsModal() {
  isShortcutsModalOpen.value = false;
}

function openExportModal() {
  isExportModalOpen.value = true;
}

function closeExportModal() {
  isExportModalOpen.value = false;
}

defineExpose({
  openShortcutsModal,
  closeShortcutsModal,
  toggleShortcutsModal: () => { isShortcutsModalOpen.value = !isShortcutsModalOpen.value; },
  openExportModal
});

function togglePlay() {
  if (props.isPlaying) {
    AudioEngine.pause();
  } else {
    AudioEngine.play();
  }
}

function stopPlay() {
  AudioEngine.stop();
}

function updatePlaybackRate() {
  AudioEngine.setPlaybackRate(localPlaybackRate.value);
}

function updateVolume() {
  AudioEngine.setMasterVolume(localVolume.value);
}

function toggleMute() {
  AudioEngine.toggleMute();
}

function handleSeek(targetSeconds: number) {
  AudioEngine.seek(targetSeconds);
}
</script>

<style scoped>
.playback-controls {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  background: rgba(18, 18, 24, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  gap: 12px;
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.buttons-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 240, 255, 0.35);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.play-btn:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 4px 20px rgba(0, 240, 255, 0.5);
}

.play-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  color: #606070;
  box-shadow: none;
  cursor: not-allowed;
}

.play-icon {
  transform: translateX(2px);
}

.stop-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0b0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-btn:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.1);
  border-color: rgba(255, 59, 48, 0.3);
  color: #ff3b30;
}

.stop-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon {
  width: 16px;
  height: 16px;
}

.repeat-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #8c8c9e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.repeat-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.repeat-btn.active {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.4);
  color: #00f0ff;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
}

.repeat-btn.single {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
  color: #c084fc;
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.3);
}

.repeat-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 0.55rem;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
  background: #a855f7;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-title-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 250px;
  min-width: 0;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.title-icon {
  width: 14px;
  height: 14px;
  color: #ff007f;
  flex-shrink: 0;
}

.title-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slider-control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.volume-btn {
  background: transparent;
  border: none;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.volume-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.slider-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
  transition: color 0.2s ease;
}

.slider-icon.muted {
  color: #ff4d4f;
}

.slider-label {
  font-size: 0.75rem;
  color: #a0a0b0;
  font-weight: 500;
}

.slider-input {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  outline: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00f0ff;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.4);
}

.slider-value {
  font-size: 0.75rem;
  color: #ffffff;
  font-weight: 600;
  width: 120px;
  white-space: nowrap;
  font-family: monospace;
}

.volume-control .slider-value {
  width: 40px;
}

.actions-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shortcuts-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.shortcuts-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.3);
  color: #00f0ff;
  transform: translateY(-1px);
}

.action-btn-icon {
  width: 15px;
  height: 15px;
}

.export-btn {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  color: #0b0b12;
  font-weight: 600;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.2);
}

.export-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 0 18px rgba(0, 240, 255, 0.45);
}

.export-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}

.export-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
  cursor: not-allowed;
}

.export-btn-icon {
  width: 14px;
  height: 14px;
}
</style>
