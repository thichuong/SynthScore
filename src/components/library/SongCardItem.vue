<template>
  <div 
    class="song-item"
    :class="{
      'is-playing': isPlaying,
      'is-hovered': isHovered,
    }"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
    @click="emit('select')"
  >
    <!-- Playing indicator bar -->
    <div class="playing-bar" v-if="isPlaying"></div>

    <div class="song-info">
      <span class="song-name">
        <span v-if="isPlaying" class="playing-icon">♪</span>
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
      @click.stop="emit('toggleFavorite')"
      :title="song.isFavorite ? 'Bỏ ưa thích' : 'Thêm vào ưa thích'"
    >
      <Heart class="favorite-icon" :fill="song.isFavorite ? '#ff007f' : 'none'" />
    </button>

    <div class="song-playing-badge" v-if="isPlaying">
      <span class="eq-bar"></span>
      <span class="eq-bar"></span>
      <span class="eq-bar"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Heart } from 'lucide-vue-next';
import type { SongEntry } from '../../data/songLibrary';

interface FilteredSong extends SongEntry {
  originalIndex: number;
}

defineProps<{
  song: FilteredSong;
  isPlaying: boolean;
  isHovered: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'toggleFavorite'): void;
  (e: 'mouseenter'): void;
  (e: 'mouseleave'): void;
}>();

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
</script>

<style scoped>
.song-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #1e1e28;
  border: 1px solid #2a2a38;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  user-select: none;
}

.song-item:hover, .song-item.is-hovered {
  background: #2b2b3d;
  border-color: #3e3e56;
}

.song-item.is-playing {
  background: #142d3e;
  border-color: #00f0ff;
}

.playing-bar {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  background: #00f0ff;
  border-radius: 0 2px 2px 0;
}

.song-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.song-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #f1f1f7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.is-playing .song-name {
  color: #00f0ff;
}

.playing-icon {
  display: inline-block;
  margin-right: 4px;
  animation: pulse 1s infinite alternate;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: #8c8c9e;
}

.song-composer {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.song-difficulty {
  font-size: 0.65rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
}

.diff-beginner, .diff-easy { background: #064e3b; color: #34d399; }
.diff-intermediate { background: #78350f; color: #fbbf24; }
.diff-advanced, .diff-expert { background: #7f1d1d; color: #f87171; }

.song-tags {
  display: flex;
  gap: 4px;
}

.song-tag {
  font-size: 0.6rem;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.tag-builtin { background: #2b2b3d; color: #a0a0b0; }
.tag-uploaded { background: #581c87; color: #c084fc; }
.tag-favorite { background: #831843; color: #ff007f; }

.favorite-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #8c8c9e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.favorite-btn:hover {
  background: #36364a;
  color: #ff007f;
}

.favorite-btn.is-favorite {
  color: #ff007f;
}

.favorite-icon {
  width: 14px;
  height: 14px;
}

.song-playing-badge {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.eq-bar {
  width: 2px;
  background: #00f0ff;
  border-radius: 1px;
  animation: eqBounce 0.8s infinite ease-in-out alternate;
}

.eq-bar:nth-child(1) { height: 60%; animation-delay: 0s; }
.eq-bar:nth-child(2) { height: 100%; animation-delay: 0.2s; }
.eq-bar:nth-child(3) { height: 40%; animation-delay: 0.4s; }

@keyframes eqBounce {
  0% { height: 20%; }
  100% { height: 100%; }
}
</style>
