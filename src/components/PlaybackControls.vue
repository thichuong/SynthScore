<template>
  <div class="playback-controls glass-card">
    <!-- Hàng 1: Tiến độ và tua thời gian -->
    <div class="progress-row">
      <button 
        class="nav-btn prev-btn" 
        @click="emit('prev')" 
        title="Bài trước"
        :disabled="!isReady"
      >
        <SkipBack class="nav-icon" />
      </button>

      <span class="time-label">{{ formatTime(currentTime) }}</span>
      
      <div class="progress-bar-container" @click="handleProgressClick" ref="progressBarRef">
        <div class="progress-bar-bg"></div>
        <div 
          class="progress-bar-fill" 
          :style="{ width: `${progressPercent}%` }"
        ></div>
        <div 
          class="progress-handle" 
          :style="{ left: `${progressPercent}%` }"
        ></div>
      </div>

      <span class="time-label">{{ formatTime(duration) }}</span>

      <button 
        class="nav-btn next-btn" 
        @click="emit('next')" 
        title="Bài tiếp theo"
        :disabled="!isReady"
      >
        <SkipForward class="nav-icon" />
      </button>
    </div>

    <!-- Hàng 2: Nút bấm và các thanh trượt -->
    <div class="controls-row">
      <!-- Cụm Nút Play/Pause/Stop -->
      <div class="buttons-group">
        <button 
          class="play-btn" 
          :class="{ playing: isPlaying }"
          @click="togglePlay"
          :title="isPlaying ? 'Tạm dừng' : 'Phát nhạc'"
          :disabled="!isReady"
        >
          <Pause v-if="isPlaying" class="icon" />
          <Play v-else class="icon play-icon" />
        </button>
        
        <button 
          class="stop-btn" 
          @click="stopPlay" 
          title="Dừng phát"
          :disabled="!isReady"
        >
          <Square class="icon" />
        </button>
      </div>

      <!-- Tên bài nhạc hiện tại -->
      <div class="song-title-display">
        <Music class="title-icon" />
        <span class="title-text">{{ songName || 'Chưa nạp bài hát' }}</span>
      </div>

      <!-- Trực Quan Hóa Tần Số (Audio Spectrum) -->
      <div class="mini-spectrum-container">
        <canvas ref="spectrumCanvasRef" class="mini-spectrum-canvas"></canvas>
      </div>

      <!-- Điều khiển Tốc độ (Tempo) -->
      <div class="slider-control speed-control">
        <Gauge class="slider-icon" />
        <span class="slider-label">Tốc độ:</span>
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1" 
          v-model.number="localPlaybackRate" 
          @input="updatePlaybackRate"
          class="slider-input"
        />
        <span class="slider-value">{{ localPlaybackRate.toFixed(1) }}x ({{ Math.round(bpm * localPlaybackRate) }} BPM)</span>
      </div>

      <!-- Điều khiển Âm lượng tổng (Master Volume) -->
      <div class="slider-control volume-control">
        <Volume2 class="slider-icon" />
        <span class="slider-label">Âm lượng:</span>
        <input 
          type="range" 
          min="0" 
          max="100" 
          v-model.number="localVolume" 
          @input="updateVolume"
          class="slider-input"
        />
        <span class="slider-value">{{ localVolume }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { Play, Pause, Square, Volume2, Gauge, Music, SkipBack, SkipForward } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';

const props = defineProps<{
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  songName: string;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

const progressBarRef = ref<HTMLDivElement | null>(null);
const localPlaybackRate = ref(1.0);
const localVolume = ref(AudioEngine.masterVolume);

// Tính phần trăm tiến độ
const progressPercent = computed(() => {
  if (props.duration <= 0) return 0;
  return (props.currentTime / props.duration) * 100;
});

// Đồng bộ khi bài hát thay đổi
watch(() => props.songName, () => {
  localPlaybackRate.value = 1.0;
});

// Định dạng giây thành MM:SS
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function togglePlay() {
  if (props.isPlaying) {
    AudioEngine.pause();
  } else {
    AudioEngine.play();
  }
}

function stopPlay() {
  AudioEngine.stop();
}

function updatePlaybackRate() {
  AudioEngine.setPlaybackRate(localPlaybackRate.value);
}

function updateVolume() {
  AudioEngine.setMasterVolume(localVolume.value);
}

// Xử lý tua bài hát bằng click vào thanh tiến độ
function handleProgressClick(event: MouseEvent) {
  if (!progressBarRef.value || props.duration <= 0) return;
  
  const rect = progressBarRef.value.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  
  let percent = clickX / width;
  percent = Math.max(0, Math.min(1, percent)); // giới hạn 0-1
  
  const targetSeconds = percent * props.duration;
  AudioEngine.seek(targetSeconds);
}

const spectrumCanvasRef = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;
let dataArray = new Uint8Array(0);
let peaks: number[] = [];

function startSpectrum() {
  const canvas = spectrumCanvasRef.value;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const handleResize = () => {
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = (rect?.width || 140) * window.devicePixelRatio;
    canvas.height = (rect?.height || 38) * window.devicePixelRatio;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  };
  
  handleResize();
  window.addEventListener('resize', handleResize);

  const drawLoop = () => {
    if (!canvas || !ctx) return;
    drawMiniSpectrum(canvas, ctx);
    animationFrameId = requestAnimationFrame(drawLoop);
  };
  animationFrameId = requestAnimationFrame(drawLoop);
  
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
  });
}

