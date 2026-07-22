export type Axis = "gag" | "struct" | "hat" | "cherry";
export type ResultCode = "G-H" | "G-C" | "S-H" | "S-C";

export type QuizOption = {
  id: string;
  text: string;
  scores: Partial<Record<Axis, 1 | 2 | 3>>;
};

export type QuizQuestion = {
  id: string;
  category?: string;
  prompt: string;
  options: QuizOption[];
};

export const HEADERS_GAGGS_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    category: "Cutaway Pacing",
    prompt: "You are watching a dramatic historical film, and a character suddenly breaks into an unprompted 3-minute song-and-dance about 1920s cereal brands. What is your reaction?",
    options: [
      {
        id: "q1-a",
        text: "Brilliant! Put three more pop culture tangents in this movie immediately.",
        scores: { gag: 3, hat: 2 }
      },
      {
        id: "q1-b",
        text: "Funny bit, but only if it cleanly caps off the scene and gets back to the plot.",
        scores: { gag: 2, cherry: 3 }
      },
      {
        id: "q1-c",
        text: "Mildly amusing, but it severely disrupts the narrative pacing.",
        scores: { struct: 2, cherry: 2 }
      },
      {
        id: "q1-d",
        text: "Unacceptable. Christopher Nolan would never tolerate this breach of screenwriting discipline.",
        scores: { struct: 3, hat: 1 }
      }
    ]
  },
  {
    id: "q2",
    category: "The Chicken Fight Principle",
    prompt: "Peter Griffin has been fighting a giant yellow chicken through three states for seven continuous minutes. How should this scene resolve?",
    options: [
      {
        id: "q2-a",
        text: "They crash into an oil refinery, which explodes into a second fight with a giant duck.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q2-b",
        text: "Peter delivers a decisive punch, pants, adjusts his glasses, and walks home satisfied.",
        scores: { gag: 2, cherry: 3 }
      },
      {
        id: "q2-c",
        text: "The fight must end within 90 seconds so Lois can finish her Act 2 character arc.",
        scores: { struct: 3, cherry: 2 }
      },
      {
        id: "q2-d",
        text: "A meteor strikes both of them, followed by an unrelated 1980s sitcom commercial break.",
        scores: { gag: 3, hat: 2 }
      }
    ]
  },
  {
    id: "q3",
    category: "Bit Stacking",
    prompt: "A comedian does a hilarious impression of a 1950s radio announcer. What should they do next?",
    options: [
      {
        id: "q3-a",
        text: "Stack a second impression of a 1950s radio announcer listening to the first radio announcer.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q3-b",
        text: "Deliver one killer button line and transition smoothly to the next scene.",
        scores: { struct: 2, cherry: 3 }
      },
      {
        id: "q3-c",
        text: "Land the joke, hit a crisp button, and return to the primary narrative conflict.",
        scores: { struct: 3, cherry: 3 }
      },
      {
        id: "q3-d",
        text: "Do the impression for 10 minutes straight until the audience questions their reality.",
        scores: { gag: 3, hat: 2 }
      }
    ]
  },
  {
    id: "q4",
    category: "Cheesecake Factory Philosophy",
    prompt: "You open a Cheesecake Factory menu and see 85 pages of unrelated global cuisine. What is your spiritual assessment?",
    options: [
      {
        id: "q4-a",
        text: "Pure bliss. Order avocado egg rolls AND a brisket quesadilla ON TOP of a pizza.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q4-b",
        text: "I order one specific entree, enjoy the meal, and savor the cheesecake finish.",
        scores: { struct: 2, cherry: 3 }
      },
      {
        id: "q4-c",
        text: "Deep distress. Why are thai lettuce wraps next to shepherd's pie? Where is the culinary architecture?!",
        scores: { struct: 3, hat: 1 }
      },
      {
        id: "q4-d",
        text: "I bring myself down to its level so I can be happy, dumb, and content for two hours.",
        scores: { gag: 2, cherry: 2 }
      }
    ]
  },
  {
    id: "q5",
    category: "Narrative Payoff",
    prompt: "When watching a TV comedy finale, what frustrates you the most?",
    options: [
      {
        id: "q5-a",
        text: "When a great bit gets cut short to make room for sentimental character growth.",
        scores: { gag: 3, hat: 2 }
      },
      {
        id: "q5-b",
        text: "When a joke builds up perfectly but misses its final punchline punch.",
        scores: { gag: 1, cherry: 3 }
      },
      {
        id: "q5-c",
        text: "When the plot setup from Act 1 is completely forgotten by Act 3 because of random gags.",
        scores: { struct: 3, cherry: 2 }
      },
      {
        id: "q5-d",
        text: "When they try to resolve everything neatly instead of throwing in 12 more chaotic bits.",
        scores: { gag: 2, hat: 3 }
      }
    ]
  },
  {
    id: "q6",
    category: "Cinematic Mentorship",
    prompt: "Which approach to filmmaking speaks to your inner soul?",
    options: [
      {
        id: "q6-a",
        text: "2004 Seth MacFarlane — 40% plot, 60% cutaways, Conway Twitty, and big band showtunes.",
        scores: { gag: 3, hat: 2 }
      },
      {
        id: "q6-b",
        text: "Topher Grace — meticulous recuts that trim every frame of fat for maximum narrative punch.",
        scores: { struct: 2, cherry: 3 }
      },
      {
        id: "q6-c",
        text: "Christopher Nolan — complex timeline architecture, zero cutaway gags, IMAX precision.",
        scores: { struct: 3, cherry: 1 }
      },
      {
        id: "q6-d",
        text: "Bit Maximalism — layering gag upon gag until the original joke is completely unrecognizable.",
        scores: { gag: 3, hat: 3 }
      }
    ]
  },
  {
    id: "q7",
    category: "Podcast Recording Ethics",
    prompt: "You are hosting a 45-minute podcast episode reviewing a 20-minute cartoon. How do you handle the agenda?",
    options: [
      {
        id: "q7-a",
        text: "Ditch the agenda in minute two to argue about convertible cars and Red Hot Chili Peppers for 90 minutes.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q7-b",
        text: "Follow the episode scene-by-scene, capping each section with a definitive final verdict.",
        scores: { struct: 2, cherry: 3 }
      },
      {
        id: "q7-c",
        text: "Strict schedule, explicit timestamps, structured scoring, and zero off-topic tangents.",
        scores: { struct: 3, cherry: 2 }
      },
      {
        id: "q7-d",
        text: "Start with an outline, immediately embrace chaos, and stack three meta-jokes about recording a podcast.",
        scores: { gag: 2, hat: 2 }
      }
    ]
  },
  {
    id: "q8",
    category: "The Ultimate Comedy Verdict",
    prompt: "At the end of a hilarious 22-minute episode, what makes you say 'That was a classic'?",
    options: [
      {
        id: "q8-a",
        text: "It had seven absurd cutaway gags stacked on top of each other with zero explanation.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q8-b",
        text: "Every joke landed, the main story was satisfying, and the final line was a perfect cherry on top.",
        scores: { gag: 1, struct: 2, cherry: 3 }
      },
      {
        id: "q8-c",
        text: "The three-act structure was tight, the character motivations were logical, and the climax resolved cleanly.",
        scores: { struct: 3, cherry: 2 }
      },
      {
        id: "q8-d",
        text: "It started as a vacation episode, turned into a mob movie spoof, and ended with a 4th-wall break bit.",
        scores: { gag: 3, hat: 2 }
      }
    ]
  }
];
