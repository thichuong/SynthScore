<template>
  <header class="mobile-header">
    <!-- Hàng 1: Logo & Trạng thái Audio Engine -->
    <div class="mobile-header-top">
      <div class="mobile-logo-area">
        <img src="../../assets/logo.svg" alt="SynthScore" class="mobile-logo-icon" />
        <span class="mobile-logo-title">SynthScore</span>
      </div>

      <!-- Trạng thái engine nhỏ gọn -->
      <div class="mobile-status-badge">
        <div v-if="isLoadingSoundfont" class="m-badge loading m-sf-progress-badge">
          <div class="m-sf-top">
            <span class="mini-spinner"></span>
            <span class="m-sf-text">
              {{ soundfontProgress ? `${soundfontProgress.percent}% · ${formatEta(soundfontProgress.etaSeconds)}` : 'Tải soundfont...' }}
            </span>
          </div>
          <div v-if="soundfontProgress" class="m-sf-track">
            <div class="m-sf-fill" :style="{ width: soundfontProgress.percent + '%' }"></div>
          </div>
        </div>
        <span v-else-if="initializationFailed" class="m-badge error" @click="$emit('retryInit')">
          <AlertCircle class="m-icon" /> Lỗi âm thanh
        </span>
        <span v-else-if="!isInitialized" class="m-badge loading">
          <span class="mini-spinner"></span> Khởi tạo...
        </span>
        <span v-else class="m-badge ready">
          <CheckCircle class="m-icon" /> GM Synth
        </span>
      </div>
    </div>

    <!-- Hàng 2: Các nút thao tác (Xuất file & Tải lên) -->
    <div class="mobile-header-tools">
      <button 
        class="mobile-export-btn"
        @click="$emit('triggerExport')"
        :disabled="!isReady"
        title="Xuất bản nhạc ra file MP3/WAV/MIDI"
      >
        <Download class="export-icon" />
        <span class="export-label">Xuất file</span>
      </button>

      <div class="uploader-wrapper">
        <FileUploader @musicLoaded="$emit('musicLoaded', $event)" />
      </div>
    </div>

    <!-- Hàng 3 (Ở DƯỚI): Chọn bản nhạc -->
    <div class="mobile-header-picker">
      <SongLibraryPicker 
        :songs="songs"
        :filteredSongs="filteredSongs"
        :playingIndex="playingIndex"
        :isLoading="isLoading"
        :disabled="disabled"
        v-model:searchQuery="searchQuery"
        v-model:activeFilter="activeFilter"
        @select="$emit('selectSong', $event)"
        @toggle-favorite="$emit('toggleFavorite', $event)"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Download, CheckCircle, AlertCircle } from 'lucide-vue-next';
import SongLibraryPicker from '../../components/controls/SongLibraryPicker.vue';
import FileUploader from '../../components/controls/FileUploader.vue';
import type { SongEntry } from '../../data/songLibrary';
import type { SoundfontProgress } from '../../services/audio/soundfontService';

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

const props = defineProps<{
  songs: SongEntry[];
  filteredSongs: FilteredSong[];
  playingIndex: number;
  isLoading: boolean;
  disabled: boolean;
  searchQuery: string;
  activeFilter: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích';
  isInitialized: boolean;
  isLoadingSoundfont: boolean;
  soundfontProgress?: SoundfontProgress | null;
  initializationFailed: boolean;
  isReady: boolean;
}>();

function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return 'Đang tải...';
  if (seconds < 60) return `Còn ~${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `Còn ~${m}m ${s}s`;
}

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'update:activeFilter', val: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'): void;
  (e: 'selectSong', index: number): void;
  (e: 'toggleFavorite', index: number): void;
  (e: 'musicLoaded', data: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string; rawText?: string }): void;
  (e: 'triggerExport'): void;
  (e: 'retryInit'): void;
}>();

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (val: string) => emit('update:searchQuery', val)
});

const activeFilter = computed({
  get: () => props.activeFilter,
  set: (val: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích') => emit('update:activeFilter', val)
});
</script>

<style scoped>
.mobile-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(18, 18, 26, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 20;
  flex-shrink: 0;
}

.mobile-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-logo-area {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mobile-logo-icon {
  width: 22px;
  height: 22px;
}

.mobile-logo-title {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 1.05rem;
  background: linear-gradient(135deg, #00f0ff 0%, #7000ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mobile-status-badge {
  font-size: 0.75rem;
}

.m-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
}

.m-badge.loading {
  background: rgba(255, 170, 0, 0.15);
  color: #ffaa00;
  border: 1px solid rgba(255, 170, 0, 0.3);
}

.m-badge.loading.m-sf-progress-badge {
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  padding: 4px 8px;
}

.m-sf-top {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 600;
}

.m-sf-text {
  white-space: nowrap;
}

.m-sf-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.m-sf-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffaa00 0%, #00f0ff 100%);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.m-badge.ready {
  background: rgba(0, 240, 255, 0.12);
  color: #00f0ff;
  border: 1px solid rgba(0, 240, 255, 0.3);
}

.m-badge.error {
  background: rgba(255, 50, 50, 0.15);
  color: #ff4d4d;
  border: 1px solid rgba(255, 50, 50, 0.3);
}

.mini-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 170, 0, 0.3);
  border-top-color: #ffaa00;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.m-icon {
  width: 12px;
  height: 12px;
}

/* Hàng 2: Các nút Xuất file và Tải lên nằm ở trên */
.mobile-header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.uploader-wrapper {
  display: flex;
  align-items: center;
}

.mobile-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(112, 0, 255, 0.2) 100%);
  border: 1px solid rgba(0, 240, 255, 0.4);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 240, 255, 0.15);
}

.mobile-export-btn:active:not(:disabled) {
  transform: scale(0.96);
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.35) 0%, rgba(112, 0, 255, 0.35) 100%);
}

.mobile-export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.1);
}

.export-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

/* Hàng 3: Ô chọn bản nhạc nằm ở DƯỚI */
.mobile-header-picker {
  width: 100%;
  position: relative;
}

.mobile-header-picker :deep(.song-picker) {
  width: 100%;
  position: relative;
}

.mobile-header-picker :deep(.picker-trigger) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  justify-content: space-between;
  box-sizing: border-box;
}

.mobile-header-picker :deep(.dropdown-panel) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  left: 0;
  right: 0;
  box-sizing: border-box;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
