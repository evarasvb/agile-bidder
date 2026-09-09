import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteRequest {
  pieza_id: string;
  contactos_ids?: string[]; // Si no se envía, usa todos los de la categoría
  categoria_filtro?: string; // lead, contacto, webinar_asistente, etc.
}

interface ExecutionResult {
  pieza_id: string;
  total_enviados: number;
  total_exitosos: number;
  total_errores: number;
  detalle: Array<{
    contacto_id?: string;
    email: string;
    estado: string;
    error?: string;
  }>;
}

async function sendEmailViaResend(
  resendKey: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FirmaVB <notificaciones@firmavb.cl>",
        to: [to],
        subject,
        html,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Resend API error:", response.status, responseText);
      return { success: false, error: `Resend error: ${response.status}` };
    }

    const result = JSON.parse(responseText);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("Resend error:", error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user || user.email !== 'evaras@firmavb.cl') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ExecuteRequest = await req.json();
    const { pieza_id, contactos_ids, categoria_filtro } = body;

    // Obtener y atomically claim pieza (idempotency)
    const { data: pieza, error: piezaError } = await sb
      .from('marketing_piezas')
      .select('id, campana_id, contenido, asunto, tipo, canal, estado')
      .eq('id', pieza_id)
      .eq('estado', 'draft')
      .single();

    if (piezaError || !pieza) {
      return new Response(
        JSON.stringify({ error: 'Pieza no encontrada o ya fue ejecutada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as executing to prevent concurrent executions
    const { error: claimError } = await sb
      .from('marketing_piezas')
      .update({ estado: 'ejecutando' })
      .eq('id', pieza_id)
      .eq('estado', 'draft');

    if (claimError || !claimError) {
      // Check if update succeeded
      const { data: updated } = await sb
        .from('marketing_piezas')
        .select('estado')
        .eq('id', pieza_id)
        .single();

      if (updated?.estado !== 'ejecutando') {
        return new Response(
          JSON.stringify({ error: 'Pieza está siendo ejecutada por otro request' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Obtener contactos objetivo
    let query = sb
      .from('marketing_contactos')
      .select('id, email, nombre')
      .eq('estado_suscripcion', 'suscrito');

    if (contactos_ids && contactos_ids.length > 0) {
      query = query.in('id', contactos_ids);
    } else if (categoria_filtro) {
      query = query.eq('categoria', categoria_filtro);
    }

    const { data: contactos, error: contactosError } = await query;

    if (contactosError || !contactos) {
      return new Response(
        JSON.stringify({ error: 'Error al obtener contactos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ejecutar envíos
    const resultado: ExecutionResult = {
      pieza_id,
      total_enviados: contactos.length,
      total_exitosos: 0,
      total_errores: 0,
      detalle: [],
    };

    const ejecuciones: any[] = [];

    for (const contacto of contactos) {
      const emailResult = await sendEmailViaResend(
        resendApiKey,
        contacto.email,
        pieza.asunto || 'FirmaVB',
        pieza.contenido
      );

      const estado = emailResult.success ? 'enviado' : 'fallido';
      resultado.detalle.push({
        contacto_id: contacto.id,
        email: contacto.email,
        estado,
        error: emailResult.error,
      });

      if (emailResult.success) {
        resultado.total_exitosos++;
      } else {
        resultado.total_errores++;
      }

      // Registrar en ejecución
      ejecuciones.push({
        pieza_id,
        contacto_id: contacto.id,
        email: contacto.email,
        estado,
        id_externo: emailResult.messageId,
        respuesta_codigo: emailResult.success ? 200 : 400,
        respuesta_mensaje: emailResult.error || 'Enviado',
        fecha_envio: new Date().toISOString(),
      });
    }

    // Guardar ejecuciones en lote
    if (ejecuciones.length > 0) {
      const { error: insertError } = await sb
        .from('marketing_ejecucion')
        .insert(ejecuciones);

      if (insertError) {
        console.error('Error al registrar ejecuciones:', insertError);
      }
    }

    // Actualizar estado de pieza
    await sb
      .from('marketing_piezas')
      .update({ estado: 'ejecutado' })
      .eq('id', pieza_id);

    // Actualizar campaña a "ejecutando" si no está
    await sb
      .from('marketing_campanas')
      .update({
        estado: 'ejecutando',
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', pieza.campana_id);

    // Calcular métricas
    const hoy = new Date().toISOString().split('T')[0];
    await sb.rpc('marketing_calcular_metricas', {
      campana_id_in: pieza.campana_id,
      fecha_in: hoy,
    });

    console.log(`Ejecución completada: ${resultado.total_exitosos}/${resultado.total_enviados} exitosos`);

    return new Response(
      JSON.stringify(resultado),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en marketing-ejecutar:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
