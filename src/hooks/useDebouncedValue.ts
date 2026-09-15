import { useEffect, useState } from 'react';

/** Devuelve el valor solo cuando deja de cambiar por `ms` (para búsquedas al servidor). */
export function useDebouncedValue<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
