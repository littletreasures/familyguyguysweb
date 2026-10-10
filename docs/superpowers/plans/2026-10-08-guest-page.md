# Guest Page (`/guest`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new, responsive public guest-information and booking page at `/guest` on `familyguyguys.com` that seamlessly integrates into the site's vanilla SPA architecture, visual style, routing, metadata, and analytics.

**Architecture:** Vanilla SPA integration with route resolution in `src/router.js`, page container `#page-guest` in `index.html`, scoped styling in `src/styles/main.css`, custom analytics helper in `src/lib/guestAnalytics.ts` wired in `src/main.js`, and host/guest imagery in `public/hosts` and `public/guests`.

**Tech Stack:** Vanilla JavaScript/HTML5, CSS3, TypeScript (`src/lib/guestAnalytics.ts`), Vite, Vitest.

## Global Constraints

- Route URL: `/guest` and normalized `/guest/`.
- Title: `Be a Guest | Family Guy Guys`.
- Meta description: `Guest information, recording details, and booking for Family Guy Guys — three men performing the most profane act of all time: doing a podcast about the animated TV show Family Guy.`
- Nav link: Hidden from top desktop navigation, mobile drawer, and footer for now (accessible directly via URL).
- Host assets: Use `/hosts/jasonhost.webp`, `/hosts/tylerhost.webp`, `/hosts/collinhost.webp`.
- Guest assets: Copy `christian.png`, `danny.png`, `sallie.png`, `tim.png` from `/Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/guestimages/` into `public/guests/`; provide placeholder for `Matty Frances` until `matty.png` is added.
- No new external frameworks, CDN links, design tokens, or isolated HTML files.
- All external links require `target="_blank" rel="noopener noreferrer"`.
- Cal.com link: `https://cal.com/fagugu`.
- Guest email link: `mailto:guests@familyguyguys.com`.
- Guest release link: `https://docuseal.com/d/sohRPEzpxqPK3V`.
- Per `.agents/AGENTS.md`: Do not commit, deploy, or push without explicit approval. Report all verification commands.

---

### Task 1: Asset Preparation & Guest Analytics Module

**Files:**
- Create: `public/guests/` (copy `christian.png`, `danny.png`, `sallie.png`, `tim.png`)
- Create: `src/lib/guestAnalytics.ts`
- Test: `tests/guestAnalytics.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type GuestAnalyticsEvent =
    | { name: 'guest_page_view' }
    | { name: 'guest_booking_click'; detail: { location: 'hero' | 'bottom_cta' } }
    | { name: 'guest_email_click'; detail: { location: 'hero' | 'bottom_cta' } }
    | { name: 'guest_release_click'; detail: { location: 'already_booked' } };

  export function trackGuestEvent(
    eventName: GuestAnalyticsEvent['name'],
    detail?: Record<string, unknown>
  ): void;
  ```

- [ ] **Step 1: Copy guest images from storage directory to `public/guests/`**

Run shell command:
```bash
mkdir -p public/guests && cp /Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/guestimages/*.png public/guests/
```

- [ ] **Step 2: Write failing unit test for `guestAnalytics`**

Write `tests/guestAnalytics.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackGuestEvent } from '../src/lib/guestAnalytics';

describe('Guest Analytics Module', () => {
  beforeEach(() => {
    vi.stubGlobal('gtag', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/guestAnalytics.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/guestAnalytics'".

- [ ] **Step 4: Implement `src/lib/guestAnalytics.ts`**

Write `src/lib/guestAnalytics.ts`:
```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/guestAnalytics.test.ts`
Expected: PASS (2 tests passing).

---

### Task 2: Router Integration & Metadata Synchronization

**Files:**
- Modify: `src/router.js:1-45, 175-225`
- Test: `tests/guestRouting.test.ts`

**Interfaces:**
- Consumes: `src/router.js` router functions (`navigateTo`, `initRouter`)
- Produces: Route handling for `/guest` and `/guest/` activating `#page-guest`, setting document title to `Be a Guest | Family Guy Guys` and meta description.

- [ ] **Step 1: Write failing unit test for `/guest` routing**

