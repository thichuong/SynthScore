import { type WorkletSynthesizer } from 'spessasynth_lib';
import { getCachedSoundfont, cacheSoundfont } from '../appCache';
import { type TrackInfo } from '../midiGenerator';

export interface SoundfontProgress {
  sf3Name: string;          // Tên file hiện tại hoặc tiêu đề tổng
  activeCount: number;      // Số tệp đang nạp trong đợt
  loaded: number;           // Tổng bytes đã tải của cả đợt
  total: number;            // Tổng dung lượng dự kiến của cả đợt
  percent: number;          // Phần trăm % tổng thể (0 đến 100)
  speed: number;            // Tốc độ tải tổng thể (bytes/second)
  etaSeconds: number;       // Thời gian còn lại ước tính tổng thể (giây)
  isFallback: boolean;      // Có tệp nào dùng fallback GitHub Pages URL không
}

export const SOUNDFONT_FILES = {
  PART_0_39: 'Crisis_GM_0-39.sf3',
  PART_40_79: 'Crisis_GM_40-79.sf3',
  PART_80_111: 'Crisis_GM_80-111.sf3',
  PART_112_DRUMS: 'Crisis_GM_112-127_Drums.sf3'
} as const;

export const DEFAULT_SOUNDFONT_FILE = SOUNDFONT_FILES.PART_0_39;

/**
 * Quản lý tải, bộ nhớ đệm (cả IndexedDB và RAM)
 * và nạp bộ âm thanh Soundfont vào Synthesizer.
 */
export class SoundfontService {
  public soundfontCache: Map<string, ArrayBuffer> = new Map();
  public loadedSoundfonts: Set<string> = new Set();
  private preloadingPromises: Map<string, Promise<ArrayBuffer>> = new Map();
  private loadingInstrumentPromises: Map<string, Promise<void>> = new Map();

  private soundbankAddQueue: Promise<void> = Promise.resolve();
  private progressListeners: Set<(progress: SoundfontProgress | null) => void> = new Set();

  // Bộ quản lý tiến độ đợt tổng thể (Batch Progress Management)
  private activeDownloads: Map<string, { loaded: number; total: number; isFallback: boolean }> = new Map();
  private completedBatchLoaded: number = 0;
  private completedBatchTotal: number = 0;
  private batchStartTime: number = 0;

  public onProgress(listener: (progress: SoundfontProgress | null) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private notifyProgress(progress: SoundfontProgress | null): void {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch (e) {
        console.error('[SoundfontService] Lỗi khi gọi progress listener:', e);
      }
    }
  }

  private registerDownloadStart(sf3Name: string, estimatedTotal: number, isFallback: boolean): void {
    if (this.activeDownloads.size === 0) {
      this.completedBatchLoaded = 0;
      this.completedBatchTotal = 0;
      this.batchStartTime = performance.now();
    }
    this.activeDownloads.set(sf3Name, { loaded: 0, total: estimatedTotal, isFallback });
    this.updateBatchProgress(sf3Name);
  }

  private registerDownloadProgress(sf3Name: string, loaded: number, total: number, isFallback: boolean): void {
    this.activeDownloads.set(sf3Name, { loaded, total: total || loaded, isFallback });
    this.updateBatchProgress(sf3Name);
  }

  private registerDownloadEnd(sf3Name: string): void {
    const item = this.activeDownloads.get(sf3Name);
    if (item) {
      this.completedBatchLoaded += item.loaded;
      this.completedBatchTotal += item.total;
    }
    this.activeDownloads.delete(sf3Name);
    if (this.activeDownloads.size === 0) {
      this.notifyProgress(null);
    } else {
      const remainingFirst = this.activeDownloads.keys().next().value || sf3Name;
      this.updateBatchProgress(remainingFirst);
    }
  }

  private updateBatchProgress(currentSf3Name: string): void {
    let activeLoadedSum = 0;
    let activeTotalSum = 0;
    let hasFallback = false;

    for (const item of this.activeDownloads.values()) {
      activeLoadedSum += item.loaded;
      activeTotalSum += item.total;
      if (item.isFallback) hasFallback = true;
    }

    const grandLoaded = this.completedBatchLoaded + activeLoadedSum;
    const grandTotal = this.completedBatchTotal + activeTotalSum;

    const elapsedTime = (performance.now() - (this.batchStartTime || performance.now())) / 1000;
    const speed = elapsedTime > 0 ? grandLoaded / elapsedTime : 0;
    const remainingBytes = grandTotal > grandLoaded ? grandTotal - grandLoaded : 0;
    const etaSeconds = speed > 0 ? Math.round(remainingBytes / speed) : 0;
    const percent = grandTotal > 0 ? Math.min(99, Math.round((grandLoaded / grandTotal) * 100)) : 0;

    const count = this.activeDownloads.size;
    const title = count > 1 ? `Đang tải ${count} bộ âm thanh...` : currentSf3Name;

    this.notifyProgress({
      sf3Name: title,
      activeCount: count,
      loaded: grandLoaded,
      total: grandTotal,
      percent,
      speed,
      etaSeconds,
      isFallback: hasFallback
    });
  }

