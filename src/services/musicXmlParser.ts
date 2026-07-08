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

    let divisions = 1; // Số xung nhịp mỗi nốt đen (ticks per quarter note)
    let currentBpm = 120;
    let timeInSeconds = 0; // Thời gian chạy (giây)
    let timeInBeats = 0; // Thời gian chạy (phách)
    
    // Để xử lý chords, chúng ta lưu thời gian bắt đầu của nốt trước đó
    let lastNoteStartTime = 0;

    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      const measure = measures[m];
      const children = Array.from(measure.childNodes);
      
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
        else if (tagName === 'direction') {
          const soundNodes = el.getElementsByTagNameNS('*', 'sound');
          for (let s = 0; s < soundNodes.length; s++) {
            if (soundNodes[s].hasAttribute('tempo')) {
              const newBpm = parseFloat(soundNodes[s].getAttribute('tempo') || '120');
              if (newBpm > 0) {
                currentBpm = newBpm;
                midi.header.setTempo(currentBpm);
              }
              break;
            }
          }
        } 
        else if (tagName === 'backup') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInBeats = Math.max(0, timeInBeats - beats);
            timeInSeconds = Math.max(0, timeInSeconds - (beats * (60 / currentBpm)));
          }
        } 
        else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInBeats += beats;
            timeInSeconds += beats * (60 / currentBpm);
          }
        } 
        else if (tagName === 'note') {
          const isRest = el.getElementsByTagNameNS('*', 'rest').length > 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const durationVal = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const durationBeats = durationVal / divisions;
          const durationSeconds = durationBeats * (60 / currentBpm);

          if (isRest) {
            // Nếu là nốt lặng, chỉ dịch thời gian đi tới
            timeInBeats += durationBeats;
            timeInSeconds += durationSeconds;
          } else {
            // Đọc thông tin cao độ nốt nhạc
            const pitchNode = el.getElementsByTagNameNS('*', 'pitch')[0];
            if (pitchNode) {
              const stepNode = pitchNode.getElementsByTagNameNS('*', 'step')[0];
              const step = stepNode?.textContent || 'C';
              const octaveNode = pitchNode.getElementsByTagNameNS('*', 'octave')[0];
              const octave = parseInt(octaveNode?.textContent || '4', 10);
              const alterNode = pitchNode.getElementsByTagNameNS('*', 'alter')[0];
              const alterVal = parseFloat(alterNode?.textContent || '0');
              
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
