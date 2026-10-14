import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X, Trash2, Sparkles, Loader2, Layers } from 'lucide-react';
import { INDUSTRIAS } from '@/components/cliente-onboarding/industrias';
import { normalizar } from '@/hooks/useClienteFiltros';
import {
  useClienteClusters,
  useGuardarCluster,
  useEliminarCluster,
  useExpandirConceptosCluster,
  type ClusterPalabras,
} from '@/hooks/useClienteClusters';
import { InfoHint } from '@/components/ui/info-hint';

const separarPalabras = (texto: string): string[] =>
  Array.from(new Set(texto.split(/[,;\n]+/).map((w) => w.trim()).filter(Boolean)));

function labelIndustria(id: string): string {
  return INDUSTRIAS.find((i) => i.id === id)?.label || id;
}

function ClusterCard({ cluster }: { cluster: ClusterPalabras }) {
  const guardar = useGuardarCluster();
  const eliminar = useEliminarCluster();
  const expandir = useExpandirConceptosCluster();
  const [nueva, setNueva] = useState('');

  const descartadas = cluster.palabras_ia_descartadas || [];
  const conceptosIA = (cluster.palabras_ia || []).filter((p) => !cluster.palabras.includes(p));

  const agregarPalabra = () => {
    const nuevas = separarPalabras(nueva).filter((w) => !cluster.palabras.includes(w));
    if (nuevas.length) {
      guardar.mutate({ industria: cluster.industria, palabras: [...cluster.palabras, ...nuevas] });
    }
    setNueva('');
  };

  const quitarPalabra = (palabra: string) => {
    guardar.mutate({ industria: cluster.industria, palabras: cluster.palabras.filter((p) => p !== palabra) });
  };

  const toggleActivo = (activo: boolean) => {
    guardar.mutate({ industria: cluster.industria, activo });
  };

  const toggleConceptoIA = (palabra: string) => {
    const nuevas = descartadas.includes(palabra)
      ? descartadas.filter((p) => p !== palabra)
      : [...descartadas, palabra];
    guardar.mutate({ industria: cluster.industria, palabras_ia_descartadas: nuevas });
  };

  const usarConceptoIA = (palabra: string) => {
    if (!cluster.palabras.includes(palabra)) {
      guardar.mutate({ industria: cluster.industria, palabras: [...cluster.palabras, palabra] });
    }
  };

  return (
    <Card className={cluster.activo ? '' : 'opacity-60'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            {labelIndustria(cluster.industria)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch checked={cluster.activo} onCheckedChange={toggleActivo} aria-label={`Activar cluster ${labelIndustria(cluster.industria)}`} />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => eliminar.mutate(cluster.id)}
              disabled={eliminar.isPending}
              title="Eliminar este cluster"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Agregar palabra de este rubro..."
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarPalabra(); } }}
            disabled={!cluster.activo}
          />
          <Button size="icon" onClick={agregarPalabra} disabled={!cluster.activo}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded-md bg-muted/30">
          {cluster.palabras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin palabras todavía en este rubro.</p>
          ) : (
            cluster.palabras.map((palabra) => (
              <Badge key={palabra} variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                {palabra}
                <button onClick={() => quitarPalabra(palabra)} aria-label={`Quitar ${palabra}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={!cluster.palabras.length || expandir.isPending || !cluster.activo}
            onClick={() => expandir.mutate({ industria: cluster.industria, palabras: cluster.palabras })}
          >
            {expandir.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Ampliar con IA
          </Button>
        </div>

        {conceptosIA.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              También busca por estos conceptos (toca uno para apagarlo/encenderlo; + lo agrega a tus palabras):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {conceptosIA.map((palabra) => {
                const apagada = descartadas.includes(normalizar(palabra)) || descartadas.includes(palabra);
                return (
                  <Badge
                    key={palabra}
                    variant="outline"
                    className={`text-xs font-normal cursor-pointer select-none gap-1 ${
                      apagada ? 'text-muted-foreground/60 border-dashed line-through' : 'text-green-800 bg-green-50 border-green-300 hover:bg-green-100'
                    }`}
                    onClick={() => toggleConceptoIA(palabra)}
                  >
                    {palabra}
                    {!apagada && (
                      <button type="button" className="ml-0.5 rounded hover:bg-green-200" onClick={(e) => { e.stopPropagation(); usarConceptoIA(palabra); }}>
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Clusters de búsqueda por rubro: separa las palabras clave en grupos por
// industria (en vez de una sola bolsa plana) para clientes que venden varias
// líneas de producto muy distintas. SUMA precisión sobre "Palabras a Incluir"
// de arriba — no la reemplaza: si no agregas ningún cluster, todo sigue
// funcionando exactamente igual que antes.
export function ClustersBusqueda() {
  const { data: clusters = [], isLoading } = useClienteClusters();
  const guardar = useGuardarCluster();
  const [nuevaIndustria, setNuevaIndustria] = useState('');

  const industriasUsadas = new Set(clusters.map((c) => c.industria));
  const disponibles = INDUSTRIAS.filter((i) => !industriasUsadas.has(i.id));

  const agregarCluster = () => {
    if (!nuevaIndustria) return;
    guardar.mutate({ industria: nuevaIndustria, palabras: [], activo: true });
    setNuevaIndustria('');
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Clusters de búsqueda por rubro
          </CardTitle>
          <InfoHint text="Si vendes varias líneas de producto muy distintas (ej: oficina y aseo), sepáralas acá para que cada una tenga sus propias palabras y puedas prender/apagar un rubro completo. Esto SUMA precisión a 'Palabras a Incluir' de arriba — si no agregas ningún cluster, nada cambia." />
        </div>
        <CardDescription>
          Opcional. Útil si tus líneas de producto son muy distintas entre sí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {clusters.map((cluster) => (
          <ClusterCard key={cluster.id} cluster={cluster} />
        ))}

        {disponibles.length > 0 && (
          <div className="flex gap-2 items-center pt-1">
            <Select value={nuevaIndustria} onValueChange={setNuevaIndustria}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Elegir rubro a agregar..." />
              </SelectTrigger>
              <SelectContent>
                {disponibles.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={agregarCluster} disabled={!nuevaIndustria || guardar.isPending}>
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar rubro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