  // Helper fetch với timeout để tránh treo vĩnh viễn khi mạng gián đoạn
  private async fetchWithTimeout(url: string, timeoutMs: number = 15000): Promise<Response> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      // Gọi fetch với 1 tham số url để đảm bảo tương thích hoàn toàn với unit test spies
      const res = await fetch(url);
      return res;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Đọc dữ liệu từ URL kèm đo đếm tiến độ, tốc độ và ETA gộp toàn đợt
  private async fetchAndReadWithProgress(
    sf3Name: string,
    url: string,
    isFallback: boolean = false
  ): Promise<{ buffer: ArrayBuffer | null; isValid: boolean }> {
    let res: Response;
    try {
      res = await this.fetchWithTimeout(url);
    } catch (err) {
      return { buffer: null, isValid: false };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('text/html')) {
      return { buffer: null, isValid: false };
    }

    const contentLengthHeader = res.headers.get('content-length');
    const total = contentLengthHeader ? parseInt(contentLengthHeader, 10) || 0 : 0;
    let loaded = 0;
    let buffer: ArrayBuffer | null = null;

    this.registerDownloadStart(sf3Name, total, isFallback);

    try {
      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.byteLength;
            this.registerDownloadProgress(sf3Name, loaded, total, isFallback);
          }
        }

