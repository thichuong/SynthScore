<template>
  <div class="canvas-container" @click="togglePlay">
    <canvas ref="visualizerCanvas" class="visualizer-canvas"></canvas>

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
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Midi } from '@tonejs/midi';
import { Play, Pause } from 'lucide-vue-next';
import { AudioEngine } from '../../services/audioEngine';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  currentTime: number;
  isPlaying?: boolean;
  isActive: boolean;
  isReady?: boolean;
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
  if (props.isReady === false) return;
  if (props.isPlaying) {
    AudioEngine.pause();
    triggerClickFeedback('pause');
  } else {
    AudioEngine.play();
    triggerClickFeedback('play');
  }
}

const visualizerCanvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;

// Nội suy thời gian mượt mà (High-Precision Time Interpolation)
let smoothTime = 0;
let lastFrameTimestamp = 0;

watch(() => props.currentTime, (newTime) => {
  const diff = Math.abs(newTime - smoothTime);
  // Nếu kéo thanh tua (Seek) hoặc tạm dừng hoặc chênh lệch quá 0.2s, gán trực tiếp
  if (diff > 0.2 || !props.isPlaying) {
    smoothTime = newTime;
  }
});

interface RenderNote {
  midi: number;
  time: number;
  duration: number;
  trackIndex: number;
}

let midiNotes: RenderNote[] = [];
let maxMidi = 88;
let minMidi = 36;
let maxNoteDuration = 10.0;

const NOTE_COLORS = [
  '#3b82f6', // Kênh 0: Violin I / Grand Piano (Xanh dương)
  '#60a5fa', // Kênh 1: Violin II (Xanh da trời)
  '#8b5cf6', // Kênh 2: Viola (Tím)
  '#a855f7', // Kênh 3: Cello (Tím thẫm)
  '#d946ef', // Kênh 4: Contrabass (Hồng cánh sen)
  '#06b6d4', // Kênh 5: Flute (Xanh ngọc)
  '#14b8a6', // Kênh 6: Oboe (Xanh ngọc lục bảo)
  '#10b981', // Kênh 7: Clarinet (Xanh lá)
  '#f59e0b', // Kênh 8: French Horn (Vàng cam)
  '#ef4444', // Kênh 9: Timpani / Bộ gõ (Đỏ tươi)
  '#ec4899', // Kênh 10: Orchestral Harp (Hồng phớt)
  '#f97316', // Kênh 11: Trumpet (Cam tươi)
  '#eab308', // Kênh 12: Trombone (Vàng chanh)
  '#84cc16', // Kênh 13: Synth Lead (Xanh lá chuối)
  '#2dd4bf', // Kênh 14: Synth Pad (Xanh lơ)
  '#c084fc', // Kênh 15: FX / Khác (Tím hoa oải hương)
];

// Pre-computed lookup cho phím đen (O(1) access)
const IS_BLACK_KEY = [false, true, false, true, false, false, true, false, true, false, true, false];

// Offscreen Canvas Caching cho phần tĩnh (Nền, đường lưới, phím nhàn rỗi)
let offscreenBgCanvas: HTMLCanvasElement | null = null;
let offscreenBgCtx: CanvasRenderingContext2D | null = null;

// Zero-allocation active keys tracking & batch rects
const activeKeysArray = new Uint8Array(128);

interface NoteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}
const batchNoteRects: NoteRect[][] = Array.from({ length: NOTE_COLORS.length }, () => []);

