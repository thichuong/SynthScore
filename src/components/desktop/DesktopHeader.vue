<template>
  <header class="app-header">
    <div class="logo-area">
      <div class="logo-icon-wrapper">
        <img src="../../assets/logo.svg" alt="SynthScore" class="logo-icon animate-pulse" />
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
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(112, 0, 255, 0.2));
  border: 1px solid rgba(0, 240, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
}

.logo-icon {
  width: 24px;
  height: 24px;
  filter: drop-shadow(0 0 4px #00f0ff);
}

.logo-text h1 {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(90deg, #ffffff 0%, #00f0ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 0.5px;
}

.logo-text p {
  font-size: 0.72rem;
  color: #8c8c9e;
  margin: 2px 0 0 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
