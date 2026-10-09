# Design Specification: Family Guy Guys Guest Page (`/guest`)

## 1. Overview & Goal

The goal of this feature is to add a dedicated, public guest information and booking page at `https://familyguyguys.com/guest` (and `/guest/`).
The page introduces prospective guests to the show format, expectations, recording logistics, host backgrounds, and past guests, providing direct calls-to-action to book via Cal.com, email the hosts, and sign the guest release via DocuSeal.

The page strictly maintains the existing site's visual identity:
- Single-page application shell integrated into `index.html`.
- Existing color palette (`--orange`, `--teal`, `--maroon`, `--amber`, `--black`, `--off-white`).
- Existing typography (`Neue Montreal`, `Special Elite`, `Homemade Apple`).
- Halftone dotted texture (`.halftone-bg`).
- Existing host visual assets and styled cards.
- Mobile responsiveness matching existing breakpoints (768px, 480px).
- No new external CSS frameworks, token systems, or isolated HTML documents.

Per user instruction, the page link is kept **hidden** from the main desktop navigation bar and footer for now; it is accessed directly via URL (`/guest`).

---

## 2. Routing & Document Metadata

### 2.1 Route Registration (`src/router.js`)
- Add `'guest'` to `getPages()`:
  ```javascript
  guest: document.getElementById('page-guest'),
  ```
- Add route title to `ROUTE_TITLES`:
  ```javascript
  guest: 'Be a Guest | Family Guy Guys',
  ```
- Add route description to `ROUTE_DESCRIPTIONS`:
  ```javascript
  guest: 'Guest information, recording details, and booking for Family Guy Guys — three men performing the most profane act of all time: doing a podcast about the animated TV show Family Guy.',
  ```
- In `handleLocation()`:
  - Trailing slash normalization is already built-in (`/guest/` -> `/guest`).
  - Add path check:
    ```javascript
    } else if (path === '/guest') {
      activePage = 'guest';
    }
    ```
- Document metadata updates automatically via `updateMetadata('guest', path, false)`:
  - `document.title = 'Be a Guest | Family Guy Guys'`
  - `<meta name="description">`
  - `<link rel="canonical" href="https://familyguyguys.com/guest">`
  - `og:title`, `twitter:title`, `og:description`, `twitter:description`, `og:url`, `twitter:url`.

---

## 3. Page Structure & Semantic Content (`index.html`)

Inside `<main>` in `index.html`, add `<div class="page" id="page-guest">` with the following semantic sections:

### 3.1 Hero (`.guest-hero`)
- **Eyebrow:** `FAMILY GUY GUYS GUEST INFORMATION` (`.guest-eyebrow`, `Special Elite`, uppercase)
- **Primary Heading (`<h1>`):** `BE A GUEST,<br>UNFORTUNATELY.` (`.guest-hero-title`)
- **Tagline:** *"Three men performing the most profane act of all time: doing a podcast about the animated TV show Family Guy."* (`.guest-hero-tagline`)
- **Intro Copy:** *"Come watch a cartoon with us. Bring opinions, questionable memories of Fox programming, and the willingness to let one joke become everyone’s problem."* (`.guest-hero-intro`)
- **Primary CTA:**
  - Label: `BOOK A RECORDING TIME`
  - Link: `https://cal.com/fagugu` (`target="_blank" rel="noopener noreferrer"`, class `.btn-orange`)
  - Analytics location: `hero`
- **Secondary Contact:**
  - Label: `guests@familyguyguys.com`
  - Link: `mailto:guests@familyguyguys.com` (class `.email-pill`)
  - Analytics location: `hero`
- **Logistics Note:** *"Remote via Riverside. No flight to Quahog required."* (`.guest-logistics-caption`, `Special Elite`)

### 3.2 What the Show Is (`.guest-section`)
- **Heading (`<h2>`):** `A REWATCH. A HANG. A PREVENTABLE INCIDENT.`
- **Content:**
  - Paragraph 1: *"Family Guy Guys is a comedy rewatch podcast where Jason Hackett, Tyler Simpson, and Collin Brown watch every episode of Family Guy in order, clip by clip. We recap the episode, argue about the jokes, and follow whatever tangent three longtime improv-comedian friends can collectively make worse."*
  - Paragraph 2: *"Guests join the panel, not an interview hot seat. There is room to talk about your work, but mostly you are here to watch Peter Griffin make a decision and help us decide whether it was funny."*

