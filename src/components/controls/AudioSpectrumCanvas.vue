<template>
  <div class="mini-spectrum-container">
    <canvas ref="spectrumCanvasRef" class="mini-spectrum-canvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { AudioEngine } from '../../services/audioEngine';

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
</style>
