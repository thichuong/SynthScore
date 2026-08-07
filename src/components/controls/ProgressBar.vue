<template>
  <div class="progress-row">
    <button 
      class="nav-btn prev-btn" 
      @click="emit('prev')" 
      title="Bài trước (Phím P hoặc Shift+Left)"
      :disabled="!isReady"
    >
      <SkipBack class="nav-icon" />
    </button>

    <span class="time-label">{{ formatTime(currentTime) }}</span>
    
    <div class="progress-bar-container" @click="handleProgressClick" ref="progressBarRef">
      <div class="progress-bar-bg"></div>
      <div 
        class="progress-bar-fill" 
        :style="{ width: `${progressPercent}%` }"
      ></div>
      <div 
        class="progress-handle" 
        :style="{ left: `${progressPercent}%` }"
      ></div>
    </div>

    <span class="time-label">{{ formatTime(duration) }}</span>

    <button 
      class="nav-btn next-btn" 
      @click="emit('next')" 
      title="Bài tiếp theo (Phím N hoặc Shift+Right)"
      :disabled="!isReady"
    >
      <SkipForward class="nav-icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { SkipBack, SkipForward } from 'lucide-vue-next';

const props = defineProps<{
  currentTime: number;
  duration: number;
  isReady: boolean;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'seek', targetSeconds: number): void;
}>();

const progressBarRef = ref<HTMLDivElement | null>(null);

const progressPercent = computed(() => {
  if (props.duration <= 0) return 0;
  return (props.currentTime / props.duration) * 100;
});

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function handleProgressClick(event: MouseEvent) {
  if (!progressBarRef.value || props.duration <= 0) return;
  
  const rect = progressBarRef.value.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  
  let percent = clickX / width;
  percent = Math.max(0, Math.min(1, percent));
  
  const targetSeconds = percent * props.duration;
  emit('seek', targetSeconds);
}
</script>

<style scoped>
.progress-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.time-label {
  font-size: 0.75rem;
  color: #8c8c9e;
  font-family: monospace;
  width: 40px;
}

.progress-bar-container {
  flex: 1;
  height: 12px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  transition: height 0.2s ease;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #00f0ff 0%, #0072ff 100%);
  border-radius: 2px;
  transition: height 0.2s ease;
}

.progress-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #00f0ff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.1s ease;
  pointer-events: none;
}

.progress-bar-container:hover .progress-bar-bg,
.progress-bar-container:hover .progress-bar-fill {
  height: 6px;
}

.progress-bar-container:hover .progress-handle {
  opacity: 1;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a0b0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  outline: none;
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  transform: scale(1.08);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.nav-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.nav-icon {
  width: 14px;
  height: 14px;
}
</style>
