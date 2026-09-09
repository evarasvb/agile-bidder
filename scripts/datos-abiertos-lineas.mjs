// Datos Abiertos ChileCompra — LÍNEAS de órdenes de compra (detalle por producto).
// A diferencia de datos-abiertos-oc.mjs (que deduplica a CABECERA), aquí cargamos
// UNA fila por línea de producto, en una tabla compacta `oc_lineas`, para poder
// analizar el cubo "por producto" de verdad.
//
// MODO=probe  → NO inserta. Vuelca los nombres de columnas reales y una muestra
//               de cómo quedan mapeadas las líneas (para confirmar el mapeo).
// MODO=load   → upsert por lotes en oc_lineas (clave natural codigo+correlativo).
import { readdirSync, statSync, createReadStream } from 'node:fs';

const MODO = process.env.MODO || 'probe';
const DIR = process.env.OCDIR || 'ocdata';
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

function formatearRUT(rut){ const c=String(rut||'').replace(/[^0-9kK]/g,'').toUpperCase(); if(c.length<2) return c||null; const b=c.slice(0,-1),d=c.slice(-1); return `${b.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}-${d}`; }
function toIso(s){ if(!s) return null; s=String(s).trim(); if(!s) return null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
  m=s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/); if(m) return `${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`;
  const d=new Date(s); return isNaN(d.getTime())?null:d.toISOString(); }
function numCL(v){ if(v==null||v==='') return null; const s=String(v).replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); const n=Number(s); return isNaN(n)?null:n; }

// Lector de registros CSV con estado (comillas y saltos de línea internos). Latin-1.
async function* records(path){
  const stream = createReadStream(path, { encoding:'latin1', highWaterMark: 1<<20 });
  let field=''; let rec=[]; let q=false; let pend=false;
  for await (const chunk of stream){
    for (let i=0;i<chunk.length;i++){
      const c=chunk[i];
      if(pend){ pend=false; if(c==='"'){ field+='"'; continue; } else { q=false; } }
      if(q){ if(c==='"'){ pend=true; } else { field+=c; } continue; }
      if(c==='"'){ q=true; }
      else if(c===';'){ rec.push(field); field=''; }
      else if(c==='\n'){ rec.push(field); field=''; yield rec; rec=[]; }
      else if(c==='\r'){ /* skip */ }
      else field+=c;
    }
  }
  if(field.length||rec.length){ rec.push(field); yield rec; }
}

const csvs = [];
for (const name of readdirSync(DIR)) { if(/\.csv$/i.test(name)) csvs.push(`${DIR}/${name}`); }

async function upsert(rows){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/oc_lineas?on_conflict=linea_id`, {
    method:'POST',
    headers:{ apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if(!r.ok){ throw new Error(`upsert ${r.status}: ${(await r.text()).slice(0,300)}`); }
}

for (const path of csvs){
  console.log(`\n=== ${path} (${(statSync(path).size/1e6).toFixed(1)} MB) MODO=${MODO} ===`);
  let idx=null; let lineas=0; const ocs=new Set();
  let lote=[]; let ok=0, err=0, muestras=0;

  // fallback de nombres (ChileCompra tiene typos históricos en headers).
  const P=(rec)=>(names)=>{ for(const n of names){ const i=idx[n]; if(i!=null && rec[i]!=null && String(rec[i]).trim()!=='') return rec[i]; } return ''; };

  for await (const rec of records(path)){
    if(!idx){ idx={}; rec.forEach((c,i)=>{ idx[c.trim()]=i; });
      if(MODO==='probe'){ console.log(`COLUMNAS (${Object.keys(idx).length}):`); console.log(Object.keys(idx).join(' | ')); }
      continue;
    }
    lineas++;
    const g=P(rec);
    const codigo=(g(['Codigo'])||'').trim();
    if(!codigo) continue;
    ocs.add(codigo);

    const correlativo=(g(['Correlativo','CorrelativoLinea','NumeroLinea','Linea','Item'])||String(lineas)).toString().trim();
    const row={
      linea_id: `${codigo}#${correlativo}`,
      codigo,
      correlativo: numCL(correlativo),
      producto: g(['NombreProducto','Producto','NombreroductoGenerico','NombreProductoGenerico','EspecificacionComprador','Nombre'])||null,
      categoria: g(['Categoria','RubroN3','RubroN2','RubroN1'])||null,
      rubro_n1: g(['RubroN1'])||null,
      cantidad: numCL(g(['Cantidad','CantidadOC','CantidadProducto'])),
      precio_neto: numCL(g(['PrecioNeto','PrecioUnitario','PrecioNetoOC'])),
      moneda: (g(['TipoMonedaOC','Moneda'])||'CLP').trim()||'CLP',
      monto_linea: numCL(g(['TotalLineaNeto','MontoLinea','ValorTotalLinea','TotalLinea','TotalCargos'])),
      rut_proveedor: formatearRUT(g(['RutSucursal','RutProveedor'])),
      proveedor_nombre: g(['NombreProveedor','Sucursal'])||null,
      organismo: g(['OrganismoPublico'])||null,
      rut_organismo: formatearRUT(g(['RutUnidadCompra','RutOrganismo'])),
      fecha: toIso(g(['FechaEnvio','FechaCreacion'])),
    };

    if(MODO==='probe'){
      if(muestras<3){ console.log('MUESTRA', JSON.stringify(row)); muestras++; }
      continue;
    }
    lote.push(row);
    if(lote.length>=1500){
      try{ await upsert(lote); ok+=lote.length; }catch(e){ err+=lote.length; console.error(String(e).slice(0,200)); }
      lote=[];
      if(ok%60000===0) console.log(`  cargadas ${ok} líneas…`);
    }
  }

  if(MODO==='load' && lote.length){ try{ await upsert(lote); ok+=lote.length; }catch(e){ err+=lote.length; console.error(String(e).slice(0,200)); } }
  console.log(`líneas: ${lineas} · OC distintas: ${ocs.size}` + (MODO==='load'?` · cargadas: ${ok} · con error: ${err}`:''));
}
