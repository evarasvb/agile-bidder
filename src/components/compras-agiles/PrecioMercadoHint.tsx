import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/clasificacion';

interface Props { nombre: string; onUsar: (precio: number) => void; disabled?: boolean }

/** Precio que el Estado pagó por este producto en OC reales (12 meses): mín, mediana y líder. */
export function PrecioMercadoHint({ nombre, onUsar, disabled }: Props) {
  const texto = nombre.replace(/[^a-záéíóúñ0-9 ]/gi, ' ').split(/\s+/).filter((w) => w.length > 2).slice(0, 4).join(' ');
  const { data } = useQuery({
    queryKey: ['precio_mercado', texto],
    enabled: texto.length > 3,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => ((await (supabase as any).rpc('precio_mercado', { p_texto: texto })).data?.[0] ?? null) as { proveedores: number; ordenes: number; precio_min: number; precio_mediano: number; precio_max: number; lider: string | null; lider_precio: number | null } | null,
  });
  if (!data || !data.proveedores) return null;
  const objetivo = Math.round(Number(data.precio_mediano) * 0.97);
  return (
    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
      <p>Mercado (12 m): mediana {formatCurrency(Number(data.precio_mediano))} · mín {formatCurrency(Number(data.precio_min))} · {data.proveedores} proveedores, {data.ordenes} OC{data.lider ? ` · líder ${data.lider}` : ''}</p>
      <button type="button" disabled={disabled} onClick={() => onUsar(objetivo)} className="underline text-primary disabled:opacity-50">
        Usar precio del Experto: {formatCurrency(objetivo)} (mediana −3%)
      </button>
    </div>
  );
}
