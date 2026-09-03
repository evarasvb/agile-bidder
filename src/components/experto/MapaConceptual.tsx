import { useState } from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';

export interface Nodo { t: string; d?: string; h?: Nodo[] }

const COLORES = ['#1b2a4a', '#0e7490', '#b45309', '#15803d', '#7c3aed', '#be123c', '#4338ca', '#0f766e', '#a16207'];

function Rama({ n, nivel, color, onPreguntar, abiertoInicial }: { n: Nodo; nivel: number; color: string; onPreguntar?: (t: string) => void; abiertoInicial: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const hijos = n.h ?? [];
  return (
    <div className="relative" style={{ marginLeft: nivel ? 18 : 0 }}>
      {nivel > 0 && <span className="absolute left-[-12px] top-4 w-3 border-t" style={{ borderColor: color }} />}
      <div className="flex items-start gap-1 py-1">
        <button type="button" onClick={() => setAbierto((a) => !a)} className="mt-0.5 shrink-0 rounded-full p-0.5 hover:bg-muted" aria-label={abierto ? 'Contraer' : 'Expandir'} disabled={!hijos.length}>
          <ChevronRight className="h-4 w-4 transition-transform" style={{ transform: abierto ? 'rotate(90deg)' : 'none', opacity: hijos.length ? 1 : 0.2 }} />
        </button>
        <div className="rounded-lg border px-3 py-1.5 text-sm bg-background shadow-sm" style={{ borderColor: color, borderLeftWidth: nivel === 0 ? 6 : 4 }}>
          <div className="flex items-center gap-2">
            <span className="font-medium" style={{ color: nivel === 0 ? color : undefined }}>{n.t}</span>
            {onPreguntar && <button type="button" title="Preguntarle al Experto sobre esto" onClick={() => onPreguntar(n.t)} className="text-muted-foreground hover:text-primary"><MessageCircle className="h-3.5 w-3.5" /></button>}
          </div>
          {n.d && <p className="text-xs text-muted-foreground mt-0.5">{n.d}</p>}
        </div>
      </div>
      {abierto && hijos.length > 0 && (
        <div className="ml-2 border-l pl-1" style={{ borderColor: color + '66' }}>
          {hijos.map((h, i) => <Rama key={i} n={h} nivel={nivel + 1} color={nivel === 0 ? COLORES[(i + 1) % COLORES.length] : color} onPreguntar={onPreguntar} abiertoInicial={nivel < 1} />)}
        </div>
      )}
    </div>
  );
}

/** Mapa conceptual navegable (expandir/contraer, y preguntar al Experto desde cualquier nodo). */
export function MapaConceptual({ raiz, onPreguntar }: { raiz: Nodo; onPreguntar?: (tema: string) => void }) {
  return <div className="overflow-x-auto py-1"><Rama n={raiz} nivel={0} color={COLORES[0]} onPreguntar={onPreguntar} abiertoInicial /></div>;
}
