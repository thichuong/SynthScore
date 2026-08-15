import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMusicXmlToMidiBytes } from '../src/services/musicXmlParser';
import { getWasmModule } from '../src/services/wasmLoader';

describe('MusicXML Tempo & Metronome Parsing', () => {
  it('should parse score with <metronome> <per-minute>152</per-minute> correctly', async () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <part-list>
        <score-part id="P1"><part-name>Piano</part-name></score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <direction placement="above">
            <direction-type>
              <metronome>
                <beat-unit>quarter</beat-unit>
                <per-minute>152</per-minute>
              </metronome>
            </direction-type>
          </direction>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>1</duration>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    const midi = new Midi(midiBytes);

    expect(midi.header.tempos.length).toBeGreaterThan(0);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(152);

    // Test WASM parser directly if available
    const wasm = await getWasmModule();
    if (wasm && typeof wasm.parse_musicxml_to_midi_wasm === 'function') {
      const wasmBytes = wasm.parse_musicxml_to_midi_wasm(xmlText);
      const wasmMidi = new Midi(wasmBytes);
      expect(wasmMidi.header.tempos.length).toBeGreaterThan(0);
      expect(Math.round(wasmMidi.header.tempos[0].bpm)).toBe(152);
    }
  });

  it('should parse eighth note beat-unit with 120 per-minute as 60 quarter note BPM', async () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <part-list>
        <score-part id="P1"><part-name>Flute</part-name></score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>2</divisions></attributes>
          <direction>
            <direction-type>
              <metronome>
                <beat-unit>eighth</beat-unit>
                <per-minute>120</per-minute>
              </metronome>
            </direction-type>
          </direction>
          <note>
            <pitch><step>G</step><octave>4</octave></pitch>
            <duration>2</duration>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    const midi = new Midi(midiBytes);

    expect(midi.header.tempos.length).toBeGreaterThan(0);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(60);

    const wasm = await getWasmModule();
    if (wasm && typeof wasm.parse_musicxml_to_midi_wasm === 'function') {
      const wasmBytes = wasm.parse_musicxml_to_midi_wasm(xmlText);
      const wasmMidi = new Midi(wasmBytes);
      expect(wasmMidi.header.tempos.length).toBeGreaterThan(0);
      expect(Math.round(wasmMidi.header.tempos[0].bpm)).toBe(60);
    }
  });

  it('should parse multiple tempo changes across measures in MusicXML', async () => {
    const xmlText = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.0">
      <part-list>
        <score-part id="P1"><part-name>Violin</part-name></score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <direction><sound tempo="120"/></direction>
          <note>
            <pitch><step>C</step><octave>4</octave></pitch>
            <duration>4</duration>
          </note>
        </measure>
        <measure number="2">
          <direction><sound tempo="160"/></direction>
          <note>
            <pitch><step>E</step><octave>4</octave></pitch>
            <duration>4</duration>
          </note>
        </measure>
      </part>
    </score-partwise>`;

    const midiBytes = parseMusicXmlToMidiBytes(xmlText);
    const midi = new Midi(midiBytes);

    expect(midi.header.tempos.length).toBeGreaterThanOrEqual(2);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(120);
    expect(Math.round(midi.header.tempos[1].bpm)).toBe(160);

    const wasm = await getWasmModule();
    if (wasm && typeof wasm.parse_musicxml_to_midi_wasm === 'function') {
      const wasmBytes = wasm.parse_musicxml_to_midi_wasm(xmlText);
      const wasmMidi = new Midi(wasmBytes);
      expect(wasmMidi.header.tempos.length).toBeGreaterThanOrEqual(2);
      expect(Math.round(wasmMidi.header.tempos[0].bpm)).toBe(120);
      expect(Math.round(wasmMidi.header.tempos[1].bpm)).toBe(160);
    }
  });
});
