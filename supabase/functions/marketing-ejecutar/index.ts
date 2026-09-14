import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  claimEmailPiece,
  executeMarketingCampaign,
  getMarketingContactsPage,
  type AtomicClaimQuery,
  type EmailSendResult,
  type MarketingContactsTable,
  type MarketingExecutionRow,
} from "./logic.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function sendEmailViaResend(
  resendKey: string,
  input: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey: string;
  },
): Promise<EmailSendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from: "FirmaVB <notificaciones@firmavb.cl>",
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Resend rechazó el envío:", response.status);
      return {
        success: false,
        error: `Proveedor rechazó el envío (${response.status})`,
        statusCode: response.status,
      };
    }

    let messageId: string | undefined;
    try {
      const parsed = JSON.parse(responseText) as { id?: unknown };
      if (typeof parsed.id === 'string') messageId = parsed.id;
    } catch {
      console.warn('Resend aceptó el envío, pero devolvió una respuesta no JSON');
    }

    return { success: true, messageId, statusCode: response.status };
  } catch {
    console.error('No se pudo confirmar la respuesta de Resend');
    return {
      success: false,
      uncertain: true,
      error: 'No se pudo confirmar la respuesta del proveedor',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Faltan variables requeridas para marketing-ejecutar');
      return jsonResponse({ error: 'Servicio no configurado' }, 500);
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await sb.auth.getUser(token);

    if (authError || !user || user.email !== 'evaras@firmavb.cl') {
      return jsonResponse({ error: 'Unauthorized' }, 403);
    }

    const contentLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > 100_000) {
      return jsonResponse({ error: 'Solicitud demasiado grande' }, 413);
    }

    let body: unknown;
    try {
      const rawBody = await req.text();
      if (new TextEncoder().encode(rawBody).byteLength > 100_000) {
        return jsonResponse({ error: 'Solicitud demasiado grande' }, 413);
      }
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'JSON inválido' }, 400);
    }

    const outcome = await executeMarketingCampaign(body, {
      store: {
        claimPiece: (pieceId) => {
          const query = sb.from('marketing_piezas') as unknown as AtomicClaimQuery;
          return claimEmailPiece(query, pieceId);
        },
        releasePieceClaim: async (pieceId) => {
          const { data, error } = await sb
            .from('marketing_piezas')
            .update({ estado: 'draft' })
            .eq('id', pieceId)
            .eq('estado', 'ejecutando')
            .select('id')
            .maybeSingle();

          if (error) console.error('No se pudo liberar la pieza:', error.code);
          return !error && Boolean(data);
        },
        getContactsPage: (filters) => {
          const table = sb.from('marketing_contactos') as unknown as MarketingContactsTable;
          return getMarketingContactsPage(table, filters);
        },
        persistExecutions: async (rows: MarketingExecutionRow[]) => {
          const { error } = await sb.from('marketing_ejecucion').insert(rows);
          if (error) {
            console.error('No se pudieron registrar resultados:', error.code);
            throw new Error('execution_persistence_failed');
          }
        },
        markPieceExecuted: async (pieceId) => {
          const { data, error } = await sb
            .from('marketing_piezas')
            .update({ estado: 'ejecutado' })
            .eq('id', pieceId)
            .eq('estado', 'ejecutando')
            .select('id')
            .maybeSingle();

          if (error || !data) {
            console.error('No se pudo cerrar la pieza:', error?.code || 'no_row');
            throw new Error('piece_finalize_failed');
          }
        },
        markCampaignExecuting: async (campaignId, updatedAt) => {
          const { error } = await sb
            .from('marketing_campanas')
            .update({ estado: 'ejecutando', actualizado_en: updatedAt })
            .eq('id', campaignId);

          if (error) {
            console.error('No se pudo actualizar la campaña:', error.code);
            throw new Error('campaign_update_failed');
          }
        },
        calculateMetrics: async (campaignId, date) => {
          const { error } = await sb.rpc('marketing_calcular_metricas', {
            campana_id_in: campaignId,
            fecha_in: date,
          });

          if (error) {
            console.error('No se pudieron calcular métricas:', error.code);
            throw new Error('metrics_calculation_failed');
          }
        },
      },
      sendEmail: (input) => sendEmailViaResend(resendApiKey, input),
    });

    if ('total_procesados' in outcome.body) {
      console.log(
        `Ejecución procesada: ${outcome.body.total_enviados}/${outcome.body.total_objetivo} confirmados`,
      );
    }

    return jsonResponse(outcome.body, outcome.status);
  } catch {
    console.error('Error inesperado en marketing-ejecutar');
    return jsonResponse({ error: 'Error interno' }, 500);
  }
});
