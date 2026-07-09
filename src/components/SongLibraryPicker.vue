<template>
  <div class="song-picker" ref="pickerRef">
    <!-- Trigger Button -->
    <button 
      class="picker-trigger" 
      @click="toggleDropdown"
      :disabled="disabled"
    >
      <Music class="trigger-icon" v-if="!isLoading" />
      <span v-else class="trigger-spinner"></span>
      
      <span class="trigger-text">
        <template v-if="isLoading">Đang tải bản nhạc...</template>
        <template v-else-if="playingIndex >= 0 && songs[playingIndex]">
          <span class="trigger-song-name">{{ songs[playingIndex].name }}</span>
          <span class="trigger-composer" v-if="songs[playingIndex].composer">
            — {{ songs[playingIndex].composer }}
          </span>
        </template>
        <template v-else>🎵 Chọn bản nhạc từ thư viện...</template>
      </span>

      <ChevronDown class="trigger-chevron" :class="{ rotated: isOpen }" />
    </button>

    <!-- Dropdown Panel -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-panel">
        <!-- Search -->
        <div class="search-bar">
          <Search class="search-icon" />
          <input 
            ref="searchInputRef"
            v-model="searchQuery" 
            type="text" 
            placeholder="Tìm kiếm bản nhạc..." 
            class="search-input"
            @keydown.escape="closeDropdown"
          />
        </div>

        <!-- Filter Tabs -->
        <div class="tag-filters">
          <button 
            v-for="tab in ['tất cả', 'có sẵn', 'tải lên', 'ưa thích']" 
            :key="tab"
            class="filter-tab"
            :class="{ active: activeFilter === tab }"
            @click="activeFilter = tab"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Song List -->
        <div class="song-list" ref="songListRef">
          <div 
            v-for="(song, idx) in filteredSongs" 
            :key="idx"
            class="song-item"
            :class="{
              'is-playing': song.originalIndex === playingIndex,
              'is-hovered': hoveredIndex === song.originalIndex,
            }"
            @mouseenter="hoveredIndex = song.originalIndex"
            @mouseleave="hoveredIndex = -1"
            @click="selectSong(song.originalIndex)"
          >
            <!-- Playing indicator bar -->
            <div class="playing-bar" v-if="song.originalIndex === playingIndex"></div>

            <div class="song-info">
              <span class="song-name">
                <span v-if="song.originalIndex === playingIndex" class="playing-icon">♪</span>
                {{ song.name }}
              </span>
              <span class="song-meta">
                <span class="song-composer" v-if="song.composer">{{ song.composer }}</span>
                <span 
                  class="song-difficulty" 
                  v-if="song.difficulty"
                  :class="'diff-' + song.difficulty"
                >
                  {{ difficultyLabel(song.difficulty) }}
                </span>
                <span class="song-tags" v-if="(song.tags && song.tags.length) || song.isFavorite">
                  <span 
                    v-for="t in song.tags" 
                    :key="t"
                    class="song-tag"
                    :class="t === 'tải lên' ? 'tag-uploaded' : 'tag-builtin'"
                  >
                    {{ t }}
                  </span>
                  <span v-if="song.isFavorite" class="song-tag tag-favorite">
                    ưa thích
                  </span>
                </span>
              </span>
            </div>

            <!-- Favorite toggle button -->
            <button 
              class="favorite-btn" 
              :class="{ 'is-favorite': song.isFavorite }"
              @click.stop="emit('toggle-favorite', song.originalIndex)"
              :title="song.isFavorite ? 'Bỏ ưa thích' : 'Thêm vào ưa thích'"
            >
              <Heart class="favorite-icon" :fill="song.isFavorite ? '#ff007f' : 'none'" />
            </button>

            <div class="song-playing-badge" v-if="song.originalIndex === playingIndex">
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
              <span class="eq-bar"></span>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="filteredSongs.length === 0" class="empty-state">
            Không tìm thấy bản nhạc nào.
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { Music, ChevronDown, Search, Heart } from 'lucide-vue-next';
import type { SongEntry } from '../data/songLibrary';

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

