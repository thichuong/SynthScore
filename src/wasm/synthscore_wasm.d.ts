/* tslint:disable */
/* eslint-disable */

export function encode_dsd_dsf_wasm(samples_l: Float32Array, samples_r: Float32Array, sample_rate: number, oversample_factor: number): Uint8Array;

export function encode_wav_wasm(samples_l: Float32Array, samples_r: Float32Array, sample_rate: number, bit_depth: number): Uint8Array;

export function generate_concerto_midi_wasm(bytes: Uint8Array): Uint8Array;

export function generate_symphony_midi_wasm(bytes: Uint8Array): Uint8Array;

export function init_synthscore_wasm(): boolean;

export function parse_midi_tracks_wasm(bytes: Uint8Array): any;

export function parse_musicxml_to_midi_wasm(xml_text: string): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly encode_dsd_dsf_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly encode_wav_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly generate_concerto_midi_wasm: (a: number, b: number) => [number, number];
    readonly generate_symphony_midi_wasm: (a: number, b: number) => [number, number];
    readonly init_synthscore_wasm: () => number;
    readonly parse_midi_tracks_wasm: (a: number, b: number) => any;
    readonly parse_musicxml_to_midi_wasm: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
