import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Package, HandCoins, Gavel, Sparkles, Loader2 } from 'lucide-react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useBusquedaGlobal, type ResultadoBusqueda, type TipoResultado } from '@/hooks/useBusquedaGlobal';

const ICONO: Record<TipoResultado, typeof Search> = {
  licitacion: Gavel,
  compra_agil: HandCoins,
  producto: Package,
  producto_sugerido: Sparkles,
  factura: FileText,
};

const GRUPO: Record<TipoResultado, string> = {
  licitacion: 'Licitaciones',
  compra_agil: 'Compras ágiles',
  producto: 'Tu inventario',
  producto_sugerido: 'Sugerido por IA',
  factura: 'Cobranza',
};

const ORDEN_GRUPOS: TipoResultado[] = ['licitacion', 'compra_agil', 'producto', 'producto_sugerido', 'factura'];

// La barra superior tiene versiones distintas para móvil y escritorio (dos
// contenedores separados en AppLayout), así que el botón que abre el
// buscador se monta dos veces; el diálogo en sí (con su estado y su query)
// vive una sola vez acá y se comparte por contexto.
const AbrirBusquedaContext = createContext<() => void>(() => {});
export const useAbrirBusquedaGlobal = () => useContext(AbrirBusquedaContext);

export function BusquedaGlobalTrigger({ variant = 'barra', className }: { variant?: 'barra' | 'icono'; className?: string }) {
  const abrir = useAbrirBusquedaGlobal();
  if (variant === 'icono') {
    return (
      <Button variant="ghost" size="icon" aria-label="Buscar" onClick={abrir} className={className}>
        <Search className="h-5 w-5" />
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" className="h-9 w-64 justify-start gap-2 text-muted-foreground" onClick={abrir}>
      <Search className="h-4 w-4" />
      <span className="truncate">Buscar…</span>
      <CommandShortcut className="ml-auto">Ctrl K</CommandShortcut>
    </Button>
  );
}

// Buscador único de la app (Ctrl+K / Cmd+K): cruza oportunidades, inventario
// y facturas en un solo golpe, en vez de tener que abrir cada módulo por
// separado. Envuelve AppLayout una sola vez.
export function BusquedaGlobalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const backfillHecho = useRef(false);
  const { data: resultados, isFetching } = useBusquedaGlobal(query);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    // Al abrir el buscador, completa en segundo plano los embeddings que
    // falten en el inventario (no bloquea la búsqueda por texto, que
    // funciona igual aunque esto todavía esté corriendo).
    if (!backfillHecho.current) {
      backfillHecho.current = true;
      supabase.functions.invoke('embeddings-inventario', {}).catch(() => {});
    }
  }, [open]);

  const seleccionar = (r: ResultadoBusqueda) => {
    setOpen(false);
    navigate(r.ruta);
  };

  const grupos = ORDEN_GRUPOS
    .map((tipo) => ({ tipo, items: (resultados || []).filter((r) => r.tipo === tipo) }))
    .filter((g) => g.items.length > 0);

  return (
    <AbrirBusquedaContext.Provider value={() => setOpen(true)}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Busca licitaciones, compras ágiles, productos, facturas…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Escribe al menos 2 letras.</p>
          ) : isFetching && !resultados?.length ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          ) : (
            <>
              <CommandEmpty>Sin resultados para "{query}".</CommandEmpty>
              {grupos.map(({ tipo, items }) => {
                const Icono = ICONO[tipo];
                return (
                  <CommandGroup key={tipo} heading={GRUPO[tipo]}>
                    {items.map((r) => (
                      <CommandItem key={`${r.tipo}-${r.id}`} value={`${r.tipo}-${r.id}-${r.titulo}`} onSelect={() => seleccionar(r)} className="cursor-pointer">
                        <Icono className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate">{r.titulo}</p>
                          {r.subtitulo && <p className="truncate text-xs text-muted-foreground">{r.subtitulo}</p>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </AbrirBusquedaContext.Provider>
  );
}
