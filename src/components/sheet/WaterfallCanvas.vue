<template>
  <div class="canvas-container">
    <canvas ref="visualizerCanvas" class="visualizer-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { Midi } from '@tonejs/midi';

const props = defineProps<{
  fileData: Uint8Array | string | null;
  fileType: 'xml' | 'abc' | 'midi' | null;
  rawText: string | null;
  currentTime: number;
  isActive: boolean;
}>();

const visualizerCanvas = ref<HTMLCanvasElement | null>(null);
let animationFrameId: number | null = null;

interface RenderNote {
  midi: number;
  time: number;
  duration: number;
  trackIndex: number;
}

let midiNotes: RenderNote[] = [];
let maxMidi = 88;
let minMidi = 36;

const NEON_COLORS = [
  '#00f0ff',
  '#ff007f',
  '#ffaa00',
  '#39ff14',
  '#8a2be2',
  '#ff3b30',
  '#00ffcc',
  '#e2f105',
];

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
      if (props.fileType === 'abc') {
        const abcjs = await import('abcjs');
        const midiBin = abcjs.default.synth.getMidiFile(props.rawText || '', { midiOutputType: 'binary' }) as any;
        arrayBuffer = midiBin.buffer as ArrayBuffer;
      } else {
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rawW = rect?.width && rect.width > 0 ? rect.width : 800;
  const rawH = rect?.height && rect.height > 0 ? rect.height : 500;

  canvas.width = Math.min(Math.floor(rawW * dpr), 2048);
  canvas.height = Math.min(Math.floor(rawH * dpr), 2048);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

function binarySearchFirstNoteIndex(targetTime: number): number {
  let lo = 0, hi = midiNotes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (midiNotes[mid].time + midiNotes[mid].duration < targetTime) {
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
  const pianoHeight = h * 0.18;
  const playAreaHeight = h - pianoHeight;

  ctx.fillStyle = '#0f0f15';
  ctx.fillRect(0, 0, w, h);

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

  const VISIBLE_SECONDS = 4.0;
  const speed = h / VISIBLE_SECONDS;
  const curTime = props.currentTime;

  const activeKeys = new Set<number>();
  const marginBehind = 1.0;
  const windowStart = curTime - marginBehind;
  const windowEnd = curTime + VISIBLE_SECONDS;

  const startIdx = binarySearchFirstNoteIndex(windowStart);

  let visibleCount = 0;
  for (let i = startIdx; i < midiNotes.length; i++) {
    const note = midiNotes[i];
    if (note.time > windowEnd) break;
    visibleCount++;
  }

  const useShadow = visibleCount <= 200;

  for (let i = startIdx; i < midiNotes.length; i++) {
    const note = midiNotes[i];
    if (note.time > windowEnd) break;

    const yStart = playAreaHeight - (note.time - curTime) * speed - note.duration * speed;
    const yEnd = playAreaHeight - (note.time - curTime) * speed;

    if (yEnd < 0 || yStart > playAreaHeight) continue;

    if (curTime >= note.time && curTime <= note.time + note.duration) {
      activeKeys.add(note.midi);
    }

    const noteX = (note.midi - minMidi) * keyWidth;
    const noteY = Math.max(0, yStart);
    const noteW = keyWidth - 2;
    const noteH = yEnd - Math.max(0, yStart);

    const colorIndex = note.trackIndex % NEON_COLORS.length;
    const color = NEON_COLORS[colorIndex];

    ctx.fillStyle = color;
    if (useShadow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    
    const radius = Math.min(noteW / 2, 5);
    ctx.beginPath();
    ctx.roundRect(noteX, noteY, noteW, noteH, radius);
    ctx.fill();
    
    if (useShadow) {
      ctx.shadowBlur = 0;
    }
  }

  ctx.shadowBlur = 0;

  ctx.fillStyle = '#161622';
  ctx.fillRect(0, playAreaHeight, w, pianoHeight);

  const blackKeys = [1, 3, 6, 8, 10];

  for (let m = minMidi; m <= maxMidi; m++) {
    const isBlack = blackKeys.includes(m % 12);
    const x = (m - minMidi) * keyWidth;
    const isActive = activeKeys.has(m);

    if (isBlack) {
      ctx.fillStyle = isActive ? '#ff007f' : '#000000';
      ctx.fillRect(x + 1, playAreaHeight, keyWidth - 2, pianoHeight * 0.65);
    } else {
      ctx.fillStyle = isActive ? '#00f0ff' : '#ffffff';
      ctx.fillRect(x, playAreaHeight, keyWidth - 1, pianoHeight);
    }
  }
}

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
});

onBeforeUnmount(() => {
  stopAnimation();
  window.removeEventListener('resize', initCanvas);
});
</script>

<style scoped>
.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background: #0f0f15;
}

.visualizer-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
