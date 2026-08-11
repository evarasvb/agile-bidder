import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// INTERFACES
// =============================================================================

export interface OportunidadPanel {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  organismo: string;
  region: string | null;
  monto: number | null;
  fecha_cierre: string | null;
  fecha_publicacion: string | null;
  estado: string | null;
  tipo: 'compra_agil' | 'licitacion';
  link_oficial: string | null;
  match_score: number | null;
  match_encontrado: boolean;
  items_count: number;
  items_matched: number;
  created_at: string;
}

export interface OportunidadDetalle extends OportunidadPanel {
  items: OportunidadItem[];
  buyer: BuyerProfile | null;
}

export interface OportunidadItem {
  id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  codigo_producto: string | null;
  precio_unitario: number | null;
  match_score: number | null;
  producto_match: string | null;
  precio_sugerido: number | null;
}

export interface BuyerProfile {
  id: string;
  nombre: string;
  rut: string;
  direccion: string | null;
  region: string | null;
  comuna: string | null;
  sector: string | null;
  total_licitaciones: number | null;
  total_ordenes: number | null;
  monto_total_compras: number | null;
  score_pago: number | null;
  promedio_dias_pago: number | null;
}

export interface PanelFilters {
  tipo?: 'compra_agil' | 'licitacion' | 'all';
  scoreMin?: number;
  estado?: string;
  institucion?: string;
  fechaCierreDesde?: string;
  fechaCierreHasta?: string;
  search?: string;
  sortBy?: 'match_score' | 'fecha_cierre' | 'monto';
  sortAsc?: boolean;
  /**
   * Cuando es false (por defecto) solo se traen oportunidades ACTIVAS
   * (estado 'Publicada' y con cierre futuro). Al activarlo se incluyen las
   * cerradas/terminadas, limitadas a las más recientes para no saturar.
   */
  incluirCerradas?: boolean;
}

// Máximo de filas traídas del servidor al incluir cerradas (evita descargar
// las decenas de miles de oportunidades terminadas al navegador).
const MAX_CERRADAS = 500;

export interface PanelStats {
  totalActivas: number;
  avgMatchScore: number;
  cierranEstaSemana: number;
  valorTotal: number;
}

// =============================================================================
// LIST HOOK
// =============================================================================

