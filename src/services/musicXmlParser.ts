import { Midi } from '@tonejs/midi';
import { getWasmModule, isWasmAvailable } from './wasmLoader';

export interface DetailedNote {
  pitch: string;
  time: number;      // in seconds
  duration: number;  // in seconds
}

// Helper phụ để lấy tên nốt từ Pitch Step, Alter, Octave
export function getNoteName(step: string, alter: number, octave: number): string {
  const steps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const stepIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step as 'C'|'D'|'E'|'F'|'G'|'A'|'B'] ?? 0;
  let finalIndex = stepIndex + alter;
  let finalOctave = octave;
  
  while (finalIndex < 0) {
    finalIndex += 12;
    finalOctave -= 1;
  }
  while (finalIndex >= 12) {
    finalIndex -= 12;
    finalOctave += 1;
  }
  
  return `${steps[finalIndex]}${finalOctave}`;
}

export interface ScorePartMeta {
  id: string;
  name: string;
  instrumentName: string;
  instrumentSound: string;
  midiChannel?: number;
  midiProgram?: number;
  volume?: number;
  pan?: number;
}

export function resolveInstrumentAndChannel(
  meta: ScorePartMeta,
  autoChannelRef: { val: number }
): { program: number; channel: number } {
  const text = `${meta.name} ${meta.instrumentName} ${meta.instrumentSound}`.toLowerCase();
  const isDrumSound = meta.instrumentSound.toLowerCase().startsWith('drum') || meta.instrumentSound.toLowerCase().startsWith('percussion');
  const isDrumText = text.includes('drum') || text.includes('percussion') || text.includes('kit');
  const isDrumChannel = meta.midiChannel === 10;
  const isDrum = isDrumSound || isDrumText || isDrumChannel;

  let channel: number;
  if (isDrum) {
    channel = 9;
  } else if (meta.midiChannel !== undefined && meta.midiChannel >= 1 && meta.midiChannel <= 16) {
    const c = (meta.midiChannel - 1) % 16;
    if (c === 9) {
      if (autoChannelRef.val === 9) autoChannelRef.val++;
      channel = autoChannelRef.val % 16;
      autoChannelRef.val++;
    } else {
      channel = c;
    }
  } else {
    if (autoChannelRef.val === 9) autoChannelRef.val++;
    channel = autoChannelRef.val % 16;
    autoChannelRef.val++;
  }

  let program = 0;
  if (isDrum) {
    program = 0;
  } else if (meta.midiProgram !== undefined && meta.midiProgram >= 1 && meta.midiProgram <= 128) {
    program = Math.max(0, Math.min(127, meta.midiProgram - 1));
  } else if (meta.instrumentSound) {
    const sound = meta.instrumentSound.toLowerCase();
    if (sound.includes('distortion')) program = 30;
    else if (sound.includes('clean')) program = 27;
    else if (sound.includes('jazz')) program = 26;
    else if (sound.includes('guitar')) program = 25;
    else if (sound.includes('bass.electric') || sound.includes('bass')) program = 33;
    else if (sound.includes('synth.lead')) program = 80;
    else if (sound.includes('synth.pad')) program = 88;
    else if (sound.includes('brass.synth')) program = 62;
    else if (sound.includes('brass')) program = 61;
    else if (sound.includes('violin')) program = 40;
    else if (sound.includes('viola')) program = 41;
    else if (sound.includes('cello')) program = 42;
    else if (sound.includes('contrabass')) program = 43;
    else if (sound.includes('flute')) program = 73;
    else if (sound.includes('oboe')) program = 68;
    else if (sound.includes('clarinet')) program = 71;
    else program = 0;
  } else {
    if (text.includes('distortion guitar') || text.includes('distortion')) program = 30;
    else if (text.includes('electric guitar')) program = 27;
    else if (text.includes('acoustic guitar') || text.includes('guitar') || text.includes('gtr')) program = 25;
    else if (text.includes('synth lead') || text.includes('lead synth') || text.includes('square') || text.includes('sawtooth') || text.includes('lead')) program = 80;
    else if (text.includes('synth brass')) program = 62;
    else if (text.includes('synth')) program = 80;
    else if (text.includes('brass')) program = 61;
    else if (text.includes('electric bass') || text.includes('pick bass') || text.includes('bass')) program = 33;
    else if (text.includes('violin') || text.includes('string')) program = 40;
    else if (text.includes('cello')) program = 42;
    else if (text.includes('flute')) program = 73;
    else if (text.includes('horn') || text.includes('cor')) program = 60;
    else if (text.includes('trumpet')) program = 56;
    else if (text.includes('sax')) program = 65;
    else if (text.includes('organ')) program = 16;
    else program = 0;
  }

  return { program, channel };
}

