import { ref, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue';

export function useResponsive(breakpoint = 768) {
  const isMobile = ref(false);

  function checkMobile() {
    if (typeof window !== 'undefined') {
      isMobile.value = window.innerWidth <= breakpoint;
    }
  }

  if (typeof window !== 'undefined') {
    checkMobile();
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
