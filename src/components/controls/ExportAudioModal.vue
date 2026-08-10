<template>
  <!-- Modal Xuất âm thanh -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="export-modal-overlay" @click.self="handleClose">
        <div class="export-modal-card glass-modal">
          <div class="modal-header">
            <div class="header-title-group">
              <img src="../../assets/logo.svg" alt="SynthScore Logo" class="header-icon" />
              <h3>Xuất âm thanh chất lượng cao</h3>
            </div>
            <button class="close-btn" @click="handleClose">
              <X class="close-icon" />
            </button>
          </div>

          <div class="modal-body">
            <p class="modal-desc">Chọn định dạng chất lượng để kết xuất bản nhạc <strong>{{ songName }}</strong> (âm thanh tự động áp dụng thiết lập Mixer hiện tại)</p>

            <!-- Chọn định dạng -->
            <div class="section-title">Định dạng &amp; Chất lượng đầu ra</div>
            <div class="format-cards-grid">
              <div 
                v-for="preset in exportPresets" 
                :key="preset.id"
                class="format-card"
                :class="{ active: selectedPresetId === preset.id }"
                @click="selectPreset(preset.id)"
              >
                <div class="format-badge" :class="preset.badgeClass">{{ preset.name }}</div>
                <div class="format-info">
                  <span class="format-title">{{ preset.label }}</span>
                  <span class="format-desc">{{ preset.description }}</span>
                </div>
                <div v-if="selectedPresetId === preset.id" class="active-check">
                  <Check class="check-icon" />
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="handleClose">Hủy</button>
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
              <span class="step-text">Chuẩn bị tài nguyên âm thanh &amp; Soundfonts...</span>
            </div>
            <div class="step-item" :class="{ active: exportStep === 'rendering', completed: isStepCompleted('rendering') }">
              <span class="step-dot"></span>
              <span class="step-text">Tổng hợp âm thanh offline theo Mixer...</span>
            </div>
            <div class="step-item" :class="{ active: exportStep === 'encoding', completed: isStepCompleted('encoding') }">
              <span class="step-dot"></span>
              <span class="step-text">Chuẩn hóa Peak &amp; mã hóa định dạng {{ activePresetName }}...</span>
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
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { X, Check, Download } from 'lucide-vue-next';
import { AudioEngine } from '../../services/audioEngine';

export type PresetId = 'mp3_320' | 'mp3_192' | 'wav_16' | 'wav_24' | 'wav_32' | 'flac' | 'alac' | 'dsd';

export interface ExportPreset {
  id: PresetId;
  format: 'mp3' | 'wav' | 'flac' | 'alac' | 'dsd';
  name: string;
  label: string;
  description: string;
  badgeClass: string;
  mp3Bitrate?: number;
  wavBitDepth?: 16 | 24 | 32;
}

const props = defineProps<{
  isOpen: boolean;
  songName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isExporting = ref(false);
const selectedPresetId = ref<PresetId>('mp3_320');

const exportPresets: ExportPreset[] = [
  {
    id: 'mp3_192',
    format: 'mp3',
    name: 'MP3 192',
    label: 'MP3 192 kbps (Chất lượng cao)',
    description: 'Định dạng MP3 tiêu chuẩn nén nhiều, dung lượng tập tin cực kỳ nhỏ gọn',
    badgeClass: 'mp3',
    mp3Bitrate: 192
  },
  {
    id: 'mp3_320',
    format: 'mp3',
    name: 'MP3 320',
    label: 'MP3 320 kbps (Cực đỉnh - HQ)',
    description: 'Định dạng MP3 chất lượng cao nhất, âm thanh sắc nét, tương thích cao',
    badgeClass: 'mp3',
    mp3Bitrate: 320
  },
  {
    id: 'flac',
    format: 'flac',
    name: 'FLAC',
    label: 'FLAC Lossless',
    description: 'Nén không mất dữ liệu, tiết kiệm dung lượng (xuất dạng PCM lossless)',
    badgeClass: 'flac'
  },
  {
    id: 'alac',
    format: 'alac',
    name: 'ALAC',
    label: 'Apple Lossless',
    description: 'Nén không mất dữ liệu tối ưu cho hệ sinh thái Apple',
    badgeClass: 'alac'
  },
  {
    id: 'wav_16',
    format: 'wav',
    name: 'Wav 16',
    label: 'WAV 16-bit PCM (CD Standard)',
    description: 'Âm thanh PCM không nén tiêu chuẩn đĩa CD (16-bit / 44.1kHz)',
    badgeClass: 'wav',
    wavBitDepth: 16
  },
  {
    id: 'wav_24',
    format: 'wav',
    name: 'Wav 24',
    label: 'WAV 24-bit PCM (High-Res Studio)',
    description: 'Chất lượng phòng thu chuyên nghiệp High-Resolution',
    badgeClass: 'wav',
    wavBitDepth: 24
  },
  {
    id: 'wav_32',
    format: 'wav',
    name: 'Wav 32',
    label: 'WAV 32-bit Float (IEEE Studio Master)',
    description: 'Dải động không giới hạn cho hậu kỳ & dựng âm master phòng thu',
    badgeClass: 'wav',
    wavBitDepth: 32
  },
  {
    id: 'dsd',
    format: 'dsd',
    name: 'DSD',
    label: 'DSD64 (DSF)',
    description: 'Chất lượng Audiophile siêu cao cấp 1-bit / 2.8224 MHz',
    badgeClass: 'dsd'
  }
];

const activePreset = computed(() => {
  return exportPresets.find(p => p.id === selectedPresetId.value) || exportPresets[0];
});

const activePresetName = computed(() => {
  return activePreset.value.name;
});

function selectPreset(id: PresetId) {
  selectedPresetId.value = id;
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (!selectedPresetId.value) {
      selectedPresetId.value = 'mp3_320';
    }
  }
});

const exportStep = ref<'preparing' | 'rendering' | 'encoding' | 'done'>('preparing');

function handleClose() {
  if (isExporting.value) return;
  emit('close');
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
  
  const preset = activePreset.value;

  try {
    const { blob, fileName } = await AudioEngine.exportAudio(
      preset.format,
      {
        mp3Bitrate: preset.mp3Bitrate ?? 320,
        wavBitDepth: preset.wavBitDepth ?? 24,
        applyMixer: true,
        enableReverb: true,
        includeTail: true,
        normalizePeak: true
      },
      (step) => {
        exportStep.value = step;
      }
    );
    
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
      emit('close');
    }, 1000);
  } catch (error) {
    console.error('Lỗi khi xuất âm thanh:', error);
    alert(`Không thể xuất âm thanh: ${error instanceof Error ? error.message : error}`);
    isExporting.value = false;
  }
}
</script>

<style scoped>
.export-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.7);
  -webkit-backdrop-filter: blur(8px);
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
  width: 24px;
  height: 24px;
  object-fit: contain;
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
  scroll-behavior: smooth;
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
  margin-bottom: 8px;
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
  min-width: 64px;
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

.export-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.85);
  -webkit-backdrop-filter: blur(12px);
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
  color: #00f0ff;
}

.step-item.completed {
  opacity: 0.8;
  color: #34d399;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.step-text {
  font-size: 0.8rem;
}
</style>
