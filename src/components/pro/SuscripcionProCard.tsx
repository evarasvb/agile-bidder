import { useState } from 'react';
import { Sparkles, Check, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePlan } from '@/hooks/usePlan';

const BENEFICIOS = [
  'Cotizar y postular a licitaciones y compras ágiles',
  'Auto-bid y generación de ofertas con IA',
  'Gestionar pipeline, equipo y órdenes de compra',
  'Reportes e inteligencia de mercado completos',
  'Inventario ilimitado y matching automático',
];

export function SuscripcionProCard() {
  const { isPro, loading } = usePlan();
  const [redirigiendo, setRedirigiendo] = useState(false);

  const suscribirme = async () => {
    setRedirigiendo(true);
    try {
      const { data, error } = await supabase.functions.invoke('crear-suscripcion-mp', {
        body: { back_url: `${window.location.origin}/cuenta/facturacion?sub=ok` },
      });
      if (error) throw error;
      const initPoint = (data as any)?.init_point;
      if (!initPoint) {
        throw new Error((data as any)?.error || 'No se pudo iniciar la suscripción');
      }
      // Redirige al checkout de MercadoPago.
      window.location.href = initPoint;
    } catch (e) {
      console.error('[SuscripcionPro]', e);
      toast.error('No se pudo iniciar la suscripción. Revisa que MercadoPago esté configurado e inténtalo de nuevo.');
      setRedirigiendo(false);
    }
  };

  if (loading) return null;

  if (isPro) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg">Plan FirmaVB ERP activo</CardTitle>
          </div>
          <Badge className="bg-green-600">ERP</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Tienes acceso completo para gestionar todas tus oportunidades. Tu suscripción se renueva
          automáticamente cada mes por $149.990 más 3% de las órdenes de compra aceptadas que postulaste desde FirmaVB. Incluye el Experto Pro y Plus.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Hazte FirmaVB ERP</CardTitle>
        </div>
        <CardDescription>
          Con el plan gratuito miras las oportunidades. Para postular, gestionar y tener el Experto completo, activa el ERP.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">$149.990</span>
          <span className="text-muted-foreground">/mes</span>
        </div>
        <ul className="space-y-2">
          {BENEFICIOS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button className="w-full" onClick={suscribirme} disabled={redirigiendo}>
          {redirigiendo ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirigiendo a MercadoPago...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Suscribirme a Pro
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Pago mensual seguro con MercadoPago. Puedes cancelar cuando quieras.
        </p>
      </CardContent>
    </Card>
  );
}
