<template>
  <div class="sheet-viewer glass-card">
    <div class="viewer-body" @click="togglePlay">
      <!-- Container hiển thị Sheet Music (MusicXML) -->
      <div 
        v-show="fileType === 'xml'" 
        ref="osmdContainer" 
        class="osmd-container"
      ></div>

      <!-- Container hiển thị ABC Notation -->
      <div 
        v-show="fileType === 'abc'" 
        id="abc-container" 
        class="abc-container"
      ></div>
    </div>

    <!-- Overlay Icon Phát/Tạm Dừng khi click màn hình -->
    <Transition name="fade-scale">
      <div v-if="overlayIcon" class="click-feedback-overlay">
        <div class="feedback-icon-circle">
          <Play v-if="overlayIcon === 'play'" class="feedback-icon play-icon" />
          <Pause v-else class="feedback-icon" />
        </div>
      </div>
    </Transition>

    <!-- Overlay Đang Tải Bản Nhạc (Hiển thị to rõ ở ngoài với tiến độ & dung lượng) -->
    <Transition name="fade">
      <div v-if="isLoading" class="sheet-loading-overlay">
        <div class="loading-card glass-panel">
          <div class="spinner-container">
            <div class="spinner-outer"></div>
            <div class="spinner-inner"></div>
            <Music class="loading-music-icon" />
          </div>

          <div class="loading-content">
            <span class="loading-title">Đang tải bản nhạc...</span>
            <div class="loading-meta" v-if="computedFileSize">
              <HardDrive class="meta-icon" />
              <span class="file-size-badge">Dung lượng: {{ computedFileSize }}</span>
            </div>
          </div>

          <!-- Thanh tiến độ tải -->
          <div class="progress-section">
            <div class="progress-info">
              <span class="progress-status-text">Tiến độ nạp dữ liệu</span>
              <span class="progress-percent">{{ displayProgress }}%</span>
            </div>
            <div class="progress-bar-track">
              <div 
                class="progress-bar-fill"
                :style="{ width: `${displayProgress}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Play, Pause, Music, HardDrive } from 'lucide-vue-next';
import { isMobileDevice } from '../../composables/useResponsive';
import { AudioEngine } from '../../services/audioEngine';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  isPlaying: boolean;
  currentTime: number;
  isReady: boolean;
  activeTab?: 'sheet' | 'visualizer';
  loading?: boolean;
  loadingProgress?: number;
  fileSize?: number | string;
}>();

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const computedFileSize = computed<string>(() => {
  if (props.fileSize !== undefined && props.fileSize !== null && props.fileSize !== 0 && props.fileSize !== '0 B') {
    if (typeof props.fileSize === 'number') {
      return formatBytes(props.fileSize);
    }
    return String(props.fileSize);
  }

  let sizeInBytes = 0;
  if (props.fileData instanceof Uint8Array) {
    sizeInBytes = props.fileData.byteLength;
  } else if (typeof props.fileData === 'string') {
    sizeInBytes = new Blob([props.fileData]).size;
  } else if (props.rawText) {
    sizeInBytes = new Blob([props.rawText]).size;
  }

  return sizeInBytes > 0 ? formatBytes(sizeInBytes) : '';
});

const renderProgress = ref(0);

const displayProgress = computed(() => {
  if (props.loadingProgress !== undefined && props.loadingProgress !== null && props.loadingProgress > 0) {
    return Math.min(100, Math.max(0, Math.round(props.loadingProgress)));
  }
  return renderProgress.value;
});

const overlayIcon = ref<'play' | 'pause' | null>(null);
let overlayTimeoutId: number | null = null;

function triggerClickFeedback(type: 'play' | 'pause') {
  overlayIcon.value = type;
  if (overlayTimeoutId !== null) {
    clearTimeout(overlayTimeoutId);
  }
  overlayTimeoutId = window.setTimeout(() => {
    overlayIcon.value = null;
    overlayTimeoutId = null;
  }, 500);
}

function togglePlay() {
  if (!props.isReady) return;
  if (props.isPlaying) {
    AudioEngine.pause();
    triggerClickFeedback('pause');
  } else {
    AudioEngine.play();
    triggerClickFeedback('play');
  }
}

