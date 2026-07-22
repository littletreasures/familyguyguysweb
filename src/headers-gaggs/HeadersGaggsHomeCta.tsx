import React from 'react';
import { trackHeadersGaggsEvent } from '../lib/headersGaggsAnalytics';

export const HeadersGaggsHomeCta: React.FC = () => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackHeadersGaggsEvent('headers_gaggs_cta_clicked', { location: 'home' });

    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/headers-gaggs');
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="headers-gaggs-cta-module">
      <div className="headers-gaggs-cta-inner">
        <h2 className="headers-gaggs-cta-title">THE HEADERS-GAGGS TEST</h2>
        <p className="headers-gaggs-cta-copy">
          A highly legitimate Myers-Briggs-style evaluation for people who have opinions about how
          long a chicken fight should last.
        </p>
        <a href="/headers-gaggs" onClick={handleClick} className="btn-orange headers-gaggs-cta-btn">
          Begin the Evaluation &rarr;
        </a>
      </div>
    </div>
  );
};
