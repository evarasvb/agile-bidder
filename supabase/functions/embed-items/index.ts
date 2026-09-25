import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claveMistral, embeber, CuotaAgotada, ClaveInvalida, EMBED_MODELO } from "../_shared/embeddings.ts";

// Robot de vectores para el match semántico. Vectoriza lo pendiente (ítems de
// compras ágiles abiertas, inventario, ítems de licitaciones abiertas) con el
// proveedor de _shared/embeddings.ts. Lo llama pg_cron (embed-items-cron) con
// service role; procesa lotes hasta agotar el presupuesto de tiempo.

const LOTE = 100;
interface Pendiente { tabla: string; id: string; texto: string }

serve(async (req: Request) => {
  const inicio = Date.now();
  try {
    // Solo service_role: el gateway valida la firma, aquí se exige el rol para que un
    // usuario logueado no pueda disparar el robot a voluntad.
    const auth = req.headers.get('Authorization') || '';
    let rol = '';
    try { rol = JSON.parse(atob((auth.replace(/^Bearer\s+/i, '').split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'))).role || ''; } catch { rol = ''; }
    if (rol !== 'service_role') return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401 });

    const body = await req.json().catch(() => ({}));
    const presupuesto = Math.min(Number(body.presupuesto_ms) || 100_000, 140_000);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = await claveMistral(supabase);

    const totales: Record<string, number> = {};
    let lotes = 0;
    let quedan = true;
    while (Date.now() - inicio < presupuesto) {
      const { data, error } = await supabase.rpc('items_pendientes_embedding', { p_limite: LOTE });
      if (error) throw error;
      const pend = (data || []) as Pendiente[];
      if (!pend.length) { quedan = false; break; }
      const porTabla = new Map<string, Pendiente[]>();
      for (const p of pend) porTabla.set(p.tabla, [...(porTabla.get(p.tabla) || []), p]);
      const [tabla, filas] = [...porTabla.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      const lote = filas.slice(0, LOTE);
      let vectores: number[][];
      try {
        vectores = await embeber(lote.map((f) => f.texto), apiKey);
      } catch (e) {
        if (e instanceof CuotaAgotada || e instanceof ClaveInvalida) {
          return new Response(JSON.stringify({ ok: false, motivo: e instanceof ClaveInvalida ? 'clave_invalida' : 'cuota_agotada', lotes, totales, quedan: true, detalle: e.message.slice(0, 300), ms: Date.now() - inicio }), { headers: { 'Content-Type': 'application/json' } });
        }
        throw e;
      }
      // Guardado en una sola RPC por lote (antes: un UPDATE por fila).
      const { data: ok, error: e2 } = await supabase.rpc('guardar_embeddings', {
        p_tabla: tabla,
        p_filas: lote.map((f, i) => ({ id: f.id, embedding: vectores[i] })),
      });
      if (e2) throw e2;
      totales[tabla] = (totales[tabla] || 0) + Number(ok || 0);
      lotes++;
      if (!Number(ok)) break; // nada pegó (otro run los tomó): evitar loop
      await new Promise((r) => setTimeout(r, 1100)); // 1 req/s del plan gratis
    }
    return new Response(JSON.stringify({ ok: true, modelo: EMBED_MODELO, lotes, totales, quedan, ms: Date.now() - inicio }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message, ms: Date.now() - inicio }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
