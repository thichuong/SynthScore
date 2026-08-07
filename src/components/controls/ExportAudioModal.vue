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

          <div class="modal-body" ref="modalBodyRef">
            <p class="modal-desc">Chọn định dạng và cấu hình để kết xuất bản nhạc <strong>{{ songName }}</strong></p>

            <!-- Chọn định dạng -->
            <div class="section-title">Định dạng đầu ra</div>
            <div class="format-cards-grid">
              <div 
                v-for="fmt in formats" 
                :key="fmt.id"
                class="format-card"
                :class="{ active: selectedFormat === fmt.id }"
                @click="selectFormat(fmt.id)"
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
                <!-- Tùy chọn WAV Bit Depth -->
                <div v-if="selectedFormat === 'wav'" class="setting-item">
                  <label for="wav-bit-depth">Độ sâu bit (Bit Depth):</label>
                  <select id="wav-bit-depth" v-model="wavBitDepth" class="settings-select">
                    <option :value="24">24-bit PCM (Mặc định High-Res Studio)</option>
                    <option :value="16">16-bit PCM (CD Standard)</option>
                    <option :value="32">32-bit Float (IEEE Studio Master)</option>
                  </select>
                </div>

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
                    <span class="label-text">Áp dụng thiết lập âm lượng &amp; panning của Mixer</span>
                  </label>
                </div>

                <!-- Áp dụng Master Reverb không gian -->
                <div class="setting-item checkbox-item">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="enableReverb" />
                    <span class="checkbox-custom"></span>
                    <span class="label-text">Bật hiệu ứng không gian Reverb 3D (Concert Hall)</span>
                  </label>
                </div>

                <!-- Đuôi âm vang tự nhiên ở cuối bài -->
                <div class="setting-item checkbox-item">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="includeTail" />
                    <span class="checkbox-custom"></span>
                    <span class="label-text">Giữ đuôi âm vang tự nhiên cuối bài (+3.5s)</span>
                  </label>
                </div>

                <!-- Chuẩn hóa đỉnh âm thanh Peak Normalization -->
                <div class="setting-item checkbox-item">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="normalizePeak" />
                    <span class="checkbox-custom"></span>
                    <span class="label-text">Chuẩn hóa đỉnh âm thanh Peak Normalization (-0.5 dBFS)</span>
                  </label>
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
              <span class="step-text">Tổng hợp âm thanh offline với Reverb 3D...</span>
            </div>
            <div class="step-item" :class="{ active: exportStep === 'encoding', completed: isStepCompleted('encoding') }">
              <span class="step-dot"></span>
              <span class="step-text">Chuẩn hóa Peak &amp; mã hóa định dạng {{ selectedFormat.toUpperCase() }}...</span>
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
import { ref, watch, nextTick } from 'vue';
import { X, Check, Sliders, Download } from 'lucide-vue-next';
import { AudioEngine } from '../../services/audioEngine';

const props = defineProps<{
  isOpen: boolean;
  songName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isExporting = ref(false);
const selectedFormat = ref<'wav' | 'mp3' | 'flac' | 'alac' | 'dsd'>('mp3');
const modalBodyRef = ref<HTMLElement | null>(null);

function scrollToBottomIfNeeded() {
  nextTick(() => {
    if (modalBodyRef.value) {
      const { scrollHeight, clientHeight } = modalBodyRef.value;
      if (scrollHeight > clientHeight) {
        modalBodyRef.value.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  });
}

function selectFormat(id: typeof selectedFormat.value) {
  selectedFormat.value = id;
  scrollToBottomIfNeeded();
}

watch(selectedFormat, () => {
  scrollToBottomIfNeeded();
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    scrollToBottomIfNeeded();
  }
});
const mp3Bitrate = ref(320);
const wavBitDepth = ref<16 | 24 | 32>(24);
const applyMixer = ref(true);
const enableReverb = ref(true);
const includeTail = ref(true);
const normalizePeak = ref(true);
const exportStep = ref<'preparing' | 'rendering' | 'encoding' | 'done'>('preparing');

const formats = [
  { id: 'mp3', name: 'MP3', label: 'MP3 Compressed', description: 'Định dạng phổ biến, kích thước nhỏ gọn phù hợp chia sẻ' },
  { id: 'flac', name: 'FLAC', label: 'FLAC Lossless', description: 'Nén không mất dữ liệu, tương thích cao (xuất dạng PCM lossless)' },
  { id: 'alac', name: 'ALAC', label: 'Apple Lossless', description: 'Tối ưu hóa cho hệ sinh thái Apple (xuất dạng PCM lossless)' },
  { id: 'wav', name: 'WAV', label: 'WAV Lossless PCM', description: 'Âm thanh chất lượng phòng thu, không nén (16-bit / 24-bit / 32-bit Float)' },
  { id: 'dsd', name: 'DSD', label: 'DSD64 (DSF)', description: 'Chất lượng Audiophile siêu cao cấp 1-bit / 2.8224 MHz' }
] as const;

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
  
  try {
    const { blob, fileName } = await AudioEngine.exportAudio(
      selectedFormat.value,
      {
        mp3Bitrate: mp3Bitrate.value,
        applyMixer: applyMixer.value,
        enableReverb: enableReverb.value,
        includeTail: includeTail.value,
        normalizePeak: normalizePeak.value,
        wavBitDepth: wavBitDepth.value
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