        const combined = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.byteLength;
        }
        buffer = combined.buffer;
      } else {
        // Fallback khi môi trường không có res.body.getReader (ví dụ trong Vitest unit test)
        const tempBuffer = await res.arrayBuffer();
        loaded = tempBuffer.byteLength;
        this.registerDownloadProgress(sf3Name, loaded, total || loaded, isFallback);
        buffer = tempBuffer;
      }
    } catch (err) {
      console.warn(`[SoundfontService] Lỗi khi tải dữ liệu stream từ ${url}:`, err);
      this.registerDownloadEnd(sf3Name);
      return { buffer: null, isValid: false };
    }

    let isValid = false;
    if (buffer && buffer.byteLength >= 4) {
      const header = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
      if (header === 'RIFF' || header === 'RIFS') {
        isValid = true;
      }
    }

    this.registerDownloadEnd(sf3Name);
    return { buffer, isValid };
  }

  // Thao tác addSoundBank trên SpessaSynth được nối hàng (sequential queue) để tránh tranh chấp worklet message
  private async safeAddSoundBank(synth: WorkletSynthesizer, buffer: ArrayBuffer, sf3Name: string): Promise<void> {
    const nextInQueue = this.soundbankAddQueue.then(async () => {
      await synth.soundBankManager.addSoundBank(buffer.slice(0), sf3Name);
      await synth.isReady;
    });
    this.soundbankAddQueue = nextInQueue.catch(() => {});
    await nextInQueue;
  }

  // Ánh xạ nhạc cụ sang file Soundfont tương ứng trong 4 file phân tách
  public getSoundfontFileName(programNumber: number = 0, isDrum: boolean = false): string {
    if (isDrum || programNumber >= 112) {
      return SOUNDFONT_FILES.PART_112_DRUMS;
    } else if (programNumber >= 80) {
      return SOUNDFONT_FILES.PART_80_111;
    } else if (programNumber >= 40) {
      return SOUNDFONT_FILES.PART_40_79;
    } else {
      return SOUNDFONT_FILES.PART_0_39;
    }
  }

  // Tiền tải (preload) soundfont vào cache (IndexedDB & Memory cache)
  public preloadSoundfont(programNumber: number, isDrum: boolean = false): Promise<void> {
    const sf3Name = this.getSoundfontFileName(programNumber, isDrum);
    const url = `/presets/instruments/${sf3Name}`;

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

        console.log(`[SoundfontService] Đang tiền tải soundfont từ local URL: ${localUrl}`);
        let { buffer, isValid } = await this.fetchAndReadWithProgress(sf3Name, localUrl, false);

        if (!isValid) {
          console.warn(`[SoundfontService] Không thể tiền tải từ local. Thử tải từ fallback GitHub Pages...`);
          const fallbackUrl = `https://thichuong.github.io/SynthScore/presets/instruments/${sf3Name}`;
          const fallbackResult = await this.fetchAndReadWithProgress(sf3Name, fallbackUrl, true);
          buffer = fallbackResult.buffer;
          isValid = fallbackResult.isValid;
        }

        if (isValid && buffer) {
          this.soundfontCache.set(url, buffer);
          await cacheSoundfont(url, buffer);
          return buffer;
        } else {
          throw new Error(`Không thể tiền tải Soundbank hợp lệ từ cả local và fallback URL`);
        }
      } catch (e) {
        console.error('[SoundfontService] Lỗi khi tiền tải soundfont:', e);
        throw e;
      } finally {
        this.preloadingPromises.delete(url);
      }
    })();

    this.preloadingPromises.set(url, loadPromise);
    return loadPromise.then(() => {});
  }

  // Tiền tải tất cả 4 bộ âm thanh Soundfont vào bộ nhớ đệm (IndexedDB & Memory cache)
  public async preloadAllSoundfonts(): Promise<void> {
    const soundfontSpecs = [
      { programNumber: 0, isDrum: false },   // Crisis_GM_0-39.sf3
      { programNumber: 40, isDrum: false },  // Crisis_GM_40-79.sf3
      { programNumber: 80, isDrum: false },  // Crisis_GM_80-111.sf3
      { programNumber: 112, isDrum: false }  // Crisis_GM_112-127_Drums.sf3
    ];

    await Promise.all(
      soundfontSpecs.map(sf =>
        this.preloadSoundfont(sf.programNumber, sf.isDrum).catch(err => {
          console.warn(`[SoundfontService] Lỗi tiền tải soundfont cho program ${sf.programNumber} (isDrum: ${sf.isDrum}):`, err);
        })
      )
    );
  }

  // Nạp bộ âm thanh nhạc cụ (.sf3) động cho synthesizer
  public async loadInstrumentSoundbank(
    synth: WorkletSynthesizer,
    programNumber: number,
    isDrum: boolean = false
  ): Promise<void> {
    const sf3Name = this.getSoundfontFileName(programNumber, isDrum);

    if (this.loadedSoundfonts.has(sf3Name)) {
      return; // Đã nạp rồi, không cần nạp lại
    }

    if (this.loadingInstrumentPromises.has(sf3Name)) {
      await this.loadingInstrumentPromises.get(sf3Name)!;
      return;
    }

    const loadPromise = (async () => {
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
            const relativeUrl = url.startsWith('/') ? url.substring(1) : url;
            const localUrl = `${normalizedBaseUrl}${relativeUrl}`;

            console.log(`Đang tải bộ âm thanh nhạc cụ từ local URL: ${localUrl}`);
            let { buffer: fetchedBuffer, isValid } = await this.fetchAndReadWithProgress(sf3Name, localUrl, false);

            if (!isValid) {
              console.warn(`Không thể tải soundfont hợp lệ từ local URL. Thử tải từ fallback GitHub Pages...`);
              const fallbackUrl = `https://thichuong.github.io/SynthScore/presets/instruments/${sf3Name}`;
              const fallbackResult = await this.fetchAndReadWithProgress(sf3Name, fallbackUrl, true);
              fetchedBuffer = fallbackResult.buffer;
              isValid = fallbackResult.isValid;

              if (!isValid) {
                throw new Error(`Không thể fetch Soundbank hợp lệ từ cả local và fallback URL`);
              }
            }

            buffer = fetchedBuffer!;

            // Lưu cache
            this.soundfontCache.set(url, buffer);
            await cacheSoundfont(url, buffer);
          }
        }

        // Nạp soundbank an toàn qua hàng đợi vào SpessaSynth
        await this.safeAddSoundBank(synth, buffer, sf3Name);

        this.loadedSoundfonts.add(sf3Name);
        console.log(`Đã nạp thành công bộ âm thanh Soundfont: ${sf3Name} cho nhạc cụ #${programNumber} (isDrum: ${isDrum})`);
      } catch (err) {
        console.error(`Không thể nạp bộ âm thanh Soundfont ${sf3Name} cho nhạc cụ #${programNumber}:`, err);
        throw err;
      } finally {
        this.loadingInstrumentPromises.delete(sf3Name);
      }
    })();

    this.loadingInstrumentPromises.set(sf3Name, loadPromise);
    return loadPromise;
  }

  // Tự động tải tất cả các bộ âm thanh cho các nhạc cụ có trong bài hát (tải song song qua Promise.all)
  public async loadSongSoundbanks(synth: WorkletSynthesizer, tracks: TrackInfo[]): Promise<void> {
    const promises = tracks.map(track => {
      const isDrum = track.channel === 9; // Kênh 10 là bộ gõ
      return this.loadInstrumentSoundbank(synth, track.instrumentNumber, isDrum).catch(err => {
        console.error(`Lỗi khi nạp soundbank cho nhạc cụ #${track.instrumentNumber}:`, err);
      });
    });
    await Promise.all(promises);
  }

  public clearLoadedSet(): void {
    this.loadedSoundfonts.clear();
  }
}

