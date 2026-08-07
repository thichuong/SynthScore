import { ref, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { AudioEngine } from '../services/audioEngine';

export function useKeyboardShortcuts(options: {
  isReady: Ref<boolean>;
  isPlaying: Ref<boolean>;
  duration: Ref<number>;
  currentTime: Ref<number>;
  onNextSong: () => void;
  onPrevSong: () => void;
  onToggleRepeat: () => void;
  onToggleShortcutsModal: () => void;
}) {
  const toastText = ref('');
  const isToastVisible = ref(false);
  let toastTimeout: any = null;

  function showShortcutToast(msg: string) {
    toastText.value = msg;
    isToastVisible.value = true;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      isToastVisible.value = false;
    }, 1500);
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    const activeEl = document.activeElement;
    const isInputActive = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      (activeEl as HTMLElement).isContentEditable
    );

    if (isInputActive) {
      return;
    }

    const key = e.key;
    const code = e.code;
    const isShift = e.shiftKey;

    // 1. Play / Pause: Space or K or MediaPlayPause
    if ((code === 'Space' && !isShift) || key.toLowerCase() === 'k' || code === 'MediaPlayPause') {
      e.preventDefault();
      if (!options.isReady.value) return;
      if (options.isPlaying.value) {
        AudioEngine.pause();
        showShortcutToast('Tạm dừng phát');
      } else {
        AudioEngine.play();
        showShortcutToast('Đang phát nhạc');
      }
    }
    // 2. Stop: Shift + Space or S or MediaStop
    else if ((code === 'Space' && isShift) || key.toLowerCase() === 's' || code === 'MediaStop') {
      e.preventDefault();
      if (!options.isReady.value) return;
      AudioEngine.stop();
      showShortcutToast('Dừng phát nhạc');
    }
    // 3. Next song: N or Shift + ArrowRight or MediaTrackNext
    else if (key.toLowerCase() === 'n' || (code === 'ArrowRight' && isShift) || code === 'MediaTrackNext') {
      e.preventDefault();
      options.onNextSong();
      showShortcutToast('Bài tiếp theo');
    }
    // 4. Previous song: P or Shift + ArrowLeft or MediaTrackPrevious
    else if (key.toLowerCase() === 'p' || (code === 'ArrowLeft' && isShift) || code === 'MediaTrackPrevious') {
      e.preventDefault();
      options.onPrevSong();
      showShortcutToast('Bài trước đó');
    }
    // 5. Seek Forward (5s): ArrowRight or L or .
    else if ((code === 'ArrowRight' && !isShift) || key.toLowerCase() === 'l' || key === '.') {
      e.preventDefault();
      if (!options.isReady.value) return;
      const newTime = Math.min(options.duration.value, options.currentTime.value + 5);
      AudioEngine.seek(newTime);
      showShortcutToast('Tua +5s');
    }
    // 6. Seek Backward (5s): ArrowLeft or J or ,
    else if ((code === 'ArrowLeft' && !isShift) || key.toLowerCase() === 'j' || key === ',') {
      e.preventDefault();
      if (!options.isReady.value) return;
      const newTime = Math.max(0, options.currentTime.value - 5);
      AudioEngine.seek(newTime);
      showShortcutToast('Tua -5s');
    }
    // 7. Volume Up: ArrowUp
    else if (code === 'ArrowUp') {
      e.preventDefault();
      const newVol = Math.min(150, AudioEngine.masterVolume + 10);
      AudioEngine.setMasterVolume(newVol);
      showShortcutToast(`Âm lượng: ${newVol}%`);
    }
    // 8. Volume Down: ArrowDown
    else if (code === 'ArrowDown') {
      e.preventDefault();
      const newVol = Math.max(0, AudioEngine.masterVolume - 10);
      AudioEngine.setMasterVolume(newVol);
      showShortcutToast(`Âm lượng: ${newVol}%`);
    }
    // 9. Mute toggle: M
    else if (key.toLowerCase() === 'm') {
      e.preventDefault();
      const newVol = AudioEngine.toggleMute();
      if (newVol === 0) {
        showShortcutToast('Đã tắt tiếng (Mute)');
      } else {
        showShortcutToast(`Bật tiếng: ${newVol}%`);
      }
    }
    // 10. Speed Down: [
    else if (key === '[') {
      e.preventDefault();
      const newRate = Math.max(0.5, Math.round((AudioEngine.playbackRate - 0.1) * 10) / 10);
      AudioEngine.setPlaybackRate(newRate);
      showShortcutToast(`Tốc độ: ${newRate.toFixed(1)}x`);
    }
    // 11. Speed Up: ]
    else if (key === ']') {
      e.preventDefault();
      const newRate = Math.min(2.0, Math.round((AudioEngine.playbackRate + 0.1) * 10) / 10);
      AudioEngine.setPlaybackRate(newRate);
      showShortcutToast(`Tốc độ: ${newRate.toFixed(1)}x`);
    }
    // 12. Toggle Repeat mode: R
    else if (key.toLowerCase() === 'r') {
      e.preventDefault();
      options.onToggleRepeat();
    }
    // 13. Toggle Shortcuts guide modal: ? or H
    else if (key === '?' || key.toLowerCase() === 'h') {
      e.preventDefault();
      options.onToggleShortcutsModal();
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
  });

  return {
    toastText,
    isToastVisible,
    showShortcutToast
  };
}
