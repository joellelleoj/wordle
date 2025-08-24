/**
 * Device and browser detection utilities
 */

export const deviceUtils = {
  /**
   * Check if device supports vibration
   */
  supportsVibration(): boolean {
    return "vibrate" in navigator;
  },

  /**
   * Check if device is mobile
   */
  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  },

  /**
   * Check if device is tablet
   */
  isTablet(): boolean {
    return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
  },

  /**
   * Check if device is desktop
   */
  isDesktop(): boolean {
    return !this.isMobile() && !this.isTablet();
  },

  /**
   * Get device orientation
   */
  getOrientation(): "portrait" | "landscape" {
    return window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  },

  /**
   * Check if device supports touch
   */
  supportsTouch(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },

  /**
   * Get viewport dimensions
   */
  getViewport(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },

  /**
   * Check if device prefers reduced motion
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  /**
   * Check if device is in standalone mode (PWA)
   */
  isStandalone(): boolean {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  },

  /**
   * Check if browser supports Web Share API
   */
  supportsWebShare(): boolean {
    return "share" in navigator && "canShare" in navigator;
  },

  /**
   * Check if browser supports clipboard API
   */
  supportsClipboard(): boolean {
    return "clipboard" in navigator && "writeText" in navigator.clipboard;
  },

  /**
   * Check if browser supports service workers
   */
  supportsServiceWorker(): boolean {
    return "serviceWorker" in navigator;
  },
};
