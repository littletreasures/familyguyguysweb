import React from "react";
import { HEADERS_GAGGS_QUESTIONS } from "../data/headersGaggsQuiz";
import { useHeadersGaggsQuiz } from "./useHeadersGaggsQuiz";
import { HeadersGaggsIntro } from "./HeadersGaggsIntro";
import { HeadersGaggsQuestion } from "./HeadersGaggsQuestion";
import { HeadersGaggsResult } from "./HeadersGaggsResult";

export const HeadersGaggsApp: React.FC = () => {
  const {
    currentStep,
    totalQuestions,
    userAnswers,
    isDirectResult,
    activeResult,
    scoreSummary,
    startQuiz,
    selectOption,
    nextQuestion,
    prevQuestion,
    retakeQuiz,
  } = useHeadersGaggsQuiz();

  return (
    <div className="headers-gaggs-app-wrapper">
      {currentStep === 0 && <HeadersGaggsIntro onStart={startQuiz} />}

      {currentStep >= 1 && currentStep <= totalQuestions && (
        <HeadersGaggsQuestion
          question={HEADERS_GAGGS_QUESTIONS[currentStep - 1]}
          questionNumber={currentStep}
          totalQuestions={totalQuestions}
          selectedOptionIndex={userAnswers[HEADERS_GAGGS_QUESTIONS[currentStep - 1].id]}
          onSelectOption={(idx) => selectOption(HEADERS_GAGGS_QUESTIONS[currentStep - 1].id, idx)}
          onNext={nextQuestion}
          onPrev={prevQuestion}
        />
      )}

      {currentStep > totalQuestions && activeResult && (
        <HeadersGaggsResult
          result={activeResult}
          scoreSummary={scoreSummary}
          isDirectResult={isDirectResult}
          onRetake={retakeQuiz}
        />
      )}
    </div>
  );
};
