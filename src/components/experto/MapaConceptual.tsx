import { useState } from 'react';
import { ChevronRight, MessageCircle } from 'lucide-react';

export interface Nodo { t: string; d?: string; h?: Nodo[] }

const COLORES = ['#1b2a4a', '#0e7490', '#b45309', '#15803d', '#7c3aed', '#be123c', '#4338ca', '#0f766e', '#a16207'];

// Fila de una lección/detalle (nivel 2+): lista indentada con conector, para
// leer el detalle de una rama principal. Aquí sí tiene sentido una lista: a
// esta profundidad el usuario ya está leyendo, no mirando el panorama.
function Rama({ n, nivel, color, onPreguntar, abiertoInicial }: { n: Nodo; nivel: number; color: string; onPreguntar?: (t: string) => void; abiertoInicial: boolean }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const hijos = n.h ?? [];
  return (
    <div className="relative" style={{ marginLeft: nivel > 1 ? 18 : 0 }}>
      {nivel > 1 && <span className="absolute left-[-12px] top-4 w-3 border-t" style={{ borderColor: color }} />}
      <div className="flex items-start gap-1 py-1">
        <button type="button" onClick={() => setAbierto((a) => !a)} className="mt-0.5 shrink-0 rounded-full p-0.5 hover:bg-muted" aria-label={abierto ? 'Contraer' : 'Expandir'} disabled={!hijos.length}>
          <ChevronRight className="h-4 w-4 transition-transform" style={{ transform: abierto ? 'rotate(90deg)' : 'none', opacity: hijos.length ? 1 : 0.2 }} />
        </button>
        <div className="rounded-lg border px-3 py-1.5 text-sm bg-background shadow-sm" style={{ borderColor: color, borderLeftWidth: 4 }}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{n.t}</span>
            {onPreguntar && <button type="button" title="Preguntarle al Experto sobre esto" onClick={() => onPreguntar(n.t)} className="text-muted-foreground hover:text-primary"><MessageCircle className="h-3.5 w-3.5" /></button>}
          </div>
          {n.d && <p className="text-xs text-muted-foreground mt-0.5">{n.d}</p>}
        </div>
      </div>
      {abierto && hijos.length > 0 && (
        <div className="ml-2 border-l pl-1" style={{ borderColor: color + '66' }}>
          {hijos.map((h, i) => <Rama key={i} n={h} nivel={nivel + 1} color={color} onPreguntar={onPreguntar} abiertoInicial={false} />)}
        </div>
      )}
    </div>
  );
}

// Rama principal (nivel 1): una tarjeta de color propio que se abre para mostrar
// su detalle. Es el "nodo del mapa", no una fila de lista: por eso va en una
// grilla junto a sus hermanas, no una debajo de la otra.
function RamaPrincipal({ n, color, onPreguntar }: { n: Nodo; color: string; onPreguntar?: (t: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const hijos = n.h ?? [];
  return (
    <div className="rounded-xl border-2 bg-background shadow-sm overflow-hidden h-fit" style={{ borderColor: color }}>
      <div className="flex items-center gap-1.5 px-3 py-2">
        <button type="button" onClick={() => setAbierto((a) => !a)} className="shrink-0 rounded-full p-0.5 hover:bg-muted" aria-label={abierto ? 'Contraer' : 'Expandir'} disabled={!hijos.length}>
          <ChevronRight className="h-4 w-4 transition-transform" style={{ transform: abierto ? 'rotate(90deg)' : 'none', opacity: hijos.length ? 1 : 0.2, color }} />
        </button>
        <span className="font-semibold text-sm flex-1 min-w-0 truncate" style={{ color }}>{n.t}</span>
        {onPreguntar && <button type="button" title="Preguntarle al Experto sobre esto" onClick={() => onPreguntar(n.t)} className="shrink-0 text-muted-foreground hover:text-primary"><MessageCircle className="h-3.5 w-3.5" /></button>}
      </div>
      {n.d && <p className="px-3 pb-2 -mt-1 text-xs text-muted-foreground">{n.d}</p>}
      {abierto && hijos.length > 0 && (
        <div className="border-t px-3 py-2" style={{ borderColor: color + '33' }}>
          {hijos.map((h, i) => <Rama key={i} n={h} nivel={1} color={color} onPreguntar={onPreguntar} abiertoInicial={false} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Mapa conceptual: un diagrama real (raíz + ramas principales conectadas por
 * líneas), no una lista indentada. La raíz queda arriba, las ramas principales
 * se reparten en una grilla debajo unidas por un tronco y una barra
 * distribuidora, y cada rama se abre para mostrar su detalle (lista, ahí sí,
 * porque a ese nivel se está leyendo, no mirando el panorama completo).
 */
export function MapaConceptual({ raiz, onPreguntar }: { raiz: Nodo; onPreguntar?: (tema: string) => void }) {
  const ramas = raiz.h ?? [];
  return (
    <div className="py-2">
      <div className="mx-auto w-fit max-w-full rounded-xl border-2 px-4 py-2.5 text-center shadow-sm bg-background" style={{ borderColor: COLORES[0] }}>
        <p className="font-bold" style={{ color: COLORES[0] }}>{raiz.t}</p>
        {raiz.d && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{raiz.d}</p>}
      </div>
      {ramas.length > 0 && (
        <>
          <div className="mx-auto h-4 w-px bg-border" />
          <div className="mx-auto w-fit border-t border-border flex flex-wrap justify-center gap-3 pt-3">
            {ramas.map((n, i) => {
              const color = COLORES[(i + 1) % COLORES.length];
              return (
                <div key={i} className="flex flex-col items-center" style={{ width: 220 }}>
                  <div className="h-3 w-px" style={{ backgroundColor: color }} />
                  <RamaPrincipal n={n} color={color} onPreguntar={onPreguntar} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
