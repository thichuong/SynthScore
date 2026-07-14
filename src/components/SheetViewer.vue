<template>
  <div class="sheet-viewer glass-card">
    <div class="viewer-header">
      <div class="viewer-tabs">
        <button 
          v-if="hasSheet"
          class="tab-btn" 
          :class="{ active: activeTab === 'sheet' }"
          @click="activeTab = 'sheet'"
        >
          <Music class="icon" /> Bản Nhạc (Sheet Music)
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'visualizer' }"
          @click="activeTab = 'visualizer'"
        >
          <Layers class="icon" /> Thác Nốt Nhạc (Falling Notes)
        </button>
      </div>

      <div class="viewer-actions">
        <div class="viewer-status" v-if="loading">
          <span class="spinner"></span> Đang tải bản nhạc...
        </div>

        <button 
          class="viewer-play-btn" 
          :class="{ playing: isPlaying }"
          @click="togglePlay"
          :title="isPlaying ? 'Tạm dừng' : 'Phát nhạc'"
          :disabled="!isReady"
        >
          <Pause v-if="isPlaying" class="icon" />
          <Play v-else class="icon play-icon" />
        </button>
      </div>
    </div>

    <div class="viewer-body" @click="togglePlay">
      <!-- Container hiển thị Sheet Music (MusicXML) -->
      <div 
        v-show="activeTab === 'sheet' && fileType === 'xml'" 
        ref="osmdContainer" 
        class="osmd-container"
      ></div>

      <!-- Container hiển thị ABC Notation -->
      <div 
        v-show="activeTab === 'sheet' && fileType === 'abc'" 
        id="abc-container" 
        class="abc-container"
      ></div>

      <!-- Container hiển thị Falling Notes Visualizer -->
      <div 
        v-show="activeTab === 'visualizer' || !hasSheet" 
        class="canvas-container"
      >
        <canvas ref="visualizerCanvas" class="visualizer-canvas"></canvas>
      </div>
    </div>

    <!-- Overlay Icon Phát/Tạm Dừng khi click màn hình -->
    <Transition name="fade-scale">
      <div v-if="overlayIcon" class="click-feedback-overlay">
        <div class="feedback-icon-circle">
          <Play v-if="overlayIcon === 'play'" class="feedback-icon play-icon" />
          <Pause v-else class="feedback-icon" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { Midi } from '@tonejs/midi';
import { Music, Layers, Play, Pause } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  isPlaying: boolean;
  currentTime: number;
  isReady: boolean;
}>();

const overlayIcon = ref<'play' | 'pause' | null>(null);
let overlayTimeoutId: number | null = null;

function triggerClickFeedback(type: 'play' | 'pause') {
  overlayIcon.value = type;
  if (overlayTimeoutId !== null) {
    clearTimeout(overlayTimeoutId);
  }
  overlayTimeoutId = window.setTimeout(() => {
    overlayIcon.value = null;
    overlayTimeoutId = null;
  }, 500);
}

function togglePlay() {
  if (!props.isReady) return;
  if (props.isPlaying) {
    AudioEngine.pause();
    triggerClickFeedback('pause');
  } else {
    AudioEngine.play();
    triggerClickFeedback('play');
  }
}

const osmdContainer = ref<HTMLDivElement | null>(null);
const visualizerCanvas = ref<HTMLCanvasElement | null>(null);

const activeTab = ref<'sheet' | 'visualizer'>('visualizer');
const loading = ref(false);
let osmd: OpenSheetMusicDisplay | null = null;
let animationFrameId: number | null = null;

// Kiểm tra xem bài hát hiện tại có hỗ trợ hiển thị bản nhạc nốt nhạc không
const hasSheet = computed(() => {
  return props.fileType === 'xml' || props.fileType === 'abc';
});

// Watch thay đổi dữ liệu text bản nhạc (MusicXML hoặc ABC) để render lại sheet music
watch(() => props.rawText, async (newText) => {
  if (!newText) {
    clearSheetMusic();
    return;
  }
  
  loading.value = true;
  // Cho phép Vue cập nhật DOM trước khi render
  setTimeout(async () => {
    try {
      await renderSheetMusic();
    } catch (e) {
      console.error('Lỗi khi hiển thị bản nhạc:', e);
    } finally {
      loading.value = false;
    }
  }, 100);
});

