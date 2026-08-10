<template>
  <div class="mobile-controls-wrapper">
    <!-- Main Footer Control Bar (Single Screen Bottom Bar) -->
    <div class="mobile-controls-bar">
      <!-- Row 1: Timeline Seek Bar & Time Labels -->
      <div class="mobile-seekbar-row">
        <span class="m-time">{{ formatTime(currentTime) }}</span>
        <input 
          type="range"
          min="0"
          :max="duration || 100"
          step="0.1"
          :value="currentTime"
          @input="handleSeek"
          class="m-seekbar"
          :disabled="!isReady"
        />
        <span class="m-time">{{ formatTime(duration) }}</span>
      </div>

      <!-- Row 2: Song Info, Main Buttons, More Drawer Button -->
      <div class="mobile-main-row">
        <!-- Song title preview -->
        <div class="m-song-info" @click="isDrawerOpen = true">
          <Music class="m-song-icon" />
          <span class="m-song-title">{{ songName || 'Chưa nạp bản nhạc' }}</span>
        </div>

        <!-- Center Buttons: Prev, Play/Pause, Next -->
        <div class="m-playback-buttons">
          <button class="m-btn m-prev" @click="$emit('prev')" :disabled="!isReady">
            <SkipBack class="m-icon" />
          </button>

          <button 
            class="m-btn m-play" 
            :class="{ playing: isPlaying }"
            @click="togglePlay"
            :disabled="!isReady"
          >
            <Pause v-if="isPlaying" class="m-play-icon" />
            <Play v-else class="m-play-icon" />
          </button>

          <button class="m-btn m-next" @click="$emit('next')" :disabled="!isReady">
            <SkipForward class="m-icon" />
          </button>
        </div>

        <!-- Right Side: Expand Drawer Button -->
        <button 
          class="m-btn m-more-btn"
          :class="{ active: isDrawerOpen }"
          @click="isDrawerOpen = !isDrawerOpen"
          title="Tùy chọn mở rộng"
        >
          <SlidersHorizontal class="m-icon" />
        </button>
      </div>
    </div>

    <!-- Bottom Sheet Drawer (Options & Expanded Settings) -->
    <Transition name="slide-up">
      <div v-if="isDrawerOpen" class="mobile-drawer-overlay" @click.self="isDrawerOpen = false">
        <div class="mobile-drawer-content glass-card">
          <!-- Drawer Header -->
          <div class="drawer-header">
            <div class="drawer-title">
              <SlidersHorizontal class="drawer-title-icon" />
              <span>Tùy chọn nâng cao</span>
            </div>
            <button class="drawer-close-btn" @click="isDrawerOpen = false">
              <X class="close-icon" />
            </button>
          </div>

          <!-- Drawer Body -->
          <div class="drawer-body">
            <!-- Master Volume Control -->
            <div class="drawer-item">
              <div class="item-label">
                <button class="mute-btn" @click="toggleMute">
                  <VolumeX v-if="localVolume === 0" class="item-icon muted" />
                  <Volume2 v-else class="item-icon" />
                </button>
                <span>Âm lượng master: {{ localVolume }}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="150"
                v-model.number="localVolume"
                @input="updateVolume"
                class="drawer-range"
              />
            </div>

            <!-- Speed / Tempo Control -->
            <div class="drawer-item">
              <div class="item-label">
                <Gauge class="item-icon" />
                <span>Tốc độ: {{ localPlaybackRate.toFixed(1) }}x ({{ Math.round(bpm * localPlaybackRate) }} BPM)</span>
              </div>
              <input 
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                v-model.number="localPlaybackRate"
                @input="updatePlaybackRate"
                class="drawer-range"
              />
            </div>

            <!-- Action Buttons: Export & Shortcuts -->
            <div class="drawer-row-btns">
              <button 
                class="drawer-action-btn export-btn-m"
                @click="openExportModal"
                :disabled="!isReady || !songName"
              >
                <Download class="btn-icon" />
                <span>Xuất âm thanh</span>
              </button>

              <button 
                class="drawer-action-btn"
                @click="openShortcutsModal"
              >
                <Keyboard class="btn-icon" />
                <span>Phím tắt</span>
              </button>
            </div>

            <!-- Repeat Mode & Stop -->
            <div class="drawer-row-btns">
              <button 
                class="drawer-action-btn"
                :class="{ active: repeatMode !== 'off' }"
                @click="$emit('toggleRepeat')"
              >
                <Repeat1 v-if="repeatMode === 'one'" class="btn-icon" />
                <Repeat v-else class="btn-icon" />
                <span>Lặp lại: {{ repeatModeLabel }}</span>
              </button>

              <button class="drawer-action-btn stop-btn" @click="handleStop">
                <Square class="btn-icon" />
                <span>Dừng nhạc</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

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
import { ref, computed, watch } from 'vue';
import { 
  Play, Pause, SkipBack, SkipForward, Square, 
  Repeat, Repeat1, Volume2, VolumeX, Gauge, 
  SlidersHorizontal, Music, X, Download, Keyboard
} from 'lucide-vue-next';
import { AudioEngine } from '../../services/audioEngine';
import ExportAudioModal from '../../components/controls/ExportAudioModal.vue';
import ShortcutsModal from '../../components/controls/ShortcutsModal.vue';

