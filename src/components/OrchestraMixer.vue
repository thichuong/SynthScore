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

    <!-- Panel Điều Khiển Hiệu Ứng Không Gian (Master Reverb) -->
    <div class="master-fx-panel" :class="{ expanded: showMasterFX }">
      <div class="master-fx-header" @click="showMasterFX = !showMasterFX" title="Nhấp để hiển thị/ẩn bộ điều khiển vang phòng">
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
              @click.stop="toggleEffects"
            >
              {{ effectsEnabled ? 'Tắt Hiệu Ứng' : 'Bật Hiệu Ứng' }}
            </button>
            <button class="btn-reset-master" @click.stop="resetMasterFX" title="Khôi phục cài đặt vang phòng chuẩn">
              <RotateCcw class="reset-icon-mini" /> Đặt lại
            </button>
          </div>
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Kiểu phòng (Room Type):</span>
          </div>
          <select v-model.number="localReverbCharacter" @change="updateReverbParams" class="fx-select">
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
            <span class="value">{{ localMasterReverbGain }}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            v-model.number="localMasterReverbGain" 
            @input="updateMasterReverbGain"
            class="fx-slider"
          />
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Độ dài tiếng vang (Decay):</span>
            <span class="value">{{ localReverbTime }}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="127" 
            v-model.number="localReverbTime" 
            @input="updateReverbParams"
            class="fx-slider"
          />
        </div>

        <div class="fx-control-row-stack">
          <div class="fx-slider-meta">
            <span>Độ trễ đầu (Pre-delay):</span>
            <span class="value">{{ localReverbPreDelay }}ms</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="127" 
            v-model.number="localReverbPreDelay" 
            @input="updateReverbParams"
            class="fx-slider"
          />
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
            :class="{ 
              muted: track.isMuted, 
              soloed: track.isSoloed, 
              active: liveVoices[track.channel] > 0, 
              expanded: expandedTracks[track.channel],
              'dropdown-active': activeDropdownChannel === track.channel
            }"
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
                <InstrumentSelector
                  :modelValue="track.instrumentNumber"
                  @update:modelValue="changeInstrument(track.channel, $event)"
                  @open="activeDropdownChannel = track.channel"
                  @close="if (activeDropdownChannel === track.channel) activeDropdownChannel = null;"
                />
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

              <!-- Điều khiển Mute/Solo & Xóa & FX/Pan -->
              <div class="mixer-buttons">
                <button 
                  class="btn-test" 
                  @click="playTest(track.channel)"
                  title="Phát nốt nhạc thử âm"
                >
                  <Play class="btn-icon" /> THỬ
                </button>
                <button 
                  class="btn-fx-toggle"
                  :class="{ active: expandedTracks[track.channel] }"
                  @click="toggleTrackExpand(track.channel)"
                  title="Hiệu ứng và Cân bằng không gian (Pan, Reverb, Chorus)"
                >
                  <Sliders class="btn-icon" /> FX
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

              <!-- Bảng FX & Không Gian mở rộng -->
              <div v-if="expandedTracks[track.channel]" class="track-fx-panel">
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
                      v-model.number="track.pan" 
                      @input="updateTrackPan(track.channel, track.pan)"
                      class="pan-input"
                    />
                    <span class="pan-side">R</span>
                    <button class="btn-reset-mini" @click="resetTrackPan(track.channel)" title="Đặt lại trung tâm">
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
                      v-model.number="track.reverbSend" 
                      @input="updateTrackReverb(track.channel, track.reverbSend)"
                      class="fx-input reverb-input"
                    />
                    <button class="btn-reset-mini" @click="resetTrackReverb(track.channel, track.instrumentNumber)" title="Khôi phục độ vang mặc định">
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
                      v-model.number="track.chorusSend" 
                      @input="updateTrackChorus(track.channel, track.chorusSend)"
                      class="fx-input chorus-input"
                    />
                    <button class="btn-reset-mini" @click="resetTrackChorus(track.channel, track.instrumentNumber)" title="Khôi phục độ dày mặc định">
                      <RotateCcw class="reset-icon-mini" />
                    </button>
                  </div>
                </div>
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
import { Sliders, Volume2, VolumeX, Music, Trash2, Plus, Play, RotateCcw, Sparkles, ChevronDown, ChevronUp } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import type { TrackInfo } from '../services/midiGenerator';
import { getDefaultTrackSettings } from '../services/midiGenerator';
import InstrumentSelector from './InstrumentSelector.vue';

defineProps<{
  tracks: TrackInfo[];
  currentMode: 'default' | 'symphony' | 'concerto';
}>();

defineEmits<{
  (e: 'changeMode', mode: 'default' | 'symphony' | 'concerto'): void;
}>();

const liveVoices = ref<Record<number, number>>({});
let voicesInterval: number | null = null;
const showMasterFX = ref(false);
const effectsEnabled = ref(true);
const localMasterReverbGain = ref(AudioEngine.masterReverbGain);
const localReverbCharacter = ref(AudioEngine.reverbCharacter);
const localReverbTime = ref(AudioEngine.reverbTime);
const localReverbPreDelay = ref(AudioEngine.reverbPreDelay);
const expandedTracks = ref<Record<number, boolean>>({});
const activeDropdownChannel = ref<number | null>(null);

