---
name: Family Guy Guys
description: Chronological Family Guy rewatch podcast archive styled as a halftone comic zine and ink-stamped review ledger.
colors:
  broadcast-tangerine: "#e8841a"
  burnt-sienna: "#7a2b0f"
  collin-teal: "#1a6b6b"
  collin-teal-deep: "#0f3f3f"
  tyler-maroon: "#5c1a1a"
  jason-amber: "#aa6200"
  screen-static-blue: "#8ecfdb"
  studio-pink: "#ff72c7"
  warm-newsprint: "#f5f4f0"
  paper-white: "#ffffff"
  zine-ink: "#1a1a1a"
  rating-gold: "#fbbf24"
  glossary-lavender: "#a164eb"
  glossary-azure: "#63d2ff"
  glossary-gold: "#ffca36"
  glossary-blush: "#f7bfcc"
typography:
  display:
    fontFamily: "Hit and Run, Neue Montreal, Helvetica Neue, sans-serif"
    fontSize: "clamp(2.2rem, 5.5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Hit and Run, Neue Montreal, Helvetica Neue, sans-serif"
    fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.01em"
  title:
    fontFamily: "Neue Montreal, Helvetica Neue, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Neue Montreal, Helvetica Neue, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "Neue Montreal, Helvetica Neue, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.broadcast-tangerine}"
    textColor: "{colors.zine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 22px"
  button-primary-hover:
    backgroundColor: "{colors.burnt-sienna}"
    textColor: "{colors.paper-white}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.zine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 22px"
  button-secondary-teal:
    backgroundColor: "{colors.collin-teal}"
    textColor: "{colors.paper-white}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 22px"
  card-surface:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.zine-ink}"
    rounded: "{rounded.md}"
    padding: "20px"
  card-featured:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.zine-ink}"
    rounded: "{rounded.lg}"
    padding: "40px"
  input-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.zine-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  chip-episode:
    backgroundColor: "{colors.screen-static-blue}"
    textColor: "{colors.zine-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "3px 9px"
  nav-bar:
    backgroundColor: "{colors.warm-newsprint}"
    textColor: "{colors.zine-ink}"
    height: "60px"
    padding: "0 32px"
---

# Design System: Family Guy Guys

## Overview

**Creative North Star: "The Halftone Zine Archive"**

The *Family Guy Guys* design system marries the punch of an independent comic zine with the clean scannability of a chronological rewatch ledger. Across the main podcast hub, the React reviews ledger, the Headers-Gaggs personality test, the guest booking page, and the prerendered glossary, surfaces sit on a warm newsprint canvas overlaid with a fine halftone dot screen (`6px` grid at `0.13` opacity). Crisp `2px`–`3px` ink borders (`#1a1a1a`), hard zero-blur drop shadows, and bold `Hit and Run` page headlines turn episode logs, host ratings, and lore entries into tactile printed artifacts rather than generic podcast cards.

The system's voice is tactile, irreverent, and ink-stamped. It intentionally rejects sterile SaaS minimalism and glossy dark-mode streaming clones in favor of crisp daylight paper, saturated comic-strip color blocks, and unified neobrutalist controls set in `Neue Montreal`. Three distinct host colors—Collin's deep teal, Tyler's oxblood maroon, and Jason's studio amber—anchor reviews and co-host commentary across every route while keeping primary calls to action anchored in broadcast tangerine.

**Key Characteristics:**
- Warm newsprint halftone backdrop (`#f5f4f0` with `6px` dot screen) across primary landing and archive pages.
- Hybrid two-font voice: expressive `Hit and Run` for top-level page and section display headings, paired with crisp `Neue Montreal` across all card titles, body copy, navigation, buttons, and metadata labels.
- Unified Zine Ink (`#1a1a1a`) `2px`–`3px` borders with hard, unblurred offset drop shadows (`2px` to `6px`) that physically depress on click.
- Host-coded color identity (`#1a6b6b`, `#5c1a1a`, `#aa6200`) and category-coded glossary cards that separate comedic lore at a glance.

## Colors

A warm newsprint base carries saturated print-shop primaries, a cool screen-static sky accent, unified `#1a1a1a` ink, `#ff72c7` studio pink highlights, and dedicated color coding for the three hosts and five glossary lore categories.

