<template>
  <div class="orchestra-mixer glass-card">
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
            @click="$emit('changeMode', 'default')"
            title="Khôi phục/Đặt lại bản phối mặc định gốc"
          >
            Mặc định
          </button>
          <button 
            class="mode-btn" 
            :class="{ active: currentMode === 'symphony' }" 
            @click="$emit('changeMode', 'symphony')"
            title="Khôi phục/Đặt lại bản phối giao hưởng chuẩn"
          >
            Giao hưởng
          </button>
          <button 
            class="mode-btn" 
            :class="{ active: currentMode === 'concerto' }" 
            @click="$emit('changeMode', 'concerto')"
            title="Khôi phục/Đặt lại bản phối Piano Concerto"
          >
            Concerto
          </button>
        </div>
      </div>
    </div>

    <div class="mixer-body">
      <div v-if="tracks.length === 0" class="empty-state">
        <Music class="empty-icon" />
        <p>Không có thông tin kênh nhạc cụ. Bạn có thể bắt đầu bằng cách thêm nhạc cụ mới.</p>
        <button class="add-track-btn-center" @click="addTrack" title="Thêm nhạc cụ mới">
          <Plus class="add-icon" /> Thêm nhạc cụ mới
        </button>
      </div>

      <div v-else class="tracks-list-container">
        <div class="tracks-grid">
          <div 
            v-for="track in tracks" 
            :key="track.channel" 
            class="track-card"
            :class="{ muted: track.isMuted, soloed: track.isSoloed, active: liveVoices[track.channel] > 0 }"
          >
            <!-- Cột hiển thị đèn tín hiệu nốt nhạc (Vũ đạo nốt nhạc) -->
            <div class="meter-container">
              <div class="meter-label">CH {{ track.channel + 1 }}</div>
              <div class="meter-bar-wrapper">
                <div 
                  class="meter-bar-fill"
                  :style="{ height: `${Math.min(100, liveVoices[track.channel] * 12)}%` }"
                ></div>
              </div>
            </div>

            <div class="track-details">
              <div class="track-name-row">
                <span class="track-name" :title="track.name">{{ track.name }}</span>
                <span class="voice-count-badge" v-if="liveVoices[track.channel] > 0">
                  {{ liveVoices[track.channel] }} v
                </span>
              </div>
              
              <div class="instrument-selector-container">
                <select 
                  :value="track.instrumentNumber" 
                  @change="changeInstrument(track.channel, parseInt(($event.target as HTMLSelectElement).value))"
                  class="instrument-select"
                >
                  <optgroup v-for="group in instrumentGroups" :key="group.name" :label="group.name">
                    <option 
                      v-for="inst in group.instruments" 
                      :key="inst.number" 
                      :value="inst.number"
                    >
                      {{ inst.name }}
                    </option>
                  </optgroup>
                </select>
              </div>

              <!-- Điều khiển Volume -->
              <div class="volume-slider-container">
                <Volume2 class="vol-icon" />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  v-model.number="track.volume" 
                  @input="updateVolume(track.channel, track.volume)"
                  class="vol-slider"
                />
                <span class="vol-value">{{ track.volume }}%</span>
              </div>

              <!-- Điều khiển Mute/Solo & Xóa -->
              <div class="mixer-buttons">
                <button 
                  class="btn-test" 
                  @click="playTest(track.channel)"
                  title="Phát nốt nhạc thử âm"
                >
                  <Play class="btn-icon" /> THỬ
                </button>
                <button 
                  class="btn-mute" 
                  :class="{ active: track.isMuted }"
                  @click="toggleMute(track.channel)"
                >
                  <VolumeX class="btn-icon" /> MUTE
                </button>
                <button 
                  class="btn-solo" 
                  :class="{ active: track.isSoloed }"
                  @click="toggleSolo(track.channel)"
                >
                  SOLO
                </button>
                <button 
                  class="btn-delete" 
                  @click="deleteTrack(track.channel)"
                  title="Xóa nhạc cụ này"
                >
                  <Trash2 class="btn-icon delete-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <button class="add-track-btn-bottom" @click="addTrack" title="Thêm nhạc cụ mới">
          <Plus class="add-icon" /> Thêm nhạc cụ mới
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Sliders, Volume2, VolumeX, Music, Trash2, Plus, Play } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import type { TrackInfo } from '../services/audioEngine';
import { instrumentGroups } from '../data/instruments';

defineProps<{
  tracks: TrackInfo[];
  currentMode: 'default' | 'symphony' | 'concerto';
}>();

defineEmits<{
  (e: 'changeMode', mode: 'default' | 'symphony' | 'concerto'): void;
}>();

const liveVoices = ref<Record<number, number>>({});
let voicesInterval: number | null = null;


function changeInstrument(channel: number, programNum: number) {
  AudioEngine.setTrackInstrument(channel, programNum);
}

function updateVolume(channel: number, vol: number) {
  AudioEngine.setTrackVolume(channel, vol);
}

function toggleMute(channel: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) {
    AudioEngine.setTrackMute(channel, !track.isMuted);
  }
}

function toggleSolo(channel: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) {
    AudioEngine.setTrackSolo(channel, !track.isSoloed);
  }
}

function addTrack() {
  AudioEngine.addTrack();
}

function deleteTrack(channelIndex: number) {
  AudioEngine.deleteTrack(channelIndex);
}

function playTest(channel: number) {
  AudioEngine.playTestNote(channel);
}

