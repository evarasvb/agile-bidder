// ROBOT Compras Ágiles v2 - usa la NUEVA API de ChileCompra:
//   GET https://api2.mercadopublico.cl/v2/compra-agil  (ticket en HEADER)
//   params: ttl_cambio_ms (requerido), tamano_pagina (10-50), numero_pagina
// Mapea payload.items -> tabla compras_agiles. Upsert por 'codigo'.
// Reemplaza el filtro muerto 'oc.Tipo===AG' del robot viejo.
//
// NOTA (ventana de cambio): `ttl_cambio_ms` filtra por "cambiado en las últimas
// N ms". El default era 5h (18000000), demasiado angosto: cada corrida traía
// solo un delta chico y el panel quedaba con un puñado de compras abiertas
// (6 vs 200+). Se sube el default a 7 días para capturar todo el stock abierto
// (las compras ágiles cierran en 1-3 días, así que 7d cubre con margen).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));

function parseCl(s:any):string|null{
  if(!s) return null; let t=String(s).trim();
  if(/(Z|[+\-]\d\d:?\d\d)$/.test(t)){ const d=new Date(t); return isNaN(d.getTime())?null:d.toISOString(); }
  t = t.replace(' ','T'); if(t.length===16) t+=':00';
  const d=new Date(t+'-04:00'); return isNaN(d.getTime())?null:d.toISOString();
}
function num(v:any){ return (v===null||v===undefined||v==='')?null:Number(v); }

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const supabase = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if(!ticket) return new Response(JSON.stringify({error:'API key no configurada'}),{status:500,headers:{...cors,'Content-Type':'application/json'}});

  let ttl = 604800000; // 7 días por defecto (captura todo el stock abierto).
  let maxPaginas = 60; let desdePagina = 1;
  try{ const b = await req.json(); if(b){ if(b.ttl_cambio_ms) ttl=Number(b.ttl_cambio_ms); if(b.max_paginas) maxPaginas=Number(b.max_paginas); if(b.desde_pagina) desdePagina=Number(b.desde_pagina); } }catch(_){}

  const B = 'https://api2.mercadopublico.cl/v2/compra-agil';
  const res:any = { insertadas:0, paginas:0, total_paginas:null, errores:[], muestra:null };
  let pagina = desdePagina;
  while(res.paginas < maxPaginas){
    const url = `${B}?ttl_cambio_ms=${ttl}&tamano_pagina=50&numero_pagina=${pagina}`;
    let data:any;
    try{
      const resp = await fetch(url, { headers:{ 'ticket': ticket, 'Accept':'application/json' } });
      if(resp.status===429){ await sleep(4000); continue; }
      data = await resp.json();
      if(data.success!=='OK'){ res.errores.push(`p${pagina}: ${JSON.stringify(data.errors)}`); break; }
    }catch(e){ res.errores.push(`p${pagina}: ${e instanceof Error? e.message:String(e)}`); break; }

    const items = data?.payload?.items || [];
    res.total_paginas = data?.payload?.paginacion?.total_paginas ?? res.total_paginas;
    if(items.length===0) break;

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
    if(res.total_paginas && pagina >= res.total_paginas) break;
    pagina++;
    await sleep(300);
  }
  return new Response(JSON.stringify(res),{headers:{...cors,'Content-Type':'application/json'},status:200});
});
