import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Esta función se ejecuta cada 24 horas via Vercel Cron
  // (0 2 * * * = 2 AM UTC todos los días)
  // Ejecuta el enriquecimiento consolidado de contactos.

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET no está configurado')
      return res.status(503).json({ success: false, error: 'Cron unavailable' })
    }

    const authorization = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization

    if (authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    console.log(`[${new Date().toISOString()}] Iniciando enriquecimiento de contactos...`)

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Faltan variables internas de Supabase')
      return res.status(503).json({ success: false, error: 'Cron unavailable' })
    }

    const enrichmentResponse = await fetch(`${supabaseUrl}/functions/v1/contact-enrichment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!enrichmentResponse.ok) {
      console.error(`Enriquecimiento falló con estado ${enrichmentResponse.status}`)
      return res.status(502).json({
        success: false,
        error: 'Contact enrichment failed',
        status: enrichmentResponse.status
      })
    }

    console.log(`[${new Date().toISOString()}] Enriquecimiento completado`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error interno en cron`, error)

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}
