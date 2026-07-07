import { Midi } from '@tonejs/midi';
import { GM_INSTRUMENTS } from '../data/instruments';
import type { TrackInfo } from './audioEngine';

// Định nghĩa interface cho worker messages
interface WorkerMessage {
  id: string;
  type: 'parseTracks' | 'generateSymphony' | 'generateConcerto';
  payload: any;
}

// Cấu hình 11 nhạc cụ giao hưởng
const symphonicTracksInfo = [
  { name: 'Violin I (Treble Strings)', program: 40, channel: 0 },
  { name: 'Violin II (Treble Strings)', program: 40, channel: 1 },
  { name: 'Viola (Alto Strings)', program: 41, channel: 2 },
  { name: 'Cello (Bass Strings)', program: 42, channel: 3 },
  { name: 'Contrabass (Deep Strings)', program: 43, channel: 4 },
  { name: 'Flute (Woodwind)', program: 73, channel: 5 },
  { name: 'Oboe (Woodwind)', program: 68, channel: 6 },
  { name: 'Clarinet (Woodwind)', program: 71, channel: 7 },
  { name: 'French Horn (Brass)', program: 60, channel: 8 },
  { name: 'Orchestral Harp (Plucked)', program: 46, channel: 9 },
  { name: 'Timpani (Percussion)', program: 47, channel: 10 },
];

// Cấu hình 9 nhạc cụ concerto
const concertoTracksInfo = [
  { name: 'Solo Grand Piano', program: 0, channel: 0 },
  { name: 'Violin I (Orchestra)', program: 40, channel: 1 },
  { name: 'Violin II (Orchestra)', program: 40, channel: 2 },
  { name: 'Viola (Orchestra)', program: 41, channel: 3 },
  { name: 'Cello (Orchestra)', program: 42, channel: 4 },
  { name: 'Contrabass (Orchestra)', program: 43, channel: 5 },
  { name: 'Flute (Orchestra)', program: 73, channel: 6 },
  { name: 'French Horn (Orchestra)', program: 60, channel: 7 },
  { name: 'Timpani (Orchestra)', program: 47, channel: 8 },
];

// Phân tích danh sách bè của bài nhạc bằng @tonejs/midi
function handleParseTracks(arrayBuffer: ArrayBuffer): TrackInfo[] {
  try {
    const midi = new Midi(arrayBuffer);
    
    // Tạo bản đồ lưu trữ các track có nốt nhạc theo kênh (channel)
    const channelNotes = new Map<number, { name: string; instrName: string; instrNum: number; count: number }>();

    midi.tracks.forEach(track => {
      if (track.notes.length === 0) return;

      const chan = track.channel;
      const current = channelNotes.get(chan);
      
      if (!current) {
        channelNotes.set(chan, {
          name: track.name || `Kênh ${chan + 1}`,
          instrName: track.instrument.name || GM_INSTRUMENTS[track.instrument.number] || 'Piano',
          instrNum: track.instrument.number,
          count: track.notes.length
        });
      } else {
        // Cộng dồn nốt nhạc nếu trùng kênh
        current.count += track.notes.length;
      }
    });

    // Tạo mảng thông tin track hoàn chỉnh
    return Array.from(channelNotes.entries()).map(([chan, info]) => {
      return {
        channel: chan,
        name: info.name,
        instrumentName: info.instrName,
        instrumentNumber: info.instrNum,
        volume: 80,
        isMuted: false,
        isSoloed: false,
        noteCount: info.count
      };
    }).sort((a, b) => a.channel - b.channel);

  } catch (e) {
    console.error('[Worker] Không thể phân tích cấu trúc MIDI tracks:', e);
    // Fallback: tạo 16 kênh mặc định
    return Array.from({ length: 16 }, (_, i) => ({
      channel: i,
      name: i === 9 ? 'Bộ trống (Drums)' : `Bè Kênh ${i + 1}`,
      instrumentName: i === 9 ? 'Drum Kit' : 'Acoustic Piano',
      instrumentNumber: i === 9 ? 0 : 0,
      volume: 80,
      isMuted: false,
      isSoloed: false,
      noteCount: 1
    }));
  }
}

