// ROBOT Compras Ágiles v2 - API de ChileCompra:
//   GET https://api2.mercadopublico.cl/v2/compra-agil  (ticket en HEADER)
//   params: ttl_cambio_ms (requerido), tamano_pagina (10-50), numero_pagina
// Mapea payload.items -> tabla compras_agiles. Upsert por 'codigo'.
//
// Tandas cortas con marca de agua: cada corrida procesa pocas páginas (default 6) y guarda en
// ingesta_estado la próxima página; al terminar la última vuelve a la 1. Así una corrida nunca
// muere por tiempo/memoria y si falla, la siguiente retoma donde quedó. Los errores de la API
// se registran con código HTTP y cuerpo para que "succeeded" del cron no tape un ticket vencido.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const CLAVE = 'compras_agiles_v2';

function parseCl(s:any):string|null{
  if(!s) return null; let t=String(s).trim();
  if(/(Z|[+\-]\d\d:?\d\d)$/.test(t)){ const d=new Date(t); return isNaN(d.getTime())?null:d.toISOString(); }
  t = t.replace(' ','T'); if(t.length===16) t+=':00';
  const d=new Date(t+'-04:00'); return isNaN(d.getTime())?null:d.toISOString();
}
function num(v:any){ return (v===null||v===undefined||v==='')?null:Number(v); }

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const t0 = Date.now();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if(!ticket) return new Response(JSON.stringify({error:'API key no configurada'}),{status:500,headers:{...cors,'Content-Type':'application/json'}});

  let ttl = 604800000; // 7 días: todo el stock abierto (las compras ágiles cierran en 1-3 días).
  let maxPaginas = 6; let desdePagina: number | null = null;
  try{ const b = await req.json(); if(b){ if(b.ttl_cambio_ms) ttl=Number(b.ttl_cambio_ms); if(b.max_paginas) maxPaginas=Number(b.max_paginas); if(b.desde_pagina) desdePagina=Number(b.desde_pagina); } }catch(_){}

  // Marca de agua: dónde quedó la corrida anterior
  const { data: est } = await supabase.from('ingesta_estado').select('valor').eq('clave', CLAVE).maybeSingle();
  const estado: any = est?.valor ?? {};
  let pagina = desdePagina ?? Number(estado.proxima_pagina ?? 1);
  if(!Number.isFinite(pagina) || pagina < 1) pagina = 1;

  const B = 'https://api2.mercadopublico.cl/v2/compra-agil';
  const res:any = { desde_pagina: pagina, insertadas:0, paginas:0, total_paginas:null, errores:[], muestra:null, ms:0 };
  let completo = false;
  while(res.paginas < maxPaginas && Date.now() - t0 < 100_000){
    const url = `${B}?ttl_cambio_ms=${ttl}&tamano_pagina=50&numero_pagina=${pagina}`;
    let data:any;
    try{
      const resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } });
      if(resp.status===429){ await sleep(4000); continue; }
      const texto = await resp.text();
      try{ data = JSON.parse(texto); }catch{ res.errores.push(`p${pagina}: HTTP ${resp.status} no-JSON: ${texto.slice(0,200)}`); break; }
      if(data.success!=='OK'){ res.errores.push(`p${pagina}: HTTP ${resp.status} ${JSON.stringify(data.errors ?? data.message ?? data).slice(0,300)}`); break; }
    }catch(e){ res.errores.push(`p${pagina}: ${e instanceof Error? e.message:String(e)}`); break; }

    const items = data?.payload?.items || [];
    res.total_paginas = data?.payload?.paginacion?.total_paginas ?? res.total_paginas;
    if(items.length===0){ completo = true; break; }

    const filas = items.map((it:any)=>({
      codigo: it.codigo,
      nombre: it.nombre || null,
      estado: it.estado?.glosa || it.estado?.codigo || null,
      fecha_publicacion: parseCl(it.fechas?.fecha_publicacion),
      fecha_cierre: parseCl(it.fechas?.fecha_cierre_primer_llamado ?? it.fechas?.fecha_cierre),
      fecha_cierre_segundo_llamado: parseCl(it.fechas?.fecha_cierre_segundo_llamado),
      monto_estimado: num(it.montos?.monto_disponible_clp ?? it.montos?.monto_disponible),
      moneda: it.montos?.moneda || 'CLP',
      nombre_organismo: it.institucion?.organismo_comprador || null,
      organismo_rut: it.institucion?.rut || null,
      region: it.institucion?.nombre_region || null,
      tipo_proceso: 'compra_agil',
      url_ficha: it.codigo ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${it.codigo}` : null,
      datos_json: it,
      updated_at: new Date().toISOString()
    })).filter((r:any)=>r.codigo);

    if(filas.length){
      const { error } = await supabase.from('compras_agiles').upsert(filas, { onConflict:'codigo' });
      if(error){ res.errores.push(`upsert p${pagina}: ${error.message}`); break; }
      res.insertadas += filas.length;
      if(!res.muestra) res.muestra = { codigo:filas[0].codigo, organismo:filas[0].nombre_organismo, monto:filas[0].monto_estimado, cierre:filas[0].fecha_cierre };
    }
    res.paginas++;
    if(res.total_paginas && pagina >= res.total_paginas){ completo = true; break; }
    pagina++;
    await sleep(200);
  }

  // Guardar marca de agua (si terminó la vuelta, parte de nuevo desde la 1)
  const proxima = completo ? 1 : (res.errores.length ? pagina : pagina);
  await supabase.from('ingesta_estado').upsert({ clave: CLAVE, valor: { proxima_pagina: proxima, completo, ultimo_ok: res.insertadas ? new Date().toISOString() : (estado.ultimo_ok ?? null), ultimo_error: res.errores[0] ?? null, total_paginas: res.total_paginas, ttl_cambio_ms: ttl }, updated_at: new Date().toISOString() });
  if(res.errores.length){
    await supabase.from('system_logs').insert({ tipo: 'scraping', severidad: 'error', mensaje: ('[ingesta-compras-agiles] ' + res.errores[0]).slice(0, 500), detalles: res }).then(()=>{}, ()=>{});
  }

  // Encadenar el MATCH solo si entró algo nuevo (no gastar CPU en vano).
  if(res.insertadas){
    try{ const { data: m, error: mErr } = await supabase.rpc('generar_matches_ca_todos'); res.matches = mErr ? `error: ${mErr.message}` : m; }
    catch(e){ res.matches = `error: ${e instanceof Error? e.message:String(e)}`; }
  }
  res.ms = Date.now() - t0;
  return new Response(JSON.stringify(res),{headers:{...cors,'Content-Type':'application/json'},status:200});
});
