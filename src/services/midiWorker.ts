import {
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi
} from './midiGenerator';

// Định nghĩa interface cho worker messages
interface WorkerMessage {
  id: string;
  type: 'parseTracks' | 'generateSymphony' | 'generateConcerto';
  payload: any;
}

// Bắt sự kiện từ main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'parseTracks') {
      const arrayBuffer = payload as ArrayBuffer;
      const tracks = parseMidiTracks(arrayBuffer);
      self.postMessage({ id, success: true, payload: tracks });
    } 
    else if (type === 'generateSymphony') {
      const originalMidiBytes = payload as Uint8Array;
      const resultBytes = generateSymphonyMidi(originalMidiBytes);
      
      // Sử dụng Transferable objects cho ArrayBuffer bên trong kết quả trả về
      const transferBuffer = resultBytes.buffer;
      self.postMessage(
        { id, success: true, payload: resultBytes },
        { transfer: [transferBuffer] }
      );
    } 
    else if (type === 'generateConcerto') {
      const originalMidiBytes = payload as Uint8Array;
      const resultBytes = generateConcertoMidi(originalMidiBytes);
      
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

