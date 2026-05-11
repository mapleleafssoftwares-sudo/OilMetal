import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Catch JS errors that happen outside React's tree (e.g. async effects)
// and show them visibly instead of a blank page.
window.addEventListener('error', (e) => {
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="padding:2rem;font-family:sans-serif;color:#dc2626">
      <b>Error:</b> ${e.message}<br/><small>${e.filename}:${e.lineno}</small><br/>
      <button onclick="location.reload()" style="margin-top:1rem;padding:.5rem 1rem;background:#2563eb;color:#fff;border:none;border-radius:.5rem;cursor:pointer">Recargar</button>
    </div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
