// Pago único del Experto Pro (30 días) con Mercado Pago Checkout Pro.
// Devuelve la URL de pago; el webhook mp-pago-experto-webhook activa el plan al aprobarse.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const PRODUCTOS: Record<string, { titulo: string; monto: number; dias: number }> = {
  pro_30: { titulo: "Experto FirmaVB Pro — 30 días", monto: Number(Deno.env.get("EXPERTO_PRO_CLP") ?? 50000), dias: 30 },
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
function jwt(auth: string): { role: string; sub: string | null; email: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null, email: p.email ?? null }; }
  catch { return { role: "", sub: null, email: null }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { role, sub, email } = jwt(req.headers.get("Authorization") ?? "");
    const body = await req.json().catch(() => ({}));
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para activar el plan Pro." }, 401);
    const clave = String(body.producto ?? "pro_30");
    const prod = PRODUCTOS[clave];
    if (!prod) return json({ error: "producto" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
    if (!token) token = (await sb.from("app_secrets").select("value").eq("key", "MERCADOPAGO_ACCESS_TOKEN").maybeSingle()).data?.value ?? "";
    if (!token) return json({ error: "sin_pasarela", mensaje: "Mercado Pago no está configurado." }, 500);

    const correo = body.email ?? email ?? null;
    const { data: pago, error } = await sb.from("experto_pagos").insert({ user_id: userId, email: correo, producto: clave, monto: prod.monto }).select("id").single();
    if (error) return json({ error: error.message }, 500);

    const volver = String(body.back_url ?? "https://firmavb.cl/experto.html").split("?")[0];
    const pref: Record<string, unknown> = {
      items: [{ id: clave, title: prod.titulo, quantity: 1, unit_price: prod.monto, currency_id: "CLP" }],
      external_reference: pago.id,
      metadata: { pago_id: pago.id, user_id: userId },
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-pago-experto-webhook`,
      back_urls: { success: `${volver}?pago=ok`, pending: `${volver}?pago=pendiente`, failure: `${volver}?pago=error` },
      auto_return: "approved",
      statement_descriptor: "FIRMAVB EXPERTO",
    };
    if (correo) pref.payer = { email: correo };
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": pago.id }, body: JSON.stringify(pref),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { await sb.from("experto_pagos").update({ estado: "error", raw: d }).eq("id", pago.id); return json({ error: "mp", mensaje: d.message ?? "Mercado Pago no respondió." }, 502); }
    await sb.from("experto_pagos").update({ mp_preference_id: d.id }).eq("id", pago.id);
    return json({ ok: true, pago_id: pago.id, url: d.init_point, monto: prod.monto, dias: prod.dias });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
