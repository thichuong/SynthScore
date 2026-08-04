import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useResponsive } from '../src/composables/useResponsive';
import MobileHeader from '../src/components/mobile/MobileHeader.vue';
import MobilePresentation from '../src/components/mobile/MobilePresentation.vue';
import MobileControls from '../src/components/mobile/MobileControls.vue';

describe('Mobile Web UI Architecture & Responsiveness', () => {
  it('should toggle isMobile state based on window.innerWidth', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 480 });
    const { isMobile, checkMobile } = useResponsive();
    checkMobile();
    expect(isMobile.value).toBe(true);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
    checkMobile();
    expect(isMobile.value).toBe(false);
  });

  it('should export valid Vue component objects for Mobile Web UI', () => {
    expect(MobileHeader).toBeDefined();
    expect(MobilePresentation).toBeDefined();
    expect(MobileControls).toBeDefined();

    expect(typeof MobileHeader).toBe('object');
    expect(typeof MobilePresentation).toBe('object');
    expect(typeof MobileControls).toBe('object');
  });
});
