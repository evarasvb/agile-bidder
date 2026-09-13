// Sonda v5: confirmar parametros de paginacion y tamano de pagina
const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' };
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
Deno.serve(async (req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  const ticket = Deno.env.get('MERCADOPUBLICO_API_KEY') || '';
  const B = 'https://api2.mercadopublico.cl/v2/compra-agil?ttl_cambio_ms=86400000';
  const pruebas = [
    `${B}&pagina=2`,
    `${B}&numero_pagina=2`,
    `${B}&page=2`,
    `${B}&tamano_pagina=100`,
    `${B}&pagina=2&tamano_pagina=50`
  ];
  const out:any[] = [];
  for(const url of pruebas){
    try{
      const resp = await fetch(url, { headers: { 'ticket': ticket, 'Accept':'application/json' } });
      const j = await resp.json();
      out.push({ url: url.replace(B,'[base]'), status: resp.status, paginacion: j?.payload?.paginacion || j?.errors || null, primer_codigo: j?.payload?.items?.[0]?.codigo || null });
    }catch(e){ out.push({ url, error: String(e) }); }
    await sleep(1000);
  }
  return new Response(JSON.stringify(out, null, 2),{headers:{...cors,'Content-Type':'application/json'}});
});
