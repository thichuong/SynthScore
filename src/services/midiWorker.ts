import {
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi
} from './midiGenerator';
import { getWasmModule } from './wasmLoader';

// Định nghĩa interface cho worker messages
interface WorkerMessage {
  id: string;
  type: 'parseTracks' | 'generateSymphony' | 'generateConcerto';
  payload: any;
}

// Bắt sự kiện từ main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    const wasm = await getWasmModule();

    if (type === 'parseTracks') {
      const arrayBuffer = payload as ArrayBuffer;
      let tracks;
      if (wasm) {
        tracks = wasm.parse_midi_tracks_wasm(new Uint8Array(arrayBuffer));
      } else {
        tracks = parseMidiTracks(arrayBuffer);
      }
      self.postMessage({ id, success: true, payload: tracks });
    } 
    else if (type === 'generateSymphony') {
      const originalMidiBytes = payload as Uint8Array;
      let resultBytes: Uint8Array;
      if (wasm) {
        resultBytes = wasm.generate_symphony_midi_wasm(originalMidiBytes);
      } else {
        resultBytes = generateSymphonyMidi(originalMidiBytes);
      }
      
      const transferBuffer = resultBytes.buffer;
      self.postMessage(
        { id, success: true, payload: resultBytes },
        { transfer: [transferBuffer] }
      );
    } 
    else if (type === 'generateConcerto') {
      const originalMidiBytes = payload as Uint8Array;
      let resultBytes: Uint8Array;
      if (wasm) {
        resultBytes = wasm.generate_concerto_midi_wasm(originalMidiBytes);
      } else {
        resultBytes = generateConcertoMidi(originalMidiBytes);
      }
      
      const transferBuffer = resultBytes.buffer;
      self.postMessage(
        { id, success: true, payload: resultBytes },
        { transfer: [transferBuffer] }
      );
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || String(err) });
  }
};

