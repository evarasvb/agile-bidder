// Recordatorios automáticos de cobranza (PASO 2, desatendido).
// Cron diario: para cada cliente con `clientes.recordatorios_cobranza_activo = true`,
// revisa sus facturas por cobrar y, según los días de atraso, deja un BORRADOR de
// recordatorio en su Gmail (no lo envía: el dueño revisa y manda — ideal para
// deudores que son organismos del Estado). No repite facturas contactadas hace
// menos de 5 días. Reusa la conexión de Gmail del dueño (gmail_conexiones).
//
// Seguridad: se invoca solo desde el cron con el JWT de servicio (verify_jwt).
// Apagado por defecto (el interruptor lo prende el cliente en el CRM de Cobranza).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

// --- Gmail helpers (copiados de la función `gmail`) ---------------------------
function b64url(bytes: Uint8Array): string {
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64Mime(bytes: Uint8Array): string {
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/(.{76})/g, '$1\r\n');
}
function encHeader(s: string): string {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(s) ? `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=` : s;
}
async function accessToken(db: any, userId: string, clientId: string, clientSecret: string): Promise<string | null> {
  const { data: row } = await db.from('gmail_conexiones').select('access_token, refresh_token, token_expiry').eq('user_id', userId).maybeSingle();
  if (!row?.refresh_token) return null;
  const exp = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  if (row.access_token && exp > Date.now() + 60_000) return row.access_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: row.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  const nuevo = t.access_token as string;
  await db.from('gmail_conexiones').update({ access_token: nuevo, token_expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
  return nuevo;
}
function construirRaw(opts: { to: string; from?: string | null; subject: string; bodyHtml: string }): string {
  const boundary = `b_${crypto.randomUUID().replace(/-/g, '')}`;
  const nl = '\r\n';
  const cabeceras = [
    `To: ${opts.to}`,
    opts.from ? `From: ${opts.from}` : null,
    `Subject: ${encHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join(nl);
  const parte = `--${boundary}${nl}Content-Type: text/html; charset="UTF-8"${nl}Content-Transfer-Encoding: base64${nl}${nl}` + base64Mime(new TextEncoder().encode(opts.bodyHtml));
  const mensaje = cabeceras + nl + nl + parte + nl + `--${boundary}--${nl}`;
  return b64url(new TextEncoder().encode(mensaje));
}

// --- Atraso y tono (idéntico a src/hooks/useCobranza y lib/recordatoriosCobranza) ---
function fechaPago(f: { fecha_vencimiento?: string | null; fecha_recepcion?: string | null; fecha_emision?: string | null }): Date | null {
  if (f.fecha_vencimiento) return new Date(f.fecha_vencimiento + 'T00:00:00');
  const base = f.fecha_recepcion || f.fecha_emision;
  if (!base) return null;
  const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + 30); return d;
}
function diasAtraso(f: any): number | null {
  const fp = fechaPago(f); if (!fp) return null;
  const hoy = new Date(); return Math.floor((hoy.setHours(0, 0, 0, 0) - fp.setHours(0, 0, 0, 0)) / 86_400_000);
}
function tono(dias: number | null): { clave: string; label: string } | null {
  if (dias == null || dias < -3) return null;
  if (dias <= 0) return { clave: 'por_vencer', label: 'Por vencer' };
  if (dias <= 7) return { clave: 'amable', label: 'Recordatorio amable' };
  if (dias <= 15) return { clave: 'firme', label: 'Aviso firme' };
  return { clave: 'prejudicial', label: 'Aviso prejudicial' };
}
const CLP = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');

function cuerpo(empresa: string, f: any, t: { clave: string; label: string }, dias: number | null): string {
  const esc = (s: string) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const ref = f.numero_factura ? `la factura N° ${esc(f.numero_factura)}` : f.oc_codigo ? `la orden de compra ${esc(f.oc_codigo)}` : 'la factura';
  const estado = dias == null ? '' : dias <= 0 ? `que vence pronto` : `con ${dias} día${dias === 1 ? '' : 's'} de atraso`;
  const parrafo = t.clave === 'por_vencer'
    ? `Le escribimos para recordarle amablemente el próximo vencimiento de ${ref} por ${CLP(f.monto)}.`
    : t.clave === 'amable'
    ? `Le recordamos cordialmente el pago pendiente de ${ref} por ${CLP(f.monto)}, ${estado}.`
    : t.clave === 'firme'
    ? `Reiteramos el pago pendiente de ${ref} por ${CLP(f.monto)}, ${estado}. Agradeceremos regularizarlo a la brevedad.`
    : `Le informamos que ${ref} por ${CLP(f.monto)} se encuentra ${estado}. De no regularizarse, se aplicará el interés por mora que corresponde según la ley, previo a iniciar las gestiones de cobranza prejudicial.`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5">
  <p>Estimados,</p>
  <p>${parrafo}</p>
  <p>Si el pago ya fue efectuado, por favor haga caso omiso de este mensaje e infórmenos el comprobante.</p>
  <p>Quedamos atentos.<br/>Saludos cordiales,<br/><strong>${esc(empresa || 'FirmaVB')}</strong></p>
  <p style="font-size:11px;color:#888">Recordatorio preparado automáticamente por el CRM de cobranza de FirmaVB.</p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!clientId || !clientSecret) return json({ error: 'Gmail no está configurado (falta credencial de Google).' }, 500);

    const db = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const soloCliente: string | undefined = body.cliente_id;      // para probar un solo cliente
    const dryRun: boolean = body.dry_run === true;                 // no crea borradores, solo cuenta

    let q = db.from('clientes').select('id, user_id, empresa_nombre').eq('recordatorios_cobranza_activo', true);
    if (soloCliente) q = q.eq('id', soloCliente);
    const { data: clientes, error: cErr } = await q;
    if (cErr) return json({ error: cErr.message }, 500);

    const resumen: any[] = [];
    for (const cli of (clientes ?? []) as any[]) {
      const at = await accessToken(db, cli.user_id, clientId, clientSecret);
      if (!at) { resumen.push({ cliente: cli.id, estado: 'sin_gmail_conectado' }); continue; }
      const { data: conn } = await db.from('gmail_conexiones').select('google_email').eq('user_id', cli.user_id).maybeSingle();
      const from = conn?.google_email ?? null;

      const { data: facturas } = await db.from('facturas_por_cobrar')
        .select('id, deudor_nombre, deudor_email, numero_factura, oc_codigo, monto, fecha_emision, fecha_recepcion, fecha_vencimiento, estado')
        .eq('cliente_id', cli.id)
        .not('deudor_email', 'is', null)
        .not('estado', 'in', '(pagada,incobrable)')
        .limit(500);

      let creados = 0;
      for (const f of (facturas ?? []) as any[]) {
        const dias = diasAtraso(f);
        const t = tono(dias);
        if (!t) continue;
        const { data: segs } = await db.from('cobranza_seguimiento').select('fecha').eq('factura_id', f.id).order('fecha', { ascending: false }).limit(1);
        const ult = segs?.[0]?.fecha as string | undefined;
        if (ult) { const d = Math.round((Date.now() - new Date(ult + 'T00:00:00').getTime()) / 86_400_000); if (d < 5) continue; }
        if (dryRun) { creados++; continue; }

        const subject = `Recordatorio de pago${f.numero_factura ? ` · factura N° ${f.numero_factura}` : f.oc_codigo ? ` · OC ${f.oc_codigo}` : ''}`;
        const raw = construirRaw({ to: f.deudor_email, from, subject, bodyHtml: cuerpo(cli.empresa_nombre, f, t, dias) });
        const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw } }),
        });
        if (!r.ok) { resumen.push({ cliente: cli.id, factura: f.id, error: (await r.text()).slice(0, 200) }); continue; }
        await db.from('cobranza_seguimiento').insert({ factura_id: f.id, cliente_id: cli.id, canal: 'correo', nota: `Recordatorio automático (${t.label}) — borrador creado en Gmail`, fecha: new Date().toISOString().slice(0, 10) });
        creados++;
      }
      resumen.push({ cliente: cli.id, creados, dry_run: dryRun });
    }
    return json({ ok: true, clientes: (clientes ?? []).length, resumen });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
