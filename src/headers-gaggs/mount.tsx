import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { HeadersGaggsApp } from './HeadersGaggsApp';
import { HeadersGaggsHomeCta } from './HeadersGaggsHomeCta';

let appRoot: Root | null = null;
let ctaRoot: Root | null = null;

export function mountHeadersGaggsApp(container: HTMLElement) {
  if (appRoot) return;
  appRoot = createRoot(container);
  appRoot.render(
    <React.StrictMode>
      <HeadersGaggsApp />
    </React.StrictMode>
  );
}

export function mountHeadersGaggsCta(container: HTMLElement) {
  if (ctaRoot) return;
  ctaRoot = createRoot(container);
  ctaRoot.render(
    <React.StrictMode>
      <HeadersGaggsHomeCta />
    </React.StrictMode>
  );
}
