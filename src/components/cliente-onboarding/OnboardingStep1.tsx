import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Plus, X, Tag } from 'lucide-react';
import { InfoHint } from '@/components/ui/info-hint';
import { useActualizarCliente, Cliente } from '@/hooks/useCliente';
import { INDUSTRIAS } from './industrias';

interface OnboardingStep1Props {
  cliente: Cliente;
}

export default function OnboardingStep1({ cliente }: OnboardingStep1Props) {
  const actualizarCliente = useActualizarCliente();

  const [industrias, setIndustrias] = useState<string[]>([]);
  const [palabras, setPalabras] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const initRef = useRef(false);

  // Inicializar desde el cliente una sola vez (fuente de verdad al entrar).
  useEffect(() => {
    if (initRef.current || !cliente) return;
    initRef.current = true;
    const inds = (cliente.industrias && cliente.industrias.length > 0)
      ? cliente.industrias
      : (cliente.categoria_negocio ? [cliente.categoria_negocio] : []);
    setIndustrias(inds);

    // Palabra que el visitante buscó en el landing antes de registrarse: la
    // precargamos aquí para no perder el hilo (Auth la dejó en localStorage).
    const base = cliente.palabras_clave_busqueda ?? [];
    let inicial = base;
    try {
      const kw = localStorage.getItem('fvb_onboarding_kw')?.trim().toLowerCase();
      if (kw) {
        localStorage.removeItem('fvb_onboarding_kw');
        if (!base.includes(kw)) {
          inicial = [...base, kw];
          actualizarCliente.mutate({ id: cliente.id, palabras_clave_busqueda: inicial } as any);
        }
      }
    } catch { /* noop */ }
    setPalabras(inicial);
  }, [cliente]);

  const persist = (inds: string[], pals: string[]) => {
    actualizarCliente.mutate({
      id: cliente.id,
      // categoria_negocio (single) se mantiene por compatibilidad = primera industria.
      categoria_negocio: inds[0] ?? null,
      industrias: inds,
      palabras_clave_busqueda: pals,
    } as any);
  };

  const toggleIndustria = (id: string) => {
    const next = industrias.includes(id)
      ? industrias.filter((x) => x !== id)
      : [...industrias, id];
    setIndustrias(next);
    persist(next, palabras);
  };

  const addPalabra = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t || palabras.includes(t)) { setInput(''); return; }
    const next = [...palabras, t];
    setPalabras(next);
    setInput('');
    persist(industrias, next);
  };

  const removePalabra = (t: string) => {
    const next = palabras.filter((x) => x !== t);
    setPalabras(next);
    persist(industrias, next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addPalabra(input);
    } else if (e.key === 'Backspace' && !input && palabras.length) {
      removePalabra(palabras[palabras.length - 1]);
    }
  };

  // Sugerencias de palabras clave según las industrias elegidas (que aún no estén agregadas).
  const sugerencias = useMemo(() => {
    const set = new Set<string>();
    for (const id of industrias) {
      INDUSTRIAS.find((i) => i.id === id)?.keywords.forEach((k) => set.add(k));
    }
    return [...set].filter((k) => !palabras.includes(k.toLowerCase())).slice(0, 12);
  }, [industrias, palabras]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ¿Qué vende tu empresa?
            <InfoHint text="Toca una o varias industrias (puedes elegir todas las que apliquen). Si no estás seguro, marca la más cercana — abajo aparecerán palabras clave sugeridas según lo que elijas. Todo se puede cambiar después." />
          </CardTitle>
          <CardDescription>
            Elige <strong>una o varias</strong> industrias. Con esto la IA busca licitaciones para ti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INDUSTRIAS.map((cat) => {
              const Icon = cat.icon;
              const isSelected = industrias.includes(cat.id);
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => toggleIndustria(cat.id)}
                  aria-pressed={isSelected}
                  className={`relative flex items-center gap-3 p-4 rounded-lg border-2 text-left transition-all hover:bg-muted/50 ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-medium text-sm">{cat.label}</span>
                  {isSelected && (
                    <span className="absolute top-2 right-2 text-primary">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            Palabras clave de tus productos
            <InfoHint text="Escribe productos como los busca el Estado (ej: toner, resma, notebook) y presiona Enter. ¿No sabes qué poner? Usa las sugerencias de abajo — salen de las industrias que elegiste." />
          </CardTitle>
          <CardDescription>
            Agrega términos que describan lo que vendes (ej: <em>toner, resma, notebook</em>). Mientras más
            específico, mejores las oportunidades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 min-h-[46px] p-2 rounded-lg border-2 border-muted focus-within:border-primary transition-colors">
            {palabras.map((p) => (
              <Badge key={p} variant="secondary" className="gap-1 py-1 pl-3 pr-1 text-sm">
                {p}
                <button type="button" onClick={() => removePalabra(p)} className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => input.trim() && addPalabra(input)}
              placeholder={palabras.length ? 'Agrega otra…' : 'Escribe y presiona Enter'}
              className="flex-1 min-w-[140px] border-0 shadow-none focus-visible:ring-0 px-1 h-8"
            />
          </div>

          {sugerencias.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sugerencias según tu industria (haz clic para agregar):</p>
              <div className="flex flex-wrap gap-2">
                {sugerencias.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => addPalabra(s)}
                    className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
