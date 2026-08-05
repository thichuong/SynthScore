import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue';

/**
 * Kiểm tra thiết bị là Mobile View hay Desktop View dựa trên User Agent / Device View Mode của trình duyệt,
 * thay vì phụ thuộc vào kích thước màn hình.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // 1. Kiểm tra qua Client Hints API (Chrome, Edge, Opera, v.v.)
  const navData = (navigator as any).userAgentData;
  if (navData && typeof navData.mobile === 'boolean') {
    return navData.mobile;
  }

  // 2. Fallback kiểm tra User Agent Regex (Safari, Firefox, v.v.)
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
}

export function useResponsive() {
  const isMobile = ref(isMobileDevice());

  function checkMobile() {
    isMobile.value = isMobileDevice();
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      window.addEventListener('orientationchange', checkMobile);
    });

    onBeforeUnmount(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkMobile);
        window.removeEventListener('orientationchange', checkMobile);
      }
    });
  }

  return {
    isMobile,
    checkMobile
  };
}

