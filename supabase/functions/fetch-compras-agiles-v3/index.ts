// ROBOT Compras Ágiles v3.2 — tandas cortas con marca de agua por página.
// Ventana de 48 h por defecto. La API de Mercado Público tarda 20-60 s por página en ventanas
// de más de unas horas (con 15 s de timeout NUNCA respondía y la ingesta quedó en cero
// durante 13 h el 04-09-2026): timeout de 60 s por página y presupuesto de 100 s por corrida.
// Si una página falla (504/timeout) el cursor vuelve a 1: lo más nuevo siempre está en la página 1.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const TTL_NORMAL = 172800000; // 48 h
const PRESUPUESTO_MS = 100000;
const TIMEOUT_PAGINA_MS = 60000;
function parseCl(s:any):string|null{
  if(!s) return null; let t=String(s).trim();
  if(/(Z|[+\-]\d\d:?\d\d)$/.test(t)){ const d=new Date(t); return isNaN(d.getTime())?null:d.toISOString(); }
  t = t.replace(' ','T'); if(t.length===16) t+=':00';
  const d=new Date(t+'-04:00'); return isNaN(d.getTime())?null:d.toISOString();
}
const num=(v:any)=>(v===null||v===undefined||v==='')?null:Number(v);
Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  const json = (o:any, status=200)=>new Response(JSON.stringify(o),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(!ticket) return json({error:'API key no configurada'},500);
  let maxPaginas = 8; let ttlOverride:number|null = null; let reiniciar = false;
  try{ const b = await req.json(); if(b){ if(b.max_paginas) maxPaginas=Math.min(Number(b.max_paginas),20); if(b.ttl_cambio_ms) ttlOverride=Number(b.ttl_cambio_ms); if(b.reiniciar) reiniciar=true; } }catch(_){}
  const { data: st } = await sb.from('ingesta_ca_estado').select('*').eq('clave','compra_agil').single();
  let pagina = reiniciar ? 1 : (st?.pagina_actual ?? 1);
  const ttl = ttlOverride ?? (st?.ttl_ms ?? TTL_NORMAL);
  const t0 = Date.now();
  const res:any = { desde_pagina:pagina, paginas:0, insertadas:0, total_paginas:st?.total_paginas??null, errores:[] as string[], pasada_completa:false };
  const estado = async (extra:any)=>{ await sb.from('ingesta_ca_estado').update({ ...extra, updated_at:new Date().toISOString() }).eq('clave','compra_agil'); };
  await estado({ ultima_corrida:new Date().toISOString() });
  const B = 'https://api2.mercadopublico.cl/v2/compra-agil';
  const fetchT = (url:string)=>fetch(url,{ headers:{ 'ticket':ticket,'Accept':'application/json' }, signal: AbortSignal.timeout(TIMEOUT_PAGINA_MS) });
  let fallo = false;
  while(res.paginas < maxPaginas && (Date.now()-t0) < PRESUPUESTO_MS){
    const url = `${B}?ttl_cambio_ms=${ttl}&tamano_pagina=50&numero_pagina=${pagina}`;
    let data:any;
    try{
      let resp = await fetchT(url);
      if(resp.status===429 || resp.status===504){ await sleep(2000); resp = await fetchT(url); }
      if(!resp.ok){ res.errores.push(`p${pagina}: HTTP ${resp.status}`); fallo = true; break; }
      data = await resp.json();
      if(data.success!=='OK'){ res.errores.push(`p${pagina}: ${JSON.stringify(data.errors)}`); fallo = true; break; }
    }catch(e){ res.errores.push(`p${pagina}: ${e instanceof Error?e.message:String(e)}`); fallo = true; break; }
    const items = data?.payload?.items || [];
    res.total_paginas = data?.payload?.paginacion?.total_paginas ?? res.total_paginas;
    if(items.length===0){ res.pasada_completa = true; break; }
    const filas = items.map((it:any)=>({
      codigo: it.codigo, nombre: it.nombre||null,
      estado: it.estado?.glosa || it.estado?.codigo || null,
      fecha_publicacion: parseCl(it.fechas?.fecha_publicacion),
      fecha_cierre: parseCl(it.fechas?.fecha_cierre_primer_llamado ?? it.fechas?.fecha_cierre),
      fecha_cierre_segundo_llamado: parseCl(it.fechas?.fecha_cierre_segundo_llamado),
      monto_estimado: num(it.montos?.monto_disponible_clp ?? it.montos?.monto_disponible),
      moneda: it.montos?.moneda||'CLP',
      nombre_organismo: it.institucion?.organismo_comprador||null,
      organismo_rut: it.institucion?.rut||null,
      region: it.institucion?.nombre_region||null,
      tipo_proceso:'compra_agil',
      url_ficha: it.codigo?`https://compra-agil.mercadopublico.cl/resumen-cotizacion/${it.codigo}`:null,
      datos_json: it, updated_at:new Date().toISOString()
    })).filter((r:any)=>r.codigo);
    if(filas.length){
      const { error } = await sb.from('compras_agiles').upsert(filas,{ onConflict:'codigo' });
      if(error){ res.errores.push(`upsert p${pagina}: ${error.message}`); fallo = true; break; }
      res.insertadas += filas.length;
    }
    res.paginas++;
    if(res.total_paginas && pagina >= res.total_paginas){ res.pasada_completa = true; break; }
    pagina++;
    await estado({ pagina_actual:pagina, total_paginas:res.total_paginas, ultimo_exito:new Date().toISOString(), insertadas_ultima:res.insertadas });
    await sleep(120);
  }
  const upd:any = { total_paginas:res.total_paginas, insertadas_ultima:res.insertadas, ttl_ms: ttlOverride ?? TTL_NORMAL,
                    ultimo_error: res.errores.length? res.errores.join(' | ').slice(0,500) : null };
  if(res.errores.length===0) upd.ultimo_exito = new Date().toISOString();
  if(res.pasada_completa || fallo){ upd.pagina_actual = 1; if(res.pasada_completa) upd.pasadas_completas = (st?.pasadas_completas??0)+1; }
  await estado(upd);
  res.siguiente_pagina = upd.pagina_actual ?? pagina; res.ms = Date.now()-t0;
  return json(res);
});
