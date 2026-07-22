import { describe, it, expect } from "vitest";
import { calculateQuizScore, isValidResultCode } from "../src/lib/headersGaggsScoring";
import { HEADERS_GAGGS_RESULTS } from "../src/data/headersGaggsResults";

describe("Headers-Gaggs Quiz Scoring", () => {
  it("resolves all ties to S-C (Structurehead / Cherry on Top) by policy when no answers given", () => {
    const emptyAnswers = {};
    const score = calculateQuizScore(emptyAnswers);

    expect(score.code).toBe("S-C");
    expect(score.result.name).toBe("The Bow-Tier");
    expect(score.gagPct).toBe(50);
    expect(score.structPct).toBe(50);
    expect(score.hatPct).toBe(50);
    expect(score.cherryPct).toBe(50);
  });

  it("correctly classifies G-H (The Gag Hatter)", () => {
    // Select option 0 for all questions (options 0 are heavily gag + hat biased)
    const answers = {
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      q5: 0,
      q6: 0,
      q7: 0,
      q8: 0,
    };
    const score = calculateQuizScore(answers);

    expect(score.code).toBe("G-H");
    expect(score.result.name).toBe("The Gag Hatter");
    expect(score.result.hostMatch).toBe("Collin Brown & 2004 Seth MacFarlane");
    expect(score.gagTotal).toBeGreaterThan(score.structTotal);
    expect(score.hatTotal).toBeGreaterThan(score.cherryTotal);
  });

  it("correctly classifies G-C (The Cherry Choker)", () => {
    // Select option 1 for all questions (options 1 are gag/struct + cherry biased)
    const answers = {
      q1: 1, // gag: 2, cherry: 3
      q2: 1, // gag: 2, cherry: 3
      q3: 0, // gag: 3, hat: 3
      q4: 1, // struct: 2, cherry: 3
      q5: 1, // gag: 1, cherry: 3
      q6: 0, // gag: 3, hat: 2
      q7: 0, // gag: 3, hat: 3
      q8: 1, // gag: 1, struct: 2, cherry: 3
    };
    const score = calculateQuizScore(answers);

    expect(score.code).toBe("G-C");
    expect(score.result.name).toBe("The Cherry Choker");
    expect(score.result.hostMatch).toBe("Tyler Simpson");
    expect(score.gagTotal).toBeGreaterThan(score.structTotal);
    expect(score.cherryTotal).toBeGreaterThan(score.hatTotal);
  });

  it("correctly classifies S-H (The Skyscraper Enthusiast)", () => {
    // Option 2 (index 2) across all questions (struct + hat biased)
    const answers = {
      q1: 2,
      q2: 2,
      q3: 2,
      q4: 2,
      q5: 2,
      q6: 2,
      q7: 2,
      q8: 2,
    };
    const score = calculateQuizScore(answers);

    expect(score.code).toBe("S-H");
    expect(score.result.name).toBe("The Skyscraper Enthusiast");
    expect(score.result.hostMatch).toBe("The Topher Grace Fan-Editor");
    expect(score.structTotal).toBeGreaterThan(score.gagTotal);
    expect(score.hatTotal).toBeGreaterThan(score.cherryTotal);
  });

  it("correctly classifies S-C (The Bow-Tier)", () => {
    // Option 3 (index 3) across all questions (struct + cherry biased)
    const answers = {
      q1: 3,
      q2: 3,
      q3: 3,
      q4: 3,
      q5: 3,
      q6: 3,
      q7: 3,
      q8: 3,
    };
    const score = calculateQuizScore(answers);

    expect(score.code).toBe("S-C");
    expect(score.result.name).toBe("The Bow-Tier");
    expect(score.result.hostMatch).toBe("Jason Hackett");
    expect(score.structTotal).toBeGreaterThan(score.gagTotal);
    expect(score.cherryTotal).toBeGreaterThan(score.hatTotal);
  });

  it("validates result code format accurately", () => {
    expect(isValidResultCode("G-H")).toBe(true);
    expect(isValidResultCode("G-C")).toBe(true);
    expect(isValidResultCode("S-H")).toBe(true);
    expect(isValidResultCode("S-C")).toBe(true);
    expect(isValidResultCode("INVALID")).toBe(false);
    expect(isValidResultCode("J-L")).toBe(false);
    expect(isValidResultCode(null)).toBe(false);
  });

  it("has exact verbatim result copy loaded for all 4 codes", () => {
    expect(HEADERS_GAGGS_RESULTS["G-H"].name).toBe("The Gag Hatter");
    expect(HEADERS_GAGGS_RESULTS["G-C"].name).toBe("The Cherry Choker");
    expect(HEADERS_GAGGS_RESULTS["S-H"].name).toBe("The Skyscraper Enthusiast");
    expect(HEADERS_GAGGS_RESULTS["S-C"].name).toBe("The Bow-Tier");

    Object.values(HEADERS_GAGGS_RESULTS).forEach((res) => {
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.axes.taste).toBeDefined();
      expect(res.axes.resolution).toBeDefined();
    });
  });

  it("calculates percentages independently post-classification and rounds correctly", () => {
    const score = calculateQuizScore({
      q1: 0, // gag: 3, hat: 2
      q2: 1, // gag: 2, cherry: 3
    });
    expect(score.gagPct).toBe(100);
    expect(score.structPct).toBe(0);
    expect(score.hatPct).toBe(40);
    expect(score.cherryPct).toBe(60);
    expect(score.gagPct + score.structPct).toBe(100);
    expect(score.hatPct + score.cherryPct).toBe(100);
  });
});
