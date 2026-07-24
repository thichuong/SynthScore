import { vi } from 'vitest';

// 1. Mock Web Audio API classes
class MockAudioContext {
  state = 'suspended';
  destination = {};
  createAnalyser() {
    return {
      fftSize: 256,
      connect: vi.fn(),
    };
  }
  createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  resume = vi.fn().mockImplementation(async () => {
    (this as any).state = 'running';
  });
}
(MockAudioContext as any).prototype.audioWorklet = {
  addModule: vi.fn().mockResolvedValue(undefined),
};

class MockOfflineAudioContext {
  destination = {};
  constructor(public numChannels: number, public length: number, public sampleRate: number) {}
  createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  startRendering = vi.fn().mockImplementation(async () => {
    return {
      sampleRate: this.sampleRate,
      numberOfChannels: this.numChannels,
      length: this.length,
      duration: this.length / this.sampleRate,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(this.length)),
    };
  });
}
(MockOfflineAudioContext as any).prototype.audioWorklet = {
  addModule: vi.fn().mockResolvedValue(undefined),
};

// Assign globally
(globalThis as any).AudioContext = MockAudioContext;
(globalThis as any).OfflineAudioContext = MockOfflineAudioContext;
if (typeof window !== 'undefined') {
  (window as any).AudioContext = MockAudioContext;
  (window as any).OfflineAudioContext = MockOfflineAudioContext;
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
    startOfflineRender = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
    getSnapshot = vi.fn().mockResolvedValue({
      midiChannels: [],
      keyMappings: [],
      midiParameters: {},
      lockedMIDIParameters: {},
      systemParameters: {},
      reverbProcessor: {},
      chorusProcessor: {},
      delayProcessor: {},
      insertionProcessor: {}
    });
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
    audioBufferToWav: vi.fn().mockReturnValue(new Blob(['fake wav'], { type: 'audio/wav' })),
  };
});

let mockUserSettings = {
  masterVolume: 100,
  playbackRate: 1.0,
  repeatMode: 'off' as 'off' | 'all' | 'one'
};

// 3. Mock appCache to avoid DB issues in test environment
vi.mock('../src/services/appCache', () => {
  return {
    getCachedSong: vi.fn().mockResolvedValue(null),
    cacheSong: vi.fn().mockResolvedValue(undefined),
    getCachedSoundfont: vi.fn().mockResolvedValue(null),
    cacheSoundfont: vi.fn().mockResolvedValue(undefined),
    loadUserSettings: vi.fn().mockImplementation(async () => ({ ...mockUserSettings })),
    saveUserSettings: vi.fn().mockImplementation(async (newSettings: any) => {
      mockUserSettings = { ...mockUserSettings, ...newSettings };
    }),
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

