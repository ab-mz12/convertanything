import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// A lazily loaded chunk can go missing after a deployment (the page is still the old version but
// the server only has the new files). Reloading once picks up the new version.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const key = 'ca-reloaded-after-preload-error';
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
