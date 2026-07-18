import { type WorkletSynthesizer } from 'spessasynth_lib';
import { GM_INSTRUMENTS } from '../../data/instruments';
import { type TrackInfo, getDefaultTrackSettings } from '../midiGenerator';

/**
 * Quản lý danh sách các bè nhạc (tracks) và cấu hình bàn trộn Mixer.
 */
export class TrackManager {
  public tracks: TrackInfo[] = [];

  constructor() {}

  // Khôi phục và áp dụng các cài đặt Mixer (Volume, Pan, Mute, Solo, Reverb, Chorus, Instrument) cho Synth
  public resetMixerSettings(synth: WorkletSynthesizer | null): void {
    if (!synth) return;

    // Áp dụng âm lượng, pan, reverb, chorus cho các track hiện có
    this.tracks.forEach(track => {
      const channel = synth.midiChannels[track.channel];
      if (channel) {
        channel.setSystemParameter('gain', track.volume / 100);
        channel.setSystemParameter('pan', track.pan / 100);
        channel.setSystemParameter('isMuted', track.isMuted);
        synth.controllerChange(track.channel, 91, track.reverbSend);
        synth.controllerChange(track.channel, 93, track.chorusSend);
        synth.programChange(track.channel, track.instrumentNumber);
      }
    });

    // Reset các kênh còn lại về mặc định
    const usedChannels = new Set(this.tracks.map(t => t.channel));
    for (let i = 0; i < 16; i++) {
      if (!usedChannels.has(i)) {
        const channel = synth.midiChannels[i];
        if (channel) {
          channel.setSystemParameter('gain', 1.0);
          channel.setSystemParameter('pan', 0);
          channel.setSystemParameter('isMuted', false);
          synth.controllerChange(i, 91, 0);
          synth.controllerChange(i, 93, 0);
        }
      }
    }

    // Đảm bảo solo/mute được áp dụng chuẩn
    this.applyMuteSoloSettings(synth);
  }

  // Điều chỉnh Panning cho một track
  public setTrackPan(synth: WorkletSynthesizer | null, channelIndex: number, pan: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.pan = pan;
      if (synth) {
        const chan = synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('pan', pan / 100);
        }
      }
    }
  }

  // Điều chỉnh lượng Reverb Send (CC 91)
  public setTrackReverbSend(synth: WorkletSynthesizer | null, channelIndex: number, val: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.reverbSend = val;
      if (synth) {
        synth.controllerChange(channelIndex, 91, val);
      }
    }
  }

  // Điều chỉnh lượng Chorus Send (CC 93)
  public setTrackChorusSend(synth: WorkletSynthesizer | null, channelIndex: number, val: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.chorusSend = val;
      if (synth) {
        synth.controllerChange(channelIndex, 93, val);
      }
    }
  }

  // Điều chỉnh âm lượng cho một track cụ thể
  public setTrackVolume(synth: WorkletSynthesizer | null, channelIndex: number, vol: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.volume = vol;
      if (synth) {
        const chan = synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('gain', vol / 100);
        }
      }
    }
  }

  // Tắt tiếng bè nhạc cụ
  public setTrackMute(synth: WorkletSynthesizer | null, channelIndex: number, mute: boolean): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.isMuted = mute;
      this.applyMuteSoloSettings(synth);
    }
  }

  // Solo một bè nhạc cụ
  public setTrackSolo(synth: WorkletSynthesizer | null, channelIndex: number, solo: boolean): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.isSoloed = solo;
      this.applyMuteSoloSettings(synth);
    }
  }

  // Thay đổi nhạc cụ cho một track
  public setTrackInstrument(synth: WorkletSynthesizer | null, channelIndex: number, programNumber: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.instrumentNumber = programNumber;
      track.instrumentName = GM_INSTRUMENTS[programNumber] || 'Unknown';
      if (synth) {
        synth.programChange(channelIndex, programNumber);
      }
    }
  }

  // Áp dụng logic Solo / Mute lên Synthesizer
  public applyMuteSoloSettings(synth: WorkletSynthesizer | null): void {
    if (!synth) return;

    const anySoloed = this.tracks.some(t => t.isSoloed);

    this.tracks.forEach(track => {
      let shouldMute = track.isMuted;
      if (anySoloed) {
        shouldMute = !track.isSoloed;
      }

      const chan = synth.midiChannels[track.channel];
      if (chan) {
        chan.setSystemParameter('isMuted', shouldMute);
      }
    });
  }

  // Thêm một bè nhạc cụ mới vào danh sách
  public async addTrack(synth: WorkletSynthesizer | null): Promise<number | null> {
    const usedChannels = new Set(this.tracks.map(t => t.channel));
    let newChan = -1;
    for (let i = 0; i < 16; i++) {
      if (i === 9) continue; // Bỏ qua kênh trống/drum kit mặc định
      if (!usedChannels.has(i)) {
        newChan = i;
        break;
      }
    }
    if (newChan === -1 && !usedChannels.has(9)) {
      newChan = 9;
    }
    if (newChan === -1) {
      console.warn('Đã sử dụng hết 16 kênh MIDI.');
      return null;
    }

    const newTrack: TrackInfo = {
      channel: newChan,
      name: `Kênh mới ${newChan + 1}`,
      instrumentName: GM_INSTRUMENTS[0], // Acoustic Grand Piano
      instrumentNumber: 0,
      volume: 100,
      isMuted: false,
      isSoloed: false,
      noteCount: 0,
      pan: 0,
      reverbSend: 50,
      chorusSend: 0
    };

    this.tracks.push(newTrack);
    this.tracks.sort((a, b) => a.channel - b.channel);

    if (synth) {
      synth.programChange(newChan, 0);
      const chan = synth.midiChannels[newChan];
      if (chan) {
        chan.setSystemParameter('gain', 1.0);
        chan.setSystemParameter('isMuted', false);
      }
    }

    return newChan;
  }

  // Xóa một bè nhạc cụ
  public deleteTrack(synth: WorkletSynthesizer | null, channelIndex: number): void {
    const idx = this.tracks.findIndex(t => t.channel === channelIndex);
    if (idx !== -1) {
      this.tracks.splice(idx, 1);
      if (synth) {
        const chan = synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('isMuted', true);
        }
      }
    }
  }
}
