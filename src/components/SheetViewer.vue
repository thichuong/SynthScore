<template>
  <div class="sheet-viewer glass-card" :class="{ 'no-header': hideHeader }">
    <SheetControlsHeader
      :activeTab="activeTab"
      :hasSheet="hasSheet"
      :loading="loading"
      :isPlaying="isPlaying"
      :isReady="isReady"
      :hideHeader="hideHeader"
      @update:activeTab="activeTab = $event"
      @togglePlay="togglePlay"
    />

    <div class="viewer-body" @click="togglePlay">
      <!-- Container hiển thị Sheet Music (MusicXML) -->
      <div 
        v-show="activeTab === 'sheet' && fileType === 'xml'" 
        ref="osmdContainer" 
        class="osmd-container"
      ></div>

      <!-- Container hiển thị ABC Notation -->
      <div 
        v-show="activeTab === 'sheet' && fileType === 'abc'" 
        id="abc-container" 
        class="abc-container"
      ></div>

      <!-- Container hiển thị Falling Notes Visualizer -->
      <WaterfallCanvas
        v-show="activeTab === 'visualizer' || !hasSheet"
        :fileData="fileData"
        :fileType="fileType"
        :rawText="rawText"
        :currentTime="currentTime"
        :isActive="activeTab === 'visualizer' || !hasSheet"
      />
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Play, Pause } from 'lucide-vue-next';
import { isMobileDevice } from '../composables/useResponsive';
import { AudioEngine } from '../services/audioEngine';
import SheetControlsHeader from './sheet/SheetControlsHeader.vue';
import WaterfallCanvas from './sheet/WaterfallCanvas.vue';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  isPlaying: boolean;
  currentTime: number;
  isReady: boolean;
  activeTab?: 'sheet' | 'visualizer';
  hideHeader?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'sheet' | 'visualizer'): void;
}>();

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
const activeTab = ref<'sheet' | 'visualizer'>(props.activeTab || 'visualizer');

watch(() => props.activeTab, (newTab) => {
  if (newTab && newTab !== activeTab.value) {
    activeTab.value = newTab;
  }
});

watch(activeTab, (newTab) => {
  emit('update:activeTab', newTab);
}, { immediate: true });

const loading = ref(false);
let osmd: OpenSheetMusicDisplay | null = null;

const hasSheet = computed(() => {
  return props.fileType === 'xml' || props.fileType === 'abc';
});

watch(() => props.rawText, async (newText) => {
  if (!newText) {
    clearSheetMusic();
    return;
  }
  
  loading.value = true;
  setTimeout(async () => {
    try {
      await renderSheetMusic();
    } catch (e) {
      console.error('Lỗi khi hiển thị bản nhạc:', e);
    } finally {
      loading.value = false;
    }
  }, 100);
});

watch(() => props.fileData, (newData) => {
  if (!newData) return;
  
  if (hasSheet.value) {
    activeTab.value = 'sheet';
  } else {
    activeTab.value = 'visualizer';
  }
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
</style>