async function parseMidiForVisualizer() {
  midiNotes = [];
  maxNoteDuration = 10.0;
  if (!props.fileData) return;

  try {
    let arrayBuffer: ArrayBuffer;
    if (props.fileData instanceof Uint8Array) {
      arrayBuffer = (props.fileData.buffer as ArrayBuffer).slice(
        props.fileData.byteOffset,
        props.fileData.byteOffset + props.fileData.byteLength
      );
    } else {
      if (props.fileType === 'abc') {
        const abcjs = await import('abcjs');
        const midiBin = abcjs.default.synth.getMidiFile(props.rawText || '', { midiOutputType: 'binary' }) as any;
        let raw = Array.isArray(midiBin) ? midiBin[0] : midiBin;
        let uint8: Uint8Array;
        if (typeof raw === 'string') {
          uint8 = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i) & 0xff;
        } else if (raw instanceof Uint8Array) {
          uint8 = raw;
        } else if (raw && raw.buffer) {
          uint8 = new Uint8Array(raw.buffer);
        } else {
          uint8 = new Uint8Array(0);
        }
        arrayBuffer = uint8.buffer.slice(
          uint8.byteOffset,
          uint8.byteOffset + uint8.byteLength
        ) as ArrayBuffer;
      } else {
        return; 
      }
    }

    const midi = new Midi(arrayBuffer);
    let tempMin = 127;
    let tempMax = 0;

    midi.tracks.forEach((track, trackIndex) => {
      const channel = track.channel !== undefined ? track.channel : trackIndex;
      track.notes.forEach(note => {
        midiNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          trackIndex: channel
        });

        if (note.duration > maxNoteDuration) {
          maxNoteDuration = note.duration;
        }
        if (note.midi < tempMin) tempMin = note.midi;
        if (note.midi > tempMax) tempMax = note.midi;
      });
    });

    // Sắp xếp midiNotes theo thời gian bắt đầu tăng dần để tìm kiếm nhị phân chính xác
    midiNotes.sort((a, b) => a.time - b.time);

    minMidi = Math.max(21, tempMin - 5);
    maxMidi = Math.min(108, tempMax + 5);
    if (minMidi >= maxMidi) {
      minMidi = 36;
      maxMidi = 88;
    }

    // Vẽ lại nền tĩnh sau khi dải phím (minMidi / maxMidi) thay đổi
    if (visualizerCanvas.value) {
      renderStaticBackground(visualizerCanvas.value.width, visualizerCanvas.value.height);
    }
  } catch (e) {
    console.error('Không thể parse dữ liệu nốt nhạc vẽ Canvas:', e);
  }
}

function renderStaticBackground(w: number, h: number) {
  if (w <= 0 || h <= 0) return;
  if (!offscreenBgCanvas) {
    offscreenBgCanvas = document.createElement('canvas');
  }
  if (offscreenBgCanvas.width !== w || offscreenBgCanvas.height !== h) {
    offscreenBgCanvas.width = w;
    offscreenBgCanvas.height = h;
  }

  offscreenBgCtx = offscreenBgCanvas.getContext('2d', { alpha: false });
  if (!offscreenBgCtx) return;

  const ctx = offscreenBgCtx;
  const pianoHeight = h * 0.18;
  const playAreaHeight = h - pianoHeight;
  const keyCount = maxMidi - minMidi + 1;
  const keyWidth = w / keyCount;

  // 1. Phông nền tối
  ctx.fillStyle = '#0f0f15';
  ctx.fillRect(0, 0, w, h);

  // 2. Đường kẻ đệm khung hình rơi (Gom tất cả đường kẻ vào 1 path duy nhất)
  ctx.strokeStyle = '#1e1e2d';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= keyCount; i++) {
    const x = Math.round(i * keyWidth);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, playAreaHeight);
  }
  ctx.stroke();

  // 3. Khung bàn phím piano phía dưới
  ctx.fillStyle = '#161622';
  ctx.fillRect(0, playAreaHeight, w, pianoHeight);

  // 4. Phím trắng tĩnh (Gom vào 1 fill call)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let m = minMidi; m <= maxMidi; m++) {
    if (!IS_BLACK_KEY[m % 12]) {
      const x = (m - minMidi) * keyWidth;
      ctx.rect(x, playAreaHeight, keyWidth - 1, pianoHeight);
    }
  }
  ctx.fill();

  // 5. Phím đen tĩnh (Gom vào 1 fill call)
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  for (let m = minMidi; m <= maxMidi; m++) {
    if (IS_BLACK_KEY[m % 12]) {
      const x = (m - minMidi) * keyWidth;
      ctx.rect(x + 1, playAreaHeight, keyWidth - 2, pianoHeight * 0.65);
    }
  }
  ctx.fill();
}

