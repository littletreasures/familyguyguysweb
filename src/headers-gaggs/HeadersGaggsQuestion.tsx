import React from 'react';
import { QuizQuestion } from '../data/headersGaggsQuiz';
import { HeadersGaggsProgress } from './HeadersGaggsProgress';

interface HeadersGaggsQuestionProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionIndex?: number;
  onSelectOption: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const HeadersGaggsQuestion: React.FC<HeadersGaggsQuestionProps> = ({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionIndex,
  onSelectOption,
  onNext,
  onPrev,
}) => {
  const isOptionSelected = selectedOptionIndex !== undefined;

  return (
    <div className="headers-gaggs-question-card">
      <HeadersGaggsProgress currentStep={questionNumber} totalSteps={totalQuestions} />

      {question.category && <div className="headers-gaggs-category-tag">{question.category}</div>}

      <h2 className="headers-gaggs-question-prompt">{question.prompt}</h2>

      <div className="headers-gaggs-options-list" role="group" aria-label={question.prompt}>
        {question.options.map((option, idx) => {
          const isSelected = selectedOptionIndex === idx;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectOption(idx)}
              className={`headers-gaggs-option-btn ${isSelected ? 'selected' : ''}`}
            >
              <span className="headers-gaggs-option-radio" aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
              <span className="headers-gaggs-option-text">{option.text}</span>
            </button>
          );
        })}
      </div>

      <div className="headers-gaggs-question-nav">
        <button type="button" onClick={onPrev} className="headers-gaggs-back-btn">
          &larr; Back
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!isOptionSelected}
          className={`headers-gaggs-next-btn ${isOptionSelected ? 'enabled' : 'disabled'}`}
        >
          {questionNumber === totalQuestions ? 'Calculate Result &rarr;' : 'Next Question'}
        </button>
      </div>
    </div>
  );
};
