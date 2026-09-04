// Enriquecedor de ítems de Compras Ágiles: baja el detalle por código desde la
// API v2 de ChileCompra (api2.mercadopublico.cl/v2/compra-agil/{codigo}, ticket en
// header) y guarda payload.productos_solicitados en compras_agiles_items. Habilita
// el match por ítem. Prioriza activas sin ítems. Rate-limit friendly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const supabase = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if(!ticket) return new Response(JSON.stringify({error:'API key no configurada'}),{status:500,headers:{...cors,'Content-Type':'application/json'}});

  let limit = 25;
  try { const b = await req.json(); if(b && b.limit) limit = Math.min(Number(b.limit)||25, 100); } catch(_){}

  const { data: pend, error: rpcErr } = await supabase.rpc('compras_agiles_pendientes_items', { p_limit: limit });
  if(rpcErr) return new Response(JSON.stringify({error:rpcErr.message}),{status:500,headers:{...cors,'Content-Type':'application/json'}});
  const rows = pend || [];

  const res:any = { intentadas: rows.length, con_items:0, items_insertados:0, sin_detalle:0, errores:[] as string[] };
  for(const r of rows){
    try{
      const url = `https://api2.mercadopublico.cl/v2/compra-agil/${encodeURIComponent(r.codigo)}`;
      let resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } });
      if(resp.status===429){ await sleep(5000); resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } }); }
      if(!resp.ok){ res.errores.push(`HTTP ${resp.status} ${r.codigo}`); continue; }
      const data = await resp.json();
      const p = data?.payload ?? data;
      const prods = Array.isArray(p?.productos_solicitados) ? p.productos_solicitados : [];
      if(prods.length===0){ res.sin_detalle++; await sleep(150); continue; }
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
      if(insErr){ res.errores.push(`ins ${r.codigo}: ${insErr.message}`); }
      else { res.con_items++; res.items_insertados += toIns.length; }
      await sleep(150);
    }catch(e){ res.errores.push(`${r.codigo}: ${e instanceof Error? e.message:String(e)}`); }
  }
  return new Response(JSON.stringify(res),{headers:{...cors,'Content-Type':'application/json'},status:200});
});
