import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useClienteFiltros } from './useClienteFiltros';

export interface OportunidadFiltrada {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  organismo: string | null;
  institucion_nombre: string | null;
  region: string | null;
  monto: number | null;
  presupuesto_estimado: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  tipo_proceso: string;
  link_oficial: string | null;
  match_score: number | null;
  match_encontrado: boolean | null;
  created_at: string;
    risk_level: string | null;
}

function calculateMatchScore(
  oportunidad: OportunidadFiltrada,
  palabrasIncluir: string[]
): number {
  if (!palabrasIncluir || palabrasIncluir.length === 0) return 0;

  const texto = `${oportunidad.nombre || ''} ${oportunidad.descripcion || ''}`.toLowerCase();
  let matchCount = 0;

  palabrasIncluir.forEach((palabra) => {
    if (texto.includes(palabra.toLowerCase())) {
      matchCount++;
    }
  });

  return Math.round((matchCount / palabrasIncluir.length) * 100);
}

function matchesPalabras(
  texto: string,
  palabras: string[] | null,
  shouldInclude: boolean
): boolean {
  if (!palabras || palabras.length === 0) return shouldInclude;

  const textoLower = texto.toLowerCase();
  const hasMatch = palabras.some((p) => textoLower.includes(p.toLowerCase()));

  return shouldInclude ? hasMatch : !hasMatch;
}

export function useOportunidadesFiltradas() {
  const { filtros, isLoading: filtrosLoading } = useClienteFiltros();

  const query = useQuery({
    queryKey: ['oportunidades-filtradas', filtros],
    queryFn: async () => {
      // Fetch from both tables
      const [comprasResult, licitacionesResult] = await Promise.all([
        (supabaseClient as any)
          .from('compras_agiles')
          .select('*, institucion_riesgo!left(nivel_riesgo)')          .order('created_at', { ascending: false })
          .limit(2000),
        (supabaseClient as any)
          .from('licitaciones')
          .select('*, institucion_riesgo!left(nivel_riesgo)')          .order('created_at', { ascending: false })
          .limit(2000),
      ]);

      if (comprasResult.error) {
        console.error('Error fetching compras:', comprasResult.error);
      }
      if (licitacionesResult.error) {
        console.error('Error fetching licitaciones:', licitacionesResult.error);
      }

      // Transform compras_agiles
      const compras: OportunidadFiltrada[] = (comprasResult.data || []).map((c: any) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        descripcion: c.descripcion,
        organismo: c.organismo,
        institucion_nombre: c.organismo,
        region: c.region,
        monto: c.monto,
        presupuesto_estimado: c.monto,
        fecha_cierre: c.fecha_cierre,
        estado: c.estado,
        tipo_proceso: 'Compra Ágil',
        link_oficial: c.link_oficial,
        match_score: c.match_score,
        match_encontrado: c.match_encontrado,
        created_at: c.created_at,
              risk_level: c.institucion_riesgo?.[0]?.nivel_riesgo || null,
      }));

      // Transform licitaciones
      const licitaciones: OportunidadFiltrada[] = (licitacionesResult.data || []).map((l: any) => ({
        id: l.id_licitacion || l.id,
        codigo: l.id_licitacion || l.codigo,
        nombre: l.titulo || l.nombre,
        descripcion: null,
        organismo: l.organismo,
        institucion_nombre: l.organismo,
        region: null,
        monto: l.presupuesto,
        presupuesto_estimado: l.presupuesto,
        fecha_cierre: l.fecha_cierre,
        estado: l.estado,
        tipo_proceso: 'Licitación',
        link_oficial: l.link_oficial,
        match_score: l.match_score,
        match_encontrado: l.match_encontrado,
        created_at: l.created_at,
              risk_level: l.institucion_riesgo?.[0]?.nivel_riesgo || null,
      }));

      // Combine all opportunities
      let allOportunidades = [...compras, ...licitaciones];

      // Apply filters if available
      if (filtros) {
        allOportunidades = allOportunidades.filter((op) => {
          const texto = `${op.nombre || ''} ${op.descripcion || ''}`;

          // Filter by palabras_incluir
          if (filtros.palabras_incluir && filtros.palabras_incluir.length > 0) {
            if (!matchesPalabras(texto, filtros.palabras_incluir, true)) {
              return false;
            }
          }

          // Filter by palabras_excluir
          if (filtros.palabras_excluir && filtros.palabras_excluir.length > 0) {
            if (!matchesPalabras(texto, filtros.palabras_excluir, false)) {
              return false;
            }
          }

          // Filter by regiones_activas
          if (filtros.regiones_activas && filtros.regiones_activas.length > 0 && op.region) {
            if (!filtros.regiones_activas.some((r) => 
              op.region?.toLowerCase().includes(r.toLowerCase())
            )) {
              return false;
            }
          }

          // Filter by monto range
          const monto = op.monto || op.presupuesto_estimado || 0;
          if (filtros.monto_min && monto < filtros.monto_min) {
            return false;
          }
          if (filtros.monto_max && monto > filtros.monto_max) {
            return false;
          }

          return true;
        });

        // Calculate match score based on palabras_incluir
        allOportunidades = allOportunidades.map((op) => ({
          ...op,
          match_score: calculateMatchScore(op, filtros.palabras_incluir || []),
        }));
      }

      // Sort by match score descending, then by fecha_cierre ascending
      allOportunidades.sort((a, b) => {
        const scoreA = a.match_score || 0;
        const scoreB = b.match_score || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        
        const dateA = a.fecha_cierre ? new Date(a.fecha_cierre).getTime() : Infinity;
        const dateB = b.fecha_cierre ? new Date(b.fecha_cierre).getTime() : Infinity;
        return dateA - dateB;
      });

      return allOportunidades;
    },
    enabled: !filtrosLoading,
  });

  // Calculate stats
  const stats = {
    total: query.data?.length || 0,
    conMatchAlto: query.data?.filter((o) => (o.match_score || 0) >= 70).length || 0,
    urgentes: query.data?.filter((o) => {
      if (!o.fecha_cierre) return false;
      const hoursUntilClose = (new Date(o.fecha_cierre).getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilClose > 0 && hoursUntilClose <= 48;
    }).length || 0,
  };

  return {
    oportunidades: query.data || [],
    stats,
    isLoading: query.isLoading || filtrosLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