### Primary
- **Broadcast Tangerine** (`#e8841a`): Primary call-to-action fills across every route (`Listen Now`, `All episodes`, `Clear Search`, `Watch`, quiz progress fills, and active hover borders).
- **Burnt Sienna** (`#7a2b0f`): Hover fill for Broadcast Tangerine primary buttons, eyebrow labels, and episode number metadata stamps (`S1E01`).

### Secondary
- **Collin Teal** (`#1a6b6b`) / **Collin Teal Deep** (`#0f3f3f`): Collin Brown's host card and review badge background, teal secondary action buttons (`Read Review`), social icon circles, and breadcrumb link states.
- **Screen Static Blue** (`#8ecfdb`): Full-bleed section backdrops for the merch shelf and Guest "What the Show Is" callout, plus interactive glossary category pill hovers and episode chips.
- **Rating Gold** (`#fbbf24`): Star-rating highlights, review rating badges, and `Published` status tags.

### Tertiary
- **Tyler Maroon** (`#5c1a1a`): Tyler Simpson's host card and review badge color, plus heavy comic display titles.
- **Jason Amber** (`#aa6200`): Jason Hackett's host card and review badge color, plus quiz intro badges.
- **Studio Pink** (`#ff72c7`): Unified pink accent for theme metadata, interactive rating range sliders, and highlight badges.
- **Glossary Category Accents** (`#a164eb` Lavender for Frameworks, `#63d2ff` Azure for Segments, `#ffca36` Gold for Personas, `#f7bfcc` Blush for Terminology, and `#f89b22` Orange for Aliases): Category-level card fills and section underline borders inside `/glossary`.

### Neutral
- **Warm Newsprint** (`#f5f4f0`): Default page canvas, fixed navigation bar, mobile drawer, persistent audio dock, and inset quiz meter boxes.
- **Paper White** (`#ffffff`): Elevated card surfaces, form inputs, secondary buttons, and active interactive containers.
- **Zine Ink** (`#1a1a1a`): Single canonical ink color across all copy, halftone dots, borders, focus rings, and hard offset drop shadows.

### Named Rules
**The Host Triad Rule.** Collin (`#1a6b6b`), Tyler (`#5c1a1a`), and Jason (`#aa6200`) always keep their assigned ink colors across host cards, review headers, and rating breakdowns; never swap or randomize host colors.
**The Single-Ink Rule.** All borders, hard shadows, and primary dark text use Zine Ink (`#1a1a1a`); never mix in `#000000` or cool slate blacks.
**The Newsprint Canvas Rule.** Global backgrounds stay on Warm Newsprint (`#f5f4f0`) with the halftone dot screen (`opacity: 0.13`) so saturated cards and `#ffffff` containers pop without glare.

## Typography

**Display & Section Banner Font:** `Hit and Run` (with `'Neue Montreal', 'Helvetica Neue', sans-serif` fallback)
**UI, Card Title, Body & Label Font:** `Neue Montreal` (with `'Helvetica Neue', sans-serif` fallback)

**Character:** Expressive comic poster lettering (`Hit and Run`) gives page heroes and top-level section banners immediate show personality, while `Neue Montreal` keeps card titles, episode synopses, navigation links, buttons, and dense metadata crisp and scannable across every viewport. Legacy `Homemade Apple` and `Special Elite` fonts are retired and should not be used in new or refactored UI.

### Hierarchy
- **Display** (`400`, `clamp(2.2rem, 5.5vw, 4rem)`, `line-height: 1.1`, `letter-spacing: 0.02em`): Top-level page titles (`h1`) and hero headers in `Hit and Run`.
- **Headline** (`400`, `clamp(1.5rem, 3.5vw, 2.25rem)`, `line-height: 1.2`, `letter-spacing: 0.01em`): Major section banners (`h2` such as `Latest Episode`, `Our Hosts`, `Official Lore`) in `Hit and Run`.
- **Title** (`700`, `1.1rem`–`1.25rem`, `line-height: 1.3`, `letter-spacing: -0.01em`): Card titles, episode row titles, glossary terms, and host names in bold `Neue Montreal`.
- **Body** (`400`–`500`, `0.9rem`–`1rem`, `line-height: 1.55`–`1.65`): Episode descriptions, review prose, and glossary definitions in `Neue Montreal`, constrained to readable line lengths (`55ch`–`75ch`).
- **Label** (`700`, `0.75rem`–`0.85rem`, `letter-spacing: 0.06em`–`0.12em`, uppercase): Navigation links, button text, season/episode codes, status tags, form labels, and metadata chips in bold `Neue Montreal`.

