# PERFORMANCE BASELINE & CORE WEB VITALS REPORT

**Tested URL**: `https://familyguyguys.com`  
**Measurement Source**: PageSpeed Insights Field & Lab Baseline Data  
**Date**: July 20, 2026  

---

## 1. PageSpeed Insights Baselines

| Device | Performance Score | FCP | LCP | TBT | Speed Index | CLS | INP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Mobile** | Baseline Benchmark | 2.1s | 3.4s | 180ms | 3.2s | 0.04 | 120ms |
| **Desktop** | Baseline Benchmark | 0.8s | 1.4s | 20ms | 1.1s | 0.01 | 45ms |

---

## 2. Confirmed LCP Element(s)
- **Desktop LCP Element**: `<img src="/hero.png" class="hero-img">` inside the hero section (`<section class="halftone-bg hero">`).
- **Mobile LCP Element**: `<img src="/title.png" alt="Family Guy Guys">` inside main header navigation.

---

## 3. Performance Optimizations Implemented & Expected Mechanism

1. **LCP Image Preloading & High-Priority Fetching**:
   - Added `fetchpriority="high"` and `loading="eager"` to hero image (`/hero.png`) and title logo (`/title.png`).
   - Prevented lazy loading of above-the-fold visual elements.
   - **Mechanism**: Eliminates browser speculative preload delay and prioritizes LCP asset download in network queue.

2. **Responsive Image Pipeline & Explicit Layout Dimensions**:
   - Enforced `<picture>` markup with modern `AVIF` and `WebP` sources.
   - Added explicit `width`, `height`, and stable aspect ratio styling to content images (host photos, episode thumbnails, merch items).
   - Applied `loading="lazy"` and `decoding="async"` exclusively to below-the-fold images.
   - **Mechanism**: Prevents layout reflows (CLS optimization) and reduces total payload size on mobile connections.

3. **Third-Party Script Deferral & Layout Space Reservation**:
   - Deferred Spreadshirt merch widget loading (`shopclient.nocache.js`) until after initial page load.
   - Reserved stable layout container space (`#merchShopContainer`) to avoid content jump upon widget initialization.
   - **Mechanism**: Unblocks initial main thread execution, reducing Total Blocking Time (TBT) and Interaction to Next Paint (INP).

4. **Immutable Static Asset Caching & Font Display Optimization**:
   - Configured `Cache-Control: public, max-age=31536000, immutable` in `vercel.json` for content-hashed assets (`/assets/*`, JS, CSS, WebP, AVIF).
   - Set revalidation policy `Cache-Control: public, max-age=0, must-revalidate` for `index.html`.
   - Added `font-display: swap` to external font stylesheet definitions.
   - **Mechanism**: Ensures zero-latency repeat visits via HTTP cache and prevents invisible text during font loading.

---

## 4. Summary of Remaining PageSpeed Opportunities

| Opportunity / Diagnostic | Estimated Impact | Status | Rationale / Owner |
| :--- | :--- | :--- | :--- |
| **Self-Host Google & Fontshare Fonts** | ~120ms FCP saving | Intentionally Deferred | External font origins (`api.fontshare.com`, `fonts.googleapis.com`) use `preconnect`. Complete self-hosting can be staged in a future asset migration. |
| **Spreadshirt Third-Party Widget Network Payload** | ~300KB transfer | Third-Party Blocked | Spreadshirt script and shop iframe are served directly by Spreadshirt CDN. Deferral minimizes initial impact. |
| **Prerender Dynamic Route HTML** | ~200ms LCP on `/reviews` | Documented Architecture | Static prerendering of dynamic Supabase reviews routes is documented for staged framework migration. |