// Tự động phân tách và chuyển bài nhạc thành phối khí dàn nhạc giao hương 11 bè
function handleGenerateSymphony(originalMidiBytes: Uint8Array): Uint8Array {
  try {
    const originalMidi = new Midi(originalMidiBytes.buffer as ArrayBuffer);
    const symphonyMidi = new Midi();
    symphonyMidi.name = originalMidi.name + " (Symphony)";

    if (originalMidi.header.tempos && originalMidi.header.tempos.length > 0) {
      symphonyMidi.header.setTempo(originalMidi.header.tempos[0].bpm);
    } else {
      symphonyMidi.header.setTempo(120);
    }

    const symTracks = symphonicTracksInfo.map(info => {
      const t = symphonyMidi.addTrack();
      t.name = info.name;
      t.instrument.number = info.program;
      t.channel = info.channel;
      return t;
    });

    // Thu thập tất cả nốt từ bài gốc
    const allNotes: { midi: number; time: number; duration: number; velocity: number }[] = [];
    originalMidi.tracks.forEach(track => {
      if (track.channel === 9) return; // Bỏ qua bộ gõ cũ
      track.notes.forEach(note => {
        allNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
        });
      });
    });

    allNotes.sort((a, b) => a.time - b.time);

    // === TỐI ƯU: Note Thinning — Giới hạn polyphony tối đa ===
    const MAX_VOICES_PER_WINDOW = 8;
    const QUANTIZE_WINDOW = 0.03; // 30ms

    const thinnedNotes: typeof allNotes = [];
    let windowStart = -Infinity;
    let windowNotes: typeof allNotes = [];

    const flushWindow = () => {
      if (windowNotes.length <= MAX_VOICES_PER_WINDOW) {
        thinnedNotes.push(...windowNotes);
      } else {
        windowNotes.sort((a, b) => b.velocity - a.velocity);
        thinnedNotes.push(...windowNotes.slice(0, MAX_VOICES_PER_WINDOW));
      }
      windowNotes = [];
    };

    for (const note of allNotes) {
      if (note.time - windowStart > QUANTIZE_WINDOW) {
        flushWindow();
        windowStart = note.time;
      }
      windowNotes.push(note);
    }
    flushWindow();

    thinnedNotes.sort((a, b) => a.time - b.time);

    let lastTimpaniTime = -5;
    let violinAlternator = 0;

    thinnedNotes.forEach(note => {
      const m = note.midi;
      const t = note.time;
      const d = note.duration;
      const v = note.velocity;

      if (m >= 64) {
        if (violinAlternator % 2 === 0) {
          symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });
          symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        } else {
          symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.85 });
          symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
        violinAlternator++;

        if (m >= 72) {
          symTracks[5].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
        }

        if (v >= 0.5) {
          symTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }

        if (v >= 0.7) {
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        }

        if (d >= 0.3 && v >= 0.5) {
          symTracks[9].addNote({ midi: m, time: t, duration: d, velocity: v * 0.3 });
        }
      } 
      else if (m >= 48 && m < 64) {
        symTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.8 });

        if (v >= 0.55) {
          symTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.55 });
        }

        if (d >= 0.25 && v >= 0.5) {
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
      } 
      else {
        symTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.9 });
        
        const cbMidi = m >= 36 ? m - 12 : m;
        symTracks[4].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.65 });

        if (m < 40 && (t - lastTimpaniTime) >= 1.5) {
          symTracks[10].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.45 });
          lastTimpaniTime = t;
        }
      }
    });

    return symphonyMidi.toArray();
  } catch (e) {
    console.error('[Worker] Lỗi khi sinh nhạc giao hưởng:', e);
    return originalMidiBytes;
  }
}

// Tự động phân tách và chuyển bài nhạc thành cấu hình Piano Concerto
function handleGenerateConcerto(originalMidiBytes: Uint8Array): Uint8Array {
  try {
    const originalMidi = new Midi(originalMidiBytes.buffer as ArrayBuffer);
    const concertoMidi = new Midi();
    concertoMidi.name = originalMidi.name + " (Piano Concerto)";

    if (originalMidi.header.tempos && originalMidi.header.tempos.length > 0) {
      concertoMidi.header.setTempo(originalMidi.header.tempos[0].bpm);
    } else {
      concertoMidi.header.setTempo(120);
    }

    const concertoTracks = concertoTracksInfo.map(info => {
      const t = concertoMidi.addTrack();
      t.name = info.name;
      t.instrument.number = info.program;
      t.channel = info.channel;
      return t;
    });

    const allNotes: { midi: number; time: number; duration: number; velocity: number }[] = [];
    originalMidi.tracks.forEach(track => {
      if (track.channel === 9) return;
      track.notes.forEach(note => {
        allNotes.push({
          midi: note.midi,
          time: note.time,
          duration: note.duration,
          velocity: note.velocity,
        });
      });
    });

    allNotes.sort((a, b) => a.time - b.time);

    let lastTimpaniTime = -5;

    allNotes.forEach(note => {
      const m = note.midi;
      const t = note.time;
      const d = note.duration;
      const v = note.velocity;

      // 1. Solo Grand Piano plays ALL notes at full velocity
      concertoTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });

      // 2. Orchestra accompanies softly
      if (m >= 64) {
        concertoTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.45 });
        concertoTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        if (m >= 72) {
          concertoTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
        concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
      } 
      else if (m >= 48 && m < 64) {
        concertoTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
      } 
      else {
        concertoTracks[4].addNote({ midi: m, time: t, duration: d, velocity: v * 0.5 });
        
        const cbMidi = m >= 36 ? m - 12 : m;
        concertoTracks[5].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.4 });

        if (m < 40 && (t - lastTimpaniTime) >= 1.2) {
          concertoTracks[8].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.35 });
          lastTimpaniTime = t;
        }
      }
    });

    return concertoMidi.toArray();
  } catch (e) {
    console.error('[Worker] Lỗi khi sinh nhạc concerto:', e);
    return originalMidiBytes;
  }
}

// Bắt sự kiện từ main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'parseTracks') {
      const arrayBuffer = payload as ArrayBuffer;
      const tracks = handleParseTracks(arrayBuffer);
      self.postMessage({ id, success: true, payload: tracks });
    } 
    else if (type === 'generateSymphony') {
      const originalMidiBytes = payload as Uint8Array;
      const resultBytes = handleGenerateSymphony(originalMidiBytes);
      
      // Sử dụng Transferable objects cho ArrayBuffer bên trong kết quả trả về
      const transferBuffer = resultBytes.buffer;
      self.postMessage(
        { id, success: true, payload: resultBytes },
        { transfer: [transferBuffer] }
      );
    } 
    else if (type === 'generateConcerto') {
      const originalMidiBytes = payload as Uint8Array;
      const resultBytes = handleGenerateConcerto(originalMidiBytes);
      
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
