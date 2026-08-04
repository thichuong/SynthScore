import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SoundfontService, type SoundfontProgress } from '../src/services/audio/soundfontService';

describe('SoundfontService - Progress Tracking', () => {
  let soundfontService: SoundfontService;
  let originalFetch: any;

  beforeEach(() => {
    soundfontService = new SoundfontService();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should emit progress updates when preloading soundfont', async () => {
    const progressUpdates: (SoundfontProgress | null)[] = [];
    soundfontService.onProgress((p) => progressUpdates.push(p ? { ...p } : null));

    const fakeRiffBuffer = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]).buffer; // 'RIFF'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return 'audio/x-riff';
          if (lower === 'content-length') return '8';
          return null;
        }
      },
      arrayBuffer: async () => fakeRiffBuffer
    });

    await soundfontService.preloadSoundfont(0, false);

    expect(progressUpdates.length).toBeGreaterThan(0);
    // Cuối cùng phải notify null (hoàn thành)
    expect(progressUpdates[progressUpdates.length - 1]).toBeNull();
  });

  it('should switch to fallback GitHub Pages URL when local fetch fails', async () => {
    const progressUpdates: (SoundfontProgress | null)[] = [];
    soundfontService.onProgress((p) => progressUpdates.push(p ? { ...p } : null));

    const fakeRiffBuffer = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]).buffer;

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('https://thichuong.github.io/SynthScore')) {
        return {
          ok: true,
          headers: {
            get: (name: string) => {
              const lower = name.toLowerCase();
              if (lower === 'content-type') return 'audio/x-riff';
              if (lower === 'content-length') return '8';
              return null;
            }
          },
          arrayBuffer: async () => fakeRiffBuffer
        };
      }
      // Local URL fails with 404 HTML
      return {
        ok: false,
        headers: {
          get: () => 'text/html'
        },
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    });

    await soundfontService.preloadSoundfont(40, false); // Sonatina_Symphonic_Orchestra.sf3

    expect(callCount).toBe(2); // First local, second fallback
    const fallbackProgress = progressUpdates.find(p => p && p.isFallback);
    expect(fallbackProgress).toBeDefined();
    expect(fallbackProgress?.sf3Name).toBe('Sonatina_Symphonic_Orchestra.sf3');
  });
});