export function extractBpmFromText(text: string): number | null {
  const match = text.match(/(?:bpm|♩|q|\b)\s*=?\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    const val = parseFloat(match[1]);
    if (val >= 1 && val <= 500) {
      return val;
    }
  }
  return null;
}

export function parseMetronomeBpm(metronomeNode: Element): number | null {
  const perMinNode = metronomeNode.getElementsByTagNameNS('*', 'per-minute')[0];
  if (!perMinNode || !perMinNode.textContent) return null;
  const pmVal = extractBpmFromText(perMinNode.textContent.trim());
  if (!pmVal) return null;

  const beatUnitNode = metronomeNode.getElementsByTagNameNS('*', 'beat-unit')[0];
  const unit = beatUnitNode?.textContent?.trim().toLowerCase() || 'quarter';
  const hasDot = metronomeNode.getElementsByTagNameNS('*', 'beat-unit-dot').length > 0;

  let mult = 1.0;
  switch (unit) {
    case 'eighth': mult = 0.5; break;
    case 'quarter': mult = 1.0; break;
    case 'half': mult = 2.0; break;
    case 'whole': mult = 4.0; break;
    case '16th':
    case 'sixteenth': mult = 0.25; break;
    case '32nd':
    case 'thirty-second': mult = 0.125; break;
    case '64th':
    case 'sixty-fourth': mult = 0.0625; break;
  }
  if (hasDot) mult *= 1.5;
  return pmVal * mult;
}

/**
 * Trình phân tích cú pháp MusicXML cơ bản sang MIDI Binary.
 * Hỗ trợ các khái niệm chính: pitch, alter, octave, duration, chord, rest, backup, forward, tempo, voice, ties.
 */
