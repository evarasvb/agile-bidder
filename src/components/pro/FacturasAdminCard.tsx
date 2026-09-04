import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const clp = (n: number) => '$' + Math.round(Number(n)).toLocaleString('es-CL');

/** Solo admin: preformas y facturas de todos los clientes; marcar emitida (N° SII + PDF). */
export function FacturasAdminCard() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const esAdmin = session?.user?.email === 'evaras@firmavb.cl';
  const { data: filas = [] } = useQuery({ queryKey: ['facturas_admin'], enabled: esAdmin, queryFn: async () => ((await (supabase as any).rpc('facturas_admin')).data ?? []) as any[] });
  const [num, setNum] = useState<Record<string, string>>({});
  const [url, setUrl] = useState<Record<string, string>>({});
  if (!esAdmin) return null;
  const emitir = async (id: string) => {
    if (!num[id]) { toast.error('Ingresa el número de factura'); return; }
    const { error } = await (supabase as any).rpc('facturas_marcar_emitida', { p_id: id, p_numero: num[id], p_url: url[id] || null });
    if (error) toast.error(error.message); else { toast.success('Factura marcada como emitida'); qc.invalidateQueries({ queryKey: ['facturas_admin'] }); }
  };
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Administración: preformas y facturas por cobrar</CardTitle>
        <CardDescription>Cierre del día 1 → 2 días de validación → emites la factura en el SII y la marcas aquí → el cliente paga con Mercado Pago.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {filas.length === 0 && <p className="text-muted-foreground">Nada pendiente.</p>}
        {filas.map((f) => (
          <div key={f.id} className="rounded border p-2 flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[220px]">
              <b>{f.empresa ?? f.email}</b> · {f.periodo} · fijo {clp(f.fijo)} + comisión neta {clp(f.comision)} + IVA ({f.ocs ?? 0} OC) = <b>{clp(f.total)}</b>
              <div className="text-xs text-muted-foreground">{f.email}{f.numero_factura ? ` · N° ${f.numero_factura}` : ''}</div>
            </div>
            <Badge variant="outline">{f.estado}</Badge>
            {f.estado !== 'facturada' && (
              <>
                <Input className="h-8 w-28" placeholder="N° factura" value={num[f.id] ?? ''} onChange={(e) => setNum({ ...num, [f.id]: e.target.value })} />
                <Input className="h-8 w-56" placeholder="URL del PDF (opcional)" value={url[f.id] ?? ''} onChange={(e) => setUrl({ ...url, [f.id]: e.target.value })} />
                <Button size="sm" onClick={() => emitir(f.id)}>Marcar emitida</Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
