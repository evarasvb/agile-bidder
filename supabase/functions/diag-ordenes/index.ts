const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
function dd(d:Date){return String(d.getDate()).padStart(2,'0')+String(d.getMonth()+1).padStart(2,'0')+d.getFullYear();}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 const t=Deno.env.get('MERCADOPUBLICO_API_KEY')||'';
 const d=new Date();d.setDate(d.getDate()-1);const f=dd(d);
 const started=Date.now();
 try{
  const r=await fetch(`https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?fecha=${f}&ticket=${t}`);
  const j=await r.json();const L=j.Listado||j.listado;
  return new Response(JSON.stringify({fecha:f,ms:Date.now()-started,status:r.status,cantidad:j.Cantidad??(Array.isArray(L)?L.length:null),claves_item:Array.isArray(L)&&L[0]?Object.keys(L[0]):null,primer:Array.isArray(L)?L[0]:JSON.stringify(j).slice(0,200)},null,2),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({fecha:f,ms:Date.now()-started,error:String(e)}),{headers:{...cors,'Content-Type':'application/json'}});}
});
