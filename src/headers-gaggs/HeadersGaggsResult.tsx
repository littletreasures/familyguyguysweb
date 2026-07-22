import React from 'react';
import { QuizResult } from '../data/headersGaggsQuiz';
import { ScoreSummary } from '../lib/headersGaggsScoring';
import { HeadersGaggsShare } from './HeadersGaggsShare';

interface HeadersGaggsResultProps {
  result: QuizResult;
  scoreSummary: ScoreSummary | null;
  isDirectResult: boolean;
  onRetake: () => void;
}

export const HeadersGaggsResult: React.FC<HeadersGaggsResultProps> = ({
  result,
  scoreSummary,
  isDirectResult,
  onRetake,
}) => {
  return (
    <div className="headers-gaggs-result-card">
      <div className="headers-gaggs-result-header">
        <div className="headers-gaggs-result-code-pill">RESULT: {result.code}</div>
        {result.hostMatch && (
          <div className="headers-gaggs-host-match">
            Host Alignment: <strong>{result.hostMatch}</strong>
          </div>
        )}
      </div>

      <h1 className="headers-gaggs-result-title">
        {result.code} &mdash; {result.name.toUpperCase()}
      </h1>

      {/* Percentage meters - ONLY displayed when completed locally (suppressed on direct URL visits) */}
      {!isDirectResult && scoreSummary && (
        <div className="headers-gaggs-meters-container">
          <div className="headers-gaggs-meter-block">
            <div className="headers-gaggs-meter-labels">
              <span className="meter-label-left">GAGGER ({scoreSummary.gagPct}%)</span>
              <span className="meter-label-right">STRUCTUREHEAD ({scoreSummary.structPct}%)</span>
            </div>
            <div
              className="headers-gaggs-meter-bar"
              role="progressbar"
              aria-valuenow={scoreSummary.gagPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Gagger vs Structurehead percentage"
            >
              <div className="meter-fill-left" style={{ width: `${scoreSummary.gagPct}%` }} />
              <div className="meter-fill-right" style={{ width: `${scoreSummary.structPct}%` }} />
            </div>
          </div>

          <div className="headers-gaggs-meter-block">
            <div className="headers-gaggs-meter-labels">
              <span className="meter-label-left">HAT ON A HAT ({scoreSummary.hatPct}%)</span>
              <span className="meter-label-right">CHERRY ON TOP ({scoreSummary.cherryPct}%)</span>
            </div>
            <div
              className="headers-gaggs-meter-bar"
              role="progressbar"
              aria-valuenow={scoreSummary.hatPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Hat on a Hat vs Cherry on Top percentage"
            >
              <div className="meter-fill-left" style={{ width: `${scoreSummary.hatPct}%` }} />
              <div className="meter-fill-right" style={{ width: `${scoreSummary.cherryPct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Direct result fallback axes label */}
      {isDirectResult && (
        <div className="headers-gaggs-direct-axes-badge">
          <span>
            Taste: <strong>{result.axes.taste}</strong>
          </span>
          <span className="divider">&bull;</span>
          <span>
            Resolution: <strong>{result.axes.resolution}</strong>
          </span>
        </div>
      )}

      <div className="headers-gaggs-result-body">
        {result.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div className="headers-gaggs-credentials">
        Certified by the American Board of Television <del>Doctors</del> Guys
      </div>

      <div className="headers-gaggs-result-actions">
        <HeadersGaggsShare result={result} />
        <button onClick={onRetake} className="btn-teal headers-gaggs-retake-btn">
          {isDirectResult ? 'TAKE THE TEST YOURSELF' : 'RETAKE THE EVALUATION'}
        </button>
      </div>
    </div>
  );
};
