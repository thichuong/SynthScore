import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { GM_INSTRUMENTS } from '../data/instruments';
import {
  type TrackInfo,
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi,
  symphonicTracksInfo,
  concertoTracksInfo,
  getDefaultTrackSettings
} from './midiGenerator';

import { AudioContextManager } from './audio/audioContextManager';
import { SoundfontService, type SoundfontProgress } from './audio/soundfontService';
import { TrackManager } from './audio/trackManager';
import { AudioExporter, type ExportOptions } from './audio/audioExporter';
import { MediaSessionManager } from './audio/mediaSessionManager';
import { loadUserSettings, saveUserSettings } from './appCache';

export type { SoundfontProgress } from './audio/soundfontService';
export type { TrackInfo, ExportOptions };

function extractInitialBpmFromMidi(midiBytes: Uint8Array): number {
  for (let i = 0; i < midiBytes.length - 5; i++) {
    if (midiBytes[i] === 0xFF && midiBytes[i + 1] === 0x51 && midiBytes[i + 2] === 0x03) {
      const tempoUs = (midiBytes[i + 3] << 16) | (midiBytes[i + 4] << 8) | midiBytes[i + 5];
      if (tempoUs > 0) {
        return Math.round(60_000_000 / tempoUs);
      }
    }
  }
  return 120;
}

class AudioEngineService {
  // Các Dịch Vụ Con được Tách Biệt
  private ctxManager = new AudioContextManager();
  private soundfontService = new SoundfontService();
  private trackMgr = new TrackManager();
  private exporter = new AudioExporter();
  private mediaSession = new MediaSessionManager();

  private synth: WorkletSynthesizer | null = null;
  private sequencer: Sequencer | null = null;
  private readonly VOLUME_BOOST_FACTOR = 1.75; // Tăng cường âm lượng đầu ra (~+5dB) cho bộ SoundFont Crisis GM 3.51

  // Trạng thái công khai (Public state)
  public isReady = false;
  public isLoadingSoundfont = false;
  public soundfontProgress: SoundfontProgress | null = null;
  private loadingSoundfontCount = 0;
  public isPlaying = false;

  private startSoundfontLoading(): void {
    this.loadingSoundfontCount++;
    this.isLoadingSoundfont = true;
    this.triggerStateChange();
  }

  private stopSoundfontLoading(): void {
    this.loadingSoundfontCount = Math.max(0, this.loadingSoundfontCount - 1);
    this.isLoadingSoundfont = this.loadingSoundfontCount > 0;
    this.triggerStateChange();
  }

  public currentSongName = '';
  public currentComposer = '';
  public currentTime = 0;
  public duration = 0;
  public bpm = 120;
  public playbackRate = 1.0;
  public masterVolume = 100; // 0 to 100
  public lastMasterVolumeBeforeMute = 100;

  // Hiệu ứng không gian Master Reverb
  public masterReverbGain = 50; // 0 to 100 (50% mặc định)
  public reverbCharacter = 3;   // 0 to 7 (3 = Concert Hall)
  public reverbTime = 90;       // 0 to 127
  public reverbPreDelay = 40;   // 0 to 127

  public playbackMode: 'default' | 'symphony' | 'concerto' = 'default';
  public repeatMode: 'off' | 'all' | 'one' = 'off';
  public activeMidiBytes: Uint8Array | null = null;
  private originalMidiBytes: Uint8Array | null = null;
  private originalSongName = '';

  // Callback thông báo thời gian thay đổi
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onStateChangeCallback: (() => void) | null = null;
  private onSongEndedCallback: (() => void) | null = null;
  private onPreviousTrackCallback: (() => void) | null = null;
  private onNextTrackCallback: (() => void) | null = null;

  private timeUpdateInterval: any = null;
  private worker: Worker | null = null;
  private workerCallbacks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private initPromise: Promise<void> | null = null;

  // Getters tương thích ngược cho Audio Context nodes và cache
  public get audioContext(): AudioContext | null {
    return this.ctxManager.getContext();
  }

  public get analyser(): AnalyserNode | null {
    return this.ctxManager.analyser;
  }

  public get compressor(): DynamicsCompressorNode | null {
    return this.ctxManager.compressor;
  }

