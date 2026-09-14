// Sincroniza licitaciones desde la API oficial de Mercado Público
// (api.mercadopublico.cl/servicios/v1/publico/licitaciones.json) hacia la tabla
// licitaciones_bi (+ licitaciones_bi_items).
//
// Contexto: la función `mercadopublico-api` desplegada en producción quedó como
// un proxy que NO guardaba nada (devolvía los datos crudos), por eso el sync
// reportaba synced=0 aunque la API devolviera miles. Esta función dedicada sí
// persiste. El workflow sync-mercadopublico.yml apunta aquí para el paso de
// licitaciones.
//
// Eficiencia: el upsert se hace por LOTES (chunks) en vez de fila por fila. Con
// miles de licitaciones activas, el modo fila-por-fila tardaba minutos y hacía
// timeout el edge function / el curl del workflow. El modo por lotes lo baja a
// segundos.
//
// Body: { fecha?: "DDMMYYYY", estado?: string, organismo?: string, ticket?: string }
// El ticket sale de body.ticket o del env MERCADOPUBLICO_API_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { reconcileStatuses, SCAN_LIMIT, STATUS_BY_CODE, type Candidate } from './reconcile.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';
const CHUNK = 500;

// El listado por `estado=activas` trae CodigoEstado pero NO el texto Estado, así
// que las licitaciones activas quedaban con estado=NULL y el panel (que filtra
// por estado='Publicada') las ocultaba. Mapeamos el código al texto oficial.
const ESTADO_POR_CODIGO = STATUS_BY_CODE;

