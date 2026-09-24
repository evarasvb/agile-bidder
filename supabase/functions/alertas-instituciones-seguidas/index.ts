// Aviso automático de instituciones seguidas. Corre a diario (pg_cron).
// Cruza cliente_instituciones_seguidas contra licitaciones_bi y compras_agiles
// publicadas en las últimas 48h (por RUT del organismo) y, para cada oportunidad
// nueva que el cliente aún no fue avisado, dispara send-notification (email +
// registro en notificaciones_log, respetando las preferencias del cliente).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Oportunidad {
  codigo: string;
  titulo: string | null;
  organismo: string | null;
  presupuesto: number | null;
  fecha_cierre: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE);

    // 1) Instituciones seguidas por los clientes.
    const { data: seguidas, error: eSeg } = await sb
      .from("cliente_instituciones_seguidas")
      .select("cliente_id, rut_institucion, nombre_institucion");
    if (eSeg) throw eSeg;
    if (!seguidas?.length) {
      return new Response(JSON.stringify({ ok: true, avisos: 0, motivo: "sin_seguidas" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const ruts = [...new Set(seguidas.map((s: any) => s.rut_institucion).filter(Boolean))];
    const desde = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

    // 2) Oportunidades nuevas (48h) de esas instituciones, por RUT del organismo.
    const porRut = new Map<string, Oportunidad[]>();
    const push = (rut: string | null, o: Oportunidad) => {
      if (!rut) return;
      const arr = porRut.get(rut) ?? [];
      arr.push(o);
      porRut.set(rut, arr);
    };

    const { data: lics } = await sb
      .from("licitaciones_bi")
      .select("codigo, nombre, institucion_nombre, institucion_rut, presupuesto_estimado, fecha_cierre, fecha_publicacion")
      .in("institucion_rut", ruts)
      .gte("fecha_publicacion", desde);
    for (const l of lics ?? []) {
      push(l.institucion_rut, {
        codigo: l.codigo,
        titulo: l.nombre,
        organismo: l.institucion_nombre,
        presupuesto: l.presupuesto_estimado,
        fecha_cierre: l.fecha_cierre,
      });
    }

    const { data: cas } = await sb
      .from("compras_agiles")
      .select("codigo, nombre, nombre_organismo, organismo_rut, monto_estimado, fecha_cierre, fecha_publicacion")
      .in("organismo_rut", ruts)
      .gte("fecha_publicacion", desde);
    for (const c of cas ?? []) {
      push(c.organismo_rut, {
        codigo: c.codigo,
        titulo: c.nombre,
        organismo: c.nombre_organismo,
        presupuesto: c.monto_estimado,
        fecha_cierre: c.fecha_cierre,
      });
    }

    if (porRut.size === 0) {
      return new Response(JSON.stringify({ ok: true, avisos: 0, motivo: "sin_oportunidades_nuevas" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 3) Dedup: lo ya avisado en los últimos 7 días (send-notification registra en
    // notificaciones_log con tipo 'nueva_licitacion' y licitacion_id = código).
    const dedupDesde = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: logs } = await sb
      .from("notificaciones_log")
      .select("cliente_id, licitacion_id")
      .eq("tipo", "nueva_licitacion")
      .gte("created_at", dedupDesde);
    const yaAvisado = new Set((logs ?? []).map((r: any) => `${r.cliente_id}|${r.licitacion_id}`));

    // 4) Enviar por cada (cliente, oportunidad nueva).
    let avisos = 0;
    for (const s of seguidas as any[]) {
      const opps = porRut.get(s.rut_institucion) ?? [];
      for (const o of opps) {
        const key = `${s.cliente_id}|${o.codigo}`;
        if (yaAvisado.has(key)) continue;
        yaAvisado.add(key);
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE}` },
            body: JSON.stringify({
              cliente_id: s.cliente_id,
              tipo: "nueva_licitacion",
              data: {
                licitacion_id: o.codigo,
                licitacion_codigo: o.codigo,
                licitacion_titulo: o.titulo ?? "Nueva oportunidad",
                organismo: o.organismo ?? s.nombre_institucion,
                presupuesto: o.presupuesto ?? undefined,
                fecha_cierre: o.fecha_cierre ?? undefined,
              },
            }),
          });
          if (r.ok) avisos++;
        } catch (e) {
          console.error("send-notification", s.cliente_id, o.codigo, String(e));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, avisos, ms: Date.now() - t0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
