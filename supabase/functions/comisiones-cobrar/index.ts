// Cobro automático de comisiones con la suscripción de Mercado Pago (diario, 07:45 UTC).
// 1) Facturas validadas con comisiones: se sube el monto del preapproval a fijo + comisiones
//    para el próximo cargo y se anota cobro_programado_en.
// 2) Facturas programadas: si MP ya cobró (last_charged_date posterior) o el cliente pagó con el
//    botón, se marca pagada y el monto vuelve al fijo (cobro_revertido_en).
// Facturas sin comisiones con suscripción: quedan pagadas con el cargo fijo del mes.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
function rolJwt(auth: string | null): string | null {
  try { return JSON.parse(atob((auth ?? "").replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? null; } catch { return null; }
}

Deno.serve(async (req) => {
  if (rolJwt(req.headers.get("authorization")) !== "service_role") return json({ error: "no autorizado" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") ?? "";
  if (!token) token = (await sb.from("app_secrets").select("value").eq("key", "MERCADOPAGO_ACCESS_TOKEN").maybeSingle()).data?.value ?? "";
  if (!token) return json({ error: "sin_pasarela" }, 500);
  const mp = async (metodo: string, path: string, body?: unknown) => {
    const r = await fetch(`https://api.mercadopago.com${path}`, { method: metodo, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  };

  const res = { programadas: 0, pagadas: 0, revertidas: 0, sin_suscripcion: 0, errores: [] as string[] };
  const { data: filas, error } = await sb.rpc("comisiones_por_cobrar");
  if (error) return json({ error: error.message }, 500);

  for (const f of (filas ?? []) as any[]) {
    try {
      // 2) Programadas: ¿ya se cobró o ya se pagó por otro lado? → pagada + volver al fijo
      if (f.cobro_programado_en && !f.cobro_revertido_en) {
        const pre = await mp("GET", `/preapproval/${f.cobro_preapproval_id}`);
        const ultimoCobro = pre.data?.summarized?.last_charged_date ?? null;
        const cobrado = ultimoCobro && new Date(ultimoCobro) > new Date(f.cobro_programado_en);
        if (cobrado || f.estado === "pagada" || f.susc_estado !== "authorized") {
          const back = await mp("PUT", `/preapproval/${f.cobro_preapproval_id}`, { auto_recurring: { transaction_amount: Math.round(Number(f.fijo)), currency_id: "CLP" } });
          if (!back.ok && f.susc_estado === "authorized") { res.errores.push(`revertir ${f.factura_id}: ${back.status}`); continue; }
          await sb.from("facturas_comision").update({
            cobro_revertido_en: new Date().toISOString(),
            ...(cobrado && f.estado !== "pagada" ? { estado: "pagada", fecha_pago: String(ultimoCobro).slice(0, 10) } : {}),
          }).eq("id", f.factura_id);
          await sb.from("suscripciones").update({ monto: Math.round(Number(f.fijo)), updated_at: new Date().toISOString() }).eq("mp_preapproval_id", f.cobro_preapproval_id);
          res.revertidas++; if (cobrado) res.pagadas++;
        }
        continue;
      }
      // 1) Por programar
      if (!f.mp_preapproval_id || f.susc_estado !== "authorized") { res.sin_suscripcion++; continue; }
      if (Number(f.total_comision) <= 0) {
        // El cargo fijo de la suscripción cubre el mes: nada extra que cobrar.
        await sb.from("facturas_comision").update({ estado: "pagada", fecha_pago: new Date().toISOString().slice(0, 10), cobro_programado_en: new Date().toISOString(), cobro_revertido_en: new Date().toISOString(), cobro_preapproval_id: f.mp_preapproval_id }).eq("id", f.factura_id);
        res.pagadas++; continue;
      }
      const monto = Math.round(Number(f.fijo) + Number(f.total_comision));
      const up = await mp("PUT", `/preapproval/${f.mp_preapproval_id}`, { auto_recurring: { transaction_amount: monto, currency_id: "CLP" } });
      if (!up.ok) { res.errores.push(`programar ${f.factura_id}: ${up.status} ${up.data?.message ?? ""}`); continue; }
      await sb.from("facturas_comision").update({ cobro_programado_en: new Date().toISOString(), cobro_preapproval_id: f.mp_preapproval_id }).eq("id", f.factura_id);
      await sb.from("suscripciones").update({ monto, proximo_cobro: up.data?.next_payment_date ?? null, updated_at: new Date().toISOString() }).eq("mp_preapproval_id", f.mp_preapproval_id);
      res.programadas++;
    } catch (e) { res.errores.push(`${f.factura_id}: ${String((e as Error)?.message ?? e)}`); }
  }
  return json(res);
});
