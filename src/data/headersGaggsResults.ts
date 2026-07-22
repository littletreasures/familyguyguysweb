import { QuizResult, ResultCode } from "./headersGaggsQuiz";

export const HEADERS_GAGGS_RESULTS: Record<ResultCode, QuizResult> = {
  "G-H": {
    code: "G-H",
    name: "The Gag Hatter",
    axes: {
      taste: "Gagger",
      resolution: "Hat on a Hat"
    },
    hostMatch: "Collin Brown & 2004 Seth MacFarlane",
    body: [
      "You are pure, uninhibited comedy chaos. Story arcs, emotional stakes, and three-act narrative discipline are merely Inconvenient Distractions designed to hold back the true beauty of an eight-minute chicken fight.",
      "Not only do you live for non-sequitur cutaways and 1980s pop-culture tangents, but you insist that every bit must be immediately stacked upon by a second, even more absurd bit. If Peter Griffin falls down the stairs, you want him to land on a second set of stairs.",
      "Your spiritual sanctuary is the Cheesecake Factory menu, and your life philosophy is simple: 'I brought myself down to its level, and I was happy, dumb, and felt good.'"
    ]
  },
  "G-C": {
    code: "G-C",
    name: "The Cherry Choker",
    axes: {
      taste: "Gagger",
      resolution: "Cherry on Top"
    },
    hostMatch: "Tyler Simpson (Gagger with landing instincts)",
    body: [
      "You possess the wild, unhinged spirit of a Gagger, but you carry a secret respect for the art of landing a joke cleanly. You love a chaotic cutaway and an unscripted podcast tangent, but you demand a sharp, crisp button at the end.",
      "Having watched Family Guy broadcasts since childhood, you know that a great bit is only as good as its final punchline. You enjoy the descent into absurdity, but you smile brightest when a scene ends on the perfect vocal inflection or punchy callback.",
      "You walk the line between total anarchy and comedic discipline—happy to let the bit run wild, provided someone knows how to choke down the final cherry."
    ]
  },
  "S-H": {
    code: "S-H",
    name: "The Skyscraper Enthusiast",
    axes: {
      taste: "Structurehead",
      resolution: "Hat on a Hat"
    },
    hostMatch: "The Topher Grace Fan-Editor",
    body: [
      "You are a rare and paradoxical comedy creature: a structural perfectionist who secretly craves over-the-top bit escalation. You demand clear act breaks, organic character motivations, and tight pacing—yet when a joke starts rolling, you want it stacked to the heavens like a glass skyscraper.",
      "You admire fan recuts and tight screenwriting, but your guilty pleasure is watching a sophisticated narrative premise get derailed by a double-layered absurdity. You want Christopher Nolan pacing, but with a surprise musical sequence tacked onto the third act climax.",
      "In short: build the foundation with steel beams, but top it off with a giant neon chicken."
    ]
  },
  "S-C": {
    code: "S-C",
    name: "The Bow-Tier",
    axes: {
      taste: "Structurehead",
      resolution: "Cherry on Top"
    },
    hostMatch: "Jason Hackett (The Nolan Fundamentalist)",
    body: [
      "You sit proudly alongside Jason at the peak of structural discipline. You watch television with a screenplay outline in one hand and a stopwatch in the other. Cutaway gags are cheap crutches; real comedy comes from character conflict, setup and payoff, and tight 3-act architecture.",
      "You insist that every narrative thread introduced in Act 1 must be cleanly tied up with a neat bow in Act 3. Unresolved cliffhangers, abandoned B-stories, and random non-sequiturs cause you visible physical distress.",
      "Christopher Nolan is your personal titan of cinematic order. You set the tone, crank the hogs, and ask the hard screenwriting questions that nobody else dares to ask."
    ]
  }
};
