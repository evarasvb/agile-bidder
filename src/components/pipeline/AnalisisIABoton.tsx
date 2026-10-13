import { useState } from 'react';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useAnalisisPostulacion,
  useGenerarAnalisisPostulacion,
  type ResultadoAnalisis,
} from '@/hooks/useAnalisisPostulacion';

const RESUMEN_POR_RESULTADO: Record<ResultadoAnalisis, string> = {
  ganada: 'Por qué probablemente ganamos este proceso.',
  perdida: 'Por qué probablemente lo perdimos (y quién se lo adjudicó).',
  sin_tomar: 'Quién se lo adjudicó y qué tan competitivos hubiéramos sido.',
};

interface AnalisisIABotonProps {
  tipo: 'licitacion' | 'compra_agil';
  codigo: string;
  resultado: ResultadoAnalisis;
}

// Post-mortem de IA (pedido de Evaristo): botón compacto que genera (y
// cachea) una explicación corta de por qué se ganó/perdió, o quién ganó en
// lo que no se postuló. Antes solo vivía en el Histórico de Postulaciones;
// se extrajo para reusarlo también desde el modal del Pipeline, donde el
// usuario mueve una tarjeta a "Perdida"/"Adjudicada" y hoy no tenía forma de
// pedir ese análisis ahí mismo.
export function AnalisisIABoton({ tipo, codigo, resultado }: AnalisisIABotonProps) {
  const [open, setOpen] = useState(false);
  const { data: analisis, isLoading } = useAnalisisPostulacion(open ? tipo : null, open ? codigo : null);
  const generar = useGenerarAnalisisPostulacion(tipo, codigo, resultado);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Sparkles className="h-3.5 w-3.5" /> {analisis ? 'Ver análisis' : '¿Por qué?'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2" align="end">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
        ) : analisis ? (
          <>
            <p className="text-sm">{analisis.resumen}</p>
            {analisis.factores.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {analisis.factores.map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
            )}
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={generar.isPending} onClick={() => generar.mutate()}>
              {generar.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Regenerar
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{RESUMEN_POR_RESULTADO[resultado]}</p>
            <Button size="sm" disabled={generar.isPending} onClick={() => generar.mutate()} className="gap-1.5">
              {generar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Analizar con IA
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
