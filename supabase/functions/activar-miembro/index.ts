// Activación de un miembro invitado. Pública (el invitado aún no tiene sesión).
//  action 'info'   { token }            -> datos de la invitación para la página
//  action 'activar'{ token, password }  -> crea la cuenta (contraseña) y la vincula
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const token = String(body.token || '').trim();
    if (!token) return json({ error: 'Falta token' }, 400);

    const { data: v } = await db.from('vendedores')
      .select('id, nombre, email, rol, estado_invitacion, invitado_por, user_id')
      .eq('invite_token', token).maybeSingle();
    if (!v) return json({ error: 'Invitación no encontrada o ya utilizada.' }, 404);

    // Empresa que invita (mejor esfuerzo).
    let empresa = '';
    if (v.invitado_por) {
      const { data: cli } = await db.from('clientes').select('empresa_nombre').eq('user_id', v.invitado_por).maybeSingle();
      if (cli?.empresa_nombre) empresa = cli.empresa_nombre;
    }

    if (action === 'info') {
      return json({ ok: true, nombre: v.nombre, email: v.email, rol: v.rol, empresa, ya_activada: v.estado_invitacion === 'activada' });
    }

    if (action === 'activar') {
      const password = String(body.password || '');
      if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
      if (v.estado_invitacion === 'activada') return json({ error: 'Esta cuenta ya fue activada. Inicia sesión.' }, 409);

      // Crear el usuario de auth (confirmado, sin verificación por email).
      const { data: created, error: cErr } = await db.auth.admin.createUser({
        email: v.email, password, email_confirm: true,
        user_metadata: { nombre: v.nombre, invited: true },
      });
      if (cErr || !created?.user) {
        const msg = (cErr?.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión o usa “olvidé mi contraseña”.' }, 409);
        }
        return json({ error: cErr?.message || 'No se pudo crear la cuenta.' }, 500);
      }

      await db.from('vendedores').update({
        user_id: created.user.id, estado_invitacion: 'activada', activo: true,
        invite_token: null, updated_at: new Date().toISOString(),
      }).eq('id', v.id);

      return json({ ok: true, email: v.email });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
