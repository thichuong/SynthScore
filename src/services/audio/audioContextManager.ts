/**
 * Quản lý khởi tạo AudioContext và cấu hình các node âm thanh chính (compressor, analyser).
 */
export class AudioContextManager {
  private audioContext: AudioContext | null = null;
  public analyser: AnalyserNode | null = null;
  public compressor: DynamicsCompressorNode | null = null;
  private initPromise: Promise<AudioContext> | null = null;
  public isInitialized = false;

  constructor() {}

  public getContext(): AudioContext | null {
    return this.audioContext;
  }

  public async init(): Promise<AudioContext> {
    if (this.isInitialized && this.audioContext) return this.audioContext;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();

        // Mở khóa AudioContext sớm trên tương tác người dùng
        const unlockAudio = () => {
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(e => console.warn('Lỗi khi resume AudioContext:', e));
          }
          window.removeEventListener('click', unlockAudio, true);
          window.removeEventListener('touchstart', unlockAudio, true);
        };
        window.addEventListener('click', unlockAudio, true);
        window.addEventListener('touchstart', unlockAudio, true);

        // Đăng ký AudioWorklet Processor từ thư mục public
        const baseUrl = import.meta.env.BASE_URL || '/';
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
        await ctx.audioWorklet.addModule(`${normalizedBaseUrl}spessasynth_processor.min.js`);

        // Cấu hình Analyser để trực quan hóa
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;

        // Khởi tạo DynamicsCompressorNode làm Limiter để tránh vỡ tiếng
        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-12, ctx.currentTime);
        this.compressor.knee.setValueAtTime(10, ctx.currentTime);
        this.compressor.ratio.setValueAtTime(4, ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.005, ctx.currentTime);
        this.compressor.release.setValueAtTime(0.1, ctx.currentTime);

        this.audioContext = ctx;
        this.isInitialized = true;
        return ctx;
      } catch (error) {
        this.isInitialized = false;
        this.audioContext = null;
        this.analyser = null;
        this.compressor = null;
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  public resumeContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.warn('Lỗi khi resume AudioContext:', e));
    }
  }
}