  public get isInitialized(): boolean {
    return this.ctxManager.isInitialized;
  }

  public set isInitialized(val: boolean) {
    this.ctxManager.isInitialized = val;
  }

  public get soundfontCache(): Map<string, ArrayBuffer> {
    return this.soundfontService.soundfontCache;
  }

  public get loadedSoundfonts(): Set<string> {
    return this.soundfontService.loadedSoundfonts;
  }

  public get tracks(): TrackInfo[] {
    return this.trackMgr.tracks;
  }

  public set tracks(val: TrackInfo[]) {
    this.trackMgr.tracks = val;
  }

  constructor() {
    // Lắng nghe tiến độ tải soundfont để cập nhật UI
    this.soundfontService.onProgress((progress) => {
      this.soundfontProgress = progress;
      this.triggerStateChange();
    });
  }

  // Giao tiếp với Web Worker để xử lý luồng nền
  private postToWorker<T>(type: 'parseTracks' | 'generateSymphony' | 'generateConcerto', payload: any, transfer?: Transferable[]): Promise<T> {
    if (!this.worker) {
      // Lazy initialization of Web Worker using Vite URL syntax
      this.worker = new Worker(new URL('./midiWorker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, success, payload, error } = e.data;
        const cb = this.workerCallbacks.get(id);
        if (cb) {
          this.workerCallbacks.delete(id);
          if (success) {
            cb.resolve(payload);
          } else {
            cb.reject(new Error(error));
          }
        }
      };
      this.worker.onerror = (e) => {
        console.error('[AudioEngine] Worker error:', e);
      };
    }

    const id = Math.random().toString(36).substring(2, 9) + Date.now();
    return new Promise<T>((resolve, reject) => {
      this.workerCallbacks.set(id, { resolve, reject });
      if (transfer) {
        this.worker!.postMessage({ id, type, payload }, transfer);
      } else {
        this.worker!.postMessage({ id, type, payload });
      }
    });
  }

  // Tiền tải (preload) soundfont
  public preloadSoundfont(programNumber: number, isDrum: boolean = false): Promise<void> {
    return this.soundfontService.preloadSoundfont(programNumber, isDrum);
  }

  // Tiền tải tất cả 4 bộ âm thanh Soundfont vào cache
  public preloadAllSoundfonts(): Promise<void> {
    return this.soundfontService.preloadAllSoundfonts();
  }

  // Khởi tạo Audio Engine
  public async init(): Promise<void> {
    if (this.isInitialized && this.synth) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      console.log('[AudioEngine] Chủ động khởi tạo Audio Engine...');
      this.startSoundfontLoading();

      try {
        // 1. Tạo AudioContext thông qua Context Manager
        const audioCtx = await this.ctxManager.init();

        // 2. Khởi tạo Synthesizer
        this.synth = new WorkletSynthesizer(audioCtx);

        // 3. Kết nối các node âm thanh (Synth -> Analyser -> Compressor -> Output)
        this.synth.connect(this.ctxManager.analyser!);
        this.ctxManager.analyser!.connect(this.ctxManager.compressor!);
        this.ctxManager.compressor!.connect(audioCtx.destination);

        // 4. Khởi tạo Sequencer
        this.sequencer = new Sequencer(this.synth);

        // 5. Đăng ký các sự kiện của Sequencer
        this.sequencer.eventHandler.addEvent('timeChange', 'audio_engine_time', (time) => {
          this.currentTime = time;
          if (this.onTimeUpdateCallback) {
            this.onTimeUpdateCallback(time);
          }
        });

        this.sequencer.eventHandler.addEvent('songChange', 'audio_engine_song', () => {
          if (this.sequencer) {
            this.duration = this.sequencer.duration || 0;
            if (this.activeMidiBytes) {
              this.bpm = extractInitialBpmFromMidi(this.activeMidiBytes);
            } else {
              this.bpm = Math.round(this.sequencer.currentTempo || 120);
            }
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

          // Cập nhật trạng thái Media Session
          this.mediaSession.setPlaybackState('none');
          this.updateMediaSessionPositionState();

          if (this.onSongEndedCallback) {
            this.onSongEndedCallback();
          }
        });

        // 6. Tải các bộ âm thanh Soundfont Crisis GM vào Synthesizer Engine lúc khởi tạo
        await this.soundfontService.loadSongSoundbanks(this.synth, [
          { channel: 0, instrumentNumber: 0 } as any,   // Crisis_GM_0-39.sf3
          { channel: 1, instrumentNumber: 40 } as any,  // Crisis_GM_40-79.sf3
          { channel: 2, instrumentNumber: 80 } as any,  // Crisis_GM_80-111.sf3
          { channel: 9, instrumentNumber: 0 } as any,   // Crisis_GM_112-127_Drums.sf3 (Drums)
        ]);

        const defaults = getDefaultTrackSettings(0, 0);
        this.tracks = [{
          channel: 0,
          name: 'Acoustic Grand Piano',
          instrumentName: GM_INSTRUMENTS[0],
          instrumentNumber: 0,
          volume: 80,
          isMuted: false,
          isSoloed: false,
          noteCount: 0,
          pan: defaults.pan,
          reverbSend: defaults.reverbSend,
          chorusSend: defaults.chorusSend
        }];

        // Nạp cấu hình cài đặt người dùng đã lưu (Volume, PlaybackRate, RepeatMode)
        try {
          const savedSettings = await loadUserSettings();
          this.masterVolume = savedSettings.masterVolume;
          this.playbackRate = savedSettings.playbackRate;
          this.repeatMode = savedSettings.repeatMode;
        } catch (e) {
          console.warn('Lỗi nạp cấu hình cài đặt người dùng:', e);
        }

        // Thiết lập âm lượng tổng ban đầu cho bộ tổng hợp âm với hệ số boost
        this.synth.setSystemParameter('gain', (this.masterVolume / 100) * this.VOLUME_BOOST_FACTOR);

        // Kích hoạt bộ xử lý hiệu ứng (Reverb/Chorus/Delay)
        this.synth.setSystemParameter('effectsEnabled', true);
        this.synth.setSystemParameter('reverbGain', this.masterReverbGain / 100);

        // Cấu hình Reverb mặc định sang kiểu phòng hòa nhạc ấm
        if ((this.synth as any).reverbProcessor) {
          (this.synth as any).reverbProcessor.character = this.reverbCharacter;
          (this.synth as any).reverbProcessor.time = this.reverbTime;
          (this.synth as any).reverbProcessor.preDelayTime = this.reverbPreDelay;
        }

        this.isReady = true;

        // Đăng ký Media Session action handlers
        this.mediaSession.setActionHandlers({
          play: () => this.play(),
          pause: () => this.pause(),
          stop: () => this.stop(),
          seekBackward: (offset) => this.seek(Math.max(0, this.currentTime - offset)),
          seekForward: (offset) => this.seek(Math.min(this.duration, this.currentTime + offset)),
          seekTo: (time) => this.seek(time),
          previousTrack: () => {
            if (this.onPreviousTrackCallback) this.onPreviousTrackCallback();
          },
          nextTrack: () => {
            if (this.onNextTrackCallback) this.onNextTrackCallback();
          }
        });

      } catch (error) {
        console.error('Không thể khởi tạo Audio Engine:', error);
        this.isInitialized = false;
        this.isReady = false;
        this.synth = null;
        this.sequencer = null;
        throw error;
      } finally {
        this.stopSoundfontLoading();
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  // Nạp bộ âm thanh nhạc cụ động
  public async loadInstrumentSoundbank(programNumber: number, isDrum: boolean = false): Promise<void> {
    if (!this.synth) {
      await this.init();
    }
    if (!this.synth) return;

    this.startSoundfontLoading();

    try {
      await this.soundfontService.loadInstrumentSoundbank(this.synth, programNumber, isDrum);
    } finally {
      this.stopSoundfontLoading();
    }
  }

  // Tự động tải tất cả các bộ âm thanh cho các nhạc cụ có trong bài hát hiện tại
  private async loadSongSoundbanks(): Promise<void> {
    if (!this.synth) return;
    this.startSoundfontLoading();
    try {
      await this.soundfontService.loadSongSoundbanks(this.synth, this.tracks);
    } finally {
      this.stopSoundfontLoading();
    }
  }

  // Nạp bài hát (MIDI nhị phân)
  public async loadSong(midiBytes: Uint8Array, songName: string, composer?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (!this.sequencer || !this.synth) return;

    // Tạm dừng phát nhạc hiện tại
    this.pause();

    // Reset danh sách tracks cũ để tránh rò rỉ cấu hình mixer
    this.tracks = [];

    // Lưu trữ dữ liệu gốc
    this.originalMidiBytes = midiBytes;
    this.originalSongName = songName;
    this.currentComposer = composer || '';

    // Giữ nguyên chế độ phát nhạc hiện tại
    const mode = this.playbackMode || 'default';

    if (mode === 'default') {
      await this.loadMidiBytesForPlayback(midiBytes, songName);
    }
    else if (mode === 'symphony') {
      try {
        console.log('[AudioEngine] Đang sinh nhạc giao hưởng qua Web Worker...');
        const symMidiBytes = await this.postToWorker<Uint8Array>('generateSymphony', midiBytes);
        await this.loadMidiBytesForPlayback(symMidiBytes, `${songName} (Giao Hưởng)`);
      } catch (err) {
        console.error('Lỗi khi sinh nhạc giao hưởng qua worker, dùng fallback:', err);
        const symMidiBytes = generateSymphonyMidi(midiBytes);
        await this.loadMidiBytesForPlayback(symMidiBytes, `${songName} (Giao Hưởng)`);
      }
    }
    else if (mode === 'concerto') {
      try {
        console.log('[AudioEngine] Đang sinh nhạc concerto qua Web Worker...');
        const concertoMidiBytes = await this.postToWorker<Uint8Array>('generateConcerto', midiBytes);
        await this.loadMidiBytesForPlayback(concertoMidiBytes, `${songName} (Concerto)`);
      } catch (err) {
        console.error('Lỗi khi sinh nhạc concerto qua worker, dùng fallback:', err);
        const concertoMidiBytes = generateConcertoMidi(midiBytes);
        await this.loadMidiBytesForPlayback(concertoMidiBytes, `${songName} (Concerto)`);
      }
    }
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
    this.bpm = extractInitialBpmFromMidi(midiBytes);

    // Phân tích các bè nhạc cụ từ tệp MIDI mới nạp qua Web Worker
    let parsedTracks: TrackInfo[] = [];
    try {
      const parseBuffer = arrayBuffer.slice(0);
      parsedTracks = await this.postToWorker<TrackInfo[]>('parseTracks', parseBuffer, [parseBuffer]);
    } catch (err) {
      console.error('Lỗi khi phân tích tracks qua worker, dùng fallback:', err);
      parsedTracks = parseMidiTracks(arrayBuffer);
    }

    // Ghép nối cấu hình để giữ lại thiết lập Mixer của người dùng
    this.tracks = parsedTracks.map(pt => {
      const existing = this.tracks.find(et => et.channel === pt.channel);
      if (existing) {
        return {
          ...pt,
          volume: existing.volume,
          pan: existing.pan,
          reverbSend: existing.reverbSend,
          chorusSend: existing.chorusSend,
          isMuted: existing.isMuted,
          isSoloed: existing.isSoloed,
          instrumentNumber: pt.instrumentNumber,
          instrumentName: pt.instrumentName,
        };
      }
      return pt;
    });

    await this.loadSongSoundbanks();
    this.resetMixerSettings();
    this.triggerStateChange();

    // Cấu hình Media Session cho bài hát mới
    this.updateMediaSession();
  }

  // Khôi phục cài đặt mixer
  private resetMixerSettings(): void {
    this.trackMgr.resetMixerSettings(this.synth);
  }

  // Điều chỉnh Panning cho một track
  public setTrackPan(channelIndex: number, pan: number): void {
    this.trackMgr.setTrackPan(this.synth, channelIndex, pan);
    this.triggerStateChange();
  }

  // Điều chỉnh lượng Reverb Send cho một track (CC 91)
  public setTrackReverbSend(channelIndex: number, val: number): void {
    this.trackMgr.setTrackReverbSend(this.synth, channelIndex, val);
    this.triggerStateChange();
  }

  // Điều chỉnh lượng Chorus Send cho một track (CC 93)
  public setTrackChorusSend(channelIndex: number, val: number): void {
    this.trackMgr.setTrackChorusSend(this.synth, channelIndex, val);
    this.triggerStateChange();
  }

  // Điều chỉnh Master Reverb Volume
  public setMasterReverbGain(vol: number): void {
    this.masterReverbGain = vol;
    if (this.synth) {
      this.synth.setSystemParameter('reverbGain', vol / 100);
      this.triggerStateChange();
    }
  }

  // Điều chỉnh các tham số chi tiết của Reverb
  public setMasterReverbParams(char: number, time: number, preDelay: number): void {
    this.reverbCharacter = char;
    this.reverbTime = time;
    this.reverbPreDelay = preDelay;
    if (this.synth && (this.synth as any).reverbProcessor) {
      (this.synth as any).reverbProcessor.character = char;
      (this.synth as any).reverbProcessor.time = time;
      (this.synth as any).reverbProcessor.preDelayTime = preDelay;
      this.triggerStateChange();
    }
  }

  // Điều khiển phát nhạc
  public play(): void {
    if (!this.sequencer) return;

    this.ctxManager.resumeContext();
    this.sequencer.play();
    this.isPlaying = true;
    this.triggerStateChange();
    this.startTimeLoop();

    // Cập nhật trạng thái phát nhạc của Media Session
    this.mediaSession.setPlaybackState('playing');
    this.updateMediaSessionPositionState();
  }

  public pause(): void {
    if (!this.sequencer) return;
    this.sequencer.pause();
    this.isPlaying = false;
    this.stopTimeLoop();
    this.triggerStateChange();

    // Cập nhật trạng thái phát nhạc của Media Session
    this.mediaSession.setPlaybackState('paused');
    this.updateMediaSessionPositionState();
  }

  public stop(): void {
    if (!this.sequencer) return;
    this.sequencer.pause();
    this.sequencer.currentTime = 0;
    this.currentTime = 0;
    this.isPlaying = false;
    this.resetMixerSettings();
    this.stopTimeLoop();
    this.triggerStateChange();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(0);
    }

    // Cập nhật trạng thái phát nhạc của Media Session
    this.mediaSession.setPlaybackState('none');
    this.updateMediaSessionPositionState();
  }

  // Seek vị trí phát nhạc (tính theo giây)
  public seek(seconds: number): void {
    if (!this.sequencer) return;
    this.sequencer.currentTime = seconds;
    this.currentTime = seconds;
    this.resetMixerSettings();
    this.triggerStateChange();
    if (this.onTimeUpdateCallback) {
      this.onTimeUpdateCallback(seconds);
    }

    // Cập nhật vị trí của Media Session
    this.updateMediaSessionPositionState();
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
    }, 33);
  }

  private stopTimeLoop(): void {
    if (this.timeUpdateInterval !== null) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // Tốc độ phát nhạc
  public setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.sequencer) {
      this.sequencer.playbackRate = rate;
    }
    this.triggerStateChange();

    // Cập nhật vị trí và tốc độ phát của Media Session
    this.updateMediaSessionPositionState();

    // Tự động lưu vào appCache
    saveUserSettings({ playbackRate: rate });
  }

