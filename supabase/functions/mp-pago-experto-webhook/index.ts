// Webhook de Mercado Pago para los pagos únicos del Experto. MP avisa {type:"payment", data:{id}};
// se consulta el pago con nuestro token (así una notificación falsa no activa nada) y, si está
// aprobado, se activa Pro por los días del producto. Siempre responde 200 para que MP no reintente.
import { createClient } from "jsr:@supabase/supabase-js@2";
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
const DIAS: Record<string, number> = { pro_30: 30, plus_30: 30 };

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const tipo = String(body?.type ?? body?.action ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
    const id = body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    if (!id || (tipo && !tipo.includes("payment"))) return json({ ok: true, ignorado: tipo || "sin id" });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
    if (!token) token = (await sb.from("app_secrets").select("value").eq("key", "MERCADOPAGO_ACCESS_TOKEN").maybeSingle()).data?.value ?? "";
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return json({ ok: false, mp_status: r.status });
    const p = await r.json();
    const ref = p.external_reference ?? p.metadata?.pago_id;
    if (!ref) return json({ ok: true, sin_referencia: true });
    const { data: pago } = await sb.from("experto_pagos").select("id, user_id, producto, estado").eq("id", ref).maybeSingle();
    if (!pago) return json({ ok: true, desconocido: true });

    await sb.from("experto_pagos").update({
      estado: p.status, mp_payment_id: String(p.id), updated_at: new Date().toISOString(),
      raw: { status: p.status, detalle: p.status_detail, monto: p.transaction_amount, aprobado: p.date_approved, metodo: p.payment_method_id },
    }).eq("id", pago.id);
    if (p.status === "approved" && pago.estado !== "approved") {
      const { data: hasta, error } = await sb.rpc("experto_activar_pro", { p_user_id: pago.user_id, p_dias: DIAS[pago.producto] ?? 30, p_origen: `mp:${p.id}`, p_nivel: String(pago.producto).startsWith("plus") ? "plus" : "pro" });
      return json({ ok: !error, pro_hasta: hasta, error: error?.message });
    }
    return json({ ok: true, estado: p.status });
  } catch (e) { return json({ ok: false, error: String((e as Error)?.message ?? e) }); }
});
