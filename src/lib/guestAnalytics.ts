export type GuestAnalyticsEvent =
  | { name: 'guest_page_view' }
  | { name: 'guest_booking_click'; detail: { location: 'hero' | 'bottom_cta' } }
  | { name: 'guest_email_click'; detail: { location: 'hero' | 'bottom_cta' } }
  | { name: 'guest_release_click'; detail: { location: 'already_booked' } };

export function trackGuestEvent(
  eventName: GuestAnalyticsEvent['name'],
  detail?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  const eventPayload = detail ? { detail } : {};

  // Dispatch custom window event
  window.dispatchEvent(new CustomEvent(eventName, eventPayload));

  // Forward to gtag if available
  if (typeof (window as unknown as { gtag?: Function }).gtag === 'function') {
    (window as unknown as { gtag: Function }).gtag('event', eventName, detail || {});
  }

  // Development logging
  if (process.env.NODE_ENV === 'development' || import.meta.env?.DEV) {
    console.log(`[Guest Analytics] ${eventName}`, detail || '');
  }
}