### Named Rules
**The Hybrid Heading Rule.** Reserve `Hit and Run` strictly for top-level page (`h1`) and major section (`h2`) display banners. Set all card titles (`h3`), navigation items, buttons, metadata stamps, and body paragraphs in `Neue Montreal` so dense archive views stay effortless to scan.
**The Retired Fonts Rule.** Do not introduce `Homemade Apple` or `Special Elite` in new components; migrate remaining legacy instances to `Hit and Run` (display) or `Neue Montreal` (UI/body) during route polish.

## Layout

Content lives inside two standardized centered reading containers offset below a fixed `60px` top navigation bar (`padding-top: 60px` on `.page-content`):
- **Narrow Reading / Quiz (`max-width: 800px`):** Headers-Gaggs quiz, focused editorial modules, and contact copy.
- **Archive Standard (`max-width: 960px`):** Episodes catalog, Prerendered Reviews, Glossary grid, and Guest booking page.
- **Full-Bleed Bands (`100%` width):** Home hero, the 3-column Host Triad strip, and full-width section callouts.

Responsive behavior standardizes on three breakpoints:
- **`640px` (`sm`):** Card grids collapse to single-column (`1fr`) stacks with tighter container padding (`1rem`–`1.5rem`) and `44px` sticky sub-nav height.
- **`768px` (`md`):** Desktop navbar links collapse into the `44px × 44px` hamburger drawer; multi-column splits (Contact, Guest two-column callouts, Host Triad, Featured Episode) stack to `1fr`.
- **`1024px` (`lg`):** Full desktop spacing, side-by-side splits, and multi-column archive grids (`auto-fill` / `2–3` columns).

Sticky sub-navigation on `/glossary` (`48px` desktop, `44px` mobile) anchors directly beneath the `60px` top bar, with `scroll-margin-top` preventing anchor headings from clipping underneath.

### Named Rules
**The Fixed Chrome Clearance Rule.** Always account for the fixed `60px` top bar (`padding-top: 60px`–`80px`), sticky sub-bars (`48px`), and the `80px` bottom persistent audio player when placing anchors or full-height layouts.
**The Shared Token Architecture Rule.** Define colors, fonts, radii, and shadows once as CSS custom properties on `:root` and map Tailwind's `@theme` in `reviews.css` to those same variables so vanilla pages and React views stay locked in sync.

## Elevation & Depth

This system uses **structural comic-print lift**: surfaces stay anchored to the halftone paper plane through crisp `2px`–`3px` solid `#1a1a1a` ink borders and hard, zero-blur offset shadows (`box-shadow: Xpx Ypx 0 #1a1a1a`). Depth signals interactivity or featured hierarchy rather than atmospheric realism. Soft Gaussian blur (`0 -4px 20px rgba(0, 0, 0, 0.08)`) appears strictly on the fixed bottom audio player dock to separate persistent playback chrome from scrolling content.

### Shadow Vocabulary
- **Micro Chip Lift** (`box-shadow: 1.5px 1.5px 0 #1a1a1a`): Inline glossary episode reference chips at rest (`2.5px 2.5px 0 #1a1a1a` on hover).
- **Badge & Input Anchor** (`box-shadow: 2px 2px 0 #1a1a1a`): Compact action buttons, small secondary buttons, status tags, and text inputs at rest.
- **Standard Card & Button Lift** (`box-shadow: 3px 3px 0 #1a1a1a`): Primary/secondary buttons, glossary cards, search bar, and guest cards at rest (`4px 4px 0 #1a1a1a` on hover).
- **Featured Panel Lift** (`box-shadow: 4px 4px 0 #1a1a1a` to `6px 6px 0 #1a1a1a`): Prerendered episode hero cards, RSS embed wrappers, Guest callout panels (`4px`–`5px`), and Headers-Gaggs quiz/CTA modules (`6px`).
- **Audio Dock Shadow** (`box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08)`): Soft upward cast shadow reserved exclusively for `.audio-player-container`.

