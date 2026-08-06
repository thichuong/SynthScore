import { describe, it } from 'vitest';
import { generateSymphonyMidi } from '../src/services/midiGenerator';
import { getWasmModule } from '../src/services/wasmLoader';
import { Midi } from '@tonejs/midi';

describe('Performance Benchmark: JS vs Rust WASM', () => {
  it('Benchmark: Symphony MIDI Generation & Orchestration', async () => {
    const wasm = await getWasmModule();
    if (!wasm) {
      console.warn('WASM module not available for benchmarking.');
      return;
    }

    // Generate a large MIDI score (5,000 notes)
    const midi = new Midi();
    const track = midi.addTrack();
    for (let i = 0; i < 5000; i++) {
      track.addNote({
        midi: 36 + (i % 48),
        time: (i * 0.05),
        duration: 0.2,
        velocity: 0.8
      });
    }
    const originalMidiBytes = new Uint8Array(midi.toArray());

    console.log(`\n======================================================`);
    console.log(`🚀 BENCHMARK 1: Symphony MIDI Generation (5,000 notes)`);
    console.log(`======================================================`);

    // 1. Benchmark TypeScript
    const startTs = performance.now();
    const resultTs = generateSymphonyMidi(originalMidiBytes);
    const endTs = performance.now();
    const durationTs = endTs - startTs;

    // 2. Benchmark Rust WASM
    const startWasm = performance.now();
    const resultWasm = wasm.generate_symphony_midi_wasm(originalMidiBytes);
    const endWasm = performance.now();
    const durationWasm = endWasm - startWasm;

    const speedup = (durationTs / Math.max(durationWasm, 0.001)).toFixed(2);

    console.log(`⏱️  TypeScript Exec Time : ${durationTs.toFixed(2)} ms (Output size: ${resultTs.length} bytes)`);
    console.log(`⚡ Rust WASM Exec Time  : ${durationWasm.toFixed(2)} ms (Output size: ${resultWasm.length} bytes)`);
    console.log(`🔥 WASM Speedup Factor   : ${speedup}x Faster!`);
    console.log(`------------------------------------------------------\n`);
  });

  it('Benchmark: Audio DSP DSD (DSF 1-bit Delta-Sigma Modulation)', async () => {
    const wasm = await getWasmModule();
    if (!wasm) return;

    // 5 seconds of stereo audio at 44.1kHz = 220,500 stereo samples (14.1 million DSD bits)
    const sampleRate = 44100;
    const numSamples = sampleRate * 5;
    const samplesL = new Float32Array(numSamples);
    const samplesR = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      samplesL[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate));
      samplesR[i] = Math.cos(2 * Math.PI * 440 * (i / sampleRate));
    }

    console.log(`======================================================`);
    console.log(`🚀 BENCHMARK 2: DSD (DSF 1-bit Delta-Sigma Noise Shaping, 5s Audio)`);
    console.log(`======================================================`);

    // 1. JS implementation
    const startJs = performance.now();
    const factor = 64;
    const totalDsdSamples = numSamples * factor;
    const blockSize = 4096;
    const blockBits = blockSize * 8;
    const numBlocks = Math.ceil(totalDsdSamples / blockBits);

    let integrators = [0.0, 0.0];
    let outputs = [0.0, 0.0];

    for (let b = 0; b < numBlocks; b++) {
      for (let c = 0; c < 2; c++) {
        const channelPcm = c === 0 ? samplesL : samplesR;
        const blockBuffer = new Uint8Array(blockSize);
        for (let bitIdx = 0; bitIdx < blockBits; bitIdx++) {
          const dsdSampleIdx = b * blockBits + bitIdx;
          let x = 0;
          if (dsdSampleIdx < totalDsdSamples) {
            const pcmIdxFloat = dsdSampleIdx / factor;
            const idxLower = Math.floor(pcmIdxFloat);
            const idxUpper = Math.min(numSamples - 1, idxLower + 1);
            const frac = pcmIdxFloat - idxLower;
            x = channelPcm[idxLower] + frac * (channelPcm[idxUpper] - channelPcm[idxLower]);
          }
          integrators[c] += x - outputs[c];
          let bitValue = 0;
          if (integrators[c] >= 0) {
            outputs[c] = 1.0;
            bitValue = 1;
          } else {
            outputs[c] = -1.0;
            bitValue = 0;
          }
          if (bitValue === 1) {
            blockBuffer[Math.floor(bitIdx / 8)] |= (1 << (bitIdx % 8));
          }
        }
      }
    }
    const endJs = performance.now();
    const durationJs = endJs - startJs;

    // 2. Rust WASM implementation
    const startWasm = performance.now();
    const dsfBytes = wasm.encode_dsd_dsf_wasm(samplesL, samplesR, sampleRate, 64);
    const endWasm = performance.now();
    const durationWasm = endWasm - startWasm;

    const speedup = (durationJs / Math.max(durationWasm, 0.001)).toFixed(2);

    console.log(`⏱️  JS DSP Exec Time    : ${durationJs.toFixed(2)} ms`);
    console.log(`⚡ Rust WASM Exec Time  : ${durationWasm.toFixed(2)} ms (DSF size: ${(dsfBytes.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`🔥 WASM Speedup Factor   : ${speedup}x Faster!`);
    console.log(`======================================================\n`);
  });
});
