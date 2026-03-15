import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action') || 'status';

    // =========================================================
    // UPDATE: Record a sync event
    // =========================================================
    if (action === 'update') {
      const { error } = await supabase
        .from('sync_status')
        .upsert({
          sync_type: body.sync_type || 'mercadopublico',
          last_sync_at: body.timestamp || new Date().toISOString(),
          fecha_consulta: body.fecha_consulta || null,
          licitaciones_status: body.licitaciones_status || null,
          licitaciones_synced: body.licitaciones_synced || 0,
          ordenes_status: body.ordenes_status || null,
          ordenes_synced: body.ordenes_synced || 0,
          run_id: body.run_id || null,
          run_url: body.run_url || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sync_type' });

      if (error) {
        console.error('Error updating sync status:', error);
        // Table might not exist yet — that's ok, log and return success
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Sync status updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================
    // ALERT: Record a failure alert
    // =========================================================
    if (action === 'alert') {
      const { error } = await supabase
        .from('sync_status')
        .upsert({
          sync_type: body.sync_type || 'mercadopublico',
          last_failure_at: new Date().toISOString(),
          last_failure_message: body.message || 'Unknown failure',
          run_id: body.run_id || null,
          run_url: body.run_url || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sync_type' });

      if (error) {
        console.error('Error recording alert:', error);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Alert recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =========================================================
    // STATUS: Health check — reports if sync is stale (>10 hours)
    // =========================================================
    const { data: statuses, error } = await supabase
      .from('sync_status')
      .select('*');

    if (error) {
      // Table may not exist — return degraded status
      return new Response(
        JSON.stringify({
          healthy: false,
          message: 'sync_status table not available',
          error: error.message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
    const now = Date.now();

    const results = (statuses || []).map((s: any) => {
      const lastSync = s.last_sync_at ? new Date(s.last_sync_at).getTime() : 0;
      const hoursSinceSync = lastSync ? (now - lastSync) / (60 * 60 * 1000) : null;
      const isStale = !lastSync || (now - lastSync) > TEN_HOURS_MS;

      return {
        sync_type: s.sync_type,
        last_sync_at: s.last_sync_at,
        hours_since_sync: hoursSinceSync ? Math.round(hoursSinceSync * 10) / 10 : null,
        is_stale: isStale,
        licitaciones_status: s.licitaciones_status,
        licitaciones_synced: s.licitaciones_synced,
        ordenes_status: s.ordenes_status,
        ordenes_synced: s.ordenes_synced,
        last_failure_at: s.last_failure_at,
        last_failure_message: s.last_failure_message,
        run_url: s.run_url,
      };
    });

    const healthy = results.length > 0 && results.every((r: any) => !r.is_stale);

    return new Response(
      JSON.stringify({
        healthy,
        checked_at: new Date().toISOString(),
        syncs: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-health:', error);
    return new Response(
      JSON.stringify({
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
