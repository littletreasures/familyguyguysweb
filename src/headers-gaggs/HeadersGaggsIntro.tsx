import React from 'react';

interface HeadersGaggsIntroProps {
  onStart: () => void;
}

export const HeadersGaggsIntro: React.FC<HeadersGaggsIntroProps> = ({ onStart }) => {
  return (
    <div className="headers-gaggs-intro-container">
      <div className="headers-gaggs-badge">
        <span>8 questions. 0 science.</span>
      </div>

      <h1 className="headers-gaggs-title">THE HEADERS-GAGGS TEST</h1>

      <p className="headers-gaggs-subheading">
        A completely legitimate personality assessment for determining whether you are a
        Structurehead, a Gagger, or something much worse.
      </p>

      <div className="headers-gaggs-support-copy">
        <p>Every comedy fan operates along two primal comedy-preference axes:</p>
        <div className="headers-gaggs-axes-grid">
          <div className="headers-gaggs-axis-card">
            <h4>Taste Axis</h4>
            <p>
              <strong>Gagger vs. Structurehead</strong> — Do you live for unhinged cutaways and
              8-minute chicken fights, or do you demand three-act discipline and screenwriting
              logic?
            </p>
          </div>
          <div className="headers-gaggs-axis-card">
            <h4>Resolution Axis</h4>
            <p>
              <strong>Hat on a Hat vs. Cherry on Top</strong> — Do you insist on stacking absurd
              bits upon absurd bits, or do you crave a crisp, satisfying final button?
            </p>
          </div>
        </div>
      </div>

      <div className="headers-gaggs-cta-wrapper">
        <button onClick={onStart} className="btn-orange headers-gaggs-start-btn">
          Begin the Evaluation &rarr;
        </button>
      </div>
    </div>
  );
};
