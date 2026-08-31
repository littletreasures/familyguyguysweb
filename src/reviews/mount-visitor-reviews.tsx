import React from 'react';
import { createRoot } from 'react-dom/client';
import { VisitorReviewsSection } from './VisitorReviewsSection';
import './styles/reviews.css';

export function mountVisitorReviews(container: HTMLElement, episodeId: string) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <VisitorReviewsSection episodeId={episodeId} />
    </React.StrictMode>
  );
}
