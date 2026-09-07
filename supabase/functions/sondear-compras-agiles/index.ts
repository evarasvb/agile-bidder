// SONDEO de Compras Ágiles: respaldo del listado. Los códigos son correlativos por unidad
// de compra (1704-3084-COT26, 1704-3086-COT26...), así que cuando el listado de la API
// (api2.mercadopublico.cl/v2/compra-agil) responde 504 o se atrasa, este robot toma las
// unidades con actividad reciente y prueba el código siguiente al último conocido con el
// endpoint de detalle (que responde rápido). Cada compra encontrada se guarda completa
// (cabecera + productos) y queda marcada como enriquecida.
// Corre cada 10 min; si el listado trajo filas en los últimos 20 min se omite (salvo forzar=true).
// Recorre las unidades en rondas (cursor en ingesta_ca_estado clave 'sondeo') dentro del
// presupuesto de tiempo, para cubrir todas sin pasarse del límite de la API.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
const PRESUPUESTO_MS = 110_000;
const PARALELO = 6; // con 10 y otra corrida encima la API devolvió 429 (07-09-2026)
const SALTO_MAX = 3;       // huecos consecutivos tolerados (cotizaciones borradas o no publicadas)
const NUEVAS_MAX_POR_UNIDAD = 6;

const FMT_CL = new Intl.DateTimeFormat('en-US',{ timeZone:'America/Santiago', hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
function offsetCl(d:Date):number{
  const p:any = Object.fromEntries(FMT_CL.formatToParts(d).map(x=>[x.type,x.value]));
  return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute) - d.getTime())/60000);
}
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

