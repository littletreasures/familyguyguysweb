import type { QuizResult, ResultCode } from "./headersGaggsQuiz";

export const HEADERS_GAGGS_RESULTS: Record<ResultCode, QuizResult> = {
  "G-H": {
    code: "G-H",
    name: "The Gag Hatter",
    axes: {
      taste: "Gagger",
      resolution: "Hat on a Hat",
    },
    hostMatch: "Collin Brown & 2004 Seth MacFarlane",
    body: [
      "Much like the nefarious Joker himself*, you want to let chaos reign. Why let a bit of logic get in the way of an incredible bit? It's a cartoon, poindexter! You're here to laugh, not learn about Brian's pathos (that snarky little bitch).",
      "But when a gag hits and it just keeps gagging? Baby, that's a little slice of heaven. (Jay Leno*)",
    ],
  },

  "G-C": {
    code: "G-C",
    name: "The Cherry Choker",
    axes: {
      taste: "Gagger",
      resolution: "Cherry on Top",
    },
    hostMatch: "Tyler Simpson",
    body: [
      "Sure, you're a gagger, but you don't want to gag purely based on quantity or volume. No, no. You want to gag based on quality alone.",
      "The timing of your favorite gags? Impeccable. The way they heighten? Exquisite. The mouthfeel? Succulent.",
      "Give us that grade A gag, and we can overlook almost anything.",
    ],
  },

  "S-H": {
    code: "S-H",
    name: "The Skyscraper Enthusiast",
    axes: {
      taste: "Structurehead",
      resolution: "Hat on a Hat",
    },
    hostMatch: "The Topher Grace Fan-Editor",
    body: [
      "Values structure above almost everything...but sometimes you just want to let a joke heighten and heighten until it has no option but to collapse in on itself.",
      "Sure it's destructive, but that's life, baby. And there's nothing funnier than life. Right?",
      "Is that a saying?",
    ],
  },

  "S-C": {
    code: "S-C",
    name: "The Bow-Tier",
    axes: {
      taste: "Structurehead",
      resolution: "Cherry on Top",
    },
    hostMatch: "Jason Hackett",
    body: [
      "In this house, we believe:",
      "Gags come second to form.",
      "The rule of 3's is paramount.",
      "Christopher Nolan is daddy.",
      "This is a separate part of the definition because I'm respecting the rule of 3's, but we do need some sort of conclusion here.",
      "Is this the best result to receive? Hard to say. The answer is yes, but it's hard to say that because my cohosts will be mad at me.",
      "But great job.",
      "-Love, Jason",
    ],
  },
};