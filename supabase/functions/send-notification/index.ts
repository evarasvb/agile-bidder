import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FirmaVB Branding
const FIRMAVB_COLORS = {
  primary: '#1E40AF',    // Azul FirmaVB
  primaryLight: '#3B82F6',
  secondary: '#10B981',  // Verde
  secondaryDark: '#059669',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  background: '#f4f7fa',
  cardBg: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
};

const FIRMAVB_LOGO = 'https://firmavb.cl/logo.png';
const FIRMAVB_FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';
const FIRMAVB_URL = 'https://firmavb.cl';

interface NotificationRequest {
  cliente_id?: string;
  to?: string;
  tipo: 'nuevo_match' | 'cierre_proximo' | 'cambio_licitacion' | 'nueva_licitacion' | 'oferta_enviada' | 'adjudicacion' | 'recordatorio' | 'resumen_diario';
  data: {
    licitacion_id?: string;
    licitacion_codigo?: string;
    licitacion_titulo?: string;
    match_score?: number;
    organismo?: string;
    presupuesto?: number;
    fecha_cierre?: string;
    horas_restantes?: number;
    resumen?: string;
    // Oferta enviada
    oferta_id?: string;
    monto_ofertado?: number;
    productos_count?: number;
    // Adjudicación
    resultado?: 'ganada' | 'perdida' | 'desierta';
    monto_adjudicado?: number;
    proveedor_ganador?: string;
    // Recordatorio
    dias_restantes?: number;
    accion_pendiente?: string;
    productos_match?: Array<{
      nombre: string;
      score: number;
    }>;
  };
}

interface ClienteNotificaciones {
  alerta_nuevos_matches?: boolean;
  alerta_cierre_proximo?: boolean;
  alerta_cambios_guardadas?: boolean;
  score_minimo_alerta?: number;
  presupuesto_minimo?: number;
  email_instantaneo?: boolean;
  webhook_url?: string;
}

interface Cliente {
  id: string;
  email: string;
  empresa_nombre: string;
  user_id?: string;
}

