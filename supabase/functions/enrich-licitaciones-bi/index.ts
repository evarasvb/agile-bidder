// Enriquecedor de licitaciones_bi v3: baja el DETALLE por código desde Mercado
// Público y (1) completa institución/presupuesto/fechas y (2) GUARDA los ítems en
// licitaciones_bi_items (habilita el match por ítem). Prioriza las licitaciones
// activas que aún no tienen ítems (rpc licitaciones_pendientes_items).
// Rate-limit friendly: ~1200ms entre llamadas + 1 reintento ante 429.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const MP = 'https://api.mercadopublico.cl/servicios/v1/publico';
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
function pick(...vals:any[]){ for(const v of vals){ if(v!==undefined && v!==null && v!=='') return v; } return null; }
function toIso(s:any){ if(!s) return null; const d=new Date(s); return isNaN(d.getTime())?null:d.toISOString(); }
function itemsOf(d:any){ const it=d?.Items; if(!it) return []; if(Array.isArray(it)) return it; if(Array.isArray(it.Listado)) return it.Listado; return []; }

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const supabase = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY');
  if(!ticket) return new Response(JSON.stringify({error:'API key no configurada'}),{status:500,headers:{...cors,'Content-Type':'application/json'}});

  let limit = 40;
  try { const b = await req.json(); if(b && b.limit) limit = Math.min(Number(b.limit)||40, 60); } catch(_){}

  // Prioriza licitaciones activas SIN ítems (rpc). Fallback: por presupuesto null.
  let rows:any[] = [];
  const { data: pend, error: rpcErr } = await supabase.rpc('licitaciones_pendientes_items', { p_limit: limit });
  if(rpcErr){
    const { data: rows2 } = await supabase.from('licitaciones_bi').select('id, codigo')
      .is('presupuesto_estimado', null).gte('fecha_cierre', new Date().toISOString())
      .order('created_at',{ascending:false}).limit(limit);
    rows = rows2 || [];
  } else { rows = pend || []; }

  const res:any = { intentadas: rows.length, actualizadas:0, con_items:0, items_insertados:0, sin_detalle:0, errores:[] as string[] };
  for(const r of rows){
    try{
      const url = `${MP}/licitaciones.json?codigo=${encodeURIComponent(r.codigo)}&ticket=${ticket}`;
      let resp = await fetch(url);
      if(resp.status===429){ await sleep(5000); resp = await fetch(url); }
      if(resp.status===429){ res.errores.push(`429 ${r.codigo}`); await sleep(1500); continue; }
      if(!resp.ok){ res.errores.push(`HTTP ${resp.status} ${r.codigo}`); continue; }
      const data = await resp.json();
      if(data.Codigo===203){ res.errores.push('ticket invalido'); break; }
      const d = (data.Listado && data.Listado[0]) || null;
      if(!d){ res.sin_detalle++; continue; }
      const comp = d.Comprador||{}; const fechas = d.Fechas||{};
      const upd:any = {
        nombre: pick(d.Nombre), descripcion: pick(d.Descripcion), estado: pick(d.Estado),
        institucion_nombre: pick(d.NombreOrganismo, comp.NombreOrganismo),
        institucion_rut: pick(d.RutUnidadCompra, comp.RutUnidadCompra, comp.RutUnidad),
        institucion_codigo: pick(d.CodigoOrganismo, comp.CodigoOrganismo),
        unidad_compra: pick(comp.NombreUnidad, d.NombreOrganismo, comp.NombreOrganismo),
        unidad_compra_region: pick(d.RegionUnidadCompra, comp.RegionUnidad),
        unidad_compra_comuna: pick(d.ComunaUnidadCompra, comp.ComunaUnidad),
        unidad_compra_direccion: pick(d.DireccionUnidadCompra, comp.DireccionUnidad),
        presupuesto_estimado: pick(d.MontoEstimado, d.Estimacion),
        moneda: pick(d.Moneda,'CLP'),
        fecha_publicacion: toIso(pick(d.FechaPublicacion, fechas.FechaPublicacion)),
        fecha_cierre: toIso(pick(d.FechaCierre, fechas.FechaCierre)),
        fecha_creacion: toIso(pick(d.FechaCreacion, fechas.FechaCreacion)),
        raw_data: d, updated_at: new Date().toISOString()
      };
      Object.keys(upd).forEach(k=>{ if(upd[k]===null || upd[k]===undefined) delete upd[k]; });
      const { error: updErr } = await supabase.from('licitaciones_bi').update(upd).eq('id', r.id);
      if(updErr){ res.errores.push(`upd ${r.codigo}: ${updErr.message}`); }
      else res.actualizadas++;

      // Guardar ítems (delete-then-insert) para habilitar el match por ítem.
      const items = itemsOf(d);
      if(items.length>0){
        await supabase.from('licitaciones_bi_items').delete().eq('licitacion_id', r.id);
        const toIns = items.map((it:any)=>({
          licitacion_id: r.id,
          correlativo: it.Correlativo ?? null,
          codigo_producto: it.CodigoProducto!=null ? String(it.CodigoProducto) : null,
          codigo_categoria: it.CodigoCategoria!=null ? String(it.CodigoCategoria) : null,
          categoria: it.Categoria ?? null,
          nombre_producto: it.NombreProducto ?? null,
          descripcion: it.Descripcion ?? null,
          cantidad: (it.Cantidad!=null && !isNaN(Number(it.Cantidad))) ? Number(it.Cantidad) : null,
          unidad: it.UnidadMedida ?? null,
        }));
        const { error: insErr } = await supabase.from('licitaciones_bi_items').insert(toIns);
        if(insErr){ res.errores.push(`items ${r.codigo}: ${insErr.message}`); }
        else { res.con_items++; res.items_insertados += toIns.length; }
      }
      await sleep(1200);
    }catch(e){ res.errores.push(`${r.codigo}: ${e instanceof Error? e.message:String(e)}`); }
  }
  return new Response(JSON.stringify(res),{headers:{...cors,'Content-Type':'application/json'},status:200});
});
