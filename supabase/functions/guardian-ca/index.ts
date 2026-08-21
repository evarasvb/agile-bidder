// GUARDIÁN de compras ágiles. Corre por cron cada 30 min.
// - Cuenta las compras ágiles ACTIVAS (publicada/activa + cierre futuro).
// - Si caen bajo el umbral (50): auto-recupera re-disparando la ingesta v2
//   (que además re-matchea) Y envía un correo de alerta a FirmaVB.
// - Registra cada chequeo en scraper_health_log.
// Silencioso cuando todo está sano (no envía correos si hay >= umbral).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const UMBRAL = 50;
const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';
const ALERT_TO = 'evaras@firmavb.cl';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db = createClient(url, service);

  // Contar compras ágiles activas (mismo criterio que el panel).
  const { count } = await db.from('compras_agiles')
    .select('codigo', { count: 'exact', head: true })
    .or('estado.ilike.publicada,estado.ilike.activa')
    .gt('fecha_cierre', new Date().toISOString());
  const activas = count ?? 0;

  let accion = 'ok';
  let reingesta: unknown = null;
  let emailEnviado = false;

  if (activas < UMBRAL) {
    accion = 'alerta';
    // Auto-recuperación: re-disparar la ingesta v2 (encadena el match).
    try {
      const r = await fetch(`${url}/functions/v1/fetch-compras-agiles-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${service}` },
        body: JSON.stringify({ ttl_cambio_ms: 604800000, max_paginas: 60 }),
      });
      reingesta = await r.json().catch(() => null);
    } catch (e) { reingesta = { error: e instanceof Error ? e.message : String(e) }; }

    // Alerta por correo (solo cuando hay problema).
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      try {
        const er = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM, to: [ALERT_TO],
            subject: `⚠️ FirmaVB: solo ${activas} compras ágiles activas`,
            html: `<p>El panel tiene <b>${activas}</b> compras ágiles activas (umbral ${UMBRAL}).</p>
                   <p>Se reintentó la ingesta automáticamente. Revisa si el robot <code>fetch-compras-agiles-v2</code> está fallando (API de ChileCompra, ticket, o cron).</p>
                   <p style="color:#94a3b8;font-size:12px">Guardián automático · ${new Date().toISOString()}</p>`,
          }),
        });
        emailEnviado = er.ok;
      } catch { /* no romper el guardián si el correo falla */ }
    }
  }

  // Registro de salud.
  try {
    await db.from('scraper_health_log').insert({
      scraper_name: 'guardian-ca',
      tipo_scraper: 'compras_agiles',
      status: accion,
      items_obtenidos: activas,
      meta: { activas, umbral: UMBRAL, email_enviado: emailEnviado, reingesta },
    });
  } catch { /* el log no es crítico */ }

  return new Response(JSON.stringify({ activas, umbral: UMBRAL, accion, email_enviado: emailEnviado, reingesta }),
    { headers: { ...cors, 'Content-Type': 'application/json' }, status: 200 });
});
