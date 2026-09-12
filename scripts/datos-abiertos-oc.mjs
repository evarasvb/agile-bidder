// Datos Abiertos ChileCompra — órdenes de compra (piloto de carga).
// Lee el/los CSV descomprimidos en ./ocdata. El archivo es a nivel de LÍNEA de
// producto (varias filas por OC), viene separado por ';' y en Latin-1, y trae
// saltos de línea DENTRO de campos entre comillas → se parsea con un lector de
// registros con estado (no por línea).
//
// MODO=probe → mide (sin insertar). MODO=load → deduplica a CABECERA por OC,
// (opcional) filtra por rubros de firmavb, y hace upsert por lotes en Supabase.
import { readdirSync, statSync, createReadStream } from 'node:fs';

const MODO = process.env.MODO || 'probe';
const DIR = process.env.OCDIR || 'ocdata';
const FILTRAR = (process.env.FILTRAR || 'si').toLowerCase() === 'si';
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

// Rubros que venden los clientes de firmavb (mismo criterio que la app). Si una
// OC tiene AL MENOS un ítem que calza, se guarda.
const KW = ['papel','resma','toner','tinta','oficina','utiles','archivador','lapiz','cuaderno',
  'computad','notebook','impresora','software','licencia','tecnolog','servidor','monitor','teclado','mouse','tablet',
  'aseo','limpieza','detergente','cloro','higienico','sanitario','jabon','toalla',
  'mobiliario','mueble','silla','escritorio','estante','repisa',
  'construccion','ferreteria','cemento','herramienta','pintura','tornillo','madera',
  'vehiculo','automotriz','repuesto','neumatico','lubricante','bateria',
  'vestuario','textil','uniforme','calzado','ropa',
  'alimento','abarrote','fruta','verdura','carne','bebida',
  'medico','clinico','hospital','mascarilla','guante','jeringa','insumo','farmac','quirurgic',
  'servicio','mantencion','reparacion'];

function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function formatearRUT(rut){ const c=String(rut||'').replace(/[^0-9kK]/g,'').toUpperCase(); if(c.length<2) return c||null; const b=c.slice(0,-1),d=c.slice(-1); return `${b.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}-${d}`; }
function toIso(s){ if(!s) return null; s=String(s).trim(); if(!s) return null;
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`;
  m=s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/); if(m) return `${m[3]}-${m[2]}-${m[1]}T12:00:00.000Z`;
  const d=new Date(s); return isNaN(d.getTime())?null:d.toISOString(); }
function numCL(v){ if(v==null||v==='') return null; const s=String(v).replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,''); const n=Number(s); return isNaN(n)?null:n; }

// Lector de registros CSV con estado (maneja comillas y saltos de línea internos).
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
for (const name of readdirSync(DIR)) { const p=`${DIR}/${name}`; if(/\.csv$/i.test(name)) csvs.push(p); }

async function upsert(rows){
  const r = await fetch(`${SUPABASE_URL}/rest/v1/ordenes_compra?on_conflict=codigo`, {
    method:'POST',
    headers:{ apikey:KEY, Authorization:`Bearer ${KEY}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if(!r.ok){ throw new Error(`upsert ${r.status}: ${(await r.text()).slice(0,300)}`); }
}

for (const path of csvs){
  console.log(`\n=== ${path} (${(statSync(path).size/1e6).toFixed(1)} MB) MODO=${MODO} filtrar=${FILTRAR} ===`);
  let idx=null; let lineas=0;
  const ocs=new Map();            // codigo -> fila cabecera
  const matched=new Set();        // codigos que calzan con rubro
  let distintas=0;

  for await (const rec of records(path)){
    if(!idx){ idx={}; rec.forEach((c,i)=>{ idx[c.trim()]=i; }); continue; }
    lineas++;
    const g=(name)=>{ const i=idx[name]; return i==null?'':rec[i]; };
    const codigo=(g('Codigo')||'').trim();
    if(!codigo) continue;

    if(FILTRAR && !matched.has(codigo)){
      const txt=norm([g('RubroN1'),g('RubroN2'),g('RubroN3'),g('Categoria'),g('NombreroductoGenerico'),g('Nombre'),g('EspecificacionComprador')].join(' '));
      if(KW.some(k=>txt.includes(k))) matched.add(codigo);
    }

    if(!ocs.has(codigo)){
      distintas++;
      ocs.set(codigo, {
        codigo, numero_oc: codigo,
        nombre: g('Nombre')||null,
        estado: (g('codigoEstado')||g('Estado')||'').trim()||null,
        organismo_comprador: g('OrganismoPublico')||null,
        demandante: g('UnidadCompra')||g('OrganismoPublico')||null,
        rut_demandante: formatearRUT(g('RutUnidadCompra')),
        unidad_compra: g('UnidadCompra')||null,
        proveedor_nombre: g('NombreProveedor')||g('Sucursal')||null,
        proveedor: g('NombreProveedor')||g('Sucursal')||null,
        rut_proveedor: formatearRUT(g('RutSucursal')),
        neto: numCL(g('TotalNetoOC')),
        total: numCL(g('MontoTotalOC_PesosChilenos'))??numCL(g('MontoTotalOC')),
        monto_total: numCL(g('MontoTotalOC_PesosChilenos'))??numCL(g('MontoTotalOC')),
        moneda: (g('TipoMonedaOC')||'CLP').trim()||'CLP',
        fecha_emision: toIso(g('FechaCreacion'))||toIso(g('FechaEnvio')),
        fecha_envio_oc: toIso(g('FechaEnvio')),
        numero_licitacion: g('CodigoLicitacion')||null,
        relevante: true,
        last_scraped_at: new Date().toISOString(),
        stale: false,
      });
    }
  }

  const keep = FILTRAR ? [...ocs.values()].filter(o=>matched.has(o.codigo)) : [...ocs.values()];
  console.log(`líneas: ${lineas} · OC distintas: ${distintas} · calzan rubro: ${matched.size} · a cargar: ${keep.length}`);

  if(MODO==='load'){
    if(!SUPABASE_URL||!KEY){ console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
    let ok=0, err=0;
    for(let i=0;i<keep.length;i+=1000){
      const lote=keep.slice(i,i+1000);
      try{ await upsert(lote); ok+=lote.length; }catch(e){ err+=lote.length; console.error(String(e).slice(0,200)); }
      if(i%20000===0) console.log(`  cargadas ${ok}/${keep.length}…`);
    }
    console.log(`LOAD listo: ${ok} cargadas, ${err} con error.`);
  }
}
