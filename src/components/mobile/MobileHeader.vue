<template>
  <header class="mobile-header">
    <!-- Hàng trên: Logo & Trạng thái Audio Engine -->
    <div class="mobile-header-top">
      <div class="mobile-logo-area">
        <img src="../../assets/logo.svg" alt="SynthScore" class="mobile-logo-icon" />
        <span class="mobile-logo-title">SynthScore</span>
      </div>

      <!-- Trạng thái engine nhỏ gọn -->
      <div class="mobile-status-badge">
        <span v-if="isLoadingSoundfont" class="m-badge loading">
          <span class="mini-spinner"></span> Tải soundfont...
        </span>
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

    <!-- Hàng dưới: Thư viện nhạc, Upload & Nút xuất file -->
    <div class="mobile-header-actions">
      <div class="picker-wrapper">
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

      <FileUploader @musicLoaded="$emit('musicLoaded', $event)" />

      <!-- Nút Xuất file nhanh -->
      <button 
        class="mobile-export-btn"
        @click="$emit('triggerExport')"
        :disabled="!isReady"
        title="Xuất bản nhạc ra file MP3/WAV/MIDI"
      >
        <Download class="export-icon" />
        <span class="export-label">Xuất file</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Download, CheckCircle, AlertCircle } from 'lucide-vue-next';
import SongLibraryPicker from '../SongLibraryPicker.vue';
import FileUploader from '../FileUploader.vue';
import type { SongEntry } from '../../data/songLibrary';

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
  initializationFailed: boolean;
  isReady: boolean;
}>();

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
  background: rgba(18, 18, 26, 0.85);
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

.mobile-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.picker-wrapper {
  flex: 1;
  min-width: 0;
}

.mobile-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(112, 0, 255, 0.2) 100%);
  border: 1px solid rgba(0, 240, 255, 0.4);
  color: #ffffff;
  font-family: inherit;
  font-size: 0.8rem;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
