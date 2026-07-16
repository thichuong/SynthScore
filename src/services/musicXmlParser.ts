import { Midi } from '@tonejs/midi';

/**
 * Trình phân tích cú pháp MusicXML cơ bản sang MIDI Binary.
 * Hỗ trợ các khái niệm chính: pitch, alter, octave, duration, chord, rest, backup, forward, tempo.
 */
export function parseMusicXmlToMidiBytes(xmlText: string): Uint8Array {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const midi = new Midi();
  const titleNode = xmlDoc.getElementsByTagNameNS('*', 'work-title')[0] || xmlDoc.getElementsByTagNameNS('*', 'movement-title')[0];
  midi.name = titleNode?.textContent?.trim() || 'MusicXML Song';

  const parts = xmlDoc.getElementsByTagNameNS('*', 'score-part');
  const partMap = new Map<string, string>();
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const id = part.getAttribute('id');
    const nameNode = part.getElementsByTagNameNS('*', 'part-name')[0];
    const name = nameNode?.textContent || 'Instrument';
    if (id) partMap.set(id, name);
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
      const children = Array.from(measures[m].childNodes);
      children.forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
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
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset = Math.max(0, beatOffset - dur / divisions);
          }
        } else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset += dur / divisions;
          }
        } else if (tagName === 'note') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const dur = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          if (!isChord) {
            beatOffset += dur / divisions;
          }
        }
      });
    }
  }

  // Helper làm tròn phách tránh sai lệch float nhỏ
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
        if (child.nodeType !== Node.ELEMENT_NODE) return;
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
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset = Math.max(0, beatOffset - dur / divisions);
          }
        } else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset += dur / divisions;
          }
        } else if (tagName === 'note') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const dur = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          if (!isChord) {
            beatOffset += dur / divisions;
          }
        } else if (tagName === 'direction') {
          const soundNodes = el.getElementsByTagNameNS('*', 'sound');
          for (let s = 0; s < soundNodes.length; s++) {
            if (soundNodes[s].hasAttribute('tempo')) {
              const bpm = parseFloat(soundNodes[s].getAttribute('tempo') || '0');
              if (bpm > 0) {
                tempoChangesMap.set(roundBeat(beatOffset), bpm);
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

  let channelCounter = 0;

  for (let p = 0; p < partElements.length; p++) {
    const partEl = partElements[p];
    const partId = partEl.getAttribute('id') || '';
    const trackName = partMap.get(partId) || 'Track';
    
    const track = midi.addTrack();
    track.name = trackName;

    // Gán channel MIDI riêng cho từng track (bỏ qua kênh 9 dành cho trống)
    if (channelCounter === 9) {
      channelCounter++;
    }
    track.channel = channelCounter % 16;
    channelCounter++;
    
    // Tự động gán loại nhạc cụ cơ bản dựa trên tên
    const nameLower = trackName.toLowerCase();
    if (nameLower.includes('violin') || nameLower.includes('string')) {
      track.instrument.number = 40; // Violin
    } else if (nameLower.includes('cello')) {
      track.instrument.number = 42; // Cello
    } else if (nameLower.includes('flute')) {
      track.instrument.number = 73; // Flute
    } else if (nameLower.includes('horn') || nameLower.includes('cor')) {
      track.instrument.number = 60; // French Horn
    } else {
      track.instrument.number = 0; // Acoustic Grand Piano
    }

    let divisions = 1;
    let beatOffset = 0;
    let lastNoteStartBeat = 0;

    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      if (measureStartBeats[m] !== undefined) {
        beatOffset = measureStartBeats[m];
      }

      const children = Array.from(measures[m].childNodes);
      
      children.forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
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
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset = Math.max(0, beatOffset - dur / divisions);
          }
        } 
        else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            beatOffset += dur / divisions;
          }
        } 
        else if (tagName === 'note') {
          const isRest = el.getElementsByTagNameNS('*', 'rest').length > 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const durationVal = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const durationBeats = durationVal / divisions;

          if (isRest) {
            beatOffset += durationBeats;
          } else {
            const pitchNode = el.getElementsByTagNameNS('*', 'pitch')[0];
            if (pitchNode) {
              const stepNode = pitchNode.getElementsByTagNameNS('*', 'step')[0];
              const step = stepNode?.textContent || 'C';
              const octaveNode = pitchNode.getElementsByTagNameNS('*', 'octave')[0];
              const octave = parseInt(octaveNode?.textContent || '4', 10);
              const alterNode = pitchNode.getElementsByTagNameNS('*', 'alter')[0];
              const alterVal = parseFloat(alterNode?.textContent || '0');
              
              const noteName = getNoteName(step, alterVal, octave);
              
              const startBeat = isChord ? lastNoteStartBeat : beatOffset;
              if (!isChord) {
                lastNoteStartBeat = beatOffset;
              }

              const startSec = convertBeatsToSeconds(startBeat);
              const endSec = convertBeatsToSeconds(startBeat + durationBeats);
              const durationSeconds = endSec - startSec;

              track.addNote({
                name: noteName,
                time: startSec,
                duration: durationSeconds,
                velocity: 0.8
              });

              if (!isChord) {
                beatOffset += durationBeats;
              }
            }
          }
        }
      });
    }
  }
  return midi.toArray();
}

// Hàm phụ để lấy tên nốt từ Pitch Step, Alter, Octave
function getNoteName(step: string, alter: number, octave: number): string {
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
