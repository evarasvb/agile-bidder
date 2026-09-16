import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Sparkles, Crown, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePlan } from '@/hooks/usePlan';
import { useExpertoLanzamiento } from '@/hooks/useExpertoLanzamiento';
import { PLANES } from '@/data/planes';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

/** Escalera de planes con activación por Mercado Pago (Experto Pro/Plus: pago único; ERP: suscripción). */
export function PlanesEscalera() {
  const { session } = useAuth();
  const { isPro } = usePlan();
  const { data: lanzamiento } = useExpertoLanzamiento(false);
  const enBeta = lanzamiento?.fase !== 'monetizacion';
  const location = useLocation();
  const [cargando, setCargando] = useState<string | null>(null);
  const { data: experto } = useQuery({
    queryKey: ['experto_pro_estado', session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => (await supabase.from('experto_pro').select('nivel, hasta').eq('user_id', session!.user.id).maybeSingle()).data as { nivel: string; hasta: string } | null,
  });
  const expertoActivo = experto && new Date(experto.hasta) > new Date() ? experto : null;
  // Prueba gratis de Experto Pro: 14 dias, una vez por cuenta y sin tarjeta.
  const { data: prueba, refetch: refetchPrueba } = useQuery({
    queryKey: ['experto_prueba_estado', session?.user?.id], enabled: !!session?.user?.id && !enBeta,
    queryFn: async () => ((await (supabase as any).rpc('experto_prueba_estado')).data?.[0] ?? null) as { disponible: boolean; usada_en: string | null; hasta: string | null } | null,
  });
  const iniciarPrueba = async () => {
    setCargando('prueba');
    const { error } = await supabase.rpc('experto_prueba_iniciar');
    setCargando(null);
    if (error) { toast.error(error.message.replace(/^.*?: /, '')); return; }
    toast.success('Experto Pro activo por 14 días. Abre una licitación y arma su sala de postulación.');
    refetchPrueba(); window.location.reload();
  };
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('pago');
    if (p === 'ok') toast.success('Pago recibido. Tu plan del Experto queda activo en segundos.');
    else if (p === 'pendiente') toast.info('Tu pago quedó pendiente en Mercado Pago; se activa solo al aprobarse.');
    else if (p === 'error') toast.error('El pago no se completó.');
  }, [location.search]);

  const pagar = async (producto: 'pro_30' | 'plus_30') => {
    if (!session?.access_token) return;
    setCargando(producto);
    try {
      const r = await fetch(`${SUPA}/functions/v1/crear-pago-experto`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ producto, back_url: window.location.origin + '/cuenta' }) });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      window.location.href = j.url;
    } catch (e: any) { toast.error('No pude iniciar el pago: ' + e.message); setCargando(null); }
  };

  const actual = (id: string) => (id === 'erp' && isPro) || (id === 'plus_30' && !isPro && expertoActivo?.nivel === 'plus') || (id === 'pro_30' && !isPro && expertoActivo?.nivel === 'pro') || (id === 'free' && !isPro && !expertoActivo);

  if (enBeta) {
    const usados = lanzamiento?.cupos_usados ?? 0;
    const maximo = lanzamiento?.cupos_maximos ?? 10;
    return (
      <div className="rounded-xl border border-firmavb-blue/30 bg-firmavb-blue/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-firmavb-blue p-2 text-white"><Users className="h-5 w-5" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">Beta fundadora · 10 empresas</p>
              <Badge>Gratis durante esta etapa</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Estamos trabajando con los primeros 10 clientes para afinar el Experto. No hay prueba de 14 días, plan Pro ni cobro activos ahora.
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-firmavb-blue transition-all" style={{ width: `${Math.min(100, (usados / maximo) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{usados} de {maximo} cupos ocupados</p>
            <Button size="sm" className="mt-4" asChild><Link to="/experto">Usar el Experto</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="text-muted-foreground">Plan actual:</span>
        <Badge variant={isPro ? 'default' : 'secondary'}>{isPro ? 'FirmaVB ERP' : 'Gratis'}</Badge>
        {expertoActivo && !isPro && <Badge variant="outline">Experto {expertoActivo.nivel === 'plus' ? 'Plus' : 'Pro'} hasta {new Date(expertoActivo.hasta).toLocaleDateString('es-CL')}</Badge>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANES.map((p) => {
          const id = p.id;
          return (
          <div key={id} className={`rounded-lg border p-3 ${actual(id) ? 'border-primary bg-primary/5' : ''}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold flex items-center gap-1">{id === 'erp' ? <Crown className="h-4 w-4 text-primary" /> : id !== 'free' ? <Sparkles className="h-4 w-4 text-primary" /> : null}{p.nombre}</p>
              <p className="text-sm"><span className="text-lg font-bold">{p.precio}</span> <span className="text-muted-foreground text-xs">{p.periodo}</span></p>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {p.puntos.map((x) => <li key={x} className="flex items-start gap-1"><Check className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />{x}</li>)}
            </ul>
            <div className="mt-3">
              {actual(id) ? <Badge variant="outline">Tu plan</Badge>
                : id === 'free' ? null
                : id === 'erp' ? <Button size="sm" className="w-full" asChild><Link to="/cuenta/facturacion">Suscribirme al ERP</Link></Button>
                : <>
                  {id === 'pro_30' && prueba?.disponible && <Button size="sm" className="w-full mb-1" disabled={!!cargando} onClick={iniciarPrueba}>{cargando === 'prueba' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Probar 14 días gratis, sin tarjeta'}</Button>}
                  <Button size="sm" variant="outline" className="w-full" disabled={!!cargando || isPro} onClick={() => pagar(id)}>{cargando === id ? <Loader2 className="h-4 w-4 animate-spin" /> : `Activar ${p.nombre}`}</Button>
                </>}
            </div>
          </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Tienes un resultado gratis y, al iniciar sesión, puedes activar una prueba Pro de 14 días una sola vez y sin tarjeta. Después, Pro y Plus se activan con un pago único de Mercado Pago por 30 días; el ERP es una suscripción mensual que puedes cancelar cuando quieras e incluye el Experto completo. El ERP es $149.990 netos más IVA ($178.488). La comisión del 3% se calcula sobre el neto de cada orden de compra aceptada de ofertas enviadas desde FirmaVB, se factura mes vencido con IVA y sin tope.</p>
    </div>
  );
}
