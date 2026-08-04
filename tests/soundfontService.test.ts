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

  it('should calculate aggregate batch progress when preloading all soundfonts', async () => {
    const progressUpdates: (SoundfontProgress | null)[] = [];
    soundfontService.onProgress((p) => progressUpdates.push(p ? { ...p } : null));

    const fakeRiffBuffer = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]).buffer;

    globalThis.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      headers: {
        get: (name: string) => {
          const lower = name.toLowerCase();
          if (lower === 'content-type') return 'audio/x-riff';
          if (lower === 'content-length') return '1000';
          return null;
        }
      },
      arrayBuffer: async () => fakeRiffBuffer
    }));

    await soundfontService.preloadAllSoundfonts();

    expect(progressUpdates.length).toBeGreaterThan(0);
    // Cuối cùng khi tất cả hoàn thành phải gửi null
    expect(progressUpdates[progressUpdates.length - 1]).toBeNull();
  });
});
