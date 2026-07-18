/**
 * Quản lý khởi tạo AudioContext và cấu hình các node âm thanh chính (compressor, analyser).
 */
export class AudioContextManager {
  private audioContext: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  public compressor: DynamicsCompressorNode | null = null;
  public isInitialized = false;

  constructor() {}

  public getContext(): AudioContext | null {
    return this.audioContext;
  }

  public async init(): Promise<AudioContext> {
    if (this.audioContext) return this.audioContext;

    this.isInitialized = true;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx();

    // Mở khóa AudioContext sớm trên tương tác người dùng
    const unlockAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(e => console.warn('Lỗi khi resume AudioContext:', e));
      }
      window.removeEventListener('click', unlockAudio, true);
      window.removeEventListener('touchstart', unlockAudio, true);
    };
    window.addEventListener('click', unlockAudio, true);
    window.addEventListener('touchstart', unlockAudio, true);

    // Đăng ký AudioWorklet Processor từ thư mục public
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    await this.audioContext.audioWorklet.addModule(`${normalizedBaseUrl}spessasynth_processor.min.js`);

    // Cấu hình Analyser để trực quan hóa
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;

    // Khởi tạo DynamicsCompressorNode làm Limiter để tránh vỡ tiếng
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.audioContext.currentTime);
    this.compressor.knee.setValueAtTime(10, this.audioContext.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.audioContext.currentTime);
    this.compressor.attack.setValueAtTime(0.005, this.audioContext.currentTime);
    this.compressor.release.setValueAtTime(0.1, this.audioContext.currentTime);

    return this.audioContext;
  }

  public resumeContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.warn('Lỗi khi resume AudioContext:', e));
    }
  }
}
