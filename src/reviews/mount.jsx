import React from 'react';
import { createRoot } from 'react-dom/client';
import ReviewApp from './ReviewApp.tsx';
import './styles/reviews.css';

export function mountReviews(container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ReviewApp />
    </React.StrictMode>
  );
}
