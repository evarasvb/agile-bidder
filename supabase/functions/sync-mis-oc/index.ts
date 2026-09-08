// Trae las ÓRDENES DE COMPRA PROPIAS de un cliente (donde él es el PROVEEDOR)
// desde la API oficial de Mercado Público y las guarda en `ordenes_compra`, para
// que el reporte "Mis OC" muestre sus ventas reales.
//
// Por qué existe: el scraper general (sync-ordenes-compra-api) baja el mercado por
// FECHA + rubro; nunca busca al cliente como vendedor, así que las OC de un
// proveedor chico (ej. Grumpy) no quedaban en la base. Aquí sí lo buscamos a él.
//
// Cómo: 1) RUT -> CodigoProveedor vía .../Empresas/BuscarProveedor. 2) Listado de
// OC por CodigoProveedor (sin fecha si la API lo permite; si no, iterando los
// últimos `dias`). 3) Detalle por código y upsert con las MISMAS columnas reales
// que usa el scraper. El rut_proveedor se guarda con el MISMO formato con puntos
// que consulta el front (formatearRUT), para que "Mis OC" calce por igualdad.
//
// Invocación: body { cliente_id?:uuid, rut?:string, dias?:n } (uno de cliente_id/rut).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const MP = 'https://api.mercadopublico.cl/servicios/v1/publico';
const MP_EMPRESAS = 'https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarProveedor';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function pick(...vals: any[]) { for (const v of vals) { if (v !== undefined && v !== null && v !== '') return v; } return null; }
function toIso(s: any) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); }
function num(v: any) { if (v === undefined || v === null || v === '') return null; const n = Number(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n; }
function ddmmyyyy(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`; }
function itemsOf(d: any) { const it = d?.Items; if (!it) return []; if (Array.isArray(it)) return it; if (Array.isArray(it.Listado)) return it.Listado; return []; }

// Mismo formato que formatearRUT del front (con puntos y guion) para que la
// consulta de "Mis OC" (.eq('rut_proveedor', formatearRUT(rut))) calce exacto.
function formatearRUT(rut: string): string {
  const clean = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1); const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

async function mpFetch(url: string) { let r = await fetch(url); if (r.status === 429) { await sleep(4000); r = await fetch(url); } return r; }

// Busca en un objeto/array el primer valor numérico bajo una clave que "parezca"
// el código de la empresa (CodigoEmpresa / Codigo / IdEmpresa), evitando estados.
function buscarCodigoEmpresa(obj: any): string | null {
  const visto = new Set<any>();
  const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || visto.has(cur)) continue;
    visto.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (v && typeof v === 'object') { stack.push(v); continue; }
      const key = k.toLowerCase();
      if (/(codigo|id).*empresa|empresa.*(codigo|id)|codigoproveedor/.test(key) && v != null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if (!ticket) return new Response(JSON.stringify({ error: 'API key de Mercado Público no configurada' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

  let body: any = {};
  try { body = await req.json(); } catch (_) {}

  // Resolver RUT del cliente.
  let rut: string | null = body.rut ? String(body.rut) : null;
  let nombreEmpresa: string | null = null;
  if (!rut && body.cliente_id) {
    const { data } = await supabase.from('clientes').select('rut, empresa_nombre').eq('id', body.cliente_id).maybeSingle();
    rut = (data as any)?.rut ?? null;
    nombreEmpresa = (data as any)?.empresa_nombre ?? null;
  }
  if (!rut) return new Response(JSON.stringify({ error: 'Falta el RUT del cliente (envía rut o cliente_id).' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  const rutFmt = formatearRUT(rut);

  const res: any = { rut: rutFmt, codigo_proveedor: null, encontradas: 0, enriquecidas: 0, items_insertados: 0, parcial: false, errores: [] as string[] };

  // 1) RUT -> CodigoProveedor.
  try {
    const er = await mpFetch(`${MP_EMPRESAS}?rutempresaproveedor=${encodeURIComponent(rutFmt)}&ticket=${ticket}`);
    if (!er.ok) { res.errores.push(`BuscarProveedor: HTTP ${er.status}`); }
    else {
      const ed = await er.json();
      if (ed?.Codigo === 203) { res.errores.push('ticket invalido'); }
      res.codigo_proveedor = buscarCodigoEmpresa(ed);
      if (!nombreEmpresa) nombreEmpresa = buscarNombre(ed);
    }
  } catch (e) { res.errores.push(`BuscarProveedor: ${e instanceof Error ? e.message : String(e)}`); }

  if (!res.codigo_proveedor) {
    res.errores.push('No se pudo obtener el código de proveedor para este RUT en Mercado Público. ¿El RUT tiene perfil de proveedor?');
    return new Response(JSON.stringify(res), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const code = res.codigo_proveedor;

  // 2) Listar códigos de OC del proveedor. Primero intento sin fecha (toda la
  //    historia); si la API lo exige, itero por día en la ventana pedida.
  const codigos = new Set<string>();
  const t0 = Date.now(); const PRESUPUESTO_LISTA_MS = 70_000;
  try {
    const lr = await mpFetch(`${MP}/ordenesdecompra.json?CodigoProveedor=${encodeURIComponent(code)}&ticket=${ticket}`);
    if (lr.ok) {
      const ld = await lr.json();
      for (const o of (ld?.Listado || [])) { const c = o?.Codigo ?? o?.codigo; if (c) codigos.add(String(c)); }
    }
  } catch (_) { /* fallback a iteración por día */ }

  if (codigos.size === 0) {
    const dias = Math.min(Math.max(Number(body.dias) || 180, 1), 365);
    const now = new Date();
    for (let i = 0; i < dias; i++) {
      if (Date.now() - t0 > PRESUPUESTO_LISTA_MS) { res.parcial = true; res.errores.push(`listado parcial: revisé ${i} de ${dias} días, vuelve a ejecutar para seguir`); break; }
      const d = new Date(now); d.setUTCDate(d.getUTCDate() - i);
      const fecha = ddmmyyyy(d);
      try {
        const lr = await mpFetch(`${MP}/ordenesdecompra.json?fecha=${fecha}&CodigoProveedor=${encodeURIComponent(code)}&ticket=${ticket}`);
        if (!lr.ok) { res.errores.push(`lista ${fecha}: HTTP ${lr.status}`); continue; }
        const ld = await lr.json();
        if (ld?.Codigo === 203) { res.errores.push('ticket invalido'); break; }
        for (const o of (ld?.Listado || [])) { const c = o?.Codigo ?? o?.codigo; if (c) codigos.add(String(c)); }
      } catch (e) { res.errores.push(`lista ${fecha}: ${e instanceof Error ? e.message : String(e)}`); }
      await sleep(120);
    }
  }
  res.encontradas = codigos.size;
  if (codigos.size === 0) return new Response(JSON.stringify(res), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

  // 3) Detalle + upsert (mismas columnas reales que el scraper). rut_proveedor se
  //    fuerza al formato con puntos para que "Mis OC" calce por igualdad.
  const PRESUPUESTO_TOTAL_MS = 130_000;
  const lista = Array.from(codigos);
  for (const codigo of lista) {
    if (Date.now() - t0 > PRESUPUESTO_TOTAL_MS) { res.parcial = true; res.errores.push('detalle parcial por tiempo: vuelve a ejecutar para completar montos'); break; }
    try {
      const dr = await mpFetch(`${MP}/ordenesdecompra.json?codigo=${encodeURIComponent(codigo)}&ticket=${ticket}`);
      if (!dr.ok) { res.errores.push(`det ${codigo}: HTTP ${dr.status}`); continue; }
      const dd = await dr.json();
      if (dd?.Codigo === 203) { res.errores.push('ticket invalido'); break; }
      const d = (dd?.Listado && dd.Listado[0]) || null;
      if (!d) { continue; }
      const comp = d.Comprador || {}; const prov = d.Proveedor || {};
      const fila: any = {
        codigo: String(codigo), numero_oc: String(codigo),
        nombre: pick(d.Nombre),
        estado: d.CodigoEstado != null ? String(d.CodigoEstado) : pick(d.Estado),
        organismo_comprador: pick(comp.NombreOrganismo, comp.NombreUnidad),
        demandante: pick(comp.NombreUnidad, comp.NombreOrganismo),
        rut_demandante: pick(comp.RutUnidad, comp.RutUnidadCompra, comp.Rut),
        unidad_compra: pick(comp.NombreUnidad),
        // Forzamos nombre y RUT del proveedor a los del cliente (sabemos que es él).
        proveedor_nombre: pick(nombreEmpresa, prov.Nombre, prov.NombreSucursal),
        proveedor: pick(nombreEmpresa, prov.Nombre, prov.NombreSucursal),
        rut_proveedor: rutFmt,
        neto: num(pick(d.TotalNeto, d.Neto)),
        iva: num(pick(d.Impuestos, d.IVA)),
        total: num(pick(d.Total, d.MontoTotal)),
        monto_total: num(pick(d.Total, d.MontoTotal)),
        subtotal: num(pick(d.TotalNeto, d.Neto)),
        moneda: pick(d.TipoMoneda, d.Moneda, 'CLP'),
        fecha_emision: toIso(pick(d.Fechas?.FechaCreacion, d.FechaCreacion, d.Fechas?.FechaEnvio)),
        fecha_envio_oc: toIso(pick(d.Fechas?.FechaEnvio, d.FechaEnvio)),
        numero_licitacion: pick(d.CodigoLicitacion, d.Licitacion),
        link_oficial: `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`,
        relevante: true,
        raw_json: d, last_scraped_at: new Date().toISOString(), stale: false, updated_at: new Date().toISOString(),
      };
      Object.keys(fila).forEach((k) => { if (fila[k] === null || fila[k] === undefined) delete fila[k]; });
      fila.rut_proveedor = rutFmt; // asegurar que no se borre aunque sea el mismo
      const { error: uErr } = await supabase.from('ordenes_compra').upsert(fila, { onConflict: 'codigo', ignoreDuplicates: false });
      if (uErr) { res.errores.push(`upsert ${codigo}: ${uErr.message}`); continue; }
      res.enriquecidas++;

      const items = itemsOf(d);
      if (items.length) {
        await supabase.from('ordenes_compra_items').delete().eq('numero_oc', codigo);
        const toIns = items.map((it: any) => {
          const pu = num(pick(it.PrecioNeto, it.PrecioUnitario, it.Precio));
          const cant = num(it.Cantidad);
          const vt = num(it.Total); const valor = (vt && vt > 0) ? vt : ((pu != null && cant != null) ? pu * cant : null);
          return {
            numero_oc: String(codigo),
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
        if (iErr) res.errores.push(`items ${codigo}: ${iErr.message}`); else res.items_insertados += toIns.length;
      }
      await sleep(700);
    } catch (e) { res.errores.push(`det ${codigo}: ${e instanceof Error ? e.message : String(e)}`); }
  }

  return new Response(JSON.stringify(res), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
});

// Nombre de la empresa desde la respuesta de BuscarProveedor (defensivo).
function buscarNombre(obj: any): string | null {
  const visto = new Set<any>(); const stack = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || visto.has(cur)) continue;
    visto.add(cur);
    for (const [k, v] of Object.entries(cur)) {
      if (v && typeof v === 'object') { stack.push(v); continue; }
      if (/(nombre).*empresa|empresa.*(nombre)|razonsocial|nombreproveedor/i.test(k) && v) return String(v);
    }
  }
  return null;
}