export function useOportunidadesPanel(filters: PanelFilters = {}) {
  return useQuery({
    queryKey: ['oportunidades-panel', filters],
    queryFn: async (): Promise<{ data: OportunidadPanel[]; stats: PanelStats }> => {
      const nowIso = new Date().toISOString();
      const incluirCerradas = filters.incluirCerradas ?? false;

      // Fetch compras_agiles with items count.
      // Por defecto solo activas (Publicada + cierre futuro). Con "incluir
      // cerradas" se traen las más recientes con límite para no saturar.
      let comprasQuery = supabase
        .from('compras_agiles')
        .select(`
          *,
          compras_agiles_items(id)
        `)
        .order('created_at', { ascending: false });

      if (incluirCerradas) {
        comprasQuery = comprasQuery.limit(MAX_CERRADAS);
      } else {
        comprasQuery = comprasQuery
          .eq('estado', 'Publicada')
          .or(`fecha_cierre.is.null,fecha_cierre.gt.${nowIso}`);
      }

      const { data: comprasRaw, error: caError } = await comprasQuery;

      if (caError) {
        console.error('[OportunidadesPanel] Error fetching compras:', caError);
        throw caError;
      }

      // Fetch licitaciones. Antes traía TODAS (decenas de miles, casi todas
      // cerradas) => lentitud. Ahora, por defecto, solo activas.
      let licitacionesQuery = supabase
        .from('licitaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (incluirCerradas) {
        licitacionesQuery = licitacionesQuery.limit(MAX_CERRADAS);
      } else {
        licitacionesQuery = licitacionesQuery
          .eq('estado', 'Publicada')
          .or(`fecha_cierre.is.null,fecha_cierre.gt.${nowIso}`);
      }

      const { data: licitacionesRaw, error: licError } = await licitacionesQuery;

      if (licError) {
        console.error('[OportunidadesPanel] Error fetching licitaciones:', licError);
      }

      // Map compras_agiles
      const compras: OportunidadPanel[] = (comprasRaw || []).map((c: any) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre || 'Sin título',
        descripcion: c.descripcion,
        organismo: c.organismo || 'Sin organismo',
        region: c.region,
        monto: c.monto,
        fecha_cierre: c.fecha_cierre,
        fecha_publicacion: c.created_at,
        estado: c.estado,
        tipo: 'compra_agil' as const,
        link_oficial: c.link_oficial,
        match_score: c.match_score,
        match_encontrado: c.match_encontrado ?? false,
        items_count: c.compras_agiles_items?.length || 0,
        items_matched: 0,
        created_at: c.created_at,
      }));

      // Map licitaciones
      const licitaciones: OportunidadPanel[] = (licitacionesRaw || []).map((l: any) => ({
        id: l.id_licitacion || l.id,
        codigo: l.id_licitacion || l.codigo,
        nombre: l.titulo || l.nombre || 'Sin título',
        descripcion: null,
        organismo: l.organismo || 'Sin organismo',
        region: null,
        monto: l.presupuesto || l.presupuesto_estimado,
        fecha_cierre: l.fecha_cierre,
        fecha_publicacion: l.created_at,
        estado: l.estado,
        tipo: 'licitacion' as const,
        link_oficial: l.link_oficial,
        match_score: l.match_score,
        match_encontrado: l.match_encontrado ?? false,
        items_count: 0,
        items_matched: 0,
        created_at: l.created_at,
      }));

      let all = [...compras, ...licitaciones];

      // Apply filters
      if (filters.tipo && filters.tipo !== 'all') {
        all = all.filter(o => o.tipo === filters.tipo);
      }
      if (filters.scoreMin) {
        all = all.filter(o => (o.match_score || 0) >= filters.scoreMin!);
      }
      if (filters.estado && filters.estado !== 'all') {
        all = all.filter(o => o.estado === filters.estado);
      }
      if (filters.institucion) {
        const search = filters.institucion.toLowerCase();
        all = all.filter(o => o.organismo.toLowerCase().includes(search));
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        all = all.filter(o =>
          o.nombre.toLowerCase().includes(search) ||
          o.codigo.toLowerCase().includes(search) ||
          o.organismo.toLowerCase().includes(search)
        );
      }

      // Sort
      const sortBy = filters.sortBy || 'match_score';
      const sortAsc = filters.sortAsc ?? false;
      all.sort((a, b) => {
        let valA: number, valB: number;
        if (sortBy === 'match_score') {
          valA = a.match_score || 0;
          valB = b.match_score || 0;
        } else if (sortBy === 'fecha_cierre') {
          valA = a.fecha_cierre ? new Date(a.fecha_cierre).getTime() : Infinity;
          valB = b.fecha_cierre ? new Date(b.fecha_cierre).getTime() : Infinity;
        } else {
          valA = a.monto || 0;
          valB = b.monto || 0;
        }
        return sortAsc ? valA - valB : valB - valA;
      });

      // Stats
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      const activas = all.filter(o => o.fecha_cierre && new Date(o.fecha_cierre).getTime() > now);
      const stats: PanelStats = {
        totalActivas: activas.length,
        avgMatchScore: all.length > 0
          ? Math.round(all.reduce((sum, o) => sum + (o.match_score || 0), 0) / all.length)
          : 0,
        cierranEstaSemana: all.filter(o => {
          if (!o.fecha_cierre) return false;
          const t = new Date(o.fecha_cierre).getTime();
          return t > now && t < now + oneWeek;
        }).length,
        valorTotal: all.reduce((sum, o) => sum + (o.monto || 0), 0),
      };

      return { data: all, stats };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

// =============================================================================
// DETAIL HOOK
// =============================================================================

export function useOportunidadDetalle(id: string | null, tipo: 'compra_agil' | 'licitacion' | null) {
  return useQuery({
    queryKey: ['oportunidad-detalle', id, tipo],
    queryFn: async (): Promise<OportunidadDetalle | null> => {
      if (!id || !tipo) return null;

      if (tipo === 'compra_agil') {
        // Fetch compra agil by codigo
        const { data: compra, error } = await supabase
          .from('compras_agiles')
          .select(`
            *,
            compras_agiles_items(*)
          `)
          .eq('codigo', id)
          .maybeSingle();

        if (error) throw error;
        if (!compra) return null;

        // Fetch buyer info by organismo name
        const { data: institucion } = await supabase
          .from('instituciones')
          .select('*')
          .ilike('nombre', `%${(compra as any).organismo || ''}%`)
          .maybeSingle();

        // Fetch conducta_pago for this institution
        let scorePago: number | null = null;
        let promedioDiasPago: number | null = null;
        if (institucion) {
          const { data: pago } = await supabase
            .from('conducta_pago')
            .select('*')
            .eq('institucion_id', institucion.id)
            .maybeSingle();
          if (pago) {
            scorePago = pago.score_pago;
            promedioDiasPago = pago.promedio_dias_pago;
          }
        }

        const items: OportunidadItem[] = ((compra as any).compras_agiles_items || []).map((i: any) => ({
          id: i.id,
          nombre_producto: i.nombre_producto,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          unidad: i.unidad,
          codigo_producto: i.codigo_producto,
          precio_unitario: i.precio_unitario,
          match_score: null,
          producto_match: null,
          precio_sugerido: null,
        }));

        const buyer: BuyerProfile | null = institucion ? {
          id: institucion.id,
          nombre: institucion.nombre,
          rut: institucion.rut,
          direccion: institucion.direccion,
          region: institucion.region,
          comuna: institucion.comuna,
          sector: institucion.sector,
          total_licitaciones: institucion.total_licitaciones,
          total_ordenes: institucion.total_ordenes,
          monto_total_compras: institucion.monto_total_compras,
          score_pago: scorePago,
          promedio_dias_pago: promedioDiasPago,
        } : null;

        return {
          id: (compra as any).id,
          codigo: (compra as any).codigo,
          nombre: (compra as any).nombre || 'Sin título',
          descripcion: (compra as any).descripcion,
          organismo: (compra as any).organismo || 'Sin organismo',
          region: (compra as any).region,
          monto: (compra as any).monto,
          fecha_cierre: (compra as any).fecha_cierre,
          fecha_publicacion: (compra as any).created_at,
          estado: (compra as any).estado,
          tipo: 'compra_agil',
          link_oficial: (compra as any).link_oficial,
          match_score: (compra as any).match_score,
          match_encontrado: (compra as any).match_encontrado ?? false,
          items_count: items.length,
          items_matched: 0,
          created_at: (compra as any).created_at,
          items,
          buyer,
        };
      }

      // Licitacion
      const { data: lic, error } = await supabase
        .from('licitaciones')
        .select('*')
        .or(`id_licitacion.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (error) throw error;
      if (!lic) return null;

      const { data: institucion } = await supabase
        .from('instituciones')
        .select('*')
        .ilike('nombre', `%${(lic as any).organismo || ''}%`)
        .maybeSingle();

      let scorePago: number | null = null;
      let promedioDiasPago: number | null = null;
      if (institucion) {
        const { data: pago } = await supabase
          .from('conducta_pago')
          .select('*')
          .eq('institucion_id', institucion.id)
          .maybeSingle();
        if (pago) {
          scorePago = pago.score_pago;
          promedioDiasPago = pago.promedio_dias_pago;
        }
      }

      const buyer: BuyerProfile | null = institucion ? {
        id: institucion.id,
        nombre: institucion.nombre,
        rut: institucion.rut,
        direccion: institucion.direccion,
        region: institucion.region,
        comuna: institucion.comuna,
        sector: institucion.sector,
        total_licitaciones: institucion.total_licitaciones,
        total_ordenes: institucion.total_ordenes,
        monto_total_compras: institucion.monto_total_compras,
        score_pago: scorePago,
        promedio_dias_pago: promedioDiasPago,
      } : null;

      return {
        id: (lic as any).id_licitacion || (lic as any).id,
        codigo: (lic as any).id_licitacion || (lic as any).codigo,
        nombre: (lic as any).titulo || (lic as any).nombre || 'Sin título',
        descripcion: null,
        organismo: (lic as any).organismo || 'Sin organismo',
        region: null,
        monto: (lic as any).presupuesto || (lic as any).presupuesto_estimado,
        fecha_cierre: (lic as any).fecha_cierre,
        fecha_publicacion: (lic as any).created_at,
        estado: (lic as any).estado,
        tipo: 'licitacion',
        link_oficial: (lic as any).link_oficial,
        match_score: (lic as any).match_score,
        match_encontrado: (lic as any).match_encontrado ?? false,
        items_count: 0,
        items_matched: 0,
        created_at: (lic as any).created_at,
        items: [],
        buyer,
      };
    },
    enabled: !!id && !!tipo,
  });
}

// =============================================================================
// ACTIONS
// =============================================================================

export function useDescartarOportunidad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ codigo, tipo }: { codigo: string; tipo: 'compra_agil' | 'licitacion' }) => {
      if (tipo === 'compra_agil') {
        const { error } = await supabase
          .from('compras_agiles')
          .update({ match_encontrado: false, match_score: 0 })
          .eq('codigo', codigo);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('licitaciones')
          .update({ match_encontrado: false, match_score: 0 } as any)
          .eq('id_licitacion', codigo);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oportunidades-panel'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidad-detalle'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    },
  });
}
