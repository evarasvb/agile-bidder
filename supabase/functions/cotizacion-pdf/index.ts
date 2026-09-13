// Genera un PDF de cotización para una compra ágil, con datos de la empresa
// (proveedor), el producto matcheado y validez 15 días. Fallback genérico si
// faltan datos. Devuelve { filename, pdf_base64 }.
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const INDIGO = rgb(0.28,0.35,0.68); const ROSE = rgb(0.83,0.32,0.40);
const DARK = rgb(0.12,0.14,0.22); const GREY = rgb(0.42,0.46,0.55); const LINE = rgb(0.86,0.88,0.92);
const money = (n:number)=> '$' + Math.round(n||0).toLocaleString('es-CL');

Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
  let body:any={}; try{ body = await req.json(); }catch(_){}
  const clienteId = body.cliente_id; const codigo = body.codigo;
  if(!clienteId || !codigo) return new Response(JSON.stringify({error:'faltan cliente_id y codigo'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});

  // Datos empresa (proveedor)
  const { data: cli } = await sb.from('clientes').select('empresa_nombre,rut,email,telefono,nombre_responsable').eq('id',clienteId).maybeSingle();
  // Match + producto
  const { data: mt } = await sb.from('ca_matches').select('nombre_pedido,nombre_producto,precio_unitario,inventario_id,fecha_cierre').eq('cliente_id',clienteId).eq('compra_agil_codigo',codigo).maybeSingle();
  // Compra ágil (organismo comprador)
  const { data: ca } = await sb.from('compras_agiles').select('nombre,nombre_organismo,region').eq('codigo',codigo).maybeSingle();
  let desc:string|null=null, marca:string|null=null;
  if(mt?.inventario_id){ const { data: inv } = await sb.from('cliente_inventario').select('descripcion,marca').eq('id',mt.inventario_id).maybeSingle(); desc=inv?.descripcion||null; marca=inv?.marca||null; }

  const empresa = cli?.empresa_nombre || 'Proveedor';
  const rut = cli?.rut || '—';
  const email = cli?.email || '—';
  const tel = cli?.telefono || '—';
  const contacto = cli?.nombre_responsable || empresa;
  const producto = mt?.nombre_producto || (ca?.nombre) || 'Producto';
  const precio = Number(mt?.precio_unitario||0);
  const cantidad = 1; const subtotal = precio*cantidad; const iva = Math.round(subtotal*0.19); const total = subtotal+iva;
  const descripcion = desc || 'Producto conforme a lo solicitado. Especificaciones según requerimiento de la compra ágil.';

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595,842]); // A4
  const F = await pdf.embedFont(StandardFonts.Helvetica);
  const FB = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=595; let y=842;
  const text=(s:string,x:number,yy:number,size:number,font=F,color=DARK)=>page.drawText(String(s),{x,y:yy,size,font,color});

  // Encabezado de marca
  page.drawRectangle({x:0,y:792,width:W,height:50,color:INDIGO});
  text(empresa,40,812,17,FB,rgb(1,1,1));
  text('COTIZACIÓN',W-160,812,15,FB,rgb(1,1,1));
  page.drawRectangle({x:0,y:789,width:W,height:3,color:ROSE});

  // Datos proveedor / cotización
  y=760;
  text('RUT: '+rut,40,y,10,F,GREY); text('Contacto: '+contacto,40,y-14,10,F,GREY);
  text('Email: '+email+'   Tel: '+tel,40,y-28,10,F,GREY);
  const hoy=new Date(); const venc=new Date(hoy.getTime()+15*86400000);
  const fmt=(d:Date)=>String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();
  text('N° Cotización: '+codigo,W-230,y,10,FB); text('Fecha: '+fmt(hoy),W-230,y-14,10,F,GREY);
  text('Válida hasta: '+fmt(venc)+' (15 días)',W-230,y-28,10,F,ROSE);

  // Comprador
  y=700; page.drawRectangle({x:40,y:y-6,width:W-80,height:26,color:rgb(0.95,0.96,0.99)});
  text('Para: '+(ca?.nombre_organismo||'Organismo comprador'),48,y+2,10,FB,INDIGO);
  text((ca?.region||''),W-180,y+2,9,F,GREY);
  text('Ref. solicitud: '+(mt?.nombre_pedido||ca?.nombre||''),48,y-16,9,F,GREY);

  // Tabla producto
  y=650; page.drawRectangle({x:40,y:y-4,width:W-80,height:22,color:INDIGO});
  text('PRODUCTO',48,y+2,9,FB,rgb(1,1,1)); text('CANT.',330,y+2,9,FB,rgb(1,1,1));
  text('P. UNIT.',390,y+2,9,FB,rgb(1,1,1)); text('SUBTOTAL',470,y+2,9,FB,rgb(1,1,1));
  // Foto placeholder
  y=y-30; page.drawRectangle({x:48,y:y-44,width:60,height:60,borderColor:LINE,borderWidth:1,color:rgb(0.97,0.98,0.99)});
  text('sin',66,y-10,8,F,GREY); text('foto',64,y-22,8,F,GREY);
  text(producto.slice(0,40),118,y+2,10,FB);
  if(marca) text('Marca: '+marca,118,y-12,8,F,GREY);
  // descripción (wrap simple)
  const words=descripcion.split(' '); let line=''; let ly=y-26;
  for(const w of words){ if((line+w).length>52){ text(line,118,ly,8,F,GREY); ly-=11; line=''; } line+=w+' '; }
  if(line) text(line,118,ly,8,F,GREY);
  text(String(cantidad),338,y+2,10,F); text(money(precio),390,y+2,10,F); text(money(subtotal),470,y+2,10,FB);

  // Totales
  y=ly-30; page.drawLine({start:{x:360,y:y+14},end:{x:W-40,y:y+14},color:LINE,thickness:1});
  text('Neto',390,y,10,F,GREY); text(money(subtotal),470,y,10,F);
  text('IVA 19%',390,y-16,10,F,GREY); text(money(iva),470,y-16,10,F);
  page.drawRectangle({x:360,y:y-40,width:W-400,height:22,color:rgb(0.95,0.96,0.99)});
  text('TOTAL',390,y-34,11,FB,INDIGO); text(money(total),470,y-34,11,FB,INDIGO);

  // Nota validez + pie
  y=y-90;
  text('Condiciones: Precios en pesos chilenos, IVA incluido en el total. Esta cotización tiene una',40,y,9,F,GREY);
  text('validez de 15 días corridos desde su emisión. Producto conforme a lo requerido en la compra ágil.',40,y-12,9,F,GREY);
  page.drawRectangle({x:0,y:0,width:W,height:34,color:INDIGO});
  text(empresa+'  ·  '+email+'  ·  Generado por FirmaVB',40,13,9,F,rgb(1,1,1));

  const bytes = await pdf.save();
  let bin=''; const arr=new Uint8Array(bytes); for(let i=0;i<arr.length;i++) bin+=String.fromCharCode(arr[i]);
  const b64 = btoa(bin);
  return new Response(JSON.stringify({ filename:'cotizacion_'+codigo+'.pdf', pdf_base64:b64 }),{headers:{...cors,'Content-Type':'application/json'}});
});
