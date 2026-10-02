// Directorio público FirmaVB: ¿quién le vende esto al Estado? (solo lectura, datos públicos de OC)
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
const H = { 'Access-Control-Allow-Origin': '*' };

const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>¿Quién le vende esto al Estado? | Directorio FirmaVB</title>
<meta name="description" content="Busca un producto y descubre qué proveedores se lo venden al Estado de Chile, a qué precio y a cuántos organismos. Datos reales de órdenes de compra de Mercado Público.">
<style>
:root{--b:#0b3d91;--b2:#1459d9;--bg:#f4f7fc;--tx:#14213d;--mu:#5b6b85;--ok:#0f8a5f;--card:#fff;--ln:#dfe6f2}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--tx)}
header{background:linear-gradient(135deg,var(--b),var(--b2));color:#fff;padding:32px 16px 44px}
.w{max-width:960px;margin:0 auto}h1{font-size:clamp(24px,5vw,36px);margin:0 0 8px}header p{margin:0;opacity:.9;max-width:640px}
form{display:flex;gap:8px;margin-top:20px;flex-wrap:wrap}input{flex:1;min-width:200px;padding:14px 16px;border-radius:10px;border:0;font-size:16px}
button{padding:14px 20px;border:0;border-radius:10px;background:#ffb703;color:#14213d;font-weight:700;font-size:16px;cursor:pointer}
.chips{margin-top:12px;display:flex;gap:6px;flex-wrap:wrap}.chips a{color:#fff;background:rgba(255,255,255,.15);padding:6px 10px;border-radius:99px;font-size:13px;text-decoration:none}
main{padding:20px 16px 60px}.st{color:var(--mu);margin:0 0 14px;font-size:14px}
.c{background:var(--card);border:1px solid var(--ln);border-radius:14px;padding:16px;margin-bottom:12px}
.top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start}.n{font-weight:700;font-size:17px}.r{color:var(--mu);font-size:13px}
.bd{display:inline-block;background:#e6f6ef;color:var(--ok);font-size:12px;font-weight:700;padding:3px 8px;border-radius:99px;margin-left:6px}
.k{display:flex;gap:16px;flex-wrap:wrap;margin:10px 0;font-size:14px}.k b{font-size:16px}
ul{margin:6px 0 0;padding-left:18px;font-size:14px;color:#33415c}li{margin:3px 0}
.a{display:inline-block;margin-top:10px;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px}
.a1{background:var(--b2);color:#fff}.a2{background:#eef3fb;color:var(--b)}
.cta{background:#14213d;color:#fff;border-radius:14px;padding:20px;margin-top:24px}.cta a{color:#ffb703;font-weight:700}
footer{text-align:center;color:var(--mu);font-size:12px;padding:20px}
</style></head><body>
<header><div class="w"><h1>¿Quién le vende esto al Estado?</h1>
<p>Busca un producto y mira qué empresas se lo venden a organismos públicos, a qué precio y con qué frecuencia. Datos reales de órdenes de compra de los últimos 24 meses.</p>
<form id="f"><input id="q" placeholder="Ej: resma papel carta, guantes nitrilo, notebook" autocomplete="off" aria-label="Producto"><button>Buscar</button></form>
<div class="chips"><a href="?q=resma papel carta">Resma papel</a><a href="?q=guantes nitrilo">Guantes nitrilo</a><a href="?q=notebook">Notebook</a><a href="?q=cemento">Cemento</a><a href="?q=toner">Tóner</a><a href="?q=alcohol gel">Alcohol gel</a></div>
</div></header>
<main class="w"><p class="st" id="st">Escribe un producto para empezar.</p><div id="res"></div>
<div class="cta"><b>¿Te salió un negocio y no tienes el producto?</b><br>En FirmaVB puedes pedirle cotización a otro proveedor en un clic, llevar tu carpeta de documentos al día y cobrar tus facturas al Estado con intereses. <a href="https://firmavb.cl">Crea tu cuenta gratis →</a></div></main>
<footer>Fuente: órdenes de compra públicas de Mercado Público · FirmaVB · Surfeando Licitaciones</footer>
<script>
const $=s=>document.querySelector(s),fmt=n=>n==null?'—':'$'+Math.round(n).toLocaleString('es-CL'),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function buscar(q){q=q.trim();if(q.length<3){$('#st').textContent='Escribe al menos 3 letras.';return}
$('#st').textContent='Buscando…';$('#res').innerHTML='';history.replaceState(null,'','?q='+encodeURIComponent(q));
try{const r=await fetch(location.pathname+'?format=json&q='+encodeURIComponent(q));const d=await r.json();if(d.error)throw new Error(d.error);
$('#st').textContent=d.length?d.length+' proveedores venden algo parecido a "'+q+'" al Estado':'No encontramos ventas de "'+q+'". Prueba con otra palabra.';
$('#res').innerHTML=d.map(p=>'<div class="c"><div class="top"><div><span class="n">'+esc(p.proveedor)+'</span>'+(p.es_firmavb?'<span class="bd">✓ En FirmaVB</span>':'')+'<div class="r">RUT '+esc(p.rut)+(p.ultima_venta?' · última venta '+new Date(p.ultima_venta).toLocaleDateString('es-CL'):'')+'</div></div></div>'+
'<div class="k"><span><b>'+p.n_oc+'</b> órdenes de compra</span><span><b>'+p.n_organismos+'</b> organismos</span><span>Precio mediano <b>'+fmt(p.precio_mediana)+'</b></span></div>'+
'<ul>'+(p.productos||[]).slice(0,4).map(x=>'<li>'+esc(x.producto)+(x.precio_mediana?' — '+fmt(x.precio_mediana):x.precio?' — '+fmt(x.precio):'')+(x.catalogo?' <b>(catálogo)</b>':'')+'</li>').join('')+'</ul>'+
(p.es_firmavb?'<a class="a a1" href="https://firmavb.cl/marketplace?rut='+encodeURIComponent(p.rut)+'&producto='+encodeURIComponent(q)+'">Pedir cotización</a>':'<a class="a a2" href="https://firmavb.cl/marketplace?invitar='+encodeURIComponent(p.rut)+'&producto='+encodeURIComponent(q)+'">Pedir cotización (lo invitamos a FirmaVB)</a>')+'</div>').join('')}
catch(e){$('#st').textContent='Error: '+e.message}}
$('#f').onsubmit=e=>{e.preventDefault();buscar($('#q').value)};
const q0=new URLSearchParams(location.search).get('q');if(q0){$('#q').value=q0;buscar(q0)}
</script></body></html>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...H, 'Access-Control-Allow-Headers': '*' } });
  const u = new URL(req.url);
  if (u.searchParams.get('format') === 'json') {
    const q = (u.searchParams.get('q') ?? '').slice(0, 80);
    const { data, error } = await sb.rpc('mk_buscar', { p_q: q, p_limit: 30 });
    if (error) return new Response(JSON.stringify({ error: 'No se pudo buscar' }), { status: 500, headers: { ...H, 'Content-Type': 'application/json' } });
    const out = (data ?? []).map((p: any) => ({ ...p, cliente_id: undefined }));
    return new Response(JSON.stringify(out), { headers: { ...H, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  return new Response(HTML, { headers: { ...H, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
});