// Cập nhật số lượng nốt nhạc (voice) đang kêu thời gian thực để nháy đèn LED
// (Tối ưu: giảm tần suất polling từ 50ms → 150ms để giảm áp lực main thread)
function startTrackingVoices() {
  stopTrackingVoices();
  voicesInterval = window.setInterval(() => {
    AudioEngine.tracks.forEach(track => {
      if (AudioEngine['synth']) {
        const chan = AudioEngine['synth'].midiChannels[track.channel];
        if (chan) {
          liveVoices.value[track.channel] = chan.voiceCount || 0;
        }
      }
    });
  }, 150);
}

function stopTrackingVoices() {
  if (voicesInterval !== null) {
    clearInterval(voicesInterval);
    voicesInterval = null;
  }
}

onMounted(() => {
  startTrackingVoices();
});

onBeforeUnmount(() => {
  stopTrackingVoices();
});
</script>

<style scoped>
.orchestra-mixer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(26, 26, 36, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.mixer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
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
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e2e9;
}

.icon {
  width: 16px;
  height: 16px;
  color: #00f0ff;
}

.mixer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-selector {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2px;
  border-radius: 8px;
}

.mode-btn {
  background: transparent;
  border: none;
  color: #a0a0b0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.mode-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

.mode-btn.active {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  color: #ffffff;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.25);
}

.add-track-btn-bottom {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
  padding: 10px;
  background: rgba(0, 240, 255, 0.04);
  border: 1px dashed rgba(0, 240, 255, 0.25);
  border-radius: 12px;
  color: #00f0ff;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-track-btn-bottom:hover {
  background: rgba(0, 240, 255, 0.1);
  border-color: #00f0ff;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 240, 255, 0.15);
  transform: translateY(-1px);
}

.add-icon {
  width: 14px;
  height: 14px;
}

.mixer-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: rgba(13, 13, 18, 0.6);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #606078;
  gap: 8px;
}

.empty-icon {
  width: 32px;
  height: 32px;
  opacity: 0.5;
}

.tracks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.track-card {
  display: flex;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 10px;
  gap: 12px;
  transition: all 0.25s ease;
}

.track-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.track-card.active {
  border-color: rgba(0, 240, 255, 0.2);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.05);
}

.track-card.muted {
  opacity: 0.4;
}

.track-card.soloed {
  border-color: #ff007f;
  box-shadow: 0 0 10px rgba(255, 0, 127, 0.08);
}

/* Kênh đèn VU Meter */
.meter-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 34px;
}

.meter-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #7c7c8e;
}

.meter-bar-wrapper {
  flex: 1;
  width: 6px;
  background: #111115;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
}

.meter-bar-fill {
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  background: linear-gradient(to top, #0072ff, #00f0ff, #39ff14, #ff007f);
  border-radius: 3px;
  transition: height 0.05s ease-out;
}

.track-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.track-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.track-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-count-badge {
  font-size: 0.65rem;
  background: rgba(57, 255, 20, 0.15);
  color: #39ff14;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 700;
}

.instrument-name {
  font-size: 0.7rem;
  color: #8c8c9e;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.instrument-selector-container {
  margin-bottom: 8px;
}

.instrument-select {
  width: 100%;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e2e9;
  font-size: 0.72rem;
  font-family: inherit;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.instrument-select:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(0, 240, 255, 0.3);
}

.instrument-select:focus {
  border-color: #00f0ff;
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.2);
}

.instrument-select optgroup {
  background: #111115;
  color: #8c8c9e;
  font-weight: bold;
}

.instrument-select option {
  background: #181824;
  color: #f1f1f7;
}

/* Thanh trượt Volume */
.volume-slider-container {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.vol-icon {
  width: 12px;
  height: 12px;
  color: #a0a0b0;
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
  box-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
  transition: transform 0.1s ease;
}

.vol-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.vol-value {
  font-size: 0.7rem;
  color: #a0a0b0;
  width: 32px;
  text-align: right;
  font-family: monospace;
}

/* Mute/Solo button */
.mixer-buttons {
  display: flex;
  gap: 4px;
}

.mixer-buttons button {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #8c8c9e;
  padding: 4px;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.mixer-buttons button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.btn-mute.active {
  background: rgba(255, 59, 48, 0.15);
  border-color: rgba(255, 59, 48, 0.3);
  color: #ff3b30;
}

.btn-solo.active {
  background: rgba(255, 0, 127, 0.15);
  border-color: rgba(255, 0, 127, 0.3);
  color: #ff007f;
}

.btn-icon {
  width: 10px;
  height: 10px;
}

.btn-delete {
  flex-shrink: 0;
  width: 26px;
  background: rgba(255, 59, 48, 0.05) !important;
  border: 1px solid rgba(255, 59, 48, 0.1) !important;
  color: #ff3b30 !important;
  transition: all 0.2s ease;
}

.btn-delete:hover {
  background: rgba(255, 59, 48, 0.15) !important;
  border-color: rgba(255, 59, 48, 0.4) !important;
  color: #ff453a !important;
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.25);
}

.delete-icon {
  width: 10px;
  height: 10px;
}

.add-track-btn-center {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 240, 255, 0.1);
  border: 1px solid rgba(0, 240, 255, 0.2);
  color: #00f0ff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  transition: all 0.3s ease;
}

.add-track-btn-center:hover {
  background: rgba(0, 240, 255, 0.2);
  border-color: #00f0ff;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.btn-test {
  background: rgba(0, 240, 255, 0.05) !important;
  border: 1px solid rgba(0, 240, 255, 0.1) !important;
  color: #00f0ff !important;
}

.btn-test:hover {
  background: rgba(0, 240, 255, 0.15) !important;
  border-color: rgba(0, 240, 255, 0.3) !important;
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.25);
}
</style>
