<template>
  <div 
    class="track-card"
    :class="{ 
      muted: track.isMuted, 
      soloed: track.isSoloed, 
      active: liveVoices > 0, 
      expanded: isExpanded,
      'dropdown-active': isDropdownActive
    }"
  >
    <!-- Cột hiển thị đèn tín hiệu nốt nhạc -->
    <div class="meter-container">
      <div class="meter-label">CH {{ track.channel + 1 }}</div>
      <div class="meter-bar-wrapper">
        <div 
          class="meter-bar-fill"
          :style="{ height: `${Math.min(100, liveVoices * 12)}%` }"
        ></div>
      </div>
    </div>

    <div class="track-details">
      <div class="track-name-row">
        <div class="track-name-with-icon">
          <span class="track-icon">{{ getInstrumentEmoji(track.instrumentNumber) }}</span>
          <span class="track-name" :title="track.name">{{ track.name }}</span>
        </div>
        <span class="voice-count-badge" v-if="liveVoices > 0">
          {{ liveVoices }} v
        </span>
      </div>
      
      <div class="instrument-selector-container">
        <InstrumentSelector
          :modelValue="track.instrumentNumber"
          @update:modelValue="emit('changeInstrument', $event)"
          @open="emit('dropdownOpen')"
          @close="emit('dropdownClose')"
        />
      </div>

      <!-- Điều khiển Volume -->
      <div class="volume-slider-container">
        <Volume2 class="vol-icon" />
        <input 
          type="range" 
          min="0" 
          max="100" 
          :value="track.volume" 
          @input="emit('updateVolume', Number(($event.target as HTMLInputElement).value))"
          class="vol-slider"
        />
        <span class="vol-value">{{ track.volume }}%</span>
      </div>

      <!-- Điều khiển Mute/Solo & Xóa & FX/Pan -->
      <div class="mixer-buttons">
        <button 
          class="btn-test" 
          @click="emit('playTest')"
          title="Phát nốt nhạc thử âm"
        >
          <Play class="btn-icon" /> THỬ
        </button>
        <button 
          class="btn-fx-toggle"
          :class="{ active: isExpanded }"
          @click="emit('toggleExpand')"
          title="Hiệu ứng và Cân bằng không gian (Pan, Reverb, Chorus)"
        >
          <Sliders class="btn-icon" /> FX
        </button>
        <button 
          class="btn-mute" 
          :class="{ active: track.isMuted }"
          @click="emit('toggleMute')"
        >
          <VolumeX class="btn-icon" /> MUTE
        </button>
        <button 
          class="btn-solo" 
          :class="{ active: track.isSoloed }"
          @click="emit('toggleSolo')"
        >
          SOLO
        </button>
        <button 
          class="btn-delete" 
          @click="emit('deleteTrack')"
          title="Xóa nhạc cụ này"
        >
          <Trash2 class="btn-icon delete-icon" />
        </button>
      </div>

      <!-- Bảng FX & Không Gian mở rộng -->
      <div v-if="isExpanded" class="track-fx-panel">
        <!-- Panning -->
        <div class="fx-field">
          <div class="fx-field-header">
            <span class="fx-field-title">🔊 Cân Bằng (Panning)</span>
            <span class="fx-val">{{ formatPanValue(track.pan) }}</span>
          </div>
          <div class="fx-field-control">
            <span class="pan-side">L</span>
            <input 
              type="range" 
              min="-100" 
              max="100" 
              :value="track.pan" 
              @input="emit('updatePan', Number(($event.target as HTMLInputElement).value))"
              class="pan-input"
            />
            <span class="pan-side">R</span>
            <button class="btn-reset-mini" @click="emit('resetPan')" title="Đặt lại trung tâm">
              <RotateCcw class="reset-icon-mini" />
            </button>
          </div>
        </div>

        <!-- Reverb Send -->
        <div class="fx-field">
          <div class="fx-field-header">
            <span class="fx-field-title">🌌 Độ Vang (Reverb)</span>
            <span class="fx-val">{{ Math.round(track.reverbSend / 1.27) }}%</span>
          </div>
          <div class="fx-field-control">
            <input 
              type="range" 
              min="0" 
              max="127" 
              :value="track.reverbSend" 
              @input="emit('updateReverb', Number(($event.target as HTMLInputElement).value))"
              class="fx-input reverb-input"
            />
            <button class="btn-reset-mini" @click="emit('resetReverb')" title="Khôi phục độ vang mặc định">
              <RotateCcw class="reset-icon-mini" />
            </button>
          </div>
        </div>

        <!-- Chorus Send -->
        <div class="fx-field">
          <div class="fx-field-header">
            <span class="fx-field-title">🌊 Độ Dày (Chorus)</span>
            <span class="fx-val">{{ Math.round(track.chorusSend / 1.27) }}%</span>
          </div>
          <div class="fx-field-control">
            <input 
              type="range" 
              min="0" 
              max="127" 
              :value="track.chorusSend" 
              @input="emit('updateChorus', Number(($event.target as HTMLInputElement).value))"
              class="fx-input chorus-input"
            />
            <button class="btn-reset-mini" @click="emit('resetChorus')" title="Khôi phục độ dày mặc định">
              <RotateCcw class="reset-icon-mini" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Volume2, VolumeX, Trash2, Play, Sliders, RotateCcw } from 'lucide-vue-next';