  // Âm lượng tổng
  public setMasterVolume(vol: number): void {
    if (vol > 0) {
      this.lastMasterVolumeBeforeMute = vol;
    }
    this.masterVolume = vol;
    if (this.synth) {
      this.synth.setSystemParameter('gain', (vol / 100) * this.VOLUME_BOOST_FACTOR);
    }
    this.triggerStateChange();

    // Tự động lưu vào appCache
    saveUserSettings({ masterVolume: vol });
  }

  // Bật/tắt tiếng (Toggle Mute)
  public toggleMute(): number {
    if (this.masterVolume > 0) {
      this.lastMasterVolumeBeforeMute = this.masterVolume;
      this.setMasterVolume(0);
      return 0;
    } else {
      const restoreVol = this.lastMasterVolumeBeforeMute || 80;
      this.setMasterVolume(restoreVol);
      return restoreVol;
    }
  }

  // Điều chỉnh âm lượng cho một track cụ thể
  public setTrackVolume(channelIndex: number, vol: number): void {
    this.trackMgr.setTrackVolume(this.synth, channelIndex, vol);
    this.triggerStateChange();
  }

  // Tắt tiếng bè nhạc cụ
  public setTrackMute(channelIndex: number, mute: boolean): void {
    this.trackMgr.setTrackMute(this.synth, channelIndex, mute);
    this.triggerStateChange();
  }

