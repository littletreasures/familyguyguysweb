export type AnalyticsEvent =
  | { name: 'headers_gaggs_viewed' }
  | { name: 'headers_gaggs_started' }
  | { name: 'headers_gaggs_completed'; detail: { result_code: string } }
  | {
      name: 'headers_gaggs_shared';
      detail: { method: 'share_api' | 'clipboard'; result_code: string };
    }
  | { name: 'headers_gaggs_cta_clicked'; detail: { location: 'home' | 'footer' | 'direct' } };

export function trackHeadersGaggsEvent(
  eventName: AnalyticsEvent['name'],
  detail?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  const eventPayload = detail ? { detail } : {};

  // Dispatch custom window event for standard site listeners
  window.dispatchEvent(new CustomEvent(eventName, eventPayload));

  // If the site defines a global analytics helper (e.g. window.gtag, window.plausible), invoke it safely
  if (typeof (window as unknown as { gtag?: Function }).gtag === 'function') {
    (window as unknown as { gtag: Function }).gtag('event', eventName, detail || {});
  }

  // Development logger
  if (process.env.NODE_ENV === 'development' || import.meta.env?.DEV) {
    console.log(`[Analytics] ${eventName}`, detail || '');
  }
}
