<template>
  <div class="playback-controls glass-card">
    <!-- Hàng 1: Tiến độ và tua thời gian -->
    <div class="progress-row">
      <button 
        class="nav-btn prev-btn" 
        @click="emit('prev')" 
        title="Bài trước (Phím P hoặc Shift+Left)"
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
        title="Bài tiếp theo (Phím N hoặc Shift+Right)"
        :disabled="!isReady"
      >
        <SkipForward class="nav-icon" />
      </button>
    </div>

    <!-- Hàng 2: Nút bấm và các thanh trượt -->
    <div class="controls-row">
      <!-- Cụm Nút Play/Pause/Stop/Repeat -->
      <div class="buttons-group">
        <button 
          class="play-btn" 
          :class="{ playing: isPlaying }"
          @click="togglePlay"
          :title="isPlaying ? 'Tạm dừng (Space / K)' : 'Phát nhạc (Space / K)'"
          :disabled="!isReady"
        >
          <Pause v-if="isPlaying" class="icon" />
          <Play v-else class="icon play-icon" />
        </button>
        
        <button 
          class="stop-btn" 
          @click="stopPlay" 
          title="Dừng phát (Shift+Space / S)"
          :disabled="!isReady"
        >
          <Square class="icon" />
        </button>

        <button 
          class="repeat-btn" 
          :class="{ active: repeatMode !== 'off', single: repeatMode === 'one' }"
          @click="emit('toggleRepeat')"
          :title="repeatMode === 'off' ? 'Chế độ Lặp lại: Tắt (Nhấn R để bật lặp danh sách)' : (repeatMode === 'all' ? 'Chế độ Lặp lại: Tất cả bài (Nhấn R để lặp 1 bài)' : 'Chế độ Lặp lại: 1 bài (Nhấn R để tắt lặp)')"
          :disabled="!isReady"
        >
          <Repeat1 v-if="repeatMode === 'one'" class="icon" />
          <Repeat v-else class="icon" />
          <span v-if="repeatMode === 'one'" class="repeat-badge">1</span>
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
          title="Tăng/Giảm tốc độ phát (Phím [ và ])"
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
          max="150" 
          v-model.number="localVolume" 
          @input="updateVolume"
          class="slider-input"
          title="Âm lượng tổng (Phím Mũi tên Lên/Xuống, M để Mute)"
        />
        <span class="slider-value">{{ localVolume }}%</span>
      </div>

      <!-- Cụm tiện ích phụ & xuất âm thanh -->
      <div class="actions-control">
        <button 
          class="shortcuts-btn"
          @click="openShortcutsModal"
          title="Bảng hướng dẫn phím tắt (Phím ? hoặc H)"
        >
          <Keyboard class="action-btn-icon" />
          <span>Phím tắt</span>
        </button>

        <button 
          class="export-btn"
          @click="openExportModal"
          :disabled="!isReady || !songName"
          title="Xuất âm thanh (WAV, MP3, FLAC, ALAC, DSD)"
        >
          <Download class="export-btn-icon" />
          <span>Xuất âm thanh</span>
        </button>
      </div>
    </div>

    <!-- Modal Xuất âm thanh -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isExportModalOpen" class="export-modal-overlay" @click.self="closeExportModal">
          <div class="export-modal-card glass-modal">
            <div class="modal-header">
              <div class="header-title-group">
                <Sparkles class="header-icon animate-pulse" />
                <h3>Xuất âm thanh chất lượng cao</h3>
              </div>
              <button class="close-btn" @click="closeExportModal">
                <X class="close-icon" />
              </button>
            </div>

            <div class="modal-body">
              <p class="modal-desc">Chọn định dạng và cấu hình để kết xuất bản nhạc <strong>{{ songName }}</strong></p>

              <!-- Chọn định dạng -->
              <div class="section-title">Định dạng đầu ra</div>
              <div class="format-cards-grid">
                <div 
                  v-for="fmt in formats" 
                  :key="fmt.id"
                  class="format-card"
                  :class="{ active: selectedFormat === fmt.id }"
                  @click="selectedFormat = fmt.id"
                >
                  <div class="format-badge" :class="fmt.id">{{ fmt.name }}</div>
                  <div class="format-info">
                    <span class="format-title">{{ fmt.label }}</span>
                    <span class="format-desc">{{ fmt.description }}</span>
                  </div>
                  <div v-if="selectedFormat === fmt.id" class="active-check">
                    <Check class="check-icon" />
                  </div>
                </div>
              </div>

              <!-- Tùy chọn chi tiết -->
              <div class="settings-section">
                <div class="section-title">
                  <Sliders class="settings-title-icon" />
                  <span>Cấu hình nâng cao</span>
                </div>
                
                <div class="settings-grid">
                  <!-- Chất lượng MP3 -->
                  <div v-if="selectedFormat === 'mp3'" class="setting-item">
                    <label for="mp3-bitrate">Tốc độ bit (Bitrate):</label>
                    <select id="mp3-bitrate" v-model="mp3Bitrate" class="settings-select">
                      <option :value="128">128 kbps (Tiêu chuẩn)</option>
                      <option :value="192">192 kbps (Chất lượng cao)</option>
                      <option :value="320">320 kbps (Cực đỉnh - HQ)</option>
                    </select>
                  </div>

                  <!-- Áp dụng Mixer -->
                  <div class="setting-item checkbox-item">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="applyMixer" />
                      <span class="checkbox-custom"></span>
                      <span class="label-text">Áp dụng cấu hình Mixer &amp; hiệu ứng Reverb hiện tại</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-secondary" @click="closeExportModal">Hủy</button>
              <button class="btn-primary" @click="startExport" :disabled="isExporting">
                <Download class="btn-icon" />
                <span>Bắt đầu xuất</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Overlay tiến độ kết xuất -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isExporting" class="export-progress-overlay">
          <div class="progress-card glass-modal">
            <div class="spinner-container">
              <div class="double-bounce1"></div>
              <div class="double-bounce2"></div>
            </div>
            <h3 class="progress-title">Đang xuất âm thanh</h3>
            <p class="progress-subtitle">{{ songName }}</p>
            
            <div class="progress-steps">
              <div class="step-item" :class="{ active: exportStep === 'preparing', completed: isStepCompleted('preparing') }">
                <span class="step-dot"></span>
                <span class="step-text">Chuẩn bị tài nguyên âm thanh...</span>
              </div>
              <div class="step-item" :class="{ active: exportStep === 'rendering', completed: isStepCompleted('rendering') }">
                <span class="step-dot"></span>
                <span class="step-text">Đang tổng hợp nhạc offline...</span>
              </div>
              <div class="step-item" :class="{ active: exportStep === 'encoding', completed: isStepCompleted('encoding') }">
                <span class="step-dot"></span>
                <span class="step-text">Nén và mã hóa định dạng {{ selectedFormat.toUpperCase() }}...</span>
              </div>
              <div class="step-item" :class="{ active: exportStep === 'done', completed: isStepCompleted('done') }">
                <span class="step-dot"></span>
                <span class="step-text">Hoàn tất &amp; Tải xuống tệp tin!</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal Hướng dẫn Phím tắt Media -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="isShortcutsModalOpen" class="shortcuts-modal-overlay" @click.self="closeShortcutsModal">
          <div class="shortcuts-modal-card glass-modal">
            <div class="modal-header">
              <div class="header-title-group">
                <Keyboard class="header-icon animate-pulse" />
                <h3>Bảng Hướng Dẫn Phím Tắt Media</h3>
              </div>
              <button class="close-btn" @click="closeShortcutsModal">
                <X class="close-icon" />
              </button>
            </div>

            <div class="modal-body">
              <div class="shortcuts-grid">
                <!-- Nhóm 1: Điều khiển phát nhạc -->
                <div class="shortcuts-group">
                  <div class="group-title">
                    <Music class="group-icon" />
                    <span>Phát &amp; Điều khiển</span>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Phát / Tạm dừng</span>
                    <div class="key-badges">
                      <kbd>Space</kbd>
                      <kbd>K</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Dừng phát</span>
                    <div class="key-badges">
                      <kbd>Shift + Space</kbd>
                      <kbd>S</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Bài tiếp theo (Next)</span>
                    <div class="key-badges">
                      <kbd>N</kbd>
                      <kbd>Shift + →</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Bài trước đó (Prev)</span>
                    <div class="key-badges">
                      <kbd>P</kbd>
                      <kbd>Shift + ←</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Chế độ Lặp lại (Off / All / One)</span>
                    <div class="key-badges">
                      <kbd>R</kbd>
                    </div>
                  </div>
                </div>

                <!-- Nhóm 2: Tua & Âm lượng & Tốc độ -->
                <div class="shortcuts-group">
                  <div class="group-title">
                    <Sliders class="group-icon" />
                    <span>Âm lượng &amp; Tua nhạc</span>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Tua tới / lùi 5 giây</span>
                    <div class="key-badges">
                      <kbd>←</kbd> <kbd>→</kbd> hoặc <kbd>J</kbd> <kbd>L</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Tăng / giảm âm lượng (±10%)</span>
                    <div class="key-badges">
                      <kbd>↑</kbd> <kbd>↓</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Tắt / bật tiếng (Mute)</span>
                    <div class="key-badges">
                      <kbd>M</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Tăng / giảm tốc độ (±0.1x)</span>
                    <div class="key-badges">
                      <kbd>[</kbd> <kbd>]</kbd>
                    </div>
                  </div>
                  <div class="shortcut-item">
                    <span class="shortcut-desc">Xem bảng phím tắt này</span>
                    <div class="key-badges">
                      <kbd>?</kbd> hoặc <kbd>H</kbd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-primary" @click="closeShortcutsModal">Đã hiểu</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { 
  Play, Pause, Square, Volume2, Gauge, Music, SkipBack, SkipForward, 
  Download, X, Check, Sliders, Sparkles, Repeat, Repeat1, Keyboard 
} from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';

