import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../src/services/audioEngine';
import { Midi } from '@tonejs/midi';

// Mock Worker class to emulate background parsing / orchestration
class MockWorker {
  onmessage: any = null;
  onerror: any = null;
  
  postMessage(message: any) {
    const { id, type, payload } = message;
    
    // Simulate async response from Web Worker
    setTimeout(() => {
      if (type === 'parseTracks') {
        this.onmessage?.({
          data: {
            id,
            success: true,
            payload: [
              {
                channel: 0,
                name: 'Piano Track',
                instrumentName: 'Piano',
                instrumentNumber: 0,
                volume: 100,
                isMuted: false,
                isSoloed: false,
                noteCount: 5,
                pan: 0,
                reverbSend: 50,
                chorusSend: 0
              }
            ]
          }
        });
      } else if (type === 'generateSymphony' || type === 'generateConcerto') {
        this.onmessage?.({
          data: {
            id,
            success: true,
            payload: payload // Echo back original bytes
          }
        });
      }
    }, 10);
  }
}

describe('audioEngine', () => {
  let originalWorker: any;
  let originalFetch: any;

  beforeEach(() => {
    originalWorker = (globalThis as any).Worker;
    originalFetch = globalThis.fetch;

    // Assign mock Worker
    (globalThis as any).Worker = MockWorker;

    // Mock fetch to return a valid fake Soundfont binary (must start with 'RIFF' or 'RIFS')
    const riffBuffer = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]).buffer; // 'RIFF'
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'audio/x-riff' : null),
      },
      arrayBuffer: async () => riffBuffer,
    });
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('should initialize successfully', async () => {
    // Reset singleton state if initialized in previous runs
    (AudioEngine as any).isInitialized = false;
    (AudioEngine as any).isReady = false;

    await AudioEngine.init();

    expect(AudioEngine.isInitialized).toBe(true);
    expect(AudioEngine.isReady).toBe(true);
    expect(AudioEngine.masterVolume).toBe(100);
  });

  it('should load a song and parse track info', async () => {
    // Generate valid MIDI bytes
    const midi = new Midi();
    const track = midi.addTrack();
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 1 });
    const midiBytes = new Uint8Array(midi.toArray());

    await AudioEngine.loadSong(midiBytes, 'Test Song');

    expect(AudioEngine.currentSongName).toBe('Test Song');
    expect(AudioEngine.duration).toBeGreaterThan(0);
    expect(AudioEngine.tracks.length).toBe(1);
    expect(AudioEngine.tracks[0].name).toBe('Piano Track');
  });

  it('should handle playback controls (play, pause, stop, seek)', async () => {
    // Mock play/pause state transitions
    AudioEngine.play();
    expect(AudioEngine.isPlaying).toBe(true);

    AudioEngine.pause();
    expect(AudioEngine.isPlaying).toBe(false);

    AudioEngine.seek(5.5);
    expect(AudioEngine.currentTime).toBe(5.5);

    AudioEngine.stop();
    expect(AudioEngine.isPlaying).toBe(false);
    expect(AudioEngine.currentTime).toBe(0);
  });

  it('should integrate with Media Session API and manage silent audio element', async () => {
    const nav = navigator as any;
    
    // Clear mock calls
    nav.mediaSession.setActionHandler.mockClear();
    nav.mediaSession.setPositionState.mockClear();
    nav.mediaSession.playbackState = 'none';

    // 1. Initial State
    expect(nav.mediaSession.playbackState).toBe('none');

    // 2. Play
    AudioEngine.play();
    expect(nav.mediaSession.playbackState).toBe('playing');
    expect(nav.mediaSession.setPositionState).toHaveBeenCalled();

    // 3. Pause
    AudioEngine.pause();
    expect(nav.mediaSession.playbackState).toBe('paused');

    // 4. Seek
    nav.mediaSession.setPositionState.mockClear();
    AudioEngine.seek(10);
    expect(nav.mediaSession.setPositionState).toHaveBeenCalledWith(expect.objectContaining({
      position: 10
    }));

    // 5. Stop
    AudioEngine.stop();
    expect(nav.mediaSession.playbackState).toBe('none');
  });

  it('should update mixer values (volume, pan, mute, solo)', () => {
    // Mock tracks setup
    AudioEngine.tracks = [
      {
        channel: 0,
        name: 'Track 1',
        instrumentName: 'Piano',
        instrumentNumber: 0,
        volume: 100,
        isMuted: false,
        isSoloed: false,
        noteCount: 1,
        pan: 0,
        reverbSend: 50,
        chorusSend: 0
      }
    ];

    AudioEngine.setTrackVolume(0, 90);
    expect(AudioEngine.tracks[0].volume).toBe(90);

    AudioEngine.setTrackPan(0, 20);
    expect(AudioEngine.tracks[0].pan).toBe(20);

    AudioEngine.setTrackMute(0, true);
    expect(AudioEngine.tracks[0].isMuted).toBe(true);

    AudioEngine.setTrackSolo(0, true);
    expect(AudioEngine.tracks[0].isSoloed).toBe(true);
  });

  it('should switch playback mode (symphony, concerto, default)', async () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 60, time: 0, duration: 1 });
    const midiBytes = new Uint8Array(midi.toArray());

    await AudioEngine.loadSong(midiBytes, 'Concerto Prep');

    // Switch to Symphony
    await AudioEngine.setPlaybackMode('symphony');
    expect(AudioEngine.playbackMode).toBe('symphony');
    expect(AudioEngine.currentSongName).toContain('(Giao Hưởng)');

    // Switch to Concerto
    await AudioEngine.setPlaybackMode('concerto');
    expect(AudioEngine.playbackMode).toBe('concerto');
    expect(AudioEngine.currentSongName).toContain('(Concerto)');

    // Switch back to default
    await AudioEngine.setPlaybackMode('default');
    expect(AudioEngine.playbackMode).toBe('default');
    expect(AudioEngine.currentSongName).toBe('Concerto Prep');
  });

  it('should resolve correct Soundfont file based on program number or track channel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    
    // Reset loaded Soundfonts to force loading from network/mock
    (AudioEngine as any).loadedSoundfonts.clear();
    (AudioEngine as any).soundfontCache.clear();
    
    // 1. Program 0 (Piano) -> MuseScore_General.sf3
    await AudioEngine.loadInstrumentSoundbank(0, false);
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('MuseScore_General.sf3'));
    
    // 2. Program 40 (Violin) -> Sonatina_Symphonic_Orchestra.sf3
    await AudioEngine.loadInstrumentSoundbank(40, false);
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('Sonatina_Symphonic_Orchestra.sf3'));
    
    // 3. Program 80 (Synth) -> FluidR3Mono_GM.sf3
    await AudioEngine.loadInstrumentSoundbank(80, false);
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('FluidR3Mono_GM.sf3'));
    
    // 4. Program 0, isDrum true -> Roland_SC-88.sf3
    await AudioEngine.loadInstrumentSoundbank(0, true);
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('Roland_SC-88.sf3'));
    
    // 5. Program 115 -> Roland_SC-88.sf3
    await AudioEngine.loadInstrumentSoundbank(115, false);
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.stringContaining('Roland_SC-88.sf3'));
  });

  it('should play test note and trigger synthesizer noteOn/noteOff with correct timing', () => {
    vi.useFakeTimers();
    
    const synth = (AudioEngine as any).synth;
    const noteOnSpy = vi.spyOn(synth, 'noteOn');
    const noteOffSpy = vi.spyOn(synth, 'noteOff');
    
    // 1. Play normal channel test note (C4, velocity 100)
    AudioEngine.playTestNote(0);
    expect(noteOnSpy).toHaveBeenCalledWith(0, 60, 100);
    
    // Advance timers by 800ms
    vi.advanceTimersByTime(800);
    expect(noteOffSpy).toHaveBeenCalledWith(0, 60);
    
    // 2. Play drum channel test note (Bass Drum 36, velocity 100)
    AudioEngine.playTestNote(9);
    expect(noteOnSpy).toHaveBeenLastCalledWith(9, 36, 100);
    
    // Advance timers by 800ms
    vi.advanceTimersByTime(800);
    expect(noteOffSpy).toHaveBeenLastCalledWith(9, 36);
    
    vi.useRealTimers();
  });
});
