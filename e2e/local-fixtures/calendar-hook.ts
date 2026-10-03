import { useState } from 'react';
export function useCalendarioIntegrado() {
  const [failed, setFailed] = useState(true);
  return { events: [], isLoading: false, isFetching: false, error: failed ? new Error('isolated timeout') : null,
    refetch: () => { setFailed(false); return Promise.resolve(); },
    createEvent: { isPending: false, mutateAsync: async () => ({}) },
    deleteEvent: { isPending: false, mutate: () => {} },
  };
}