function parseDate(d?: string) {
  if (!d) return null;
  const t = Date.parse(d);
  return isNaN(t) ? null : new Date(t).toISOString();
}
function formatDate(dt: Date) {
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const yy = dt.getUTCFullYear();
  return `${dd}${mm}${yy}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const out = { success: true, synced: 0, items_synced: 0, total: 0, reconciled: 0, status_checks: 0, errors: [] as string[] };
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const ticket = body.ticket || Deno.env.get('MERCADOPUBLICO_API_KEY');
    if (!ticket) {
      return new Response(JSON.stringify({ success: false, error: 'Falta ticket (body.ticket o MERCADOPUBLICO_API_KEY)' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const params = new URLSearchParams();
    params.set('ticket', ticket);
    // La API oficial filtra por `estado` O por `fecha`, no por ambos a la vez.
    // Para el panel queremos las ACTIVAS (estado=activas, sin fecha). Si no se
    // pide estado, caemos al modo histórico por fecha de publicación.
    if (body.estado) {
      params.set('estado', body.estado);
    } else {
      params.set('fecha', body.fecha || formatDate(new Date()));
    }
    if (body.organismo) params.set('CodigoOrganismo', body.organismo);

    const apiUrl = `${MP_BASE}/licitaciones.json?${params.toString()}`;
    const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ success: false, error: `API ${resp.status}`, details: t.slice(0, 300) }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const data = await resp.json();
    if (!Array.isArray(data?.Listado)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid official listing' }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const listado = data.Listado;
    out.total = data?.Cantidad ?? listado.length;

    // 1) Mapear cada licitación a su fila + sus ítems (si el detalle los trae).
    const rows = listado.map((lic: any) => ({
      items: Array.isArray(lic.Items) ? lic.Items : [],
      data: {
        codigo: lic.CodigoExterno,
        nombre: lic.Nombre ?? null,
        descripcion: lic.Descripcion ?? null,
        estado: lic.Estado ?? (lic.CodigoEstado != null ? ESTADO_POR_CODIGO[lic.CodigoEstado] ?? null : null),
        codigo_estado: lic.CodigoEstado ?? null,
        tipo: lic.Tipo ?? null,
        codigo_tipo: lic.CodigoTipo ?? null,
        fecha_publicacion: parseDate(lic.FechaPublicacion),
        fecha_cierre: parseDate(lic.FechaCierre),
        fecha_cierre_documentos: parseDate(lic.FechaCierreRecepcionDoctos),
        fecha_creacion: parseDate(lic.FechaCreacion),
        institucion_nombre: lic.NombreOrganismo ?? null,
        institucion_rut: lic.RutUnidadCompra ?? null,
        unidad_compra: lic.NombreUnidadCompra ?? null,
        unidad_compra_direccion: lic.DireccionUnidadCompra ?? null,
        unidad_compra_comuna: lic.ComunaUnidadCompra ?? null,
        unidad_compra_region: lic.RegionUnidadCompra ?? null,
        presupuesto_estimado: lic.Estimacion ?? null,
        moneda: lic.Moneda || 'CLP',
        etapas: lic.Etapas ?? null,
        tiempo_evaluacion_dias: lic.UnidadTiempoEvaluacion ?? null,
        raw_data: lic,
      } as Record<string, unknown>,
    })).filter((r) => r.data.codigo);

    // 2) El listado por `estado`/`fecha` es abreviado (sólo codigo, nombre,
    // estado, fecha_cierre...). Para no pisar con NULL columnas ya pobladas por
    // una carga más rica, sólo incluimos en el upsert las columnas que traen
    // algún valor en ESTE lote (union de claves no nulas).
    const presentCols = new Set<string>(['codigo']);
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.data)) {
        if (v !== null && v !== undefined) presentCols.add(k);
      }
    }
    const cleanRows = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const k of presentCols) o[k] = (r.data as any)[k] ?? null;
      return o;
    });

    // 3) Upsert por lotes, recuperando id+codigo para enlazar los ítems.
    const idByCodigo: Record<string, string> = {};
    for (let i = 0; i < cleanRows.length; i += CHUNK) {
      const chunk = cleanRows.slice(i, i + CHUNK);
      const { data: ins, error } = await supabase
        .from('licitaciones_bi')
        .upsert(chunk, { onConflict: 'codigo' })
        .select('id, codigo');
      if (error) { out.errors.push(`upsert[${i}]: ${error.message}`); continue; }
      for (const row of (ins || []) as any[]) idByCodigo[row.codigo] = row.id;
      out.synced += (ins?.length || 0);
    }

    // 4) Ítems (sólo cuando el detalle los trae, p.ej. modo fecha). Se borran los
    // previos de esas licitaciones y se reinsertan, todo por lotes.
    const itemsToInsert: any[] = [];
    const idsConItems: string[] = [];
    for (const r of rows) {
      if (r.items.length === 0) continue;
      const id = idByCodigo[r.data.codigo as string];
      if (!id) continue;
      idsConItems.push(id);
      for (const it of r.items) {
        itemsToInsert.push({
          licitacion_id: id,
          correlativo: it.Correlativo ?? null,
          codigo_producto: it.CodigoProducto != null ? String(it.CodigoProducto) : null,
          codigo_categoria: it.CodigoCategoria ?? null,
          categoria: it.Categoria ?? null,
          nombre_producto: it.NombreProducto ?? null,
          descripcion: it.Descripcion ?? null,
          cantidad: it.Cantidad ?? null,
          unidad: it.UnidadMedida ?? null,
        });
      }
    }
    if (idsConItems.length > 0) {
      for (let i = 0; i < idsConItems.length; i += CHUNK) {
        await supabase.from('licitaciones_bi_items').delete().in('licitacion_id', idsConItems.slice(i, i + CHUNK));
      }
      for (let i = 0; i < itemsToInsert.length; i += CHUNK) {
        const chunk = itemsToInsert.slice(i, i + CHUNK);
        const { error } = await supabase.from('licitaciones_bi_items').insert(chunk);
        if (error) { out.errors.push(`items[${i}]: ${error.message}`); continue; }
        out.items_synced += chunk.length;
      }
    }

    // The active listing cannot refresh processes that disappeared from it.
    // Use the existing cron, only for an unfiltered active sync with successful writes.
    if (body.estado === 'activas' && !body.organismo && out.errors.length === 0) {
      const reconciliation = await reconcileStatuses(new Set<string>(rows.map(r => String(r.data.codigo))), ticket, {
        load: async () => {
          const { data: candidates, error } = await supabase.from('licitaciones_bi')
            .select('id,codigo,estado,codigo_estado,fecha_cierre,updated_at,raw_data')
            .or('codigo_estado.eq.5,estado.ilike.publicada,estado.ilike.activa,estado.is.null')
            .order('updated_at', { ascending: true, nullsFirst: true })
            .order('codigo', { ascending: true })
            .limit(SCAN_LIMIT);
          if (error) throw new Error('candidate_read_failed');
          return (candidates ?? []) as Candidate[];
        },
        save: async (row, patch) => {
          let update = supabase.from('licitaciones_bi').update(patch).eq('id', row.id);
          update = row.updated_at === null ? update.is('updated_at', null) : update.eq('updated_at', row.updated_at);
          const { data: saved, error } = await update.select('id');
          if (error) throw new Error('persistence_failed');
          return saved?.length === 1;
        },
        fetch,
        sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
        now: Date.now,
      });
      out.reconciled = reconciliation.changed;
      out.status_checks = reconciliation.attempted;
      out.errors.push(...reconciliation.errors);
    }
    out.success = out.errors.length === 0;
    return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
