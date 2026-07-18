/**
 * Hỗ trợ đồng bộ hóa trạng thái phát nhạc và siêu dữ liệu
 * với API Media Session của hệ điều hành.
 */
export class MediaSessionManager {
  constructor() {}

  // Thiết lập Metadata bản nhạc (Title, Artist, Album, Artwork)
  public updateMediaSession(currentSongName: string, currentComposer: string): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }

    const nav = window.navigator as any;

    if (typeof (window as any).MediaMetadata !== 'undefined') {
      try {
        nav.mediaSession.metadata = new (window as any).MediaMetadata({
          title: currentSongName || 'Bản nhạc không tên',
          artist: currentComposer || 'SynthScore',
          album: 'SynthScore Web Player',
          artwork: [
            { src: new URL('/favicon.svg', window.location.href).href, sizes: 'any', type: 'image/svg+xml' }
          ]
        });
      } catch (e) {
        console.warn('Lỗi khi thiết lập MediaMetadata:', e);
      }
    }
  }

  // Đăng ký các Action Handlers với Media Session API
  public setActionHandlers(handlers: {
    play: () => void;
    pause: () => void;
    stop: () => void;
    seekBackward: (offset: number) => void;
    seekForward: (offset: number) => void;
    seekTo: (time: number) => void;
  }): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }

    const nav = window.navigator as any;
    try {
      nav.mediaSession.setActionHandler('play', handlers.play);
      nav.mediaSession.setActionHandler('pause', handlers.pause);
      nav.mediaSession.setActionHandler('stop', handlers.stop);
      nav.mediaSession.setActionHandler('seekbackward', (details: any) => {
        handlers.seekBackward(details.seekOffset || 10);
      });
      nav.mediaSession.setActionHandler('seekforward', (details: any) => {
        handlers.seekForward(details.seekOffset || 10);
      });
      nav.mediaSession.setActionHandler('seekto', (details: any) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          handlers.seekTo(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('Lỗi khi thiết lập mediaSession action handlers:', e);
    }
  }

  // Cập nhật vị trí phát nhạc hiện tại
  public updateMediaSessionPositionState(duration: number, playbackRate: number, currentTime: number): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }

    const nav = window.navigator as any;
    if (typeof nav.mediaSession.setPositionState === 'function') {
      try {
        nav.mediaSession.setPositionState({
          duration: Math.max(0, duration || 0),
          playbackRate: Math.max(0.0625, playbackRate || 1.0),
          position: Math.max(0, Math.min(duration || 0, currentTime || 0))
        });
      } catch (e) {
        console.warn('Lỗi khi setPositionState cho mediaSession:', e);
      }
    }
  }

  // Thiết lập trạng thái phát (playing | paused | none)
  public setPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (typeof window === 'undefined' || !('mediaSession' in window.navigator)) {
      return;
    }
    const nav = window.navigator as any;
    nav.mediaSession.playbackState = state;
  }
}
