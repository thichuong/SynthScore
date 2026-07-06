import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { Midi } from '@tonejs/midi';

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

  // Callback thông báo thời gian thay đổi
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private onSongEndedCallback: (() => void) | null = null;

  // Cache Soundfont để tránh tải lại
  private defaultSoundfontBuffer: ArrayBuffer | null = null;
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

      // 2. Đăng ký AudioWorklet Processor từ thư mục public
      await this.audioContext.audioWorklet.addModule('/spessasynth_processor.min.js');

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

      // 7. Tải Soundfont mặc định (.sf3 cho dung lượng nhẹ)
      await this.loadDefaultSoundfont();

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

  // Tải Soundfont mặc định
  private async loadDefaultSoundfont(): Promise<void> {
    if (!this.synth) return;

    const url = 'https://cdn.jsdelivr.net/gh/craffel/pretty-midi@master/pretty_midi/TimGM6mb.sf2';
    try {
      let buffer: ArrayBuffer;
      if (this.defaultSoundfontBuffer) {
        buffer = this.defaultSoundfontBuffer;
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        buffer = await res.arrayBuffer();
        this.defaultSoundfontBuffer = buffer;
      }

      await this.synth.soundBankManager.addSoundBank(buffer, 'default');
      await this.synth.isReady;
    } catch (err) {
      console.error('Không thể tải Soundfont mặc định từ CDN, thử tải file dự phòng:', err);
      // Bạn có thể tải file dự phòng cục bộ ở đây nếu có
    }
  }

  // Cho phép người dùng tải lên Soundfont .sf2 của riêng họ
  public async loadCustomSoundfont(arrayBuffer: ArrayBuffer, _name: string): Promise<void> {
    if (!this.synth) {
      await this.init();
    }
    if (!this.synth) return;

    this.isLoadingSoundfont = true;
    this.triggerStateChange();

    try {
      // Xóa soundbank cũ
      await this.synth.soundBankManager.deleteSoundBank('custom');
    } catch (e) {
      // Bỏ qua nếu chưa tồn tại
    }

    try {
      await this.synth.soundBankManager.addSoundBank(arrayBuffer, 'custom');
      await this.synth.isReady;
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

    this.currentSongName = songName;
    this.currentTime = 0;
    this.playbackRate = 1.0;
    this.sequencer.playbackRate = 1.0;

    // Nạp tệp MIDI vào sequencer
    const arrayBuffer = (midiBytes.buffer as ArrayBuffer).slice(
      midiBytes.byteOffset,
      midiBytes.byteOffset + midiBytes.byteLength
    );
    this.sequencer.loadNewSongList([{ binary: arrayBuffer, fileName: songName }]);
    
    this.duration = this.sequencer.duration || 0;
    this.bpm = this.sequencer.currentTempo || 120;

    // Phân tích các bè nhạc cụ từ tệp MIDI
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
            instrName: track.instrument.name || 'Piano',
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
