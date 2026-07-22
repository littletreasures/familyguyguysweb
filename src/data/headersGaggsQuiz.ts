export type Axis = 'gag' | 'struct' | 'hat' | 'cherry';
export type ResultCode = 'G-H' | 'G-C' | 'S-H' | 'S-C';

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
    id: 'q1',
    category: 'The Exploding Horse',
    prompt:
      "You're watching your fourth Family Guy episode of the day. An Amish man's horse explodes for no particular reason. Nobody in the scene reacts. The show moves on immediately to something even more inexplicable.",
    options: [
      {
        id: 'q1-a',
        text: 'Good. I love it. Now do it again, but make it even less explicable.',
        scores: { gag: 2, hat: 2 },
      },
      {
        id: 'q1-b',
        text: "I don't need a reason. I need to know this was the funniest possible version of a horse exploding.",
        scores: { gag: 2, cherry: 2 },
      },
      {
        id: 'q1-c',
        text: 'Fine, but I want to watch this exact bit happen four more times until it stops being a joke and starts being a threat.',
        scores: { struct: 1, hat: 3 },
      },
      {
        id: 'q1-d',
        text: 'Unless this horse comes back in the third act for a quick one-liner, this is just a waste of our time.',
        scores: { struct: 3, cherry: 1 },
      },
    ],
  },
  {
    id: 'q2',
    category: 'The Whale Forklift',
    prompt:
      "Peter has spent eleven straight minutes trying to move a dead whale with a forklift. The B-story hasn't been mentioned since the whale showed up.",
    options: [
      {
        id: 'q2-a',
        text: "This has stopped being a bit and started being a lifestyle. Not only do I respect the bit, I'm also thinking about getting my forklift certification.",
        scores: { gag: 2, hat: 3 },
      },
      {
        id: 'q2-b',
        text: "Eleven minutes is a lot. But if the last ten seconds land, I'll forgive the previous ten minutes and thirty. I won't forgive those other twenty seconds, though. That was a bridge too far.",
        scores: { gag: 1, cherry: 3 },
      },
      {
        id: 'q2-c',
        text: "Let it keep going. I want to see the exact second the joke runs out of road and drives off it. Thelma & Louise style - and I'm Brad Pitt.",
        scores: { struct: 1, hat: 2 },
      },
      {
        id: 'q2-d',
        text: "Somebody at Fuzzy Door Productions owes Lois's arc an apology. I'm looking at you, Handsome Seth.",
        scores: { struct: 3, cherry: 1 },
      },
    ],
  },
  {
    id: 'q3',
    category: 'The Podcast Convertible Detour',
    prompt:
      '43 minutes into the podcast, we have discussed the first two minutes of the actual Family Guy episode, and Collin just popped the top back open on an argument about whether convertibles are fun that started before recording.',
    options: [
      {
        id: 'q3-a',
        text: "We finish the convertible thing. Maybe Anthony Kiedis and Flea are in the backseat. Who knows, just spitballin' here. If it eats the whole episode, that IS the episode.",
        scores: { gag: 3, hat: 2 },
      },
      {
        id: 'q3-b',
        text: "Hold on. Let him cook. I want it to end on the single best convertible bit you've got. Only then do we move.",
        scores: { gag: 1, cherry: 2 },
      },
      {
        id: 'q3-c',
        text: 'I let it run because I genuinely want to see if this is the week Jason finally short-circuits on-mic.',
        scores: { struct: 1, hat: 2 },
      },
      {
        id: 'q3-d',
        text: 'I write the timecode down, let him land it, and bring us home like a man parking a plane he was never licensed to fly.',
        scores: { struct: 3, cherry: 1 },
      },
    ],
  },
  {
    id: 'q4',
    category: 'Cheesecake Factory, Page Three',
    prompt:
      "An 80-page menu that weighs more than most Bibles lists avocado eggrolls directly above shepherd's pie and directly below funnel cake. Nothing about this menu apologizes for itself.",
    options: [
      {
        id: 'q4-a',
        text: "This is the third separate page 3 I've read in this menu. I want to meet the person who arranged this damn thing so I can shame them personally.",
        scores: { struct: 3, cherry: 1 },
      },
      {
        id: 'q4-b',
        text: "I'm not sure we have enough eggroll variants on this page. I'm thinking something regional... Okay, I've got it. Add exactly one Philly cheesesteak eggroll, put it between the shepherd's pie and funnel cake, and you've achieved menu perfection.",
        scores: { gag: 1, cherry: 2 },
      },
      {
        id: 'q4-c',
        text: 'I keep reading specifically to find the exact page where this stops making sense. 3 down, 77 to go.',
        scores: { struct: 1, hat: 2 },
      },
      {
        id: 'q4-d',
        text: 'This menu is the only honest document in America. This should be our Constitution.',
        scores: { gag: 2, hat: 2 },
      },
    ],
  },
  {
    id: 'q5',
    category: 'The Chicken Fight Edit',
    prompt:
      "You've been asked to cut a chicken fight down from 3 minutes to 90 seconds. The first 30 seconds are great. The next two and a half minutes get more and more punishing in a way that starts to feel intentional.",
    options: [
      {
        id: 'q5-a',
        text: "You think 90 seconds is enough for a fight of this caliber? I'm going to just re-deliver the whole fight, plus I'm adding another 12 seconds of the chicken catching its breath. The client can fire me. This is art. This is important.",
        scores: { gag: 3, hat: 3 },
      },
      {
        id: 'q5-b',
        text: "I deliver 90 seconds - but I've left the chicken on the cutting room floor. Now it's 90 seconds of Lois and Peter having an emotional breakthrough about why he's such a buffoon. This is essential viewing.",
        scores: { struct: 3, cherry: 1 },
      },
      {
        id: 'q5-c',
        text: "I keep the worst sixty seconds specifically because watching it get bad on purpose is the actual joke. I don't stretch it to the full 90 seconds because this is the truest essence of the bit.",
        scores: { struct: 1, hat: 3 },
      },
      {
        id: 'q5-d',
        text: "I've gone through each frame with a fine tooth comb. Every cluck, every bawk, every feathery slap has been accounted for and precisely delivered for 90 seconds of maximum enjoyment. This is my masterpiece.",
        scores: { gag: 1, cherry: 3 },
      },
    ],
  },
  {
    id: 'q6',
    category: 'The Group Chat Clip',
    prompt:
      "Someone sends a 14-second clip of a guy getting absolutely cooked by his wife's boyfriend, followed by 40 uninterrupted seconds of him slowly realizing what was said to him.",
    options: [
      {
        id: 'q6-a',
        text: "Forty seconds of nothing? No additional character development? No callback? I feel like I'm being held hostage here. Somebody cut this fucking thing.",
        scores: { struct: 3, cherry: 1 },
      },
      {
        id: 'q6-b',
        text: "The first 14 seconds are the gunshot. The next 40 are the body hitting the floor in slow motion. Somebody crank up the Drowning Pool. I'm loving this",
        scores: { gag: 2, hat: 3 },
      },
      {
        id: 'q6-c',
        text: "I'm struggling to see how the extra 40 makes the original joke funnier. I'm trying here... can we add some sound effects? Cap it off with a little something-something? It's missing that little something special.",
        scores: { gag: 1, cherry: 3 },
      },
      {
        id: 'q6-d',
        text: 'I set a reminder for myself to send it to the chat every morning until none of us can tell whether his realization is still funny or if we’ve become bad people.',
        scores: { struct: 1, hat: 2 },
      },
    ],
  },
  {
    id: 'q7',
    category: 'The Prestige Drama Interruption',
    prompt:
      "A prestige drama halts its emotional climax so a character can perform an unprompted 3-minute song about a brand of cereal that hasn't existed since '84.",
    options: [
      {
        id: 'q7-a',
        text: 'Finally, a show brave enough to interrupt itself before it got good.',
        scores: { gag: 3, hat: 2 },
      },
      {
        id: 'q7-b',
        text: "Look, if the song's not a banger, this was just vandalism with a melody. I'm not a monster. I demand quality.",
        scores: { gag: 1, cherry: 3 },
      },
      {
        id: 'q7-c',
        text: "Look, I think you're forgetting a key scene from the first season where the main character eats this cereal as a small boy while his father walks out the door. I want this song to keep going. Keep singing, maybe daddy will come back.",
        scores: { struct: 1, hat: 2 },
      },
      {
        id: 'q7-d',
        text: "This is why television needs adults in the room. Christopher Nolan, it's time. Usher us away from this trite nonsense and into a new golden age of television.",
        scores: { struct: 3, cherry: 1 },
      },
    ],
  },
  {
    id: 'q8',
    category: "Peter's Sign-Off",
    prompt:
      'It\'s 18 minutes in. There\'s at least three more minutes left in the episode. Peter looks directly at the camera, says "Well, I guess that was our show," and the credits roll with zero setups resolved.',
    options: [
      {
        id: 'q8-a',
        text: "Brilliant. Nothing else needed to happen and I resent that you'd ask.",
        scores: { gag: 3, hat: 1 },
      },
      {
        id: 'q8-b',
        text: "It's an interesting choice. There's no way this is the real ending. I'm betting on another chicken fight. Oh yep, there it is. Writers, you've done it again. Bravo.",
        scores: { gag: 1, cherry: 2 },
      },
      {
        id: 'q8-c',
        text: "I want him to say that line, then have the credits keep going. And going. Most of these names are for people that don't exist. It keeps going... and going... and then, silence. C'est magnifique.",
        scores: { struct: 1, hat: 3 },
      },
      {
        id: 'q8-d',
        text: "Okay, wow. We didn't resolve our B-story with Meg and Lois, let alone our C-story with Brian. Peter knows what he's done here. Shame on you, Mr. Griffin.",
        scores: { struct: 3, cherry: 2 },
      },
    ],
  },
];