// Watch thay đổi dữ liệu MIDI để khởi chạy lại Falling Notes visualizer
watch(() => props.fileData, (newData) => {
  if (!newData) {
    clearVisualizer();
    return;
  }
  
  // Tự động chuyển tab dựa trên việc có hỗ trợ bản nhạc không
  if (hasSheet.value) {
    activeTab.value = 'sheet';
  } else {
    activeTab.value = 'visualizer';
  }

  renderVisualizer();
});

// Khởi chạy vòng lặp hoạt ảnh vẽ Falling Notes
watch(() => activeTab.value, (newTab) => {
  if (newTab === 'visualizer') {
    startAnimation();
  } else {
    stopAnimation();
  }
});


// Xóa trắng bản nhạc cũ
function clearSheetMusic() {
  if (osmdContainer.value) osmdContainer.value.innerHTML = '';
  const abcContainer = document.getElementById('abc-container');
  if (abcContainer) abcContainer.innerHTML = '';
}

// Dừng visualizer
function clearVisualizer() {
  stopAnimation();
}

// Render bản nhạc dựa trên định dạng
async function renderSheetMusic() {
  clearSheetMusic();

  if (props.fileType === 'xml' && props.rawText && osmdContainer.value) {
    const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
    osmd = new OpenSheetMusicDisplay(osmdContainer.value, {
      autoResize: true,
      backend: 'canvas',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true
    });

    await osmd.load(props.rawText);
    osmd.render();
  } 
  else if (props.fileType === 'abc' && props.rawText) {
    const abcjs = await import('abcjs');
    abcjs.default.renderAbc('abc-container', props.rawText, {
      responsive: 'resize',
      add_classes: true,
    });
  }
}

// Render visualizer canvas
function renderVisualizer() {
  if (visualizerCanvas.value) {
    initCanvas();
    startAnimation();
  }
}

// --- LOGIC PHÁT NỐT NHẠC RƠI (FALLING NOTES PIANO ROLL) ---
interface RenderNote {
  midi: number;
  time: number;
  duration: number;
  trackIndex: number;
}

let midiNotes: RenderNote[] = [];
let maxMidi = 88;
let minMidi = 36;

// Phân tích tệp MIDI để lấy danh sách nốt nhạc vẽ lên canvas
async function parseMidiForVisualizer() {
  midiNotes = [];
  if (!props.fileData) return;

  try {
    let arrayBuffer: ArrayBuffer;
    if (props.fileData instanceof Uint8Array) {
      arrayBuffer = (props.fileData.buffer as ArrayBuffer).slice(
        props.fileData.byteOffset,
        props.fileData.byteOffset + props.fileData.byteLength
      );
    } else {
      // Trường hợp tệp là text (ABC/XML), chuyển đổi thành MIDI bằng parser của chúng ta
      if (props.fileType === 'abc') {
        const abcjs = await import('abcjs');
        const midiBin = abcjs.default.synth.getMidiFile(props.rawText || '', { midiOutputType: 'binary' }) as any;
        arrayBuffer = midiBin.buffer as ArrayBuffer;
      } else {
        // XML
        return; 
      }
    }

    const midi = new Midi(arrayBuffer);
    let tempMin = 127;
    let tempMax = 0;

    midi.tracks.forEach((track, trackIndex) => {
      track.notes.forEach(note => {
        midiNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          trackIndex: trackIndex
        });

        if (note.midi < tempMin) tempMin = note.midi;
        if (note.midi > tempMax) tempMax = note.midi;
      });
    });

    // Căn chuẩn phím đàn
    minMidi = Math.max(21, tempMin - 5);
    maxMidi = Math.min(108, tempMax + 5);
    if (minMidi >= maxMidi) {
      minMidi = 36;
      maxMidi = 88;
    }
  } catch (e) {
    console.error('Không thể parse dữ liệu nốt nhạc vẽ Canvas:', e);
  }
}

