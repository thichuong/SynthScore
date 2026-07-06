import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { Midi } from '@tonejs/midi';
import { GM_INSTRUMENTS } from '../data/instruments';
import { getCachedSoundfont, cacheSoundfont } from './appCache';

export interface TrackInfo {
  channel: number;
  name: string;
  instrumentName: string;
  instrumentNumber: number;
  volume: number;      // 0 to 100
  isMuted: boolean;
  isSoloed: boolean;
  noteCount: number;
}

class AudioEngineService {
  private audioContext: AudioContext | null = null;
  private synth: WorkletSynthesizer | null = null;
  private sequencer: Sequencer | null = null;
  public analyser: AnalyserNode | null = null;

  public isInitialized = false;
  public isReady = false;
  public isLoadingSoundfont = false;
  public isPlaying = false;
  
  public currentSongName = '';
  public currentTime = 0;
  public duration = 0;
  public bpm = 120;
  public playbackRate = 1.0;
  public masterVolume = 80; // 0 to 100

  // Danh sách bè nhạc (tracks)
  public tracks: TrackInfo[] = [];

  public playbackMode: 'default' | 'symphony' | 'concerto' = 'default';
  public activeMidiBytes: Uint8Array | null = null;
  private originalMidiBytes: Uint8Array | null = null;
  private originalSongName = '';

  // Callback thông báo thời gian thay đổi
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private onSongEndedCallback: (() => void) | null = null;

  // Cache Soundfont để tránh tải lại
  public soundfontCache: Map<string, ArrayBuffer> = new Map();
  public customSoundfontName = '';
  public currentSoundfontId = 'timgm';

  public readonly SOUNDFONTS = [
    { id: 'timgm', name: 'TimGM6mb (Nhẹ - 6MB)', url: 'https://cdn.jsdelivr.net/gh/craffel/pretty-midi@master/pretty_midi/TimGM6mb.sf2' },
    { id: 'chorium', name: 'ChoriumRevA (Tốt - 27MB)', url: 'https://raw.githubusercontent.com/namin/metasolfeggio/master/mingus/ChoriumRevA.SF2' },
    { id: 'fluid', name: 'FluidR3_GM (Nặng - 148MB)', url: 'https://github.com/pianobooster/fluid-soundfont/releases/download/v3.1/FluidR3_GM.sf2' }
  ];

  private timeUpdateInterval: any = null;

  constructor() {
    // Không tự động khởi tạo AudioContext ở đây để tránh chính sách chặn autoplay của trình duyệt
  }

  // Khởi tạo Audio Engine
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    this.isInitialized = true;
    this.isLoadingSoundfont = true;
    this.triggerStateChange();

    try {
      // 1. Tạo AudioContext
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();

      // 2. Đăng ký AudioWorklet Processor từ thư mục public (tự động thêm base path từ Vite)
      const baseUrl = import.meta.env.BASE_URL || '/';
      const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      await this.audioContext.audioWorklet.addModule(`${normalizedBaseUrl}spessasynth_processor.min.js`);

      // 3. Khởi tạo Synthesizer
      this.synth = new WorkletSynthesizer(this.audioContext);

      // 4. Cấu hình Analyser để trực quan hóa
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.synth.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // 5. Khởi tạo Sequencer
      this.sequencer = new Sequencer(this.synth);

      // 6. Đăng ký các sự kiện của Sequencer
      this.sequencer.eventHandler.addEvent('timeChange', 'audio_engine_time', (time) => {
        this.currentTime = time;
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(time);
        }
      });

      this.sequencer.eventHandler.addEvent('songChange', 'audio_engine_song', () => {
        if (this.sequencer) {
          this.duration = this.sequencer.duration || 0;
          this.bpm = this.sequencer.currentTempo || 120;
        }
        this.triggerStateChange();
      });