const props = defineProps<{
  songs: SongEntry[];
  filteredSongs: FilteredSong[];
  playingIndex: number;
  isLoading: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', index: number): void;
  (e: 'toggle-favorite', index: number): void;
}>();

const isOpen = ref(false);
const searchQuery = defineModel<string>('searchQuery', { required: true });
const hoveredIndex = ref(-1);
const activeFilter = defineModel<'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'>('activeFilter', { required: true });

const pickerRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const songListRef = ref<HTMLElement | null>(null);

function difficultyLabel(diff?: SongEntry['difficulty']): string {
  const labels: Record<string, string> = {
    beginner: 'Cơ bản',
    easy: 'Dễ',
    intermediate: 'Trung bình',
    advanced: 'Nâng cao',
    expert: 'Chuyên gia',
  };
  return diff ? labels[diff] || diff : '';
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  isOpen.value = true;
  searchQuery.value = '';
  hoveredIndex.value = -1;

  nextTick(() => {
    // Focus search input
    searchInputRef.value?.focus();
    // Auto-scroll to playing song
    scrollToPlaying();
  });
}

function closeDropdown() {
  isOpen.value = false;
  hoveredIndex.value = -1;
}

function selectSong(index: number) {
  emit('select', index);
  closeDropdown();
}

function scrollToPlaying() {
  if (props.playingIndex < 0) return;
  
  nextTick(() => {
    const container = songListRef.value;
    if (!container) return;

    const playingEl = container.querySelector('.is-playing');
    if (playingEl) {
      playingEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}

// Click outside to close
function handleClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    closeDropdown();
  }
}

// Escape key to close
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});

// Khi playingIndex thay đổi từ bên ngoài, scroll lại nếu dropdown đang mở
watch(() => props.playingIndex, () => {
  if (isOpen.value) {
    scrollToPlaying();
  }
});
</script>

<style scoped>
.song-picker {
  position: relative;
}

/* === Trigger Button === */
.picker-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #e2e2e9;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  min-width: 340px;
  max-width: 440px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.picker-trigger:hover:not(:disabled) {
  border-color: rgba(0, 240, 255, 0.3);
  background: rgba(0, 240, 255, 0.05);
}

.picker-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-icon {
  width: 16px;
  height: 16px;
  color: #00f0ff;
  flex-shrink: 0;
}

.trigger-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 1s infinite linear;
  flex-shrink: 0;
}

.trigger-text {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-song-name {
  color: #ffffff;
}

.trigger-composer {
  color: #8c8c9e;
  font-weight: 500;
}

.trigger-chevron {
  width: 14px;
  height: 14px;
  color: #8c8c9e;
  flex-shrink: 0;
  transition: transform 0.25s ease;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

/* === Dropdown Panel === */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  min-width: 400px;
  max-height: 420px;
  background: rgba(16, 16, 22, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 1px rgba(0, 240, 255, 0.15);
  backdrop-filter: blur(16px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Dropdown transition */
.dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: all 0.15s ease-in;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
}

/* === Search Bar === */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #8c8c9e;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: #e2e2e9;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 500;
  outline: none;
}

.search-input::placeholder {
  color: #5c5c6e;
}

/* === Song List === */
.song-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px;
}

.song-list::-webkit-scrollbar {
  width: 4px;
}

.song-list::-webkit-scrollbar-track {
  background: transparent;
}

.song-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.song-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* === Song Item === */
.song-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px 9px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  overflow: hidden;
}

/* Hover state — chỉ khi chuột di qua */
.song-item.is-hovered {
  background: rgba(255, 255, 255, 0.06);
}

/* Playing state — luôn hiện, độc lập với hover */
.song-item.is-playing {
  background: rgba(0, 240, 255, 0.06);
}