const props = withDefaults(defineProps<{
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  songName: string;
  repeatMode?: 'off' | 'all' | 'one';
  volume?: number;
  playbackRate?: number;
}>(), {
  repeatMode: 'off',
  volume: 100,
  playbackRate: 1.0
});

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'toggleRepeat'): void;
}>();

const progressBarRef = ref<HTMLDivElement | null>(null);
const localPlaybackRate = ref(props.playbackRate);
const localVolume = ref(props.volume);
const isShortcutsModalOpen = ref(false);

// Đồng bộ 2 chiều slider UI khi giá trị volume / playbackRate thay đổi từ phím tắt hoặc AudioEngine
watch(() => props.volume, (newVol) => {
  if (newVol !== undefined) {
    localVolume.value = newVol;
  }
}, { immediate: true });

watch(() => props.playbackRate, (newRate) => {
  if (newRate !== undefined) {
    localPlaybackRate.value = newRate;
  }
}, { immediate: true });

function openShortcutsModal() {
  isShortcutsModalOpen.value = true;
}

function closeShortcutsModal() {
  isShortcutsModalOpen.value = false;
}

defineExpose({
  openShortcutsModal,
  closeShortcutsModal,
  toggleShortcutsModal: () => { isShortcutsModalOpen.value = !isShortcutsModalOpen.value; }
});

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

