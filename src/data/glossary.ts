export type GlossaryCategoryId = 'frameworks' | 'segments' | 'personas' | 'terminology' | 'aliases';

export interface EpisodeRef {
  season: number;
  episode: number;
  timestamp?: string;
  note?: string;
}

export interface GlossaryCategory {
  id: GlossaryCategoryId;
  name: string;
  emoji: string;
}

export interface GlossaryEntry {
  id: string;
  term: string;
  aka?: string;
  categoryId: GlossaryCategoryId;
  definition: string;
  origin?: EpisodeRef | null;
  references: EpisodeRef[];
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  {
    id: 'frameworks',
    name: 'Critical & Comedic Frameworks',
    emoji: '🎭',
  },
  {
    id: 'segments',
    name: 'Recurring Segments & Review Metrics',
    emoji: '📺',
  },
  {
    id: 'personas',
    name: 'Host Personas, Inside Jokes & Production Slang',
    emoji: '🎙️',
  },
  {
    id: 'terminology',
    name: 'Advanced Comedic Terminology',
    emoji: '📐',
  },
  {
    id: 'aliases',
    name: 'Host Aliases & Meta-Lore',
    emoji: '🎩',
  },
];

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    id: 'structurehead',
    term: 'Structurehead',
    categoryId: 'frameworks',
    definition:
      'A listener, host, or comedian who evaluates television comedy through the lens of classical story architecture, joke mechanics, setups, payoffs, rule of thirds, and narrative logic.',
    origin: {
      season: 1,
      episode: 7,
    },
    references: [
      {
        season: 1,
        episode: 4,
        note: 'debated heavily',
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 6,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 1,
      },
      {
        season: 2,
        episode: 2,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
        note: 'revisited/expanded',
      },
      {
        season: 2,
        episode: 7,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'gagger',
    term: 'Gagger',
    aka: 'Gaghead',
    categoryId: 'frameworks',
    definition:
      'A listener or host who prioritizes pure joke velocity, rapid-fire non-sequiturs, and random cutaways without needing them to be earned by or integrated into the main plot.',
    origin: {
      season: 1,
      episode: 7,
      note: 'coined by Tyler and guest Danny',
    },
    references: [
      {
        season: 1,
        episode: 4,
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 6,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 1,
      },
      {
        season: 2,
        episode: 2,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 7,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'hat-on-a-hat',
    term: 'Hat on a Hat vs. Cherry on Top',
    categoryId: 'frameworks',
    definition:
      'A recurring analytical debate metric measuring how a joke resolves. Hat on a Hat: adding unnecessary absurdity on top of an already ridiculous premise, breaking narrative logic. Cherry on Top: a clean, satisfying final beat that resolves the established game of a scene.',
    origin: null,
    references: [
      {
        season: 1,
        episode: 4,
        note: 'Amish horse spontaneously exploding example',
      },
    ],
  },
  {
    id: 'structurehead-head-nod',
    term: 'Structurehead Head Nod',
    aka: 'Head Nod of Approval',
    categoryId: 'frameworks',
    definition:
      'A non-verbal gesture of quiet appreciation when an episode executes clean joke mechanics or callbacks.',
    origin: null,
    references: [],
  },
  {
    id: 'stewie-gay-watch',
    term: 'Stewie Gay Watch',
    aka: 'Gay Watch',
    categoryId: 'segments',
    definition:
      "A recurring segment tracking Stewie Griffin's evolving sexuality across the series to evaluate whether the 'meter has moved.'",
    origin: {
      season: 1,
      episode: 1,
    },
    references: [
      {
        season: 1,
        episode: 1,
      },
      {
        season: 1,
        episode: 3,
      },
      {
        season: 1,
        episode: 4,
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 6,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 7,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'continuity-error-alert',
    term: 'Continuity Error Alert',
    categoryId: 'segments',
    definition:
      'A segment where the hosts call out animation mistakes in Family Guy, such as background items shifting frames or missing food on a plate.',
    origin: {
      season: 1,
      episode: 6,
    },
    references: [
      {
        season: 1,
        episode: 6,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 1,
      },
      {
        season: 2,
        episode: 2,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'breaking-guy-guys-news',
    term: 'Breaking Guy Guys News',
    aka: 'Breaking Gay Guys News',
    categoryId: 'segments',
    definition:
      'An emergency scoop segment used when the hosts uncover show revelations (e.g., Love Actually stealing a joke from Family Guy) or call out host gossip.',
    origin: {
      season: 1,
      episode: 6,
    },
    references: [
      {
        season: 1,
        episode: 6,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 7,
      },
    ],
  },
  {
    id: 'oof-of-the-ep',
    term: 'Oof of the Ep',
    aka: 'Big Oof',
    categoryId: 'segments',
    definition:
      'A segment calling out dated, hacky, or problematic jokes in Family Guy that aged poorly.',
    origin: {
      season: 2,
      episode: 5,
    },
    references: [
      {
        season: 2,
        episode: 2,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 7,
      },
      {
        season: 2,
        episode: 8,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'dud-or-stud',
    term: 'Dud or Stud',
    aka: 'includes Pud',
    categoryId: 'segments',
    definition:
      'A rapid-fire grading system for cutaway gags where a joke is deemed a Dud (flop), a Stud (winner), or a Pud (middling/so-so).',
    origin: {
      season: 1,
      episode: 7,
    },
    references: [],
  },
  {
    id: 'lisa-metrics',
    term: 'The Lisa Metrics',
    categoryId: 'segments',
    definition:
      "A mock sleep-analytics system operating on an abacus run by a woman named Lisa to track whether a listener is 'sleepy or hungry.' Birthed during a Leesa Mattress ad read.",
    origin: {
      season: 1,
      episode: 5,
      note: 'Leesa Mattress ad read',
    },
    references: [
      {
        season: 1,
        episode: 5,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'dick-cam',
    term: 'Dick Cam',
    aka: 'Sliz Cam',
    categoryId: 'personas',
    definition:
      "A visual prop comedy bit that started when Jason accidentally angled his camera downward via OBS 'Desk View.' Used to gauge host 'arousal' at specific jokes.",
    origin: {
      season: 1,
      episode: 3,
    },
    references: [
      {
        season: 1,
        episode: 3,
      },
      {
        season: 1,
        episode: 4,
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 2,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 8,
      },
    ],
  },
  {
    id: 'brians-dog-pound',
    term: "Brian's Dog Pound",
    categoryId: 'personas',
    definition:
      "Jason's self-proclaimed fan club defending Brian Griffin's character value against Tyler and Collin's claims that Brian is a 'snark factory' or a 'dud.'",
    origin: {
      season: 1,
      episode: 4,
    },
    references: [],
  },
  {
    id: 'cheesecake-factory-zone',
    term: 'The Cheesecake Factory Zone',
    categoryId: 'personas',
    definition:
      "A state of cognitive food coma where eating a heavy meal lowers a host's critical 'Structurehead' standards, dropping them into pure 'Gagger' mode.",
    origin: {
      season: 1,
      episode: 3,
    },
    references: [
      {
        season: 2,
        episode: 2,
        note: 'formalized here',
      },
    ],
  },
  {
    id: 'fix-it-in-post',
    term: 'Fix It in Post',
    aka: 'Zhuzh It Up',
    categoryId: 'personas',
    definition:
      "Jason's editor catchphrase whenever a bit derails, audio drops, or a transition fails, promising to clean or sweeten the raw tape in Logic Pro.",
    origin: null,
    references: [
      {
        season: 1,
        episode: 4,
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 6,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'were-pervert',
    term: 'Were-Pervert / Were-Transformations',
    categoryId: 'personas',
    definition:
      "A recurring coping joke where hosts blame fatigue, bad moods, or erratic behavior on being bitten by a 'were-pervert,' 'were-calculator,' or 'were-Andrew Dice Clay.'",
    origin: {
      season: 2,
      episode: 2,
    },
    references: [],
  },
  {
    id: 'council-of-dads',
    term: 'Council of Dads',
    categoryId: 'personas',
    definition:
      'A running riff referencing the short-lived 2020 NBC drama, used to mock deadpan guest dynamics or pitch absurd fatherhood teams.',
    origin: {
      season: 2,
      episode: 6,
    },
    references: [],
  },
  {
    id: 'brian-style',
    term: 'Brian Style / Going Brian Style',
    categoryId: 'personas',
    definition:
      "1. Acting like a dog or doing something socially grotesque, referencing Brian Griffin's dog habits.\n2. Making sweet tender love in the doggystyle position. You know, because Brian Griffin is a dog? It’s pretty straight forward.",
    origin: null,
    references: [
      {
        season: 2,
        episode: 1,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'family-guy-guys-guy',
    term: 'Family Guy Guys Guy',
    categoryId: 'personas',
    definition: 'A branded meta-merch concept for dedicated listeners of the podcast.',
    origin: {
      season: 2,
      episode: 3,
    },
    references: [],
  },
  {
    id: 'jpm',
    term: 'JPM (Jokes Per Minute)',
    categoryId: 'terminology',
    definition:
      "The analytical metric used to measure joke density in an episode. When joke velocity hits maximum capacity, it is referred to as 'JPM redlining.'",
    origin: null,
    references: [
      {
        season: 2,
        episode: 6,
      },
    ],
  },
  {
    id: 'diegetic-gag',
    term: 'Diegetic Gag',
    categoryId: 'terminology',
    definition:
      'A joke or cutaway that exists inside the actual physical reality/environment of the scene, rather than an unearned, non-diegetic break.',
    origin: null,
    references: [
      {
        season: 1,
        episode: 4,
      },
      {
        season: 1,
        episode: 5,
      },
      {
        season: 1,
        episode: 7,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 6,
      },
    ],
  },
  {
    id: 'bang-bang-tut-tut',
    term: 'Bang Bang vs. Tut Tut',
    categoryId: 'terminology',
    definition:
      "Review metrics for joke callbacks. Bang Bang: a joke or callback that lands two consecutive hits in quick succession. Tut Tut: a disapproving 'Structurehead' reaction to broken joke mechanics or missed third beats.",
    origin: null,
    references: [
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
  {
    id: 'gaggers-delight',
    term: "Gagger's Delight / Gagger's Gold",
    categoryId: 'terminology',
    definition:
      'The highest honor awarded to an episode or joke that achieves pure, unhinged gag perfection.',
    origin: null,
    references: [
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 7,
      },
    ],
  },
  {
    id: 'quantum-leap-scenario',
    term: 'Quantum Leap Scenario',
    categoryId: 'terminology',
    definition:
      "The analytical rule explaining Stewie's speech mechanics: the audience hears an evil British genius, but characters in the scene only hear 'goo goo gaga' based on narrative convenience.",
    origin: null,
    references: [
      {
        season: 1,
        episode: 7,
      },
    ],
  },
  {
    id: 'peener-griffin',
    term: 'Peener Griffin & Sex Mcfarland',
    categoryId: 'aliases',
    definition:
      'The official online screen handles for co-hosts Tyler (Peener Griffin) and Collin (Sex Mcfarland).',
    origin: null,
    references: [],
  },
  {
    id: 'blind-jay-leno',
    term: 'Blind Jay Leno',
    categoryId: 'aliases',
    definition:
      "An extended, recurring host impression ('Have you seen this? Have you heard about this?') that derails episode recaps into absurdist Jay Leno scenarios.",
    origin: null,
    references: [
      {
        season: 2,
        episode: 7,
      },
    ],
  },
  {
    id: 'the-blue-tent',
    term: 'The Blue Tent',
    categoryId: 'aliases',
    definition:
      'A sideline football metaphor for where players go to deal with extreme horniness or concussions mid-game.',
    origin: null,
    references: [
      {
        season: 2,
        episode: 5,
      },
    ],
  },
  {
    id: 'arbitrary-rating-units',
    term: 'Arbitrary Rating Units',
    categoryId: 'aliases',
    definition:
      "The podcast's foundational rule that episode review scores must be delivered using absurd, custom units of measurement (e.g., Cougar Mellencamps, Popes, Gigades, Clevelands).",
    origin: null,
    references: [],
  },
  {
    id: 'family-guy-guys-guys',
    term: 'Family Guy Guys Guys',
    categoryId: 'aliases',
    definition:
      'The fictional, four-hour meta-podcast where obsessive critics review every episode of Family Guy Guys.',
    origin: null,
    references: [
      {
        season: 2,
        episode: 3,
      },
    ],
  },
  {
    id: 'hit-it-brian-style',
    term: 'Hit It Brian Style',
    categoryId: 'aliases',
    definition:
      "The show's signature call-to-action urging listeners to hit the subscribe button like Brian Griffin.\nJust kidding! It means hitting it from the back a.k.a. doggystyle! Woof woof!",
    origin: null,
    references: [
      {
        season: 2,
        episode: 1,
      },
      {
        season: 2,
        episode: 3,
      },
      {
        season: 2,
        episode: 4,
      },
      {
        season: 2,
        episode: 5,
      },
      {
        season: 2,
        episode: 6,
      },
      {
        season: 2,
        episode: 9,
      },
    ],
  },
];

export const GLOSSARY_ENTRY_COUNT: number = GLOSSARY_ENTRIES.length;

export function getGlossarySortKey(term: string): string {
  return term
    .trim()
    .replace(/^the\s+/i, '')
    .trim()
    .toLowerCase();
}

export function getEntriesByCategory(categoryId: GlossaryCategoryId): GlossaryEntry[] {
  return GLOSSARY_ENTRIES.filter((entry) => entry.categoryId === categoryId).sort((a, b) => {
    const aKey = getGlossarySortKey(a.term);
    const bKey = getGlossarySortKey(b.term);
    return aKey.localeCompare(bKey, 'en', { sensitivity: 'base' });
  });
}

export function getGlossaryAlphabet(): string[] {
  const letters = new Set<string>();
  for (const entry of GLOSSARY_ENTRIES) {
    const sortKey = getGlossarySortKey(entry.term);
    if (sortKey.length > 0) {
      letters.add(sortKey.charAt(0).toUpperCase());
    }
  }
  return Array.from(letters).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}