/* Playing + hover cùng lúc */
.song-item.is-playing.is-hovered {
  background: rgba(0, 240, 255, 0.1);
}

/* Playing indicator bar (viền trái gradient) */
.playing-bar {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #00f0ff 0%, #7f00ff 100%);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

/* Song info */
.song-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.song-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #d4d4de;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-playing .song-name {
  color: #ffffff;
  font-weight: 700;
}

.playing-icon {
  color: #00f0ff;
  margin-right: 4px;
  font-weight: 800;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.song-composer {
  font-size: 0.68rem;
  color: #7c7c8e;
  font-weight: 500;
}

.is-playing .song-composer {
  color: #9c9cae;
}

.song-difficulty {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.diff-beginner {
  background: rgba(57, 255, 20, 0.1);
  color: #39ff14;
  border: 1px solid rgba(57, 255, 20, 0.15);
}

.diff-easy {
  background: rgba(0, 200, 120, 0.1);
  color: #00c878;
  border: 1px solid rgba(0, 200, 120, 0.15);
}

.diff-intermediate {
  background: rgba(255, 200, 0, 0.1);
  color: #ffc800;
  border: 1px solid rgba(255, 200, 0, 0.15);
}

.diff-advanced {
  background: rgba(255, 120, 0, 0.1);
  color: #ff7800;
  border: 1px solid rgba(255, 120, 0, 0.15);
}

.diff-expert {
  background: rgba(255, 50, 50, 0.1);
  color: #ff3232;
  border: 1px solid rgba(255, 50, 50, 0.15);
}

/* EQ bars animation (playing badge) */
.song-playing-badge {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
  flex-shrink: 0;
  margin-left: 8px;
}

.eq-bar {
  width: 3px;
  border-radius: 1px;
  background: linear-gradient(0deg, #00f0ff, #7f00ff);
  animation: eq-bounce 0.8s ease-in-out infinite alternate;
}

.eq-bar:nth-child(1) {
  height: 40%;
  animation-delay: 0s;
}

.eq-bar:nth-child(2) {
  height: 80%;
  animation-delay: 0.2s;
}

.eq-bar:nth-child(3) {
  height: 55%;
  animation-delay: 0.4s;
}

@keyframes eq-bounce {
  0% { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 24px 16px;
  font-size: 0.78rem;
  color: #5c5c6e;
  font-weight: 500;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* === Tag Filters === */
.tag-filters {
  display: flex;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.filter-tab {
  background: none;
  border: none;
  color: #8c8c9e;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  text-transform: uppercase;
}

.filter-tab:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.filter-tab.active {
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.08);
  border-color: rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.05);
}

/* === Song Tags === */
.song-tags {
  display: flex;
  gap: 4px;
  align-items: center;
}

.song-tag {
  font-size: 0.55rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.tag-builtin {
  background: rgba(127, 0, 255, 0.1);
  color: #a070ff;
  border: 1px solid rgba(127, 0, 255, 0.2);
}

.tag-uploaded {
  background: rgba(0, 240, 255, 0.1);
  color: #00f0ff;
  border: 1px solid rgba(0, 240, 255, 0.2);
}

.favorite-btn {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  color: #5c5c6e;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  margin-left: auto;
  margin-right: 4px;
  z-index: 2;
  outline: none;
}

.song-item:hover .favorite-btn {
  color: #8c8c9e;
}

.favorite-btn.is-favorite {
  color: #ff007f;
  animation: pulse-fav 0.3s ease;
}

.favorite-btn:hover {
  transform: scale(1.15);
  color: #ff007f !important;
}

.favorite-icon {
  width: 14px;
  height: 14px;
}

.tag-favorite {
  background: rgba(255, 0, 127, 0.1);
  color: #ff007f;
  border: 1px solid rgba(255, 0, 127, 0.2);
}

@keyframes pulse-fav {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
</style>