// Logic xuất bản nhạc
const isExportModalOpen = ref(false);
const isExporting = ref(false);
const selectedFormat = ref<'wav' | 'mp3' | 'flac' | 'alac' | 'dsd'>('mp3');
const mp3Bitrate = ref(320);
const applyMixer = ref(true);
const exportStep = ref<'preparing' | 'rendering' | 'encoding' | 'done'>('preparing');

const formats = [
  { id: 'mp3', name: 'MP3', label: 'MP3 Compressed', description: 'Định dạng phổ biến, kích thước nhỏ gọn phù hợp chia sẻ' },
  { id: 'flac', name: 'FLAC', label: 'FLAC Lossless', description: 'Nén không mất dữ liệu, tương thích cao (xuất dạng PCM lossless)' },
  { id: 'alac', name: 'ALAC', label: 'Apple Lossless', description: 'Tối ưu hóa cho hệ sinh thái Apple (xuất dạng PCM lossless)' },
  { id: 'wav', name: 'WAV', label: 'WAV Lossless PCM', description: 'Âm thanh chất lượng phòng thu, không nén (16-bit / 44.1 kHz)' },
  { id: 'dsd', name: 'DSD', label: 'DSD64 (DSF)', description: 'Chất lượng Audiophile siêu cao cấp 1-bit / 2.8224 MHz' }
] as const;

