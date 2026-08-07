/**
 * Dịch vụ nạp & quản lý module Rust WASM cho SynthScore Backend Engine.
 * Hỗ trợ lazy loading, nạp đệm (cache), và fallback tương thích với cả Browser & Node.js/Vitest test runner.
 */

export interface TrackInfoWasm {
  channel: number;
  name: string;
  instrumentName: string;
  instrumentNumber: number;
  volume: number;
  isMuted: boolean;
  isSoloed: boolean;
  noteCount: number;
  pan: number;
  reverbSend: number;
  chorusSend: number;
}

export interface SynthScoreWasmModule {
  init_synthscore_wasm?: () => boolean;
  parse_midi_tracks_wasm: (bytes: Uint8Array) => TrackInfoWasm[];
  generate_symphony_midi_wasm: (bytes: Uint8Array) => Uint8Array;
  generate_concerto_midi_wasm: (bytes: Uint8Array) => Uint8Array;
  parse_musicxml_to_midi_wasm: (xml_text: string) => Uint8Array;
  parse_mxl_to_xml_wasm?: (mxl_bytes: Uint8Array) => string;
  parse_mxl_to_midi_wasm?: (mxl_bytes: Uint8Array) => Uint8Array;
  encode_wav_wasm: (samples_l: Float32Array, samples_r: Float32Array, sample_rate: number, bit_depth: number) => Uint8Array;
  encode_dsd_dsf_wasm: (samples_l: Float32Array, samples_r: Float32Array, sample_rate: number, oversample_factor: number) => Uint8Array;
}

let wasmInstance: SynthScoreWasmModule | null = null;
let initPromise: Promise<SynthScoreWasmModule | null> | null = null;

export async function getWasmModule(): Promise<SynthScoreWasmModule | null> {
  if (wasmInstance) return wasmInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const module = await import('../wasm/synthscore_wasm.js');

      // Tương thích với môi trường Node/Vitest
      if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          const wasmPath = path.resolve(process.cwd(), 'src/wasm/synthscore_wasm_bg.wasm');
          if (fs.existsSync(wasmPath)) {
            const wasmBuffer = fs.readFileSync(wasmPath);
            module.initSync({ module: wasmBuffer });
            wasmInstance = module as unknown as SynthScoreWasmModule;
            if (wasmInstance.init_synthscore_wasm) {
              wasmInstance.init_synthscore_wasm();
            }
            return wasmInstance;
          }
        } catch {
          // Continue to web init
        }
      }

      if (module.default) {
        await module.default();
      }
      wasmInstance = module as unknown as SynthScoreWasmModule;
      if (wasmInstance.init_synthscore_wasm) {
        wasmInstance.init_synthscore_wasm();
      }
      return wasmInstance;
    } catch (e) {
      console.warn('[WasmLoader] Không thể nạp Rust WASM module, chuyển sang dùng TypeScript fallback:', e);
      return null;
    }
  })();

  return initPromise;
}

export function isWasmAvailable(): boolean {
  return wasmInstance !== null;
}
