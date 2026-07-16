import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('midiWorker', () => {
  let mockPostMessage: any;
  let originalSelf: any;

  beforeEach(() => {
    originalSelf = globalThis.self;
    mockPostMessage = vi.fn();
    (globalThis as any).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  afterEach(() => {
    (globalThis as any).self = originalSelf;
    // Clear modules cache so that worker executes its top-level code again on import
    vi.resetModules();
  });

  it('should register onmessage and process parseTracks', async () => {
    await import('../src/services/midiWorker');
    const onmessage = (globalThis.self as any).onmessage;
    expect(onmessage).toBeTypeOf('function');

    // Create a mock MIDI buffer
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    const track = midi.addTrack();
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 1 });
    const buffer = midi.toArray().buffer;

    onmessage({
      data: {
        id: 'id-1',
        type: 'parseTracks',
        payload: buffer,
      },
    } as any);

    expect(mockPostMessage).toHaveBeenCalled();
    const result = mockPostMessage.mock.calls[0][0];
    expect(result.id).toBe('id-1');
    expect(result.success).toBe(true);
    expect(result.payload.length).toBe(1);
    expect(result.payload[0].noteCount).toBe(1);
  });

  it('should process generateSymphony and return orchestrated MIDI bytes', async () => {
    await import('../src/services/midiWorker');
    const onmessage = (globalThis.self as any).onmessage;

    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    const track = midi.addTrack();
    track.addNote({ midi: 64, time: 0, duration: 0.5 });
    const bytes = new Uint8Array(midi.toArray());

    onmessage({
      data: {
        id: 'id-2',
        type: 'generateSymphony',
        payload: bytes,
      },
    } as any);

    expect(mockPostMessage).toHaveBeenCalled();
    const result = mockPostMessage.mock.calls[0][0];
    expect(result.id).toBe('id-2');
    expect(result.success).toBe(true);
    
    // Verifying it has been transformed (should contain 11 tracks)
    const resultMidi = new Midi(result.payload.buffer);
    expect(resultMidi.tracks.length).toBe(11);
  });

  it('should handle errors gracefully and postMessage failure response', async () => {
    await import('../src/services/midiWorker');
    const onmessage = (globalThis.self as any).onmessage;

    // Send generateSymphony with null to force a crash inside the worker
    onmessage({
      data: {
        id: 'id-3',
        type: 'generateSymphony',
        payload: null,
      },
    } as any);

    expect(mockPostMessage).toHaveBeenCalled();
    const result = mockPostMessage.mock.calls[0][0];
    expect(result.id).toBe('id-3');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
