import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Flame, 
  Compass, 
  RefreshCw, 
  Share2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  BookOpen, 
  ShoppingBag, 
  Tv, 
  Check,
  Radio,
  Award
} from 'lucide-react';

// --- SOUND UTILITY USING WEB AUDIO API ---
const playSound = (type, enabled = true) => {
  if (!enabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } else if (type === 'select') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'finish') {
      const now = audioCtx.currentTime;
      osc.type = 'square';
      osc.frequency.setValueAtTime(392, now); // G4
      osc.frequency.setValueAtTime(523.25, now + 0.1); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start();
      osc.stop(now + 0.5);
    }
  } catch (e) {
    // AudioContext blocked or unsupported
  }
};

// --- QUIZ DATA ---
const QUIZ_QUESTIONS = [
  {
    id: 1,
    category: "Cutaway Tolerance",
    question: "You are watching a dramatic historical film, and a character suddenly breaks into a 3-minute unprompted song-and-dance about 1920s cereal brands. What is your reaction?",
    options: [
      {
        text: "Holy crap, brilliant! More movies need unprompted 80s pop culture tangents.",
        points: { gag: 3, struct: 0 },
        tag: "PURE GAGGER"
      },
      {
        text: "Funny bit, but did it advance the plot? Absolutely not.",
        points: { gag: 1, struct: 2 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "Unacceptable. Christopher Nolan would never allow this breach of narrative pacing.",
        points: { gag: 0, struct: 3 },
        tag: "PURE STRUCTUREHEAD"
      },
      {
        text: "I stopped paying attention to the plot 20 minutes ago anyway. Give me the bit!",
        points: { gag: 3, struct: 0 },
        tag: "UNABASHED GAGGER"
      }
    ]
  },
  {
    id: 2,
    category: "Episode Evaluation",
    question: "How do you rate a Family Guy episode where Peter spends 12 continuous minutes trying to push a dead whale off the beach with a forklift?",
    options: [
      {
        text: "10/10. Peak television. The longer an absurd bit goes on, the funnier it becomes.",
        points: { gag: 3, struct: 0 },
        tag: "GAGGER"
      },
      {
        text: "It was funny for 30 seconds, but it completely killed the momentum of the B-story.",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "It was fine, but I needed a satisfying 3rd act resolution for Lois and Peter's marriage.",
        points: { gag: 1, struct: 2 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "I love it, especially if it ends abruptly with zero explanation or emotional payoff.",
        points: { gag: 3, struct: 0 },
        tag: "PURE GAGGER"
      }
    ]
  },
  {
    id: 3,
    category: "Cheesecake Factory Philosophy",
    question: "You step inside a Cheesecake Factory restaurant. What best describes your spiritual state?",
    options: [
      {
        text: "Spiritually aligned. The menu is an unhinged 80-page stream of consciousness and I love the chaos.",
        points: { gag: 3, struct: 0 },
        tag: "GAGGER"
      },
      {
        text: "Deeply distressed. Why are avocado eggrolls listed next to shepherd's pie? Where is the culinary structure?!",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "I bring myself down to its level so I can be happy, dumb, and content for two hours.",
        points: { gag: 2, struct: 1 },
        tag: "WALKS THE LINE"
      },
      {
        text: "I need to analyze the operational flow and kitchen course-timing efficiency immediately.",
        points: { gag: 0, struct: 3 },
        tag: "PURE STRUCTUREHEAD"
      }
    ]
  },
  {
    id: 4,
    category: "Narrative Frustration",
    question: "When watching a TV show with friends, what causes you the most physical or emotional agony?",
    options: [
      {
        text: "When a hilarious joke is cut short so two characters can talk about their feelings.",
        points: { gag: 3, struct: 0 },
        tag: "GAGGER"
      },
      {
        text: "When a major plot setup from Act 1 is completely forgotten by Act 3 due to random bits.",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "When someone says 'that cutaway gag is unrealistic' during a cartoon.",
        points: { gag: 3, struct: 0 },
        tag: "PURE GAGGER"
      },
      {
        text: "When the episode's climax relies on a lazy joke instead of organic character growth.",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      }
    ]
  },
  {
    id: 5,
    category: "Cinematic Mentorship",
    question: "Who is your ultimate cinematic role model?",
    options: [
      {
        text: "Seth MacFarlane in 2005 — pure unadulterated cutaway gags, Conway Twitty, and big band showtunes.",
        points: { gag: 3, struct: 0 },
        tag: "GAGGER"
      },
      {
        text: "Christopher Nolan — complex timeline architecture, zero cutaways, IMAX aspect ratio changes.",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "Topher Grace — specifically his fan-edited, perfectly paced recuts of famous movie franchises.",
        points: { gag: 1, struct: 2 },
        tag: "LINE WALKER"
      },
      {
        text: "Three guys on a podcast spending 2 hours dissecting a 20-minute cartoon episode.",
        points: { gag: 2, struct: 2 },
        tag: "PODCAST GUY"
      }
    ]
  },
  {
    id: 6,
    category: "Podcast Recording Philosophy",
    question: "If you were recording a 45-minute podcast episode, how would you approach the agenda?",
    options: [
      {
        text: "Zero outline. Let's derail into a 30-minute argument about convertible cars and Red Hot Chili Peppers.",
        points: { gag: 3, struct: 0 },
        tag: "GAGGER"
      },
      {
        text: "Strict schedule, episode timestamps, structured scoring, and zero off-topic tangents.",
        points: { gag: 0, struct: 3 },
        tag: "STRUCTUREHEAD"
      },
      {
        text: "Start with a strict script, but immediately embrace whatever chaos occurs in minute two.",
        points: { gag: 2, struct: 1 },
        tag: "WALKS THE LINE"
      },
      {
        text: "Accidentally record for 2 hours and promise 'nobody will listen this long' at the end.",
        points: { gag: 2, struct: 2 },
        tag: "TRUE PODCASTER"
      }
    ]
  }
];

// --- MBTI RESULTS MATRIX WITH ACCURATE HOST ALIGNMENTS ---
const RESULTS_MAP = {
  "GAG-P": {
    code: "GAG-P",
    title: "The Unabashed Gagger",
    tagline: "Pure, unfiltered gag energy. Story arcs are a social construct.",
    alignment: "Collin Brown & 2004 Seth MacFarlane",
    description: "You are the unabashed Gagger of the group, aligned spiritually with Collin. You do not care about character development, emotional stakes, or three-act structures. You live for the non-sequitur, the 8-minute chicken fight, and the random 80s pop culture reference. To you, a plot is simply an inconvenient vehicle designed to transport the audience between gag setups.",
    traits: [
      "Loves jokes that go on far longer than comfortably necessary",
      "Views Cheesecake Factory as a religious sanctuary of unhinged menu choices",
      "Believes Christopher Nolan takes life entirely too seriously",
      "Will derail a 45-minute podcast to argue about convertibles for two hours"
    ],
    merch: {
      name: "I'm A Gagger Tee",
      price: "$15.99",
      img: "I’m A Gagger",
      desc: "Wear your love for non-sequiturs on your chest."
    },
    accentColor: "#e8841a",
    badgeBg: "bg-[#e8841a] text-white"
  },
  "GAG-J": {
    code: "GAG-J",
    title: "The Line-Walking Riffer",
    tagline: "A gagger at heart, but with a secret appreciation for narrative cohesion.",
    alignment: "Tyler Simpson (Gagger who walks the line)",
    description: "You are aligned with Tyler! You are fundamentally a Gagger who caught Family Guy as an 8-year-old, but you occasionally walk the line of Structurehead discipline. You love an unhinged riff and a great callback, but you secretly smile when an episode manages to land a satisfying Act 3 payoff.",
    traits: [
      "Appreciates well-timed sound effects, callbacks, and theme song remixes",
      "Enjoys unhinged tangents, but keeps one eye on the clock",
      "Maintains high tolerance for absurd B-stories if they hit hard",
      "Brings yourself down to the episode's level to feel happy, dumb, and content"
    ],
    merch: {
      name: "Faguugu Tote",
      price: "$12.99",
      img: "I’m A Gagger",
      desc: "Carry your chaotic gagger energy in style."
    },
    accentColor: "#e87dbf",
    badgeBg: "bg-[#e87dbf] text-[#1a1a1a]"
  },
  "STR-P": {
    code: "STR-P",
    title: "The Reluctant Narrative Apologist",
    tagline: "You want to embrace the chaos, but your brain demands logical consistency.",
    alignment: "The Cautious Viewer & Topher Grace Fan-Editor",
    description: "You fall on the fence, leaning toward structure. You love the jokes, but a little part of you winces when a 10-minute cutaway derails a compelling character dynamic. You admire tight editing, cohesive B-stories, and fan recuts that trim the fat.",
    traits: [
      "Keeps mental track of continuity errors during cartoon episodes",
      "Enjoys bits, but prefers when they connect back to the primary story",
      "Admires tight pacing like Topher Grace franchise recuts",
      "Often asks 'Wait, where did the rest of the Griffins go during this scene?'"
    ],
    merch: {
      name: "Structurehead Mug",
      price: "$12.00",
      img: "structurehead",
      desc: "Sip your coffee with narrative precision."
    },
    accentColor: "#1a6b6b",
    badgeBg: "bg-[#1a6b6b] text-white"
  },
  "STR-J": {
    code: "STR-J",
    title: "The Nolan Fundamentalist",
    tagline: "Cutaways are a crutch. Give me act setups, character arcs, and structure!",
    alignment: "Jason Hackett (The Structurehead of the Group)",
    description: "You are the ultimate Structurehead, sitting proudly alongside Jason. You watch comedy with a screenplay outline in hand. You believe cutaway gags can be cheap crutches designed to pad runtime, and you respect a tight, well-crafted 3-act narrative with real stakes. Christopher Nolan is your personal cinema titan.",
    traits: [
      "Has Christopher Nolan on a personal pedestal of cinematic honor",
      "Gets visibly frustrated by unresolved cliffhangers or lazy gag endings",
      "Cranks the hogs, sets the tone, and asks the hard narrative questions",
      "Probably writes detailed episode reviews on Letterboxd and Supabase"
    ],
    merch: {
      name: "Structurehead Tee",
      price: "$15.99",
      img: "structurehead",
      desc: "For the viewer who demands three-act discipline."
    },
    accentColor: "#0f3f3f",
    badgeBg: "bg-[#0f3f3f] text-white"
  }
};

export default function App() {
  const [currentStep, setCurrentStep] = useState(0); // 0: Intro, 1..6: Questions, 7: Result
  const [userAnswers, setUserAnswers] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz' or 'matrix'

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep, activeTab]);

  const handleSelectOption = (questionId, optionIndex) => {
    playSound('select', soundEnabled);
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleNextQuestion = () => {
    if (userAnswers[QUIZ_QUESTIONS[currentStep - 1].id] === undefined) return;
    playSound('click', soundEnabled);
    if (currentStep < QUIZ_QUESTIONS.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      playSound('finish', soundEnabled);
      setCurrentStep(QUIZ_QUESTIONS.length + 1);
    }
  };

  const handlePrevQuestion = () => {
    playSound('click', soundEnabled);
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      setCurrentStep(0);
    }
  };

  const resetQuiz = () => {
    playSound('click', soundEnabled);
    setUserAnswers({});
    setCurrentStep(0);
    setActiveTab('quiz');
  };

  // Calculate scores
  const calculateResult = () => {
    let gagTotal = 0;
    let structTotal = 0;

    QUIZ_QUESTIONS.forEach(q => {
      const selectedIndex = userAnswers[q.id];
      if (selectedIndex !== undefined) {
        const option = q.options[selectedIndex];
        gagTotal += option.points.gag;
        structTotal += option.points.struct;
      }
    });

    const maxScore = gagTotal + structTotal || 1;
    const gagPct = Math.round((gagTotal / maxScore) * 100);
    const structPct = 100 - gagPct;

    let resultKey = "GAG-P";
    if (gagPct >= 70) {
      resultKey = "GAG-P";
    } else if (gagPct >= 50) {
      resultKey = "GAG-J";
    } else if (structPct >= 70) {
      resultKey = "STR-J";
    } else {
      resultKey = "STR-P";
    }

    return {
      gagScore: gagTotal,
      structScore: structTotal,
      gagPct,
      structPct,
      typeData: RESULTS_MAP[resultKey]
    };
  };

  const result = currentStep > QUIZ_QUESTIONS.length ? calculateResult() : null;

  const copyResultsToClipboard = () => {
    if (!result) return;
    const shareText = `I took the Family Guy Guys "Gagger vs. Structurehead" Quiz!\n\nResult: ${result.typeData.code} - ${result.typeData.title}\nScore: ${result.gagPct}% Gagger / ${result.structPct}% Structurehead\nAlignment: ${result.typeData.alignment}\n\nFind out your alignment on Family Guy Guys!`;
    
    const textInput = document.createElement('textarea');
    textInput.value = shareText;
    document.body.appendChild(textInput);
    textInput.select();
    document.execCommand('copy');
    document.body.removeChild(textInput);

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-[#1a1a1a] font-sans relative selection:bg-[#e8841a] selection:text-white">
      {/* INJECT SITE FONTS & HALFTONE PATTERN CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');
        
        .font-display {
          font-family: "Neue Montreal", "Helvetica Neue", Arial, sans-serif;
        }
        .font-accent {
          font-family: "Special Elite", monospace, cursive;
        }
        .halftone-bg {
          background-color: #f5f4f0;
          background-image: radial-gradient(#1a1a1a 0.75px, transparent 0.75px);
          background-size: 16px 16px;
          background-position: 0 0;
          opacity: 0.97;
        }
        .retro-card {
          background-color: #ffffff;
          border: 3px solid #1a1a1a;
          box-shadow: 6px 6px 0px 0px #1a1a1a;
        }
        .retro-card-sm {
          background-color: #ffffff;
          border: 2px solid #1a1a1a;
          box-shadow: 4px 4px 0px 0px #1a1a1a;
        }
        .retro-button {
          border: 2.5px solid #1a1a1a;
          box-shadow: 3px 3px 0px 0px #1a1a1a;
          transition: all 0.15s ease-in-out;
        }
        .retro-button:hover {
          transform: translate(-2px, -2px);
          box-shadow: 5px 5px 0px 0px #1a1a1a;
        }
        .retro-button:active {
          transform: translate(2px, 2px);
          box-shadow: 1px 1px 0px 0px #1a1a1a;
        }
      `}</style>

      {/* BACKGROUND TEXTURE */}
      <div className="fixed inset-0 halftone-bg pointer-events-none z-0 opacity-40"></div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 md:py-10 flex flex-col min-h-screen">
        
        {/* BRANDING HEADER */}
        <header className="retro-card p-4 sm:p-6 mb-8 rounded-none">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-12 h-12 bg-[#e8841a] border-2 border-[#1a1a1a] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_0px_#1a1a1a]">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <span className="font-accent text-xs uppercase tracking-widest bg-[#1a6b6b] text-white px-2 py-0.5 border border-[#1a1a1a]">
                    Podcast Official Assessment
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1a1a1a] font-display uppercase mt-1">
                  Family Guy Guys
                </h1>
              </div>
            </div>

            {/* CONTROLS & NAV */}
            <div className="flex items-center gap-2 bg-[#f5f4f0] p-1.5 border-2 border-[#1a1a1a]">
              <button
                onClick={() => setActiveTab('quiz')}
                className={`px-3 py-1.5 text-xs font-bold font-accent uppercase transition ${
                  activeTab === 'quiz'
                    ? 'bg-[#e8841a] text-white border border-[#1a1a1a]'
                    : 'text-[#1a1a1a] hover:bg-white'
                }`}
              >
                Quiz
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1.5 text-xs font-bold font-accent uppercase transition ${
                  activeTab === 'matrix'
                    ? 'bg-[#e8841a] text-white border border-[#1a1a1a]'
                    : 'text-[#1a1a1a] hover:bg-white'
                }`}
              >
                Taxonomy
              </button>
              <div className="w-0.5 h-4 bg-[#1a1a1a] mx-1"></div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute audio" : "Enable audio"}
                className="p-1.5 text-[#1a1a1a] hover:bg-white transition"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-[#e8841a]" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTAINER */}
        <main className="flex-grow">
          
          {/* TAB 1: TAXONOMY MATRIX */}
          {activeTab === 'matrix' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="retro-card p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="w-6 h-6 text-[#e8841a]" />
                  <h2 className="text-2xl font-black text-[#1a1a1a] uppercase font-display tracking-tight">
                    The Gagger vs. Structurehead Spectrum
                  </h2>
                </div>
                <p className="text-slate-800 leading-relaxed mb-6 font-display">
                  In podcast taxonomy, listeners fall on a spectrum between two fundamental television philosophies. 
                  Are you driven by unhinged cutaway comedy, or do you demand three-act discipline and narrative payoffs?
                </p>

                <div className="grid md:grid-cols-2 gap-5">
                  {Object.values(RESULTS_MAP).map(item => (
                    <div 
                      key={item.code} 
                      className="retro-card-sm p-5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className={`px-2.5 py-0.5 text-xs font-accent font-bold border border-[#1a1a1a] ${item.badgeBg}`}>
                            {item.code}
                          </span>
                          <span className="text-xs font-accent text-[#7a2b0f] font-bold">
                            {item.alignment}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-[#1a1a1a] mb-1 font-display">
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#aa6200] font-accent italic mb-3">
                          "{item.tagline}"
                        </p>
                        <p className="text-xs text-slate-700 leading-relaxed mb-4 font-display">
                          {item.description}
                        </p>
                      </div>

                      <div className="border-t-2 border-[#1a1a1a] pt-3 mt-2">
                        <span className="text-[10px] uppercase font-bold font-accent text-slate-500 block mb-1">Official Merch:</span>
                        <div className="flex items-center justify-between text-xs font-bold text-[#1a1a1a]">
                          <span>{item.merch.name}</span>
                          <span className="text-[#e8841a]">{item.merch.price}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <button
                    onClick={() => {
                      setActiveTab('quiz');
                      setCurrentStep(0);
                    }}
                    className="retro-button bg-[#e8841a] text-white font-black px-6 py-3 text-sm uppercase font-accent inline-flex items-center gap-2"
                  >
                    <span>Take The Assessment Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUIZ FLOW */}
          {activeTab === 'quiz' && (
            <>
              {/* STEP 0: INTRO HERO */}
              {currentStep === 0 && (
                <div className="retro-card p-6 sm:p-10 relative overflow-hidden">
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#8ecfdb] text-[#1a1a1a] border-2 border-[#1a1a1a] text-xs font-bold font-accent mb-6">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Myers-Briggs Style Personality Test</span>
                  </div>

                  <h2 className="text-3xl sm:text-5xl font-black text-[#1a1a1a] font-display uppercase tracking-tight leading-none mb-4">
                    Are You A <span className="bg-[#e8841a] text-white px-2 py-0.5 border-2 border-[#1a1a1a]">Gagger</span> Or A <span className="bg-[#1a6b6b] text-white px-2 py-0.5 border-2 border-[#1a1a1a]">Structurehead</span>?
                  </h2>

                  <p className="text-slate-800 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl font-display">
                    Every comedy fan belongs to one of two primal factions. Do you live for chaotic cutaways, 8-minute chicken fights, and unhinged tangents? Or do you demand 3-act discipline, character arcs, and Christopher Nolan-level precision?
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-[#f5f4f0] p-4 border-2 border-[#1a1a1a] flex items-start gap-3">
                      <div className="p-2 bg-[#e8841a] text-white border border-[#1a1a1a] mt-0.5">
                        <Flame className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1a1a1a] text-sm font-display">The Gagger Mindset</h3>
                        <p className="text-xs text-slate-700 mt-1 font-display italic">
                          "I brought myself down to its level and I was happy, dumb, and felt good."
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#f5f4f0] p-4 border-2 border-[#1a1a1a] flex items-start gap-3">
                      <div className="p-2 bg-[#1a6b6b] text-white border border-[#1a1a1a] mt-0.5">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1a1a1a] text-sm font-display">The Structurehead</h3>
                        <p className="text-xs text-slate-700 mt-1 font-display italic">
                          "Jason is the structurehead of the group. Nolan hates cutaway gags."
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                      onClick={() => {
                        playSound('click', soundEnabled);
                        setCurrentStep(1);
                      }}
                      className="w-full sm:w-auto retro-button bg-[#e8841a] text-white font-black px-8 py-4 text-base font-accent uppercase inline-flex items-center justify-center gap-3"
                    >
                      <span>Start Assessment</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <span className="text-xs text-slate-600 font-accent">
                      6 Quick Scenario Questions
                    </span>
                  </div>
                </div>
              )}

              {/* STEPS 1..6: QUESTIONS */}
              {currentStep >= 1 && currentStep <= QUIZ_QUESTIONS.length && (
                <div className="retro-card p-6 sm:p-8 animate-fadeIn">
                  
                  {/* PROGRESS BAR */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs font-accent text-[#1a1a1a] mb-2 font-bold">
                      <span className="uppercase tracking-wider text-[#e8841a]">
                        Question {currentStep} of {QUIZ_QUESTIONS.length}
                      </span>
                      <span>{Math.round((currentStep / QUIZ_QUESTIONS.length) * 100)}% Complete</span>
                    </div>
                    <div className="w-full h-3 bg-[#f5f4f0] border-2 border-[#1a1a1a] overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-[#e8841a] transition-all duration-300"
                        style={{ width: `${(currentStep / QUIZ_QUESTIONS.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* QUESTION CONTENT */}
                  {(() => {
                    const q = QUIZ_QUESTIONS[currentStep - 1];
                    const selectedIdx = userAnswers[q.id];

                    return (
                      <div>
                        <div className="inline-block px-3 py-0.5 bg-[#8ecfdb] text-[#1a1a1a] text-xs font-accent font-bold mb-3 border border-[#1a1a1a]">
                          {q.category}
                        </div>

                        <h2 className="text-xl sm:text-2xl font-bold text-[#1a1a1a] leading-snug mb-6 font-display">
                          {q.question}
                        </h2>

                        {/* OPTIONS LIST */}
                        <div className="space-y-3 mb-8">
                          {q.options.map((opt, idx) => {
                            const isSelected = selectedIdx === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => handleSelectOption(q.id, idx)}
                                className={`w-full text-left p-4 sm:p-5 border-2 transition-all flex items-start gap-4 ${
                                  isSelected
                                    ? 'bg-[#e8841a] text-white border-[#1a1a1a] shadow-[4px_4px_0px_0px_#1a1a1a]'
                                    : 'bg-white text-[#1a1a1a] border-[#1a1a1a] hover:bg-[#f5f4f0]'
                                }`}
                              >
                                <div className={`w-6 h-6 rounded-none border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected 
                                    ? 'border-white bg-white text-[#1a1a1a]' 
                                    : 'border-[#1a1a1a] bg-[#f5f4f0] text-transparent'
                                }`}>
                                  <Check className="w-4 h-4 stroke-[3]" />
                                </div>
                                <div className="flex-grow">
                                  <span className="text-sm sm:text-base font-bold leading-relaxed block font-display">
                                    {opt.text}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* NAV BUTTONS */}
                        <div className="flex items-center justify-between border-t-2 border-[#1a1a1a] pt-6">
                          <button
                            onClick={handlePrevQuestion}
                            className="inline-flex items-center gap-1.5 text-[#1a1a1a] hover:text-[#e8841a] text-xs font-bold uppercase font-accent"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                          </button>

                          <button
                            onClick={handleNextQuestion}
                            disabled={selectedIdx === undefined}
                            className={`retro-button font-black px-6 py-3 text-xs uppercase font-accent inline-flex items-center gap-2 ${
                              selectedIdx !== undefined
                                ? 'bg-[#e8841a] text-white'
                                : 'bg-slate-300 text-slate-500 cursor-not-allowed border-slate-400 shadow-none'
                            }`}
                          >
                            <span>{currentStep === QUIZ_QUESTIONS.length ? "Calculate Results" : "Next Question"}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STEP 7: RESULTS DISPLAY */}
              {currentStep > QUIZ_QUESTIONS.length && result && (
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* MAIN CARD */}
                  <div className="retro-card p-6 sm:p-10 relative overflow-hidden">
                    
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                      <span className={`px-3 py-1 text-xs font-accent font-black border-2 border-[#1a1a1a] ${result.typeData.badgeBg}`}>
                        TYPE: {result.typeData.code}
                      </span>
                      <span className="text-xs font-accent text-[#7a2b0f] font-bold">
                        Host Alignment: <strong>{result.typeData.alignment}</strong>
                      </span>
                    </div>

                    <h2 className="text-3xl sm:text-5xl font-black text-[#1a1a1a] font-display uppercase tracking-tight mb-2">
                      {result.typeData.title}
                    </h2>
                    
                    <p className="text-[#aa6200] text-base sm:text-lg font-bold font-accent italic mb-8">
                      "{result.typeData.tagline}"
                    </p>

                    {/* SCORE BREAKDOWN METER */}
                    <div className="bg-[#f5f4f0] p-5 border-2 border-[#1a1a1a] mb-8">
                      <div className="flex items-center justify-between text-xs font-accent font-bold mb-2">
                        <span className="text-[#e8841a] flex items-center gap-1.5">
                          <Flame className="w-4 h-4" /> GAGGER ({result.gagPct}%)
                        </span>
                        <span className="text-[#1a6b6b] flex items-center gap-1.5">
                          STRUCTUREHEAD ({result.structPct}%) <Compass className="w-4 h-4" />
                        </span>
                      </div>

                      <div className="w-full h-5 bg-white border-2 border-[#1a1a1a] p-0.5 flex">
                        <div 
                          className="h-full bg-[#e8841a] transition-all duration-700"
                          style={{ width: `${result.gagPct}%` }}
                        ></div>
                        <div 
                          className="h-full bg-[#1a6b6b] transition-all duration-700"
                          style={{ width: `${result.structPct}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* DETAILED DESCRIPTION */}
                    <div className="space-y-3 mb-8">
                      <h3 className="text-xs uppercase font-accent font-bold text-slate-600 tracking-wider">
                        Diagnostic Summary
                      </h3>
                      <p className="text-slate-800 leading-relaxed text-sm sm:text-base font-display">
                        {result.typeData.description}
                      </p>
                    </div>

                    {/* TRAITS GRID */}
                    <div className="mb-8">
                      <h3 className="text-xs uppercase font-accent font-bold text-slate-600 tracking-wider mb-3">
                        Key Behavioral Traits
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {result.typeData.traits.map((trait, i) => (
                          <div key={i} className="bg-[#f5f4f0] border-2 border-[#1a1a1a] p-3 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-[#e8841a] shrink-0 mt-0.5" />
                            <span className="text-xs font-bold text-[#1a1a1a] font-display">{trait}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* MERCH CALLOUT */}
                    <div className="bg-[#8ecfdb] p-5 border-2 border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-white border-2 border-[#1a1a1a] text-[#1a1a1a]">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-[10px] uppercase font-accent font-bold text-[#1a1a1a]">Recommended Merch</div>
                          <div className="font-black text-[#1a1a1a] text-sm font-display">{result.typeData.merch.name}</div>
                          <div className="text-xs text-slate-800 font-display">{result.typeData.merch.desc}</div>
                        </div>
                      </div>
                      <span className="font-accent font-bold text-sm bg-white text-[#1a1a1a] px-3 py-1.5 border-2 border-[#1a1a1a]">
                        {result.typeData.merch.price}
                      </span>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 border-t-2 border-[#1a1a1a] pt-6">
                      <button
                        onClick={copyResultsToClipboard}
                        className="w-full sm:w-auto retro-button bg-white text-[#1a1a1a] font-black px-6 py-3.5 text-xs uppercase font-accent inline-flex items-center justify-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-[#1a6b6b]" />
                            <span className="text-[#1a6b6b]">Copied To Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4 text-[#e8841a]" />
                            <span>Share Your Archetype</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={resetQuiz}
                        className="w-full sm:w-auto retro-button bg-[#e8841a] text-white font-black px-6 py-3.5 text-xs uppercase font-accent inline-flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retake Personality Test</span>
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </>
          )}

        </main>

        {/* FOOTER */}
        <footer className="mt-12 pt-6 border-t-2 border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-accent text-slate-700">
          <div>
            &copy; {new Date().getFullYear()} Family Guy Guys: The Podcast. All cutaways reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Hosted by Jason, Tyler, & Collin</span>
          </div>
        </footer>

      </div>
    </div>
  );
}