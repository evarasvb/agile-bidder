import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  cliente_id: string;
  tipo: 'nuevo_match' | 'cierre_proximo' | 'cambio_licitacion' | 'nueva_licitacion' | 'oferta_enviada' | 'resumen_diario';
  data: {
    licitacion_id?: string;
    licitacion_titulo?: string;
    match_score?: number;
    organismo?: string;
    presupuesto?: number;
    fecha_cierre?: string;
    horas_restantes?: number;
    resumen?: string;
    productos_match?: Array<{
      nombre: string;
      score: number;
    }>;
  };
}

// Professional HTML email templates
function getEmailTemplate(tipo: string, data: NotificationRequest['data'], empresaNombre: string): { subject: string; html: string } {
  const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #f4f7fa; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 40px 30px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; }
      .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px; }
      .content { padding: 40px 30px; }
      .score-badge { display: inline-block; background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 18px; }
      .info-card { background: #f8fafc; border-left: 4px solid #3B82F6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
      .info-card h3 { margin: 0 0 10px; color: #1e293b; font-size: 16px; }
      .info-card p { margin: 0; color: #64748b; font-size: 14px; }
      .cta-button { display: inline-block; background: linear-gradient(135deg, #3B82F6, #1D4ED8); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
      .cta-button:hover { background: linear-gradient(135deg, #2563EB, #1E40AF); }
      .product-list { list-style: none; padding: 0; margin: 20px 0; }
      .product-list li { padding: 12px 16px; background: #f1f5f9; margin: 8px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
      .product-score { background: #10B981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      .urgent-badge { background: #EF4444; color: white; padding: 6px 16px; border-radius: 16px; font-weight: 600; font-size: 14px; }
      .footer { background: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
      .footer p { color: #94a3b8; font-size: 13px; margin: 5px 0; }
      .footer a { color: #3B82F6; text-decoration: none; }
    </style>
  `;

  switch (tipo) {
    case 'nuevo_match':
      return {
        subject: `🎯 ¡Match ${data.match_score}%! Nueva oportunidad de licitación`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 ¡Nueva Oportunidad!</h1>
                <p>Hemos encontrado una licitación compatible con tu inventario</p>
              </div>
              <div class="content">
                <div style="text-align: center; margin-bottom: 30px;">
                  <span class="score-badge">${data.match_score}% de compatibilidad</span>
                </div>
                
                <div class="info-card">
                  <h3>${data.licitacion_titulo}</h3>
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.presupuesto ? `<p><strong>Presupuesto:</strong> $${data.presupuesto.toLocaleString('es-CL')}</p>` : ''}
                  ${data.fecha_cierre ? `<p><strong>Cierre:</strong> ${new Date(data.fecha_cierre).toLocaleDateString('es-CL')}</p>` : ''}
                </div>

                ${data.productos_match && data.productos_match.length > 0 ? `
                  <h3 style="color: #1e293b;">Productos que coinciden:</h3>
                  <ul class="product-list">
                    ${data.productos_match.slice(0, 5).map(p => `
                      <li>
                        <span>${p.nombre}</span>
                        <span class="product-score">${p.score}%</span>
                      </li>
                    `).join('')}
                  </ul>
                ` : ''}

                <div style="text-align: center;">
                  <a href="#" class="cta-button">Ver Licitación y Ofertar</a>
                </div>
              </div>
              <div class="footer">
                <p>Este email fue enviado a ${empresaNombre}</p>
                <p><a href="#">Configurar preferencias de notificaciones</a></p>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'cierre_proximo':
      return {
        subject: `⏰ ¡Urgente! Licitación cierra en ${data.horas_restantes}hrs`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);">
                <h1>⏰ ¡Cierre Próximo!</h1>
                <p>Una licitación de tu interés está por cerrar</p>
              </div>
              <div class="content">
                <div style="text-align: center; margin-bottom: 30px;">
                  <span class="urgent-badge">Cierra en ${data.horas_restantes} horas</span>
                </div>
                
                <div class="info-card" style="border-left-color: #EF4444;">
                  <h3>${data.licitacion_titulo}</h3>
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.presupuesto ? `<p><strong>Presupuesto:</strong> $${data.presupuesto.toLocaleString('es-CL')}</p>` : ''}
                  ${data.match_score ? `<p><strong>Compatibilidad:</strong> ${data.match_score}%</p>` : ''}
                </div>

                <div style="text-align: center;">
                  <a href="#" class="cta-button" style="background: linear-gradient(135deg, #EF4444, #DC2626);">Generar Oferta Ahora</a>
                </div>
              </div>
              <div class="footer">
                <p>Este email fue enviado a ${empresaNombre}</p>
                <p><a href="#">Configurar preferencias de notificaciones</a></p>
              </div>
            </div>
          </body>
          </html>
        `
      };

    case 'resumen_diario':
      return {
        subject: '📊 Tu resumen diario de licitaciones',
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 Resumen del Día</h1>
                <p>${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div class="content">
                ${data.resumen || '<p>No hay novedades para hoy.</p>'}
                
                <div style="text-align: center;">
                  <a href="#" class="cta-button">Ver Dashboard Completo</a>
                </div>
              </div>
              <div class="footer">
                <p>Este email fue enviado a ${empresaNombre}</p>
                <p><a href="#">Configurar preferencias de notificaciones</a></p>
              </div>
            </div>
          </body>
          </html>
        `
      };

    default:
      return {
        subject: `📢 Notificación de FirmaVB`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>FirmaVB</h1>
              </div>
              <div class="content">
                <p>${JSON.stringify(data)}</p>
              </div>
              <div class="footer">
                <p>Este email fue enviado a ${empresaNombre}</p>
              </div>
            </div>
          </body>
          </html>
        `
      };
  }
}

// Send email via Resend API directly (no npm import)
async function sendViaResend(apiKey: string, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FirmaVB <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API error:", response.status, errorText);
      return false;
    }

    const result = await response.json();
    console.log("Email sent via Resend:", result);
    return true;
  } catch (error) {
    console.error("Resend error:", error);
    return false;
  }
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

    // Get client info
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('email, empresa_nombre')
      .eq('id', cliente_id)
      .single();

    if (clienteError || !cliente) {
      throw new Error("Cliente no encontrado");
    }

    // Get notification preferences
    const { data: prefs } = await supabase
      .from('cliente_notificaciones')
      .select('*')
      .eq('cliente_id', cliente_id)
      .single();

    // Check if we should send based on preferences
    let shouldSend = true;
    if (prefs) {
      if (tipo === 'nuevo_match' && !prefs.alerta_nuevos_matches) shouldSend = false;
      if (tipo === 'cierre_proximo' && !prefs.alerta_cierre_proximo) shouldSend = false;
      if (tipo === 'cambio_licitacion' && !prefs.alerta_cambios_guardadas) shouldSend = false;
      
      // Check score threshold
      if (tipo === 'nuevo_match' && data.match_score && prefs.score_minimo_alerta) {
        if (data.match_score < prefs.score_minimo_alerta) shouldSend = false;
      }
      
      // Check budget threshold
      if (data.presupuesto && prefs.presupuesto_minimo) {
        if (data.presupuesto < prefs.presupuesto_minimo) shouldSend = false;
      }
    }

    const shouldSendEmail = prefs?.email_instantaneo ?? true;
    const webhookUrl = prefs?.webhook_url;

    console.log(`Processing notification for ${cliente.email}:`, {
      tipo,
      shouldSend,
      shouldSendEmail,
      hasWebhook: !!webhookUrl
    });

    let emailSent = false;

    // Try Resend first
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (shouldSend && shouldSendEmail && resendApiKey) {
      const { subject, html } = getEmailTemplate(tipo, data, cliente.empresa_nombre);
      emailSent = await sendViaResend(resendApiKey, cliente.email, subject, html);
    }

    // Fallback to SendGrid if Resend failed
    const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");
    
    if (shouldSend && shouldSendEmail && !emailSent && sendGridApiKey) {
      try {
        const { subject, html } = getEmailTemplate(tipo, data, cliente.empresa_nombre);
        
        const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendGridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: cliente.email }] }],
            from: { email: "notificaciones@firmavb.cl", name: "FirmaVB" },
            subject,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (emailResponse.ok) {
          console.log("Email sent via SendGrid");
          emailSent = true;
        } else {
          console.error("SendGrid error:", await emailResponse.text());
        }
      } catch (sendgridError) {
        console.error("SendGrid error:", sendgridError);
      }
    }

    if (shouldSend && shouldSendEmail && !emailSent) {
      console.log("No email provider configured. Would send:", {
        to: cliente.email,
        tipo,
        data
      });
    }

    // Send webhook if configured
    let webhookSent = false;
    if (shouldSend && webhookUrl) {
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
        webhookSent = true;
      } catch (webhookError) {
        console.error("Webhook error:", webhookError);
      }
    }

    // Log the notification
    await supabase.from('notificaciones_log').insert({
      cliente_id,
      tipo,
      licitacion_id: data.licitacion_id,
      email_enviado: emailSent,
      datos: data
    });

    return new Response(JSON.stringify({ 
      success: true,
      email_sent: emailSent,
      webhook_sent: webhookSent,
      skipped: !shouldSend
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
