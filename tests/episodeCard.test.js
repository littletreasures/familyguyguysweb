import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const appJsPath = path.resolve('assets/app.js');
let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Ensure TOTAL_EPISODES is accessible in the context by changing const to var
appJsContent = appJsContent.replace('const TOTAL_EPISODES', 'var TOTAL_EPISODES');

const context = {
  document: {
    getElementById: () => null,
    addEventListener: () => {}
  },
  window: {},
  console: console,
  fetch: () => Promise.resolve({ json: () => Promise.resolve([]) }),
  String: String,
  Date: Date,
};

vm.createContext(context);
vm.runInContext(appJsContent, context);

const { episodeCard, TOTAL_EPISODES } = context;

describe('episodeCard', () => {
  test('renders correctly for a standard episode', () => {
    const ep = {
      episode_number: 10,
      title: 'Test Episode',
      date: '2023-01-01',
      youtube_link: 'https://youtube.com/test',
      thumbnail: 'assets/test.png',
      description: 'Test description'
    };

    const html = episodeCard(ep);

    assert.ok(html.includes('Episode #010'), 'Should include padded episode number');
    assert.ok(html.includes('Test Episode'), 'Should include title');
    assert.ok(html.includes('Jan 1, 2023'), 'Should include formatted date');
    assert.ok(html.includes('Test description'), 'Should include description');
    assert.ok(html.includes('https://youtube.com/test'), 'Should include YouTube link');
    assert.ok(html.includes('assets/test.png'), 'Should include thumbnail URL');

    const remaining = TOTAL_EPISODES - ep.episode_number;
    assert.ok(html.includes(`${remaining} left`), 'Should include correct countdown');

    // Structural checks
    assert.ok(html.includes('class="episode-card"'), 'Should have episode-card class');
    assert.ok(html.includes('class="episode-thumb"'), 'Should have episode-thumb class');
    assert.ok(html.includes('class="episode-body"'), 'Should have episode-body class');
    assert.ok(html.includes('class="episode-title"'), 'Should have episode-title class');
  });

  test('handles episode #1 edge case (padding and countdown)', () => {
    const ep = {
      episode_number: 1,
      title: 'Pilot',
      date: '2023-01-01',
      youtube_link: 'https://youtube.com/1',
      thumbnail: 'assets/1.png',
      description: 'The beginning'
    };

    const html = episodeCard(ep);
    assert.ok(html.includes('Episode #001'), 'Should pad to 3 digits');
    const remaining = TOTAL_EPISODES - 1;
    assert.ok(html.includes(`${remaining} left`), 'Should have correct remaining count');
  });

  test('handles last episode edge case', () => {
    const ep = {
      episode_number: TOTAL_EPISODES,
      title: 'The End',
      date: '2023-01-01',
      youtube_link: 'https://youtube.com/end',
      thumbnail: 'assets/end.png',
      description: 'The final countdown'
    };

    const html = episodeCard(ep);
    assert.ok(html.includes('0 left'), 'Should show 0 left for the last episode');
    assert.ok(html.includes(`Episode #${TOTAL_EPISODES}`), 'Should show correct episode number');
  });
});