function toggleTrackExpand(channel: number) {
  expandedTracks.value[channel] = !expandedTracks.value[channel];
}

function formatPanValue(pan: number): string {
  if (pan === 0) return 'Center';
  return pan < 0 ? `L${Math.abs(pan)}%` : `R${pan}%`;
}

function updateTrackPan(channel: number, pan: number) {
  AudioEngine.setTrackPan(channel, pan);
}

function updateTrackReverb(channel: number, val: number) {
  AudioEngine.setTrackReverbSend(channel, val);
}

function updateTrackChorus(channel: number, val: number) {
  AudioEngine.setTrackChorusSend(channel, val);
}

function resetTrackPan(channel: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) {
    track.pan = 0;
    updateTrackPan(channel, 0);
  }
}

function resetTrackReverb(channel: number, program: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) {
    const defaults = getDefaultTrackSettings(program, channel);
    track.reverbSend = defaults.reverbSend;
    updateTrackReverb(channel, defaults.reverbSend);
  }
}

function resetTrackChorus(channel: number, program: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) {
    const defaults = getDefaultTrackSettings(program, channel);
    track.chorusSend = defaults.chorusSend;
    updateTrackChorus(channel, defaults.chorusSend);
  }
}

function toggleEffects() {
  effectsEnabled.value = !effectsEnabled.value;
  if (AudioEngine['synth']) {
    AudioEngine['synth'].setSystemParameter('effectsEnabled', effectsEnabled.value);
  }
}

function updateMasterReverbGain() {
  AudioEngine.setMasterReverbGain(localMasterReverbGain.value);
}

function updateReverbParams() {
  AudioEngine.setMasterReverbParams(
    localReverbCharacter.value,
    localReverbTime.value,
    localReverbPreDelay.value
  );
}

function resetMasterFX() {
  localMasterReverbGain.value = 50;
  localReverbCharacter.value = 3;
  localReverbTime.value = 90;
  localReverbPreDelay.value = 40;
  effectsEnabled.value = true;
  if (AudioEngine['synth']) {
    AudioEngine['synth'].setSystemParameter('effectsEnabled', true);
  }
  AudioEngine.setMasterReverbGain(50);
  AudioEngine.setMasterReverbParams(3, 90, 40);
}

function syncReverbValues() {
  localMasterReverbGain.value = AudioEngine.masterReverbGain;
  localReverbCharacter.value = AudioEngine.reverbCharacter;
  localReverbTime.value = AudioEngine.reverbTime;
  localReverbPreDelay.value = AudioEngine.reverbPreDelay;
  if (AudioEngine['synth']) {
    effectsEnabled.value = AudioEngine['synth'].systemParameters.effectsEnabled;
  }
}

function changeInstrument(channel: number, programNum: number) {
  AudioEngine.setTrackInstrument(channel, programNum);
}

function updateVolume(channel: number, vol: number) {
  AudioEngine.setTrackVolume(channel, vol);
}

function toggleMute(channel: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) AudioEngine.setTrackMute(channel, !track.isMuted);
}

function toggleSolo(channel: number) {
  const track = AudioEngine.tracks.find(t => t.channel === channel);
  if (track) AudioEngine.setTrackSolo(channel, !track.isSoloed);
}

function addTrack() { AudioEngine.addTrack(); }

function deleteTrack(channelIndex: number) { AudioEngine.deleteTrack(channelIndex); }

function playTest(channel: number) { AudioEngine.playTestNote(channel); }

function startTrackingVoices() {
  stopTrackingVoices();
  voicesInterval = window.setInterval(() => {
    AudioEngine.tracks.forEach(track => {
      if (AudioEngine['synth']) {
        const chan = AudioEngine['synth'].midiChannels[track.channel];
        if (chan) liveVoices.value[track.channel] = chan.voiceCount || 0;
      }
    });
  }, 150);
}

function stopTrackingVoices() {
  if (voicesInterval !== null) { clearInterval(voicesInterval); voicesInterval = null; }
}

onMounted(() => {
  startTrackingVoices();
  syncReverbValues();
  AudioEngine.onStateChange(() => { syncReverbValues(); });
});

onBeforeUnmount(() => { stopTrackingVoices(); });
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