import InstrumentSelector from '../InstrumentSelector.vue';
import { getInstrumentEmoji } from '../../data/instruments';
import type { TrackInfo } from '../../services/midiGenerator';

defineProps<{
  track: TrackInfo;
  liveVoices: number;
  isExpanded: boolean;
  isDropdownActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'changeInstrument', instNum: number): void;
  (e: 'updateVolume', vol: number): void;
  (e: 'playTest'): void;
  (e: 'toggleExpand'): void;
  (e: 'toggleMute'): void;
  (e: 'toggleSolo'): void;
  (e: 'deleteTrack'): void;
  (e: 'updatePan', pan: number): void;
  (e: 'resetPan'): void;
  (e: 'updateReverb', val: number): void;
  (e: 'resetReverb'): void;
  (e: 'updateChorus', val: number): void;
  (e: 'resetChorus'): void;
  (e: 'dropdownOpen'): void;
  (e: 'dropdownClose'): void;
}>();

function formatPanValue(pan: number): string {
  if (pan === 0) return 'Giữa (C)';
  if (pan < 0) return `Trái L${Math.abs(pan)}`;
  return `Phải R${pan}`;
}
</script>

<style scoped>
.track-card {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.track-card.muted {
  opacity: 0.5;
  filter: grayscale(0.6);
}

.track-card.soloed {
  border-color: rgba(255, 215, 0, 0.5);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
}

.track-card.active {
  border-color: rgba(0, 240, 255, 0.4);
  background: rgba(0, 240, 255, 0.04);
}

.meter-container {
  width: 24px;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.meter-label {
  font-size: 0.55rem;
  font-weight: 700;
  color: #8c8c9e;
  transform: rotate(-90deg);
  margin-bottom: 12px;
  white-space: nowrap;
}

.meter-bar-wrapper {
  flex: 1;
  width: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.meter-bar-fill {
  width: 100%;
  background: linear-gradient(0deg, #00f0ff 0%, #a855f7 70%, #ff007f 100%);
  border-radius: 2px;
  transition: height 0.05s ease;
}

.track-details {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.track-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.track-name-with-icon {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.track-icon {
  font-size: 1rem;
}

.track-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-count-badge {
  font-size: 0.65rem;
  font-weight: 700;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.instrument-selector-container {
  width: 100%;
}

.volume-slider-container {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.2);
  padding: 6px 10px;
  border-radius: 8px;
}

.vol-icon {
  width: 14px;
  height: 14px;
  color: #00f0ff;
}

.vol-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #00f0ff;
  cursor: pointer;
}

.vol-value {
  font-size: 0.72rem;
  color: #a0a0b0;
  font-family: monospace;
  width: 36px;
  text-align: right;
}

.mixer-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-test, .btn-fx-toggle, .btn-mute, .btn-solo, .btn-delete {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #a0a0b0;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.btn-test:hover { background: rgba(0, 240, 255, 0.15); color: #00f0ff; }
.btn-fx-toggle.active { background: rgba(168, 85, 247, 0.2); border-color: rgba(168, 85, 247, 0.4); color: #c084fc; }
.btn-mute.active { background: rgba(255, 77, 79, 0.2); border-color: rgba(255, 77, 79, 0.4); color: #ff4d4f; }
.btn-solo.active { background: rgba(255, 215, 0, 0.2); border-color: rgba(255, 215, 0, 0.4); color: #ffd700; }
.btn-delete:hover { background: rgba(255, 77, 79, 0.15); color: #ff4d4f; }

.btn-icon { width: 12px; height: 12px; }

.track-fx-panel {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.fx-field { display: flex; flex-direction: column; gap: 4px; }
.fx-field-header { display: flex; justify-content: space-between; font-size: 0.7rem; color: #a0a0b0; }
.fx-val { color: #00f0ff; font-family: monospace; font-weight: 600; }
.fx-field-control { display: flex; align-items: center; gap: 6px; }
.pan-side { font-size: 0.65rem; color: #8c8c9e; font-weight: 700; }

.pan-input, .fx-input {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.pan-input::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #00f0ff; cursor: pointer; }
.reverb-input::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #c084fc; cursor: pointer; }
.chorus-input::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; cursor: pointer; }

.btn-reset-mini {
  background: transparent;
  border: none;
  color: #8c8c9e;
  cursor: pointer;
  padding: 2px;
}
.btn-reset-mini:hover { color: #ffffff; }
.reset-icon-mini { width: 12px; height: 12px; }
</style>
