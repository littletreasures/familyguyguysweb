import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initAudioPlayer } from '../src/audio-player.js';

function createAudioDom({ reducedMotion = false } = {}) {
  const listeners = new Map();
  const bodyClasses = new Set();

  const makeEl = (tag, extra = {}) => {
    const elListeners = new Map();
    return {
      tagName: tag,
      style: {},
      textContent: '',
      value: '0',
      disabled: false,
      attributes: new Map(),
      setAttribute(k, v) {
        this.attributes.set(k, String(v));
      },
      getAttribute(k) {
        return this.attributes.get(k) ?? null;
      },
      addEventListener(evt, fn) {
        if (!elListeners.has(evt)) elListeners.set(evt, []);
        elListeners.get(evt).push(fn);
      },
      dispatch(evt, eventObj = {}) {
        for (const fn of elListeners.get(evt) || []) fn({ target: this, ...eventObj });
      },
      ...extra,
    };
  };

  const elements = {
    'persistent-audio-player': makeEl('DIV', { style: { display: 'none' } }),
    'main-audio-element': makeEl('AUDIO', {
      paused: true,
      duration: 120,
      currentTime: 0,
      playbackRate: 1,
      src: '',
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }),
    'audio-play': makeEl('BUTTON'),
    'audio-title': makeEl('P'),
    'audio-current-time': makeEl('SPAN'),
    'audio-duration': makeEl('SPAN'),
    'audio-progress-slider': makeEl('INPUT', { value: '0', min: '0', max: '100' }),
    'audio-speed': makeEl('SELECT', { value: '1' }),
    'audio-close': makeEl('BUTTON'),
  };

  globalThis.document = {
    body: {
      classList: {
        add: (c) => bodyClasses.add(c),
        remove: (c) => bodyClasses.delete(c),
        toggle: (c, force) => (force ? bodyClasses.add(c) : bodyClasses.delete(c)),
        contains: (c) => bodyClasses.has(c),
      },
    },
    documentElement: { style: { setProperty: vi.fn() } },
    getElementById: (id) => elements[id] || null,
  };

  globalThis.window = {
    matchMedia: vi.fn().mockReturnValue({ matches: reducedMotion }),
    AudioContext: vi.fn(function MockAudioContext() {
      return {
        state: 'running',
        resume: vi.fn(),
        destination: {},
        createAnalyser: () => ({
          fftSize: 64,
          frequencyBinCount: 32,
          connect: vi.fn(),
          getByteFrequencyData: vi.fn(),
        }),
        createMediaElementSource: vi.fn(() => ({ connect: vi.fn() })),
      };
    }),
  };

  globalThis.localStorage = {
    store: new Map(),
    getItem(k) {
      return this.store.get(k) ?? null;
    },
    setItem(k, v) {
      this.store.set(k, v);
    },
    removeItem(k) {
      this.store.delete(k);
    },
  };

  globalThis.requestAnimationFrame = vi.fn();

  return { elements, listeners };
}

describe('Persistent Audio Player', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('seeks audio via #audio-progress-slider and manages body.has-audio-player class', () => {
    const { elements } = createAudioDom();
    initAudioPlayer();

    globalThis.window.playEpisode('S01E01 — Death Has a Shadow', 'https://example.com/ep1.mp3');
    expect(elements['persistent-audio-player'].style.display).toBe('block');
    expect(document.body.classList.contains('has-audio-player')).toBe(true);
    expect(elements['audio-play'].getAttribute('aria-label')).toBe('Pause');

    elements['audio-progress-slider'].value = '50';
    elements['audio-progress-slider'].dispatch('input');
    expect(elements['main-audio-element'].currentTime).toBe(60);

    elements['audio-close'].dispatch('click');
    expect(elements['persistent-audio-player'].style.display).toBe('none');
    expect(document.body.classList.contains('has-audio-player')).toBe(false);
  });

  it('does not start visualizer RAF loop under prefers-reduced-motion: reduce', () => {
    createAudioDom({ reducedMotion: true });
    initAudioPlayer();

    globalThis.window.playEpisode('S01E01 — Death Has a Shadow', 'https://example.com/ep1.mp3');
    expect(globalThis.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
