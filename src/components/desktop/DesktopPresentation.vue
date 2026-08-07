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
      <SheetControlsHeader
        :activeTab="activeTab"
        :hasSheet="hasSheet"
        :isPlaying="isPlaying"
        :isReady="isReady"
        :isRenderingSheet="isRenderingSheet"
        @update:activeTab="activeTab = $event"
        @togglePlay="togglePlay"
      />

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
import OrchestraMixer from '../mixer/OrchestraMixer.vue';
import SheetControlsHeader from '../sheet/SheetControlsHeader.vue';
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
