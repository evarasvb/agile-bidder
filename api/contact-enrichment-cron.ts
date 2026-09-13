import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Esta función se ejecuta cada 24 horas via Vercel Cron
  // (0 2 * * * = 2 AM UTC todos los días)

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log(`[${new Date().toISOString()}] Iniciando sincronización de contactos...`)

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Llamar la función de enriquecimiento en Supabase
    const enrichmentUrl = `${supabaseUrl}/functions/v1/contact-enrichment`

    const enrichmentResponse = await fetch(enrichmentUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    const enrichmentData = await enrichmentResponse.json()

    console.log(`[${new Date().toISOString()}] Enriquecimiento completado:`, enrichmentData)

    // Retornar resultado
    return res.status(enrichmentResponse.ok ? 200 : 500).json({
      success: enrichmentResponse.ok,
      timestamp: new Date().toISOString(),
      message: 'Contact enrichment cron executed',
      result: enrichmentData
    })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error en cron:`, error)

    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