function openExportModal() {
  isExportModalOpen.value = true;
}

function closeExportModal() {
  if (isExporting.value) return;
  isExportModalOpen.value = false;
}

function isStepCompleted(step: 'preparing' | 'rendering' | 'encoding' | 'done'): boolean {
  const stepsOrder = ['preparing', 'rendering', 'encoding', 'done'];
  const currentIdx = stepsOrder.indexOf(exportStep.value);
  const stepIdx = stepsOrder.indexOf(step);
  return stepIdx < currentIdx;
}

async function startExport() {
  if (isExporting.value) return;
  isExporting.value = true;
  exportStep.value = 'preparing';
  
  try {
    const { blob, fileName } = await AudioEngine.exportAudio(
      selectedFormat.value,
      { mp3Bitrate: mp3Bitrate.value, applyMixer: applyMixer.value },
      (step) => {
        exportStep.value = step;
      }
    );
    
    // Tải file xuống
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    setTimeout(() => {
      isExporting.value = false;
      isExportModalOpen.value = false;
    }, 1000);
  } catch (error) {
    console.error('Lỗi khi xuất âm thanh:', error);
    alert(`Không thể xuất âm thanh: ${error instanceof Error ? error.message : error}`);
    isExporting.value = false;
  }
}
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

/* styles cho cụm xuất âm thanh */
.export-control {
  margin-left: 10px;
  display: flex;
  align-items: center;
}

.export-btn {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
  color: #0b0b12;
  font-weight: 600;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.2);
}

.export-btn:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 0 18px rgba(0, 240, 255, 0.45);
}

.export-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}

.export-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.2);
  box-shadow: none;
  cursor: not-allowed;
}

.export-btn-icon {
  width: 14px;
  height: 14px;
}

