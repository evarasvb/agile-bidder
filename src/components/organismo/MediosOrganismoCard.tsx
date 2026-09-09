import { useEffect, useRef, useState } from 'react';
import { Newspaper, Radio, Tv, Globe, Landmark, Users, Share2, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMediosOrganismo, useRefrescarMedios, type MencionMedio } from '@/hooks/useMediosOrganismo';

interface Props {
  codigo?: string | null;
  organismo?: string | null;
}

const TIPO: Record<MencionMedio['tipo_medio'], { texto: string; Icono: typeof Newspaper; clase: string }> = {
  diario: { texto: 'Diario', Icono: Newspaper, clase: 'bg-blue-50 text-blue-800 border-blue-200' },
  radio: { texto: 'Radio', Icono: Radio, clase: 'bg-purple-50 text-purple-800 border-purple-200' },
  tv: { texto: 'TV', Icono: Tv, clase: 'bg-pink-50 text-pink-800 border-pink-200' },
  portal: { texto: 'Portal', Icono: Globe, clase: 'bg-slate-50 text-slate-700 border-slate-200' },
  oficial: { texto: 'Oficial', Icono: Landmark, clase: 'bg-green-50 text-green-800 border-green-200' },
  gremio: { texto: 'Gremio', Icono: Users, clase: 'bg-amber-50 text-amber-800 border-amber-200' },
  redes: { texto: 'Redes', Icono: Share2, clase: 'bg-sky-50 text-sky-800 border-sky-200' },
  otro: { texto: 'Prensa', Icono: Globe, clase: 'bg-muted text-muted-foreground' },
};

const fecha = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/**
 * Qué dicen los medios del organismo comprador: diarios, radios, TV, portales y prensa oficial de
 * los últimos 12 meses. Sirve para leer el contexto antes de ofertar (recortes, cambios de
 * autoridad, proyectos, conflictos) y el Experto cita las mismas notas.
 */
export function MediosOrganismoCard({ codigo, organismo }: Props) {
  const { data, isLoading } = useMediosOrganismo(codigo, organismo);
  const refrescar = useRefrescarMedios(codigo, organismo);
  const [verTodo, setVerTodo] = useState(false);
  const pedido = useRef(false);

  // Primera vez sin datos: se pide al robot en el momento (una sola vez por pantalla).
  useEffect(() => {
    if (!isLoading && data && data.length === 0 && !pedido.current && (codigo || organismo)) {
      pedido.current = true;
      refrescar.mutate(false);
    }
  }, [isLoading, data, codigo, organismo]); // eslint-disable-line react-hooks/exhaustive-deps

  const menciones = data ?? [];
  const visibles = verTodo ? menciones : menciones.slice(0, 5);
  const revisado = menciones[0]?.revisado_en ?? null;
  const cargando = isLoading || refrescar.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2"><Newspaper className="h-5 w-5 text-firmavb-blue" />Qué dicen los medios</CardTitle>
          <Button variant="ghost" size="sm" disabled={cargando} onClick={() => refrescar.mutate(true)} title="Buscar notas nuevas">
            <RefreshCw className={`h-4 w-4 ${refrescar.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {organismo && <p className="text-xs text-muted-foreground">{organismo}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {cargando && menciones.length === 0 && <p className="text-sm text-muted-foreground">Buscando en diarios, radios y portales…</p>}
        {!cargando && menciones.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {refrescar.isError ? String((refrescar.error as Error)?.message ?? 'No pude buscar en los medios.') : 'Sin notas de prensa sobre este organismo en los últimos 12 meses.'}
          </p>
        )}
        {visibles.length > 0 && (
          <ul className="space-y-2">
            {visibles.map((m) => {
              const t = TIPO[m.tipo_medio] ?? TIPO.otro;
              return (
                <li key={m.id} className="text-sm">
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline inline-flex items-start gap-1">
                    <span>{m.titulo}</span>
                    <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                  </a>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${t.clase}`}><t.Icono className="h-3 w-3 mr-1" />{t.texto}</Badge>
                    <span className="text-xs text-muted-foreground">{m.medio}{m.fecha ? ` · ${fecha(m.fecha)}` : ''}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {menciones.length > 5 && (
          <Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setVerTodo((v) => !v)}>
            {verTodo ? 'Ver menos' : `Ver las ${menciones.length} notas`}
          </Button>
        )}
        {revisado && <p className="text-[11px] text-muted-foreground">Prensa de los últimos 12 meses vía Google Noticias. Revisado el {fecha(revisado)}.</p>}
      </CardContent>
    </Card>
  );
}
