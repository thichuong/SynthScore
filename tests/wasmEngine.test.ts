import { describe, it, expect } from 'vitest';
import { getWasmModule } from '../src/services/wasmLoader';

describe('Rust WASM Engine Integration', () => {
  it('should successfully load the WASM module', async () => {
    const wasm = await getWasmModule();
    expect(wasm).not.toBeNull();
    if (wasm && wasm.init_synthscore_wasm) {
      expect(wasm.init_synthscore_wasm()).toBe(true);
    }
  });

  it('should parse MIDI tracks via WASM module', async () => {
    const wasm = await getWasmModule();
    if (!wasm) return;

    // Create minimal fake MIDI header
    const dummyMidi = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x01, 0x01, 0xE0,
      0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x0B, 0x00, 0x90, 0x3C, 0x64, 0x81, 0x00, 0x80, 0x3C, 0x00, 0x00, 0xFF, 0x2F, 0x00
    ]);

    const tracks = wasm.parse_midi_tracks_wasm(dummyMidi);
    expect(Array.isArray(tracks)).toBe(true);
    expect(tracks.length).toBeGreaterThan(0);
    expect(tracks[0].channel).toBe(0);
  });

  it('should generate Symphony & Concerto MIDI via WASM module', async () => {
    const wasm = await getWasmModule();
    if (!wasm) return;

    const dummyMidi = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, 0x01, 0x00, 0x01, 0x01, 0xE0,
      0x4D, 0x54, 0x72, 0x6B, 0x00, 0x00, 0x00, 0x0B, 0x00, 0x90, 0x3C, 0x64, 0x81, 0x00, 0x80, 0x3C, 0x00, 0x00, 0xFF, 0x2F, 0x00
    ]);

    const symBytes = wasm.generate_symphony_midi_wasm(dummyMidi);
    expect(symBytes instanceof Uint8Array).toBe(true);
    expect(symBytes.length).toBeGreaterThan(0);

    const concBytes = wasm.generate_concerto_midi_wasm(dummyMidi);
    expect(concBytes instanceof Uint8Array).toBe(true);
    expect(concBytes.length).toBeGreaterThan(0);
  });

  it('should parse MusicXML to MIDI binary via WASM module', async () => {
    const wasm = await getWasmModule();
    if (!wasm) return;

    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
      <score-partwise version="3.1">
        <work><work-title>Test Wasm Song</work-title></work>
        <part-list>
          <score-part id="P1"><part-name>Flute</part-name></score-part>
        </part-list>
        <part id="P1">
          <measure number="1">
            <attributes>
              <divisions>4</divisions>
            </attributes>
            <sound tempo="120"/>
            <note>
              <pitch><step>C</step><octave>4</octave></pitch>
              <duration>4</duration>
              <voice>1</voice>
            </note>
          </measure>
        </part>
      </score-partwise>`;

    const midiBytes = wasm.parse_musicxml_to_midi_wasm(sampleXml);
    expect(midiBytes instanceof Uint8Array).toBe(true);
    expect(midiBytes.length).toBeGreaterThan(14);
    // MIDI magic header "MThd"
    expect(String.fromCharCode(midiBytes[0], midiBytes[1], midiBytes[2], midiBytes[3])).toBe('MThd');
  });

  it('should encode WAV and DSD (DSF) audio via WASM module', async () => {
    const wasm = await getWasmModule();
    if (!wasm) return;

    const sampleRate = 44100;
    const samplesL = new Float32Array(4410); // 0.1s audio
    const samplesR = new Float32Array(4410);

    const wavBytes = wasm.encode_wav_wasm(samplesL, samplesR, sampleRate, 16);
    expect(wavBytes instanceof Uint8Array).toBe(true);
    expect(wavBytes.length).toBeGreaterThan(44);
    // Check RIFF header magic bytes
    expect(String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3])).toBe('RIFF');

    const dsfBytes = wasm.encode_dsd_dsf_wasm(samplesL, samplesR, sampleRate, 64);
    expect(dsfBytes instanceof Uint8Array).toBe(true);
    expect(dsfBytes.length).toBeGreaterThan(104);
    // Check DSD header magic bytes
    expect(String.fromCharCode(dsfBytes[0], dsfBytes[1], dsfBytes[2], dsfBytes[3])).toBe('DSD ');
  });

  it('should parse compressed MXL to XML text and MIDI binary via WASM module', async () => {
    const wasm = await getWasmModule();
    if (!wasm || typeof wasm.parse_mxl_to_xml_wasm !== 'function' || typeof wasm.parse_mxl_to_midi_wasm !== 'function') return;

    // Build a simple zip buffer in memory
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
    <score-partwise version="3.1">
      <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
      <part id="P1">
        <measure number="1">
          <attributes><divisions>4</divisions></attributes>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
        </measure>
      </part>
    </score-partwise>`;
    zip.file('META-INF/container.xml', `<?xml version="1.0"?><container version="1.0"><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>`);
    zip.file('score.xml', sampleXml);

    const mxlBuffer = await zip.generateAsync({ type: 'uint8array' });

    const extractedXml = wasm.parse_mxl_to_xml_wasm(mxlBuffer);
    expect(extractedXml).toBe(sampleXml);

    const midiBytes = wasm.parse_mxl_to_midi_wasm(mxlBuffer);
    expect(midiBytes instanceof Uint8Array).toBe(true);
    expect(midiBytes.length).toBeGreaterThan(0);
  });
});

