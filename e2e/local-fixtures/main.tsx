import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CalendarioIntegrado from '../../src/pages/CalendarioIntegrado';
import { QueryFeedback } from '../../src/components/QueryFeedback';
import { CalendarBoundary } from '../../src/components/CalendarBoundary';
import '../../src/index.css';

let shouldCrash = false;
function Crashable() { if (shouldCrash) throw new Error('isolated simulated render failure'); return <p>Contenido recuperado</p>; }
function Harness() {
  const [failed, setFailed] = useState(true);
  const [crashed, setCrashed] = useState(false);
  return <>
    <nav><a href="#shell">Navegación disponible</a></nav>
    <section aria-label="Inventario simulado">
      <QueryFeedback error={failed ? new Error('57014') : null} label="el inventario" onRetry={() => setFailed(false)}>
        <p>Producto recuperado</p>
      </QueryFeedback>
    </section>
    <button onClick={() => { shouldCrash = true; setCrashed(true); }}>Simular fallo de render</button>
    <button onClick={() => { shouldCrash = false; }}>Restaurar render</button>
    <section aria-label="Render aislado"><CalendarBoundary><Crashable key={String(crashed)} /></CalendarBoundary></section>
    <CalendarioIntegrado />
  </>;
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><MemoryRouter><Harness /></MemoryRouter></QueryClientProvider>,
);
