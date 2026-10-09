import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackGuestEvent } from '../src/lib/guestAnalytics';

describe('Guest Analytics Module', () => {
  beforeEach(() => {
    const mockGtag = vi.fn();
    const mockWindow = Object.assign(new EventTarget(), {
      gtag: mockGtag,
    });
    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('gtag', mockGtag);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('dispatches custom window event and calls window.gtag for guest_page_view', () => {
    const handler = vi.fn();
    window.addEventListener('guest_page_view', handler);

    trackGuestEvent('guest_page_view');

    expect(handler).toHaveBeenCalled();
    expect((window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag).toHaveBeenCalledWith(
      'event',
      'guest_page_view',
      {}
    );
  });

  it('dispatches event with detail for CTA clicks', () => {
    const handler = vi.fn();
    window.addEventListener('guest_booking_click', handler);

    trackGuestEvent('guest_booking_click', { location: 'hero' });

    expect(handler).toHaveBeenCalled();
    expect((window as unknown as { gtag: ReturnType<typeof vi.fn> }).gtag).toHaveBeenCalledWith(
      'event',
      'guest_booking_click',
      { location: 'hero' }
    );
  });
});
