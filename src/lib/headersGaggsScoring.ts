import { HEADERS_GAGGS_QUESTIONS, ResultCode } from "../data/headersGaggsQuiz";
import { HEADERS_GAGGS_RESULTS } from "../data/headersGaggsResults";

export interface ScoreSummary {
  gagTotal: number;
  structTotal: number;
  hatTotal: number;
  cherryTotal: number;
  code: ResultCode;
  gagPct: number;
  structPct: number;
  hatPct: number;
  cherryPct: number;
  result: typeof HEADERS_GAGGS_RESULTS[ResultCode];
}

export function calculateQuizScore(userAnswers: Record<string, number>): ScoreSummary {
  let gagTotal = 0;
  let structTotal = 0;
  let hatTotal = 0;
  let cherryTotal = 0;

  HEADERS_GAGGS_QUESTIONS.forEach((q) => {
    const selectedIndex = userAnswers[q.id];
    if (selectedIndex !== undefined && q.options[selectedIndex]) {
      const scores = q.options[selectedIndex].scores;
      if (scores.gag) gagTotal += scores.gag;
      if (scores.struct) structTotal += scores.struct;
      if (scores.hat) hatTotal += scores.hat;
      if (scores.cherry) cherryTotal += scores.cherry;
    }
  });

  // Raw total tie policy:
  // Gagger vs Structurehead tie -> Structurehead ("S")
  // Hat on a Hat vs Cherry on Top tie -> Cherry on Top ("C")
  const taste = gagTotal > structTotal ? "G" : "S";
  const resolution = hatTotal > cherryTotal ? "H" : "C";
  const code = `${taste}-${resolution}` as ResultCode;

  // Independent display percentages (calculated post-classification)
  const tasteTotal = gagTotal + structTotal;
  const resolutionTotal = hatTotal + cherryTotal;

  const gagPct = tasteTotal > 0 ? Math.round((gagTotal / tasteTotal) * 100) : 50;
  const structPct = 100 - gagPct;

  const hatPct = resolutionTotal > 0 ? Math.round((hatTotal / resolutionTotal) * 100) : 50;
  const cherryPct = 100 - hatPct;

  return {
    gagTotal,
    structTotal,
    hatTotal,
    cherryTotal,
    code,
    gagPct,
    structPct,
    hatPct,
    cherryPct,
    result: HEADERS_GAGGS_RESULTS[code] || HEADERS_GAGGS_RESULTS["S-C"]
  };
}

export function isValidResultCode(code: string | null): code is ResultCode {
  return code === "G-H" || code === "G-C" || code === "S-H" || code === "S-C";
}
