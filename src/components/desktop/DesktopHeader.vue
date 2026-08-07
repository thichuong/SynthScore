<template>
  <header class="app-header">
    <div class="logo-area">
      <div class="logo-icon-wrapper">
        <img src="../../assets/logo.svg" alt="SynthScore" class="logo-icon" />
      </div>
      <div class="logo-text">
        <h1>SynthScore</h1>
        <p>Trình chơi nhạc tự động &amp; Xem bản nhạc tương tác cao cấp</p>
      </div>
    </div>

    <div class="header-controls">
      <!-- Thư viện bản nhạc -->
      <SongLibraryPicker 
        :songs="songs"
        :filteredSongs="filteredSongs"
        :playingIndex="playingIndex" 
        :isLoading="isLoading"
        :disabled="disabled"
        :searchQuery="searchQuery"
        :activeFilter="activeFilter"
        @update:searchQuery="emit('update:searchQuery', $event)"
        @update:activeFilter="emit('update:activeFilter', $event)"
        @select="emit('selectSong', $event)"
        @toggle-favorite="emit('toggleFavorite', $event)"
      />

      <FileUploader @musicLoaded="emit('musicLoaded', $event)" />
    </div>

    <!-- Trạng thái Audio Engine -->
    <EngineStatusBadge
      :isLoadingSoundfont="isLoadingSoundfont"
      :soundfontProgress="soundfontProgress"
      :initializationFailed="initializationFailed"
      :isInitialized="isInitialized"
      @retryInit="emit('retryInit')"
    />
  </header>
</template>

<script setup lang="ts">
import SongLibraryPicker from '../SongLibraryPicker.vue';
import FileUploader from '../FileUploader.vue';
import EngineStatusBadge from '../header/EngineStatusBadge.vue';
import type { SongEntry } from '../../data/songLibrary';
import type { SoundfontProgress } from '../../services/audioEngine';

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

defineProps<{
  songs: SongEntry[];
  filteredSongs: FilteredSong[];
  playingIndex: number;
  isLoading: boolean;
  disabled: boolean;
  searchQuery: string;
  activeFilter: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích';
  isInitialized: boolean;
  isLoadingSoundfont: boolean;
  soundfontProgress: SoundfontProgress | null;
  initializationFailed: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', query: string): void;
  (e: 'update:activeFilter', filter: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'): void;
  (e: 'selectSong', index: number): void;
  (e: 'toggleFavorite', index: number): void;
  (e: 'musicLoaded', payload: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string }): void;
  (e: 'retryInit'): void;
}>();
</script>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  background: rgba(18, 18, 24, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 24px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 10;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  width: 22px;
  height: 22px;
}

.logo-text h1 {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.logo-text p {
  font-size: 0.75rem;
  color: #9aa0a6;
  margin: 2px 0 0 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