.mixer-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: rgba(18, 18, 24, 0.7); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.title-group { display: flex; align-items: center; gap: 8px; }
.title-group h3 { margin: 0; font-size: 0.9rem; font-weight: 600; color: #e2e2e9; }
.icon { width: 16px; height: 16px; color: #00f0ff; }
.mixer-actions { display: flex; align-items: center; gap: 12px; }
.mode-selector { display: flex; align-items: center; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.06); padding: 2px; border-radius: 8px; }
.mode-btn { background: transparent; border: none; color: #a0a0b0; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.mode-btn:hover { color: #ffffff; background: rgba(255, 255, 255, 0.05); }
.mode-btn.active { background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%); color: #ffffff; box-shadow: 0 0 8px rgba(0, 240, 255, 0.25); }

.add-track-btn-bottom { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 16px; padding: 10px; background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.25); border-radius: 12px; color: #00f0ff; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.add-track-btn-bottom:hover { background: rgba(0, 240, 255, 0.1); border-color: #00f0ff; color: #ffffff; box-shadow: 0 4px 12px rgba(0, 240, 255, 0.15); transform: translateY(-1px); }
.add-icon { width: 14px; height: 14px; }
.mixer-body { flex: 1; padding: 16px; overflow-y: auto; background: rgba(13, 13, 18, 0.6); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #606078; gap: 8px; }
.empty-icon { width: 32px; height: 32px; opacity: 0.5; }
.tracks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.track-card { position: relative; display: flex; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; padding: 10px; gap: 12px; transition: all 0.25s ease; }
.track-card.active { border-color: rgba(0, 240, 255, 0.2); }
.track-card.muted { opacity: 0.4; }
.track-card.soloed { border-color: #ff007f; }
.track-card.dropdown-active { z-index: 50; }

.meter-container { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 34px; }
.meter-label { font-size: 0.65rem; font-weight: 700; color: #7c7c8e; }
.meter-bar-wrapper { flex: 1; width: 6px; background: #111115; border-radius: 3px; position: relative; overflow: hidden; }
.meter-bar-fill { width: 100%; position: absolute; bottom: 0; left: 0; background: linear-gradient(to top, #0072ff, #00f0ff, #39ff14, #ff007f); border-radius: 3px; transition: height 0.05s ease-out; }

.track-details { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
.track-name-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.track-name { font-size: 0.8rem; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.voice-count-badge { font-size: 0.65rem; background: rgba(57, 255, 20, 0.15); color: #39ff14; padding: 1px 4px; border-radius: 3px; font-weight: 700; }
.volume-slider-container { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.vol-slider { flex: 1; height: 4px; -webkit-appearance: none; background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
.vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #00f0ff; cursor: pointer; }
.vol-value { font-size: 0.7rem; color: #a0a0b0; width: 32px; text-align: right; }

.mixer-buttons { display: flex; gap: 4px; }
.mixer-buttons button { flex: 1; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); color: #8c8c9e; padding: 4px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; cursor: pointer; }
.btn-mute.active { background: rgba(255, 59, 48, 0.15); border-color: rgba(255, 59, 48, 0.3); color: #ff3b30; }
.btn-solo.active { background: rgba(255, 0, 127, 0.15); border-color: rgba(255, 0, 127, 0.3); color: #ff007f; }
.btn-delete { color: #ff3b30 !important; }

.btn-test { background: rgba(0, 240, 255, 0.05) !important; color: #00f0ff !important; }
.btn-fx-toggle { background: rgba(147, 51, 234, 0.06) !important; color: #c084fc !important; }
.btn-fx-toggle.active { background: rgba(147, 51, 234, 0.2) !important; border-color: #a855f7 !important; color: #e9d5ff !important; }

.master-fx-panel { background: rgba(15, 15, 23, 0.6); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.master-fx-panel.expanded { background: rgba(22, 17, 36, 0.7); }
.master-fx-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; cursor: pointer; }
.fx-header-title { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: #d1d1e2; }
.fx-icon { width: 14px; height: 14px; color: #a855f7; }
.fx-status-badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
.fx-status-badge.active { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
.master-fx-body { padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; }
.fx-control-row { display: flex; justify-content: space-between; align-items: center; }
.fx-toggle-btn.active { background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; }
.fx-slider-meta { display: flex; justify-content: space-between; font-size: 0.7rem; color: #a0a0b0; }
.fx-slider-meta .value { color: #c084fc; font-family: monospace; }
.fx-slider { width: 100%; height: 4px; -webkit-appearance: none; background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
.fx-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: #c084fc; }

.track-card.expanded { border-color: rgba(168, 85, 247, 0.15); background: rgba(30, 24, 48, 0.2); }
.track-fx-panel { margin-top: 10px; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; display: flex; flex-direction: column; gap: 10px; }
.fx-field-header { display: flex; justify-content: space-between; align-items: center; }
.fx-field-title { font-size: 0.65rem; color: #8c8c9e; font-weight: 600; }
.fx-val { font-size: 0.65rem; color: #c084fc; font-family: monospace; font-weight: bold; }
.pan-input, .fx-input { flex: 1; height: 4px; -webkit-appearance: none; background: rgba(255, 255, 255, 0.08); border-radius: 2px; }
.pan-input::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; }
.reverb-input::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 8px; border-radius: 50%; background: #c084fc; }
.chorus-input::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 8px; border-radius: 50%; background: #f43f5e; }
.btn-reset-mini { background: transparent; border: none; color: #606078; cursor: pointer; padding: 2px; }
.btn-reset-mini:hover { color: #ffffff; }
</style>