### 3.3 Format & Logistics (`.guest-section`)
- **Heading (`<h2>`):** `FORMAT & LOGISTICS`
- **Definition List / Grid:**
  - **Format:** Three hosts, a guest, and a clip-by-clip comedy rewatch
  - **Release:** Weekly full-video episodes on YouTube and audio episodes in podcast feeds
  - **Typical episode:** Roughly 2 to 2.5 hours
  - **Shorter appearance:** Tell us your time limit. We can discuss a defined guest segment rather than a full episode
  - **Recording:** Remote via Riverside
  - **Setup:** Webcam and microphone preferred; phone camera and microphone workable. Headphones preferred
  - **Preparation:** Watch the assigned episode beforehand. No Family Guy expertise or prepared thesis required
- **Supporting Line:** *"We will provide the episode. You provide the disproportionate seriousness."*

### 3.4 Who You'll Be Recording With (`.guest-section`)
- **Heading (`<h2>`):** `WHO YOU’LL BE RECORDING WITH`
- **Intro Copy:** *"Jason, Tyler, and Collin came up together in the Dallas improv scene and have spent more than a decade performing, writing, and making each other laugh in rooms with varying levels of HVAC success."*
- **Host Grid (3 cards matching site host styling):**
  1. **Jason Hackett**
     - Image: `/hosts/jasonhost.webp` (600x600 square profile portrait)
     - Role: `HOST · PRODUCER · EDITOR`
     - Card Background: `var(--teal)`
     - Bio: *"Jason began performing at Dallas Comedy House in 2015 and has performed at Four Day Weekend, Comedy Arena McKinney, and elsewhere in North Texas. He was a main-cast performer for nine years with Improvised Horror Movie—a long-running Dallas show with roots in Chicago’s iO tradition—and has written, performed in, and directed sketch-comedy productions. These days, having children has reduced his ability to get onstage and increased his ability to spend three hours discussing Peter Griffin."*
  2. **Tyler Simpson**
     - Image: `/hosts/tylerhost.webp` (600x600 square profile portrait)
     - Role: `CO-HOST`
     - Card Background: `var(--maroon)`
     - Bio: *"Tyler came up in the Dallas Comedy House orbit alongside Jason and Collin, has performed improv and stand-up, and has since moved from D.C. to Los Angeles. He remains committed to treating a Family Guy cutaway like testimony before Congress."*
  3. **Collin Brown**
     - Image: `/hosts/collinhost.webp` (600x600 square profile portrait)
     - Role: `CO-HOST`
     - Card Background: `var(--amber)`
     - Bio: *"Collin came up in the same Dallas improv community and currently performs in the sketch program at Dallas Comedy Club, the theater now operating in the former Dallas Comedy House space. He is frequently the only person willing to defend the most indefensible premise in the room."*

### 3.5 Guest Expectations and Boundaries (`.guest-section`)
- **Heading (`<h2>`):** `PLAYFULLY HOSTILE. NOT ACTUALLY HOSTILE.`
- **Content:**
  - Paragraph 1: *"We tease each other, chase bad premises, and may ask for your opinion immediately after a clip that has aged like wet drywall. Profanity and uncomfortable jokes are part of the show. There is no polished list of interview questions."*
  - Paragraph 2: *"That does not mean you have to be game for everything. Tell us what is off limits for discussion or clips before we record. If something stops being fun in the room, say so. We are happy to cut it."*
  - Paragraph 3: *"After recording, we will ask whether you want to be added as a collaborator on short-form clips. It is optional. Coming on the show is not agreeing to become our unpaid social media department."*

### 3.6 How This Works (`.guest-section`)
- **Heading (`<h2>`):** `HOW THIS WORKS`
- **Steps Grid / Cards:**
  1. **Pick a time:** Use the booking link or email us. We will confirm the episode and how long you will join us.
  2. **Get the details:** We send the episode, Riverside link, recording time and timezone, setup notes, and guest release.
  3. **Set your boundaries:** Tell us anything that is off limits, anything you want to promote, and whether you want collaborator invites on reels.
  4. **Watch. Sign. Show up:** Watch the assigned episode and complete the release before recording. You do not need to arrive with a thesis.

### 3.7 Selected Guests (`.guest-section`)
- **Heading (`<h2>`):** `PEOPLE WHO KNEW US AND CAME ON ANYWAY`
- **Guest Images Source:** Copied from `/Volumes/RetroSSD/SSD-Family-Guy-Guys-Storage/guestimages/` into `public/guests/`:
  - `danny.png` -> `/guests/danny.png` (Danny Neely)
  - `sallie.png` -> `/guests/sallie.png` (Sallie Bowen)
  - `christian.png` -> `/guests/christian.png` (Christian Hughes)
  - `tim.png` -> `/guests/tim.png` (Tim Brewer)
  - Matty Frances: Render a card with an image slot targeting `/guests/matty.png`, displaying a styled placeholder box (`Photo Coming Soon`) until the file is placed in `public/guests/matty.png`.
