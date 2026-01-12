import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface ApiKeyData {
  id: string;
  cliente_id: string;
  activa: boolean;
}

interface ClienteData {
  id: string;
  empresa_nombre: string;
  categoria_negocio: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    // Validate API key for all actions except 'verify'
    let clienteId: string | null = null;
    let apiKeyId: string | null = null;

    if (apiKey) {
      const { data: keyData, error: keyError } = await supabase
        .from('extension_api_keys')
        .select('id, cliente_id, activa')
        .eq('api_key', apiKey)
        .single();

      if (keyError || !keyData) {
        return new Response(
          JSON.stringify({ error: 'API key inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!keyData.activa) {
        return new Response(
          JSON.stringify({ error: 'API key desactivada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      clienteId = keyData.cliente_id;
      apiKeyId = keyData.id;

      // Update last_used
      await supabase
        .from('extension_api_keys')
        .update({ last_used: new Date().toISOString() })
        .eq('id', keyData.id);
    }

    // Route by action
    switch (action) {
      case 'verify': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get client info
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, empresa_nombre, categoria_negocio')
          .eq('id', clienteId)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            cliente: {
              id: cliente?.id,
              empresa: cliente?.empresa_nombre,
              categoria: cliente?.categoria_negocio
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-matches': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitaciones with matches for this client
        const { data: ofertas, error: ofertasError } = await supabase
          .from('cliente_ofertas')
          .select(`
            id,
            licitacion_id,
            match_score,
            estado,
            valor_total,
            created_at
          `)
          .eq('cliente_id', clienteId)
          .in('estado', ['pendiente', 'borrador'])
          .order('match_score', { ascending: false });

        if (ofertasError) {
          console.error('Error fetching ofertas:', ofertasError);
          return new Response(
            JSON.stringify({ error: 'Error obteniendo matches' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitacion details for each oferta
        const licitacionIds = ofertas?.map(o => o.licitacion_id) || [];
        
        const { data: licitaciones } = await supabase
          .from('licitaciones')
          .select('id_licitacion, titulo, organismo, presupuesto, fecha_cierre, link_oficial')
          .in('id_licitacion', licitacionIds);

        // Combine data
        const matches = ofertas?.map(oferta => {
          const licitacion = licitaciones?.find(l => l.id_licitacion === oferta.licitacion_id);
          return {
            oferta_id: oferta.id,
            licitacion_id: oferta.licitacion_id,
            match_score: oferta.match_score,
            estado: oferta.estado,
            valor_total: oferta.valor_total,
            titulo: licitacion?.titulo,
            organismo: licitacion?.organismo,
            presupuesto: licitacion?.presupuesto,
            fecha_cierre: licitacion?.fecha_cierre,
            link_oficial: licitacion?.link_oficial
          };
        }) || [];

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'get-matches', null, null, {
          count: matches.length
        }, req);

        return new Response(
          JSON.stringify({ success: true, matches }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-offer': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { oferta_id, licitacion_id } = body;

        if (!oferta_id && !licitacion_id) {
          return new Response(
            JSON.stringify({ error: 'oferta_id o licitacion_id requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get oferta
        let query = supabase
          .from('cliente_ofertas')
          .select('*')
          .eq('cliente_id', clienteId);

        if (oferta_id) {
          query = query.eq('id', oferta_id);
        } else {
          query = query.eq('licitacion_id', licitacion_id);
        }

        const { data: oferta, error: ofertaError } = await query.single();

        if (ofertaError || !oferta) {
          return new Response(
            JSON.stringify({ error: 'Oferta no encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitacion details
        const { data: licitacion } = await supabase
          .from('licitaciones')
          .select('*')
          .eq('id_licitacion', oferta.licitacion_id)
          .single();

        // Get licitacion items
        const { data: items } = await supabase
          .from('licitacion_items')
          .select('*')
          .eq('licitacion_id', oferta.licitacion_id);

        // Format for Chrome extension auto-fill
        const ofertaFormateada = {
          oferta_id: oferta.id,
          licitacion_id: oferta.licitacion_id,
          nombre_oferta: `Oferta ${oferta.licitacion_id} - FirmaVB`,
          productos: oferta.productos_ofertados,
          items_licitacion: items,
          valor_total: oferta.valor_total,
          margen_total: oferta.margen_total,
          observaciones: oferta.notas || 'Oferta generada con FirmaVB Postulador',
          licitacion: {
            titulo: licitacion?.titulo,
            organismo: licitacion?.organismo,
            presupuesto: licitacion?.presupuesto,
            fecha_cierre: licitacion?.fecha_cierre
          }
        };

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'get-offer', oferta.licitacion_id, oferta.id, {
          valor_total: oferta.valor_total
        }, req);

        return new Response(
          JSON.stringify({ success: true, oferta: ofertaFormateada }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'submit-result': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { oferta_id, success, numero_oferta_mp, mensaje, error_detalle } = body;

        if (!oferta_id) {
          return new Response(
            JSON.stringify({ error: 'oferta_id requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify oferta belongs to client
        const { data: oferta } = await supabase
          .from('cliente_ofertas')
          .select('id, cliente_id, licitacion_id')
          .eq('id', oferta_id)
          .eq('cliente_id', clienteId)
          .single();

        if (!oferta) {
          return new Response(
            JSON.stringify({ error: 'Oferta no encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update oferta status
        const nuevoEstado = success ? 'enviada' : 'error';
        const notas = success 
          ? `Enviada via extensión. Número MP: ${numero_oferta_mp || 'N/A'}`
          : `Error al enviar: ${error_detalle || mensaje || 'Error desconocido'}`;

        await supabase
          .from('cliente_ofertas')
          .update({ 
            estado: nuevoEstado,
            notas: notas,
            updated_at: new Date().toISOString()
          })
          .eq('id', oferta_id);

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'submit-result', oferta.licitacion_id, oferta_id, {
          success,
          numero_oferta_mp,
          mensaje,
          error_detalle
        }, req);

        return new Response(
          JSON.stringify({ success: true, estado: nuevoEstado }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida. Acciones: verify, get-matches, get-offer, submit-result' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Extension API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logActivity(
  supabase: any,
  apiKeyId: string | null,
  clienteId: string,
  action: string,
  licitacionId: string | null,
  ofertaId: string | null,
  detalles: Record<string, any>,
  req: Request
) {
  try {
    await supabase.from('extension_activity_log').insert({
      api_key_id: apiKeyId,
      cliente_id: clienteId,
      action,
      licitacion_id: licitacionId,
      oferta_id: ofertaId,
      detalles,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
