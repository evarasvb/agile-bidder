// Enriquecedor de Compras Ágiles: baja el detalle completo por código desde la API v2
// de ChileCompra (api2.mercadopublico.cl/v2/compra-agil/{codigo}, ticket en header) y
// guarda TODO lo útil: productos pedidos (compras_agiles_items), cabecera completa
// (nombre, organismo, fechas, monto, descripción, plazo y dirección de entrega, ofertas
// recibidas, adjuntos, unidad de compra, tipo de presupuesto) y el resto del payload en
// datos_json.detalle. Así una compra descubierta por el sondeo (sin pasar por el listado)
// queda igual de completa que una que vino del listado.
// Prioriza las abiertas que cierran antes. Presupuesto de tiempo por corrida y reintento
// ante 429/5xx para que un timeout de la API no bote la tanda.
// HORAS: la API entrega hora de Chile (a veces con una "Z" falsa). Se convierte con la
// zona America/Santiago real de cada fecha (horario de verano incluido).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const PRESUPUESTO_MS = 110_000; // el cron corre cada 3 min y la API tarda hasta 30-60 s por consulta

const FMT_CL = new Intl.DateTimeFormat('en-US',{ timeZone:'America/Santiago', hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
function offsetCl(d:Date):number{
  const p:any = Object.fromEntries(FMT_CL.formatToParts(d).map(x=>[x.type,x.value]));
  return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute) - d.getTime())/60000);
}
// Hora de pared chilena ("2026-09-08 12:15", "2026-09-08T12:15:00Z" con Z falsa) -> ISO UTC real.
function parseCl(s:any):string|null{
  if(!s) return null;
  let t = String(s).trim().replace(' ','T').replace(/(\.\d+)?(Z|[+\-]\d\d:?\d\d)$/,'');
  if(t.length===16) t += ':00';
  const pared = new Date(t+'Z'); if(isNaN(pared.getTime())) return null;
  const d = new Date(pared.getTime() - offsetCl(pared)*60000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
const texto = (v:any)=> (typeof v==='string' && v.trim()) ? v.trim() : null;
const entero = (v:any)=> (v===null||v===undefined||v===''||isNaN(Number(v))) ? null : Math.trunc(Number(v));
const num = (v:any)=> (v===null||v===undefined||v===''||isNaN(Number(v))) ? null : Number(v);

// Cabecera completa a partir del detalle de la API (sin productos, que van aparte).
export function cabeceraDesdeDetalle(p:any){
  const { productos_solicitados: _omitidos, ...detalle } = p;
  const plazo = entero(p.entrega?.plazo_entrega_dias);
  const cab:any = {
    descripcion: texto(p.descripcion),
    plazo_entrega: plazo!=null ? String(plazo) : null,
    direccion_entrega: texto(p.entrega?.direccion_entrega),
    tipo_presupuesto: texto(p.presupuesto?.tipo_presupuesto),
    unidad_compra: texto(p.institucion?.unidad_compra),
    ofertas_recibidas: entero(p.resumen?.total_ofertas_recibidas),
    documentos: Array.isArray(p.documentos) ? p.documentos.map((d:any)=>({ id: d.id ?? null, nombre: d.nombre ?? null })) : [],
    fecha_cierre_segundo_llamado: parseCl(p.convocatoria?.fecha_cierre_segundo_llamado ?? p.fechas?.fecha_cierre_segundo_llamado),
    detalle_scrapeado: true,
    detalle_actualizado_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    detalle,
  };
  if(texto(p.nombre)) cab.nombre = texto(p.nombre);
  if(p.estado?.glosa) cab.estado = p.estado.glosa;
  const fp = parseCl(p.fechas?.fecha_publicacion); if(fp) cab.fecha_publicacion = fp;
  const fc = parseCl(p.fechas?.fecha_cierre ?? p.convocatoria?.fecha_cierre_primer_llamado); if(fc) cab.fecha_cierre = fc;
  if(texto(p.institucion?.organismo_comprador)) cab.nombre_organismo = texto(p.institucion.organismo_comprador);
  if(texto(p.institucion?.rut)) cab.organismo_rut = texto(p.institucion.rut);
  if(texto(p.institucion?.nombre_region)) cab.region = texto(p.institucion.nombre_region);
  if(texto(p.presupuesto?.moneda)) cab.moneda = texto(p.presupuesto.moneda);
  const monto = num(p.presupuesto?.monto_disponible_clp ?? p.presupuesto?.monto_disponible ?? p.presupuesto?.presupuesto_estimado);
  if(monto!=null) cab.monto_estimado = monto;
  return cab;
}
export function itemsDesdeDetalle(p:any, compraId:number){
  const prods = Array.isArray(p.productos_solicitados) ? p.productos_solicitados : [];
  return prods.map((it:any)=>({
    compra_agil_id: compraId,
    categoria: it.categoria ?? null,
    codigo_producto: it.codigo_producto!=null ? String(it.codigo_producto) : null,
    nombre_producto: it.nombre ?? null,
    descripcion_producto: it.descripcion ?? null,
    cantidad: num(it.cantidad),
    unidad: it.unidad_medida ?? it.unidad ?? null,
  }));
}

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const supabase = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  const json = (o:any, status=200)=>new Response(JSON.stringify(o),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(!ticket) return json({error:'API key no configurada'},500);

  let limit = 60;
  try { const b = await req.json(); if(b && b.limit) limit = Math.min(Number(b.limit)||60, 100); } catch(_){}

  const { data: pend, error: rpcErr } = await supabase.rpc('compras_agiles_pendientes_items', { p_limit: limit });
  if(rpcErr) return json({error:rpcErr.message},500);
  const rows = pend || [];
  const t0 = Date.now();
  const res:any = { intentadas:0, pendientes:rows.length, con_detalle:0, con_items:0, items_insertados:0, sin_productos:0, errores:[] as string[], ms:0 };

  // Una compra: baja el detalle y guarda todo. Devuelve nada; los contadores van en res.
  const procesar = async (r:any) => {
    res.intentadas++;
    try{
      const url = `https://api2.mercadopublico.cl/v2/compra-agil/${encodeURIComponent(r.codigo)}`;
      let resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } });
      if(resp.status===429 || resp.status>=500){ await sleep(resp.status===429 ? 5000 : 2500); resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } }); }
      if(!resp.ok){
        res.errores.push(`HTTP ${resp.status} ${r.codigo}`);
        // Se marca el intento fallido para que no bloquee la cola: la RPC lo reintenta en 2 h.
        await supabase.from('compras_agiles').update({ detalle_scrapeado: false, detalle_actualizado_at: new Date().toISOString() }).eq('id', r.id);
        return;
      }
      const data = await resp.json();
      const p = data?.payload ?? data;
      if(!p || typeof p !== 'object' || !p.codigo){ res.errores.push(`sin payload ${r.codigo}`); return; }

      // 1) Productos pedidos
      const toIns = itemsDesdeDetalle(p, r.id);
      if(toIns.length){
        await supabase.from('compras_agiles_items').delete().eq('compra_agil_id', r.id);
        const { error: insErr } = await supabase.from('compras_agiles_items').insert(toIns);
        if(insErr) res.errores.push(`ins ${r.codigo}: ${insErr.message}`);
        else { res.con_items++; res.items_insertados += toIns.length; }
      } else {
        res.sin_productos++;
      }

      // 2) Cabecera: todo lo que la API entrega y la ficha muestra
      const { detalle, ...cab } = cabeceraDesdeDetalle(p);
      // datos_json.detalle sin pisar lo que ya trae el listado
      const { data: actual } = await supabase.from('compras_agiles').select('datos_json').eq('id', r.id).maybeSingle();
      cab.datos_json = { ...((actual?.datos_json && typeof actual.datos_json==='object') ? actual.datos_json : {}), detalle };
      const { error: updErr } = await supabase.from('compras_agiles').update(cab).eq('id', r.id);
      if(updErr) res.errores.push(`upd ${r.codigo}: ${updErr.message}`); else res.con_detalle++;
    }catch(e){ res.errores.push(`${r.codigo}: ${e instanceof Error? e.message:String(e)}`); }
  };

  // De a 12 en paralelo: la API tarda entre 2 y 60 s por código, así una corrida rinde ~12x
  // sin pasarse del presupuesto de tiempo ni gatillar el límite de peticiones.
  const PARALELO = 12;
  for(let i=0; i<rows.length && Date.now()-t0 < PRESUPUESTO_MS; i+=PARALELO){
    await Promise.all(rows.slice(i, i+PARALELO).map(procesar));
    await sleep(120);
  }
  res.ms = Date.now()-t0;
  return json(res);
});
