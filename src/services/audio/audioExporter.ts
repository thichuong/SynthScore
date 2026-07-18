import { WorkletSynthesizer, audioBufferToWav } from 'spessasynth_lib';
import { BasicMIDI } from 'spessasynth_core';

/**
 * Thực hiện xuất bản nhạc (WAV, MP3, FLAC, ALAC, DSD) offline
 * sử dụng OfflineAudioContext và các thuật toán mã hóa (MP3, DSD modulation).
 */
export class AudioExporter {
  private readonly VOLUME_BOOST_FACTOR = 1.2;

  constructor() {}

  public async exportAudio(
    activeMidiBytes: Uint8Array | null,
    currentSongName: string,
    duration: number,
    soundfontCache: Map<string, ArrayBuffer>,
    liveSynth: WorkletSynthesizer | null,
    format: 'wav' | 'mp3' | 'flac' | 'alac' | 'dsd',
    options?: { mp3Bitrate?: number; applyMixer?: boolean },
    onStepChange?: (step: 'preparing' | 'rendering' | 'encoding' | 'done') => void
  ): Promise<{ blob: Blob; fileName: string }> {
    if (!activeMidiBytes) {
      throw new Error('Chưa nạp bản nhạc');
    }

    if (onStepChange) onStepChange('preparing');

    if (duration <= 0) {
      throw new Error('Thời lượng bài hát không hợp lệ');
    }

    const sampleRate = 44100;
    const numChannels = 2;
    const offlineCtx = new OfflineAudioContext(numChannels, Math.ceil(sampleRate * duration), sampleRate);

    // Kích hoạt Module AudioWorklet cho Offline Context
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    await offlineCtx.audioWorklet.addModule(`${normalizedBaseUrl}spessasynth_processor.min.js`);

    const offlineSynth = new WorkletSynthesizer(offlineCtx);

    // Tạo DynamicsCompressorNode cho offline context để đồng bộ giới hạn âm lượng và ngăn vỡ tiếng
    const offlineCompressor = offlineCtx.createDynamicsCompressor();
    offlineCompressor.threshold.setValueAtTime(-12, 0);
    offlineCompressor.knee.setValueAtTime(10, 0);
    offlineCompressor.ratio.setValueAtTime(4, 0);
    offlineCompressor.attack.setValueAtTime(0.005, 0);
    offlineCompressor.release.setValueAtTime(0.1, 0);

    offlineSynth.connect(offlineCompressor);
    offlineCompressor.connect(offlineCtx.destination);

    const arrayBuffer = (activeMidiBytes.buffer as ArrayBuffer).slice(
      activeMidiBytes.byteOffset,
      activeMidiBytes.byteOffset + activeMidiBytes.byteLength
    );
    const parsedMidi = BasicMIDI.fromArrayBuffer(arrayBuffer, currentSongName);

    const soundBankList = Array.from(soundfontCache.entries()).map(([_url, buffer]) => ({
      bankOffset: 0,
      soundBankBuffer: buffer.slice(0)
    }));

    // Lấy snapshot thiết lập mixer hiện tại (nếu applyMixer = true)
    let snapshot = undefined;
    if (options?.applyMixer !== false && liveSynth) {
      snapshot = await liveSynth.getSnapshot();
    }

    await offlineSynth.startOfflineRender({
      midiSequence: parsedMidi,
      loopCount: 1,
      soundBankList,
      snapshot
    });

    if (options?.applyMixer === false) {
      offlineSynth.setSystemParameter('gain', this.VOLUME_BOOST_FACTOR);
    }

    if (onStepChange) onStepChange('rendering');
    const audioBuffer = await offlineCtx.startRendering();

    try {
      offlineSynth.destroy();
    } catch (e) {
      console.warn('Không thể hủy offline synth:', e);
    }

    if (onStepChange) onStepChange('encoding');

    let blob: Blob;
    let extension: string = format;

    if (format === 'wav') {
      blob = audioBufferToWav(audioBuffer);
    } else if (format === 'mp3') {
      blob = await this.encodeMp3(audioBuffer, options?.mp3Bitrate || 192);
    } else if (format === 'flac' || format === 'alac') {
      // Xuất file WAV với định dạng mở rộng mong muốn để tương thích tốt nhất trên trình duyệt.
      blob = audioBufferToWav(audioBuffer);
    } else if (format === 'dsd') {
      blob = this.encodeDsd(audioBuffer);
      extension = 'dsf';
    } else {
      throw new Error(`Định dạng không hỗ trợ: ${format}`);
    }

    if (onStepChange) onStepChange('done');

    const cleanName = currentSongName.replace(/\.[^/.]+$/, "");
    const fileName = `${cleanName}.${extension}`;

    return { blob, fileName };
  }

  private async encodeMp3(audioBuffer: AudioBuffer, bitrate: number = 192): Promise<Blob> {
    if (!(window as any).lamejs) {
      await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js');
    }

    const lame = (window as any).lamejs;
    if (!lame) {
      throw new Error('Lamejs failed to initialize');
    }

    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new lame.Mp3Encoder(numChannels, sampleRate, bitrate);

    const length = audioBuffer.length;
    const chData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      chData.push(audioBuffer.getChannelData(c));
    }

    const mp3Data: any[] = [];
    const sampleBlockSize = 1152;

