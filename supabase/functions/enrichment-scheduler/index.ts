// Scheduler para ejecutar automáticamente el enriquecimiento de contactos
// Se invoca cada 24 horas via Vercel cron o webhook externo

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

Deno.serve(async (req) => {
  // Verificar que sea una solicitud válida (de Vercel cron, webhook o API)
  const authHeader = req.headers.get('authorization')
  const expectedToken = Deno.env.get('ENRICHMENT_SCHEDULER_TOKEN')

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[Scheduler] Iniciando ciclo de enriquecimiento automático...')

    // Ejecutar contact-enrichment
    const enrichmentUrl = `${supabaseUrl}/functions/v1/contact-enrichment`
    const enrichmentResponse = await fetch(enrichmentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
    }).catch(e => {
      console.error('[Scheduler] Error calling contact-enrichment:', e)
      return null
    })

    let enrichmentData = null
    if (enrichmentResponse?.ok) {
      enrichmentData = await enrichmentResponse.json()
      console.log('[Scheduler] Enriquecimiento completado:', enrichmentData)
    }

    // Actualizar próxima sincronización esperada
    const proximaSincronizacion = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await supabase
      .from('contact_data_sources')
      .update({ proxima_sincronizacion: proximaSincronizacion.toISOString() })
      .in('nombre', ['mercadopublico', 'datos_abiertos', 'empresas_chilenas'])

    console.log('[Scheduler] Ciclo de enriquecimiento completado exitosamente')

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        enrichment: enrichmentData,
        proxima_sincronizacion: proximaSincronizacion.toISOString()
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Scheduler] Error:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
