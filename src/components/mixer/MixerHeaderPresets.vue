<template>
  <div class="mixer-header-presets">
    <div class="mixer-header">
      <div class="title-group">
        <Sliders class="icon" />
        <h3>Bàn Trộn Âm Thanh Dàn Nhạc (Orchestra Mixer)</h3>
      </div>
      <div class="mixer-actions">
        <div class="mode-selector">
          <button 
            class="mode-btn" 
            :class="{ active: currentMode === 'default' }" 
            @click="emit('changeMode', 'default')"
            title="Khôi phục/Đặt lại bản phối mặc định gốc"
          >
            Mặc định
          </button>
          <button 
            class="mode-btn" 
            :class="{ active: currentMode === 'symphony' }" 
            @click="emit('changeMode', 'symphony')"
            title="Khôi phục/Đặt lại bản phối giao hưởng chuẩn"
          >
            Giao hưởng
          </button>
          <button 
            class="mode-btn" 
            :class="{ active: currentMode === 'concerto' }" 
            @click="emit('changeMode', 'concerto')"
            title="Khôi phục/Đặt lại bản phối Piano Concerto"
          >
            Concerto
          </button>
        </div>
      </div>
    </div>

    <!-- Panel Điều Khiển Hiệu Ứng Không Gian (Master Reverb) -->
    <div class="master-fx-panel" :class="{ expanded: showMasterFX }">
      <div class="master-fx-header" @click="emit('toggleMasterFX')" title="Nhấp để hiển thị/ẩn bộ điều khiển vang phòng">
        <div class="fx-header-title">
          <Sparkles class="fx-icon" />
          <span>Vang Không Gian (Master Reverb)</span>
        </div>
        <div class="fx-header-right">
          <span class="fx-status-badge" :class="{ active: effectsEnabled }">
            {{ effectsEnabled ? 'Đang Bật' : 'Đã Tắt' }}
          </span>
          <component :is="showMasterFX ? ChevronUp : ChevronDown" class="chevron-icon" />
        </div>
      </div>
      
      <div v-if="showMasterFX" class="master-fx-body">
        <div class="fx-control-row">
          <label class="fx-label">Bật hiệu ứng:</label>
          <div class="fx-control-buttons">
            <button 
              class="fx-toggle-btn" 
              :class="{ active: effectsEnabled }" 
              @click.stop="emit('toggleEffects')"
            >
              {{ effectsEnabled ? 'Tắt Hiệu Ứng' : 'Bật Hiệu Ứng' }}
            </button>
            <button class="btn-reset-master" @click.stop="emit('resetMasterFX')" title="Khôi phục cài đặt vang phòng chuẩn">
              <RotateCcw class="reset-icon-mini" /> Đặt lại
            </button>
          </div>
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Kiểu phòng (Room Type):</span>
          </div>
          <select 
            :value="reverbCharacter" 
            @change="emit('updateReverb', { character: Number(($event.target as HTMLSelectElement).value), gain: masterReverbGain, time: reverbTime, preDelay: reverbPreDelay })" 
            class="fx-select"
          >
            <option :value="0">Phòng Nhỏ 1 (Room 1)</option>
            <option :value="1">Phòng Nhỏ 2 (Room 2)</option>
            <option :value="2">Phòng Trung Bình (Chamber)</option>
            <option :value="3">Khán Phòng Lớn (Concert Hall)</option>
            <option :value="4">Phòng Vang Sắt (Plate Reverb)</option>
            <option :value="6">Vang Lặp (Delay)</option>
            <option :value="7">Vang Đảo Kênh (Panning Delay)</option>
          </select>
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Âm lượng vang (Reverb Gain):</span>
            <span class="value">{{ masterReverbGain }}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            :value="masterReverbGain" 
            @input="emit('updateReverb', { character: reverbCharacter, gain: Number(($event.target as HTMLInputElement).value), time: reverbTime, preDelay: reverbPreDelay })"
            class="fx-slider"
          />
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Độ dài tiếng vang (Decay):</span>
            <span class="value">{{ reverbTime }}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="127" 
            :value="reverbTime" 
            @input="emit('updateReverb', { character: reverbCharacter, gain: masterReverbGain, time: Number(($event.target as HTMLInputElement).value), preDelay: reverbPreDelay })"
            class="fx-slider"
          />
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Độ trễ đầu (Pre-delay):</span>
            <span class="value">{{ reverbPreDelay }}ms</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="127" 
            :value="reverbPreDelay" 
            @input="emit('updateReverb', { character: reverbCharacter, gain: masterReverbGain, time: reverbTime, preDelay: Number(($event.target as HTMLInputElement).value) })"
            class="fx-slider"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sliders, Sparkles, ChevronUp, ChevronDown, RotateCcw } from 'lucide-vue-next';

defineProps<{
  currentMode: 'default' | 'symphony' | 'concerto';
  showMasterFX: boolean;
  effectsEnabled: boolean;
  masterReverbGain: number;
  reverbCharacter: number;
  reverbTime: number;
  reverbPreDelay: number;
}>();

const emit = defineEmits<{
  (e: 'changeMode', mode: 'default' | 'symphony' | 'concerto'): void;
  (e: 'toggleMasterFX'): void;
  (e: 'toggleEffects'): void;
  (e: 'resetMasterFX'): void;
  (e: 'updateReverb', params: { character: number; gain: number; time: number; preDelay: number }): void;
}>();
</script>

<style scoped>
.mixer-header-presets {
  padding: 12px 10px 0 10px;
}

.mixer-header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 14px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  width: 20px;
  height: 20px;
  color: #00f0ff;
}

.title-group h3 {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.mixer-actions {
  width: 100%;
}

.mode-selector {
  display: flex;
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  padding: 5px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  gap: 6px;
}

.mode-btn {
  flex: 1;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.mode-btn:hover:not(.active) {
  background: rgba(0, 240, 255, 0.12);
  border-color: rgba(0, 240, 255, 0.3);
  color: #ffffff;
}

.mode-btn.active {
  background: #00f0ff;
  border-color: #00f0ff;
  color: #0b0b12;
  font-weight: 700;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
}

.master-fx-panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.master-fx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: rgba(255, 255, 255, 0.01);
}

.master-fx-header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.fx-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #e2e8f0;
}

.fx-icon {
  width: 14px;
  height: 14px;
  color: #a855f7;
}

.fx-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fx-status-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}

.fx-status-badge.active {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.chevron-icon {
  width: 14px;
  height: 14px;
  color: #94a3b8;
}

.master-fx-body {
  padding: 12px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fx-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.fx-label {
  font-size: 0.75rem;
  color: #a0a0b0;
}

.fx-control-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fx-toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.fx-toggle-btn.active {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
  color: #c084fc;
}

.btn-reset-master {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #a0a0b0;
  font-size: 0.7rem;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-reset-master:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.reset-icon-mini {
  width: 12px;
  height: 12px;
}

.fx-control-row-stack {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fx-slider-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: #a0a0b0;
}

.fx-slider-meta .value {
  color: #c084fc;
  font-weight: 600;
  font-family: monospace;
}

.fx-select {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #ffffff;
  padding: 4px 8px;
  font-size: 0.75rem;
  outline: none;
}

.fx-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  outline: none;
}

.fx-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #c084fc;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(192, 132, 252, 0.5);
}
</style>
