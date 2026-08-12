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
// Body: { fecha?: "DDMMYYYY", estado?: string, organismo?: string, ticket?: string }
// El ticket sale de body.ticket o del env MERCADOPUBLICO_API_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico';

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
  const out = { success: true, synced: 0, items_synced: 0, total: 0, errors: [] as string[] };
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
    params.set('fecha', body.fecha || formatDate(new Date()));
    if (body.estado) params.set('estado', body.estado);
    if (body.organismo) params.set('CodigoOrganismo', body.organismo);

    const apiUrl = `${MP_BASE}/licitaciones.json?${params.toString()}`;
    const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ success: false, error: `API ${resp.status}`, details: t.slice(0, 300) }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const data = await resp.json();
    const listado = Array.isArray(data?.Listado) ? data.Listado : [];
    out.total = data?.Cantidad ?? listado.length;

    for (const lic of listado) {
      try {
        const licData = {
          codigo: lic.CodigoExterno,
          nombre: lic.Nombre,
          descripcion: lic.Descripcion ?? null,
          estado: lic.Estado ?? null,
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
        };
        const { data: ins, error: e1 } = await supabase
          .from('licitaciones_bi')
          .upsert(licData, { onConflict: 'codigo' })
          .select('id')
          .single();
        if (e1) { out.errors.push(`${lic.CodigoExterno}: ${e1.message}`); continue; }

        if (Array.isArray(lic.Items) && lic.Items.length > 0 && ins?.id) {
          const itemsData = lic.Items.map((it: any) => ({
            licitacion_id: ins.id,
            correlativo: it.Correlativo ?? null,
            codigo_producto: it.CodigoProducto != null ? String(it.CodigoProducto) : null,
            codigo_categoria: it.CodigoCategoria ?? null,
            categoria: it.Categoria ?? null,
            nombre_producto: it.NombreProducto ?? null,
            descripcion: it.Descripcion ?? null,
            cantidad: it.Cantidad ?? null,
            unidad: it.UnidadMedida ?? null,
          }));
          await supabase.from('licitaciones_bi_items').delete().eq('licitacion_id', ins.id);
          const { error: e2 } = await supabase.from('licitaciones_bi_items').insert(itemsData);
          if (!e2) out.items_synced += itemsData.length;
        }
        out.synced++;
      } catch (err) {
        out.errors.push(`${lic?.CodigoExterno}: ${err}`);
      }
    }
    out.success = out.errors.length === 0;
    return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
