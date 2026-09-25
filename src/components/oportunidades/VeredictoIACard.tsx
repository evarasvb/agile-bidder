import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { useVeredictoOportunidad, useGenerarVeredicto, type RecomendacionVeredicto } from '@/hooks/useVeredictoOportunidad';

const ESTILO_RECOMENDACION: Record<RecomendacionVeredicto, { label: string; className: string; Icono: typeof CheckCircle2 }> = {
  ofertar: { label: 'Conviene ofertar', className: 'bg-green-500 text-white', Icono: CheckCircle2 },
  revisar: { label: 'Revisar antes de ofertar', className: 'bg-yellow-500 text-white', Icono: AlertTriangle },
  descartar: { label: 'No conviene', className: 'bg-destructive text-destructive-foreground', Icono: XCircle },
};

// Verdicto de IA ("¿me conviene?"): se genera bajo demanda (botón), nunca
// solo, para no gastar de más en cada visita a la oportunidad — el resultado
// queda cacheado en oportunidad_veredictos y se reusa hasta que el usuario
// pida regenerarlo.
export function VeredictoIACard({ tipo, codigo }: { tipo: 'licitacion' | 'compra_agil'; codigo: string | null }) {
  const { data: veredicto, isLoading } = useVeredictoOportunidad(tipo, codigo);
  const generar = useGenerarVeredicto(tipo, codigo);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          ¿Me conviene?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : veredicto ? (
          <>
            {(() => {
              const estilo = ESTILO_RECOMENDACION[veredicto.recomendacion];
              const Icono = estilo.Icono;
              return (
                <Badge className={`w-full justify-center gap-1.5 py-1.5 text-sm ${estilo.className}`}>
                  <Icono className="h-4 w-4" />
                  {estilo.label}
                </Badge>
              );
            })()}
            <p className="text-sm text-muted-foreground">{veredicto.razon}</p>
            {veredicto.puntos_favor.length > 0 && (
              <ul className="space-y-1 text-xs">
                {veredicto.puntos_favor.map((p, i) => (
                  <li key={`favor-${i}`} className="flex items-start gap-1.5 text-green-700 dark:text-green-400">
                    <span aria-hidden="true">+</span> {p}
                  </li>
                ))}
              </ul>
            )}
            {veredicto.puntos_contra.length > 0 && (
              <ul className="space-y-1 text-xs">
                {veredicto.puntos_contra.map((p, i) => (
                  <li key={`contra-${i}`} className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
                    <span aria-hidden="true">−</span> {p}
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1.5 text-muted-foreground"
              onClick={() => generar.mutate()}
              disabled={generar.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generar.isPending ? 'animate-spin' : ''}`} />
              Regenerar
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Pide una recomendación de IA sobre si te conviene postular a esta oportunidad, según tu inventario y el comprador.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => generar.mutate()}
              disabled={generar.isPending || !codigo}
            >
              <Sparkles className={`h-3.5 w-3.5 ${generar.isPending ? 'animate-pulse' : ''}`} />
              {generar.isPending ? 'Analizando…' : 'Generar veredicto'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
