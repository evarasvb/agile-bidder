// Invita a un miembro del equipo: crea el registro pendiente con un token de
// activación, envía un email (Resend) con el enlace para activar la cuenta y
// devuelve ese enlace para compartir por WhatsApp/Mail.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

const FROM = 'FirmaVB <notificaciones@firmavb.cl>';

function emailHtml(nombre: string, empresa: string, rol: string, url: string) {
  const rolLabel = rol === 'admin' ? 'Administrador' : rol === 'visor' ? 'Visor (solo lectura)' : 'Vendedor';
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:22px 28px;color:#fff">
        <div style="font-size:20px;font-weight:700">FirmaVB</div>
      </div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">Te invitaron al equipo${empresa ? ` de ${empresa}` : ''}</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 6px">Hola ${nombre || ''}, te sumaron a FirmaVB como <strong>${rolLabel}</strong> para vender al Estado en equipo.</p>
        <p style="color:#475569;line-height:1.6;margin:0 0 22px">Activa tu cuenta creando tu contraseña:</p>
        <a href="${url}" style="display:inline-block;background:#1E40AF;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">Activar mi cuenta</a>
        <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:22px 0 0">Si el botón no funciona, copia y pega este enlace:<br><span style="color:#1E40AF;word-break:break-all">${url}</span></p>
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">FirmaVB · Vende al Estado sin morir en el intento</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization') || '';
    // Identidad del que invita (desde su JWT).
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asUser.auth.getUser();
    const inviter = userData?.user;
    if (!inviter) return json({ error: 'No autenticado' }, 401);

    // El botón "Invitar miembro" lo puede usar cualquiera del equipo, no
    // solo el dueño. Si se usara inviter.id tal cual como invitado_por, un
    // miembro invitado creaba la fila nueva "propia" de ÉL (no del dueño
    // real) — invisible para el dueño y para el resto del equipo, scopeados
    // por vendedores_owner_auth_id(). Se resuelve el dueño EFECTIVO con la
    // misma RPC (vía el cliente autenticado como quien invita, para que
    // auth.uid() adentro de la función resuelva bien) y se usa ESE id.
    const { data: ownerAuthId, error: errOwner } = await asUser.rpc('vendedores_owner_auth_id');
    if (errOwner) return json({ error: errOwner.message }, 500);
    const ownerId: string = (ownerAuthId as string | null) ?? inviter.id;

    const body = await req.json().catch(() => ({}));
    const nombre = String(body.nombre || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    // Vocabulario único de rol, alineado al enum app_role (admin/vendedor/visor).
    // Se acepta 'viewer' por compatibilidad y se normaliza a 'visor'.
    const rolRaw = String(body.rol || '').trim();
    const rol = rolRaw === 'admin' ? 'admin' : (rolRaw === 'visor' || rolRaw === 'viewer') ? 'visor' : 'vendedor';
    const telefono = body.telefono ? String(body.telefono).trim() : null;
    const appUrl = String(body.app_url || '').replace(/\/$/, '') || 'https://firmavb.cl';
    if (!nombre || !email) return json({ error: 'Falta nombre o email' }, 400);

    const db = createClient(url, service);

    // Nombre de la empresa que invita (mejor esfuerzo).
    let empresa = '';
    const { data: cli } = await db.from('clientes').select('empresa_nombre').eq('user_id', ownerId).maybeSingle();
    if (cli?.empresa_nombre) empresa = cli.empresa_nombre;

    // El email ya no es único por fila (dos dueños distintos pueden tener
    // cada uno una fila con el mismo correo — un placeholder "pendiente" de
    // "Nuevo Vendedor" u otra invitación real). .maybeSingle() sobre un
    // .eq('email', email) sin más filtro puede matchear más de una fila y
    // tirar error silencioso (existe quedaba null sin chequear el error),
    // así que se hacen dos consultas acotadas en vez de una sola global:
    // 1) ¿ya tiene una cuenta ACTIVA con ese email (de cualquier dueño)?
    const { data: activos, error: errActivos } = await db.from('vendedores').select('id').eq('email', email).eq('estado_invitacion', 'activada').limit(1);
    if (errActivos) return json({ error: errActivos.message }, 500);
    if (activos && activos.length) return json({ error: 'Esa persona ya tiene una cuenta activa.' }, 409);
    // 2) ¿ya existe una fila PROPIA (invitado_por = el dueño efectivo) para
    // reutilizar? Si el placeholder es de otro dueño, no se toca: se inserta
    // una fila nueva en vez de robarle la suya (y cualquier asignación que
    // ya tuviera esa fila).
    const { data: propios, error: errPropios } = await db.from('vendedores').select('id').eq('email', email).eq('invitado_por', ownerId).limit(1);
    if (errPropios) return json({ error: errPropios.message }, 500);
    const existeId: string | null = propios && propios.length ? propios[0].id : null;
    const reutilizable = !!existeId;

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const row = {
      nombre, email, rol, telefono, activo: false, user_id: null,
      invite_token: token, invitado_por: ownerId, estado_invitacion: 'pendiente',
      invited_at: new Date().toISOString(),
    };
    let vendedorId: string;
    if (reutilizable) {
      const { data, error } = await db.from('vendedores').update(row).eq('id', existeId!).select('id').single();
      if (error) return json({ error: error.message }, 500); vendedorId = data.id;
    } else {
      const { data, error } = await db.from('vendedores').insert(row).select('id').single();
      if (error) return json({ error: error.message }, 500); vendedorId = data.id;
    }

    const activationUrl = `${appUrl}/activar?token=${token}`;

    let emailEnviado = false; let emailError: string | null = null;
    if (resendKey) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [email], subject: `Te invitaron al equipo${empresa ? ` de ${empresa}` : ''} en FirmaVB`, html: emailHtml(nombre, empresa, rol, activationUrl) }),
        });
        emailEnviado = r.ok;
        if (!r.ok) emailError = 'http_' + r.status + ':' + (await r.text().catch(() => '')).slice(0, 160);
      } catch (e) { emailError = e instanceof Error ? e.message : String(e); }
    } else { emailError = 'RESEND_API_KEY no configurada'; }

    return json({ ok: true, vendedor_id: vendedorId, email, activation_url: activationUrl, email_enviado: emailEnviado, email_error: emailError });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
