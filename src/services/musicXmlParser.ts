import { Midi } from '@tonejs/midi';

/**
 * Trình phân tích cú pháp MusicXML cơ bản sang MIDI Binary.
 * Hỗ trợ các khái niệm chính: pitch, alter, octave, duration, chord, rest, backup, forward, tempo.
 */
export function parseMusicXmlToMidiBytes(xmlText: string): Uint8Array {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  
  const midi = new Midi();
  const titleNode = xmlDoc.querySelector('work work-title') || xmlDoc.querySelector('movement-title');
  midi.name = titleNode?.textContent?.trim() || 'MusicXML Song';

  const parts = xmlDoc.querySelectorAll('part-list score-part');
  const partMap = new Map<string, string>();
  parts.forEach(part => {
    const id = part.getAttribute('id');
    const name = part.querySelector('part-name')?.textContent || 'Instrument';
    if (id) partMap.set(id, name);
  });

  const partElements = xmlDoc.querySelectorAll('part');
  partElements.forEach(partEl => {
    const partId = partEl.getAttribute('id') || '';
    const trackName = partMap.get(partId) || 'Track';
    
    const track = midi.addTrack();
    track.name = trackName;
    
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

    let divisions = 1; // Số xung nhịp mỗi nốt đen (ticks per quarter note)
    let currentBpm = 120;
    let timeInSeconds = 0; // Thời gian chạy (giây)
    let timeInBeats = 0; // Thời gian chạy (phách)
    
    // Để xử lý chords, chúng ta lưu thời gian bắt đầu của nốt trước đó
    let lastNoteStartTime = 0;

    const measures = partEl.querySelectorAll('measure');
    measures.forEach(measure => {
      const children = Array.from(measure.childNodes);
      
      children.forEach(child => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        const el = child as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'attributes') {
          const divNode = el.querySelector('divisions');
          if (divNode) {
            divisions = parseInt(divNode.textContent || '1', 10);
          }
        } 
        else if (tagName === 'direction') {
          const tempoNode = el.querySelector('sound[tempo]');
          if (tempoNode) {
            const newBpm = parseFloat(tempoNode.getAttribute('tempo') || '120');
            if (newBpm > 0) {
              currentBpm = newBpm;
              midi.header.setTempo(currentBpm);
            }
          }
        } 
        else if (tagName === 'backup') {
          const durNode = el.querySelector('duration');
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInBeats = Math.max(0, timeInBeats - beats);
            timeInSeconds = Math.max(0, timeInSeconds - (beats * (60 / currentBpm)));
          }
        } 
        else if (tagName === 'forward') {
          const durNode = el.querySelector('duration');
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInBeats += beats;
            timeInSeconds += beats * (60 / currentBpm);
          }
        } 
        else if (tagName === 'note') {
          const isRest = el.querySelector('rest') !== null;
          const isChord = el.querySelector('chord') !== null;
          
          const durNode = el.querySelector('duration');
          const durationVal = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const durationBeats = durationVal / divisions;
          const durationSeconds = durationBeats * (60 / currentBpm);

          if (isRest) {
            // Nếu là nốt lặng, chỉ dịch thời gian đi tới
            timeInBeats += durationBeats;
            timeInSeconds += durationSeconds;
          } else {
            // Đọc thông tin cao độ nốt nhạc
            const pitchNode = el.querySelector('pitch');
            if (pitchNode) {
              const step = pitchNode.querySelector('step')?.textContent || 'C';
              const octave = parseInt(pitchNode.querySelector('octave')?.textContent || '4', 10);
              const alterVal = parseFloat(pitchNode.querySelector('alter')?.textContent || '0');
              
              const noteName = getNoteName(step, alterVal, octave);
              
              let startSec = timeInSeconds;

              if (isChord) {
                // Nếu là hợp âm, nốt này phát cùng lúc với nốt trước
                startSec = lastNoteStartTime;
              } else {
                // Lưu vết thời điểm bắt đầu để nốt sau nếu là chord có thể dùng
                lastNoteStartTime = timeInSeconds;
              }

              track.addNote({
                name: noteName,
                time: startSec,
                duration: durationSeconds,
                velocity: 0.8
              });

              if (!isChord) {
                // Tiến thời gian lên nếu không phải nốt gộp âm
                timeInBeats += durationBeats;
                timeInSeconds += durationSeconds;
              }
            }
          }
        }
      });
    });
  });

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
