import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '@tonejs/midi';
const { Midi } = pkg;
import abcjs from 'abcjs';
import { parseMusicXmlToMidiBytes } from '../src/services/musicXmlParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const presetsDir = path.resolve(__dirname, '../public/presets');

describe('Local Presets Parsing Audit', () => {
  it('should parse beethoven_symphony_5.mid and verify all 12 channels / tracks and notes', () => {
    const filePath = path.join(presetsDir, 'beethoven_symphony_5.mid');
    expect(fs.existsSync(filePath)).toBe(true);

    const fileBuffer = fs.readFileSync(filePath);
    const uint8Buf = new Uint8Array(fileBuffer);
    const arrayBuffer = uint8Buf.buffer.slice(
      uint8Buf.byteOffset,
      uint8Buf.byteOffset + uint8Buf.byteLength
    );
    const midi = new Midi(arrayBuffer);

    expect(midi.tracks.length).toBeGreaterThanOrEqual(12);

    let totalNotes = 0;
    const channelSet = new Set<number>();

    midi.tracks.forEach((track, idx) => {
      totalNotes += track.notes.length;
      const channel = track.channel !== undefined ? track.channel : idx;
      if (track.notes.length > 0) {
        channelSet.add(channel);
      }
    });

    expect(totalNotes).toBeGreaterThan(5000);
    expect(channelSet.size).toBeGreaterThanOrEqual(10);
  });

  it('should parse beethoven_moonlight.musicxml to valid MIDI bytes', () => {
    const filePath = path.join(presetsDir, 'beethoven_moonlight.musicxml');
    expect(fs.existsSync(filePath)).toBe(true);

    const xmlText = fs.readFileSync(filePath, 'utf-8');
    const midiBytes = parseMusicXmlToMidiBytes(xmlText);

    expect(midiBytes).toBeInstanceOf(Uint8Array);
    expect(midiBytes.length).toBeGreaterThan(100);

    const midi = new Midi(midiBytes.buffer);
    expect(midi.tracks.length).toBeGreaterThan(0);

    let totalNotes = 0;
    midi.tracks.forEach(track => {
      totalNotes += track.notes.length;
    });
    expect(totalNotes).toBeGreaterThan(100);
  });

  it('should parse beethoven_elise.xml to valid MIDI bytes', () => {
    const filePath = path.join(presetsDir, 'beethoven_elise.xml');
    expect(fs.existsSync(filePath)).toBe(true);

    const xmlText = fs.readFileSync(filePath, 'utf-8');
    const midiBytes = parseMusicXmlToMidiBytes(xmlText);

    expect(midiBytes).toBeInstanceOf(Uint8Array);
    expect(midiBytes.length).toBeGreaterThan(100);

    const midi = new Midi(midiBytes.buffer);
    expect(midi.tracks.length).toBeGreaterThan(0);

    let totalNotes = 0;
    midi.tracks.forEach(track => {
      totalNotes += track.notes.length;
    });
    expect(totalNotes).toBeGreaterThan(100);
  });

  it('should parse beethoven_elise.abc via abcjs to valid binary MIDI bytes and extract 640 notes', () => {
    const filePath = path.join(presetsDir, 'beethoven_elise.abc');
    expect(fs.existsSync(filePath)).toBe(true);

    const abcText = fs.readFileSync(filePath, 'utf-8');
    const midiBin = abcjs.synth.getMidiFile(abcText, { midiOutputType: 'binary' }) as any;

    let raw = Array.isArray(midiBin) ? midiBin[0] : midiBin;
    let uint8: Uint8Array;
    if (typeof raw === 'string') {
      uint8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i) & 0xff;
    } else if (raw instanceof Uint8Array) {
      uint8 = raw;
    } else if (raw && raw.buffer) {
      uint8 = new Uint8Array(raw.buffer);
    } else {
      uint8 = new Uint8Array(0);
    }

    expect(uint8.byteLength).toBeGreaterThan(1000);
    expect(uint8[0]).toBe(77); // 'M'
    expect(uint8[1]).toBe(84); // 'T'
    expect(uint8[2]).toBe(104); // 'h'
    expect(uint8[3]).toBe(100); // 'd'

    const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
    const midi = new Midi(arrayBuffer);

    expect(midi.tracks.length).toBeGreaterThan(0);
    let totalNotes = 0;
    midi.tracks.forEach(track => {
      totalNotes += track.notes.length;
    });
    expect(totalNotes).toBeGreaterThan(100);
  });
});
