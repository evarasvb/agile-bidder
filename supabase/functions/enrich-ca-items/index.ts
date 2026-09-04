// Enriquecedor de Compras Ágiles: baja el detalle completo por código desde la API v2
// de ChileCompra (api2.mercadopublico.cl/v2/compra-agil/{codigo}, ticket en header) y
// guarda TODO lo útil: productos pedidos (compras_agiles_items), descripción, plazo y
// dirección de entrega, ofertas recibidas, adjuntos, unidad de compra y tipo de
// presupuesto (columnas de compras_agiles) y el resto del payload en datos_json.detalle.
// Prioriza las abiertas que cierran antes. Presupuesto de tiempo por corrida y reintento
// ante 429/5xx para que un timeout de la API no bote la tanda.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const PRESUPUESTO_MS = 110_000; // el cron corre cada 5 min y la API tarda hasta 30-60 s por consulta

function parseCl(s:any):string|null{
  if(!s) return null; let t=String(s).trim();
  if(/(Z|[+\-]\d\d:?\d\d)$/.test(t)){ const d=new Date(t); return isNaN(d.getTime())?null:d.toISOString(); }
  t = t.replace(' ','T'); if(t.length===16) t+=':00';
  const d=new Date(t+'-04:00'); return isNaN(d.getTime())?null:d.toISOString();
}
const texto = (v:any)=> (typeof v==='string' && v.trim()) ? v.trim() : null;
const entero = (v:any)=> (v===null||v===undefined||v===''||isNaN(Number(v))) ? null : Math.trunc(Number(v));

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
      const prods = Array.isArray(p.productos_solicitados) ? p.productos_solicitados : [];
      if(prods.length){
        await supabase.from('compras_agiles_items').delete().eq('compra_agil_id', r.id);
        const toIns = prods.map((it:any)=>({
          compra_agil_id: r.id,
          categoria: it.categoria ?? null,
          codigo_producto: it.codigo_producto!=null ? String(it.codigo_producto) : null,
          nombre_producto: it.nombre ?? null,
          descripcion_producto: it.descripcion ?? null,
          cantidad: (it.cantidad!=null && !isNaN(Number(it.cantidad))) ? Number(it.cantidad) : null,
          unidad: it.unidad_medida ?? it.unidad ?? null,
        }));
        const { error: insErr } = await supabase.from('compras_agiles_items').insert(toIns);
        if(insErr) res.errores.push(`ins ${r.codigo}: ${insErr.message}`);
        else { res.con_items++; res.items_insertados += toIns.length; }
      } else {
        res.sin_productos++;
      }

      // 2) Cabecera: todo lo que la API entrega y la ficha muestra
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
        fecha_cierre_segundo_llamado: parseCl(p.convocatoria?.fecha_cierre_segundo_llamado),
        detalle_scrapeado: true,
        detalle_actualizado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if(p.estado?.glosa) cab.estado = p.estado.glosa;
      const monto = p.presupuesto?.monto_disponible_clp ?? p.presupuesto?.monto_disponible ?? p.presupuesto?.presupuesto_estimado;
      if(monto!=null && !isNaN(Number(monto))) cab.monto_estimado = Number(monto);
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
