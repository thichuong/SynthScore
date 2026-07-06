<template>
  <div class="orchestra-mixer glass-card">
    <div class="mixer-header">
      <div class="title-group">
        <Sliders class="icon" />
        <h3>Bàn Trộn Âm Thanh Dàn Nhạc (Orchestra Mixer)</h3>
      </div>
      <div class="mixer-actions">
        <button class="reset-btn" @click="resetAll" title="Khôi phục mặc định">
          Reset Mixer
        </button>
      </div>
    </div>

    <div class="mixer-body">
      <div v-if="tracks.length === 0" class="empty-state">
        <Music class="empty-icon" />
        <p>Không có thông tin kênh nhạc cụ. Hãy tải lên một tệp tin nhạc.</p>
      </div>

      <div v-else class="tracks-grid">
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
            
            <div class="instrument-name">
              {{ getInstrumentCategory(track.instrumentNumber) }} ({{ track.instrumentName }})
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

            <!-- Điều khiển Mute/Solo -->
            <div class="mixer-buttons">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Sliders, Volume2, VolumeX, Music } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import type { TrackInfo } from '../services/audioEngine';

defineProps<{
  tracks: TrackInfo[];
}>();

const liveVoices = ref<Record<number, number>>({});
let voicesInterval: number | null = null;

// Lấy danh mục nhạc cụ General MIDI
function getInstrumentCategory(programNum: number): string {
  if (programNum >= 0 && programNum <= 7) return '🎹 Piano';
  if (programNum >= 8 && programNum <= 15) return '🔔 Percussion';
  if (programNum >= 16 && programNum <= 23) return '💨 Organ';
  if (programNum >= 24 && programNum <= 31) return '🎸 Guitar';
  if (programNum >= 32 && programNum <= 39) return '🎸 Bass';
  if (programNum >= 40 && programNum <= 47) return '🎻 Strings';
  if (programNum >= 48 && programNum <= 55) return '🎻 Ensemble';
  if (programNum >= 56 && programNum <= 63) return '🎺 Brass';
  if (programNum >= 64 && programNum <= 71) return '💨 Reed';
  if (programNum >= 72 && programNum <= 79) return '💨 Pipe (Sáo)';
  if (programNum >= 80 && programNum <= 87) return '⚡ Synth Lead';
  if (programNum >= 88 && programNum <= 95) return '⚡ Synth Pad';
  if (programNum >= 96 && programNum <= 103) return '⚡ Synth FX';
  if (programNum >= 104 && programNum <= 111) return '🌏 Ethnic';
  if (programNum >= 112 && programNum <= 119) return '🥁 Percussive';
  return '🥁 Sound FX / Drums';
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

function resetAll() {
  AudioEngine.tracks.forEach(track => {
    track.volume = 80;
    track.isMuted = false;
    track.isSoloed = false;
    AudioEngine.setTrackVolume(track.channel, 80);
    AudioEngine.setTrackMute(track.channel, false);
    AudioEngine.setTrackSolo(track.channel, false);
  });
}

// Cập nhật số lượng nốt nhạc (voice) đang kêu thời gian thực để nháy đèn LED
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
  }, 50);
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
  height: 290px;
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

.reset-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover {
  background: rgba(255, 0, 127, 0.1);
  border-color: rgba(255, 0, 127, 0.3);
  color: #ff007f;
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
</style>
