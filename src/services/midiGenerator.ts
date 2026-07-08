import { Midi } from '@tonejs/midi';
import { GM_INSTRUMENTS } from '../data/instruments';

export interface TrackInfo {
  channel: number;
  name: string;
  instrumentName: string;
  instrumentNumber: number;
  volume: number;      // 0 to 100
  isMuted: boolean;
  isSoloed: boolean;
  noteCount: number;
  pan: number;         // -100 to 100 (Left to Right)
  reverbSend: number;  // 0 to 127
  chorusSend: number;  // 0 to 127
}

// Hàm cung cấp cấu hình không gian âm thanh mặc định cho nhạc cụ
export function getDefaultTrackSettings(program: number, channel: number): { pan: number; reverbSend: number; chorusSend: number } {
  // Bè dây (40-47)
  if (program >= 40 && program <= 47) {
    let pan = 0;
    // Cấu hình vị trí Pan dàn nhạc giao hưởng cổ điển
    if (program === 40) {
      // Violin: Lệch trái. Kênh chẵn lệch nhiều hơn, kênh lẻ lệch ít hơn
      pan = channel % 2 === 0 ? -30 : -15;
    } else if (program === 41) {
      // Viola: Hơi lệch trái
      pan = -10;
    } else if (program === 42) {
      // Cello: Hơi lệch phải
      pan = 20;
    } else if (program === 43) {
      // Contrabass: Lệch phải nhiều
      pan = 40;
    } else {
      pan = -5;
    }
    return {
      pan,
      reverbSend: 90,  // Tăng vang nhiều cho bè dây
      chorusSend: program === 40 ? 40 : 25  // Thêm chorus để tạo cảm giác dày bè (ensemble)
    };
  }

  // Piano (0-7)
  if (program >= 0 && program <= 7) {
    return {
      pan: 0,
      reverbSend: 64,
      chorusSend: 0
    };
  }

  // Các nhạc cụ khác mặc định
  return {
    pan: 0,
    reverbSend: 50,
    chorusSend: 0
  };
}

// Cấu hình 11 nhạc cụ giao hưởng
export const symphonicTracksInfo = [
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
export const concertoTracksInfo = [
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
export function parseMidiTracks(arrayBuffer: ArrayBuffer): TrackInfo[] {
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
      const defaults = getDefaultTrackSettings(info.instrNum, chan);
      return {
        channel: chan,
        name: info.name,
        instrumentName: info.instrName,
        instrumentNumber: info.instrNum,
        volume: 80,
        isMuted: false,
        isSoloed: false,
        noteCount: info.count,
        ...defaults
      };
    }).sort((a, b) => a.channel - b.channel);

  } catch (e) {
    console.error('Không thể phân tích cấu trúc MIDI tracks:', e);
    // Fallback: tạo 16 kênh mặc định
    return Array.from({ length: 16 }, (_, i) => {
      const isDrum = i === 9;
      const prog = isDrum ? 0 : 0;
      const defaults = getDefaultTrackSettings(prog, i);
      return {
        channel: i,
        name: isDrum ? 'Bộ trống (Drums)' : `Bè Kênh ${i + 1}`,
        instrumentName: isDrum ? 'Drum Kit' : 'Acoustic Piano',
        instrumentNumber: isDrum ? 0 : 0,
        volume: 80,
        isMuted: false,
        isSoloed: false,
        noteCount: 1,
        ...defaults
      };
    });
  }
}

// Tự động phân tách và chuyển bài nhạc thành phối khí dàn nhạc giao hương 11 bè
// (Phiên bản tối ưu hiệu năng: Note Thinning + Alternation + Polyphony Limit)
export function generateSymphonyMidi(originalMidiBytes: Uint8Array): Uint8Array {
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
    // Gom nốt theo cửa sổ thời gian 30ms, giữ tối đa MAX_VOICES_PER_WINDOW nốt/cửa sổ
    const MAX_VOICES_PER_WINDOW = 8;
    const QUANTIZE_WINDOW = 0.03; // 30ms

    const thinnedNotes: typeof allNotes = [];
    let windowStart = -Infinity;
    let windowNotes: typeof allNotes = [];

    const flushWindow = () => {
      if (windowNotes.length <= MAX_VOICES_PER_WINDOW) {
        thinnedNotes.push(...windowNotes);
      } else {
        // Ưu tiên giữ nốt có velocity cao nhất
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

    // Sắp xếp lại theo thời gian sau khi thinning
    thinnedNotes.sort((a, b) => a.time - b.time);

    // === PHỐI KHÍ THÔNG MINH ===
    let lastTimpaniTime = -5;
    let violinAlternator = 0; // Xen kẽ Violin I/II

    thinnedNotes.forEach(note => {
      const m = note.midi;
      const t = note.time;
      const d = note.duration;
      const v = note.velocity;

      if (m >= 64) {
        // === Giai điệu âm cao ===
        // Xen kẽ Violin I/II thay vì ghi cả hai đồng thời → giảm 1 voice
        if (violinAlternator % 2 === 0) {
          symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });
          symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        } else {
          symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.85 });
          symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
        violinAlternator++;

        // Flute chỉ chơi nốt rất cao (giai điệu chính)
        if (m >= 72) {
          symTracks[5].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
        }

        // Clarinet đệm nhẹ — chỉ khi velocity gốc đủ mạnh
        if (v >= 0.5) {
          symTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }

        // French Horn chỉ nhấn vào các nốt mạnh (accent)
        if (v >= 0.7) {
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        }

        // Harp arpeggio nhẹ — chỉ trên nốt có duration dài (sustain)
        if (d >= 0.3 && v >= 0.5) {
          symTracks[9].addNote({ midi: m, time: t, duration: d, velocity: v * 0.3 });
        }
      } 
      else if (m >= 48 && m < 64) {
        // === Hòa âm âm trung ===
        // Viola chơi chính
        symTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.8 });

        // Oboe chỉ đệm nốt mạnh
        if (v >= 0.55) {
          symTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.55 });
        }

        // French Horn hòa âm trung — chỉ sustain dài
        if (d >= 0.25 && v >= 0.5) {
          symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
      } 
      else {
        // === Bè trầm (Bass) ===
        // Cello chơi chính
        symTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.9 });
        
        // Contrabass octave dưới
        const cbMidi = m >= 36 ? m - 12 : m;
        symTracks[4].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.65 });

        // Timpani chỉ đánh nốt trầm sâu, cách nhau >= 1.5s
        if (m < 40 && (t - lastTimpaniTime) >= 1.5) {
          symTracks[10].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.45 });
          lastTimpaniTime = t;
        }
      }
    });

    return symphonyMidi.toArray();
  } catch (e) {
    console.error('Lỗi khi sinh nhạc giao hưởng:', e);
    return originalMidiBytes;
  }
}

// Tự động phân tách và chuyển bài nhạc thành cấu hình Piano Concerto (Solo Piano + Dàn nhạc đệm)
export function generateConcertoMidi(originalMidiBytes: Uint8Array): Uint8Array {
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
        // Treble: Violin I, Violin II, Flute, French Horn
        concertoTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.45 });
        concertoTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
        if (m >= 72) {
          concertoTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        }
        concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.3 });
      } 
      else if (m >= 48 && m < 64) {
        // Mid: Viola, French Horn
        concertoTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
        concertoTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });
      } 
      else {
        // Bass: Cello, Contrabass, Timpani
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
    console.error('Lỗi khi sinh nhạc concerto:', e);
    return originalMidiBytes;
  }
}
