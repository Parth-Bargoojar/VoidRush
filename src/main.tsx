/**
 * VOIDRUSH — entry point.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initPwa } from './pwa/pwa';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('VOIDRUSH: #root is missing from the document');
}

// Before React, so an early beforeinstallprompt is never missed.
initPwa();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