function initCanvas() {
  const canvas = visualizerCanvas.value;
  if (!canvas) return;

  const rect = canvas.parentElement?.getBoundingClientRect();
  canvas.width = (rect?.width || 800) * window.devicePixelRatio;
  canvas.height = (rect?.height || 500) * window.devicePixelRatio;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

// Bảng màu Neon cho các track nhạc cụ khác nhau
const NEON_COLORS = [
  '#00f0ff', // Cyan
  '#ff007f', // Pink
  '#ffaa00', // Gold/Orange
  '#39ff14', // Neon Green
  '#8a2be2', // Neon Purple
  '#ff3b30', // Neon Red
  '#00ffcc', // Mint
  '#e2f105', // Neon Yellow
];

function startAnimation() {
  parseMidiForVisualizer();
  stopAnimation();
  
  const canvas = visualizerCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const renderLoop = () => {
    drawVisualizer(canvas, ctx);
    animationFrameId = requestAnimationFrame(renderLoop);
  };
  animationFrameId = requestAnimationFrame(renderLoop);
}

function stopAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// === TỐI ƯU: Binary Search tìm nốt trong cửa sổ hiển thị ===
// Tìm chỉ mục đầu tiên trong midiNotes có time >= targetTime
function binarySearchFirstNoteIndex(targetTime: number): number {
  let lo = 0, hi = midiNotes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    // Nốt kết thúc trước targetTime → bỏ qua
    if (midiNotes[mid].time + midiNotes[mid].duration < targetTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// Vẽ Thác Nốt Nhạc (Falling Notes Piano Roll) — Phiên bản tối ưu
function drawVisualizer(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width;
  const h = canvas.height;
  const pianoHeight = h * 0.18;
  const playAreaHeight = h - pianoHeight;

  // Xóa màn hình với màu tối dịu
  ctx.fillStyle = '#0f0f15';
  ctx.fillRect(0, 0, w, h);

  // Vẽ các đường ngăn cách phím dọc nền mờ ảo
  const keyCount = maxMidi - minMidi + 1;
  const keyWidth = w / keyCount;

  ctx.strokeStyle = '#1e1e2d';
  ctx.lineWidth = 1;
  for (let i = 0; i <= keyCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * keyWidth, 0);
    ctx.lineTo(i * keyWidth, playAreaHeight);
    ctx.stroke();
  }

  // Tốc độ trôi của nốt nhạc (pixels mỗi giây)
  const VISIBLE_SECONDS = 4.0;
  const speed = h / VISIBLE_SECONDS; // Hiển thị 4 giây bài hát trên màn hình
  const curTime = props.currentTime;

  // Mảng lưu trạng thái phím piano đang kích hoạt
  const activeKeys = new Set<number>();

  // === TỐI ƯU: Chỉ duyệt nốt trong cửa sổ thời gian hiển thị ===
  // Cửa sổ hiển thị: [curTime - marginBehind, curTime + VISIBLE_SECONDS]
  const marginBehind = 1.0; // Hiển thị thêm 1 giây phía sau (nốt đang phát)
  const windowStart = curTime - marginBehind;
  const windowEnd = curTime + VISIBLE_SECONDS;

  // Binary search tìm chỉ mục bắt đầu
  const startIdx = binarySearchFirstNoteIndex(windowStart);

  // Đếm số nốt visible trước để quyết định bật/tắt shadow
  let visibleCount = 0;
  for (let i = startIdx; i < midiNotes.length; i++) {
    const note = midiNotes[i];
    if (note.time > windowEnd) break;
    visibleCount++;
  }

  // Tắt shadowBlur khi quá nhiều nốt hiển thị đồng thời (> 200) → giảm tải GPU
  const useShadow = visibleCount <= 200;

  // Vẽ các nốt nhạc rơi tự do — chỉ duyệt phạm vi [startIdx, ...]
  for (let i = startIdx; i < midiNotes.length; i++) {
    const note = midiNotes[i];
    // Nốt bắt đầu sau cửa sổ hiển thị → dừng duyệt
    if (note.time > windowEnd) break;

    // Tính tọa độ Y
    const yStart = playAreaHeight - (note.time - curTime) * speed - note.duration * speed;
    const yEnd = playAreaHeight - (note.time - curTime) * speed;

    if (yEnd < 0 || yStart > playAreaHeight) continue; // Nằm ngoài màn hình vẽ

    // Xác định xem nốt có đang nhấn hay không
    if (curTime >= note.time && curTime <= note.time + note.duration) {
      activeKeys.add(note.midi);
    }

    const noteX = (note.midi - minMidi) * keyWidth;
    const noteY = Math.max(0, yStart);
    const noteW = keyWidth - 2;
    const noteH = yEnd - Math.max(0, yStart);

    // Vẽ nốt với dải màu Neon phát sáng nhẹ
    const colorIndex = note.trackIndex % NEON_COLORS.length;
    const color = NEON_COLORS[colorIndex];

    ctx.fillStyle = color;
    if (useShadow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    
    // Bo góc nốt nhạc
    const radius = Math.min(noteW / 2, 5);
    ctx.beginPath();
    ctx.roundRect(noteX, noteY, noteW, noteH, radius);
    ctx.fill();
    
    if (useShadow) {
      ctx.shadowBlur = 0; // Tắt phát sáng để tối ưu vẽ tiếp
    }
  }

  // Đảm bảo shadow đã tắt trước khi vẽ phím piano
  ctx.shadowBlur = 0;

  // Vẽ phím Piano Keyboard ở đáy canvas
  ctx.fillStyle = '#161622';
  ctx.fillRect(0, playAreaHeight, w, pianoHeight);

  // Phân biệt phím trắng đen
  const blackKeys = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

  for (let m = minMidi; m <= maxMidi; m++) {
    const isBlack = blackKeys.includes(m % 12);
    const x = (m - minMidi) * keyWidth;
    const isActive = activeKeys.has(m);

    if (isBlack) {
      ctx.fillStyle = isActive ? '#ff007f' : '#000000';
      ctx.fillRect(x + 1, playAreaHeight, keyWidth - 2, pianoHeight * 0.65);
    } else {
      ctx.fillStyle = isActive ? '#00f0ff' : '#ffffff';
      ctx.fillRect(x + 1, playAreaHeight + 2, keyWidth - 2, pianoHeight - 4);
      
      // Vẽ viền đen phân chia
      ctx.strokeStyle = '#d0d0d8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, playAreaHeight + 2, keyWidth - 2, pianoHeight - 4);
    }

    // Hiệu ứng phát sáng trên phím đang nhấn
    if (isActive) {
      const color = isBlack ? '#ff007f' : '#00f0ff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = color + '40'; // Độ trong suốt
      ctx.fillRect(x, playAreaHeight, keyWidth, pianoHeight);
      ctx.shadowBlur = 0;
    }
  }

  // Vẽ vạch ngăn tuyến phát nhạc
  ctx.strokeStyle = '#ff0055';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, playAreaHeight);
  ctx.lineTo(w, playAreaHeight);
  ctx.stroke();
}

onMounted(() => {
  window.addEventListener('resize', initCanvas);
  if (props.rawText) {
    renderSheetMusic();
  }
  if (props.fileData) {
    renderVisualizer();
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', initCanvas);
  stopAnimation();
  if (overlayTimeoutId !== null) {
    clearTimeout(overlayTimeoutId);
  }
});
</script>

<style scoped>
.sheet-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(26, 26, 36, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  position: relative;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(18, 18, 24, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.viewer-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.tab-btn.active {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
}

.tab-btn .icon {
  width: 14px;
  height: 14px;
}

.viewer-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #00f0ff;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 240, 255, 0.3);
  border-top-color: #00f0ff;
  border-radius: 50%;
  animation: spin 1s infinite linear;
}

.viewer-body {
  flex: 1;
  position: relative;
  overflow: auto;
  background: #111115;
  cursor: pointer;
  user-select: none;
}

.viewer-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.viewer-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  color: #ffffff;
  cursor: pointer;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.viewer-play-btn:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 0 16px rgba(0, 240, 255, 0.5);
}

.viewer-play-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.viewer-play-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  color: #606070;
  box-shadow: none;
  cursor: not-allowed;
}

.viewer-play-btn .icon {
  width: 16px;
  height: 16px;
}

.play-icon {
  transform: translateX(1px);
}

.click-feedback-overlay {
  position: absolute;
  top: 60px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 10;
}

.feedback-icon-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(15, 15, 21, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.feedback-icon {
  width: 32px;
  height: 32px;
  color: #00f0ff;
  filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.6));
}

.feedback-icon.play-icon {
  transform: translateX(2px);
}

/* Transition fade-scale */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.fade-scale-leave-to {
  opacity: 0;
  transform: scale(1.4);
}

.osmd-container {
  padding: 24px;
  background: #ffffff;
  min-height: 100%;
  border-radius: 0 0 16px 16px;
}

.abc-container {
  padding: 24px;
  background: #ffffff;
  min-height: 100%;
  color: #000;
}

.canvas-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.visualizer-canvas {
  display: block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Định dạng bản nhạc in trong OSMD/ABCJS */
:deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
