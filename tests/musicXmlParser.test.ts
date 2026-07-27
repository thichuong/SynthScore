import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMusicXmlToMidiBytes } from '../src/services/musicXmlParser';

describe('parseMusicXmlToMidiBytes', () => {
  it('should parse a basic MusicXML structure to valid MIDI bytes', () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <movement-title>Basic Test Song</movement-title>
      <part-list>
        <score-part id="P1">
          <part-name>Violin</part-name>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes>
            <divisions>2</divisions>
          </attributes>
          <direction>
            <sound tempo="120"/>
          </direction>
          <!-- Note 1: C4, duration 2 (1 beat = 0.5s at 120BPM) -->
          <note>
            <pitch>
              <step>C</step>
              <octave>4</octave>
            </pitch>
            <duration>2</duration>
          </note>
          <!-- Note 2: F4 (E4 + 1 alter), duration 2 (starts at 0.5s) -->
          <note>
            <pitch>
              <step>E</step>
              <alter>1</alter>
              <octave>4</octave>
            </pitch>
            <duration>2</duration>
          </note>
          <!-- Note 3: G4 chord note, same time as Note 2 (starts at 0.5s) -->
          <note>
            <chord/>
            <pitch>
              <step>G</step>
              <octave>4</octave>
            </pitch>
            <duration>2</duration>
          </note>
          <!-- Note 4: Rest, duration 2 (skips time by 0.5s) -->
          <note>
            <rest/>
            <duration>2</duration>
          </note>
          <!-- Note 5: A4, duration 2 (starts at 1.5s because of Note 2 + Rest durations) -->
          <note>
            <pitch>
              <step>A</step>
              <octave>4</octave>
            </pitch>
            <duration>2</duration>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    expect(midiBytes).toBeInstanceOf(Uint8Array);
    expect(midiBytes.length).toBeGreaterThan(0);

    const midi = new Midi(midiBytes.buffer);
    
    // Verify header and track
    expect(midi.name).toBe('Basic Test Song');
    expect(midi.tracks.length).toBe(1);
    
    const track = midi.tracks[0];
    expect(track.name).toBe('Violin');
    expect(track.instrument.number).toBe(40); // Violin is program 40
    
    // Notes verification
    // Expected notes: C4 (0s), F4 (0.5s), G4 (0.5s), A4 (1.5s)
    // Note that step E + 1 alter is F4
    const notes = track.notes;
    expect(notes.length).toBe(4); // 4 notes (Note 1, 2, 3, 5). Note 4 is a rest.
    
    // Note 1: C4
    expect(notes[0].name).toBe('C4');
    expect(notes[0].time).toBeCloseTo(0, 2);
    expect(notes[0].duration).toBeCloseTo(0.5, 2);
    
    // Note 2 & 3 are chord notes at 0.5s
    expect(notes[1].name).toBe('F4'); // E4 + alter 1 = F4
    expect(notes[1].time).toBeCloseTo(0.5, 2);
    
    expect(notes[2].name).toBe('G4');
    expect(notes[2].time).toBeCloseTo(0.5, 2);
    
    // Note 5: A4 at 1.5s
    expect(notes[3].name).toBe('A4');
    expect(notes[3].time).toBeCloseTo(1.5, 2);
  });

  it('should handle tied notes across measure boundaries', () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <part-list>
        <score-part id="P1"><part-name>Piano</part-name></score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>4</duration>
            <tie type="start"/>
          </note>
        </measure>
        <measure number="2">
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>4</duration>
            <tie type="stop"/>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    const midi = new Midi(midiBytes.buffer);
    const notes = midi.tracks[0].notes;
    
    // Tied notes should be merged into 1 single note of 8 divisions (4 beats at 120bpm = 2s total duration)
    expect(notes.length).toBe(1);
    expect(notes[0].name).toBe('C4');
    expect(notes[0].time).toBeCloseTo(0, 2);
    expect(notes[0].duration).toBeCloseTo(4.0, 2);
  });

  it('should handle multi-voice measures with backup correctly', () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <part-list>
        <score-part id="P1"><part-name>Piano</part-name></score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <!-- Voice 1: C4 (4 beats) -->
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>4</duration>
            <voice>1</voice>
          </note>
          <backup><duration>4</duration></backup>
          <!-- Voice 2: E4 (2 beats) then G4 (2 beats) -->
          <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>2</duration>
            <voice>2</voice>
          </note>
          <note>
            <pitch><step>G</step><octave>4</octave></pitch>
            <duration>2</duration>
            <voice>2</voice>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    const midi = new Midi(midiBytes.buffer);
    const notes = midi.tracks[0].notes;

    expect(notes.length).toBe(3); // C4 at 0s (dur 4), E4 at 0s (dur 2), G4 at 1s (dur 2)
    const c4 = notes.find(n => n.name === 'C4');
    const e4 = notes.find(n => n.name === 'E4');
    const g4 = notes.find(n => n.name === 'G4');

    expect(c4).toBeDefined();
    expect(e4).toBeDefined();
    expect(g4).toBeDefined();

    expect(c4?.time).toBeCloseTo(0, 2);
    expect(c4?.duration).toBeCloseTo(2.0, 2); // 4 beats = 2.0s

    expect(e4?.time).toBeCloseTo(0, 2);
    expect(e4?.duration).toBeCloseTo(1.0, 2); // 2 beats = 1.0s

    expect(g4?.time).toBeCloseTo(1.0, 2); // starts at 1.0s
    expect(g4?.duration).toBeCloseTo(1.0, 2);
  });
});