const osmdContainer = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const isLoading = computed(() => props.loading || loading.value);
let osmd: OpenSheetMusicDisplay | null = null;

watch(() => props.rawText, async (newText) => {
  if (!newText) {
    clearSheetMusic();
    return;
  }
  
  loading.value = true;
  renderProgress.value = 25;
  setTimeout(async () => {
    try {
      renderProgress.value = 65;
      await renderSheetMusic();
      renderProgress.value = 100;
    } catch (e) {
      console.error('Lỗi khi hiển thị bản nhạc:', e);
    } finally {
      setTimeout(() => {
        loading.value = false;
      }, 150);
    }
  }, 100);
});

function clearSheetMusic() {
  if (osmdContainer.value) osmdContainer.value.innerHTML = '';
  const abcContainer = document.getElementById('abc-container');
  if (abcContainer) abcContainer.innerHTML = '';
}

async function renderSheetMusic() {
  clearSheetMusic();
  const isMobile = isMobileDevice();

  if (props.fileType === 'xml' && props.rawText && osmdContainer.value) {
    const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
    osmd = new OpenSheetMusicDisplay(osmdContainer.value, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true
    });

    await osmd.load(props.rawText);
    
    if (isMobile) {
      osmd.Zoom = 0.65;
    } else {
      osmd.Zoom = 1.0;
    }

    osmd.render();
  } 
  else if (props.fileType === 'abc' && props.rawText) {
    const abcjs = await import('abcjs');
    abcjs.default.renderAbc('abc-container', props.rawText, {
      responsive: 'resize',
      add_classes: true,
      scale: isMobile ? 0.65 : 1.0,
    });
  }
}
</script>

<style scoped>
.sheet-viewer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(18, 18, 24, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.viewer-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0f0f15;
  cursor: pointer;
}

.osmd-container, .abc-container {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 16px;
  box-sizing: border-box;
  background: #ffffff;
  color: #000000;
}

.click-feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 100;
}

.feedback-icon-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: rgba(0, 240, 255, 0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 240, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
}

.feedback-icon {
  width: 32px;
  height: 32px;
  color: #ffffff;
}

.fade-scale-enter-active, .fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}

/* Loading Overlay */
.sheet-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(12, 13, 18, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90;
  pointer-events: auto;
}

.loading-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 40px;
  background: rgba(22, 24, 34, 0.88);
  border: 1px solid rgba(0, 240, 255, 0.35);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 240, 255, 0.15);
  animation: pulse-border 2s infinite ease-in-out;
  min-width: 280px;
  max-width: 360px;
}

@keyframes pulse-border {
  0%, 100% {
    border-color: rgba(0, 240, 255, 0.35);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 25px rgba(0, 240, 255, 0.15);
  }
  50% {
    border-color: rgba(0, 240, 255, 0.7);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 240, 255, 0.35);
  }
}

.spinner-container {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-outer {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: #00f0ff;
  border-right-color: #00f0ff;
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
}

.spinner-inner {
  position: absolute;
  width: 70%;
  height: 70%;
  border: 3px solid transparent;
  border-bottom-color: #7000ff;
  border-left-color: #7000ff;
  border-radius: 50%;
  animation: spin-reverse 1.2s linear infinite;
}

.loading-music-icon {
  width: 22px;
  height: 22px;
  color: #00f0ff;
  animation: bounce-soft 1.5s ease-in-out infinite;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.loading-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.5px;
  text-shadow: 0 0 12px rgba(0, 240, 255, 0.6);
}

.loading-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 240, 255, 0.08);
  border: 1px solid rgba(0, 240, 255, 0.2);
  padding: 4px 12px;
  border-radius: 12px;
  margin-top: 2px;
}

.meta-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

.file-size-badge {
  font-size: 0.8rem;
  color: #00f0ff;
  font-weight: 600;
}

.progress-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
}

.progress-status-text {
  color: #a0a0b8;
  font-weight: 500;
}

.progress-percent {
  color: #00f0ff;
  font-weight: 700;
  font-family: monospace;
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0072ff 0%, #00f0ff 100%);
  border-radius: 4px;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
  transition: width 0.3s ease;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes spin-reverse {
  to { transform: rotate(-360deg); }
}

@keyframes bounce-soft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
