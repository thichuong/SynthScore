import { vi } from 'vitest';

// 1. Mock Web Audio API classes
class MockAudioContext {
  state = 'suspended';
  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };
  destination = {};
  createAnalyser() {
    return {
      fftSize: 256,
      connect: vi.fn(),
    };
  }
  resume = vi.fn().mockImplementation(async () => {
    (this as any).state = 'running';
  });
}

// Assign globally
(globalThis as any).AudioContext = MockAudioContext;
if (typeof window !== 'undefined') {
  (window as any).AudioContext = MockAudioContext;
}

// 2. Mock spessasynth_lib
vi.mock('spessasynth_lib', () => {
  class MockWorkletSynthesizer {
    connect = vi.fn();
    setSystemParameter = vi.fn();
    controllerChange = vi.fn();
    programChange = vi.fn();
    noteOn = vi.fn();
    noteOff = vi.fn();
    isReady = Promise.resolve();
    soundBankManager = {
      addSoundBank: vi.fn().mockResolvedValue(undefined),
    };
    midiChannels = Array.from({ length: 16 }, () => ({
      setSystemParameter: vi.fn(),
    }));
  }

  class MockSequencer {
    playbackRate = 1.0;
    duration = 100;
    currentTempo = 120;
    currentTime = 0;
    eventHandler = {
      addEvent: vi.fn(),
    };
    loadNewSongList = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    constructor(public synth: any) {}
  }

  return {
    WorkletSynthesizer: MockWorkletSynthesizer,
    Sequencer: MockSequencer,
  };
});

// 3. Mock appCache to avoid DB issues in test environment
vi.mock('../src/services/appCache', () => {
  return {
    getCachedSong: vi.fn().mockResolvedValue(null),
    cacheSong: vi.fn().mockResolvedValue(undefined),
    getCachedSoundfont: vi.fn().mockResolvedValue(null),
    cacheSoundfont: vi.fn().mockResolvedValue(undefined),
  };
});

// 4. Mock Media Session API & HTML5 Audio
const mockMediaSession = {
  metadata: null,
  playbackState: 'none',
  setActionHandler: vi.fn(),
  setPositionState: vi.fn(),
};

if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).navigator) {
    (globalThis as any).navigator = {};
  }
  (globalThis as any).navigator.mediaSession = mockMediaSession;
  
  (globalThis as any).MediaMetadata = class MockMediaMetadata {
    constructor(public metadata: any) {}
  };

  (globalThis as any).Audio = class MockAudio {
    loop = false;
    defaultPlaybackRate = 1.0;
    playbackRate = 1.0;
    currentTime = 0;
    duration = 1.0;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
  };
}

