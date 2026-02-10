import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// #region agent log
fetch('http://127.0.0.1:7242/ingest/240d5f97-0e7f-435f-997f-7f599a21e610', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'log_' + Date.now() + '_index',
    timestamp: Date.now(),
    runId: 'pre-fix',
    hypothesisId: 'H1',
    location: 'index.tsx:1-4',
    message: 'Index bootstrap - React/ReactDOM snapshot',
    data: {
      reactVersion: (React as any).version,
      reactDomVersion: (ReactDOM as any).version,
      hasUseEffect: typeof (React as any).useEffect,
      hasUseState: typeof (React as any).useState,
      importmapScriptCount: typeof document !== 'undefined' ? document.querySelectorAll('script[type="importmap"]').length : null,
      hasDevtoolsHook: typeof (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined'
    }
  })
}).catch(() => {});

// Extra log to detect multiple React renderers via DevTools hook (H2)
try {
  const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook && hook.renderers) {
    const renderers = Array.from(hook.renderers.values?.() ?? Object.values(hook.renderers));
    fetch('http://127.0.0.1:7242/ingest/240d5f97-0e7f-435f-997f-7f599a21e610', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'log_' + Date.now() + '_renderers',
        timestamp: Date.now(),
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'index.tsx:20-35',
        message: 'React DevTools renderers snapshot',
        data: {
          rendererCount: renderers.length,
          renderers: renderers.map((r: any) => ({
            packageName: r.rendererPackageName,
            version: r.version
          }))
        }
      })
    }).catch(() => {});
  }
} catch {
  // ignore
}
// #endregion

// Tenta renderizar o app, mas avisa no console se houver erro crítico
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Erro Crítico: Não foi encontrado o elemento 'root' no index.html");
}