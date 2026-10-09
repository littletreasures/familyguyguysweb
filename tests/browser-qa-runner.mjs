import { spawn } from 'child_process';
import http from 'http';

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.callbacks = new Map();
    this.eventListeners = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const listener of this.eventListeners) {
          listener(msg.method, msg.params);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  onEvent(fn) {
    this.eventListeners.push(fn);
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Evaluation error');
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function runBrowserQA() {
  console.log('=== STARTING BROWSER QA SUITE AGAINST LOCAL PRODUCTION BUILD ===');

  // 1. Start preview server on 4173
  console.log('[Setup] Starting vite preview server on port 4173...');
  const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'pipe',
  });

  // Wait for preview server to be responsive
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:4173/');
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!serverReady) {
    preview.kill();
    throw new Error('Vite preview server failed to start on port 4173');
  }
  console.log('[Setup] ✓ Vite preview server ready at http://localhost:4173');

  // 2. Start headless Chrome on port 9222
  console.log('[Setup] Launching Headless Google Chrome on CDP port 9222...');
  const chrome = spawn(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--user-data-dir=/tmp/chrome-fgg-qa-' + Date.now(),
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
    ],
    { stdio: 'ignore' }
  );

  let cdpReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        cdpReady = true;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!cdpReady) {
    chrome.kill();
    preview.kill();
    throw new Error('Chrome failed to start on port 9222');
  }

  const verRes = await fetch('http://127.0.0.1:9222/json/version');
  const verData = await verRes.json();
  const browserVersion = verData['Browser'];
  const userAgent = verData['User-Agent'];
  console.log(`[Setup] ✓ Browser: ${browserVersion}`);
  console.log(`[Setup] ✓ User-Agent: ${userAgent}`);

  // Find page target
  const listRes = await fetch('http://127.0.0.1:9222/json/list');
  const listData = await listRes.json();
  const pageTarget = listData.find((t) => t.type === 'page');
  if (!pageTarget) {
    throw new Error('No page target found');
  }
  const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleLogs = [];
  const consoleWarnings = [];
  const consoleErrors = [];

  cdp.onEvent((method, params) => {
    if (method === 'Runtime.consoleAPICalled') {
      const text = params.args.map((a) => a.value || a.description || '').join(' ');
      if (params.type === 'error') consoleErrors.push(text);
      else if (params.type === 'warning') consoleWarnings.push(text);
      else consoleLogs.push(text);
    } else if (method === 'Runtime.exceptionThrown') {
      consoleErrors.push(params.exceptionDetails.text + ' ' + (params.exceptionDetails.exception?.description || ''));
    }
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Console.enable');

  const results = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Hydration without warnings on Direct /glossary Load
    // ----------------------------------------------------
    console.log('\n[Test 1] Testing Hydration without warnings on Direct /glossary Load (Desktop 1280x800)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:4173/glossary' });
    await new Promise((r) => setTimeout(r, 1500)); // wait for full load & hydration

    const h1Text = await cdp.evaluate("document.querySelector('#page-glossary h1')?.textContent?.trim()");
    const categoryCount = await cdp.evaluate("document.querySelectorAll('.glossary-category-section').length");
    const entryCount = await cdp.evaluate("document.querySelectorAll('.glossary-card').length");
    const hasSearch = await cdp.evaluate("Boolean(document.getElementById('glossary-search-input'))");

    const hydrationErrors = consoleErrors.filter((e) => /hydrate|hydration|mismatch|warning/i.test(e));
    const hydrationWarnings = consoleWarnings.filter((w) => /hydrate|hydration|mismatch/i.test(w));

    const test1Passed =
      h1Text === 'Official Podcast Glossary' &&
      categoryCount === 5 &&
      entryCount === 29 &&
      hasSearch &&
      hydrationErrors.length === 0 &&
      hydrationWarnings.length === 0;

    results.push({
      test: '1. Hydration & Direct Load',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test1Passed ? 'PASS' : 'FAIL',
      details: `H1: "${h1Text}", Categories: ${categoryCount}, Entries: ${entryCount}, Hydration Errors: ${hydrationErrors.length}`,
    });
    console.log(`[Test 1 Result] ${test1Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 2: Episode-Chip Availability (Direct /glossary Load)
    // ----------------------------------------------------
    console.log('\n[Test 2] Testing Episode-Chip Availability on Direct /glossary Load...');
    const directChipData = await cdp.evaluate(`
      (() => {
        const chips = Array.from(document.querySelectorAll('.episode-chip'));
        return chips.map(c => ({
          text: c.innerText.trim(),
          isLink: c.tagName === 'A',
          href: c.getAttribute('href') || null
        }));
      })()
    `);

    const directS1E1 = directChipData.find((c) => c.text === 'S1E1');
    const directS2E2 = directChipData.find((c) => c.text === 'S2E2');
    const directS2E7 = directChipData.find((c) => c.text === 'S2E7');

    const test2Passed =
      directS1E1?.isLink === true &&
      directS1E1?.href === '/reviews/s1e1' &&
      directS2E2?.isLink === true &&
      directS2E2?.href === '/reviews/s02e02' &&
      directS2E7?.isLink === false &&
      directS2E7?.href === null;

    results.push({
      test: '2. Episode-Chip Availability (Direct Load)',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test2Passed ? 'PASS' : 'FAIL',
      details: `S1E1 link: ${directS1E1?.href}, S2E2 link: ${directS2E2?.href}, S2E7 static: ${!directS2E7?.isLink}`,
    });
    console.log(`[Test 2 Result] ${test2Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 3: Search, Alias/Definition Matching, Empty Results, Clear & Focus
    // ----------------------------------------------------
    console.log('\n[Test 3] Testing Search, Alias/Definition Matching, Empty Results, Clear & Retained Focus...');

    // Helper to simulate native React input typing
    const setInputValue = async (val) => {
      await cdp.evaluate(`
        (() => {
          const input = document.getElementById('glossary-search-input');
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, ${JSON.stringify(val)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
        })()
      `);
      await new Promise((r) => setTimeout(r, 250)); // wait for 150ms debounce
    };

    // 3a. Search alias "Zhuzh" -> should match "Fix It in Post"
    await setInputValue('Zhuzh');
    const aliasMatchTerms = await cdp.evaluate(`
      Array.from(document.querySelectorAll('.glossary-card:not([style*="display: none"]) .glossary-term'))
        .map(el => el.innerText.trim())
    `);

    // 3b. Search definition "Logic Pro" -> should match "Fix It in Post"
    await setInputValue('Logic Pro');
    const defMatchTerms = await cdp.evaluate(`
      Array.from(document.querySelectorAll('.glossary-card:not([style*="display: none"]) .glossary-term'))
        .map(el => el.innerText.trim())
    `);

    // 3c. Search "xyznotfound999" -> empty state
    await setInputValue('xyznotfound999');
    const emptyStateText = await cdp.evaluate(`
      document.querySelector('.glossary-empty-state')?.innerText?.trim() || ''
    `);
    const statusCountText = await cdp.evaluate(`
      document.querySelector('.glossary-search-status')?.innerText?.trim() || ''
    `);

    // 3d. Click Clear Search button
    await cdp.evaluate(`
      document.querySelector('.glossary-search-clear')?.click();
    `);
    await new Promise((r) => setTimeout(r, 300));
    const clearedInputVal = await cdp.evaluate(`
      document.getElementById('glossary-search-input')?.value
    `);
    const isSearchFocused = await cdp.evaluate(`
      document.activeElement === document.getElementById('glossary-search-input')
    `);
    const clearedCount = await cdp.evaluate(`
      document.querySelectorAll('.glossary-card').length
    `);

    const test3Passed =
      aliasMatchTerms.includes('Fix It in Post') &&
      defMatchTerms.includes('Fix It in Post') &&
      emptyStateText.includes('No glossary terms match') &&
      statusCountText.includes('0 of 29') &&
      clearedInputVal === '' &&
      isSearchFocused === true &&
      clearedCount === 29;

    results.push({
      test: '3. Search & Focus Retained',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test3Passed ? 'PASS' : 'FAIL',
      details: `Alias matched: ${aliasMatchTerms.join(',')}, Empty state: "${emptyStateText}", Focus retained: ${isSearchFocused}, Count restored: ${clearedCount}`,
    });
    console.log(`[Test 3 Result] ${test3Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 4: Direct Entry-Fragment Loading
    // ----------------------------------------------------
    console.log('\n[Test 4] Testing Direct Entry-Fragment Loading (#the-blue-tent)...');
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/glossary#the-blue-tent' });
    await new Promise((r) => setTimeout(r, 1500));

    const scrollYAfterDirectHash = await cdp.evaluate('window.scrollY');
    const targetCardRect = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('the-blue-tent');
        const r = el?.getBoundingClientRect();
        return r ? { top: r.top, bottom: r.bottom } : null;
      })()
    `);

    const test4Passed =
      scrollYAfterDirectHash > 100 &&
      targetCardRect &&
      targetCardRect.top >= 0 &&
      targetCardRect.top <= 250;

    results.push({
      test: '4. Direct Entry-Fragment Loading',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary#the-blue-tent',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test4Passed ? 'PASS' : 'FAIL',
      details: `scrollY: ${scrollYAfterDirectHash}, target top: ${targetCardRect?.top?.toFixed(1)}px`,
    });
    console.log(`[Test 4 Result] ${test4Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 5: Returning to Mounted Glossary with Different Fragment
    // ----------------------------------------------------
    console.log('\n[Test 5] Testing Fragment Switch on Already-Mounted Glossary (#structurehead)...');
    await cdp.evaluate("location.hash = '#structurehead'");
    await new Promise((r) => setTimeout(r, 800));

    const structCardRect = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('structurehead');
        const r = el?.getBoundingClientRect();
        return r ? { top: r.top, bottom: r.bottom } : null;
      })()
    `);
    const test5Passed =
      structCardRect &&
      structCardRect.top >= 0 &&
      structCardRect.top <= 250;

    results.push({
      test: '5. In-Page Fragment Navigation',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary#structurehead',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test5Passed ? 'PASS' : 'FAIL',
      details: `target top: ${structCardRect?.top?.toFixed(1)}px`,
    });
    console.log(`[Test 5 Result] ${test5Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 6: Revealing a Fragment Target Hidden by Search
    // ----------------------------------------------------
    console.log('\n[Test 6] Testing Revealing Fragment Target Hidden by Search...');
    // Filter by "Gagger" so "The Blue Tent" is hidden
    await setInputValue('Gagger');
    const blueTentHiddenBefore = await cdp.evaluate(`
      document.getElementById('the-blue-tent') === null
    `);

    // Navigate to #the-blue-tent
    await cdp.evaluate("location.hash = '#the-blue-tent'");
    await new Promise((r) => setTimeout(r, 800));

    const blueTentAfter = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('the-blue-tent');
        const r = el?.getBoundingClientRect();
        return {
          exists: el !== null,
          top: r ? r.top : null,
          searchQuery: document.getElementById('glossary-search-input')?.value
        };
      })()
    `);

    const test6Passed =
      blueTentHiddenBefore === true &&
      blueTentAfter.exists &&
      blueTentAfter.searchQuery === '' &&
      blueTentAfter.top !== null &&
      blueTentAfter.top >= 0 &&
      blueTentAfter.top <= 250;

    results.push({
      test: '6. Reveal Hidden Fragment on Hash Change',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary#the-blue-tent',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test6Passed ? 'PASS' : 'FAIL',
      details: `Was hidden: ${blueTentHiddenBefore}, Search cleared to: "${blueTentAfter.searchQuery}", Scrolled to top: ${blueTentAfter.top?.toFixed(1)}px`,
    });
    console.log(`[Test 6 Result] ${test6Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 7: Cross-Page SPA Navigation: Loading / then Navigating to /glossary
    // ----------------------------------------------------
    console.log('\n[Test 7] Testing Loading / and SPA-Navigating into /glossary...');
    await cdp.send('Page.navigate', { url: 'http://localhost:4173/' });
    await new Promise((r) => setTimeout(r, 1500));

    const homeTitle = await cdp.evaluate('document.title');
    const homeJsonLd = await cdp.evaluate("Boolean(document.getElementById('glossary-jsonld'))");

    // Click desktop nav link to Glossary
    await cdp.evaluate(`
      document.getElementById('nav-glossary')?.click();
    `);
    await new Promise((r) => setTimeout(r, 1200)); // wait for lazy mount

    const spaGlossaryTitle = await cdp.evaluate('document.title');
    const spaJsonLdPresent = await cdp.evaluate("Boolean(document.getElementById('glossary-jsonld'))");

    const spaChipData = await cdp.evaluate(`
      (() => {
        const chips = Array.from(document.querySelectorAll('.episode-chip'));
        return chips.map(c => ({
          text: c.innerText.trim(),
          isLink: c.tagName === 'A',
          href: c.getAttribute('href') || null
        }));
      })()
    `);

    const spaS1E1 = spaChipData.find((c) => c.text === 'S1E1');
    const spaS2E2 = spaChipData.find((c) => c.text === 'S2E2');
    const spaS2E7 = spaChipData.find((c) => c.text === 'S2E7');

    const test7Passed =
      homeJsonLd === false &&
      spaGlossaryTitle === 'Glossary — Family Guy Guys' &&
      spaJsonLdPresent === true &&
      spaS1E1?.isLink === true &&
      spaS1E1?.href === '/reviews/s1e1' &&
      spaS2E2?.isLink === true &&
      spaS2E2?.href === '/reviews/s02e02' &&
      spaS2E7?.isLink === false &&
      spaS2E7?.href === null;

    results.push({
      test: '7. SPA Navigation & Chip Parity',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary (via SPA nav from /)',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test7Passed ? 'PASS' : 'FAIL',
      details: `Home JSON-LD clean: ${!homeJsonLd}, Glossary JSON-LD present: ${spaJsonLdPresent}, Chips match: S1E1=${spaS1E1?.href}, S2E2=${spaS2E2?.href}, S2E7 static=${!spaS2E7?.isLink}`,
    });
    console.log(`[Test 7 Result] ${test7Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 8: Metadata Cleanup on Navigating Out of /glossary
    // ----------------------------------------------------
    console.log('\n[Test 8] Testing Metadata Cleanup when Navigating Out to /contact...');
    await cdp.evaluate(`
      document.querySelector('a[href="/contact"]')?.click();
    `);
    await new Promise((r) => setTimeout(r, 800));

    const contactTitle = await cdp.evaluate('document.title');
    const contactJsonLd = await cdp.evaluate("Boolean(document.getElementById('glossary-jsonld'))");

    const test8Passed =
      contactTitle === 'Contact Us — Family Guy Guys' &&
      contactJsonLd === false;

    results.push({
      test: '8. Metadata Cleanup Out of /glossary',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/contact',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test8Passed ? 'PASS' : 'FAIL',
      details: `Contact title: "${contactTitle}", Glossary JSON-LD removed: ${!contactJsonLd}`,
    });
    console.log(`[Test 8 Result] ${test8Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 9: Back / Forward Navigation
    // ----------------------------------------------------
    console.log('\n[Test 9] Testing Browser Back/Forward Navigation...');
    // Go back to /glossary
    await cdp.evaluate('history.back()');
    await new Promise((r) => setTimeout(r, 800));
    const backUrl = await cdp.evaluate('location.pathname');
    const backGlossaryActive = await cdp.evaluate("document.getElementById('page-glossary')?.classList.contains('active')");

    // Go forward to /contact
    await cdp.evaluate('history.forward()');
    await new Promise((r) => setTimeout(r, 800));
    const forwardUrl = await cdp.evaluate('location.pathname');
    const forwardContactActive = await cdp.evaluate("document.getElementById('page-contact')?.classList.contains('active')");

    // Return to /glossary for subsequent tests
    await cdp.evaluate('history.back()');
    await new Promise((r) => setTimeout(r, 800));

    const test9Passed =
      backUrl === '/glossary' &&
      backGlossaryActive === true &&
      forwardUrl === '/contact' &&
      forwardContactActive === true;

    results.push({
      test: '9. History Back/Forward Navigation',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test9Passed ? 'PASS' : 'FAIL',
      details: `Back to /glossary: active=${backGlossaryActive}, Forward to /contact: active=${forwardContactActive}`,
    });
    console.log(`[Test 9 Result] ${test9Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 10: Mobile Viewport, Sticky Offsets & Reduced Motion
    // ----------------------------------------------------
    console.log('\n[Test 10] Testing Mobile Viewport (375x667), Sticky Offsets, and Reduced Motion...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:4173/glossary#category-aliases' });
    await new Promise((r) => setTimeout(r, 1200));

    const mobileNavComputed = await cdp.evaluate(`
      (() => {
        const nav = document.querySelector('.glossary-category-nav');
        const style = window.getComputedStyle(nav);
        const card = document.querySelector('.glossary-card');
        const cardStyle = window.getComputedStyle(card);
        return {
          position: style.position,
          top: style.top,
          scrollMarginTop: cardStyle.scrollMarginTop
        };
      })()
    `);

    const mobileAliasesRect = await cdp.evaluate(`
      (() => {
        const el = document.getElementById('category-aliases');
        const r = el?.getBoundingClientRect();
        return r ? { top: r.top } : null;
      })()
    `);

    const test10Passed =
      mobileNavComputed.position === 'sticky' &&
      mobileAliasesRect !== null &&
      mobileAliasesRect.top >= 0 &&
      mobileAliasesRect.top <= 250;

    results.push({
      test: '10. Mobile Sticky Nav & Offsets',
      viewport: 'Mobile (375x667 @2x)',
      url: 'http://localhost:4173/glossary#category-aliases',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test10Passed ? 'PASS' : 'FAIL',
      details: `Sticky: ${mobileNavComputed.position}, Top: ${mobileNavComputed.top}, Scroll-Margin: ${mobileNavComputed.scrollMarginTop}, Target top: ${mobileAliasesRect?.top?.toFixed(1)}px`,
    });
    console.log(`[Test 10 Result] ${test10Passed ? 'PASS' : 'FAIL'}`);

    // ----------------------------------------------------
    // TEST 11: Keyboard-Only Traversal & Visible Focus
    // ----------------------------------------------------
    console.log('\n[Test 11] Testing Keyboard Traversal & Visible Focus (Category links, Search, Clear, Episode chips)...');

    // Reset viewport and media
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
    });

    await cdp.send('Page.navigate', { url: 'http://localhost:4173/glossary' });
    await new Promise((r) => setTimeout(r, 1200));

    async function pressTab() {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await new Promise((r) => setTimeout(r, 100));
    }

    // 11a. Search input focus
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
    await cdp.evaluate("document.getElementById('glossary-search-input')?.focus();");
    const searchFocus = await cdp.evaluate(`
      (() => {
        const el = document.activeElement;
        const s = window.getComputedStyle(el);
        return {
          id: el.id,
          hasFocus: document.hasFocus(),
          matchesFocus: el.matches(':focus'),
          matchesFocusVisible: el.matches(':focus-visible'),
          outline: s.outline,
          outlineWidth: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          borderColor: s.borderColor,
          borderTopColor: s.borderTopColor,
          boxShadow: s.boxShadow
        };
      })()
    `);

    // 11b. Type into search to reveal clear button, then Tab to Clear button
    await setInputValue('Gagger');
    await pressTab();
    const clearFocus = await cdp.evaluate(`
      (() => {
        const el = document.activeElement;
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          outline: s.outline,
          outlineWidth: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor
        };
      })()
    `);

    // 11c. Tab to category links
    await pressTab();
    const catLinkFocus = await cdp.evaluate(`
      (() => {
        const el = document.activeElement;
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          className: el.className,
          href: el.getAttribute('href'),
          outline: s.outline,
          outlineWidth: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor
        };
      })()
    `);

    // 11d. Tab to linked episode chip
    await cdp.evaluate("document.querySelector('.episode-chip-link')?.focus({ focusVisible: true });");
    const chipLinkFocus = await cdp.evaluate(`
      (() => {
        const el = document.activeElement;
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          className: el.className,
          href: el.getAttribute('href'),
          text: el.innerText.trim(),
          outline: s.outline,
          outlineWidth: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          outlineColor: s.outlineColor
        };
      })()
    `);

    const hasSearchFocusVisible = searchFocus.id === 'glossary-search-input' && (searchFocus.outlineStyle !== 'none' || searchFocus.borderColor.includes('232'));
    const hasClearFocusVisible = clearFocus.ariaLabel === 'Clear search' && clearFocus.outlineStyle !== 'none' && clearFocus.outlineWidth !== '0px';
    const hasCatLinkFocusVisible = catLinkFocus.className.includes('glossary-cat-pill') && catLinkFocus.outlineStyle !== 'none' && catLinkFocus.outlineWidth !== '0px';
    const hasChipLinkFocusVisible = chipLinkFocus.className.includes('episode-chip-link') && chipLinkFocus.outlineStyle !== 'none' && chipLinkFocus.outlineWidth !== '0px';

    const test11Passed = Boolean(hasSearchFocusVisible && hasClearFocusVisible && hasCatLinkFocusVisible && hasChipLinkFocusVisible);

    results.push({
      test: '11. Keyboard Traversal & Visible Focus',
      viewport: 'Desktop (1280x800)',
      url: 'http://localhost:4173/glossary',
      console: { errors: consoleErrors.length, warnings: consoleWarnings.length },
      outcome: test11Passed ? 'PASS' : 'FAIL',
      details: `Search outline: "${searchFocus.outline}", Clear outline: "${clearFocus.outline}", Cat link outline: "${catLinkFocus.outline}", Chip outline: "${chipLinkFocus.outline}"`,
    });
    console.log(`[Test 11 Result] ${test11Passed ? 'PASS' : 'FAIL'}`);

  } finally {
    cdp.close();
    chrome.kill();
    preview.kill();
  }

  console.log('\n=== BROWSER QA SUITE COMPLETE ===');
  console.log('Console Errors:', consoleErrors);
  console.log('Console Warnings:', consoleWarnings);
  console.table(results);

  const allPassed = results.every((r) => r.outcome === 'PASS');
  console.log(`Overall Browser QA: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  return { allPassed, browserVersion, userAgent, results, consoleErrors, consoleWarnings };
}

runBrowserQA().catch((e) => {
  console.error('Fatal Browser QA runner error:', e);
  process.exit(1);
});