/* Modal overlays & cards */
.export-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.7);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.export-modal-card {
  width: 100%;
  max-width: 580px;
  background: rgba(18, 18, 26, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalScaleIn {
  from {
    transform: scale(0.9) translateY(10px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  color: #00f0ff;
  width: 20px;
  height: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.close-icon {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: 70vh;
}

.modal-desc {
  font-size: 0.85rem;
  color: #a0a0b0;
  margin-bottom: 20px;
  line-height: 1.5;
  text-align: left;
}

.modal-desc strong {
  color: #ffffff;
}

.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #8c8c9e;
  margin-bottom: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
}

.format-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.format-card {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
}

.format-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.format-card.active {
  background: rgba(0, 240, 255, 0.03);
  border-color: rgba(0, 240, 255, 0.3);
}

.format-badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 6px;
  width: 54px;
  text-align: center;
  flex-shrink: 0;
}

.format-badge.wav { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); }
.format-badge.mp3 { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
.format-badge.flac { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }
.format-badge.alac { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }
.format-badge.dsd { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.25); }

.format-info {
  margin-left: 14px;
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-right: 20px;
}

.format-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.format-desc {
  font-size: 0.72rem;
  color: #8c8c9e;
}

.active-check {
  background: #00f0ff;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.5);
}

.check-icon {
  width: 12px;
  height: 12px;
  color: #0b0b12;
  stroke-width: 3px;
}

.settings-section {
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 16px;
}

.settings-title-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.setting-item label {
  font-size: 0.75rem;
  color: #a0a0b0;
  font-weight: 500;
}

.settings-select {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  color: #ffffff;
  font-size: 0.8rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.settings-select:focus {
  border-color: #00f0ff;
}

.checkbox-item {
  flex-direction: row !important;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  font-size: 0.78rem !important;
  color: #ffffff !important;
}

.checkbox-label input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  height: 16px;
  width: 16px;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox-label:hover input ~ .checkbox-custom {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.checkbox-label input:checked ~ .checkbox-custom {
  background-color: #00f0ff;
  border-color: #00f0ff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.checkbox-custom:after {
  content: "";
  position: absolute;
  display: none;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid #0b0b12;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-label input:checked ~ .checkbox-custom:after {
  display: block;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a0a0b0;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.btn-primary {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  border: none;
  color: #0b0b12;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.35);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

/* Progress Overlay styles */
.export-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.85);
  backdrop-filter: blur(12px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.progress-card {
  width: 100%;
  max-width: 440px;
  background: rgba(18, 18, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.spinner-container {
  width: 50px;
  height: 50px;
  position: relative;
  margin: 0 auto 20px;
}

.double-bounce1, .double-bounce2 {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #00f0ff;
  opacity: 0.6;
  position: absolute;
  top: 0;
  left: 0;
  animation: bounceAnimation 2.0s infinite ease-in-out;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);
}

.double-bounce2 {
  animation-delay: -1.0s;
  background-color: #0072ff;
}

@keyframes bounceAnimation {
  0%, 100% { 
    transform: scale(0.0);
  } 50% { 
    transform: scale(1.0);
  }
}

.progress-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.progress-subtitle {
  font-size: 0.8rem;
  color: #8c8c9e;
  margin-bottom: 24px;
}

.progress-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
  max-width: 320px;
  margin: 0 auto;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0.35;
  transition: all 0.3s;
}

.step-item.active {
  opacity: 1;
}

.step-item.completed {
  opacity: 0.85;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
  transition: all 0.3s;
  position: relative;
}

.step-item.active .step-dot {
  background: #00f0ff;
  box-shadow: 0 0 8px #00f0ff;
  transform: scale(1.25);
}

.step-item.active .step-dot::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid #00f0ff;
  border-radius: 50%;
  top: -5px;
  left: -5px;
  animation: pulseOut 1.5s infinite ease-out;
}

@keyframes pulseOut {
  from { transform: scale(0.5); opacity: 1; }
  to { transform: scale(1.5); opacity: 0; }
}

.step-item.completed .step-dot {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.step-text {
  font-size: 0.78rem;
  color: #a0a0b0;
  font-weight: 500;
  transition: all 0.3s;
}

.step-item.active .step-text {
  color: #ffffff;
  font-weight: 600;
}

.step-item.completed .step-text {
  color: #8c8c9e;
  text-decoration: none;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Nút Lặp lại (Repeat Button) */
.repeat-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #8c8c9e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.repeat-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.repeat-btn.active {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.4);
  color: #00f0ff;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
}

.repeat-btn.single {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
  color: #c084fc;
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.3);
}

.repeat-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 0.55rem;
  font-weight: 800;
  line-height: 1;
  color: #ffffff;
  background: #a855f7;
  border-radius: 50%;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Cụm tiện ích phụ */
.actions-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shortcuts-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.shortcuts-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.3);
  color: #00f0ff;
  transform: translateY(-1px);
}

.action-btn-icon {
  width: 15px;
  height: 15px;
}

/* Shortcuts Modal Overlay & Card */
.shortcuts-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.75);
  backdrop-filter: blur(10px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.shortcuts-modal-card {
  width: 100%;
  max-width: 680px;
  background: rgba(18, 18, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 640px) {
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
}

.shortcuts-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #00f0ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 8px;
}

.group-icon {
  width: 16px;
  height: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.78rem;
}

.shortcut-desc {
  color: #cbd5e1;
  font-weight: 500;
}

.key-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  font-weight: 700;
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}
</style>