### Named Rules
**The Press-To-Paper Rule.** Tactile buttons with hard offset shadows translate down-right on `:active` (`translate(2px, 2px)`) and drop `box-shadow: none`, simulating a physical stamp or keycap hitting the newsprint page.

## Shapes

Form language relies on ink-outlined rectangles with restrained corner rounding, reserving pills strictly for category filters, status/email badges, and progress tracks:
- **Micro Corners (`4px` radius):** Nav link hover frames, episode/status badges, inline episode chips, small buttons, and code pills.
- **Control Corners (`6px` radius):** Canonical primary and secondary buttons, form inputs, episode thumbnails, and portrait frames inside cards.
- **Card Corners (`8px` radius):** Standard content cards (glossary entries, featured episode thumbnails, axis cards, past guest cards, RSS embed frames, and platform icon squares).
- **Module Corners (`12px` radius):** Major feature containers (`headers-gaggs-cta-module`, quiz cards, guest show/CTA panels, merch cards).
- **Full Pill (`999px` radius) & Circle (`50%` radius):** Sticky glossary category pills, navbar `Listen Now` badge-pill, quiz/audio progress bars, circular audio transport buttons, and social icon links.

### Named Rules
**The Ink Outline Rule.** Almost every elevated shape carries a `1.5px`–`3px` solid `#1a1a1a` border (`border: 2px solid var(--black)` on buttons/cards/inputs, `3px` on feature modules and fixed dock). Never rely on subtle `1px` gray hairlines for cards.

## Components

Components are tactile, print-stamped, and punchy—built with chunky `#1a1a1a` borders, high-contrast fills, `Neue Montreal` uppercase controls, and unmistakable active press feedback.

### Buttons
- **Shape:** Crisp rectangle (`6px` radius; `4px` for small variants) with `2px solid #1a1a1a` border and `3px 3px 0 #1a1a1a` hard offset shadow.
- **Primary:** Broadcast Tangerine (`#e8841a`) fill, Zine Ink (`#1a1a1a`) uppercase `Neue Montreal` (`700` weight, `0.85rem`, `letter-spacing: 0.06em`), `0.65rem 1.4rem` padding; shifts to Burnt Sienna (`#7a2b0f`) fill with Paper White (`#ffffff`) text on hover.
- **Hover / Active / Focus:** Hover shifts fill to Burnt Sienna (`#7a2b0f`) with Paper White (`#ffffff`) text, lifts `translate(-1px, -1px)`, and expands shadow to `4px 4px 0 #1a1a1a`. Active depresses `translate(2px, 2px)` with `box-shadow: none`. Focus displays `2px solid #1a1a1a` (`outline-offset: 2px`).
- **Secondary:** Paper White (`#ffffff`) fill with Zine Ink (`#1a1a1a`) text (`#f5f4f0` hover) for neutral actions, or Collin Teal (`#1a6b6b`) fill with white text (`#0f3f3f` hover) for review/secondary show actions—sharing the exact same `6px` radius, `2px` border, and `3px 3px 0 #1a1a1a` shadow mechanics.

### Chips
- **Style:** `4px` radius (`1.5px solid #1a1a1a` border) in Screen Static Blue (`#8ecfdb`) for episode references, or `#ffffff` on colored glossary cards; `999px` pill for sticky glossary category filters; `4px` status tags in `#e2e8f0` (Backlog), `#a7f3d0` (Watched), `#c084fc` (Recorded), and `#fbbf24` (Published), all set in bold `Neue Montreal`.
- **State:** Interactive chips carry `1.5px 1.5px 0 #1a1a1a` shadow, shifting to Broadcast Tangerine (`#e8841a`) with white text or `#1a1a1a` inversion and `2.5px 2.5px 0 #1a1a1a` shadow on hover.

