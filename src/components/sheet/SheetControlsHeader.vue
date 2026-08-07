<template>
  <div class="viewer-header" v-if="!hideHeader">
    <div class="viewer-tabs">
      <button 
        v-if="hasSheet"
        class="tab-btn" 
        :class="{ active: activeTab === 'sheet', rendering: isRenderingSheet }"
        @click="emit('update:activeTab', 'sheet')"
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
        @click="emit('update:activeTab', 'visualizer')"
      >
        <Layers class="icon" /> Thác Nốt Nhạc (Falling Notes)
      </button>
    </div>

    <div class="viewer-actions">
      <button 
        class="viewer-play-btn" 
        :class="{ playing: isPlaying }"
        @click="emit('togglePlay')"
        :title="isPlaying ? 'Tạm dừng' : 'Phát nhạc'"
        :disabled="!isReady"
      >
        <Pause v-if="isPlaying" class="icon" />
        <Play v-else class="icon play-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Music, Layers, Play, Pause, Loader2 } from 'lucide-vue-next';

defineProps<{
  activeTab: 'sheet' | 'visualizer';
  hasSheet: boolean;
  isPlaying: boolean;
  isReady: boolean;
  hideHeader?: boolean;
  isRenderingSheet?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: 'sheet' | 'visualizer'): void;
  (e: 'togglePlay'): void;
}>();
</script>

<style scoped>
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
</style>
