import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  History, 
  TrendingUp, 
  Building2, 
  DollarSign,
  Calendar,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface LicitacionSimilar {
  id: string;
  codigo: string;
  nombre: string;
  organismo: string;
  monto: number | null;
  fecha_adjudicacion: string | null;
  proveedor_ganador: string | null;
  similarity_score: number;
}

interface Props {
  licitacionId: string;
  titulo: string;
  organismo: string;
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

// Simple similarity calculation based on keywords
function calculateSimilarity(title1: string, title2: string): number {
  const normalize = (str: string) => 
    str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);
  
  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));
  
  let matches = 0;
  words1.forEach(w => {
    if (words2.has(w)) matches++;
  });
  
  const totalUnique = new Set([...words1, ...words2]).size;
  return totalUnique > 0 ? Math.round((matches / totalUnique) * 100) : 0;
}

export default function LicitacionesSimilares({ licitacionId, titulo, organismo }: Props) {
  const navigate = useNavigate();

  const { data: similares, isLoading } = useQuery({
    queryKey: ['licitaciones_similares', licitacionId, titulo],
    queryFn: async () => {
      // First, try to find adjudicated licitaciones from licitaciones_adjudicaciones
      const { data: adjudicaciones } = await (supabase as any)
        .from('licitaciones_adjudicaciones')
        .select(`
          *,
          licitacion:licitaciones_bi(id, codigo, nombre, institucion_nombre, presupuesto_estimado, fecha_adjudicacion)
        `)
        .not('proveedor_nombre', 'is', null)
        .order('fecha_adjudicacion', { ascending: false })
        .limit(100);

      // Also get from compras_agiles with estado = 'adjudicada' or 'cerrada'
      const { data: comprasAdjudicadas } = await supabase
        .from('compras_agiles')
        .select('*')
        .in('estado', ['adjudicada', 'cerrada', 'Adjudicada', 'Cerrada'])
        .order('created_at', { ascending: false })
        .limit(100);

      // Combine and calculate similarity
      const candidates: LicitacionSimilar[] = [];

      // Process adjudicaciones from licitaciones_bi
      if (adjudicaciones) {
        for (const adj of adjudicaciones) {
          if (!adj.licitacion || adj.licitacion.id === licitacionId) continue;
          
          const similarity = calculateSimilarity(titulo, adj.licitacion.nombre || '');
          if (similarity >= 30) {
            candidates.push({
              id: adj.licitacion.id,
              codigo: adj.licitacion.codigo,
              nombre: adj.licitacion.nombre,
              organismo: adj.licitacion.institucion_nombre || organismo,
              monto: adj.monto_adjudicado || adj.licitacion.presupuesto_estimado,
              fecha_adjudicacion: adj.fecha_adjudicacion,
              proveedor_ganador: adj.proveedor_nombre,
              similarity_score: similarity,
            });
          }
        }
      }

      // Process compras agiles adjudicadas
      if (comprasAdjudicadas) {
        for (const ca of comprasAdjudicadas) {
          if (ca.id === licitacionId) continue;
          
          const similarity = calculateSimilarity(titulo, ca.nombre || '');
          if (similarity >= 30) {
            candidates.push({
              id: ca.id,
              codigo: ca.codigo,
              nombre: ca.nombre,
              organismo: ca.organismo,
              monto: ca.monto,
              fecha_adjudicacion: ca.updated_at,
              proveedor_ganador: null,
              similarity_score: similarity,
            });
          }
        }
      }

      // Sort by similarity and take top 5
      return candidates
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 5);
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-firmavb-blue" />
            Licitaciones Similares del Pasado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!similares || similares.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-firmavb-blue" />
            Licitaciones Similares del Pasado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No se encontraron licitaciones similares adjudicadas
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate insights
  const avgMonto = similares.reduce((sum, s) => sum + (s.monto || 0), 0) / similares.filter(s => s.monto).length;
  const proveedoresUnicos = new Set(similares.filter(s => s.proveedor_ganador).map(s => s.proveedor_ganador));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5 text-firmavb-blue" />
          Licitaciones Similares del Pasado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insights */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-warning" />
            Insights
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Monto promedio adjudicado</p>
              <p className="font-semibold text-firmavb-blue">{formatCurrency(avgMonto)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Proveedores ganadores</p>
              <p className="font-semibold">{proveedoresUnicos.size} diferentes</p>
            </div>
          </div>
        </div>

        {/* Similar tenders list */}
        <div className="space-y-3">
          {similares.map((similar) => (
            <div 
              key={similar.id}
              className="border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/licitaciones/${similar.codigo}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-mono">
                      {similar.codigo}
                    </Badge>
                    <Badge 
                      className={`text-xs ${
                        similar.similarity_score >= 70 
                          ? 'bg-green-500/10 text-green-600' 
                          : similar.similarity_score >= 50 
                            ? 'bg-yellow-500/10 text-yellow-600'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {similar.similarity_score}% similar
                    </Badge>
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{similar.nombre}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {similar.organismo}
                    </span>
                    {similar.fecha_adjudicacion && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(similar.fecha_adjudicacion), 'MMM yyyy', { locale: es })}
                      </span>
                    )}
                  </div>
                  {similar.proveedor_ganador && (
                    <p className="text-xs text-muted-foreground mt-1">
                      🏆 Ganador: <span className="font-medium">{similar.proveedor_ganador}</span>
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-firmavb-blue">
                    {formatCurrency(similar.monto)}
                  </p>
                  <Badge variant="secondary" className="mt-1">Adjudicada</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
