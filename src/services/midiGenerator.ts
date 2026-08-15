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
  { name: 'Timpani (Percussion)', program: 47, channel: 9 },
  { name: 'Orchestral Harp (Plucked)', program: 46, channel: 10 },
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
export function parseMidiTracks(input: ArrayBufferLike | ArrayLike<number>): TrackInfo[] {
  try {
    const midi = new Midi(input as (ArrayBuffer | ArrayLike<number>));
    
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
    const originalMidi = new Midi(originalMidiBytes);
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

    // === PHỐI KHÍ ĐẦY ĐỦ TRỌN VẸN (Full Quality Orchestration) ===
    let lastTimpaniTime = -5;

    allNotes.forEach(note => {
      const m = note.midi;
      const t = note.time;
      const d = note.duration;
      const v = note.velocity;

      if (m >= 64) {
        // === Giai điệu âm cao (Treble) ===
        symTracks[0].addNote({ midi: m, time: t, duration: d, velocity: v });
        symTracks[1].addNote({ midi: m, time: t, duration: d, velocity: v * 0.7 });

        // Flute đệm nốt cao
        if (m >= 72) {
          symTracks[5].addNote({ midi: m, time: t, duration: d, velocity: v * 0.65 });
        }

        // Clarinet đệm hòa âm
        symTracks[7].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });

        // French Horn accent
        symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.35 });

        // Harp đệm nhẹ (Track index 10 = Orchestral Harp)
        symTracks[10].addNote({ midi: m, time: t, duration: d, velocity: v * 0.3 });
      } 
      else if (m >= 48 && m < 64) {
        // === Hòa âm âm trung (Mid) ===
        // Viola chơi chính
        symTracks[2].addNote({ midi: m, time: t, duration: d, velocity: v * 0.8 });

        // Oboe đệm
        symTracks[6].addNote({ midi: m, time: t, duration: d, velocity: v * 0.55 });

        // French Horn đệm trung
        symTracks[8].addNote({ midi: m, time: t, duration: d, velocity: v * 0.4 });
      } 
      else {
        // === Bè trầm (Bass) ===
        // Cello chơi chính
        symTracks[3].addNote({ midi: m, time: t, duration: d, velocity: v * 0.9 });
        
        // Contrabass octave dưới
        const cbMidi = m >= 36 ? m - 12 : m;
        symTracks[4].addNote({ midi: cbMidi, time: t, duration: d, velocity: v * 0.65 });

        // Timpani (Track index 9 = Timpani)
        if (m < 40 && (t - lastTimpaniTime) >= 1.5) {
          symTracks[9].addNote({ midi: m, time: t, duration: Math.min(d, 0.4), velocity: v * 0.45 });
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
    const originalMidi = new Midi(originalMidiBytes);
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

// Xóa bỏ một kênh (channel) khỏi tệp MIDI nhị phân
export function deleteChannelFromMidi(midiBytes: Uint8Array, channelIndex: number): Uint8Array {
  try {
    const midi = new Midi(midiBytes);
    midi.tracks = midi.tracks.filter(track => track.channel !== channelIndex);
    if (midi.tracks.length === 0) {
      const fallbackTrack = midi.addTrack();
      fallbackTrack.channel = 0;
      fallbackTrack.instrument.number = 0;
    }
    return midi.toArray();
  } catch (e) {
    console.error(`Lỗi khi xóa kênh ${channelIndex} khỏi MIDI:`, e);
    return midiBytes;
  }
}

// Thêm một kênh mới vào tệp MIDI nhị phân
export function addChannelToMidi(
  midiBytes: Uint8Array,
  channelIndex: number,
  programNumber = 0,
  name?: string
): Uint8Array {
  try {
    const midi = new Midi(midiBytes);
    const existing = midi.tracks.find(t => t.channel === channelIndex);
    if (existing) {
      existing.instrument.number = programNumber;
      existing.instrument.name = GM_INSTRUMENTS[programNumber] || 'Piano';
      if (name) existing.name = name;
    } else {
      const track = midi.addTrack();
      track.channel = channelIndex;
      track.instrument.number = programNumber;
      track.instrument.name = GM_INSTRUMENTS[programNumber] || 'Piano';
      track.name = name || GM_INSTRUMENTS[programNumber] || `Kênh ${channelIndex + 1}`;
    }
    return midi.toArray();
  } catch (e) {
    console.error(`Lỗi khi thêm kênh ${channelIndex} vào MIDI:`, e);
    return midiBytes;
  }
}

// Cập nhật mã nhạc cụ (program change) cho một kênh trong tệp MIDI nhị phân
export function updateChannelInstrumentInMidi(
  midiBytes: Uint8Array,
  channelIndex: number,
  programNumber: number
): Uint8Array {
  try {
    const midi = new Midi(midiBytes);
    let found = false;
    midi.tracks.forEach(track => {
      if (track.channel === channelIndex) {
        track.instrument.number = programNumber;
        track.instrument.name = GM_INSTRUMENTS[programNumber] || 'Unknown';
        found = true;
      }
    });
    if (!found) {
      const track = midi.addTrack();
      track.channel = channelIndex;
      track.instrument.number = programNumber;
      track.instrument.name = GM_INSTRUMENTS[programNumber] || 'Unknown';
      track.name = GM_INSTRUMENTS[programNumber] || `Kênh ${channelIndex + 1}`;
    }
    return midi.toArray();
  } catch (e) {
    console.error(`Lỗi khi cập nhật nhạc cụ kênh ${channelIndex} trong MIDI:`, e);
    return midiBytes;
  }
}