- **Card Content:**
  - **Danny Neely:** Co-founder, Comedy for the Internet
  - **Sallie Bowen:** Performer, *Animal Facts* / Comedy for the Internet
  - **Christian Hughes:** Austin-based stand-up and sketch comedian
  - **Tim Brewer:** Austin-based improviser
  - **Matty Frances:** Pittsburgh-based improviser
- **Supporting Sentence:** *"Five guests across the first 16 recorded episodes. Everybody survived."*

### 3.8 Booking & Release CTA Block (`.guest-bottom-cta`)
- **Heading (`<h2>`):** `LET’S WATCH SOMETHING STUPID.`
- **Copy:** *"Bring a thing you want to plug. Tell us what you do not want to talk about. We will handle the clips and the completely unnecessary level of attention paid to a cartoon."*
- **Primary CTA:** `BOOK A RECORDING TIME` (`https://cal.com/fagugu`, `.btn-orange`, location: `bottom_cta`)
- **Secondary CTA:** `EMAIL THE GUYS` (`mailto:guests@familyguyguys.com`, `.email-pill`, location: `bottom_cta`)
- **Release Note:** *"Already booked? Complete the guest release before recording."*
  - Link Label: `COMPLETE GUEST RELEASE` (`https://docuseal.com/d/sohRPEzpxqPK3V`, location: `already_booked`)

---

## 4. CSS Architecture (`src/styles/main.css`)

Add scoped styles under `/* ===== GUEST PAGE ===== */`:
- Container `.guest-page`: max-width 1000px, margin centered, padding 2rem 1.5rem, wrapped in `.page-content` and `.halftone-bg`.
- Typography & Spacing:
  - `.guest-eyebrow`: `font-family: 'Special Elite', monospace; font-size: 0.85rem; letter-spacing: 0.15em; color: var(--orange-dark);`
  - `.guest-hero-title`: `font-family: 'Homemade Apple', cursive; font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.2;`
  - `.guest-section-title`: `font-family: 'Special Elite', monospace; font-size: clamp(1.4rem, 3vw, 2rem); text-transform: uppercase;`
- Logistics Grid:
  - Bordered definition table with alternating rows or retro border cells.
- Host Cards:
  - Reuses `.hosts-grid` and `.host-card` layout.
- Past Guests Grid:
  - 5-column responsive grid (collapsing to 2 or 1 column on mobile).
  - 1:1 aspect-ratio guest portraits with rounded corners and dark borders.
- Responsive Rules:
  - `@media (max-width: 768px)`: stack grids, adjust hero margins, ensure padding prevents horizontal overflow at 320px/375px.

---

## 5. Analytics Architecture (`src/lib/guestAnalytics.ts`)

Following `src/lib/headersGaggsAnalytics.ts`:
- Event Types:
  - `guest_page_view`
  - `guest_booking_click` (detail: `{ location: 'hero' | 'bottom_cta' }`)
  - `guest_email_click` (detail: `{ location: 'hero' | 'bottom_cta' }`)
  - `guest_release_click` (detail: `{ location: 'already_booked' }`)
- Tracking function `trackGuestEvent(eventName, detail)`:
  - Dispatches `window.dispatchEvent(new CustomEvent(eventName, { detail }))`
  - Calls `window.gtag('event', eventName, detail || {})` if `typeof window.gtag === 'function'`.
- Wire event listeners in `src/main.js` on DOM elements with data attributes or click delegation.

---

## 6. Verification & Test Plan

1. **Routing & Metadata Tests (`tests/guestRouting.test.ts`):**
   - Direct navigation to `/guest` and `/guest/` activates `#page-guest` and deactivates others.
   - Title matches `Be a Guest | Family Guy Guys`.
   - Meta description matches specified copy.
   - Canonical URL resolves to `https://familyguyguys.com/guest`.
   - OG and Twitter tags synchronize.
2. **Analytics Tests:**
   - Verify `trackGuestEvent` triggers `window.gtag` and window custom events with expected payloads.
3. **Responsive & Build Verification:**
   - Run `npm run typecheck` (tsc --noEmit).
   - Run `npm run lint` (eslint src).
   - Run `npm run test` (vitest run).
   - Run `npm run build` (vite build).