Write `tests/guestRouting.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initRouter, navigateTo } from '../src/router.js';

describe('Guest Route Resolution', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav class="nav-links">
        <a href="/" id="nav-home">Home</a>
      </nav>
      <main>
        <div class="page active" id="page-home"></div>
        <div class="page" id="page-guest"></div>
      </main>
      <meta name="description" content="Initial description">
    `;
    window.history.replaceState({}, '', '/');
    initRouter();
  });

  it('renders #page-guest directly on fresh startup at /guest without prior in-app navigation', () => {
    // Reset DOM and simulate direct initial browser load at /guest
    document.body.innerHTML = `
      <nav class="nav-links">
        <a href="/" id="nav-home">Home</a>
      </nav>
      <main>
        <div class="page active" id="page-home"></div>
        <div class="page" id="page-guest"></div>
      </main>
      <meta name="description" content="Initial description">
    `;
    window.history.replaceState({}, '', '/guest');
    initRouter();

    const guestPage = document.getElementById('page-guest');
    const homePage = document.getElementById('page-home');
    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(homePage?.classList.contains('active')).toBe(false);
    expect(window.location.pathname).toBe('/guest');
    expect(document.title).toBe('Be a Guest | Family Guy Guys');
  });

  it('navigates to /guest, activates #page-guest and sets document metadata', () => {
    navigateTo('/guest');

    const guestPage = document.getElementById('page-guest');
    const homePage = document.getElementById('page-home');
    const metaDesc = document.querySelector('meta[name="description"]');

    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(homePage?.classList.contains('active')).toBe(false);
    expect(document.title).toBe('Be a Guest | Family Guy Guys');
    expect(metaDesc?.getAttribute('content')).toContain('Guest information, recording details, and booking');
  });

  it('normalizes trailing slash /guest/ to /guest and activates page', () => {
    navigateTo('/guest/');

    const guestPage = document.getElementById('page-guest');
    expect(guestPage?.classList.contains('active')).toBe(true);
    expect(window.location.pathname).toBe('/guest');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/guestRouting.test.ts`
Expected: FAIL because `guest` is not yet registered in `getPages()`, `ROUTE_TITLES`, or `handleLocation()`.

- [ ] **Step 3: Update `src/router.js` to register `guest`**

In `src/router.js`:
1. In `getPages()`:
   Add `guest: document.getElementById('page-guest'),`
2. In `ROUTE_TITLES`:
   Add `guest: 'Be a Guest | Family Guy Guys',`
3. In `ROUTE_DESCRIPTIONS`:
   Add `guest: 'Guest information, recording details, and booking for Family Guy Guys — three men performing the most profane act of all time: doing a podcast about the animated TV show Family Guy.',`
4. In `handleLocation()`:
   Add route matching:
   ```javascript
   } else if (path === '/guest') {
     activePage = 'guest';
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/guestRouting.test.ts`
Expected: PASS (2 tests passing).

---

### Task 3: HTML Markup for `#page-guest` in `index.html`

**Files:**
- Modify: `index.html` (inside `<main>` right after `#page-contact`)

- [ ] **Step 1: Add semantic HTML structure for `#page-guest`**

Inside `<main>` in `index.html`, add:
```html
  <!-- ===== GUEST PAGE ===== -->
  <div class="page" id="page-guest">
    <div class="page-content halftone-bg guest-page-wrapper">
      <div class="guest-container">

        <!-- 1. HERO -->
        <section class="guest-hero">
          <div class="guest-eyebrow">FAMILY GUY GUYS GUEST INFORMATION</div>
          <h1 class="guest-hero-title">BE A GUEST,<br>UNFORTUNATELY.</h1>
          <p class="guest-hero-tagline">Three men performing the most profane act of all time: doing a podcast about the animated TV show Family Guy.</p>
          <p class="guest-hero-intro">Come watch a cartoon with us. Bring opinions, questionable memories of Fox programming, and the willingness to let one joke become everyone’s problem.</p>
          <div class="guest-hero-actions">
            <a href="https://cal.com/fagugu" target="_blank" rel="noopener noreferrer" class="btn-orange guest-cta-booking" data-analytics-location="hero">BOOK A RECORDING TIME</a>
            <a href="mailto:guests@familyguyguys.com" class="email-pill guest-cta-email" data-analytics-location="hero">guests@familyguyguys.com</a>
          </div>
          <p class="guest-logistics-caption">Remote via Riverside. No flight to Quahog required.</p>
        </section>

        <!-- 2. WHAT THE SHOW IS -->
        <section class="guest-section guest-show-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">A REWATCH. A HANG. A PREVENTABLE INCIDENT.</h2>
          </div>
          <div class="guest-two-col">
            <p>Family Guy Guys is a comedy rewatch podcast where Jason Hackett, Tyler Simpson, and Collin Brown watch every episode of Family Guy in order, clip by clip. We recap the episode, argue about the jokes, and follow whatever tangent three longtime improv-comedian friends can collectively make worse.</p>
            <p>Guests join the panel, not an interview hot seat. There is room to talk about your work, but mostly you are here to watch Peter Griffin make a decision and help us decide whether it was funny.</p>
          </div>
        </section>

        <!-- 3. FORMAT AND LOGISTICS -->
        <section class="guest-section guest-logistics-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">FORMAT AND LOGISTICS</h2>
          </div>
          <dl class="guest-logistics-list">
            <div class="guest-logistics-item">
              <dt>Format</dt>
              <dd>Three hosts, a guest, and a clip-by-clip comedy rewatch</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Release</dt>
              <dd>Weekly full-video episodes on YouTube and audio episodes in podcast feeds</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Typical episode</dt>
              <dd>Roughly 2 to 2.5 hours</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Shorter appearance</dt>
              <dd>Tell us your time limit. We can discuss a defined guest segment rather than a full episode</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Recording</dt>
              <dd>Remote via Riverside</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Setup</dt>
              <dd>Webcam and microphone preferred; phone camera and microphone workable. Headphones preferred</dd>
            </div>
            <div class="guest-logistics-item">
              <dt>Preparation</dt>
              <dd>Watch the assigned episode beforehand. No Family Guy expertise or prepared thesis required</dd>
            </div>
          </dl>
          <p class="guest-supporting-note">We will provide the episode. You provide the disproportionate seriousness.</p>
        </section>

        <!-- 4. HOSTS -->
        <section class="guest-section guest-hosts-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">WHO YOU’LL BE RECORDING WITH</h2>
            <p class="guest-hosts-intro">Jason, Tyler, and Collin came up together in the Dallas improv scene and have spent more than a decade performing, writing, and making each other laugh in rooms with varying levels of HVAC success.</p>
          </div>
          <div class="hosts-grid guest-hosts-grid">
            <div class="host-card">
              <img src="/hosts/jasonhost.webp" alt="Jason Hackett" class="host-photo" width="400" height="400" loading="lazy">
              <div class="host-name">Jason Hackett</div>
              <div class="guest-host-role">HOST · PRODUCER · EDITOR</div>
              <div class="host-divider"></div>
              <div class="host-bio">Jason began performing at Dallas Comedy House in 2015 and has performed at Four Day Weekend, Comedy Arena McKinney, and elsewhere in North Texas. He was a main-cast performer for nine years with Improvised Horror Movie—a long-running Dallas show with roots in Chicago’s iO tradition—and has written, performed in, and directed sketch-comedy productions. These days, having children has reduced his ability to get onstage and increased his ability to spend three hours discussing Peter Griffin.</div>
            </div>
            <div class="host-card">
              <img src="/hosts/tylerhost.webp" alt="Tyler Simpson" class="host-photo" width="400" height="400" loading="lazy">
              <div class="host-name">Tyler Simpson</div>
              <div class="guest-host-role">CO-HOST</div>
              <div class="host-divider"></div>
              <div class="host-bio">Tyler came up in the Dallas Comedy House orbit alongside Jason and Collin, has performed improv and stand-up, and has since moved from D.C. to Los Angeles. He remains committed to treating a Family Guy cutaway like testimony before Congress.</div>
            </div>
            <div class="host-card">
              <img src="/hosts/collinhost.webp" alt="Collin Brown" class="host-photo" width="400" height="400" loading="lazy">
              <div class="host-name">Collin Brown</div>
              <div class="guest-host-role">CO-HOST</div>
              <div class="host-divider"></div>
              <div class="host-bio">Collin came up in the same Dallas improv community and currently performs in the sketch program at Dallas Comedy Club, the theater now operating in the former Dallas Comedy House space. He is frequently the only person willing to defend the most indefensible premise in the room.</div>
            </div>
          </div>
        </section>

        <!-- 5. GUEST EXPECTATIONS AND BOUNDARIES -->
        <section class="guest-section guest-boundaries-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">PLAYFULLY HOSTILE. NOT ACTUALLY HOSTILE.</h2>
          </div>
          <div class="guest-text-block">
            <p>We tease each other, chase bad premises, and may ask for your opinion immediately after a clip that has aged like wet drywall. Profanity and uncomfortable jokes are part of the show. There is no polished list of interview questions.</p>
            <p>That does not mean you have to be game for everything. Tell us what is off limits for discussion or clips before we record. If something stops being fun in the room, say so. We are happy to cut it.</p>
            <p>After recording, we will ask whether you want to be added as a collaborator on short-form clips. It is optional. Coming on the show is not agreeing to become our unpaid social media department.</p>
          </div>
        </section>

        <!-- 6. GUEST PROCESS -->
        <section class="guest-section guest-process-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">HOW THIS WORKS</h2>
          </div>
          <div class="guest-process-grid">
            <div class="guest-process-card">
              <div class="guest-step-badge">1</div>
              <h3 class="guest-step-title">Pick a time</h3>
              <p class="guest-step-desc">Use the booking link or email us. We will confirm the episode and how long you will join us.</p>
            </div>
            <div class="guest-process-card">
              <div class="guest-step-badge">2</div>
              <h3 class="guest-step-title">Get the details</h3>
              <p class="guest-step-desc">We send the episode, Riverside link, recording time and timezone, setup notes, and guest release.</p>
            </div>
            <div class="guest-process-card">
              <div class="guest-step-badge">3</div>
              <h3 class="guest-step-title">Set your boundaries</h3>
              <p class="guest-step-desc">Tell us anything that is off limits, anything you want to promote, and whether you want collaborator invites on reels.</p>
            </div>
            <div class="guest-process-card">
              <div class="guest-step-badge">4</div>
              <h3 class="guest-step-title">Watch. Sign. Show up.</h3>
              <p class="guest-step-desc">Watch the assigned episode and complete the release before recording. You do not need to arrive with a thesis.</p>
            </div>
          </div>
        </section>

        <!-- 7. SELECTED GUESTS -->
        <section class="guest-section guest-past-guests-section">
          <div class="guest-section-header">
            <h2 class="guest-section-title">PEOPLE WHO KNEW US AND CAME ON ANYWAY</h2>
          </div>
          <div class="guest-cards-grid">
            <div class="guest-past-card">
              <img src="/guests/danny.png" alt="Danny Neely" class="guest-portrait" width="300" height="300" loading="lazy">
              <div class="guest-card-name">Danny Neely</div>
              <div class="guest-card-cred">Co-founder, Comedy for the Internet</div>
            </div>
            <div class="guest-past-card">
              <img src="/guests/sallie.png" alt="Sallie Bowen" class="guest-portrait" width="300" height="300" loading="lazy">
              <div class="guest-card-name">Sallie Bowen</div>
              <div class="guest-card-cred">Performer, <em>Animal Facts</em> / Comedy for the Internet</div>
            </div>
            <div class="guest-past-card">
              <img src="/guests/christian.png" alt="Christian Hughes" class="guest-portrait" width="300" height="300" loading="lazy">
              <div class="guest-card-name">Christian Hughes</div>
              <div class="guest-card-cred">Austin-based stand-up and sketch comedian</div>
            </div>
            <div class="guest-past-card">
              <img src="/guests/tim.png" alt="Tim Brewer" class="guest-portrait" width="300" height="300" loading="lazy">
              <div class="guest-card-name">Tim Brewer</div>
              <div class="guest-card-cred">Austin-based improviser</div>
            </div>
            <div class="guest-past-card">
              <div class="guest-portrait-placeholder" role="img" aria-label="Matty Frances portrait placeholder">
                <span class="guest-placeholder-text">Photo Coming Soon</span>
              </div>
              <div class="guest-card-name">Matty Frances</div>
              <div class="guest-card-cred">Pittsburgh-based improviser</div>
            </div>
          </div>
          <p class="guest-supporting-note">Five guests across the first 16 recorded episodes. Everybody survived.</p>
        </section>

        <!-- 8. BOOKING AND RELEASE SECTION -->
        <section class="guest-section guest-bottom-cta">
          <h2 class="guest-cta-title">LET’S WATCH SOMETHING STUPID.</h2>
          <p class="guest-cta-desc">Bring a thing you want to plug. Tell us what you do not want to talk about. We will handle the clips and the completely unnecessary level of attention paid to a cartoon.</p>
          <div class="guest-bottom-actions">
            <a href="https://cal.com/fagugu" target="_blank" rel="noopener noreferrer" class="btn-orange guest-cta-booking" data-analytics-location="bottom_cta">BOOK A RECORDING TIME</a>
            <a href="mailto:guests@familyguyguys.com" class="email-pill guest-cta-email" data-analytics-location="bottom_cta">EMAIL THE GUYS</a>
          </div>
          <div class="guest-release-block">
            <p class="guest-release-note">Already booked? Complete the guest release before recording.</p>
            <a href="https://docuseal.com/d/sohRPEzpxqPK3V" target="_blank" rel="noopener noreferrer" class="guest-release-btn" data-analytics-location="already_booked">COMPLETE GUEST RELEASE</a>
          </div>
        </section>

      </div>
    </div>
  </div>
```

---

### Task 4: Scoped CSS in `src/styles/main.css`

**Files:**
- Modify: `src/styles/main.css` (append guest page styles and media query adaptations)

- [ ] **Step 1: Add scoped CSS rules to `src/styles/main.css`**

Add CSS with clean scoping under `/* ===== GUEST PAGE ===== */`:
- Layout container: `.guest-container` max-width 960px, margin auto, padding 3rem 1.5rem.
- Hero typography:
  - `.guest-eyebrow`: Special Elite, 0.85rem, uppercase, letter-spacing 0.15em, color `var(--orange-dark)`.
  - `.guest-hero-title`: Special Elite / Homemade Apple (e.g. Special Elite with font-size clamp(2.2rem, 5vw, 3.8rem), text-transform uppercase, color `var(--maroon)`).
  - `.guest-hero-tagline`: font-family `'Special Elite'`, color `var(--black)`, margin 1rem 0.
  - `.guest-hero-intro`: font-family `'Neue Montreal'`, line-height 1.6, max-width 650px.
  - `.guest-hero-actions`: flex gap 1rem, align-items center, flex-wrap wrap.
  - `.guest-logistics-caption`: Special Elite, 0.8rem, color #666.
- Sections:
  - `.guest-section`: margin-top 4rem, padding-top 2rem, border-top: 2px solid rgba(0, 0, 0, 0.1).
  - `.guest-section-title`: Special Elite, 1.4rem - 1.8rem, uppercase, letter-spacing 0.05em, color `var(--black)`.
  - `.guest-two-col`: grid 1fr 1fr, gap 2rem, font-family `'Neue Montreal'`, line-height 1.6.
- Format and logistics definition list:
  - `.guest-logistics-list`: display grid, border: 2px solid var(--black), border-radius: 8px, background: white, overflow: hidden.
  - `.guest-logistics-item`: display grid, grid-template-columns: 200px 1fr, padding: 0.9rem 1.2rem, border-bottom: 1px solid rgba(0, 0, 0, 0.1).
  - `dt`: Special Elite, uppercase, font-size 0.85rem, color `var(--orange-dark)`.
  - `dd`: Neue Montreal, font-size 0.95rem.
- Host role badge:
  - `.guest-host-role`: Special Elite, 0.75rem, letter-spacing 0.12em, opacity 0.85, margin-bottom 0.5rem.
- Process cards:
  - `.guest-process-grid`: grid 4 columns (1fr 1fr 1fr 1fr), gap 1.2rem.
  - `.guest-process-card`: border: 2px solid var(--black), border-radius: 8px, background: white, padding: 1.2rem.
  - `.guest-step-badge`: width 32px, height 32px, border-radius: 50%, background: var(--orange), color: white, display flex, align-items center, justify-content center, Special Elite font.
- Past guests:
  - Layout lock: `.guest-portrait, .guest-portrait-placeholder, .guest-hosts-grid .host-photo { aspect-ratio: 1; width: 100%; height: auto; }` to prevent cumulative layout shift.
  - `.guest-cards-grid`: grid 5 columns (repeat(auto-fit, minmax(160px, 1fr))), gap 1.2rem.
  - `.guest-past-card`: background: white, border: 2px solid var(--black), border-radius: 8px, padding: 1rem, text-align center.
  - `.guest-portrait`: width 100%, aspect-ratio: 1, object-fit cover, border-radius: 6px, border: 1px solid rgba(0,0,0,0.15).
  - `.guest-portrait-placeholder`: width 100%, aspect-ratio: 1, background: #e8e8e8, border-radius: 6px, display flex, align-items center, justify-content center, font-family 'Special Elite', font-size: 0.75rem, color: #777, text-align center, padding: 0.5rem.
  - `.guest-card-name`: Special Elite, uppercase, font-size 0.9rem, margin-top 0.8rem.
  - `.guest-card-cred`: font-size 0.8rem, color #555, line-height 1.4, margin-top 0.3rem.
- Bottom CTA block:
  - `.guest-bottom-cta`: text-align center, background: var(--off-white), border: 3px solid var(--black), border-radius: 12px, padding: 3rem 2rem.
  - `.guest-release-btn`: inline-block, background: var(--black), color: white, font-family: 'Special Elite', padding: 0.6rem 1.5rem, border-radius: 6px, text-transform: uppercase, letter-spacing: 0.1em.
- Responsive breakpoints:
  - `@media (max-width: 768px)`:
    - `.guest-two-col`: grid 1fr.
    - `.guest-logistics-item`: grid 1fr, gap 0.2rem.
    - `.guest-process-grid`: grid repeat(2, 1fr).
    - `.guest-cards-grid`: grid repeat(2, 1fr).
    - `.guest-hero-actions`, `.guest-bottom-actions`: flex-direction column, align-items stretch.
  - `@media (max-width: 480px)`:
    - `.guest-process-grid`: grid 1fr.
    - `.guest-cards-grid`: grid 1fr.

- [ ] **Step 2: Verify styles compile without errors**

Run: `npm run build`
Expected: PASS with no CSS syntax errors.

---

### Task 5: Event Wiring in `src/main.js`

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Wire guest analytics listeners in `src/main.js` (Pure JS, no TS syntax)**

Import `trackGuestEvent` and bind listeners:
```javascript
import { trackGuestEvent } from './lib/guestAnalytics.ts';

// Track page view on routechange
window.addEventListener('routechange', (e) => {
  const { page } = e.detail;
  if (page === 'guest') {
    trackGuestEvent('guest_page_view');
  }
});

// Direct load tracking on startup
if (initialPath === '/guest') {
  trackGuestEvent('guest_page_view');
}

// Bind CTA clicks on #page-guest
const guestPageContainer = document.getElementById('page-guest');
if (guestPageContainer) {
  guestPageContainer.addEventListener('click', (e) => {
    const bookingLink = e.target.closest('.guest-cta-booking');
    if (bookingLink) {
      const location = bookingLink.dataset.analyticsLocation || 'hero';
      trackGuestEvent('guest_booking_click', { location });
      return;
    }

    const emailLink = e.target.closest('.guest-cta-email');
    if (emailLink) {
      const location = emailLink.dataset.analyticsLocation || 'hero';
      trackGuestEvent('guest_email_click', { location });
      return;
    }

    const releaseLink = e.target.closest('.guest-release-btn');
    if (releaseLink) {
      trackGuestEvent('guest_release_click', { location: 'already_booked' });
      return;
    }
  });
}
```

---

### Task 6: Full Verification & Validation

**Files:**
- Verify all modified files

- [ ] **Step 1: Run vitest test suite**

Run: `npm run test`
Expected: 100% tests pass (all existing + new guest tests).

- [ ] **Step 2: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: Exit code 0, no type errors.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: Exit code 0, 0 errors.

- [ ] **Step 4: Run Vite production build**

Run: `npm run build`
Expected: Build succeeds and outputs clean `dist/`.

- [ ] **Step 5: Verify mobile responsiveness & layout boundaries**

Inspect DOM and verify no horizontal scroll at widths:
- 320px
- 375px
- 768px
- Desktop (>1024px)
Confirm external links open in new tab with `target="_blank" rel="noopener noreferrer"`.
Confirm email link uses `mailto:guests@familyguyguys.com`.
Confirm DocuSeal release link points to `https://docuseal.com/d/sohRPEzpxqPK3V`.
Confirm Cal.com link points to `https://cal.com/fagugu`.