### Cards / Containers
- **Corner Style:** `8px` radius for standard cards (glossary entries, episode hero cards, cohost cards, past guest cards); `12px` radius for feature modules (Headers-Gaggs CTA and quiz cards, guest show panels).
- **Background:** Paper White (`#ffffff`), Warm Newsprint (`#f5f4f0`) for inset meter wells, Screen Static Blue (`#8ecfdb`) for show-overview sections, or category/host-assigned fills.
- **Shadow Strategy:** `3px 3px 0 #1a1a1a` for grid cards; `4px 4px 0 #1a1a1a` to `6px 6px 0 #1a1a1a` for hero/feature modules.
- **Border:** `2px solid #1a1a1a` on standard cards; `3px solid #1a1a1a` on featured quiz/CTA modules.
- **Internal Padding:** `1.25rem` (`20px`) on grid cards; `1.75rem`–`2.5rem` (`28px`–`40px`) on hero and feature containers.

### Inputs / Fields
- **Style:** Paper White (`#ffffff`) background, `2px solid #1a1a1a` border, `6px`–`8px` radius, `2px 2px 0 #1a1a1a` or `3px 3px 0 #1a1a1a` ink shadow, `0.75rem 1rem` padding, `Neue Montreal` (`0.875rem`–`1rem`).
- **Focus:** Shifts shadow to `4px 4px 0 #1a1a1a`, highlights border/outline in Broadcast Tangerine (`#e8841a`) or `#1a1a1a` (`outline-offset: 2px`), and tints range sliders in Studio Pink (`#ff72c7`).

### Navigation
- **Style & States:** Fixed `60px` top bar (`#f5f4f0`, `border-bottom: 2px solid #1a1a1a`) with wordmark logo left, uppercase `Neue Montreal` `700` links center (`4px` radius, `2px` transparent border shifting to `#e8841a` on hover; solid `#1a1a1a` fill with `#f5f4f0` text when `.active`), and `Listen Now` CTA right. Below `768px`, desktop links and CTA hide in favor of a `44px × 44px` hamburger toggle opening a full-width stacked `.mobile-nav` drawer (`min-height: 44px` per link).

### Signature Component: Host Profile Triad & Persistent Audio Dock
- **Host Profile Triad (`.hosts-grid`):** Three flush edge-to-edge vertical color columns—Collin (`#1a6b6b`), Tyler (`#5c1a1a`), and Jason (`#aa6200`)—with `3:4` top-aligned host portraits, bold uppercase `Neue Montreal` names, subtle `rgba(255, 255, 255, 0.4)` hairline dividers, and a `Hit and Run` section banner.
- **Persistent Audio Dock (`.audio-player-container`):** Fixed `80px` bottom bar (`#f5f4f0`, `border-top: 3px solid #1a1a1a`, `0 -4px 20px rgba(0, 0, 0, 0.08)`) housing circular (`50%`) `38px` transport controls, a pill progress bar (`border: 2px solid #1a1a1a`, `#e8841a` fill), and a `Neue Montreal` playback-rate selector.

## Do's and Don'ts

### Do:
- **Do** use `Hit and Run` exclusively for top-level page (`h1`) and major section (`h2`) display banners, and `Neue Montreal` for all card titles, body copy, buttons, navigation, and labels.
- **Do** use the unified Glossary-style primary button (`#e8841a` fill, `6px` radius, `2px solid #1a1a1a` border, `3px 3px 0 #1a1a1a` shadow, `Neue Montreal` uppercase) across all primary interactive actions.
- **Do** standardize all ink borders, shadows, and dark text on `#1a1a1a` and all pink accents on `#ff72c7`.
- **Do** anchor layouts to the `640px` / `768px` / `1024px` breakpoints and `800px` / `960px` container widths, while enforcing `prefers-reduced-motion: reduce` and `>= 44px` mobile touch targets.

### Don't:
- **Don't** use `Homemade Apple` or `Special Elite` in new components or redesigns—those legacy fonts are deprecated.
- **Don't** mix `#000000` or off-brand pinks (`#e87dbf`, `#f472b6`) alongside `#1a1a1a` and `#ff72c7`.
- **Don't** introduce blurred atmospheric drop shadows on cards or buttons (soft shadow is reserved exclusively for the fixed bottom audio dock).
- **Don't** invent new button shapes, font pairings, or accent hues outside the established palette when updating or adding routes.