      this.sequencer.eventHandler.addEvent('songEnded', 'audio_engine_end', () => {
        this.isPlaying = false;
        this.currentTime = 0;
        this.stopTimeLoop();
        this.triggerStateChange();
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(0);
        }
        if (this.onSongEndedCallback) {
          this.onSongEndedCallback();
        }
      });

      // 7. Tải Soundfont mặc định
      await this.loadSoundfont('timgm');

      this.isReady = true;
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
    } catch (error) {
      console.error('Không thể khởi tạo Audio Engine:', error);
      this.isInitialized = false;
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
      throw error;
    }
  }

  // Nạp Soundfont theo ID
  public async loadSoundfont(id: string): Promise<void> {
    if (!this.synth) {
      await this.init();
    }
    if (!this.synth) return;

    if (id === 'custom') {
      const buffer = this.soundfontCache.get('custom');
      if (buffer) {
        this.isLoadingSoundfont = true;
        this.triggerStateChange();
        try {
          try {
            await this.synth.soundBankManager.deleteSoundBank('default');
          } catch (e) {}
          try {
            await this.synth.soundBankManager.deleteSoundBank('custom');
          } catch (e) {}

          await this.synth.soundBankManager.addSoundBank(buffer, 'custom');
          await this.synth.isReady;
          this.currentSoundfontId = 'custom';
          this.isLoadingSoundfont = false;
          this.triggerStateChange();
          return;
        } catch (err) {
          this.isLoadingSoundfont = false;
          this.triggerStateChange();
          console.error('Không thể nạp lại Soundfont tùy chỉnh từ cache:', err);
          throw err;
        }
      } else {
        throw new Error('Chưa có Soundfont tùy chỉnh nào được tải lên.');
      }
    }

    const sf = this.SOUNDFONTS.find(s => s.id === id);
    if (!sf) return;

    this.isLoadingSoundfont = true;
    this.triggerStateChange();

    try {
      let buffer: ArrayBuffer;
      if (this.soundfontCache.has(id)) {
        buffer = this.soundfontCache.get(id)!;
      } else {
        const cachedDbBuffer = await getCachedSoundfont(sf.url);
        if (cachedDbBuffer) {
          buffer = cachedDbBuffer;
          this.soundfontCache.set(id, buffer);
        } else {
          let fetchUrl = sf.url;
          // Sử dụng proxy cục bộ trong môi trường localhost để vượt qua CORS
          if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            if (fetchUrl.startsWith('https://github.com/')) {
              fetchUrl = fetchUrl.replace('https://github.com/', '/github-releases/');
            } else if (fetchUrl.startsWith('https://raw.githubusercontent.com/')) {
              fetchUrl = fetchUrl.replace('https://raw.githubusercontent.com/', '/raw-github/');
            }
          }

          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error(`Không thể fetch Soundfont từ URL: ${fetchUrl} (status: ${res.status})`);
          buffer = await res.arrayBuffer();

          // Lưu cache
          this.soundfontCache.set(id, buffer);
          await cacheSoundfont(sf.url, buffer);
        }
      }

      // Xóa tất cả các soundbank để đảm bảo nạp mới hoàn toàn
      try {
        await this.synth.soundBankManager.deleteSoundBank('default');
      } catch (e) {}
      try {
        await this.synth.soundBankManager.deleteSoundBank('custom');
      } catch (e) {}

      await this.synth.soundBankManager.addSoundBank(buffer, 'default');
      await this.synth.isReady;

      this.currentSoundfontId = id;
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
    } catch (err) {
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
      console.error(`Không thể nạp Soundfont ${sf.name}:`, err);
      throw err;
    }
  }

  // Cho phép người dùng tải lên Soundfont .sf2 của riêng họ
  public async loadCustomSoundfont(arrayBuffer: ArrayBuffer, name: string): Promise<void> {
    if (!this.synth) {
      await this.init();
    }
    if (!this.synth) return;

    this.isLoadingSoundfont = true;
    this.triggerStateChange();

    try {
      // Xóa soundbank cũ
      try {
        await this.synth.soundBankManager.deleteSoundBank('default');
      } catch (e) {}
      try {
        await this.synth.soundBankManager.deleteSoundBank('custom');
      } catch (e) {}

      await this.synth.soundBankManager.addSoundBank(arrayBuffer, 'custom');
      await this.synth.isReady;
      
      this.soundfontCache.set('custom', arrayBuffer);
      this.customSoundfontName = name;
      this.currentSoundfontId = 'custom';
      
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
    } catch (err) {
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
      console.error('Không thể nạp file Soundfont tùy chỉnh:', err);
      throw err;
    }
  }

  // Nạp bài hát (MIDI nhị phân)
  public async loadSong(midiBytes: Uint8Array, songName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this.sequencer || !this.synth) return;

    // Tạm dừng phát nhạc hiện tại
    this.pause();

    // Lưu trữ dữ liệu gốc
    this.originalMidiBytes = midiBytes;
    this.originalSongName = songName;
    this.playbackMode = 'default';

    await this.loadMidiBytesForPlayback(midiBytes, songName);
  }

  // Helper nạp MIDI nhị phân thực tế vào sequencer
  private async loadMidiBytesForPlayback(midiBytes: Uint8Array, songName: string): Promise<void> {
    if (!this.sequencer || !this.synth) return;

    this.currentSongName = songName;
    this.currentTime = 0;
    this.playbackRate = 1.0;
    this.sequencer.playbackRate = 1.0;
    this.activeMidiBytes = midiBytes;

    const arrayBuffer = (midiBytes.buffer as ArrayBuffer).slice(
      midiBytes.byteOffset,
      midiBytes.byteOffset + midiBytes.byteLength
    );
    this.sequencer.loadNewSongList([{ binary: arrayBuffer, fileName: songName }]);
    
    this.duration = this.sequencer.duration || 0;
    this.bpm = this.sequencer.currentTempo || 120;

    // Phân tích các bè nhạc cụ từ tệp MIDI mới nạp
    this.parseTracks(arrayBuffer);
    this.resetMixerSettings();
    this.triggerStateChange();
  }

  // Phân tích danh sách bè của bài nhạc bằng @tonejs/midi
  private parseTracks(arrayBuffer: ArrayBuffer): void {
    try {
      const midi = new Midi(arrayBuffer);
      
      // Tạo bản đồ lưu trữ các track có nốt nhạc theo kênh (channel)
      const channelNotes = new Map<number, { name: string; instrName: string; instrNum: number; count: number }>();

      midi.tracks.forEach(track => {
        if (track.notes.length === 0) return;

        const chan = track.channel;
        const current = channelNotes.get(chan);
        
        if (!current) {
          channelNotes.set(chan, {
            name: track.name || `Kênh ${chan + 1}`,
            instrName: track.instrument.name || GM_INSTRUMENTS[track.instrument.number] || 'Piano',
            instrNum: track.instrument.number,
            count: track.notes.length
          });
        } else {
          // Cộng dồn nốt nhạc nếu trùng kênh
          current.count += track.notes.length;
        }
      });

      // Tạo mảng thông tin track hoàn chỉnh
      this.tracks = Array.from(channelNotes.entries()).map(([chan, info]) => {
        return {
          channel: chan,
          name: info.name,
          instrumentName: info.instrName,
          instrumentNumber: info.instrNum,
          volume: 80,
          isMuted: false,
          isSoloed: false,
          noteCount: info.count
        };
      }).sort((a, b) => a.channel - b.channel);

    } catch (e) {
      console.error('Không thể phân tích cấu trúc MIDI tracks:', e);
      // Fallback: tạo 16 kênh mặc định
      this.tracks = Array.from({ length: 16 }, (_, i) => ({
        channel: i,
        name: i === 9 ? 'Bộ trống (Drums)' : `Bè Kênh ${i + 1}`,
        instrumentName: i === 9 ? 'Drum Kit' : 'Acoustic Piano',
        instrumentNumber: i === 9 ? 0 : 0,
        volume: 80,
        isMuted: false,
        isSoloed: false,
        noteCount: 1
      }));
    }
  }

  // Khôi phục cài đặt mixer
  private resetMixerSettings(): void {
    if (!this.synth) return;
    
    // Đặt lại âm lượng và tắt/bật cho tất cả 16 kênh của Synthesizer
    for (let i = 0; i < 16; i++) {
      const channel = this.synth.midiChannels[i];
      if (channel) {
        channel.setSystemParameter('gain', 0.8);
        channel.setSystemParameter('isMuted', false);
      }
    }
  }

  // Điều khiển phát nhạc
  public play(): void {
    if (!this.sequencer || !this.audioContext) return;
    
    // Kích hoạt AudioContext nếu đang ở trạng thái ngủ
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.sequencer.play();
    this.isPlaying = true;
    this.triggerStateChange();
    this.startTimeLoop();
  }

  public pause(): void {
    if (!this.sequencer) return;
    this.sequencer.pause();
    this.isPlaying = false;
    this.stopTimeLoop();
    this.triggerStateChange();
  }

  public stop(): void {
    if (!this.sequencer) return;
    this.sequencer.pause();
    this.sequencer.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.stopTimeLoop();
    this.triggerStateChange();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }
  }

  // Seek vị trí phát nhạc (tính theo giây)
  public seek(seconds: number): void {
    if (!this.sequencer) return;
    this.sequencer.currentTime = seconds;
    this.currentTime = seconds;
    this.triggerStateChange();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds);
    }
  }

  private startTimeLoop(): void {
    this.stopTimeLoop();
    this.timeUpdateInterval = setInterval(() => {
      if (this.sequencer) {
        this.currentTime = this.sequencer.currentTime;
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(this.currentTime);
        }
      }
    }, 100);
  }

  private stopTimeLoop(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // Tốc độ phát nhạc
  public setPlaybackRate(rate: number): void {
    if (!this.sequencer) return;
    this.playbackRate = rate;
    this.sequencer.playbackRate = rate;
    this.triggerStateChange();
  }

  // Âm lượng tổng
  public setMasterVolume(vol: number): void {
    this.masterVolume = vol;
    if (!this.synth) return;
    // SpessaSynth có volume tổng nằm ở system parameters
    this.synth.setSystemParameter('gain', vol / 100);
    this.triggerStateChange();
  }

  // Điều chỉnh âm lượng cho một track cụ thể
  public setTrackVolume(channelIndex: number, vol: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.volume = vol;
      if (this.synth) {
        const chan = this.synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('gain', vol / 100);
        }
      }
    }
  }

  // Tắt tiếng bè nhạc cụ
  public setTrackMute(channelIndex: number, mute: boolean): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.isMuted = mute;
      this.applyMuteSoloSettings();
    }
  }

  // Solo một bè nhạc cụ
  public setTrackSolo(channelIndex: number, solo: boolean): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.isSoloed = solo;
      this.applyMuteSoloSettings();
    }
  }

  // Thay đổi nhạc cụ cho một track cụ thể
  public setTrackInstrument(channelIndex: number, programNumber: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.instrumentNumber = programNumber;
      track.instrumentName = GM_INSTRUMENTS[programNumber] || 'Unknown';
      if (this.synth) {
        this.synth.programChange(channelIndex, programNumber);
      }
      this.triggerStateChange();
    }
  }

  // Thiết lập hoặc khôi phục chế độ phát nhạc về nguyên bản
  public async setPlaybackMode(mode: 'default' | 'symphony' | 'concerto'): Promise<void> {
    if (!this.originalMidiBytes) return;

    const wasPlaying = this.isPlaying;
    const savedTime = this.currentTime;

    this.playbackMode = mode;

    if (mode === 'default') {
      await this.loadMidiBytesForPlayback(this.originalMidiBytes, this.originalSongName);
    } 
    else if (mode === 'symphony') {
      const symMidiBytes = this.generateSymphonyMidi(this.originalMidiBytes);
      await this.loadMidiBytesForPlayback(symMidiBytes, `${this.originalSongName} (Giao Hưởng)`);
    }
    else if (mode === 'concerto') {
      const concertoMidiBytes = this.generateConcertoMidi(this.originalMidiBytes);
      await this.loadMidiBytesForPlayback(concertoMidiBytes, `${this.originalSongName} (Concerto)`);
    }

    this.seek(savedTime);
    if (wasPlaying) {
      this.play();
    }
    this.triggerStateChange();
  }

  // Thêm một nhạc cụ mới vào danh sách
  public addTrack(): void {
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
      return;
    }

    const newTrack: TrackInfo = {
      channel: newChan,
      name: `Kênh mới ${newChan + 1}`,
      instrumentName: GM_INSTRUMENTS[0], // Acoustic Grand Piano
      instrumentNumber: 0,
      volume: 80,
      isMuted: false,
      isSoloed: false,
      noteCount: 0
    };
    
    this.tracks.push(newTrack);
    this.tracks.sort((a, b) => a.channel - b.channel);
    
    if (this.synth) {
      this.synth.programChange(newChan, 0);
      const chan = this.synth.midiChannels[newChan];
      if (chan) {
        chan.setSystemParameter('gain', 0.8);
        chan.setSystemParameter('isMuted', false);
      }
    }
    this.triggerStateChange();
  }

  // Xóa một nhạc cụ khỏi danh sách
  public deleteTrack(channelIndex: number): void {
    const idx = this.tracks.findIndex(t => t.channel === channelIndex);
    if (idx !== -1) {
      this.tracks.splice(idx, 1);
      if (this.synth) {
        const chan = this.synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('isMuted', true);
        }
      }
      this.triggerStateChange();
    }
  }

  // Tự động phân tách và chuyển bài nhạc thành phối khí dàn nhạc giao hưởng 11 bè
  private generateSymphonyMidi(originalMidiBytes: Uint8Array): Uint8Array {
    try {
      const originalMidi = new Midi(originalMidiBytes.buffer as ArrayBuffer);
      const symphonyMidi = new Midi();
      symphonyMidi.name = originalMidi.name + " (Symphony)";

      if (originalMidi.header.tempos && originalMidi.header.tempos.length > 0) {
        symphonyMidi.header.setTempo(originalMidi.header.tempos[0].bpm);
      } else {
        symphonyMidi.header.setTempo(120);
      }

      // 11 nhạc cụ giao hưởng
      const symphonicTracksInfo = [
        { name: 'Violin I (Treble Strings)', program: 40, channel: 0 },
        { name: 'Violin II (Treble Strings)', program: 40, channel: 1 },
        { name: 'Viola (Alto Strings)', program: 41, channel: 2 },
        { name: 'Cello (Bass Strings)', program: 42, channel: 3 },
        { name: 'Contrabass (Deep Strings)', program: 43, channel: 4 },
        { name: 'Flute (Woodwind)', program: 73, channel: 5 },
        { name: 'Oboe (Woodwind)', program: 68, channel: 6 },
        { name: 'Clarinet (Woodwind)', program: 71, channel: 7 },
        { name: 'French Horn (Brass)', program: 60, channel: 8 },
        { name: 'Orchestral Harp (Plucked)', program: 46, channel: 9 },
        { name: 'Timpani (Percussion)', program: 47, channel: 10 },
      ];

      const symTracks = symphonicTracksInfo.map(info => {
        const t = symphonyMidi.addTrack();
        t.name = info.name;
        t.instrument.number = info.program;
        t.channel = info.channel;
        return t;
      });

      const allNotes: { midi: number; time: number; duration: number; velocity: number }[] = [];
      originalMidi.tracks.forEach(track => {
        if (track.channel === 9) return; // Bỏ qua bộ gõ cũ
        track.notes.forEach(note => {
          allNotes.push({
            midi: note.midi,
            time: note.time,
            duration: note.duration,
            velocity: note.velocity,
          });
        });
      });

      allNotes.sort((a, b) => a.time - b.time);

      let lastTimpaniTime = -5;

      allNotes.forEach(note => {
        const m = note.midi;
        const t = note.time;
        const d = note.duration;
        const v = note.velocity;

        if (m >= 64) {
          // Giai điệu âm cao: Violin I, Violin II, Flute, Clarinet, French Horn, Harp
          symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });
          symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.7 });
          
          if (m >= 72) {
            symTracks[5].addNote({ midi: m, time: t, duration: d, velocity: v * 0.8 });
          } else {
            symTracks[5].addNote({ midi: m, time: t, duration: d, velocity: v * 0.5 });
          }
          
          symTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.5 });
          symTracks[9].addNote({ midi: m, time: t, duration: d, velocity: v * 0.45 });
        } 
        else if (m >= 48 && m < 64) {
          // Hòa âm âm trung: Viola, Oboe, Clarinet, French Horn, Harp
          symTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.8 });
          symTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.75 });
          symTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
          symTracks[9].addNote({ midi: m, time: t, duration: d, velocity: v * 0.5 });
        } 
        else {
          // Bè trầm (Bass): Cello, Contrabass, Timpani
          symTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.95 });
          
          const cbMidi = m >= 36 ? m - 12 : m;
          symTracks[4].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.75 });

          if (m < 40 && (t - lastTimpaniTime) >= 1.0) {
            symTracks[10].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.5 });
            lastTimpaniTime = t;
          }
        }
      });

      return symphonyMidi.toArray();
    } catch (e) {
      console.error('Lỗi khi sinh nhạc giao hưởng:', e);
      return originalMidiBytes;
    }
  }

  // Tự động phân tách và chuyển bài nhạc thành cấu hình Piano Concerto (Solo Piano + Dàn nhạc đệm)
  private generateConcertoMidi(originalMidiBytes: Uint8Array): Uint8Array {
    try {
      const originalMidi = new Midi(originalMidiBytes.buffer as ArrayBuffer);
      const concertoMidi = new Midi();
      concertoMidi.name = originalMidi.name + " (Piano Concerto)";

      if (originalMidi.header.tempos && originalMidi.header.tempos.length > 0) {
        concertoMidi.header.setTempo(originalMidi.header.tempos[0].bpm);
      } else {
        concertoMidi.header.setTempo(120);
      }

      // 9 tracks: Solo Piano + Accompaniment Orchestra
      const concertoTracksInfo = [
        { name: 'Solo Grand Piano', program: 0, channel: 0 },
        { name: 'Violin I (Orchestra)', program: 40, channel: 1 },
        { name: 'Violin II (Orchestra)', program: 40, channel: 2 },
        { name: 'Viola (Orchestra)', program: 41, channel: 3 },
        { name: 'Cello (Orchestra)', program: 42, channel: 4 },
        { name: 'Contrabass (Orchestra)', program: 43, channel: 5 },
        { name: 'Flute (Orchestra)', program: 73, channel: 6 },
        { name: 'French Horn (Orchestra)', program: 60, channel: 7 },
        { name: 'Timpani (Orchestra)', program: 47, channel: 8 },
      ];

      const concertoTracks = concertoTracksInfo.map(info => {
        const t = concertoMidi.addTrack();
        t.name = info.name;
        t.instrument.number = info.program;
        t.channel = info.channel;
        return t;
      });

      const allNotes: { midi: number; time: number; duration: number; velocity: number }[] = [];
      originalMidi.tracks.forEach(track => {
        if (track.channel === 9) return; // Bỏ qua bộ gõ cũ
        track.notes.forEach(note => {
          allNotes.push({
            midi: note.midi,
            time: note.time,
            duration: note.duration,
            velocity: note.velocity,
          });
        });
      });

      allNotes.sort((a, b) => a.time - b.time);

      let lastTimpaniTime = -5;

      allNotes.forEach(note => {
        const m = note.midi;
        const t = note.time;
        const d = note.duration;
        const v = note.velocity;

        // 1. Solo Grand Piano plays ALL notes at full velocity
        concertoTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });

        // 2. Orchestra accompanies softly
        if (m >= 64) {
          // Treble: Violin I, Violin II, Flute, French Horn
          concertoTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.45 });
          concertoTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
          if (m >= 72) {
            concertoTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
          }
          concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.3 });
        } 
        else if (m >= 48 && m < 64) {
          // Mid: Viola, French Horn
          concertoTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
          concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        } 
        else {
          // Bass: Cello, Contrabass, Timpani
          concertoTracks[4].addNote({ midi: m, time: t, duration: d, velocity: v * 0.5 });
          
          const cbMidi = m >= 36 ? m - 12 : m;
          concertoTracks[5].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.4 });

          if (m < 40 && (t - lastTimpaniTime) >= 1.2) {
            concertoTracks[8].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.35 });
            lastTimpaniTime = t;
          }
        }
      });

      return concertoMidi.toArray();
    } catch (e) {
      console.error('Lỗi khi sinh nhạc concerto:', e);
      return originalMidiBytes;
    }
  }

  // Áp dụng cài đặt Mute/Solo
  private applyMuteSoloSettings(): void {
    const synth = this.synth;
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

    this.triggerStateChange();
  }

  // Quản lý sự kiện lắng nghe
  public onTimeUpdate(cb: (time: number) => void): void {
    this.onTimeUpdateCallback = cb;
  }

  public onStateChange(cb: () => void): void {
    this.onStateChangeCallback = cb;
  }

  public onSongEnded(cb: () => void): void {
    this.onSongEndedCallback = cb;
  }

  private triggerStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }
}

// Export một Singleton của AudioEngine
export const AudioEngine = new AudioEngineService();
