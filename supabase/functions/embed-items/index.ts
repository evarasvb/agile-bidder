import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Robot de embeddings para el match semántico. Vectoriza con Gemini
// (gemini-embedding-001, 768 dims, el mismo modelo del buscador global) lo que
// esté pendiente: inventario de los clientes, ítems de compras ágiles abiertas e
// ítems de licitaciones abiertas. Lo llama pg_cron (embed-items-cron) cada 3 min
// con service role; procesa lotes hasta agotar el presupuesto de tiempo.
//
// Costo: gemini-embedding-001 cobra por token de entrada; un ítem son ~15 tokens,
// así que 40.000 textos cuestan centavos de dólar.

const LOTE = 50;
const MODELOS = ['gemini-embedding-001', 'text-embedding-004'];

interface Pendiente { tabla: string; id: string; texto: string }

async function embeber(textos: string[], apiKey: string): Promise<number[][]> {
  let ultimoError = '';
  for (const model of MODELOS) {
    const body: Record<string, unknown> = { model, input: textos };
    if (model === 'gemini-embedding-001') body.dimensions = 768;
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) { ultimoError = `${resp.status} ${(await resp.text().catch(() => '')).slice(0, 300)}`; continue; }
    const j = await resp.json();
    const v: number[][] = (j.data || []).map((d: { embedding: number[] }) => d.embedding);
    if (v.length === textos.length) return v;
    ultimoError = 'respuesta incompleta';
  }
  throw new Error(`Gemini embeddings: ${ultimoError}`);
}

serve(async (req: Request) => {
  const inicio = Date.now();
  try {
    // Solo service_role (pg_cron con el JWT del vault, o el service key): el
    // gateway ya valida la firma, aquí se exige el rol para que un usuario
    // logueado no pueda disparar gasto de Gemini a voluntad.
    const auth = req.headers.get('Authorization') || '';
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let rol = '';
    try { rol = JSON.parse(atob((auth.replace(/^Bearer\s+/i, '').split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'))).role || ''; } catch { rol = ''; }
    if (rol !== 'service_role') {
      return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401 });
    }
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) return new Response(JSON.stringify({ error: 'Falta GEMINI_API_KEY' }), { status: 503 });

    const body = await req.json().catch(() => ({}));
    const presupuesto = Math.min(Number(body.presupuesto_ms) || 100_000, 140_000);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE);

    const totales: Record<string, number> = {};
    let lotes = 0;
    let quedan = true;
    while (Date.now() - inicio < presupuesto) {
      const { data, error } = await supabase.rpc('items_pendientes_embedding', { p_limite: LOTE });
      if (error) throw error;
      const pend = (data || []) as Pendiente[];
      if (!pend.length) { quedan = false; break; }
      // Un lote por tabla para que el update sea simple y no mezcle ids.
      const porTabla = new Map<string, Pendiente[]>();
      for (const p of pend) porTabla.set(p.tabla, [...(porTabla.get(p.tabla) || []), p]);
      const [tabla, filas] = [...porTabla.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      const lote = filas.slice(0, LOTE);
      const vectores = await embeber(lote.map((f) => (f.texto || '').trim() || 'sin descripcion'), GEMINI_API_KEY);
      let ok = 0;
      for (let i = 0; i < lote.length; i++) {
        const vec = vectores[i];
        if (!Array.isArray(vec) || !vec.length) continue;
        const { error: e2, count } = await supabase
          .from(tabla)
          .update({ embedding: `[${vec.join(',')}]` }, { count: 'exact' })
          .eq('id', lote[i].id)
          .is('embedding', null);
        if (!e2 && count) ok++;
      }
      totales[tabla] = (totales[tabla] || 0) + ok;
      lotes++;
      // Si ningún update pegó (p. ej. otro run los tomó), evitar loop infinito.
      if (ok === 0 && lote.length) break;
    }
    return new Response(JSON.stringify({ ok: true, lotes, totales, quedan, ms: Date.now() - inicio }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, ms: Date.now() - inicio }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
