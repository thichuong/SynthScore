import { type WorkletSynthesizer } from 'spessasynth_lib';
import { getCachedSoundfont, cacheSoundfont } from '../appCache';
import { type TrackInfo } from '../midiGenerator';

/**
 * Quản lý tải, bộ nhớ đệm (cả IndexedDB và RAM)
 * và nạp bộ âm thanh Soundfont vào Synthesizer.
 */
export class SoundfontService {
  public soundfontCache: Map<string, ArrayBuffer> = new Map();
  public loadedSoundfonts: Set<string> = new Set();
  private preloadingPromises: Map<string, Promise<ArrayBuffer>> = new Map();
  private loadingInstrumentPromises: Map<string, Promise<void>> = new Map();

  // Ánh xạ nhạc cụ sang file Soundfont gốc tương ứng
  public getSoundfontFileName(programNumber: number, isDrum: boolean = false): string {
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
              console.warn(`[SoundfontService] Local URL tiền tải trả về file không hợp lệ (header: ${header})`);
            }
          }
        }

        if (!isValid) {
          console.warn(`[SoundfontService] Không thể tiền tải từ local. Thử tải từ fallback GitHub Pages...`);
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
                console.warn(`[SoundfontService] Fallback URL tiền tải trả về file không hợp lệ (header: ${header})`);
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
        console.error('[SoundfontService] Lỗi khi tiền tải soundfont:', e);
        throw e;
      } finally {
        this.preloadingPromises.delete(url);
      }
    })();

    this.preloadingPromises.set(url, loadPromise);
    return loadPromise.then(() => {});
  }

  // Nạp bộ âm thanh nhạc cụ (.sf3) động cho synthesizer
  public async loadInstrumentSoundbank(
    synth: WorkletSynthesizer,
    programNumber: number,
    isDrum: boolean = false
  ): Promise<void> {
    const sf3Name = this.getSoundfontFileName(programNumber, isDrum);

    if (this.loadedSoundfonts.has(sf3Name)) {
      console.log(`Đã nạp thành công bộ âm thanh Soundfont: ${sf3Name} cho nhạc cụ #${programNumber} (isDrum: ${isDrum}) (đã nạp trước đó)`);
      return; // Đã nạp rồi, không cần nạp lại
    }

    if (this.loadingInstrumentPromises.has(sf3Name)) {
      await this.loadingInstrumentPromises.get(sf3Name)!;
      console.log(`Đã nạp thành công bộ âm thanh Soundfont: ${sf3Name} cho nhạc cụ #${programNumber} (isDrum: ${isDrum}) (sử dụng tiến trình đang nạp)`);
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
        await synth.soundBankManager.addSoundBank(buffer.slice(0), sf3Name);
        await synth.isReady;

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

  // Tự động tải song song tất cả các bộ âm thanh cho các nhạc cụ có trong bài hát
  public async loadSongSoundbanks(synth: WorkletSynthesizer, tracks: TrackInfo[]): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    tracks.forEach(track => {
      const isDrum = track.channel === 9; // Kênh 10 là bộ gõ
      loadPromises.push(this.loadInstrumentSoundbank(synth, track.instrumentNumber, isDrum));
    });

    if (loadPromises.length > 0) {
      try {
        await Promise.all(loadPromises);
      } catch (err) {
        console.error('Lỗi khi nạp song song các bộ âm thanh nhạc cụ:', err);
      }
    }
  }

  public clearLoadedSet(): void {
    this.loadedSoundfonts.clear();
  }
}
