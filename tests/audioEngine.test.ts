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

  it('should integrate with Media Session API', async () => {
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

  it('should set Media Session metadata correctly when loading a song', async () => {
    const nav = navigator as any;
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 60, time: 0, duration: 1 });
    const midiBytes = new Uint8Array(midi.toArray());

    await AudioEngine.loadSong(midiBytes, 'Test Song', 'Test Composer');

    expect(nav.mediaSession.metadata).toBeDefined();
    expect(nav.mediaSession.metadata.metadata).toEqual(expect.objectContaining({
      title: 'Test Song',
      artist: 'Test Composer',
      album: 'SynthScore Web Player'
    }));
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

  describe('exportAudio', () => {
    beforeEach(async () => {
      // Đặt lại trạng thái để test độc lập
      (AudioEngine as any).isInitialized = false;
      (AudioEngine as any).isReady = false;
      await AudioEngine.init();

      // Nạp một bài hát giả lập để chạy export
      const midi = new Midi();
      const track = midi.addTrack();
      track.addNote({ midi: 60, time: 0, duration: 1 });
      const midiBytes = new Uint8Array(midi.toArray());
      await AudioEngine.loadSong(midiBytes, 'Export Test Song');
    });

    it('should export audio to WAV successfully', async () => {
      const stepChanges: string[] = [];
      const result = await AudioEngine.exportAudio('wav', { applyMixer: true }, (step) => {
        stepChanges.push(step);
      });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('audio/wav');
      expect(result.fileName).toBe('Export Test Song.wav');
      expect(stepChanges).toEqual(['preparing', 'rendering', 'encoding', 'done']);
    });

    it('should export audio to MP3 successfully', async () => {
      // Giả lập thư viện lamejs để tránh tải mạng trong lúc chạy test
      const mockMp3Buffer = new Uint8Array([1, 2, 3]);
      const mockEncoder = {
        encodeBuffer: vi.fn().mockReturnValue(mockMp3Buffer),
        flush: vi.fn().mockReturnValue(new Uint8Array([])),
      };
      (window as any).lamejs = {
        Mp3Encoder: vi.fn().mockImplementation(function(this: any) {
          return mockEncoder;
        }),
      };

      const result = await AudioEngine.exportAudio('mp3', { mp3Bitrate: 320, applyMixer: true });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('audio/mp3');
      expect(result.fileName).toBe('Export Test Song.mp3');

      delete (window as any).lamejs;
    });

    it('should export audio to DSD (DSF) successfully', async () => {
      const result = await AudioEngine.exportAudio('dsd', { applyMixer: true });

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('audio/x-dsf');
      expect(result.fileName).toBe('Export Test Song.dsf');
    });

    it('should export audio to FLAC and ALAC successfully using WAV fallback', async () => {
      const flacResult = await AudioEngine.exportAudio('flac');
      expect(flacResult.blob).toBeDefined();
      expect(flacResult.fileName).toBe('Export Test Song.flac');

      const alacResult = await AudioEngine.exportAudio('alac');
      expect(alacResult.blob).toBeDefined();
      expect(alacResult.fileName).toBe('Export Test Song.alac');
    });
  });
});
