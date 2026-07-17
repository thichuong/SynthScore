import { WorkletSynthesizer, Sequencer } from 'spessasynth_lib';
import { GM_INSTRUMENTS } from '../data/instruments';
import { getCachedSoundfont, cacheSoundfont } from './appCache';
import {
  type TrackInfo,
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi,
  symphonicTracksInfo,
  concertoTracksInfo,
  getDefaultTrackSettings
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
  public masterVolume = 100; // 0 to 100

  // Hiệu ứng không gian Master Reverb
  public masterReverbGain = 50; // 0 to 100 (50% mặc định)
  public reverbCharacter = 3;   // 0 to 7 (3 = Concert Hall)
  public reverbTime = 90;       // 0 to 127
  public reverbPreDelay = 40;   // 0 to 127

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
  private preloadingPromises: Map<string, Promise<ArrayBuffer>> = new Map();

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
  private silentAudio: HTMLAudioElement | null = null;

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
    this.setupGestureListeners();
  }

  // Tự động lắng nghe tương tác đầu tiên của người dùng để khởi tạo Audio Engine
  private setupGestureListeners(): void {
    if (typeof window === 'undefined') return;

    const autoInitOnGesture = async () => {
      if (!this.isInitialized) {
        console.log('[AudioEngine] Phát hiện tương tác người dùng, tự động khởi tạo Audio Engine...');
        try {
          await this.init();
        } catch (e) {
          console.error('[AudioEngine] Lỗi khi tự động khởi tạo Audio Engine trên tương tác:', e);
        }
      }
      removeListeners();
    };

    const removeListeners = () => {
      window.removeEventListener('click', autoInitOnGesture, true);
      window.removeEventListener('touchstart', autoInitOnGesture, true);
      window.removeEventListener('keydown', autoInitOnGesture, true);
    };

    window.addEventListener('click', autoInitOnGesture, true);
    window.addEventListener('touchstart', autoInitOnGesture, true);
    window.addEventListener('keydown', autoInitOnGesture, true);
  }

  // Tiền tải (preload) soundfont vào cache (IndexedDB & Memory cache) mà không khởi tạo AudioContext
  public preloadSoundfont(programNumber: number, isDrum: boolean = false): Promise<void> {
    const sf3Name = this.getSoundfontFileName(programNumber, isDrum);
    const url = `/presets/instruments/${sf3Name}`;

    // Nếu đã nạp trong cache bộ nhớ hoặc đang được tải, không cần chạy lại
    if (this.soundfontCache.has(url)) {
      return Promise.resolve();
    }
    if (this.preloadingPromises.has(url)) {
      return this.preloadingPromises.get(url)!.then(() => {});
    }

    const loadPromise = (async () => {
      try {
        // Kiểm tra trong IndexedDB trước
        const cachedDbBuffer = await getCachedSoundfont(url);
        let isDbBufferValid = false;
        if (cachedDbBuffer && cachedDbBuffer.byteLength >= 4) {
          const header = String.fromCharCode(...new Uint8Array(cachedDbBuffer, 0, 4));
          if (header === 'RIFF' || header === 'RIFS') {
            isDbBufferValid = true;
          }
        }

        if (isDbBufferValid) {
          this.soundfontCache.set(url, cachedDbBuffer!);
          return cachedDbBuffer!;
        }

        // Tải từ mạng
        const baseUrl = import.meta.env.BASE_URL || '/';
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        const relativeUrl = url.startsWith('/') ? url.substring(1) : url;
        const localUrl = `${normalizedBaseUrl}${relativeUrl}`;

        console.log(`[AudioEngine] Đang tiền tải soundfont từ local URL: ${localUrl}`);
        let res = await fetch(localUrl);
        let contentType = res.headers.get('content-type') || '';
        let buffer: ArrayBuffer | null = null;
        let isValid = false;

        if (res.ok && !contentType.includes('text/html')) {
          const tempBuffer = await res.arrayBuffer();
          if (tempBuffer.byteLength >= 4) {
            const header = String.fromCharCode(...new Uint8Array(tempBuffer, 0, 4));
            if (header === 'RIFF' || header === 'RIFS') {
              buffer = tempBuffer;
              isValid = true;
            } else {
              console.warn(`[AudioEngine] Local URL tiền tải trả về file không hợp lệ (header: ${header})`);
            }
          }
        }

        if (!isValid) {
          console.warn(`[AudioEngine] Không thể tiền tải soundfont từ local URL. Thử tải từ fallback GitHub Pages...`);
          const fallbackUrl = `https://thichuong.github.io/SynthScore/presets/instruments/${sf3Name}`;
          res = await fetch(fallbackUrl);
          contentType = res.headers.get('content-type') || '';
          if (res.ok && !contentType.includes('text/html')) {
            const tempBuffer = await res.arrayBuffer();
            if (tempBuffer.byteLength >= 4) {
              const header = String.fromCharCode(...new Uint8Array(tempBuffer, 0, 4));
              if (header === 'RIFF' || header === 'RIFS') {
                buffer = tempBuffer;
                isValid = true;
              } else {
                console.warn(`[AudioEngine] Fallback URL tiền tải trả về file không hợp lệ (header: ${header})`);
              }
            }
          }
        }

        if (isValid && buffer) {
          this.soundfontCache.set(url, buffer);
          await cacheSoundfont(url, buffer);
          return buffer;
        } else {
          throw new Error(`Không thể tiền tải Soundbank hợp lệ từ cả local và fallback URL`);
        }
      } catch (e) {
        console.error('[AudioEngine] Lỗi khi tiền tải soundfont:', e);
        throw e;
      } finally {
        this.preloadingPromises.delete(url);
      }
    })();

    this.preloadingPromises.set(url, loadPromise);
    return loadPromise.then(() => {});
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

      // Khởi tạo phần tử âm thanh im lặng để mở khóa sớm trên user gesture
      if (!this.silentAudio && typeof Audio !== 'undefined') {
        try {
          this.silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV');
          this.silentAudio.loop = true;
          
          if (typeof window !== 'undefined') {
            const unlockAudio = () => {
              if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(e => console.warn('Lỗi khi resume AudioContext:', e));
              }
              if (this.silentAudio) {
                this.silentAudio.play()
                  .then(() => {
                    this.silentAudio!.pause();
                  })
                  .catch(e => {
                    console.warn('Không thể pre-unlock audio:', e);
                  });
              }
              window.removeEventListener('click', unlockAudio, true);
              window.removeEventListener('touchstart', unlockAudio, true);
            };
            window.addEventListener('click', unlockAudio, true);
            window.addEventListener('touchstart', unlockAudio, true);
          }
        } catch (e) {
          console.error('Không thể tạo đối tượng Audio im lặng trong init:', e);
        }
      }

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

        // Tạm dừng âm thanh im lặng
        if (this.silentAudio) {
          try {
            this.silentAudio.pause();
            this.silentAudio.currentTime = 0;
          } catch (e) {}
        }

        // Cập nhật trạng thái Media Session
        if (typeof window !== 'undefined' && 'mediaSession' in window.navigator) {
          const nav = window.navigator as any;
          nav.mediaSession.playbackState = 'none';
          this.updateMediaSessionPositionState();
        }

        if (this.onSongEndedCallback) {
          this.onSongEndedCallback();
        }
      });

      // 7. Tải nhạc cụ mặc định (Acoustic Grand Piano - 0)
      await this.loadInstrumentSoundbank(0);

      const defaults = getDefaultTrackSettings(0, 0);
      this.tracks = [{
        channel: 0,
        name: 'Acoustic Grand Piano',
        instrumentName: GM_INSTRUMENTS[0],
        instrumentNumber: 0,
        volume: 100,
        isMuted: false,
        isSoloed: false,
        noteCount: 0,
        pan: defaults.pan,
        reverbSend: defaults.reverbSend,
        chorusSend: defaults.chorusSend
      }];

      // Thiết lập âm lượng tổng ban đầu cho bộ tổng hợp âm
      this.synth.setSystemParameter('gain', this.masterVolume / 100);

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
      } else if (this.preloadingPromises.has(url)) {
        buffer = await this.preloadingPromises.get(url)!;
      } else {
        const cachedDbBuffer = await getCachedSoundfont(url);
        let isDbBufferValid = false;
        if (cachedDbBuffer && cachedDbBuffer.byteLength >= 4) {
          const header = String.fromCharCode(...new Uint8Array(cachedDbBuffer, 0, 4));
          if (header === 'RIFF' || header === 'RIFS') {
            isDbBufferValid = true;
          }
        }

        if (isDbBufferValid) {
          buffer = cachedDbBuffer!;
          this.soundfontCache.set(url, buffer);
        } else {
          const baseUrl = import.meta.env.BASE_URL || '/';
          const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          // Vì url đã bắt đầu bằng '/', bỏ dấu '/' ở đầu để ghép
          const relativeUrl = url.startsWith('/') ? url.substring(1) : url;
          const localUrl = `${normalizedBaseUrl}${relativeUrl}`;

          console.log(`Đang tải bộ âm thanh nhạc cụ từ local URL: ${localUrl}`);
          let res = await fetch(localUrl);
          let contentType = res.headers.get('content-type') || '';
          let isValid = false;

          if (res.ok && !contentType.includes('text/html')) {
            const tempBuffer = await res.arrayBuffer();
            if (tempBuffer.byteLength >= 4) {
              const header = String.fromCharCode(...new Uint8Array(tempBuffer, 0, 4));
              if (header === 'RIFF' || header === 'RIFS') {
                buffer = tempBuffer;
                isValid = true;
              } else {
                console.warn(`Local URL trả về file không hợp lệ (header: ${header})`);
              }
            }
          }

          if (!isValid) {
            console.warn(`Không thể tải soundfont hợp lệ từ local URL. Thử tải từ fallback GitHub Pages...`);
            const fallbackUrl = `https://thichuong.github.io/SynthScore/presets/instruments/${sf3Name}`;
            res = await fetch(fallbackUrl);
            contentType = res.headers.get('content-type') || '';
            if (res.ok && !contentType.includes('text/html')) {
              const tempBuffer = await res.arrayBuffer();
              if (tempBuffer.byteLength >= 4) {
                const header = String.fromCharCode(...new Uint8Array(tempBuffer, 0, 4));
                if (header === 'RIFF' || header === 'RIFS') {
                  buffer = tempBuffer;
                  isValid = true;
                } else {
                  console.warn(`Fallback URL trả về file không hợp lệ (header: ${header})`);
                }
              }
            }
            if (!isValid) {
              throw new Error(`Không thể fetch Soundbank hợp lệ từ cả local và fallback URL`);
            }
          }

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
    let parsedTracks: TrackInfo[] = [];
    try {
      // Sao chép buffer để gửi qua worker (transferable) tránh nghẽn
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
          instrumentNumber: (this.playbackMode === 'symphony' || this.playbackMode === 'concerto')
            ? existing.instrumentNumber
            : pt.instrumentNumber,
          instrumentName: (this.playbackMode === 'symphony' || this.playbackMode === 'concerto')
            ? existing.instrumentName
            : pt.instrumentName,
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
    if (!this.synth) return;
    
    // Áp dụng âm lượng, pan, reverb, chorus cho các track hiện có
    this.tracks.forEach(track => {
      if (this.synth) {
        const channel = this.synth.midiChannels[track.channel];
        if (channel) {
          channel.setSystemParameter('gain', track.volume / 100);
          channel.setSystemParameter('pan', track.pan / 100);
          channel.setSystemParameter('isMuted', track.isMuted);
          this.synth.controllerChange(track.channel, 91, track.reverbSend);
          this.synth.controllerChange(track.channel, 93, track.chorusSend);
          this.synth.programChange(track.channel, track.instrumentNumber);
        }
      }
    });

    // Reset các kênh còn lại về mặc định
    const usedChannels = new Set(this.tracks.map(t => t.channel));
    for (let i = 0; i < 16; i++) {
      if (!usedChannels.has(i)) {
        const channel = this.synth.midiChannels[i];
        if (channel) {
          channel.setSystemParameter('gain', 1.0);
          channel.setSystemParameter('pan', 0);
          channel.setSystemParameter('isMuted', false);
          this.synth.controllerChange(i, 91, 0);
          this.synth.controllerChange(i, 93, 0);
        }
      }
    }
  }

  // Điều chỉnh Panning cho một track
  public setTrackPan(channelIndex: number, pan: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.pan = pan;
      if (this.synth) {
        const chan = this.synth.midiChannels[channelIndex];
        if (chan) {
          chan.setSystemParameter('pan', pan / 100);
        }
      }
      this.triggerStateChange();
    }
  }

  // Điều chỉnh lượng Reverb Send cho một track (CC 91)
  public setTrackReverbSend(channelIndex: number, val: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.reverbSend = val;
      if (this.synth) {
        this.synth.controllerChange(channelIndex, 91, val);
      }
      this.triggerStateChange();
    }
  }

  // Điều chỉnh lượng Chorus Send cho một track (CC 93)
  public setTrackChorusSend(channelIndex: number, val: number): void {
    const track = this.tracks.find(t => t.channel === channelIndex);
    if (track) {
      track.chorusSend = val;
      if (this.synth) {
        this.synth.controllerChange(channelIndex, 93, val);
      }
      this.triggerStateChange();
    }
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
    if (!this.sequencer || !this.audioContext) return;
    
    // Kích hoạt AudioContext nếu đang ở trạng thái ngủ
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Khởi tạo phần tử âm thanh im lặng nếu chưa tồn tại
    if (!this.silentAudio && typeof Audio !== 'undefined') {
      try {
        this.silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjM2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMu//MUZAYAAAGkAAAAAAAAA0gAAAAAOTku//MUZAkAAAGkAAAAAAAAA0gAAAAANVVV');
        this.silentAudio.loop = true;
      } catch (e) {
        console.error('Không thể tạo đối tượng Audio im lặng:', e);
      }
    }

    // Phát âm thanh im lặng để kích hoạt điều khiển trên màn hình khóa
    if (this.silentAudio) {
      this.silentAudio.play().catch(e => {
        console.warn('Không thể phát âm thanh im lặng (có thể do Autoplay Policy):', e);
      });
    }

    this.sequencer.play();
    this.isPlaying = true;
    this.triggerStateChange();
    this.startTimeLoop();

    // Cập nhật trạng thái phát nhạc của Media Session
    if (typeof window !== 'undefined' && 'mediaSession' in window.navigator) {
      const nav = window.navigator as any;
      nav.mediaSession.playbackState = 'playing';
      this.updateMediaSessionPositionState();
    }
  }

  public pause(): void {
    if (!this.sequencer) return;
    this.sequencer.pause();
    this.isPlaying = false;
    this.stopTimeLoop();
    this.triggerStateChange();

    // Dừng âm thanh im lặng
    if (this.silentAudio) {
      try {
        this.silentAudio.pause();
      } catch (e) {
        console.warn('Lỗi khi tạm dừng âm thanh im lặng:', e);
      }
    }

    // Cập nhật trạng thái phát nhạc của Media Session
    if (typeof window !== 'undefined' && 'mediaSession' in window.navigator) {
      const nav = window.navigator as any;
      nav.mediaSession.playbackState = 'paused';
      this.updateMediaSessionPositionState();
    }
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

    // Dừng âm thanh im lặng và đặt lại vị trí
    if (this.silentAudio) {
      try {
        this.silentAudio.pause();
        this.silentAudio.currentTime = 0;
      } catch (e) {
        console.warn('Lỗi khi dừng âm thanh im lặng:', e);
      }
    }

    // Cập nhật trạng thái phát nhạc của Media Session
    if (typeof window !== 'undefined' && 'mediaSession' in window.navigator) {
      const nav = window.navigator as any;
      nav.mediaSession.playbackState = 'none';
      this.updateMediaSessionPositionState();
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

    // Đồng bộ hóa vị trí của âm thanh im lặng nếu có thể
    if (this.silentAudio) {
      try {
        this.silentAudio.currentTime = seconds % (this.silentAudio.duration || 1);
      } catch (e) {
        // Có thể lỗi nếu audio chưa tải hoặc không hỗ trợ
      }
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

    // Đồng bộ hóa tốc độ phát của âm thanh im lặng
    if (this.silentAudio) {
      try {
        this.silentAudio.defaultPlaybackRate = rate;
        this.silentAudio.playbackRate = rate;
      } catch (e) {
        console.warn('Không thể thiết lập tốc độ phát cho âm thanh im lặng:', e);
      }
    }

    // Cập nhật vị trí và tốc độ phát của Media Session
    this.updateMediaSessionPositionState();
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
            volume: 100,
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
            volume: 100,
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
          volume: 100,
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
    
    const isDrum = newChan === 9;
    await this.loadInstrumentSoundbank(0, isDrum);
    
    if (this.synth) {
      this.synth.programChange(newChan, 0);
      const chan = this.synth.midiChannels[newChan];
      if (chan) {
        chan.setSystemParameter('gain', 1.0);
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

  // Cấu hình Media Session Metadata và Action Handlers
  private updateMediaSession(): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }

    const nav = window.navigator as any;
    
    // Thiết lập Metadata bản nhạc
    if (typeof (window as any).MediaMetadata !== 'undefined') {
      try {
        nav.mediaSession.metadata = new (window as any).MediaMetadata({
          title: this.currentSongName || 'Bản nhạc không tên',
          artist: 'SynthScore',
          album: 'SynthScore Web Player',
          artwork: [
            { src: new URL('/favicon.svg', window.location.href).href, sizes: 'any', type: 'image/svg+xml' }
          ]
        });
      } catch (e) {
        console.warn('Lỗi khi thiết lập MediaMetadata:', e);
      }
    }

    // Thiết lập các Action Handlers
    try {
      nav.mediaSession.setActionHandler('play', () => {
        this.play();
      });
      nav.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });
      nav.mediaSession.setActionHandler('stop', () => {
        this.stop();
      });
      nav.mediaSession.setActionHandler('seekbackward', (details: any) => {
        const offset = details.seekOffset || 10;
        this.seek(Math.max(0, this.currentTime - offset));
      });
      nav.mediaSession.setActionHandler('seekforward', (details: any) => {
        const offset = details.seekOffset || 10;
        this.seek(Math.min(this.duration, this.currentTime + offset));
      });
      nav.mediaSession.setActionHandler('seekto', (details: any) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.seek(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('Lỗi khi thiết lập mediaSession action handlers:', e);
    }
  }

  // Cập nhật vị trí phát nhạc của Media Session
  private updateMediaSessionPositionState(): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }

    const nav = window.navigator as any;
    if (typeof nav.mediaSession.setPositionState === 'function') {
      try {
        nav.mediaSession.setPositionState({
          duration: Math.max(0, this.duration || 0),
          playbackRate: Math.max(0.0625, this.playbackRate || 1.0),
          position: Math.max(0, Math.min(this.duration || 0, this.currentTime || 0))
        });
      } catch (e) {
        console.warn('Lỗi khi setPositionState cho mediaSession:', e);
      }
    }
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
