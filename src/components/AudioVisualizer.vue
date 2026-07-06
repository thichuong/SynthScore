<template>
  <div class="audio-visualizer glass-card">
    <div class="visualizer-header">
      <div class="title-group">
        <Activity class="icon pulse" />
        <h3>Trực Quan Hóa Tần Số (Audio Spectrum)</h3>
      </div>
      <div class="controls-group">
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'bars' }"
          @click="mode = 'bars'"
          title="Dạng cột tần số"
        >
          Bars
        </button>
        <button 
          class="mode-btn" 
          :class="{ active: mode === 'wave' }"
          @click="mode = 'wave'"
          title="Dạng sóng tròn"
        >
          Wave
        </button>
      </div>
    </div>
    
    <div class="visualizer-body" ref="containerRef">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { Activity } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const mode = ref<'bars' | 'wave'>('bars');

let animationFrameId: number | null = null;
let dataArray: Uint8Array = new Uint8Array(0);

// Theo dõi trạng thái phát để bật/tắt vẽ
const props = defineProps<{
  isPlaying: boolean;
}>();

watch(() => props.isPlaying, (playing) => {
  if (playing) {
    startDrawing();
  } else {
    // Không tắt hẳn hoạt ảnh để khi dừng vẫn vẽ đường phẳng mượt
  }
});

function initCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const rect = canvas.parentElement?.getBoundingClientRect();
  canvas.width = (rect?.width || 300) * window.devicePixelRatio;
  canvas.height = (rect?.height || 120) * window.devicePixelRatio;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

function startDrawing() {
  stopDrawing();
  
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const drawLoop = () => {
    draw(canvas, ctx);
    animationFrameId = requestAnimationFrame(drawLoop);
  };
  animationFrameId = requestAnimationFrame(drawLoop);
}

function stopDrawing() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Lưu vết đỉnh rơi tự do (peak bars)
let peaks: number[] = [];

function draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.fillStyle = '#0f0f15';
  ctx.fillRect(0, 0, w, h);

  const analyser = AudioEngine.analyser;
  if (!analyser) {
    // Nếu chưa khởi tạo analyser, vẽ đường thẳng phẳng mờ ảo
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
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

  if (mode.value === 'bars') {
    // Đọc dữ liệu tần số (0 - 255)
    analyser.getByteFrequencyData(dataArray as any);

    const barWidth = (w / bufferLength) * 1.5;
    let barHeight;
    let x = 0;

    // Gradient màu cầu vồng Cyberpunk phát sáng
    const gradient = ctx.createLinearGradient(0, h, 0, 0);
    gradient.addColorStop(0, '#0072ff');
    gradient.addColorStop(0.5, '#00f0ff');
    gradient.addColorStop(1, '#ff007f');

    for (let i = 0; i < bufferLength; i++) {
      barHeight = (dataArray[i] / 255) * h * 0.85;

      // Cập nhật đỉnh rơi chậm
      if (peaks[i] === undefined || barHeight > peaks[i]) {
        peaks[i] = barHeight;
      } else {
        peaks[i] = Math.max(0, peaks[i] - 1.5); // Rơi từ từ
      }

      ctx.fillStyle = gradient;
      
      // Vẽ cột bo góc nhẹ ở đỉnh
      const rx = x;
      const ry = h - barHeight;
      const rw = barWidth - 1.5;
      const rh = barHeight;
      
      if (rh > 2) {
        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, [3, 3, 0, 0]);
        ctx.fill();
      }

      // Vẽ nốt đỉnh phát sáng
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 4;
      ctx.fillRect(x, h - peaks[i] - 2, barWidth - 1.5, 2);
      ctx.shadowBlur = 0;

      x += barWidth;
    }
  } 
  else {
    // Dạng sóng hình tròn xung điện (Circular Waveform)
    analyser.getByteTimeDomainData(dataArray as any);

    const centerX = w / 2;
    const centerY = h / 2;
    const baseRadius = Math.min(w, h) * 0.25;

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const angle = (i / bufferLength) * Math.PI * 2;
      // Dữ liệu sóng tầm 128 ở giữa, dịch chuyển ra xa/gần
      const waveValue = (dataArray[i] - 128) / 128; // -1.0 to 1.0
      const radius = baseRadius + waveValue * baseRadius * 0.6;

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    // Vẽ thêm nhân phát sáng xung điện ở giữa
    ctx.shadowBlur = 0;
    const heartRes = dataArray[0] / 255;
    const heartRadius = baseRadius * 0.4 + heartRes * 8;
    ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, heartRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

onMounted(() => {
  window.addEventListener('resize', initCanvas);
  initCanvas();
  startDrawing();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', initCanvas);
  stopDrawing();
});
</script>

<style scoped>
.audio-visualizer {
  display: flex;
  flex-direction: column;
  height: 190px;
  background: rgba(26, 26, 36, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: rgba(18, 18, 24, 0.7);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-group h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e2e9;
  letter-spacing: 0.5px;
}

.icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

.pulse {
  animation: heartbeat 2s infinite ease-in-out;
}

.controls-group {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.04);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.mode-btn {
  background: transparent;
  border: none;
  color: #8c8c9e;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-btn:hover {
  color: #ffffff;
}

.mode-btn.active {
  background: rgba(0, 240, 255, 0.15);
  color: #00f0ff;
}

.visualizer-body {
  flex: 1;
  background: #0f0f15;
  position: relative;
  overflow: hidden;
}

@keyframes heartbeat {
  0% { transform: scale(1); }
  30% { transform: scale(1.15); }
  60% { transform: scale(1); }
}
</style>
