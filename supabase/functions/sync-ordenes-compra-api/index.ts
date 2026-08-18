// Sincroniza ÓRDENES DE COMPRA frescas desde la API oficial de Mercado Público
// (api.mercadopublico.cl .../ordenesdecompra.json). El día trae ~20 mil OC, así
// que la FASE 1 solo guarda las RELEVANTES al rubro de los clientes (palabras a
// incluir de cliente_filtros_oportunidades + un set base), manteniendo la tabla
// liviana y útil. La FASE 2 completa comprador/proveedor/montos + ítems por
// código (en tandas). Modo probe (body.probe=true) devuelve una muestra.
//
// La LISTA por fecha no trae fecha por OC, pero la consulta es POR fecha => ese
// día es la fecha (provisional) de la OC; el detalle luego la refina al timestamp
// real (FechaCreacion). Los ítems enlazan por numero_oc (== codigo de la OC).
//
// Invocación: body { fecha?:"DDMMYYYY", days?:n, limit?:n, skipList?:bool, probe?:bool }
// Crons: sync-oc-lista (cada 3h, days:2) y sync-oc-detalle (cada 10min, skipList).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MP = 'https://api.mercadopublico.cl/servicios/v1/publico';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function pick(...vals: any[]) { for (const v of vals) { if (v !== undefined && v !== null && v !== '') return v; } return null; }
function toIso(s: any) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); }
function num(v: any) { if (v === undefined || v === null || v === '') return null; const n = Number(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n; }
function ddmmyyyy(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`; }
function ddmmyyyyToIso(s: string) { const m = String(s).match(/^(\d{2})(\d{2})(\d{4})$/); if (!m) return null; return `${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`; }
function itemsOf(d: any) { const it = d?.Items; if (!it) return []; if (Array.isArray(it)) return it; if (Array.isArray(it.Listado)) return it.Listado; return []; }

const DEFAULT_RUBRO = ['papel', 'toner', 'tinta', 'oficina', 'escritorio', 'libreria', 'escolar', 'cuaderno', 'lapiz', 'impresora', 'resma', 'archivador', 'carpeta', 'aseo', 'limpieza', 'desechable', 'guante', 'mascarilla', 'computador', 'notebook', 'mouse', 'teclado', 'monitor', 'ferreteria', 'tornillo', 'pintura', 'herramienta', 'cable', 'pila', 'bateria', 'alimento', 'abarrote', 'mobiliario', 'silla'];

async function mpFetch(url: string) { let r = await fetch(url); if (r.status === 429) { await sleep(5000); r = await fetch(url); } return r; }

async function keywords(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase.from('cliente_filtros_oportunidades').select('palabras_incluir');
    const set = new Set<string>(DEFAULT_RUBRO.map(norm));
    for (const row of (data || [])) { for (const w of (row.palabras_incluir || [])) { const n = norm(w); if (n.length >= 3) set.add(n); } }
    return Array.from(set);
  } catch (_) { return DEFAULT_RUBRO.map(norm); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if (!ticket) return new Response(JSON.stringify({ error: 'API key no configurada' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const probe = body.probe === true;
  const detailLimit = Math.min(Number(body.limit) || 30, 60);
  const daysBack = Math.min(Number(body.days) || 1, 15);
  const skipList = body.skipList === true;

  const fechas: string[] = [];
  if (body.fecha) { fechas.push(String(body.fecha)); }
  else { const now = new Date(); for (let i = 0; i < daysBack; i++) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - i); fechas.push(ddmmyyyy(d)); } }

  if (probe) {
    const fecha = fechas[0];
    const lr = await mpFetch(`${MP}/ordenesdecompra.json?fecha=${fecha}&ticket=${ticket}`);
    if (!lr.ok) return new Response(JSON.stringify({ fase: 'lista', fecha, status: lr.status }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    const ldata = await lr.json(); const listado = ldata.Listado || [];
    return new Response(JSON.stringify({ fecha, cantidad: ldata.Cantidad ?? listado.length, muestra: listado.slice(0, 3) }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const res: any = { fechas, kw: 0, lista_vistas: 0, lista_relevantes: 0, lista_upsert: 0, detalle_intentadas: 0, detalle_ok: 0, items_insertados: 0, errores: [] as string[] };
  const kws = await keywords(supabase); res.kw = kws.length;

  // ---- FASE 1: LISTA por fecha, solo RELEVANTES ----
  if (!skipList) {
    for (const fecha of fechas) {
      try {
        const fechaIso = ddmmyyyyToIso(fecha); // la lista es POR fecha: ese es el día de la OC
        const lr = await mpFetch(`${MP}/ordenesdecompra.json?fecha=${fecha}&ticket=${ticket}`);
        if (!lr.ok) { res.errores.push(`lista ${fecha}: HTTP ${lr.status}`); continue; }
        const ldata = await lr.json();
        if (ldata.Codigo === 203) { res.errores.push('ticket invalido'); break; }
        const listado: any[] = ldata.Listado || [];
        res.lista_vistas += listado.length;
        const rows = listado.map((o: any) => {
          const codigo = o.Codigo ?? o.codigo; if (!codigo) return null;
          const nombre = pick(o.Nombre, o.nombre);
          const n = norm(nombre);
          if (!kws.some((k) => n.includes(k))) return null;
          return {
            codigo: String(codigo), numero_oc: String(codigo), nombre,
            estado: o.CodigoEstado != null ? String(o.CodigoEstado) : (o.Estado != null ? String(o.Estado) : null),
            fecha_envio_oc: fechaIso,
            fecha_emision: fechaIso, // provisional (día); el detalle lo refina al timestamp real
            link_oficial: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`,
            last_scraped_at: new Date().toISOString(), stale: false,
          };
        }).filter(Boolean) as any[];
        res.lista_relevantes += rows.length;
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200);
          const { error } = await supabase.from('ordenes_compra').upsert(chunk, { onConflict: 'codigo', ignoreDuplicates: false });
          if (error) res.errores.push(`upsert ${fecha}[${i}]: ${error.message}`); else res.lista_upsert += chunk.length;
        }
        await sleep(500);
      } catch (e) { res.errores.push(`lista ${fecha}: ${e instanceof Error ? e.message : String(e)}`); }
    }
  }

  // ---- FASE 2: DETALLE por código (relevantes sin organismo aún) ----
  const { data: pend } = await supabase.from('ordenes_compra')
    .select('codigo').is('organismo_comprador', null)
    .order('fecha_envio_oc', { ascending: false, nullsFirst: false }).limit(detailLimit);
  for (const r of (pend || [])) {
    res.detalle_intentadas++;
    try {
      const dr = await mpFetch(`${MP}/ordenesdecompra.json?codigo=${encodeURIComponent(r.codigo)}&ticket=${ticket}`);
      if (!dr.ok) { res.errores.push(`det ${r.codigo}: HTTP ${dr.status}`); continue; }
      const dd = await dr.json();
      if (dd.Codigo === 203) { res.errores.push('ticket invalido'); break; }
      const d = (dd.Listado && dd.Listado[0]) || null; if (!d) continue;
      const comp = d.Comprador || {}; const prov = d.Proveedor || {};
      const upd: any = {
        nombre: pick(d.Nombre),
        estado: d.CodigoEstado != null ? String(d.CodigoEstado) : pick(d.Estado),
        organismo_comprador: pick(comp.NombreOrganismo, comp.NombreUnidad),
        demandante: pick(comp.NombreUnidad, comp.NombreOrganismo),
        rut_demandante: pick(comp.RutUnidad, comp.RutUnidadCompra, comp.Rut),
        unidad_compra: pick(comp.NombreUnidad),
        proveedor_nombre: pick(prov.Nombre, prov.NombreSucursal),
        proveedor: pick(prov.Nombre, prov.NombreSucursal),
        rut_proveedor: pick(prov.RutSucursal, prov.Rut, prov.RutProveedor),
        neto: num(pick(d.TotalNeto, d.Neto)),
        iva: num(pick(d.Impuestos, d.IVA)),
        total: num(pick(d.Total, d.MontoTotal)),
        monto_total: num(pick(d.Total, d.MontoTotal)),
        subtotal: num(pick(d.TotalNeto, d.Neto)),
        moneda: pick(d.TipoMoneda, d.Moneda, 'CLP'),
        fecha_emision: toIso(pick(d.Fechas?.FechaCreacion, d.FechaCreacion, d.Fechas?.FechaEnvio)),
        fecha_envio_oc: toIso(pick(d.Fechas?.FechaEnvio, d.FechaEnvio)),
        numero_licitacion: pick(d.CodigoLicitacion, d.Licitacion),
        raw_json: d, last_scraped_at: new Date().toISOString(), stale: false, updated_at: new Date().toISOString(),
      };
      Object.keys(upd).forEach((k) => { if (upd[k] === null || upd[k] === undefined) delete upd[k]; });
      const { error: uErr } = await supabase.from('ordenes_compra').update(upd).eq('codigo', r.codigo);
      if (uErr) { res.errores.push(`upd ${r.codigo}: ${uErr.message}`); continue; }
      res.detalle_ok++;

      const items = itemsOf(d);
      if (items.length) {
        await supabase.from('ordenes_compra_items').delete().eq('numero_oc', r.codigo);
        const toIns = items.map((it: any) => {
          const pu = num(pick(it.PrecioNeto, it.PrecioUnitario, it.Precio));
          const cant = num(it.Cantidad);
          const vt = num(it.Total); const valor = (vt && vt > 0) ? vt : ((pu != null && cant != null) ? pu * cant : null);
          return {
            numero_oc: r.codigo,
            codigo_producto: it.CodigoProducto != null ? String(it.CodigoProducto) : null,
            producto: pick(it.Producto, it.NombreProducto, it.EspecificacionComprador),
            cantidad: cant, unidad: pick(it.Unidad, it.UnidadMedida),
            precio_unitario: pu, descuento: num(it.TotalDescuentos), cargos: num(it.TotalCargos),
            valor_total: valor,
            especificaciones: pick(it.EspecificacionComprador, it.EspecificacionProveedor, it.Descripcion),
            raw_json: it,
          };
        });
        const { error: iErr } = await supabase.from('ordenes_compra_items').insert(toIns);
        if (iErr) { res.errores.push(`items ${r.codigo}: ${iErr.message}`); } else res.items_insertados += toIns.length;
      }
      await sleep(900);
    } catch (e) { res.errores.push(`det ${r.codigo}: ${e instanceof Error ? e.message : String(e)}`); }
  }

  return new Response(JSON.stringify(res), { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 });
});
