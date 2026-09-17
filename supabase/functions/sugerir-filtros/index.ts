// Sugiere filtros de oportunidades (palabras a incluir/excluir) a partir del
// inventario del cliente, usando IA (Gemini) con fallback heurístico. NO guarda.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
function json(b: unknown, s=200){ return new Response(JSON.stringify(b), { status:s, headers:{ ...cors,'Content-Type':'application/json' } }); }
const norm = (s:string)=> s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
const STOP = new Set(['de','para','con','sin','por','set','und','unid','pza','pzas','uni','cm','mm','mts','grs','gr','kg','ml','lt','hjs','hj','color','colores','surtido','surtidos','surt','ref','the','and','x','el','la','los','las','un','una','chico','grande','mediano','doble','simple','verde','azul','rojo','amarillo','negro','blanco','celeste','rosado','naranjo','morado','cafe','gris','dorado','plateado','fluor','claro','oscuro','metalico','transparente']);

function heuristico(nombres: string[]): { incluir: string[]; excluir: string[] } {
  const freq: Record<string, number> = {};
  for (const n of nombres) {
    for (const raw of norm(n||'').split(/[^a-z0-9]+/)) {
      if (raw.length < 4 || STOP.has(raw)) continue;
      if (/[0-9]/.test(raw)) continue;
      freq[raw] = (freq[raw]||0) + 1;
    }
  }
  const incluir = Object.entries(freq).filter(([,c])=>c>=8).sort((a,b)=>b[1]-a[1]).slice(0,18).map(([w])=>w);
  return { incluir, excluir: ['mantencion','servicio','arriendo','capacitacion','consultoria','obra','construccion'] };
}

async function callGemini(key: string, model: string, prompt: string): Promise<{ ok: boolean; txt?: string; err?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  let r: Response;
  try {
    r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ temperature:0.2, responseMimeType:'application/json' } }) });
  } catch (e) { return { ok:false, err:'fetch_throw:'+(e instanceof Error?e.message:String(e)) }; }
  if (!r.ok) { const t = await r.text().catch(()=> ''); return { ok:false, err:'http_'+r.status+':'+t.slice(0,200) }; }
  const data = await r.json();
  const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { ok:true, txt };
}

async function conIA(key: string, nombres: string[]): Promise<{ incluir: string[]; excluir: string[]; err?: string; model?: string }> {
  const muestra = Array.from(new Set(nombres)).slice(0, 120);
  const prompt = `Eres experto en compras públicas de Chile. A partir de esta lista de productos que vende un proveedor, sugiere en JSON:\n- "palabras_incluir": 10-18 palabras clave GENÉRICAS de rubro (minúsculas, sin tildes, singular; ej: papeleria, toner, aseo, alimentos, ferreteria). NADA de marcas, colores, medidas ni códigos.\n- "palabras_excluir": 5-8 palabras que marquen lo que un proveedor de PRODUCTOS no debe trabajar (ej: servicio, mantencion, arriendo, obra, capacitacion).\nResponde SOLO el JSON.\n\nProductos:\n${muestra.join('\n')}`;
  const envModel = Deno.env.get('GEMINI_MODEL');
  const candidates = Array.from(new Set([envModel, 'gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-flash-latest'].filter(Boolean))) as string[];
  let lastErr = 'no_models';
  for (const model of candidates) {
    const res = await callGemini(key, model, prompt);
    if (!res.ok) { lastErr = (model)+' '+(res.err||''); continue; }
    let parsed:any; try { parsed = JSON.parse(res.txt||''); } catch { lastErr = model+' parse_fail:'+(res.txt||'').slice(0,120); continue; }
    const clean = (a:any)=> Array.isArray(a) ? Array.from(new Set(a.map((s:any)=>norm(String(s))).filter((s:string)=>s.length>2 && !/[0-9]/.test(s)))).slice(0,20) : [];
    const incluir = clean(parsed.palabras_incluir); const excluir = clean(parsed.palabras_excluir);
    if (!incluir.length) { lastErr = model+' empty_incluir'; continue; }
    return { incluir, excluir, model };
  }
  return { incluir:[], excluir:[], err:lastErr };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    const debug = url.searchParams.get('debug') === '1';
    const { cliente_id } = await req.json().catch(()=>({}));
    if (!cliente_id) return json({ error: 'falta cliente_id' }, 400);
    const { data: inv } = await supabase.from('cliente_inventario')
      .select('nombre_producto').eq('cliente_id', cliente_id).limit(1500);
    const nombres = (inv||[]).map((r:any)=>r.nombre_producto).filter(Boolean);
    if (nombres.length === 0) return json({ palabras_incluir: [], palabras_excluir: [], fuente:'sin_inventario' });
    const base = heuristico(nombres);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (key) {
      const ia = await conIA(key, nombres);
      if (ia.incluir.length) return json({ palabras_incluir: ia.incluir, palabras_excluir: ia.excluir.length?ia.excluir:base.excluir, fuente:'ia', ...(debug?{model:ia.model}:{}) });
      if (debug) return json({ palabras_incluir: base.incluir, palabras_excluir: base.excluir, fuente:'heuristico', ia_err: ia.err, key_present:true });
    }
    return json({ palabras_incluir: base.incluir, palabras_excluir: base.excluir, fuente:'heuristico', ...(debug?{key_present:!!key}:{}) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
