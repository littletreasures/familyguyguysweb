import React from "react";

interface HeadersGaggsProgressProps {
  currentStep: number;
  totalSteps: number;
}

export const HeadersGaggsProgress: React.FC<HeadersGaggsProgressProps> = ({
  currentStep,
  totalSteps,
}) => {
  const percentage = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="headers-gaggs-progress-wrapper">
      <div className="headers-gaggs-progress-info">
        <span className="headers-gaggs-step-label">
          Question {currentStep} of {totalSteps}
        </span>
        <span className="headers-gaggs-pct-label">{percentage}% Complete</span>
      </div>

      <div
        className="headers-gaggs-progress-bar-bg"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Question ${currentStep} of ${totalSteps}`}
      >
        <div
          className="headers-gaggs-progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