const props = defineProps<{
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  songName: string;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  playbackRate: number;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'toggleRepeat'): void;
}>();

const isDrawerOpen = ref(false);
const localVolume = ref(props.volume);
const localPlaybackRate = ref(props.playbackRate);
const isExportModalOpen = ref(false);
const isShortcutsModalOpen = ref(false);

watch(() => props.volume, (val) => localVolume.value = val);
watch(() => props.playbackRate, (val) => localPlaybackRate.value = val);

const repeatModeLabel = computed(() => {
  if (props.repeatMode === 'one') return '1 bài';
  if (props.repeatMode === 'all') return 'Tất cả';
  return 'Tắt';
});

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function handleSeek(e: Event) {
  const target = e.target as HTMLInputElement;
  const val = parseFloat(target.value);
  AudioEngine.seek(val);
}

function togglePlay() {
  if (!props.isReady) return;
  if (props.isPlaying) {
    AudioEngine.pause();
  } else {
    AudioEngine.play();
  }
}

function handleStop() {
  AudioEngine.stop();
  isDrawerOpen.value = false;
}

function updateVolume() {
  AudioEngine.setMasterVolume(localVolume.value);
}

function toggleMute() {
  const newVol = AudioEngine.toggleMute();
  localVolume.value = newVol;
}

function updatePlaybackRate() {
  AudioEngine.setPlaybackRate(localPlaybackRate.value);
}

function openExportModal() {
  isExportModalOpen.value = true;
}

function closeExportModal() {
  isExportModalOpen.value = false;
}

function openShortcutsModal() {
  isShortcutsModalOpen.value = true;
}

function closeShortcutsModal() {
  isShortcutsModalOpen.value = false;
}

defineExpose({
  openExportModal,
  closeExportModal,
  openShortcutsModal,
  closeShortcutsModal,
  toggleShortcutsModal: () => { isShortcutsModalOpen.value = !isShortcutsModalOpen.value; }
});
</script>

<style scoped>
.mobile-controls-wrapper {
  position: relative;
  z-index: 30;
  width: 100%;
  flex-shrink: 0;
}

.mobile-controls-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 10px 12px;
  background: rgba(18, 18, 26, 0.95);
  backdrop-filter: blur(16px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
}

.mobile-seekbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.m-time {
  font-size: 0.75rem;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.6);
  min-width: 32px;
}

.m-seekbar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  accent-color: #00f0ff;
  cursor: pointer;
}

.mobile-main-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
}

.m-song-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.m-song-icon {
  width: 16px;
  height: 16px;
  color: #00f0ff;
  flex-shrink: 0;
}

.m-song-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-playback-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.m-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.m-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.m-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.m-prev, .m-next {
  width: 34px;
  height: 34px;
}

.m-play {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #00f0ff 0%, #7000ff 100%);
  box-shadow: 0 0 14px rgba(0, 240, 255, 0.4);
}

.m-play.playing {
  background: linear-gradient(135deg, #ff0077 0%, #7000ff 100%);
  box-shadow: 0 0 14px rgba(255, 0, 119, 0.4);
}

.m-icon {
  width: 16px;
  height: 16px;
}

.m-play-icon {
  width: 20px;
  height: 20px;
  fill: #ffffff;
  color: #ffffff;
}

.m-more-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.m-more-btn.active {
  background: rgba(0, 240, 255, 0.2);
  border: 1px solid rgba(0, 240, 255, 0.4);
  color: #00f0ff;
}

/* Drawer Bottom Sheet overlay */
.mobile-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.mobile-drawer-content {
  width: 100%;
  max-height: 70vh;
  border-radius: 20px 20px 0 0;
  background: rgba(22, 22, 32, 0.95);
  border-top: 1px solid rgba(0, 240, 255, 0.3);
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 10px;
}

.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  color: #00f0ff;
}

.drawer-title-icon {
  width: 18px;
  height: 18px;
}

.drawer-close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.close-icon {
  width: 20px;
  height: 20px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.drawer-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
}

.item-icon {
  width: 16px;
  height: 16px;
  color: #00f0ff;
}

.mute-btn {
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}

.drawer-range {
  width: 100%;
  accent-color: #00f0ff;
}

.drawer-row-btns {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.drawer-action-btn.export-btn-m {
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 114, 255, 0.2) 100%);
  border-color: rgba(0, 240, 255, 0.4);
  color: #00f0ff;
}

.drawer-action-btn.active {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.4);
  color: #00f0ff;
}

.drawer-action-btn.stop-btn {
  background: rgba(255, 50, 50, 0.15);
  border-color: rgba(255, 50, 50, 0.3);
  color: #ff4d4d;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

/* Animations */
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
}

.slide-up-enter-from, .slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
