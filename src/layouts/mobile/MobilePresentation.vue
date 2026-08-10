<template>
  <div class="mobile-presentation">
    <!-- Thanh điều hướng 3 chế độ xem (Segmented Control Tabs) -->
    <div class="mobile-segmented-bar">
      <button 
        class="segmented-btn"
        :class="{ active: currentView === 'sheet' }"
        :disabled="!hasSheet"
        @click="hasSheet && (currentView = 'sheet')"
      >
        <Music class="seg-icon" />
        <span>Bản nhạc</span>
      </button>

      <button 
        class="segmented-btn"
        :class="{ active: currentView === 'visualizer' }"
        @click="currentView = 'visualizer'"
      >
        <Layers class="seg-icon" />
        <span>Thác nốt</span>
      </button>

      <button 
        class="segmented-btn"
        :class="{ active: currentView === 'mixer' }"
        @click="currentView = 'mixer'"
      >
        <Sliders class="seg-icon" />
        <span>Mixer</span>
      </button>
    </div>

    <!-- Nội dung hiển thị chính -->
    <div class="mobile-view-container">
      <!-- Khung hiển thị Bản nhạc -->
      <div 
        v-show="currentView === 'sheet' && hasSheet" 
        class="full-view-pane"
      >
        <SheetViewer 
          :fileData="fileData"
          :fileType="fileType"
          :rawText="rawText"
          :isPlaying="isPlaying"
          :currentTime="currentTime"
          :isReady="isReady"
          :activeTab="currentView === 'sheet' ? 'sheet' : 'visualizer'"
          :loading="loading"
          :loadingProgress="loadingProgress"
          :fileSize="fileSize"
        />
      </div>

      <!-- Khung hiển thị Thác nốt -->
      <div 
        v-show="currentView === 'visualizer' || (currentView === 'sheet' && !hasSheet)" 
        class="full-view-pane"
      >
        <WaterfallCanvas
          :fileData="fileData"
          :fileType="fileType"
          :rawText="rawText"
          :currentTime="currentTime"
          :isPlaying="isPlaying"
          :isReady="isReady"
          :isActive="currentView === 'visualizer' || !hasSheet"
        />
      </div>

      <!-- Khung hiển thị Orchestra Mixer -->
      <div 
        v-show="currentView === 'mixer'" 
        class="full-view-pane mixer-pane"
      >
        <OrchestraMixer 
          :tracks="tracks"
          :currentMode="playbackMode"
          @changeMode="$emit('changeMode', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Music, Layers, Sliders } from 'lucide-vue-next';
import SheetViewer from '../../components/sheet/SheetViewer.vue';
import WaterfallCanvas from '../../components/visualizer/WaterfallCanvas.vue';
import OrchestraMixer from '../../components/mixer/OrchestraMixer.vue';
import type { TrackInfo } from '../../services/midiGenerator';

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

defineEmits<{
  (e: 'changeMode', mode: 'default' | 'symphony' | 'concerto'): void;
}>();

// Chế độ xem mặc định trên mobile là Thác nốt nhạc (visualizer)
const currentView = ref<'sheet' | 'visualizer' | 'mixer'>('visualizer');

const hasSheet = computed(() => {
  return props.fileType === 'xml' || props.fileType === 'abc';
});

watch(hasSheet, (newHasSheet) => {
  if (!newHasSheet && currentView.value === 'sheet') {
    currentView.value = 'visualizer';
  }
});

let isModeChanging = false;
let modeTimeoutId: ReturnType<typeof setTimeout> | null = null;

watch(() => props.playbackMode, () => {
  isModeChanging = true;
  if (modeTimeoutId) clearTimeout(modeTimeoutId);
  modeTimeoutId = setTimeout(() => {
    isModeChanging = false;
    modeTimeoutId = null;
  }, 3000);
});

watch(() => props.fileData, () => {
  if (isModeChanging) {
    isModeChanging = false;
    if (modeTimeoutId) {
      clearTimeout(modeTimeoutId);
      modeTimeoutId = null;
    }
    return;
  }
  currentView.value = 'visualizer';
});
</script>

<style scoped>
.mobile-presentation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: #09090e;
}

.mobile-segmented-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px;
  margin: 6px 10px 4px 10px;
  background: rgba(22, 22, 32, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  flex-shrink: 0;
}

.segmented-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.segmented-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: transparent;
  box-shadow: none;
}

.segmented-btn.active {
  background: rgba(0, 240, 255, 0.15);
  color: #00f0ff;
  border: 1px solid rgba(0, 240, 255, 0.3);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.15);
}

.seg-icon {
  width: 15px;
  height: 15px;
}

.mobile-view-container {
  flex: 1;
  min-height: 0;
  position: relative;
  width: 100%;
  padding: 0 8px 6px 8px;
  box-sizing: border-box;
}

.full-view-pane {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.full-view-pane :deep(.sheet-viewer),
.full-view-pane :deep(.orchestra-mixer),
.full-view-pane :deep(.canvas-container) {
  height: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
}

.mixer-pane {
  overflow-y: auto;
}
</style>
