<template>
  <main class="dashboard-grid">
    <!-- Cột trái: Bàn trộn Mixer -->
    <div class="dashboard-sidebar">
      <OrchestraMixer 
        :tracks="tracks" 
        :currentMode="playbackMode"
        @changeMode="emit('changeMode', $event)"
      />
    </div>

    <!-- Cột phải: Khung hiển thị trung tâm (Sheet Viewer / Waterfall Visualizer) -->
    <div class="dashboard-content glass-card">
      <!-- Thanh điều hướng tab phần giữa Desktop UI -->
      <div class="viewer-header">
        <div class="viewer-tabs">
          <button 
            v-if="hasSheet"
            class="tab-btn" 
            :class="{ active: activeTab === 'sheet', rendering: isRenderingSheet }"
            @click="activeTab = 'sheet'"
          >
            <Music class="icon" /> 
            <span>Bản Nhạc (Sheet Music)</span>
            <span v-if="isRenderingSheet" class="rendering-tag">
              <Loader2 class="spin-icon" /> Đang vẽ...
            </span>
          </button>

          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'visualizer' }"
            @click="activeTab = 'visualizer'"
          >
            <Layers class="icon" /> Thác Nốt Nhạc (Falling Notes)
          </button>
        </div>

        <div class="viewer-actions">
          <button 
            class="viewer-play-btn" 
            :class="{ playing: isPlaying }"
            @click="togglePlay"
            :title="isPlaying ? 'Tạm dừng' : 'Phát nhạc'"
            :disabled="!isReady"
          >
            <Pause v-if="isPlaying" class="icon" />
            <Play v-else class="icon play-icon" />
          </button>
        </div>
      </div>

      <!-- Thân hiển thị chính -->
      <div class="desktop-viewport-body">
        <!-- Tab 1: Bản nhạc (MusicXML OSMD / ABC notation) -->
        <SheetViewer 
          v-show="activeTab === 'sheet' && hasSheet"
          :fileData="fileData"
          :fileType="fileType"
          :rawText="rawText"
          :isPlaying="isPlaying"
          :currentTime="currentTime"
          :isReady="isReady"
          :activeTab="activeTab"
          :loading="loading"
          :loadingProgress="loadingProgress"
          :fileSize="fileSize"
          @update:isRenderingSheet="isRenderingSheet = $event"
        />

        <!-- Tab 2: Thác nốt (Piano Roll Waterfall Visualizer Canvas) -->
        <WaterfallCanvas
          v-show="activeTab === 'visualizer' || !hasSheet"
          :fileData="fileData"
          :fileType="fileType"
          :rawText="rawText"
          :currentTime="currentTime"
          :isPlaying="isPlaying"
          :isReady="isReady"
          :isActive="activeTab === 'visualizer' || !hasSheet"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Music, Layers, Play, Pause, Loader2 } from 'lucide-vue-next';
import OrchestraMixer from '../mixer/OrchestraMixer.vue';
import SheetViewer from '../sheet/SheetViewer.vue';
import WaterfallCanvas from '../visualizer/WaterfallCanvas.vue';
import type { TrackInfo } from '../../services/midiGenerator';
import { AudioEngine } from '../../services/audioEngine';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  isPlaying: boolean;
  currentTime: number;
  isReady: boolean;
  tracks: TrackInfo[];
  playbackMode: 'default' | 'symphony' | 'concerto';
  loading?: boolean;
  loadingProgress?: number;
  fileSize?: number | string;
}>();

const emit = defineEmits<{
  (e: 'changeMode', mode: 'default' | 'symphony' | 'concerto'): void;
}>();

const activeTab = ref<'sheet' | 'visualizer'>('visualizer');
const isRenderingSheet = ref(false);

const hasSheet = computed(() => {
  return props.fileType === 'xml' || props.fileType === 'abc';
});

// Tự động chuyển sang tab Thác nốt (visualizer) khi mở bài hát mới (không chuyển khi đổi mode Mixer)
watch([() => props.fileData, () => props.playbackMode], ([_newFileData, newMode], [_oldFileData, oldMode]) => {
  if (oldMode !== undefined && newMode !== oldMode) {
    return;
  }
  activeTab.value = 'visualizer';
});

function togglePlay() {
  if (!props.isReady) return;
  if (props.isPlaying) {
    AudioEngine.pause();
  } else {
    AudioEngine.play();
  }
}
</script>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.dashboard-sidebar {
  height: 100%;
  overflow: hidden;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(18, 18, 24, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(18, 18, 24, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.viewer-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #8c8c9e;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.tab-btn.active {
  background: rgba(0, 240, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.rendering-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.15);
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(0, 240, 255, 0.3);
  margin-left: 4px;
  animation: pulse 1.5s ease-in-out infinite;
}

.spin-icon {
  width: 12px;
  height: 12px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1.0; }
}

.icon {
  width: 14px;
  height: 14px;
}

.viewer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.viewer-play-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 240, 255, 0.3);
  transition: all 0.2s ease;
}

.viewer-play-btn:hover:not(:disabled) {
  transform: scale(1.08);
}

.viewer-play-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.play-icon {
  transform: translateX(1px);
}

.desktop-viewport-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0f0f15;
}

.desktop-viewport-body :deep(.sheet-viewer),
.desktop-viewport-body :deep(.canvas-container) {
  height: 100% !important;
  max-height: 100% !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
</style>