// Professional HTML email templates with FirmaVB branding
function getEmailTemplate(tipo: string, data: NotificationRequest['data'], empresaNombre: string): { subject: string; html: string } {
  const baseStyles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: ${FIRMAVB_COLORS.background}; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, ${FIRMAVB_COLORS.primaryLight} 0%, ${FIRMAVB_COLORS.primary} 100%); padding: 40px 30px; text-align: center; }
      .header img { height: 50px; margin-bottom: 15px; }
      .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
      .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px; }
      .content { padding: 40px 30px; }
      .score-badge { display: inline-block; background: linear-gradient(135deg, ${FIRMAVB_COLORS.secondary}, ${FIRMAVB_COLORS.secondaryDark}); color: white; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 18px; }
      .info-card { background: ${FIRMAVB_COLORS.cardBg}; border-left: 4px solid ${FIRMAVB_COLORS.primary}; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
      .info-card h3 { margin: 0 0 10px; color: ${FIRMAVB_COLORS.text}; font-size: 16px; }
      .info-card p { margin: 5px 0; color: ${FIRMAVB_COLORS.textMuted}; font-size: 14px; }
      .info-card strong { color: ${FIRMAVB_COLORS.text}; }
      .cta-button { display: inline-block; background: linear-gradient(135deg, ${FIRMAVB_COLORS.primaryLight}, ${FIRMAVB_COLORS.primary}); color: white !important; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 20px 0; }
      .cta-button:hover { opacity: 0.9; }
      .product-list { list-style: none; padding: 0; margin: 20px 0; }
      .product-list li { padding: 12px 16px; background: #f1f5f9; margin: 8px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
      .product-score { background: ${FIRMAVB_COLORS.secondary}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
      .urgent-badge { background: ${FIRMAVB_COLORS.danger}; color: white; padding: 6px 16px; border-radius: 16px; font-weight: 600; font-size: 14px; }
      .success-badge { background: ${FIRMAVB_COLORS.secondary}; color: white; padding: 6px 16px; border-radius: 16px; font-weight: 600; font-size: 14px; }
      .warning-badge { background: #F59E0B; color: white; padding: 6px 16px; border-radius: 16px; font-weight: 600; font-size: 14px; }
      .result-won { background: linear-gradient(135deg, ${FIRMAVB_COLORS.secondary}, ${FIRMAVB_COLORS.secondaryDark}); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 18px; text-align: center; margin: 20px 0; }
      .result-lost { background: linear-gradient(135deg, ${FIRMAVB_COLORS.textMuted}, #475569); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 18px; text-align: center; margin: 20px 0; }
      .footer { background: ${FIRMAVB_COLORS.cardBg}; padding: 30px; text-align: center; border-top: 1px solid ${FIRMAVB_COLORS.border}; }
      .footer p { color: #94a3b8; font-size: 13px; margin: 5px 0; }
      .footer a { color: ${FIRMAVB_COLORS.primary}; text-decoration: none; }
      .footer-brand { font-weight: 600; color: ${FIRMAVB_COLORS.text}; }
    </style>
  `;

  const headerHtml = `
    <div class="header">
      <img src="${FIRMAVB_LOGO}" alt="FirmaVB" onerror="this.style.display='none'">
  `;

  const footerHtml = `
    <div class="footer">
      <p class="footer-brand">FirmaVB - Inteligencia Comercial para Licitaciones</p>
      <p><a href="${FIRMAVB_URL}">firmavb.cl</a> | <a href="${FIRMAVB_URL}/settings">Configurar alertas</a></p>
      <p style="margin-top: 15px; font-size: 11px;">Este email fue enviado a ${empresaNombre}</p>
    </div>
  `;

  const formatCurrency = (value: number) => `$${value.toLocaleString('es-CL')}`;
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('es-CL', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  switch (tipo) {
    case 'nueva_licitacion':
      return {
        subject: `📋 Nueva licitación relevante: ${data.licitacion_titulo?.substring(0, 50) || 'Nueva oportunidad'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
                <h1>📋 Nueva Licitación</h1>
                <p>Hemos encontrado una licitación que podría interesarte</p>
              </div>
              <div class="content">
                ${data.match_score ? `
                  <div style="text-align: center; margin-bottom: 30px;">
                    <span class="score-badge">${data.match_score}% de compatibilidad</span>
                  </div>
                ` : ''}
                
                <div class="info-card">
                  <h3>${data.licitacion_titulo || 'Sin título'}</h3>
                  ${data.licitacion_codigo ? `<p><strong>Código:</strong> ${data.licitacion_codigo}</p>` : ''}
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.presupuesto ? `<p><strong>Presupuesto:</strong> ${formatCurrency(data.presupuesto)}</p>` : ''}
                  ${data.fecha_cierre ? `<p><strong>Cierra:</strong> ${formatDate(data.fecha_cierre)}</p>` : ''}
                </div>

                ${data.productos_match && data.productos_match.length > 0 ? `
                  <h3 style="color: ${FIRMAVB_COLORS.text};">Productos que coinciden:</h3>
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
                  <a href="${FIRMAVB_URL}/licitaciones/${data.licitacion_id || ''}" class="cta-button">Ver Licitación</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };

    case 'nuevo_match':
      return {
        subject: `🎯 ¡Match ${data.match_score}%! Nueva oportunidad de licitación`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
                <h1>🎯 ¡Nueva Oportunidad!</h1>
                <p>Hemos encontrado una licitación compatible con tu inventario</p>
              </div>
              <div class="content">
                <div style="text-align: center; margin-bottom: 30px;">
                  <span class="score-badge">${data.match_score}% de compatibilidad</span>
                </div>
                
                <div class="info-card">
                  <h3>${data.licitacion_titulo || 'Sin título'}</h3>
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.presupuesto ? `<p><strong>Presupuesto:</strong> ${formatCurrency(data.presupuesto)}</p>` : ''}
                  ${data.fecha_cierre ? `<p><strong>Cierre:</strong> ${formatDate(data.fecha_cierre)}</p>` : ''}
                </div>

                ${data.productos_match && data.productos_match.length > 0 ? `
                  <h3 style="color: ${FIRMAVB_COLORS.text};">Productos que coinciden:</h3>
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
                  <a href="${FIRMAVB_URL}/licitaciones/${data.licitacion_id || ''}" class="cta-button">Ver Licitación y Ofertar</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };

    case 'oferta_enviada':
      return {
        subject: `✅ Oferta enviada exitosamente - ${data.licitacion_titulo?.substring(0, 40) || 'Licitación'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml.replace('linear-gradient(135deg, ' + FIRMAVB_COLORS.primaryLight, 'linear-gradient(135deg, ' + FIRMAVB_COLORS.secondary)}
                <h1>✅ ¡Oferta Enviada!</h1>
                <p>Tu propuesta ha sido registrada exitosamente</p>
              </div>
              <div class="content">
                <div style="text-align: center; margin-bottom: 30px;">
                  <span class="success-badge">Oferta Registrada</span>
                </div>
                
                <div class="info-card" style="border-left-color: ${FIRMAVB_COLORS.secondary};">
                  <h3>Resumen de tu Oferta</h3>
                  <p><strong>Licitación:</strong> ${data.licitacion_titulo || 'Sin título'}</p>
                  ${data.licitacion_codigo ? `<p><strong>Código:</strong> ${data.licitacion_codigo}</p>` : ''}
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.monto_ofertado ? `<p><strong>Monto ofertado:</strong> ${formatCurrency(data.monto_ofertado)}</p>` : ''}
                  ${data.productos_count ? `<p><strong>Productos:</strong> ${data.productos_count} items</p>` : ''}
                </div>

                <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0; color: ${FIRMAVB_COLORS.secondaryDark}; font-weight: 500;">
                    📧 Te notificaremos cuando haya novedades sobre esta licitación
                  </p>
                </div>

                <div style="text-align: center;">
                  <a href="${FIRMAVB_URL}/ofertas/${data.oferta_id || ''}" class="cta-button" style="background: linear-gradient(135deg, ${FIRMAVB_COLORS.secondary}, ${FIRMAVB_COLORS.secondaryDark});">Ver Estado de Oferta</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };

    case 'adjudicacion':
      const isWon = data.resultado === 'ganada';
      const isDesert = data.resultado === 'desierta';
      
      return {
        subject: isWon 
          ? `🏆 ¡Felicitaciones! Ganaste la licitación ${data.licitacion_codigo || ''}` 
          : isDesert
          ? `📊 Licitación declarada desierta - ${data.licitacion_codigo || ''}`
          : `📊 Resultado de adjudicación - ${data.licitacion_codigo || ''}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml.replace('linear-gradient(135deg, ' + FIRMAVB_COLORS.primaryLight, isWon ? 'linear-gradient(135deg, ' + FIRMAVB_COLORS.secondary : 'linear-gradient(135deg, ' + FIRMAVB_COLORS.textMuted)}
                <h1>${isWon ? '🏆 ¡Felicitaciones!' : isDesert ? '📊 Licitación Desierta' : '📊 Resultado de Adjudicación'}</h1>
                <p>${isWon ? 'Has ganado esta licitación' : isDesert ? 'Esta licitación ha sido declarada desierta' : 'La licitación ha sido adjudicada'}</p>
              </div>
              <div class="content">
                <div class="${isWon ? 'result-won' : 'result-lost'}">
                  ${isWon ? '🎉 ADJUDICACIÓN A TU FAVOR' : isDesert ? 'DECLARADA DESIERTA' : 'ADJUDICADA A OTRO PROVEEDOR'}
                </div>
                
                <div class="info-card" style="border-left-color: ${isWon ? FIRMAVB_COLORS.secondary : FIRMAVB_COLORS.textMuted};">
                  <h3>${data.licitacion_titulo || 'Sin título'}</h3>
                  ${data.licitacion_codigo ? `<p><strong>Código:</strong> ${data.licitacion_codigo}</p>` : ''}
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.monto_adjudicado ? `<p><strong>Monto adjudicado:</strong> ${formatCurrency(data.monto_adjudicado)}</p>` : ''}
                  ${!isWon && !isDesert && data.proveedor_ganador ? `<p><strong>Proveedor adjudicado:</strong> ${data.proveedor_ganador}</p>` : ''}
                </div>

                ${isWon ? `
                  <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px; color: ${FIRMAVB_COLORS.secondaryDark};">🎯 Próximos pasos</h4>
                    <ul style="margin: 0; padding-left: 20px; color: ${FIRMAVB_COLORS.text};">
                      <li>Revisa la orden de compra cuando esté disponible</li>
                      <li>Prepara la documentación necesaria</li>
                      <li>Coordina la entrega según los plazos establecidos</li>
                    </ul>
                  </div>
                ` : ''}

                <div style="text-align: center;">
                  <a href="${FIRMAVB_URL}/licitaciones/${data.licitacion_id || ''}" class="cta-button">Ver Detalles</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };

    case 'recordatorio':
    case 'cierre_proximo':
      const horasRestantes = data.horas_restantes || 0;
      const diasRestantes = data.dias_restantes || Math.ceil(horasRestantes / 24);
      const esUrgente = horasRestantes <= 24;
      
      return {
        subject: esUrgente 
          ? `🚨 ¡URGENTE! Licitación cierra en ${horasRestantes}hrs - ${data.licitacion_titulo?.substring(0, 30) || ''}`
          : `⏰ Recordatorio: Licitación cierra en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml.replace('linear-gradient(135deg, ' + FIRMAVB_COLORS.primaryLight, esUrgente ? 'linear-gradient(135deg, ' + FIRMAVB_COLORS.danger : 'linear-gradient(135deg, #F59E0B')}
                <h1>${esUrgente ? '🚨 ¡Cierre Inminente!' : '⏰ Recordatorio'}</h1>
                <p>Una licitación de tu interés está por cerrar</p>
              </div>
              <div class="content">
                <div style="text-align: center; margin-bottom: 30px;">
                  <span class="${esUrgente ? 'urgent-badge' : 'warning-badge'}">
                    ${esUrgente ? `⚡ Cierra en ${horasRestantes} hora${horasRestantes > 1 ? 's' : ''}` : `📅 Cierra en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`}
                  </span>
                </div>
                
                <div class="info-card" style="border-left-color: ${esUrgente ? FIRMAVB_COLORS.danger : '#F59E0B'};">
                  <h3>${data.licitacion_titulo || 'Sin título'}</h3>
                  ${data.licitacion_codigo ? `<p><strong>Código:</strong> ${data.licitacion_codigo}</p>` : ''}
                  <p><strong>Organismo:</strong> ${data.organismo || 'No especificado'}</p>
                  ${data.presupuesto ? `<p><strong>Presupuesto:</strong> ${formatCurrency(data.presupuesto)}</p>` : ''}
                  ${data.match_score ? `<p><strong>Compatibilidad:</strong> ${data.match_score}%</p>` : ''}
                  ${data.fecha_cierre ? `<p><strong>Fecha límite:</strong> ${formatDate(data.fecha_cierre)}</p>` : ''}
                </div>

                ${data.accion_pendiente ? `
                  <div style="background: ${esUrgente ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                    <p style="margin: 0; color: ${esUrgente ? FIRMAVB_COLORS.dangerDark : '#B45309'}; font-weight: 500;">
                      📝 ${data.accion_pendiente}
                    </p>
                  </div>
                ` : ''}

                <div style="text-align: center;">
                  <a href="${FIRMAVB_URL}/licitaciones/${data.licitacion_id || ''}" class="cta-button" style="background: linear-gradient(135deg, ${esUrgente ? FIRMAVB_COLORS.danger + ', ' + FIRMAVB_COLORS.dangerDark : '#F59E0B, #D97706'});">
                    ${esUrgente ? 'Completar Oferta AHORA' : 'Ver Licitación'}
                  </a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };

    case 'resumen_diario':
      return {
        subject: '📊 Tu resumen diario de licitaciones - FirmaVB',
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              ${headerHtml}
                <h1>📊 Resumen del Día</h1>
                <p>${new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div class="content">
                ${data.resumen || '<p>No hay novedades para hoy.</p>'}
                
                <div style="text-align: center;">
                  <a href="${FIRMAVB_URL}/dashboard" class="cta-button">Ver Dashboard Completo</a>
                </div>
              </div>
              ${footerHtml}
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
              ${headerHtml}
                <h1>FirmaVB</h1>
                <p>Tienes una nueva notificación</p>
              </div>
              <div class="content">
                <div class="info-card">
                  <p>${JSON.stringify(data, null, 2)}</p>
                </div>
                <div style="text-align: center;">
                  <a href="${FIRMAVB_URL}/dashboard" class="cta-button">Ir al Dashboard</a>
                </div>
              </div>
              ${footerHtml}
            </div>
          </body>
          </html>
        `
      };
  }
}

// Send email via Resend API
async function sendViaResend(apiKey: string, to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`Sending email via Resend to: ${to}`);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FIRMAVB_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Resend API error:", response.status, responseText);
      return { success: false, error: `Resend error: ${response.status} - ${responseText}` };
    }

    const result = JSON.parse(responseText);
    console.log("Email sent via Resend:", result);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error("Resend error:", error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const token = authHeader.replace('Bearer ', '');
      const { data, error } = await supabaseClient.auth.getUser(token);
      if (!error && data?.user) {
        userId = data.user.id;
      }
    }

    const body: NotificationRequest = await req.json();
    const { cliente_id, to, tipo, data } = body;

    // Service client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    let recipientEmail = to;
    let empresaNombre = 'Usuario';

    // If cliente_id provided, get client info
    if (cliente_id) {
      const { data: clienteData, error: clienteError } = await serviceClient
        .from('clientes')
        .select('id, email, empresa_nombre, user_id')
        .eq('id', cliente_id)
        .single();

      if (clienteError || !clienteData) {
        console.error("Cliente not found:", clienteError);
        return new Response(
          JSON.stringify({ error: 'Cliente no encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      recipientEmail = recipientEmail || clienteData.email;
      empresaNombre = clienteData.empresa_nombre;

      // Check notification preferences
      const { data: prefsData } = await serviceClient
        .from('cliente_notificaciones')
        .select('*')
        .eq('cliente_id', cliente_id)
        .single();

      if (prefsData) {
        const prefs = prefsData as ClienteNotificaciones;
        
        // Check if we should send based on preferences
        if (tipo === 'nuevo_match' && prefs.alerta_nuevos_matches === false) {
          return new Response(
            JSON.stringify({ success: false, reason: 'Notification disabled by preferences' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (tipo === 'cierre_proximo' && prefs.alerta_cierre_proximo === false) {
          return new Response(
            JSON.stringify({ success: false, reason: 'Notification disabled by preferences' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (prefs.email_instantaneo === false) {
          return new Response(
            JSON.stringify({ success: false, reason: 'Email notifications disabled' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Check thresholds
        if (data.match_score && prefs.score_minimo_alerta && data.match_score < prefs.score_minimo_alerta) {
          return new Response(
            JSON.stringify({ success: false, reason: 'Match score below threshold' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (data.presupuesto && prefs.presupuesto_minimo && data.presupuesto < prefs.presupuesto_minimo) {
          return new Response(
            JSON.stringify({ success: false, reason: 'Budget below threshold' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: 'No recipient email provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email template
    const { subject, html } = getEmailTemplate(tipo, data, empresaNombre);

    // Send email
    const emailResult = await sendViaResend(resendApiKey, recipientEmail, subject, html);

    // Log notification
    if (cliente_id) {
      await serviceClient
        .from('notificaciones_log')
        .insert({
          cliente_id,
          tipo,
          licitacion_id: data.licitacion_id || null,
          email_enviado: emailResult.success,
          datos: data as any,
        });
    }

    console.log(`Notification processed:`, {
      tipo,
      to: recipientEmail,
      emailSent: emailResult.success,
      messageId: emailResult.messageId,
    });

    return new Response(
      JSON.stringify({ 
        success: emailResult.success, 
        messageId: emailResult.messageId,
        error: emailResult.error 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
