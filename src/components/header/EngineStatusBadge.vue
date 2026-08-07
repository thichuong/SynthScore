<template>
  <div class="engine-status">
    <div v-if="isLoadingSoundfont" class="status-badge loading soundfont-progress-badge">
      <div class="sf-progress-top">
        <span class="spinner"></span>
        <span class="sf-name" :title="soundfontProgress?.sf3Name">{{ soundfontProgress?.sf3Name || 'Đang tải nhạc cụ...' }}</span>
        <span v-if="soundfontProgress" class="sf-percent">{{ soundfontProgress.percent }}%</span>
      </div>
      <div v-if="soundfontProgress" class="sf-progress-track">
        <div class="sf-progress-fill" :style="{ width: soundfontProgress.percent + '%' }"></div>
      </div>
      <div v-if="soundfontProgress" class="sf-progress-details">
        <span class="sf-eta">{{ formatEta(soundfontProgress?.etaSeconds || 0) }}</span>
        <span v-if="soundfontProgress && soundfontProgress.speed > 0" class="sf-speed">{{ formatBytes(soundfontProgress.speed) }}/s</span>
        <span v-if="soundfontProgress?.isFallback" class="sf-fallback-tag" title="Đang tải từ GitHub Pages CDN">Fallback CDN</span>
      </div>
    </div>
    <span v-else-if="initializationFailed" class="status-badge error clickable" @click="emit('retryInit')" title="Nhấp để thử khởi tạo lại Audio Engine">
      <AlertCircle class="status-icon" /> Lỗi âm thanh (Nhấp để thử lại)
    </span>
    <span v-else-if="!isInitialized" class="status-badge loading">
      <span class="spinner"></span> Đang khởi tạo...
    </span>
    <span v-else class="status-badge active">
      <CheckCircle class="status-icon" /> Sẵn sàng (GM Synth)
    </span>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle, AlertCircle } from 'lucide-vue-next';
import type { SoundfontProgress } from '../../services/audioEngine';

defineProps<{
  isLoadingSoundfont: boolean;
  soundfontProgress: SoundfontProgress | null;
  initializationFailed: boolean;
  isInitialized: boolean;
}>();

const emit = defineEmits<{
  (e: 'retryInit'): void;
}>();

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Đang tải...';
  if (seconds < 60) return `Còn ~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `Còn ~${m}m ${s}s`;
}
</script>

<style scoped>
.engine-status {
  display: flex;
  align-items: center;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid transparent;
  transition: all 0.25s ease;
}

.status-badge.loading {
  background: rgba(0, 240, 255, 0.08);
  border-color: rgba(0, 240, 255, 0.2);
  color: #00f0ff;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.status-badge.error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #f87171;
}

.status-badge.clickable {
  cursor: pointer;
}

.status-badge.clickable:hover {
  background: rgba(239, 68, 68, 0.2);
}

.status-icon {
  width: 14px;
  height: 14px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.soundfont-progress-badge {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
  min-width: 180px;
  padding: 8px 12px;
}

.sf-progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sf-name {
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.sf-percent {
  font-size: 0.7rem;
  font-weight: 700;
  font-family: monospace;
}

.sf-progress-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.sf-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00f0ff, #0072ff);
  transition: width 0.2s ease;
}

.sf-progress-details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.65rem;
  color: #8c8c9e;
}

.sf-fallback-tag {
  color: #fbbf24;
  font-size: 0.6rem;
  background: rgba(245, 158, 11, 0.15);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