function initCanvas() {
  const canvas = visualizerCanvas.value;
  if (!canvas) return;

  const rect = canvas.parentElement?.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rawW = rect?.width && rect.width > 0 ? rect.width : 800;
  const rawH = rect?.height && rect.height > 0 ? rect.height : 500;

  const w = Math.min(Math.floor(rawW * dpr), 2048);
  const h = Math.min(Math.floor(rawH * dpr), 2048);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  renderStaticBackground(w, h);
}

// Tìm kiếm nhị phân theo thời gian bắt đầu (mảng midiNotes được sắp xếp tăng dần theo note.time)
function binarySearchByStartTime(targetStartTime: number): number {
  let lo = 0, hi = midiNotes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (midiNotes[mid].time < targetStartTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

function drawVisualizer(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Sao chép nền tĩnh (Offscreen Canvas GPU Texture copy - 1 draw operation)
  if (offscreenBgCanvas) {
    ctx.drawImage(offscreenBgCanvas, 0, 0);
  } else {
    ctx.fillStyle = '#0f0f15';
    ctx.fillRect(0, 0, w, h);
  }

  const pianoHeight = h * 0.18;
  const playAreaHeight = h - pianoHeight;
  const keyCount = maxMidi - minMidi + 1;
  const keyWidth = w / keyCount;

  const VISIBLE_SECONDS = 4.0;
  const speed = h / VISIBLE_SECONDS;
  
  // Dùng thời gian nội suy smoothTime để chuyển động nốt rơi mượt mà 60-144 FPS
  const curTime = smoothTime;

  // Clear active keys array & batch rects mà không tạo rác bộ nhớ
  activeKeysArray.fill(0);
  for (let c = 0; c < NOTE_COLORS.length; c++) {
    batchNoteRects[c].length = 0;
  }

  const marginBehind = 2.0;
  const windowStart = curTime - marginBehind;
  const windowEnd = curTime + VISIBLE_SECONDS;

  // Bắt đầu tìm nốt có note.time >= windowStart - maxNoteDuration
  const startSearchTime = windowStart - maxNoteDuration;
  const startIdx = binarySearchByStartTime(startSearchTime);

  // 2. Gom nhóm các nốt nhạc theo màu sắc
  for (let i = startIdx; i < midiNotes.length; i++) {
    const note = midiNotes[i];
    if (note.time > windowEnd) break;

    const noteEndTime = note.time + note.duration;
    if (noteEndTime < windowStart) continue;

    // yEnd: đáy thanh nốt (thời điểm bắt đầu nốt)
    // yStart: đỉnh thanh nốt (thời điểm kết thúc nốt)
    const yEnd = playAreaHeight - (note.time - curTime) * speed;
    const yStart = playAreaHeight - (noteEndTime - curTime) * speed;

    // Bỏ qua nốt nằm hoàn toàn ngoài vùng hiển thị [0, playAreaHeight]
    if (yEnd < 0 || yStart > playAreaHeight) continue;

    // Đánh dấu phím piano đang kích hoạt
    if (curTime >= note.time && curTime <= noteEndTime) {
      if (note.midi >= 0 && note.midi < 128) {
        const colorIdx = (note.trackIndex % NOTE_COLORS.length) + 1;
        activeKeysArray[note.midi] = colorIdx;
      }
    }

    if (note.midi < minMidi || note.midi > maxMidi) continue;

    // Cắt góc (Clamping) dải hiển thị trong phạm vi [0, playAreaHeight]
    const clampedYStart = Math.max(0, yStart);
    const clampedYEnd = Math.min(playAreaHeight, yEnd);
    const noteH = clampedYEnd - clampedYStart;

    if (noteH > 0) {
      const noteX = (note.midi - minMidi) * keyWidth;
      const noteW = Math.max(1, keyWidth - 2);
      const radius = noteW > 8 ? Math.min(noteW / 2, 4) : 0;
      const colorIndex = note.trackIndex % NOTE_COLORS.length;
      batchNoteRects[colorIndex].push({ x: noteX, y: clampedYStart, w: noteW, h: noteH, r: radius });
    }
  }

  // 3. Vẽ nốt rơi theo từng mảng màu gom nhóm (Tối đa 16 draw calls cho tất cả các nốt)
  for (let c = 0; c < NOTE_COLORS.length; c++) {
    const rects = batchNoteRects[c];
    if (rects.length === 0) continue;

    ctx.fillStyle = NOTE_COLORS[c];
    ctx.beginPath();
    for (let r = 0; r < rects.length; r++) {
      const item = rects[r];
      if (item.r > 0) {
        ctx.roundRect(item.x, item.y, item.w, item.h, item.r);
      } else {
        ctx.rect(item.x, item.y, item.w, item.h);
      }
    }
    ctx.fill();
  }

  // 4. Vẽ phát sáng phím piano đang kích hoạt theo màu sắc nhạc cụ tương ứng
  for (let m = minMidi; m <= maxMidi; m++) {
    const colorIdx = activeKeysArray[m];
    if (colorIdx > 0) {
      const trackColor = NOTE_COLORS[colorIdx - 1];
      const x = (m - minMidi) * keyWidth;
      const isBlack = IS_BLACK_KEY[m % 12];

      ctx.fillStyle = trackColor;
      if (isBlack) {
        ctx.fillRect(x + 1, playAreaHeight, keyWidth - 2, pianoHeight * 0.65);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(x + 1, playAreaHeight, keyWidth - 2, 4);
      } else {
        ctx.fillRect(x, playAreaHeight, keyWidth - 1, pianoHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(x, playAreaHeight, keyWidth - 1, 5);
      }
    }
  }
}

function startAnimation() {
  if (!props.isActive || (typeof document !== 'undefined' && document.hidden)) {
    stopAnimation();
    return;
  }

  parseMidiForVisualizer();
  stopAnimation();
  
  const canvas = visualizerCanvas.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true
  });
  if (!ctx) return;

  smoothTime = props.currentTime;
  lastFrameTimestamp = 0;

  const renderLoop = (timestamp: number) => {
    if (!props.isActive || (typeof document !== 'undefined' && document.hidden)) {
      stopAnimation();
      return;
    }

    if (lastFrameTimestamp > 0) {
      const dt = Math.min(Math.max((timestamp - lastFrameTimestamp) / 1000, 0), 0.1);
      if (props.isPlaying) {
        smoothTime += dt;
        // Hiệu chỉnh trôi thời gian (drift correction) bám sát props.currentTime
        const drift = props.currentTime - smoothTime;
        if (Math.abs(drift) < 0.2) {
          smoothTime += drift * 0.1;
        } else {
          smoothTime = props.currentTime;
        }
      } else {
        smoothTime = props.currentTime;
      }
    } else {
      smoothTime = props.currentTime;
    }
    lastFrameTimestamp = timestamp;

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

function handleVisibilityChange() {
  if (typeof document !== 'undefined' && document.hidden) {
    stopAnimation();
  } else if (props.isActive) {
    initCanvas();
    startAnimation();
  }
}

watch(() => props.fileData, () => {
  if (props.isActive) {
    initCanvas();
    startAnimation();
  }
});

watch(() => props.isActive, (active) => {
  if (active) {
    initCanvas();
    startAnimation();
  } else {
    stopAnimation();
  }
});

onMounted(() => {
  if (props.isActive) {
    initCanvas();
    startAnimation();
  }
  window.addEventListener('resize', initCanvas);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
});

onBeforeUnmount(() => {
  stopAnimation();
  window.removeEventListener('resize', initCanvas);
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }
});
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #0f0f15;
  cursor: pointer;
}

.visualizer-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.click-feedback-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 100;
}

.feedback-icon-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: rgba(0, 240, 255, 0.25);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 240, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
}

.feedback-icon {
  width: 32px;
  height: 32px;
  color: #ffffff;
}

.fade-scale-enter-active, .fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}
</style>