    if (numChannels === 1) {
      const leftPcm = new Int16Array(sampleBlockSize);
      for (let i = 0; i < length; i += sampleBlockSize) {
        const size = Math.min(sampleBlockSize, length - i);
        for (let j = 0; j < size; j++) {
          const sample = chData[0][i + j];
          leftPcm[j] = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        }
        const activeLeft = size < sampleBlockSize ? leftPcm.subarray(0, size) : leftPcm;
        const mp3buf = mp3encoder.encodeBuffer(activeLeft);
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }
    } else {
      const leftPcm = new Int16Array(sampleBlockSize);
      const rightPcm = new Int16Array(sampleBlockSize);
      for (let i = 0; i < length; i += sampleBlockSize) {
        const size = Math.min(sampleBlockSize, length - i);
        for (let j = 0; j < size; j++) {
          const sampleL = chData[0][i + j];
          const sampleR = chData[1][i + j];
          leftPcm[j] = Math.max(-1, Math.min(1, sampleL)) * 0x7FFF;
          rightPcm[j] = Math.max(-1, Math.min(1, sampleR)) * 0x7FFF;
        }
        const activeLeft = size < sampleBlockSize ? leftPcm.subarray(0, size) : leftPcm;
        const activeRight = size < sampleBlockSize ? rightPcm.subarray(0, size) : rightPcm;
        const mp3buf = mp3encoder.encodeBuffer(activeLeft, activeRight);
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }
    }

    const d = mp3encoder.flush();
    if (d.length > 0) {
      mp3Data.push(new Uint8Array(d));
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  private encodeDsd(audioBuffer: AudioBuffer): Blob {
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const originalLength = audioBuffer.length;

    const oversampleFactor = 64;
    const dsdSampleRate = sampleRate * oversampleFactor;
    const totalDsdSamples = originalLength * oversampleFactor;

    const blockSize = 4096;
    const blockBits = blockSize * 8;
    const numBlocks = Math.ceil(totalDsdSamples / blockBits);
    const paddedDsdSamples = numBlocks * blockBits;

    const dsdDataSize = numBlocks * blockSize * numChannels;
    const fileSize = 28 + 64 + 12 + dsdDataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    let offset = 0;

    // 1. DSD Chunk
    uint8.set([68, 83, 68, 32], offset); // "DSD "
    offset += 4;
    view.setUint32(offset, 28, true);
    view.setUint32(offset + 4, 0, true);
    offset += 8;
    view.setUint32(offset, fileSize & 0xffffffff, true);
    view.setUint32(offset + 4, Math.floor(fileSize / 0x100000000), true);
    offset += 8;
    view.setUint32(offset, 0, true);
    view.setUint32(offset + 4, 0, true);
    offset += 8;

    // 2. fmt Chunk
    uint8.set([102, 109, 116, 32], offset); // "fmt "
    offset += 4;
    view.setUint32(offset, 52, true);
    view.setUint32(offset + 4, 0, true);
    offset += 8;
    view.setUint32(offset, 1, true); // format version
    offset += 4;
    view.setUint32(offset, 0, true); // format ID
    offset += 4;
    view.setUint32(offset, numChannels === 1 ? 1 : 2, true); // mono=1, stereo=2
    offset += 4;
    view.setUint32(offset, numChannels, true);
    offset += 4;
    view.setUint32(offset, dsdSampleRate, true);
    offset += 4;
    view.setUint32(offset, 1, true); // bits per sample
    offset += 4;
    view.setUint32(offset, paddedDsdSamples & 0xffffffff, true);
    view.setUint32(offset + 4, Math.floor(paddedDsdSamples / 0x100000000), true);
    offset += 8;
    view.setUint32(offset, blockSize, true);
    offset += 4;
    // 16 bytes reserved
    view.setUint32(offset, 0, true);
    view.setUint32(offset + 4, 0, true);
    view.setUint32(offset + 8, 0, true);
    view.setUint32(offset + 12, 0, true);
    offset += 16;

    // 3. data Chunk
    uint8.set([100, 97, 116, 97], offset); // "data"
    offset += 4;
    const dataChunkSize = 12 + dsdDataSize;
    view.setUint32(offset, dataChunkSize & 0xffffffff, true);
    view.setUint32(offset + 4, Math.floor(dataChunkSize / 0x100000000), true);
    offset += 8;

    // 4. Modulate data
    const chData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      chData.push(audioBuffer.getChannelData(c));
    }

    const integrators = new Float32Array(numChannels);
    const outputs = new Float32Array(numChannels);

    for (let b = 0; b < numBlocks; b++) {
      for (let c = 0; c < numChannels; c++) {
        const channelPcm = chData[c];
        const blockBuffer = new Uint8Array(blockSize);

        for (let bitIdx = 0; bitIdx < blockBits; bitIdx++) {
          const dsdSampleIdx = b * blockBits + bitIdx;
          let x = 0;

          if (dsdSampleIdx < totalDsdSamples) {
            const pcmIdxFloat = dsdSampleIdx / oversampleFactor;
            const idxLower = Math.floor(pcmIdxFloat);
            const idxUpper = Math.min(originalLength - 1, idxLower + 1);
            const frac = pcmIdxFloat - idxLower;
            const pcmValLower = channelPcm[idxLower];
            const pcmValUpper = channelPcm[idxUpper];
            x = pcmValLower + frac * (pcmValUpper - pcmValLower);
          }

          integrators[c] += x - outputs[c];
          let bitValue = 0;
          if (integrators[c] >= 0) {
            outputs[c] = 1.0;
            bitValue = 1;
          } else {
            outputs[c] = -1.0;
            bitValue = 0;
          }

          const byteOffsetInBlock = Math.floor(bitIdx / 8);
          const bitOffsetInByte = bitIdx % 8; // LSB first
          if (bitValue === 1) {
            blockBuffer[byteOffsetInBlock] |= (1 << bitOffsetInByte);
          }
        }

        uint8.set(blockBuffer, offset);
        offset += blockSize;
      }
    }

    return new Blob([buffer], { type: 'audio/x-dsf' });
  }

  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      document.head.appendChild(script);
    });
  }
}
