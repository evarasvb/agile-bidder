import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Secure credentials from environment
const ODOO_URL = Deno.env.get("ODOO_URL") || '';
const ODOO_DB = Deno.env.get("ODOO_DB") || '';
const ODOO_UID = Deno.env.get("ODOO_UID") || '';
const ODOO_PASSWORD = Deno.env.get("ODOO_PASSWORD") || '';

interface OdooJsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: {
      name: string;
      debug: string;
      message: string;
    };
  };
}

// Verify authentication
async function verifyAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { userId: data.user.id };
}

const generateRequestId = (): number => Math.floor(Math.random() * 1000000);

async function jsonRpcCall<T>(
  endpoint: string,
  params: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params,
      id: generateRequestId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data: OdooJsonRpcResponse<T> = await response.json();

  if (data.error) {
    throw new Error(
      `Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`
    );
  }

  return data.result as T;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authentication
  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { userId } = authResult;
  console.log(`Authenticated user: ${userId}`);

  try {
    const { action } = await req.json();

    // Check if Odoo is configured
    if (!ODOO_URL || !ODOO_DB || !ODOO_UID || !ODOO_PASSWORD) {
      console.log('Odoo credentials not configured');
      return new Response(
        JSON.stringify({ 
          opportunities: [],
          message: 'Odoo not configured - using mock data on client'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'fetch_opportunities') {
      const result = await jsonRpcCall<any[]>('/jsonrpc', {
        service: 'object',
        method: 'execute_kw',
        args: [
          ODOO_DB,
          parseInt(ODOO_UID, 10),
          ODOO_PASSWORD,
          'crm.lead',
          'search_read',
          [[['tag_ids', 'ilike', 'Compra Ágil']]],
          {
            fields: [
              'name',
              'expected_revenue',
              'x_organismo',
              'x_licitacion_id',
              'x_url_licitacion',
              'create_date',
            ],
            limit: 20,
            order: 'create_date desc',
          },
        ],
      });

      return new Response(
        JSON.stringify({ opportunities: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Odoo proxy error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        opportunities: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