function cabeceraDesdeDetalle(p:any){
  const { productos_solicitados: _omitidos, ...detalle } = p;
  const plazo = entero(p.entrega?.plazo_entrega_dias);
  const cab:any = {
    codigo: p.codigo,
    nombre: texto(p.nombre) ?? '(sin nombre)',
    estado: p.estado?.glosa ?? p.estado?.codigo ?? null,
    fecha_publicacion: parseCl(p.fechas?.fecha_publicacion),
    fecha_cierre: parseCl(p.fechas?.fecha_cierre ?? p.convocatoria?.fecha_cierre_primer_llamado),
    fecha_cierre_segundo_llamado: parseCl(p.convocatoria?.fecha_cierre_segundo_llamado ?? p.fechas?.fecha_cierre_segundo_llamado),
    monto_estimado: num(p.presupuesto?.monto_disponible_clp ?? p.presupuesto?.monto_disponible ?? p.presupuesto?.presupuesto_estimado),
    moneda: texto(p.presupuesto?.moneda) ?? 'CLP',
    nombre_organismo: texto(p.institucion?.organismo_comprador),
    organismo_rut: texto(p.institucion?.rut),
    region: texto(p.institucion?.nombre_region),
    tipo_proceso: 'compra_agil',
    url_ficha: `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${p.codigo}`,
    descripcion: texto(p.descripcion),
    plazo_entrega: plazo!=null ? String(plazo) : null,
    direccion_entrega: texto(p.entrega?.direccion_entrega),
    tipo_presupuesto: texto(p.presupuesto?.tipo_presupuesto),
    unidad_compra: texto(p.institucion?.unidad_compra),
    ofertas_recibidas: entero(p.resumen?.total_ofertas_recibidas),
    documentos: Array.isArray(p.documentos) ? p.documentos.map((d:any)=>({ id: d.id ?? null, nombre: d.nombre ?? null })) : [],
    detalle_scrapeado: true,
    detalle_actualizado_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    datos_json: { origen: 'sondeo', detalle },
  };
  return cab;
}
function itemsDesdeDetalle(p:any, compraId:number){
  const prods = Array.isArray(p.productos_solicitados) ? p.productos_solicitados : [];
  return prods.map((it:any)=>({
    compra_agil_id: compraId, categoria: it.categoria ?? null,
    codigo_producto: it.codigo_producto!=null ? String(it.codigo_producto) : null,
    nombre_producto: it.nombre ?? null, descripcion_producto: it.descripcion ?? null,
    cantidad: num(it.cantidad), unidad: it.unidad_medida ?? it.unidad ?? null,
  }));
}

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  const json = (o:any, status=200)=>new Response(JSON.stringify(o),{status,headers:{...cors,'Content-Type':'application/json'}});
  if(!ticket) return json({error:'API key no configurada'},500);

  let forzar = false; let limiteUnidades = 150; let codigos:string[] = [];
  try{ const b = await req.json(); if(b){ forzar = !!b.forzar; if(b.limite_unidades) limiteUnidades = Math.min(Number(b.limite_unidades)||150, 400); if(Array.isArray(b.codigos)) codigos = b.codigos.map(String); } }catch(_){}

  const t0 = Date.now();
  const res:any = { omitido:false, unidades:0, probados:0, nuevas:0, items:0, codigos_nuevos:[] as string[], errores:[] as string[], ms:0 };

  // ¿El listado está sano? Si trajo filas hace menos de 20 min, no hace falta sondear.
  // ¿Hay otra corrida encima? Dos sondeos a la vez gatillan el 429 de la API.
  if(!forzar && codigos.length===0){
    const { data: sts } = await sb.from('ingesta_ca_estado').select('clave, ultimo_exito, insertadas_ultima, ultima_corrida').in('clave',['compra_agil','sondeo']);
    const st = (sts||[]).find((s:any)=>s.clave==='compra_agil'); const so = (sts||[]).find((s:any)=>s.clave==='sondeo');
    const hace = st?.ultimo_exito ? Date.now() - new Date(st.ultimo_exito).getTime() : Infinity;
    if(hace < 20*60000 && (st?.insertadas_ultima ?? 0) > 0){ res.omitido = true; res.motivo = 'listado sano'; res.ms = Date.now()-t0; return json(res); }
    const corriendo = so?.ultima_corrida ? Date.now() - new Date(so.ultima_corrida).getTime() : Infinity;
    if(corriendo < 3*60000){ res.omitido = true; res.motivo = 'sondeo en curso'; res.ms = Date.now()-t0; return json(res); }
  }
  await sb.from('ingesta_ca_estado').upsert({ clave:'sondeo', ultima_corrida: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict:'clave' });

  const fetchDetalle = async (codigo:string)=>{
    const url = `https://api2.mercadopublico.cl/v2/compra-agil/${encodeURIComponent(codigo)}`;
    const opts = { headers:{ 'ticket': ticket, 'Accept':'application/json' }, signal: AbortSignal.timeout(45000) };
    let resp = await fetch(url, opts);
    if(resp.status===429 || resp.status>=500){ await sleep(resp.status===429 ? 5000 : 2500); resp = await fetch(url, opts); }
    if(resp.status===404 || resp.status===400) return null;
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const p = data?.payload ?? data;
    if(!p || typeof p!=='object' || !p.codigo) return null; // {"success":"ERROR"} o vacío: no existe
    return p;
  };
  const guardar = async (p:any)=>{
    const cab = cabeceraDesdeDetalle(p);
    const { data: fila, error } = await sb.from('compras_agiles').upsert(cab, { onConflict:'codigo' }).select('id').single();
    if(error || !fila){ res.errores.push(`upsert ${p.codigo}: ${error?.message}`); return; }
    const its = itemsDesdeDetalle(p, fila.id);
    if(its.length){
      await sb.from('compras_agiles_items').delete().eq('compra_agil_id', fila.id);
      const { error: e2 } = await sb.from('compras_agiles_items').insert(its);
      if(e2) res.errores.push(`items ${p.codigo}: ${e2.message}`); else res.items += its.length;
    }
    res.nuevas++; res.codigos_nuevos.push(p.codigo);
  };

  // Modo manual: códigos puntuales (para probar o rescatar una compra que el usuario vio en el buscador).
  if(codigos.length){
    for(const c of codigos.slice(0,30)){
      try{ res.probados++; const p = await fetchDetalle(c); if(p) await guardar(p); else res.errores.push(`no existe ${c}`); }
      catch(e){ res.errores.push(`${c}: ${e instanceof Error?e.message:String(e)}`); }
    }
    res.ms = Date.now()-t0; return json(res);
  }

  // Unidades con actividad reciente, en rondas: el cursor avanza para cubrirlas todas.
  const { data: st2 } = await sb.from('ingesta_ca_estado').select('pagina_actual').eq('clave','sondeo').maybeSingle();
  const offset = st2?.pagina_actual ?? 0;
  const { data: unidades, error: uErr } = await sb.rpc('compras_agiles_unidades_activas', { p_limit: limiteUnidades, p_offset: offset });
  if(uErr) return json({ error: uErr.message }, 500);
  const lista:any[] = unidades || [];

  const sondear = async (u:any)=>{
    res.unidades++;
    let seq = Number(u.ultimo_seq); let huecos = 0; let nuevas = 0;
    while(huecos <= SALTO_MAX && nuevas < NUEVAS_MAX_POR_UNIDAD && Date.now()-t0 < PRESUPUESTO_MS){
      seq++; const codigo = `${u.prefijo}-${seq}-${u.sufijo}`;
      try{
        res.probados++;
        const p = await fetchDetalle(codigo);
        if(p){ await guardar(p); nuevas++; huecos = 0; }
        else huecos++;
      }catch(e){ res.errores.push(`${codigo}: ${e instanceof Error?e.message:String(e)}`); break; }
    }
  };
  let i = 0;
  for(; i<lista.length && Date.now()-t0 < PRESUPUESTO_MS; i+=PARALELO){
    await Promise.all(lista.slice(i, i+PARALELO).map(sondear));
    await sleep(100);
  }
  // Cursor: si la lista vino corta se acabaron las unidades y la próxima ronda parte de cero;
  // si no, sigue desde la última unidad recorrida.
  const siguiente = lista.length < limiteUnidades ? 0 : offset + Math.min(i, lista.length);
  await sb.from('ingesta_ca_estado').upsert({ clave:'sondeo', pagina_actual: siguiente, ultima_corrida: new Date().toISOString(), ultimo_exito: res.errores.length? undefined : new Date().toISOString(), insertadas_ultima: res.nuevas, ultimo_error: res.errores.length ? res.errores.slice(0,5).join(' | ').slice(0,500) : null, updated_at: new Date().toISOString() }, { onConflict:'clave' });
  res.siguiente_offset = siguiente; res.ms = Date.now()-t0;
  return json(res);
});
