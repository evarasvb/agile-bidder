import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CalendarioIntegrado from '../../src/pages/CalendarioIntegrado';
import Inventory from '../../src/pages/Inventory';
import { TooltipProvider } from '../../src/components/ui/tooltip';
import { CalendarBoundary } from '../../src/components/CalendarBoundary';
import '../../src/index.css';

let shouldCrash = false;
export function Crashable() { if (shouldCrash) throw new Error('isolated simulated render failure'); return <p>Contenido recuperado</p>; }
export function Harness() {
  const [crashed, setCrashed] = useState(false);
  return <>
    <nav><a href="#shell">Navegación disponible</a></nav>
    <p>Identidad autenticada simulada; API de prueba interceptada; sin autenticación Supabase real. Calendario y matches usan hooks simulados.</p>
    <section aria-label="Página Inventario de prueba"><Inventory /></section>
    <button onClick={() => { shouldCrash = true; setCrashed(true); }}>Simular fallo de render</button>
    <button onClick={() => { shouldCrash = false; }}>Restaurar render</button>
    <section aria-label="Render aislado"><CalendarBoundary><Crashable key={String(crashed)} /></CalendarBoundary></section>
    <section aria-label="Página Calendario de prueba"><CalendarioIntegrado /></section>
  </>;
}
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false,retryDelay:10}}})}><MemoryRouter><TooltipProvider><Harness /></TooltipProvider></MemoryRouter></QueryClientProvider>,
);
