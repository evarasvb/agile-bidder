import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  cliente_id: string;
  tipo: 'nueva_licitacion' | 'oferta_enviada' | 'resumen_diario';
  data: {
    licitacion_titulo?: string;
    match_score?: number;
    resumen?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cliente_id, tipo, data }: NotificationRequest = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client info and notification preferences
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('email, empresa_nombre')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error("Cliente no encontrado");
    }

    const { data: prefs, error: prefsError } = await supabase
      .from('cliente_notificaciones')
      .select('*')
      .eq('cliente_id', cliente_id)
      .single();

    if (prefsError) {
      console.log("No notification preferences found, using defaults");
    }

    const shouldSendEmail = prefs?.email_instantaneo ?? true;
    const webhookUrl = prefs?.webhook_url;

    console.log(`Processing notification for ${cliente.email}:`, {
      tipo,
      shouldSendEmail,
      hasWebhook: !!webhookUrl
    });

    // Prepare email content based on notification type
    let subject = '';
    let body = '';

    switch (tipo) {
      case 'nueva_licitacion':
        subject = `🎯 Nueva licitación con ${data.match_score}% de match`;
        body = `
          <h2>Nueva oportunidad detectada</h2>
          <p><strong>${data.licitacion_titulo}</strong></p>
          <p>Score de compatibilidad: <strong>${data.match_score}%</strong></p>
          <p>Ingresa a tu dashboard para ver más detalles y generar una oferta.</p>
        `;
        break;
      case 'oferta_enviada':
        subject = '✅ Oferta generada exitosamente';
        body = `
          <h2>Tu oferta está lista</h2>
          <p>Se ha generado una oferta para: <strong>${data.licitacion_titulo}</strong></p>
          <p>Revisa los detalles en tu dashboard.</p>
        `;
        break;
      case 'resumen_diario':
        subject = '📊 Resumen diario de licitaciones';
        body = `
          <h2>Tu resumen del día</h2>
          ${data.resumen}
        `;
        break;
    }

    // SendGrid placeholder - would need SENDGRID_API_KEY secret
    const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
    
    if (shouldSendEmail && sendGridApiKey) {
      console.log("Sending email via SendGrid...");
      
      const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cliente.email }] }],
          from: { email: "notificaciones@licitafast.cl", name: "LicitaFast" },
          subject,
          content: [{ type: "text/html", value: body }],
        }),
      });

      if (!emailResponse.ok) {
        console.error("SendGrid error:", await emailResponse.text());
      } else {
        console.log("Email sent successfully");
      }
    } else {
      console.log("Email sending skipped (no API key or disabled)");
      console.log("Would send:", { to: cliente.email, subject });
    }

    // Send webhook if configured
    if (webhookUrl) {
      console.log("Sending webhook to:", webhookUrl);
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo,
            cliente_id,
            empresa: cliente.empresa_nombre,
            data,
            timestamp: new Date().toISOString()
          }),
        });
        console.log("Webhook sent successfully");
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      email_sent: shouldSendEmail && !!sendGridApiKey,
      webhook_sent: !!webhookUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Notification error:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
