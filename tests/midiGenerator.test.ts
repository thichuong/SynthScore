import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  getDefaultTrackSettings,
  parseMidiTracks,
  generateSymphonyMidi,
  generateConcertoMidi
} from '../src/services/midiGenerator';

// Helper to create a basic Midi object with some notes
function createTestMidi(): Uint8Array {
  const midi = new Midi();
  midi.name = 'Test Original Song';
  midi.header.setTempo(100);
  
  // Track 1 (Piano, channel 0)
  const track1 = midi.addTrack();
  track1.name = 'Piano';
  track1.channel = 0;
  track1.instrument.number = 0;
  track1.addNote({ midi: 60, time: 0, duration: 1, velocity: 0.8 }); // C4
  track1.addNote({ midi: 64, time: 1, duration: 1, velocity: 0.7 }); // E4
  track1.addNote({ midi: 76, time: 2, duration: 1, velocity: 0.8 }); // E5 (>= 72 to trigger Flute)
  
  // Track 2 (Bass, channel 1)
  const track2 = midi.addTrack();
  track2.name = 'Bass';
  track2.channel = 1;
  track2.instrument.number = 32; // Acoustic Bass
  track2.addNote({ midi: 36, time: 0, duration: 2, velocity: 0.9 }); // C2
  
  return midi.toArray();
}

describe('midiGenerator', () => {
  describe('getDefaultTrackSettings', () => {
    it('should assign classical panning/reverb for violin track (program 40)', () => {
      const settings = getDefaultTrackSettings(40, 0);
      expect(settings.pan).toBe(-30); // Left panning for Violin I
      expect(settings.reverbSend).toBe(90);
      expect(settings.chorusSend).toBe(40);
    });

    it('should assign default panning/reverb for piano track (program 0)', () => {
      const settings = getDefaultTrackSettings(0, 0);
      expect(settings.pan).toBe(0);
      expect(settings.reverbSend).toBe(64);
      expect(settings.chorusSend).toBe(0);
    });
  });

  describe('parseMidiTracks', () => {
    it('should parse tracks correctly from MIDI array buffer', () => {
      const originalMidiBytes = createTestMidi();
      const tracksInfo = parseMidiTracks(originalMidiBytes.buffer);
      
      expect(tracksInfo.length).toBe(2);
      
      // Track 0 (Piano)
      expect(tracksInfo[0].channel).toBe(0);
      expect(tracksInfo[0].name).toBe('Piano');
      expect(tracksInfo[0].instrumentNumber).toBe(0);
      expect(tracksInfo[0].noteCount).toBe(3);
      
      // Track 1 (Bass)
      expect(tracksInfo[1].channel).toBe(1);
      expect(tracksInfo[1].name).toBe('Bass');
      expect(tracksInfo[1].instrumentNumber).toBe(32);
      expect(tracksInfo[1].noteCount).toBe(1);
    });

    it('should fallback to 16 default tracks if parsing fails', () => {
      const invalidBuffer = new ArrayBuffer(10);
      const tracksInfo = parseMidiTracks(invalidBuffer);
      expect(tracksInfo.length).toBe(16);
      expect(tracksInfo[0].name).toBe('Bè Kênh 1');
      expect(tracksInfo[9].name).toBe('Bộ trống (Drums)');
    });
  });

  describe('generateSymphonyMidi', () => {
    it('should generate an 11-track symphony arrangement', () => {
      const originalMidiBytes = createTestMidi();
      const symphonyBytes = generateSymphonyMidi(originalMidiBytes);
      
      expect(symphonyBytes).toBeInstanceOf(Uint8Array);
      
      const midi = new Midi(symphonyBytes.buffer);
      expect(midi.name).toContain('(Symphony)');
      expect(midi.tracks.length).toBe(11);
      
      // Violin I (program 40, channel 0)
      expect(midi.tracks[0].name).toBe('Violin I (Treble Strings)');
      expect(midi.tracks[0].instrument.number).toBe(40);
      expect(midi.tracks[0].channel).toBe(0);

      // Flute (program 73, channel 5)
      expect(midi.tracks[5].name).toBe('Flute (Woodwind)');
      expect(midi.tracks[5].instrument.number).toBe(73);
      expect(midi.tracks[5].channel).toBe(5);
    });
  });

  describe('generateConcertoMidi', () => {
    it('should generate a 9-track concerto arrangement', () => {
      const originalMidiBytes = createTestMidi();
      const concertoBytes = generateConcertoMidi(originalMidiBytes);
      
      expect(concertoBytes).toBeInstanceOf(Uint8Array);
      
      const midi = new Midi(concertoBytes.buffer);
      expect(midi.name).toContain('(Piano Concerto)');
      expect(midi.tracks.length).toBe(9);
      
      // Solo Grand Piano (program 0, channel 0)
      expect(midi.tracks[0].name).toBe('Solo Grand Piano');
      expect(midi.tracks[0].instrument.number).toBe(0);
      expect(midi.tracks[0].channel).toBe(0);

      // Cello (program 42, channel 4)
      expect(midi.tracks[4].name).toBe('Cello (Orchestra)');
      expect(midi.tracks[4].instrument.number).toBe(42);
      expect(midi.tracks[4].channel).toBe(4);
    });
  });
});
