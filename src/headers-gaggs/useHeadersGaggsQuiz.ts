import { useState, useEffect, useCallback } from "react";
import { HEADERS_GAGGS_QUESTIONS, ResultCode } from "../data/headersGaggsQuiz";
import { HEADERS_GAGGS_RESULTS } from "../data/headersGaggsResults";
import { calculateQuizScore, isValidResultCode, ScoreSummary } from "../lib/headersGaggsScoring";
import { trackHeadersGaggsEvent } from "../lib/headersGaggsAnalytics";

export function useHeadersGaggsQuiz() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [directResultCode, setDirectResultCode] = useState<ResultCode | null>(null);

  // Check URL query parameters for direct result link on load/route change
  const checkUrlResult = useCallback(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const resultParam = urlParams.get("result");

    if (resultParam && isValidResultCode(resultParam)) {
      setDirectResultCode(resultParam);
      setCurrentStep(HEADERS_GAGGS_QUESTIONS.length + 1);
    } else {
      setDirectResultCode(null);
    }
  }, []);

  useEffect(() => {
    checkUrlResult();
    trackHeadersGaggsEvent("headers_gaggs_viewed");

    const handlePopState = () => {
      checkUrlResult();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [checkUrlResult]);

  const startQuiz = useCallback(() => {
    setCurrentStep(1);
    setUserAnswers({});
    setDirectResultCode(null);
    if (window.location.search) {
      window.history.pushState({}, "", window.location.pathname);
    }
    trackHeadersGaggsEvent("headers_gaggs_started");
  }, []);

  const selectOption = useCallback((questionId: string, optionIndex: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  }, []);

  const nextQuestion = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      if (next > HEADERS_GAGGS_QUESTIONS.length) {
        const score = calculateQuizScore(userAnswers);
        const newUrl = `${window.location.pathname}?result=${score.code}`;
        window.history.pushState({}, "", newUrl);
        trackHeadersGaggsEvent("headers_gaggs_completed", { result_code: score.code });
      }
      return next;
    });
  }, [userAnswers]);

  const prevQuestion = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const retakeQuiz = useCallback(() => {
    setUserAnswers({});
    setDirectResultCode(null);
    setCurrentStep(0);
    if (window.location.search) {
      window.history.pushState({}, "", window.location.pathname);
    }
  }, []);

  const isDirectResult = directResultCode !== null;

  const scoreSummary: ScoreSummary | null = currentStep > HEADERS_GAGGS_QUESTIONS.length
    ? calculateQuizScore(userAnswers)
    : null;

  const activeResult = isDirectResult && directResultCode
    ? HEADERS_GAGGS_RESULTS[directResultCode]
    : scoreSummary?.result || null;

  return {
    currentStep,
    totalQuestions: HEADERS_GAGGS_QUESTIONS.length,
    userAnswers,
    isDirectResult,
    directResultCode,
    activeResult,
    scoreSummary,
    startQuiz,
    selectOption,
    nextQuestion,
    prevQuestion,
    retakeQuiz,
  };
}
