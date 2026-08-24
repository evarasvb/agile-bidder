import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { aplicarFiltrosCliente, normalizar, type ClienteFiltros } from '@/hooks/useClienteFiltros';

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
  // Texto concatenado de los productos de la compra, para buscar por ítem
  // (una compra "Insumos de oficina" que en su lista tiene tóner debe calzar).
  items_text?: string;
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
// Tope de seguridad para la vista de activas (hoy son decenas; el límite evita
// sorpresas si alguna carga futura deja muchas con fecha futura).
const MAX_ACTIVAS = 500;

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
      // Columnas explícitas (NO `datos_json`, un jsonb pesado por fila) para no
      // saturar el navegador con hasta 500 filas de blobs.
      let comprasQuery = supabase
        .from('compras_agiles')
        .select(`
          id, codigo, nombre, descripcion, nombre_organismo, region, monto_estimado,
          fecha_cierre, created_at, estado, match_score, match_encontrado, url_ficha,
          compras_agiles_items(id, nombre_producto)
        `)
        .order('created_at', { ascending: false });

      if (incluirCerradas) {
        comprasQuery = comprasQuery.limit(MAX_CERRADAS);
      } else {
        // "Activa" = estado abierto Y con fecha de cierre futura REAL. Antes se
        // incluía `fecha_cierre.is.null`, pero ~4.573 compras de una carga
        // histórica (2026-03-20) no tienen fecha y quedaban marcadas como
        // activas => ensuciaban el panel. Se exige fecha futura (excluye nulos).
        comprasQuery = comprasQuery
          .or('estado.ilike.publicada,estado.ilike.activa')
          .gt('fecha_cierre', nowIso)
          .limit(MAX_ACTIVAS);
      }

      // Fetch licitaciones desde `licitaciones_bi` (tabla fresca alimentada por
      // el sync oficial de Mercado Público). La antigua tabla `licitaciones`
      // quedó congelada en 2026-04 (0 activas) — por eso el panel no mostraba
      // ninguna licitación abierta. `licitaciones_bi` tiene ~2.000 activas al día.
      // No está en los tipos generados de Supabase => usamos any.
      // Columnas explícitas (NO `raw_data`, que es un jsonb enorme por fila) para
      // no descargar megas al navegador.
      const LIC_COLS =
        'id, codigo, nombre, descripcion, estado, fecha_cierre, fecha_publicacion, ' +
        'institucion_nombre, unidad_compra_region, presupuesto_estimado, created_at, ' +
        'match_score, match_encontrado';
      let licitacionesQuery = (supabase as any)
        .from('licitaciones_bi')
        .select(LIC_COLS)
        .order('fecha_publicacion', { ascending: false, nullsFirst: false });

      if (incluirCerradas) {
        licitacionesQuery = licitacionesQuery.limit(MAX_CERRADAS);
      } else {
        // Igual que compras: exigir fecha de cierre futura real. Sin esto,
        // ~92.000 licitaciones históricas sin fecha se mostraban como "activas".
        // Se incluye `estado.is.null` porque el endpoint estado=activas de la API
        // no manda el texto Estado (defensa por si algún código nuevo no se mapea).
        licitacionesQuery = licitacionesQuery
          .or('estado.is.null,estado.ilike.publicada,estado.ilike.activa')
          .gt('fecha_cierre', nowIso)
          .limit(MAX_ACTIVAS);
      }

      // Filtros del cliente (onboarding + IA): se piden en paralelo. RLS restringe
      // la fila al propio cliente, así que un maybeSingle basta.
      const filtrosQuery = (supabase as any)
        .from('cliente_filtros_oportunidades')
        .select('palabras_incluir, palabras_excluir, regiones_activas, monto_min, monto_max')
        .maybeSingle();

      // Afinidad aprendida del comportamiento (lo que cotiza sube, lo que
      // descarta baja). Resuelve el cliente por auth.uid() dentro de la función.
      const afinidadQuery = (supabase as any).rpc('cliente_afinidad');

      // Consultas independientes en PARALELO (antes eran en serie: 3 idas y vueltas
      // secuenciales). compras, licitaciones y filtros no dependen entre sí.
      const [comprasRes, licitacionesRes, filtrosRes, afinidadRes] = await Promise.all([
        comprasQuery,
        licitacionesQuery,
        filtrosQuery,
        afinidadQuery,
      ]);

      const { data: comprasRaw, error: caError } = comprasRes as any;
      if (caError) {
        console.error('[OportunidadesPanel] Error fetching compras:', caError);
        throw caError;
      }
      const { data: licitacionesRaw, error: licError } = licitacionesRes as any;
      if (licError) {
        console.error('[OportunidadesPanel] Error fetching licitaciones:', licError);
      }
      const filtrosRow = (filtrosRes as any)?.data ?? null;
      const afinidadData = (afinidadRes as any)?.data ?? { afinidad: [], aversion: [] };
      const afinWords: string[] = (afinidadData.afinidad ?? []).map(normalizar).filter(Boolean);
      const averWords: string[] = (afinidadData.aversion ?? []).map(normalizar).filter(Boolean);
      const boostDe = (o: { nombre: string; descripcion?: string | null }): number => {
        if (!afinWords.length && !averWords.length) return 0;
        const t = normalizar(`${o.nombre || ''} ${o.descripcion || ''}`);
        let b = 0;
        for (const w of afinWords) if (t.includes(w)) b += 10;
        for (const w of averWords) if (t.includes(w)) b -= 10;
        return Math.max(-30, Math.min(30, b));
      };

      // Traer los matches REALES (tabla ca_matches) de las compras ágiles
      // mostradas y quedarnos con el mejor score por código. Antes el Panel
      // leía compras_agiles.match_score, que está vacío en toda la tabla, por
      // eso "el match no aparecía".
      //
      // IMPORTANTE: ca_matches tiene un match por CLIENTE (score según SU
      // inventario) y su RLS deja leer todas las filas. Si no filtramos por el
      // cliente logueado, un cliente vería el % de match calculado con el
      // inventario de OTRO. Resolvemos la empresa DUEÑA con cliente_owner_id()
      // (si el usuario es miembro de equipo, devuelve la empresa que lo invitó,
      // no la fila vacía que useCliente() le auto-crea) y filtramos por ella.
      let clienteIdPanel: string | null = null;
      try {
        const { data: ownerId } = await (supabase as any).rpc('cliente_owner_id');
        clienteIdPanel = (ownerId as string) ?? null;
      } catch { /* sin sesión / sin empresa: dejamos clienteIdPanel en null */ }

      const codigosCompras = (comprasRaw || [])
        .map((c: any) => c.codigo)
        .filter(Boolean)
        .slice(0, 300);
      const bestMatchByCodigo: Record<string, { score: number; producto: string | null; count: number }> = {};
      if (codigosCompras.length > 0) {
        // ca_matches no está en los tipos generados de Supabase; usamos any.
        let matchQuery = (supabase as any)
          .from('ca_matches')
          .select('compra_agil_codigo, score, nombre_producto, cliente_id')
          .in('compra_agil_codigo', codigosCompras);
        if (clienteIdPanel) matchQuery = matchQuery.eq('cliente_id', clienteIdPanel);
        const { data: matchesRaw, error: matchErr } = await matchQuery;
        if (matchErr) {
          console.error('[OportunidadesPanel] Error fetching ca_matches:', matchErr);
        }
        for (const m of (matchesRaw || []) as any[]) {
          const k = (m as any).compra_agil_codigo as string;
          const score = Math.round(Number((m as any).score) || 0);
          const prev = bestMatchByCodigo[k];
          if (!prev) {
            bestMatchByCodigo[k] = { score, producto: (m as any).nombre_producto ?? null, count: 1 };
          } else {
            prev.count += 1;
            if (score > prev.score) {
              prev.score = score;
              prev.producto = (m as any).nombre_producto ?? null;
            }
          }
        }
      }

      // Map compras_agiles
      const compras: OportunidadPanel[] = (comprasRaw || []).map((c: any) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre || 'Sin título',
        descripcion: c.descripcion,
        organismo: c.nombre_organismo || c.organismo || 'Sin organismo',
        region: c.region,
        monto: c.monto_estimado ?? c.monto ?? null,
        fecha_cierre: c.fecha_cierre,
        fecha_publicacion: c.created_at,
        estado: c.estado,
        tipo: 'compra_agil' as const,
        link_oficial: c.url_ficha || c.link_oficial || null,
        match_score: bestMatchByCodigo[c.codigo]?.score ?? c.match_score ?? null,
        match_encontrado: bestMatchByCodigo[c.codigo] ? true : (c.match_encontrado ?? false),
        items_count: c.compras_agiles_items?.length || 0,
        items_matched: bestMatchByCodigo[c.codigo]?.count ?? 0,
        created_at: c.created_at,
        items_text: (c.compras_agiles_items || [])
          .map((i: any) => i.nombre_producto)
          .filter(Boolean)
          .join(' '),
      }));

      // Map licitaciones (columnas de licitaciones_bi)
      const licitaciones: OportunidadPanel[] = (licitacionesRaw || []).map((l: any) => ({
        id: l.codigo || l.id,
        codigo: l.codigo,
        nombre: l.nombre || l.titulo || 'Sin título',
        descripcion: l.descripcion ?? null,
        organismo: l.institucion_nombre || l.organismo || 'Sin organismo',
        region: l.unidad_compra_region ?? null,
        monto: l.presupuesto_estimado ?? null,
        fecha_cierre: l.fecha_cierre,
        fecha_publicacion: l.fecha_publicacion || l.created_at,
        estado: l.estado,
        tipo: 'licitacion' as const,
        link_oficial: l.codigo
          ? `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${l.codigo}`
          : null,
        match_score: l.match_score ?? null,
        match_encontrado: l.match_encontrado ?? false,
        items_count: 0,
        items_matched: 0,
        created_at: l.created_at || l.fecha_publicacion,
      }));

      let all = [...compras, ...licitaciones];

      // Filtros del cliente (onboarding + IA): no mostrar lo que no cumple.
      // filtrosRow ya se trajo en paralelo arriba. Si no hay filtros, es un no-op.
      if (filtrosRow) {
        all = aplicarFiltrosCliente(all, filtrosRow as Partial<ClienteFiltros>);
      }

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
          o.organismo.toLowerCase().includes(search) ||
          (o.items_text || '').toLowerCase().includes(search)
        );
      }

      // Sort
      const sortBy = filters.sortBy || 'match_score';
      const sortAsc = filters.sortAsc ?? false;
      // Boost por afinidad/aversión aprendida (solo afecta el orden por match).
      const boostByCodigo: Record<string, number> = {};
      if (sortBy === 'match_score') {
        for (const o of all) boostByCodigo[o.codigo] = boostDe(o);
      }
      all.sort((a, b) => {
        let valA: number, valB: number;
        if (sortBy === 'match_score') {
          valA = (a.match_score || 0) + (boostByCodigo[a.codigo] || 0);
          valB = (b.match_score || 0) + (boostByCodigo[b.codigo] || 0);
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

      // El total real de activas puede superar el límite renderizado (MAX_ACTIVAS),
      // así que lo contamos aparte en el servidor (head:true = sin traer filas).
      // Sin esto, "totalActivas" mostraría 500 aunque hubiera miles.
      let totalActivasReal = activas.length;
      if (!incluirCerradas) {
        const [licCount, caCount] = await Promise.all([
          (supabase as any)
            .from('licitaciones_bi')
            .select('codigo', { count: 'exact', head: true })
            .or('estado.is.null,estado.ilike.publicada,estado.ilike.activa')
            .gt('fecha_cierre', nowIso),
          supabase
            .from('compras_agiles')
            .select('codigo', { count: 'exact', head: true })
            .or('estado.ilike.publicada,estado.ilike.activa')
            .gt('fecha_cierre', nowIso),
        ]);
        const licN = (licCount as any)?.count ?? 0;
        const caN = (caCount as any)?.count ?? 0;
        if (licN || caN) totalActivasReal = licN + caN;
      }

      const stats: PanelStats = {
        totalActivas: totalActivasReal,
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
          organismo: (compra as any).nombre_organismo || (compra as any).organismo || 'Sin organismo',
          region: (compra as any).region,
          monto: (compra as any).monto_estimado ?? (compra as any).monto ?? null,
          fecha_cierre: (compra as any).fecha_cierre,
          fecha_publicacion: (compra as any).created_at,
          estado: (compra as any).estado,
          tipo: 'compra_agil',
          link_oficial: (compra as any).url_ficha || (compra as any).link_oficial || null,
          match_score: (compra as any).match_score,
          match_encontrado: (compra as any).match_encontrado ?? false,
          items_count: items.length,
          items_matched: 0,
          created_at: (compra as any).created_at,
          items,
          buyer,
        };
      }

      // Licitacion (desde licitaciones_bi). Se busca por `codigo`; como fallback
      // por `id` (uuid) por si llega un id antiguo.
      let licRow: any = null;
      {
        const { data: byCodigo } = await (supabase as any)
          .from('licitaciones_bi')
          .select('*, licitaciones_bi_items(*)')
          .eq('codigo', id)
          .maybeSingle();
        licRow = byCodigo;
        if (!licRow && /^[0-9a-f-]{36}$/i.test(id)) {
          const { data: byId } = await (supabase as any)
            .from('licitaciones_bi')
            .select('*, licitaciones_bi_items(*)')
            .eq('id', id)
            .maybeSingle();
          licRow = byId;
        }
      }
      const lic = licRow;
      if (!lic) return null;

      const organismoLic = (lic as any).institucion_nombre || (lic as any).organismo || '';
      const { data: institucion } = await supabase
        .from('instituciones')
        .select('*')
        .ilike('nombre', `%${organismoLic}%`)
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

      const licItems: OportunidadItem[] = ((lic as any).licitaciones_bi_items || []).map((i: any) => ({
        id: i.id,
        nombre_producto: i.nombre_producto || i.descripcion || 'Ítem',
        descripcion: i.descripcion ?? null,
        cantidad: i.cantidad ?? null,
        unidad: i.unidad ?? null,
        codigo_producto: i.codigo_producto ?? null,
        precio_unitario: null,
        match_score: null,
        producto_match: null,
        precio_sugerido: null,
      }));

      return {
        id: (lic as any).codigo || (lic as any).id,
        codigo: (lic as any).codigo,
        nombre: (lic as any).nombre || (lic as any).titulo || 'Sin título',
        descripcion: (lic as any).descripcion ?? null,
        organismo: (lic as any).institucion_nombre || (lic as any).organismo || 'Sin organismo',
        region: (lic as any).unidad_compra_region ?? null,
        monto: (lic as any).presupuesto_estimado ?? null,
        fecha_cierre: (lic as any).fecha_cierre,
        fecha_publicacion: (lic as any).fecha_publicacion || (lic as any).created_at,
        estado: (lic as any).estado,
        tipo: 'licitacion',
        link_oficial: (lic as any).codigo
          ? `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${(lic as any).codigo}`
          : null,
        match_score: (lic as any).match_score ?? null,
        match_encontrado: (lic as any).match_encontrado ?? false,
        items_count: licItems.length,
        items_matched: 0,
        created_at: (lic as any).created_at || (lic as any).fecha_publicacion,
        items: licItems,
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
        const { error } = await (supabase as any)
          .from('licitaciones_bi')
          .update({ match_encontrado: false, match_score: 0 })
          .eq('codigo', codigo);
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
