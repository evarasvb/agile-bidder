// Lici-Brain Module: Odoo Connector
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ODOO_URL = Deno.env.get("ODOO_URL")!;
const ODOO_DB = Deno.env.get("ODOO_DB")!;
const ODOO_USER_ID = Deno.env.get("ODOO_USER_ID")!;
const ODOO_PASSWORD = Deno.env.get("ODOO_PASSWORD")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;

serve(async (req) => {
  try {
    const { record } = await req.json();

    // 1. Lead para Odoo CRM
    const leadData = {
      name: `[${record.id_licitacion}] ${record.titulo}`,
      partner_name: record.organismo,
      contact_name: record.departamento || "Adquisiciones",
      expected_revenue: record.presupuesto || 0,
      description: `
        📢 <b>Nueva Oportunidad Detectada por FIRMINVB</b><br/>
        🔗 <b>Link:</b> ${record.link_oficial}<br/>
        📅 <b>Cierre:</b> ${record.fecha_cierre}<br/>
        📍 <b>Región:</b> ${record.region || "Nacional"}
      `,
      priority: '2',
      tag_ids: [[6, false, [1]]],
      type: 'opportunity'
    };

    // 2. Crear Lead en Odoo via JSON-RPC
    const odooResponse = await fetch(`${ODOO_URL}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          service: "object",
          method: "execute_kw",
          args: [
            ODOO_DB,
            parseInt(ODOO_USER_ID),
            ODOO_PASSWORD,
            "crm.lead",
            "create",
            [leadData]
          ],
        },
        id: Math.floor(Math.random() * 1000000),
      }),
    });

    const odooResult = await odooResponse.json();

    if (odooResult.error) {
      throw new Error(`Odoo Error: ${JSON.stringify(odooResult.error)}`);
    }

    console.log("✅ Lead creado en Odoo ID:", odooResult.result);

    // 3. Enviar notificación email via SendGrid
    const emailResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: "evaras@firmavb.cl" }],
          subject: `🔥 MATCH: ${record.titulo} ($${record.presupuesto})`
        }],
        from: { email: "alertas@firmavb.cl" },
        content: [{
          type: "text/html",
          value: `
            <h3>¡Nueva Oportunidad Detectada!</h3>
            <p>El sistema Lici-Brain ha encontrado un match de alta viabilidad.</p>
            <ul>
              <li><b>Organismo:</b> ${record.organismo}</li>
              <li><b>Monto:</b> $${record.presupuesto}</li>
              <li><b>Cierre:</b> ${record.fecha_cierre}</li>
            </ul>
            <a href="${record.link_oficial}" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Ver en MercadoPúblico</a>
          `
        }]
      })
    });

    if (!emailResponse.ok) {
      console.error("Error enviando email:", await emailResponse.text());
    } else {
      console.log("📧 Email enviado correctamente");
    }

    return new Response(JSON.stringify({ success: true, odoo_id: odooResult.result }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Error conectando a Odoo:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
