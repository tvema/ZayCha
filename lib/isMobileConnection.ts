/**
 * Utility to detect mobile devices and mobile network connections.
 * In environments where mobile carriers block or throttle WebSockets,
 * the application switches to 100% pure HTTPS REST communication.
 */
export function isMobileConnection(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check for manual override in storage
    const forced = localStorage.getItem('force_http_mode');
    if (forced === 'true') return true;
    if (forced === 'false') return false;
  } catch (e) {
    // Ignore storage errors
  }

  // 2. User-Agent detection for mobile operating systems / browsers
  const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|silk|fennec|tizen/i.test(ua);

  // 3. Screen dimensions and touch support characteristic of mobile devices
  const isSmallScreen = window.innerWidth <= 840;
  const isTouchDevice = (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && isSmallScreen;

  // 4. Network Information API check for mobile cellular connections (4G/LTE/3G/2G)
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const isCellular = conn && (conn.type === 'cellular' || ['slow-2g', '2g', '3g', '4g'].includes(conn.effectiveType));

  return isMobileUA || isTouchDevice || !!isCellular;
}
