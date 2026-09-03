import { AlertTriangle, ShieldAlert, ShieldCheck, HelpCircle, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganismoRiesgo } from '@/hooks/useOrganismoRiesgo';
import { usePlan } from '@/hooks/usePlan';
import { useRequirePro } from '@/components/pro/UpgradeProProvider';
import { Lock } from 'lucide-react';

interface Props {
  /** Código del proceso (licitación o compra ágil): permite ubicar el RUT exacto del organismo. */
  codigo?: string | null;
  /** Nombre del organismo, como respaldo cuando el código no está en la base. */
  organismo?: string | null;
}

const NIVEL = {
  alto: { texto: 'Riesgo alto', clase: 'bg-red-100 text-red-800 border-red-300', Icono: ShieldAlert },
  medio: { texto: 'Riesgo medio', clase: 'bg-yellow-100 text-yellow-800 border-yellow-300', Icono: AlertTriangle },
  bajo: { texto: 'Riesgo bajo', clase: 'bg-green-100 text-green-800 border-green-300', Icono: ShieldCheck },
  sin_dato: { texto: 'Sin dato', clase: 'bg-muted text-muted-foreground', Icono: HelpCircle },
} as const;

const fecha = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CL') : 's/i');

/**
 * Riesgo de pago del organismo comprador, con los mismos datos que usa el Experto:
 * reclamos por no pago de la ficha de Mercado Público, desglose pago/proceso del buscador
 * de reclamos, ratio por cada 100 procesos y concentración por reclamante.
 */
export function RiesgoOrganismoCard({ codigo, organismo }: Props) {
  const navigate = useNavigate();
  const { verInteligencia } = usePlan();
  const { requirePro } = useRequirePro();
  const { data, isLoading } = useOrganismoRiesgo(verInteligencia ? codigo : null, verInteligencia ? organismo : null);

  // Modo vitrina (free): se muestra que el dato existe, no el dato.
  if (!verInteligencia) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-lg">¿Cómo paga este organismo?</CardTitle>
            <Badge variant="outline" className="bg-muted text-muted-foreground"><Lock className="h-3.5 w-3.5 mr-1" />Pro</Badge>
          </div>
          {organismo && <p className="text-xs text-muted-foreground">{organismo}</p>}
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Reclamos por no pago en Mercado Público, plazo real de pago, quién le gana a este organismo y a qué precio.
          </p>
          <Button size="sm" onClick={() => requirePro(undefined, 'Ver el riesgo de pago del organismo y quién le gana')}>
            <Sparkles className="h-4 w-4 mr-1" />
            Ver riesgo y competencia (Pro)
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) return null;
  const n = NIVEL[data.nivel] ?? NIVEL.sin_dato;
  const concentrado = (data.top_reclamante_pct ?? 0) > 50 && (data.reclamos_pago_12m ?? 0) >= 5;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">¿Cómo paga este organismo?</CardTitle>
          <Badge variant="outline" className={n.clase}>
            <n.Icono className="h-3.5 w-3.5 mr-1" />
            {n.texto}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{data.institucion}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.nivel === 'sin_dato' ? (
          <p className="text-sm text-muted-foreground">
            Todavía no tenemos lectura de Mercado Público para este organismo. Se actualiza automáticamente.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Reclamos por no pago (12 meses)</p>
              <p className="text-2xl font-bold">{data.reclamos_ficha ?? data.reclamos_pago_12m ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground">Ficha Mercado Público al {fecha(data.dato_pago_al)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Por cada 100 procesos publicados</p>
              <p className="text-2xl font-bold">{data.pago_por_100_procesos ?? '—'}</p>
              <p className="text-[11px] text-muted-foreground">
                {data.procesos_12m ?? 0} procesos en 12 meses
              </p>
            </div>
            {data.reclamos_pago_12m != null && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Buscador de reclamos MP: <span className="font-medium text-foreground">{data.reclamos_pago_12m}</span> por pago no oportuno,{' '}
                <span className="font-medium text-foreground">{data.reclamos_proceso_12m ?? 0}</span> por irregularidad en el proceso,{' '}
                {data.reclamos_pago_90d ?? 0} de pago en los últimos 90 días.
                {data.reclamos_desde && <> Datos desde {fecha(data.reclamos_desde)}.</>}
              </div>
            )}
            {concentrado && (
              <div className="col-span-2 flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                Un solo reclamante concentra el {data.top_reclamante_pct}% de los reclamos de pago: puede ser un
                conflicto puntual, no un mal pagador general.
              </div>
            )}
            {data.plazo_pago && (
              <div className="col-span-2 text-xs text-muted-foreground">
                Plazo de pago declarado en sus licitaciones: <span className="text-foreground">{data.plazo_pago}</span>
              </div>
            )}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/experto?pregunta=${encodeURIComponent(`¿Es riesgoso venderle a ${data.institucion}? ¿Cómo paga?`)}`)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Preguntarle al Experto
        </Button>
      </CardContent>
    </Card>
  );
}