  // Solo một bè nhạc cụ
  public setTrackSolo(channelIndex: number, solo: boolean): void {
    this.trackMgr.setTrackSolo(this.synth, channelIndex, solo);
    this.triggerStateChange();
  }

  // Thay đổi nhạc cụ cho một track cụ thể
  public async setTrackInstrument(channelIndex: number, programNumber: number): Promise<void> {
    const isDrum = channelIndex === 9;
    this.trackMgr.setTrackInstrument(this.synth, channelIndex, programNumber);
    this.triggerStateChange();
    await this.loadInstrumentSoundbank(programNumber, isDrum);
  }

  // Thiết lập hoặc khôi phục chế độ phát nhạc về nguyên bản
  public async setPlaybackMode(mode: 'default' | 'symphony' | 'concerto'): Promise<void> {
    this.playbackMode = mode;
    this.triggerStateChange();

    if (!this.originalMidiBytes) {
      if (mode === 'symphony') {
        this.tracks = symphonicTracksInfo.map(info => {
          const defaults = getDefaultTrackSettings(info.program, info.channel);
          return {
            channel: info.channel,
            name: info.name,
            instrumentName: GM_INSTRUMENTS[info.program] || 'Unknown',
            instrumentNumber: info.program,
            volume: 80,
            isMuted: false,
            isSoloed: false,
            noteCount: 0,
            pan: defaults.pan,
            reverbSend: defaults.reverbSend,
            chorusSend: defaults.chorusSend
          };
        });
      } else if (mode === 'concerto') {
        this.tracks = concertoTracksInfo.map(info => {
          const defaults = getDefaultTrackSettings(info.program, info.channel);
          return {
            channel: info.channel,
            name: info.name,
            instrumentName: GM_INSTRUMENTS[info.program] || 'Unknown',
            instrumentNumber: info.program,
            volume: 80,
            isMuted: false,
            isSoloed: false,
            noteCount: 0,
            pan: defaults.pan,
            reverbSend: defaults.reverbSend,
            chorusSend: defaults.chorusSend
          };
        });
      } else {
        const defaults = getDefaultTrackSettings(0, 0);
        this.tracks = [{
          channel: 0,
          name: 'Acoustic Grand Piano',
          instrumentName: GM_INSTRUMENTS[0],
          instrumentNumber: 0,
          volume: 80,
          isMuted: false,
          isSoloed: false,
          noteCount: 0,
          pan: defaults.pan,
          reverbSend: defaults.reverbSend,
          chorusSend: defaults.chorusSend
        }];
      }

      await this.loadSongSoundbanks();
      this.resetMixerSettings();
      this.triggerStateChange();
      return;
    }

    const wasPlaying = this.isPlaying;
    const savedTime = this.currentTime;

    if (mode === 'default') {
      await this.loadMidiBytesForPlayback(this.originalMidiBytes, this.originalSongName);
    }
    else if (mode === 'symphony') {
      try {
        console.log('[AudioEngine] Đang chuyển đổi sang chế độ Giao Hưởng qua Web Worker...');
        const symMidiBytes = await this.postToWorker<Uint8Array>('generateSymphony', this.originalMidiBytes);
        await this.loadMidiBytesForPlayback(symMidiBytes, `${this.originalSongName} (Giao Hưởng)`);
      } catch (err) {
        console.error('Lỗi khi chuyển chế độ Giao Hưởng qua worker, dùng fallback:', err);
        const symMidiBytes = generateSymphonyMidi(this.originalMidiBytes);
        await this.loadMidiBytesForPlayback(symMidiBytes, `${this.originalSongName} (Giao Hưởng)`);
      }
    }
    else if (mode === 'concerto') {
      try {
        console.log('[AudioEngine] Đang chuyển đổi sang chế độ Concerto qua Web Worker...');
        const concertoMidiBytes = await this.postToWorker<Uint8Array>('generateConcerto', this.originalMidiBytes);
        await this.loadMidiBytesForPlayback(concertoMidiBytes, `${this.originalSongName} (Concerto)`);
      } catch (err) {
        console.error('Lỗi khi chuyển chế độ Concerto qua worker, dùng fallback:', err);
        const concertoMidiBytes = generateConcertoMidi(this.originalMidiBytes);
        await this.loadMidiBytesForPlayback(concertoMidiBytes, `${this.originalSongName} (Concerto)`);
      }
    }

    this.seek(savedTime);
    if (wasPlaying) {
      this.play();
    }
    this.triggerStateChange();
  }

