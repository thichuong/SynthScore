import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { GM_INSTRUMENTS } from '../data/instruments';
import { getCachedSoundfont, cacheSoundfont } from './appCache';
import {
  type TrackInfo,
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi
} from './midiGenerator';

export type { TrackInfo };

/**
 * WARNING / CHÚ Ý QUAN TRỌNG:
 * Tuyệt đối KHÔNG đưa instance của AudioEngineService hoặc export AudioEngine của nó
 * vào ref() hoặc reactive() trong Vue component. Việc bọc reactive/ref sẽ tạo ra proxy
 * cho các đối tượng gốc của Web Audio API (như AudioContext, AudioNode, AnalyserNode)
 * và WebAssembly, làm suy giảm hiệu năng nghiêm trọng hoặc gây crash ứng dụng.
 * Thay vào đó, hãy sử dụng các callback onStateChange/onTimeUpdate để cập nhật các ref
 * dạng nguyên bản (primitives) trong component Vue.
 */
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
  private loadedSoundfonts: Set<string> = new Set();

  // Ánh xạ nhạc cụ sang file Soundfont gốc tương ứng
  private getSoundfontFileName(programNumber: number, isDrum: boolean = false): string {
    if (isDrum || programNumber >= 112) {
      return 'Roland_SC-88.sf3';
    } else if (programNumber >= 80) {
      return 'FluidR3Mono_GM.sf3';
    } else if (programNumber >= 40) {
      return 'Sonatina_Symphonic_Orchestra.sf3';
    } else {
      return 'MuseScore_General.sf3';
    }
  }

  private timeUpdateInterval: any = null;
  private worker: Worker | null = null;
  private workerCallbacks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

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

      // 7. Tải nhạc cụ mặc định (Acoustic Grand Piano - 0)
      await this.loadInstrumentSoundbank(0);

      // Thiết lập âm lượng tổng ban đầu cho bộ tổng hợp âm
      this.synth.setSystemParameter('gain', this.masterVolume / 100);

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

  // Nạp bộ âm thanh nhạc cụ (.sf3) động theo programNumber thông qua ánh xạ Soundfont
  public async loadInstrumentSoundbank(programNumber: number, isDrum: boolean = false): Promise<void> {
    if (!this.synth) {
      await this.init();
    }
    if (!this.synth) return;

    const sf3Name = this.getSoundfontFileName(programNumber, isDrum);

    if (this.loadedSoundfonts.has(sf3Name)) {
      return; // Đã nạp rồi, không cần nạp lại
    }

    this.isLoadingSoundfont = true;
    this.triggerStateChange();

    try {
      const url = `/presets/instruments/${sf3Name}`;
      let buffer!: ArrayBuffer;

      if (this.soundfontCache.has(url)) {
        buffer = this.soundfontCache.get(url)!;
      } else {
        const cachedDbBuffer = await getCachedSoundfont(url);
        if (cachedDbBuffer) {
          buffer = cachedDbBuffer;
          this.soundfontCache.set(url, buffer);
        } else {
          const baseUrl = import.meta.env.BASE_URL || '/';
          const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          // Vì url đã bắt đầu bằng '/', bỏ dấu '/' ở đầu để ghép
          const relativeUrl = url.startsWith('/') ? url.substring(1) : url;
          const localUrl = `${normalizedBaseUrl}${relativeUrl}`;

          console.log(`Đang tải bộ âm thanh nhạc cụ từ local URL: ${localUrl}`);
          const res = await fetch(localUrl);
          if (!res.ok) throw new Error(`Không thể fetch Soundbank từ URL: ${localUrl} (status: ${res.status})`);
          buffer = await res.arrayBuffer();

          // Lưu cache
          this.soundfontCache.set(url, buffer);
          await cacheSoundfont(url, buffer);
        }
      }

      // Nạp soundbank vào manager của SpessaSynth
      await this.synth.soundBankManager.addSoundBank(buffer.slice(0), sf3Name);
      await this.synth.isReady;

      this.loadedSoundfonts.add(sf3Name);
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
      console.log(`Đã nạp thành công bộ âm thanh Soundfont: ${sf3Name} cho nhạc cụ #${programNumber} (isDrum: ${isDrum})`);
    } catch (err) {
      this.isLoadingSoundfont = false;
      this.triggerStateChange();
      console.error(`Không thể nạp bộ âm thanh Soundfont ${sf3Name} cho nhạc cụ #${programNumber}:`, err);
    }
  }

  // Tự động tải tất cả các bộ âm thanh cho các nhạc cụ có trong bài hát hiện tại
  private async loadSongSoundbanks(): Promise<void> {
    const loadPromises: Promise<void>[] = [];
    
    // Duyệt qua tất cả các track được tìm thấy trong bài
    this.tracks.forEach(track => {
      const isDrum = track.channel === 9; // Kênh 10 (index 9) là bộ gõ
      loadPromises.push(this.loadInstrumentSoundbank(track.instrumentNumber, isDrum));
    });

    if (loadPromises.length > 0) {
      this.isLoadingSoundfont = true;
      this.triggerStateChange();
      try {
        await Promise.all(loadPromises);
      } catch (err) {
        console.error('Lỗi khi nạp song song các bộ âm thanh nhạc cụ:', err);
      } finally {
        this.isLoadingSoundfont = false;
        this.triggerStateChange();
      }
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
        const symMidiBytes = this.generateSymphonyMidi(midiBytes);
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
        const concertoMidiBytes = this.generateConcertoMidi(midiBytes);
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
    this.bpm = this.sequencer.currentTempo || 120;

    // Phân tích các bè nhạc cụ từ tệp MIDI mới nạp qua Web Worker
    try {
      // Sao chép buffer để gửi qua worker (transferable) tránh nghẽn
      const parseBuffer = arrayBuffer.slice(0);
      this.tracks = await this.postToWorker<TrackInfo[]>('parseTracks', parseBuffer, [parseBuffer]);
    } catch (err) {
      console.error('Lỗi khi phân tích tracks qua worker, dùng fallback:', err);
      this.parseTracks(arrayBuffer);
    }

    await this.loadSongSoundbanks();
    this.resetMixerSettings();
    this.triggerStateChange();
  }

  // Phân tích danh sách bè của bài nhạc (dùng làm fallback)
  private parseTracks(arrayBuffer: ArrayBuffer): void {
    this.tracks = parseMidiTracks(arrayBuffer);
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
  public async setTrackInstrument(channelIndex: number, programNumber: number): Promise<void> {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.instrumentNumber = programNumber;
      track.instrumentName = GM_INSTRUMENTS[programNumber] || 'Unknown';
      const isDrum = channelIndex === 9;
      await this.loadInstrumentSoundbank(programNumber, isDrum);
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
      try {
        console.log('[AudioEngine] Đang chuyển đổi sang chế độ Giao Hưởng qua Web Worker...');
        const symMidiBytes = await this.postToWorker<Uint8Array>('generateSymphony', this.originalMidiBytes);
        await this.loadMidiBytesForPlayback(symMidiBytes, `${this.originalSongName} (Giao Hưởng)`);
      } catch (err) {
        console.error('Lỗi khi chuyển chế độ Giao Hưởng qua worker, dùng fallback:', err);
        const symMidiBytes = this.generateSymphonyMidi(this.originalMidiBytes);
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
        const concertoMidiBytes = this.generateConcertoMidi(this.originalMidiBytes);
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
    
    const isDrum = newChan === 9;
    await this.loadInstrumentSoundbank(0, isDrum);
    
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

  // Phát một nốt nhạc thử âm cho một kênh cụ thể
  public playTestNote(channelIndex: number): void {
    if (!this.synth) return;
    
    // Kích hoạt AudioContext nếu ở trạng thái suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

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

  // Tự động phân tách và chuyển bài nhạc thành phối khí dàn nhạc giao hưởng 11 bè (dùng làm fallback)
  private generateSymphonyMidi(originalMidiBytes: Uint8Array): Uint8Array {
    return generateSymphonyMidi(originalMidiBytes);
  }

  // Tự động phân tách và chuyển bài nhạc thành cấu hình Piano Concerto (Solo Piano + Dàn nhạc đệm) (dùng làm fallback)
  private generateConcertoMidi(originalMidiBytes: Uint8Array): Uint8Array {
    return generateConcertoMidi(originalMidiBytes);
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
