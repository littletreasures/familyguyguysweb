import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.join(__dirname, 'app.js');
const appJsCode = fs.readFileSync(appJsPath, 'utf8');

test('loadEpisodes fetches and sorts episodes in descending order', async () => {
  const mockEpisodes = [
    { episode_number: 1, title: 'Episode 1' },
    { episode_number: 3, title: 'Episode 3' },
    { episode_number: 2, title: 'Episode 2' }
  ];

  const context = {
    fetch: async (url) => {
      if (url === 'content/episodes.json') {
        return {
          json: async () => JSON.parse(JSON.stringify(mockEpisodes))
        };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    },
    document: {
      addEventListener: () => {},
      getElementById: () => null
    },
    console,
    URL,
    Date
  };

  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const episodes = await context.loadEpisodes();

  assert.strictEqual(episodes.length, 3);
  assert.strictEqual(episodes[0].episode_number, 3);
  assert.strictEqual(episodes[1].episode_number, 2);
  assert.strictEqual(episodes[2].episode_number, 1);
});

test('loadEpisodes handles empty episode list', async () => {
  const context = {
    fetch: async () => ({
      json: async () => []
    }),
    document: {
      addEventListener: () => {},
      getElementById: () => null
    },
    console,
    URL,
    Date
  };

  vm.createContext(context);
  vm.runInContext(appJsCode, context);

  const episodes = await context.loadEpisodes();
  assert.strictEqual(episodes.length, 0);
});
