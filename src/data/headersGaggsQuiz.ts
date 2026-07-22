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
    category: "The Exploding Horse",
    prompt: "An Amish man's horse explodes for no stated reason. Nobody in the scene reacts. The show moves on immediately to something even less explainable.",
    options: [
      {
        id: "q1-a",
        text: "Good. Now do it again, but somehow worse.",
        scores: { gag: 2, hat: 2 }
      },
      {
        id: "q1-b",
        text: "I don't need a reason. I need to know this was the funniest possible version of a horse exploding.",
        scores: { gag: 2, cherry: 2 }
      },
      {
        id: "q1-c",
        text: "Fine, but I want to watch this exact bit happen four more times until it stops being a joke and starts being a threat.",
        scores: { struct: 1, hat: 3 }
      },
      {
        id: "q1-d",
        text: "There's no way this connects to anything later, and that's the whole problem.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q2",
    category: "The Whale Forklift",
    prompt: "Peter has spent eleven straight minutes trying to move a dead whale with a forklift. The B-story hasn't been mentioned since the whale showed up.",
    options: [
      {
        id: "q2-a",
        text: "This has stopped being a bit and started being a lifestyle. I respect it.",
        scores: { gag: 2, hat: 3 }
      },
      {
        id: "q2-b",
        text: "Eleven minutes is a lot. But if the last ten seconds land, I'll forgive the previous ten minutes and thirty.",
        scores: { gag: 1, cherry: 3 }
      },
      {
        id: "q2-c",
        text: "Let it keep going. I want to see the exact second the joke runs out of road and drives off it.",
        scores: { struct: 1, hat: 2 }
      },
      {
        id: "q2-d",
        text: "Somebody at Fuzzy Nation Studios owes Lois's arc an apology.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q3",
    category: "The Podcast Convertible Detour",
    prompt: "43 minutes into a 45-minute episode, no score has been assigned, and Collin has reopened a convertible argument that started before recording.",
    options: [
      {
        id: "q3-a",
        text: "We finish the convertible thing. If it eats the whole episode, that IS the episode.",
        scores: { gag: 3, hat: 2 }
      },
      {
        id: "q3-b",
        text: "Let him cook, but I want the bit to end on the single best convertible fact available. Then we move.",
        scores: { gag: 1, cherry: 2 }
      },
      {
        id: "q3-c",
        text: "I let it run because I genuinely want to see if this is the week Collin finally short-circuits on-mic.",
        scores: { struct: 1, hat: 2 }
      },
      {
        id: "q3-d",
        text: "I write the timecode down, let him land it, and bring us home like a man parking a plane he was never licensed to fly.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q4",
    category: "Cheesecake Factory, Page Three",
    prompt: "An 80-page menu lists avocado eggrolls directly above shepherd's pie. Nothing about this menu apologizes for itself.",
    options: [
      {
        id: "q4-a",
        text: "This menu is the only honest document in America.",
        scores: { gag: 2, hat: 2 }
      },
      {
        id: "q4-b",
        text: "I want to know who built this menu and whether they'd let me watch them work.",
        scores: { gag: 1, cherry: 2 }
      },
      {
        id: "q4-c",
        text: "I keep reading specifically to find the exact page where this stops making sense.",
        scores: { struct: 1, hat: 2 }
      },
      {
        id: "q4-d",
        text: "Page three should not exist next to page four. Someone had one job.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q5",
    category: "The Chicken Fight Edit",
    prompt: "You've been asked to cut a chicken fight down to 90 seconds. The first 30 seconds are great. The next 60 get worse in a way that starts to feel intentional.",
    options: [
      {
        id: "q5-a",
        text: "Deliver the whole fight, plus six extra seconds of the chicken catching its breath. The client can fire me.",
        scores: { gag: 3, hat: 3 }
      },
      {
        id: "q5-b",
        text: "Ninety seconds exactly, and every one of them has to earn its spot. That's not a request, that's math.",
        scores: { gag: 1, cherry: 3 }
      },
      {
        id: "q5-c",
        text: "I keep the worst sixty seconds specifically because watching it get bad on purpose is the actual joke.",
        scores: { struct: 1, hat: 3 }
      },
      {
        id: "q5-d",
        text: "I deliver 90 seconds with a note saying the assignment misunderstood the material.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q6",
    category: "The Group Chat Clip",
    prompt: "Someone sends a 14-second joke followed by 40 seconds of a character slowly realizing the joke happened.",
    options: [
      {
        id: "q6-a",
        text: "The 40 seconds ARE the clip. The joke was just the appetizer.",
        scores: { gag: 2, hat: 3 }
      },
      {
        id: "q6-b",
        text: "14 great seconds. If the other 40 don't pay it off, this is a rough cut, not a bit.",
        scores: { gag: 1, cherry: 3 }
      },
      {
        id: "q6-c",
        text: "Send it to me every day until the realization stops being funny. I need to know when that day comes.",
        scores: { struct: 1, hat: 2 }
      },
      {
        id: "q6-d",
        text: "40 seconds is generous. Somebody in the edit bay should've made a decision.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q7",
    category: "The Prestige Drama Interruption",
    prompt: "A prestige drama halts its emotional climax so a character can perform an unprompted 3-minute song about discontinued cereal.",
    options: [
      {
        id: "q7-a",
        text: "Finally, a show brave enough to interrupt itself before it got good.",
        scores: { gag: 3, hat: 2 }
      },
      {
        id: "q7-b",
        text: "The song has to be objectively great, or this was just vandalism with a melody.",
        scores: { gag: 1, cherry: 3 }
      },
      {
        id: "q7-c",
        text: "I want them to keep singing well past the point the scene can recover from it.",
        scores: { struct: 1, hat: 2 }
      },
      {
        id: "q7-d",
        text: "This is why television needs adults in the room, Nolan among them.",
        scores: { struct: 3, cherry: 1 }
      }
    ]
  },
  {
    id: "q8",
    category: "Peter's Sign-Off",
    prompt: "Peter looks directly at the camera, says \"Well, I guess that was our show,\" and the credits roll with zero setups resolved.",
    options: [
      {
        id: "q8-a",
        text: "Correct. Nothing else needed to happen and I resent that you'd ask.",
        scores: { gag: 3, hat: 1 }
      },
      {
        id: "q8-b",
        text: "Bold ending. It only works if literally everything before it was firing on all cylinders.",
        scores: { gag: 1, cherry: 2 }
      },
      {
        id: "q8-c",
        text: "I want him to say that line, then have the credits get interrupted by one more thing collapsing.",
        scores: { struct: 1, hat: 3 }
      },
      {
        id: "q8-d",
        text: "There were at least two emotional obligations outstanding, and Peter knows it.",
        scores: { struct: 3, cherry: 2 }
      }
    ]
  }
];
