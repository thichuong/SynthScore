<template>
  <footer class="app-footer">
    <PlaybackControls 
      ref="playbackControlsRef"
      :isPlaying="isPlaying"
      :isReady="isReady"
      :currentTime="currentTime"
      :duration="duration"
      :bpm="bpm"
      :songName="songName"
      :repeatMode="repeatMode"
      :volume="volume"
      :playbackRate="playbackRate"
      @prev="emit('prev')"
      @next="emit('next')"
      @toggleRepeat="emit('toggleRepeat')"
    />
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PlaybackControls from '../../components/controls/PlaybackControls.vue';

defineProps<{
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  songName: string;
  repeatMode: 'off' | 'all' | 'one';
  volume: number;
  playbackRate: number;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'toggleRepeat'): void;
}>();

const playbackControlsRef = ref<InstanceType<typeof PlaybackControls> | null>(null);

function openExportModal() {
  playbackControlsRef.value?.openExportModal();
}

function openShortcutsModal() {
  playbackControlsRef.value?.openShortcutsModal();
}

function toggleShortcutsModal() {
  playbackControlsRef.value?.toggleShortcutsModal();
}

defineExpose({
  openExportModal,
  openShortcutsModal,
  toggleShortcutsModal
});
</script>

<style scoped>
.app-footer {
  margin-top: 16px;
  position: relative;
  z-index: 10;
}
</style>
