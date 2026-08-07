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
        <SongSearchFilter
          ref="searchFilterRef"
          :searchQuery="searchQuery"
          :activeFilter="activeFilter"
          @update:searchQuery="searchQuery = $event"
          @update:activeFilter="activeFilter = $event"
          @escape="closeDropdown"
        />

        <!-- Song List -->
        <div class="song-list" ref="songListRef">
          <SongCardItem
            v-for="song in filteredSongs" 
            :key="song.originalIndex"
            :song="song"
            :isPlaying="song.originalIndex === playingIndex"
            :isHovered="hoveredIndex === song.originalIndex"
            @mouseenter="hoveredIndex = song.originalIndex"
            @mouseleave="hoveredIndex = -1"
            @select="selectSong(song.originalIndex)"
            @toggleFavorite="emit('toggle-favorite', song.originalIndex)"
          />

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
import { Music, ChevronDown } from 'lucide-vue-next';
import type { SongEntry } from '../data/songLibrary';
import SongSearchFilter from './library/SongSearchFilter.vue';
import SongCardItem from './library/SongCardItem.vue';

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
const searchFilterRef = ref<InstanceType<typeof SongSearchFilter> | null>(null);
const songListRef = ref<HTMLElement | null>(null);

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
    searchFilterRef.value?.focus();
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

function handleClickOutside(e: MouseEvent) {
  if (pickerRef.value && !pickerRef.value.contains(e.target as Node)) {
    closeDropdown();
  }
}

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

watch(() => props.playingIndex, () => {
  if (isOpen.value) {
    scrollToPlaying();
  }
});
</script>

<style scoped>
.song-picker {
  position: relative;
  display: inline-block;
}

.picker-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 8px 14px;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 220px;
  max-width: 320px;
}

.picker-trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(0, 240, 255, 0.3);
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
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.trigger-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.trigger-song-name {
  color: #00f0ff;
}

.trigger-composer {
  color: #8c8c9e;
  font-weight: 400;
}

.trigger-chevron {
  width: 14px;
  height: 14px;
  color: #8c8c9e;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

.dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 340px;
  background: #161622;
  border: 1px solid #2e2e42;
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.song-list {
  max-height: 320px;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-list::-webkit-scrollbar {
  width: 4px;
}

.song-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.empty-state {
  padding: 24px;
  text-align: center;
  font-size: 0.8rem;
  color: #8c8c9e;
}

.dropdown-enter-active, .dropdown-leave-active {
  transition: all 0.2s ease;
}

.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