function drawMiniSpectrum(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  const analyser = AudioEngine.analyser;
  if (!analyser) {
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    return;
  }

  const bufferLength = analyser.frequencyBinCount;
  if (dataArray.length !== bufferLength) {
    dataArray = new Uint8Array(bufferLength);
  }

  analyser.getByteFrequencyData(dataArray);

  const barWidth = (w / bufferLength) * 2.0;
  let barHeight;
  let x = 0;

  const gradient = ctx.createLinearGradient(0, h, 0, 0);
  gradient.addColorStop(0, '#0072ff');
  gradient.addColorStop(0.5, '#00f0ff');
  gradient.addColorStop(1, '#ff007f');

  for (let i = 0; i < bufferLength; i++) {
    barHeight = (dataArray[i] / 255) * h * 0.85;

    if (peaks[i] === undefined || barHeight > peaks[i]) {
      peaks[i] = barHeight;
    } else {
      peaks[i] = Math.max(0, peaks[i] - 0.8);
    }

    ctx.fillStyle = gradient;
    const rx = x;
    const ry = h - barHeight;
    const rw = barWidth - 1;
    const rh = barHeight;

    if (rh > 1) {
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, [2, 2, 0, 0]);
      ctx.fill();
    }

    x += barWidth;
  }
}

onMounted(() => {
  startSpectrum();
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
.playback-controls {
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  background: rgba(18, 18, 24, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  gap: 12px;
}

/* Hàng tiến độ phát */
.progress-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.time-label {
  font-size: 0.75rem;
  color: #8c8c9e;
  font-family: monospace;
  width: 40px;
}

.progress-bar-container {
  flex: 1;
  height: 12px;
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.progress-bar-bg {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  transition: height 0.2s ease;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background: linear-gradient(90deg, #00f0ff 0%, #0072ff 100%);
  border-radius: 2px;
  transition: height 0.2s ease;
}

.progress-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #00f0ff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.8);
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.1s ease;
  pointer-events: none;
}

.progress-bar-container:hover .progress-bar-bg,
.progress-bar-container:hover .progress-bar-fill {
  height: 6px;
}

.progress-bar-container:hover .progress-handle {
  opacity: 1;
}

/* Hàng phím bấm và các thanh trượt */
.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.buttons-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 240, 255, 0.35);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.play-btn:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 0 4px 20px rgba(0, 240, 255, 0.5);
}

.play-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  color: #606070;
  box-shadow: none;
  cursor: not-allowed;
}

.play-icon {
  transform: translateX(2px);
}

.stop-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0b0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-btn:hover:not(:disabled) {
  background: rgba(255, 59, 48, 0.1);
  border-color: rgba(255, 59, 48, 0.3);
  color: #ff3b30;
}

.stop-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon {
  width: 16px;
  height: 16px;
}

/* Hiển thị Tên Bài hát */
.song-title-display {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 250px;
  min-width: 0;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.title-icon {
  width: 14px;
  height: 14px;
  color: #ff007f;
  flex-shrink: 0;
}

.title-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-spectrum-container {
  width: 140px;
  height: 38px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-spectrum-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* Các cụm điều khiển slide */
.slider-control {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.slider-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

.slider-label {
  font-size: 0.75rem;
  color: #a0a0b0;
  font-weight: 500;
}

.slider-input {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  outline: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00f0ff;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.4);
}

.slider-value {
  font-size: 0.75rem;
  color: #ffffff;
  font-weight: 600;
  width: 120px;
  white-space: nowrap;
  font-family: monospace;
}

.volume-control .slider-value {
  width: 40px;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a0b0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  outline: none;
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.35);
  color: #00f0ff;
  transform: scale(1.08);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.nav-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.nav-icon {
  width: 14px;
  height: 14px;
}
</style>