export function parseMusicXmlToMidiBytes(xmlText: string): Uint8Array {
  if (isWasmAvailable()) {
    try {
      const wasm = getWasmModule() as any;
      if (wasm && typeof wasm.parse_musicxml_to_midi_wasm === 'function') {
        const wasmResult = wasm.parse_musicxml_to_midi_wasm(xmlText);
        if (wasmResult && wasmResult.length > 0) {
          return wasmResult;
        }
      }
    } catch (e) {
      console.warn('[MusicXML] Lỗi khi dùng WASM XML parser, chuyển sang JS fallback:', e);
    }
  }
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const midi = new Midi();
  const titleNode = xmlDoc.getElementsByTagNameNS('*', 'work-title')[0] || xmlDoc.getElementsByTagNameNS('*', 'movement-title')[0];
  midi.name = titleNode?.textContent?.trim() || 'MusicXML Song';

  const parts = xmlDoc.getElementsByTagNameNS('*', 'score-part');
  const partMap = new Map<string, ScorePartMeta>();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const id = part.getAttribute('id') || `P${i + 1}`;
    const nameNode = part.getElementsByTagNameNS('*', 'part-name')[0];
    const name = nameNode?.textContent?.trim() || 'Instrument';

    const instrNameNode = part.getElementsByTagNameNS('*', 'instrument-name')[0];
    const instrumentName = instrNameNode?.textContent?.trim() || '';

    const soundNode = part.getElementsByTagNameNS('*', 'instrument-sound')[0];
    const instrumentSound = soundNode?.textContent?.trim() || '';

    let midiChannel: number | undefined = undefined;
    let midiProgram: number | undefined = undefined;
    let volume: number | undefined = undefined;
    let pan: number | undefined = undefined;

    const midiInst = part.getElementsByTagNameNS('*', 'midi-instrument')[0];
    if (midiInst) {
      const chNode = midiInst.getElementsByTagNameNS('*', 'midi-channel')[0];
      if (chNode?.textContent) midiChannel = parseInt(chNode.textContent.trim(), 10);

      const progNode = midiInst.getElementsByTagNameNS('*', 'midi-program')[0];
      if (progNode?.textContent) midiProgram = parseInt(progNode.textContent.trim(), 10);

      const volNode = midiInst.getElementsByTagNameNS('*', 'volume')[0];
      if (volNode?.textContent) volume = parseFloat(volNode.textContent.trim());

      const panNode = midiInst.getElementsByTagNameNS('*', 'pan')[0];
      if (panNode?.textContent) pan = parseFloat(panNode.textContent.trim());
    }

    partMap.set(id, {
      id,
      name,
      instrumentName,
      instrumentSound,
      midiChannel,
      midiProgram,
      volume,
      pan
    });
  }

  const partElements = xmlDoc.getElementsByTagNameNS('*', 'part');
  
  // 1. Xác định vị trí phách bắt đầu của từng measure (dựa trên part đầu tiên làm chuẩn)
  const measureStartBeats: number[] = [];
  if (partElements.length > 0) {
    const firstPart = partElements[0];
    let divisions = 1;
    let beatOffset = 0;
    const measures = firstPart.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      measureStartBeats[m] = beatOffset;
      let currentVoice = '1';
      const voiceOffsets = new Map<string, number>();

      const children = Array.from(measures[m].childNodes);
      children.forEach(child => {
        if (child.nodeType !== 1) return;
        const el = child as HTMLElement;
        const tagName = el.localName.toLowerCase();
        
        if (tagName === 'attributes') {
          const divNode = el.getElementsByTagNameNS('*', 'divisions')[0];
          if (divNode) {
            divisions = parseInt(divNode.textContent || '1', 10);
          }
        } else if (tagName === 'backup') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, Math.max(measureStartBeats[m], currentVal - dur));
            beatOffset = Math.max(measureStartBeats[m], beatOffset - dur);
          }
        } else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, currentVal + dur);
            beatOffset += dur;
          }
        } else if (tagName === 'note') {
          const voiceNode = el.getElementsByTagNameNS('*', 'voice')[0];
          if (voiceNode && voiceNode.textContent) {
            currentVoice = voiceNode.textContent.trim();
          }
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const dur = durNode ? parseInt(durNode.textContent || '0', 10) / divisions : 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          
          if (!isChord) {
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, currentVal + dur);
            beatOffset = Math.max(beatOffset, currentVal + dur);
          }
        }
      });
    }
  }

  const roundBeat = (b: number) => Math.round(b * 10000) / 10000;

  // 2. Thu thập tất cả thay đổi tempo từ tất cả các bè
  const tempoChangesMap = new Map<number, number>(); // beatOffset -> bpm
  for (let p = 0; p < partElements.length; p++) {
    const partEl = partElements[p];
    let divisions = 1;
    let beatOffset = 0;
    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      if (measureStartBeats[m] !== undefined) {
        beatOffset = measureStartBeats[m];
      }
      let currentVoice = '1';
      const voiceOffsets = new Map<string, number>();

      const soundNodes = measures[m].getElementsByTagNameNS('*', 'sound');
      for (let s = 0; s < soundNodes.length; s++) {
        if (soundNodes[s].hasAttribute('tempo')) {
          const bpm = parseFloat(soundNodes[s].getAttribute('tempo') || '0');
          if (bpm > 0) {
            tempoChangesMap.set(roundBeat(beatOffset), bpm);
          }
        }
      }
      
      const children = Array.from(measures[m].childNodes);
      children.forEach(child => {
        if (child.nodeType !== 1) return;
        const el = child as HTMLElement;
        const tagName = el.localName.toLowerCase();
        
        if (tagName === 'attributes') {
          const divNode = el.getElementsByTagNameNS('*', 'divisions')[0];
          if (divNode) {
            divisions = parseInt(divNode.textContent || '1', 10);
          }
        } else if (tagName === 'sound') {
          if (el.hasAttribute('tempo')) {
            const bpm = parseFloat(el.getAttribute('tempo') || '0');
            if (bpm > 0) {
              tempoChangesMap.set(roundBeat(beatOffset), bpm);
            }
          }
        } else if (tagName === 'backup') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, Math.max(measureStartBeats[m] || 0, currentVal - dur));
            beatOffset = Math.max(measureStartBeats[m] || 0, beatOffset - dur);
          }
        } else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, currentVal + dur);
            beatOffset += dur;
          }
        } else if (tagName === 'note') {
          const voiceNode = el.getElementsByTagNameNS('*', 'voice')[0];
          if (voiceNode && voiceNode.textContent) {
            currentVoice = voiceNode.textContent.trim();
          }
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const dur = durNode ? parseInt(durNode.textContent || '0', 10) / divisions : 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          if (!isChord) {
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            voiceOffsets.set(currentVoice, currentVal + dur);
            beatOffset = Math.max(beatOffset, currentVal + dur);
          }
        } else if (tagName === 'direction') {
          let foundTempo = false;
          const soundNodes = el.getElementsByTagNameNS('*', 'sound');
          for (let s = 0; s < soundNodes.length; s++) {
            if (soundNodes[s].hasAttribute('tempo')) {
              const bpm = parseFloat(soundNodes[s].getAttribute('tempo') || '0');
              if (bpm > 0) {
                tempoChangesMap.set(roundBeat(beatOffset), bpm);
                foundTempo = true;
              }
            }
          }

          const metronomeNodes = el.getElementsByTagNameNS('*', 'metronome');
          for (let mNode = 0; mNode < metronomeNodes.length; mNode++) {
            const bpm = parseMetronomeBpm(metronomeNodes[mNode]);
            if (bpm && bpm > 0) {
              tempoChangesMap.set(roundBeat(beatOffset), bpm);
              foundTempo = true;
            }
          }

          if (!foundTempo) {
            const wordsNodes = el.getElementsByTagNameNS('*', 'words');
            for (let w = 0; w < wordsNodes.length; w++) {
              const txt = wordsNodes[w].textContent || '';
              const bpm = extractBpmFromText(txt);
              if (bpm && bpm > 0) {
                tempoChangesMap.set(roundBeat(beatOffset), bpm);
                break;
              }
            }
          }
        }
      });
    }
  }

  interface TempoChange {
    beat: number;
    bpm: number;
    time: number;
  }

  const tempoChanges: TempoChange[] = [];
  tempoChangesMap.forEach((bpm, beat) => {
    tempoChanges.push({ beat, bpm, time: 0 });
  });
  tempoChanges.sort((a, b) => a.beat - b.beat);

  let initialBpm = 120;
  if (tempoChanges.length > 0 && tempoChanges[0].beat === 0) {
    initialBpm = tempoChanges[0].bpm;
  } else {
    tempoChanges.unshift({ beat: 0, bpm: 120, time: 0 });
  }

  // Tính thời gian giây của từng điểm tempo
  tempoChanges[0].time = 0;
  for (let i = 1; i < tempoChanges.length; i++) {
    const prev = tempoChanges[i - 1];
    const curr = tempoChanges[i];
    const durationBeats = curr.beat - prev.beat;
    const durationSeconds = durationBeats * (60 / prev.bpm);
    curr.time = prev.time + durationSeconds;
  }

  // Ánh xạ phách sang giây
  function convertBeatsToSeconds(beat: number): number {
    let activeTempo = tempoChanges[0];
    for (let i = 1; i < tempoChanges.length; i++) {
      if (tempoChanges[i].beat <= beat + 1e-6) {
        activeTempo = tempoChanges[i];
      } else {
        break;
      }
    }
    const beatsSinceTempo = beat - activeTempo.beat;
    return activeTempo.time + beatsSinceTempo * (60 / activeTempo.bpm);
  }

  // Khởi tạo tempo map cho MIDI
  midi.header.setTempo(initialBpm);
  const ppq = midi.header.ppq;
  midi.header.tempos = tempoChanges.map(tc => ({
    bpm: tc.bpm,
    ticks: Math.round(tc.beat * ppq),
    time: tc.time
  }));
  midi.header.update();

  const autoChannelRef = { val: 0 };

  for (let p = 0; p < partElements.length; p++) {
    const partEl = partElements[p];
    const partId = partEl.getAttribute('id') || '';
    const meta = partMap.get(partId) || {
      id: partId,
      name: 'Track',
      instrumentName: '',
      instrumentSound: ''
    };
    const { program, channel } = resolveInstrumentAndChannel(meta, autoChannelRef);

    const track = midi.addTrack();
    track.name = meta.name || 'Track';
    track.channel = channel;
    track.instrument.number = program;

    let divisions = 1;
    let beatOffset = 0;
    const voiceOffsets = new Map<string, number>();
    const lastNoteStartBeats = new Map<string, number>();
    let currentVoice = '1';

    const partNotes: DetailedNote[] = [];
    const activeTies = new Map<string, DetailedNote>(); // key = pitch

    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      const measureStart = measureStartBeats[m] !== undefined ? measureStartBeats[m] : beatOffset;
      beatOffset = measureStart;
      voiceOffsets.clear();
      lastNoteStartBeats.clear();
      currentVoice = '1';

      const children = Array.from(measures[m].childNodes);
      
      children.forEach(child => {
        if (child.nodeType !== 1) return;
        const el = child as HTMLElement;
        const tagName = el.localName.toLowerCase();

        if (tagName === 'attributes') {
          const divNode = el.getElementsByTagNameNS('*', 'divisions')[0];
          if (divNode) {
            divisions = parseInt(divNode.textContent || '1', 10);
          }
        } 
        else if (tagName === 'backup') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            const newVal = Math.max(measureStart, currentVal - dur);
            voiceOffsets.set(currentVoice, newVal);
            beatOffset = Math.max(measureStart, beatOffset - dur);
          }
        } 
        else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10) / divisions;
            const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
            const newVal = currentVal + dur;
            voiceOffsets.set(currentVoice, newVal);
            beatOffset += dur;
          }
        } 
        else if (tagName === 'note') {
          const voiceNode = el.getElementsByTagNameNS('*', 'voice')[0];
          if (voiceNode && voiceNode.textContent) {
            currentVoice = voiceNode.textContent.trim();
          }

          const isRest = el.getElementsByTagNameNS('*', 'rest').length > 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const durationVal = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const durationBeats = durationVal / divisions;

          const currentVal = voiceOffsets.get(currentVoice) ?? beatOffset;
          const startBeat = isChord ? (lastNoteStartBeats.get(currentVoice) ?? currentVal) : currentVal;

          if (!isChord) {
            lastNoteStartBeats.set(currentVoice, startBeat);
            voiceOffsets.set(currentVoice, startBeat + durationBeats);
            beatOffset = Math.max(beatOffset, startBeat + durationBeats);
          }

          if (!isRest) {
            const pitchNode = el.getElementsByTagNameNS('*', 'pitch')[0];
            if (pitchNode) {
              const stepNode = pitchNode.getElementsByTagNameNS('*', 'step')[0];
              const step = stepNode?.textContent || 'C';
              const octaveNode = pitchNode.getElementsByTagNameNS('*', 'octave')[0];
              const octave = parseInt(octaveNode?.textContent || '4', 10);
              const alterNode = pitchNode.getElementsByTagNameNS('*', 'alter')[0];
              const alterVal = parseFloat(alterNode?.textContent || '0');
              
              const noteName = getNoteName(step, alterVal, octave);

              const startSec = convertBeatsToSeconds(startBeat);
              const endSec = convertBeatsToSeconds(startBeat + durationBeats);
              const durationSeconds = endSec - startSec;

              // Check ties
              const tieNodes = el.getElementsByTagNameNS('*', 'tie');
              const tiedNodes = el.getElementsByTagNameNS('*', 'tied');
              let isTieStart = false;
              let isTieStop = false;

              for (let t = 0; t < tieNodes.length; t++) {
                const type = tieNodes[t].getAttribute('type');
                if (type === 'start') isTieStart = true;
                if (type === 'stop') isTieStop = true;
              }
              for (let t = 0; t < tiedNodes.length; t++) {
                const type = tiedNodes[t].getAttribute('type');
                if (type === 'start') isTieStart = true;
                if (type === 'stop') isTieStop = true;
              }

              const tieKey = `${currentVoice}_${noteName}`;

              if (isTieStop && activeTies.has(tieKey)) {
                const existingNote = activeTies.get(tieKey)!;
                existingNote.duration += durationSeconds;
                if (!isTieStart) {
                  activeTies.delete(tieKey);
                }
              } else {
                const newNoteObj: DetailedNote = {
                  pitch: noteName,
                  time: startSec,
                  duration: durationSeconds
                };
                partNotes.push(newNoteObj);
                if (isTieStart) {
                  activeTies.set(tieKey, newNoteObj);
                }
              }
            }
          }
        }
      });
    }

    // Sort notes by time then pitch
    partNotes.sort((a, b) => a.time - b.time || a.pitch.localeCompare(b.pitch));

    // Post-process to trim overlapping identical pitches in MIDI track
    for (let i = 0; i < partNotes.length; i++) {
      const curr = partNotes[i];
      for (let j = i + 1; j < partNotes.length; j++) {
        const next = partNotes[j];
        if (next.time >= curr.time + curr.duration - 1e-4) break;
        if (next.pitch === curr.pitch) {
          if (Math.abs(next.time - curr.time) < 1e-4) {
            // Same start time duplicate note
          } else {
            curr.duration = Math.max(0.01, next.time - curr.time);
            break;
          }
        }
      }
    }

    // Add notes to Midi track
    partNotes.forEach(n => {
      track.addNote({
        name: n.pitch,
        time: n.time,
        duration: n.duration,
        velocity: 0.8
      });
    });
  }

  return midi.toArray();
}
