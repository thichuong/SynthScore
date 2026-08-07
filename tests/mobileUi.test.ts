import { describe, it, expect } from 'vitest';
import { useResponsive } from '../src/composables/useResponsive';
import MobileHeader from '../src/components/mobile/MobileHeader.vue';
import MobilePresentation from '../src/components/mobile/MobilePresentation.vue';
import MobileControls from '../src/components/mobile/MobileControls.vue';
import DesktopHeader from '../src/components/desktop/DesktopHeader.vue';
import DesktopPresentation from '../src/components/desktop/DesktopPresentation.vue';
import DesktopControls from '../src/components/desktop/DesktopControls.vue';
import PlaybackControls from '../src/components/controls/PlaybackControls.vue';

describe('UI Architecture & Responsiveness', () => {
  it('should toggle isMobile state based on userAgent', () => {
    Object.defineProperty(navigator, 'userAgent', { writable: true, configurable: true, value: 'iPhone' });
    const { isMobile, checkMobile } = useResponsive();
    checkMobile();
    expect(isMobile.value).toBe(true);

    Object.defineProperty(navigator, 'userAgent', { writable: true, configurable: true, value: 'Mozilla/5.0 Desktop' });
    checkMobile();
    expect(isMobile.value).toBe(false);
  });

  it('should export valid Vue component objects for Mobile and Desktop Web UI', () => {
    expect(MobileHeader).toBeDefined();
    expect(MobilePresentation).toBeDefined();
    expect(MobileControls).toBeDefined();
    expect(DesktopHeader).toBeDefined();
    expect(DesktopPresentation).toBeDefined();
    expect(DesktopControls).toBeDefined();
    expect(PlaybackControls).toBeDefined();

    expect(typeof MobileHeader).toBe('object');
    expect(typeof MobilePresentation).toBe('object');
    expect(typeof MobileControls).toBe('object');
    expect(typeof DesktopHeader).toBe('object');
    expect(typeof DesktopPresentation).toBe('object');
    expect(typeof DesktopControls).toBe('object');
    expect(typeof PlaybackControls).toBe('object');
  });
});