  // Thêm một nhạc cụ mới vào danh sách
  public async addTrack(): Promise<void> {
    const newChan = await this.trackMgr.addTrack(this.synth);
    if (newChan !== null) {
      this.triggerStateChange();
      const isDrum = newChan === 9;
      await this.loadInstrumentSoundbank(0, isDrum);
      if (this.synth) {
        this.synth.programChange(newChan, 0);
      }
    }
  }

  // Xóa một nhạc cụ khỏi danh sách
  public deleteTrack(channelIndex: number): void {
    this.trackMgr.deleteTrack(this.synth, channelIndex);
    this.triggerStateChange();
  }

  // Phát một nốt nhạc thử âm cho một kênh cụ thể
  public playTestNote(channelIndex: number): void {
    if (!this.synth) return;
    this.ctxManager.resumeContext();

    const note = channelIndex === 9 ? 36 : 60; // Nốt Bass drum (36) cho Drum, C4 (60) cho các nhạc cụ khác
    const velocity = 100;

    // Trigger noteOn
    this.synth.noteOn(channelIndex, note, velocity);

    // Kích hoạt noteOff sau 800ms
    setTimeout(() => {
      if (this.synth) {
        this.synth.noteOff(channelIndex, note);
      }
    }, 800);
  }

  // Thực hiện xuất bản nhạc (WAV, MP3, FLAC, ALAC, DSD) offline
  public async exportAudio(
    format: 'wav' | 'mp3' | 'flac' | 'alac' | 'dsd',
    options?: ExportOptions,
    onStepChange?: (step: 'preparing' | 'rendering' | 'encoding' | 'done') => void
  ): Promise<{ blob: Blob; fileName: string }> {
    // Đảm bảo tất cả bộ âm thanh Soundfont của bài hát hiện tại đã nạp đủ vào cache RAM
    if (this.synth) {
      await this.loadSongSoundbanks();
    }

    // Tự động hợp nhất các cài đặt không gian Reverb & Master Volume từ Engine nếu chưa truyền
    const mergedOptions: ExportOptions = {
      applyMixer: true,
      enableReverb: true,
      masterReverbGain: this.masterReverbGain,
      reverbCharacter: this.reverbCharacter,
      reverbTime: this.reverbTime,
      reverbPreDelay: this.reverbPreDelay,
      masterVolume: this.masterVolume,
      includeTail: true,
      tailSeconds: 3.5,
      normalizePeak: true,
      targetPeakDb: -0.5,
      wavBitDepth: 24,
      ...options
    };

    return this.exporter.exportAudio(
      this.activeMidiBytes,
      this.currentSongName,
      this.duration,
      this.soundfontCache,
      this.synth,
      format,
      mergedOptions,
      onStepChange
    );
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

  public onPreviousTrack(cb: () => void): void {
    this.onPreviousTrackCallback = cb;
  }

  public onNextTrack(cb: () => void): void {
    this.onNextTrackCallback = cb;
  }

  public setRepeatMode(mode: 'off' | 'all' | 'one'): void {
    this.repeatMode = mode;
    this.triggerStateChange();
    saveUserSettings({ repeatMode: mode });
  }

  public toggleRepeatMode(): 'off' | 'all' | 'one' {
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else {
      this.repeatMode = 'off';
    }
    this.triggerStateChange();
    saveUserSettings({ repeatMode: this.repeatMode });
    return this.repeatMode;
  }

  private triggerStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback();
    }
  }

  private updateMediaSession(): void {
    this.mediaSession.updateMediaSession(this.currentSongName, this.currentComposer);
  }

  private updateMediaSessionPositionState(): void {
    this.mediaSession.updateMediaSessionPositionState(this.duration, this.playbackRate, this.currentTime);
  }
}

// Export một Singleton của AudioEngine
export const AudioEngine = new AudioEngineService();
