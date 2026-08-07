<template>
  <div class="orchestra-mixer glass-card">
    <MixerHeaderPresets 
      :currentMode="currentMode"
      :showMasterFX="showMasterFX"
      :effectsEnabled="effectsEnabled"
      :masterReverbGain="localMasterReverbGain"
      :reverbCharacter="localReverbCharacter"
      :reverbTime="localReverbTime"
      :reverbPreDelay="localReverbPreDelay"
      @changeMode="$emit('changeMode', $event)"
      @toggleMasterFX="showMasterFX = !showMasterFX"
      @toggleEffects="toggleEffects"
      @resetMasterFX="resetMasterFX"
      @updateReverb="handleUpdateReverb"
    />

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
          <MixerTrackRow
            v-for="track in tracks"
            :key="track.channel"
            :track="track"
            :liveVoices="liveVoices[track.channel] || 0"
            :isExpanded="!!expandedTracks[track.channel]"
            :isDropdownActive="activeDropdownChannel === track.channel"
            @changeInstrument="changeInstrument(track.channel, $event)"
            @updateVolume="updateVolume(track.channel, $event)"
            @playTest="playTest(track.channel)"
            @toggleExpand="toggleTrackExpand(track.channel)"
            @toggleMute="toggleMute(track.channel)"
            @toggleSolo="toggleSolo(track.channel)"
            @deleteTrack="deleteTrack(track.channel)"
            @updatePan="updateTrackPan(track.channel, $event)"
            @resetPan="resetTrackPan(track.channel)"
            @updateReverb="updateTrackReverb(track.channel, $event)"
            @resetReverb="resetTrackReverb(track.channel, track.instrumentNumber)"
            @updateChorus="updateTrackChorus(track.channel, $event)"
            @resetChorus="resetTrackChorus(track.channel, track.instrumentNumber)"
            @dropdownOpen="activeDropdownChannel = track.channel"
            @dropdownClose="closeDropdownChannel(track.channel)"
          />
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
import { Music, Plus } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import type { TrackInfo } from '../services/midiGenerator';
import { getDefaultTrackSettings } from '../services/midiGenerator';
import MixerHeaderPresets from './mixer/MixerHeaderPresets.vue';
import MixerTrackRow from './mixer/MixerTrackRow.vue';

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

function closeDropdownChannel(channel: number) {
  if (activeDropdownChannel.value === channel) {
    activeDropdownChannel.value = null;
  }
}

function toggleTrackExpand(channel: number) {
  expandedTracks.value[channel] = !expandedTracks.value[channel];
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

function handleUpdateReverb(params: { character: number; gain: number; time: number; preDelay: number }) {
  localReverbCharacter.value = params.character;
  localMasterReverbGain.value = params.gain;
  localReverbTime.value = params.time;
  localReverbPreDelay.value = params.preDelay;
  
  AudioEngine.setMasterReverbGain(params.gain);
  AudioEngine.setMasterReverbParams(params.character, params.time, params.preDelay);
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

.mixer-body { flex: 1; padding: 12px 10px; overflow-y: auto; background: rgba(13, 13, 18, 0.6); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #606078; gap: 8px; }
.empty-icon { width: 32px; height: 32px; opacity: 0.5; }
.tracks-grid { display: flex; flex-direction: column; gap: 12px; width: 100%; }

.add-track-btn-bottom, .add-track-btn-center { 
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

.add-track-btn-bottom:hover, .add-track-btn-center:hover { 
  background: rgba(0, 240, 255, 0.1); 
  border-color: #00f0ff; 
  color: #ffffff; 
  box-shadow: 0 4px 12px rgba(0, 240, 255, 0.15); 
  transform: translateY(-1px); 
}

.add-icon { width: 14px; height: 14px; }
</style>
