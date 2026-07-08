const vm = require('vm');
const fs = require('fs');
const assert = require('assert');
const path = require('path');

// 1. Read the app.js code - using path to allow running from any directory
const appJsPath = path.join(__dirname, 'app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

// 2. Mock environment variables and functions
const domNodes = {};
const mockEpisodes = [
  { episode_number: 1, date: '2023-01-01T00:00:00Z', title: 'Ep 1', description: 'Desc 1', youtube_link: 'link1', thumbnail: 'thumb1' },
  { episode_number: 2, date: '2023-01-02T00:00:00Z', title: 'Ep 2', description: 'Desc 2', youtube_link: 'link2', thumbnail: 'thumb2' },
  { episode_number: 3, date: '2023-01-03T00:00:00Z', title: 'Ep 3', description: 'Desc 3', youtube_link: 'link3', thumbnail: 'thumb3' },
  { episode_number: 4, date: '2023-01-04T00:00:00Z', title: 'Ep 4', description: 'Desc 4', youtube_link: 'link4', thumbnail: 'thumb4' },
];

const sandbox = {
  document: {
    addEventListener: (event, cb) => {
      if (event === 'DOMContentLoaded') {
        sandbox.DOMContentLoadedCb = cb;
      }
    },
    getElementById: (id) => {
      // Allow for specific tests where we want the DOM node to be missing
      if (domNodes[id] === null) {
          return null;
      }
      if (!domNodes[id]) {
        domNodes[id] = { innerHTML: '' };
      }
      return domNodes[id];
    }
  },
  fetch: async (url) => {
    return {
      json: async () => [...mockEpisodes]
    }
  },
  Date: Date,
  String: String,
  console: console
};

// 3. Load the code into the sandbox
vm.createContext(sandbox);
vm.runInContext(appJsCode, sandbox);

// 4. Test suites
async function runTests() {
  console.log('🧪 Running tests for app.js...\n');

  console.log('Testing loadEpisodes()...');
  const episodes = await sandbox.loadEpisodes();
  assert.strictEqual(episodes.length, 4, 'Should load all mock episodes');
  assert.strictEqual(episodes[0].episode_number, 4, 'Episodes should be sorted descending by episode_number');
  assert.strictEqual(episodes[3].episode_number, 1, 'Last episode should be the first one numerically');
  console.log('✅ loadEpisodes() passed.\n');

  console.log('Testing episodeCard()...');
  const cardHtml = sandbox.episodeCard(episodes[0]); // episode 4
  assert(cardHtml.includes('Episode #004 of 461'), 'Should format episode number with leading zeros and total');
  assert(cardHtml.includes('"Ep 4"'), 'Should include title');
  assert(cardHtml.includes('457 left'), 'Should calculate remaining episodes correctly');
  assert(cardHtml.includes('thumb4'), 'Should include thumbnail url');
  assert(cardHtml.includes('link4'), 'Should include youtube link');
  assert(cardHtml.includes('Desc 4'), 'Should include description');
  console.log('✅ episodeCard() passed.\n');

  console.log('Testing renderHomeEpisodes()...');
  // First test successful rendering
  await sandbox.renderHomeEpisodes();
  assert(domNodes['episodes-grid'].innerHTML.includes('Episode #004 of 461'), 'Grid should contain the 4th episode');
  assert(domNodes['episodes-grid'].innerHTML.includes('Episode #002 of 461'), 'Grid should contain the 2nd episode');
  assert(!domNodes['episodes-grid'].innerHTML.includes('Episode #001 of 461'), 'Grid should NOT contain the 1st episode, as slice is 0 to 3');

  // Next test with a missing DOM element
  domNodes['episodes-grid'] = null; // simulate missing element
  try {
      await sandbox.renderHomeEpisodes();
      // If it reaches here, it handled missing element gracefully (by returning early)
      assert.strictEqual(domNodes['episodes-grid'], null);
  } catch (e) {
      assert.fail('renderHomeEpisodes should return early if grid does not exist.');
  }
  domNodes['episodes-grid'] = { innerHTML: '' }; // reset
  console.log('✅ renderHomeEpisodes() passed.\n');

  console.log('Testing renderAllEpisodes()...');
  await sandbox.renderAllEpisodes();
  assert(domNodes['all-episodes-grid'].innerHTML.includes('Episode #001 of 461'), 'Grid should contain all episodes, including the 1st one');
  assert(domNodes['all-episodes-grid'].innerHTML.includes('Episode #004 of 461'), 'Grid should contain all episodes, including the 4th one');

  domNodes['all-episodes-grid'] = null;
  try {
      await sandbox.renderAllEpisodes();
      assert.strictEqual(domNodes['all-episodes-grid'], null);
  } catch (e) {
      assert.fail('renderAllEpisodes should return early if grid does not exist.');
  }
  domNodes['all-episodes-grid'] = { innerHTML: '' }; // reset
  console.log('✅ renderAllEpisodes() passed.\n');

  console.log('Testing DOMContentLoaded listener...');
  domNodes['episodes-grid'].innerHTML = '';
  domNodes['all-episodes-grid'].innerHTML = '';

  if (sandbox.DOMContentLoadedCb) {
    await sandbox.DOMContentLoadedCb();
    // Wait a tick for promises inside the callback to resolve
    await new Promise(resolve => setTimeout(resolve, 10));
    assert(domNodes['episodes-grid'].innerHTML.length > 0, 'Should have rendered home episodes');
    assert(domNodes['all-episodes-grid'].innerHTML.length > 0, 'Should have rendered all episodes');
    console.log('✅ DOMContentLoaded listener passed.\n');
  } else {
    assert.fail('DOMContentLoaded event listener was not registered.');
  }

  console.log('All tests passed successfully! ✨');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
