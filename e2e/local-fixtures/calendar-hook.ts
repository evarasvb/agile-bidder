import { useState, useEffect } from 'react';
export function useCalendarioIntegrado() {
  const [mode, setMode] = useState('initial-error');
  useEffect(() => { const listener = (event: Event) => setMode((event as CustomEvent).detail); window.addEventListener('calendar-fixture', listener); return () => window.removeEventListener('calendar-fixture', listener); }, []);
  const cached = mode !== 'initial-error' && mode !== 'loading';
  return { events: cached ? [{id:'fixture-event',title:'Evento de prueba',type:'custom',start:new Date().toISOString(),allDay:false}] : [], isLoading: mode === 'loading', isFetching: mode === 'refreshing', isStale: mode === 'refreshing', hasPreviousData:cached, error: mode.includes('error') ? new Error('isolated timeout') : null,
    refetch: () => { setMode('success'); return Promise.resolve(); },
    createEvent: { isPending: false, mutateAsync: async () => ({}) },
    deleteEvent: { isPending: false, mutate: () => {} },
  };
}
