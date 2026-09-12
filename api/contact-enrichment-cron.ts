import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Esta función se ejecuta cada 24 horas via Vercel Cron
  // (0 2 * * * = 2 AM UTC todos los días)
  // Ejecuta en paralelo:
  // 1. Contact enrichment (contactos consolidados)
  // 2. Proveedores e instituciones (bases separadas)

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log(`[${new Date().toISOString()}] Iniciando sincronización completa de datos públicos...`)

    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    // Ejecutar en paralelo: contactos + proveedores/instituciones
    const [enrichmentResponse, proveedoresResponse] = await Promise.all([
      fetch(`${supabaseUrl}/functions/v1/contact-enrichment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }),
      fetch(`${supabaseUrl}/functions/v1/extract-proveedores-instituciones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
    ])

    const enrichmentData = await enrichmentResponse.json()
    const proveedoresData = await proveedoresResponse.json()

    console.log(`[${new Date().toISOString()}] Enriquecimiento completado:`, enrichmentData)
    console.log(`[${new Date().toISOString()}] Proveedores/Instituciones completado:`, proveedoresData)

    // Retornar resultado combinado
    const allSuccess = enrichmentResponse.ok && proveedoresResponse.ok

    return res.status(allSuccess ? 200 : 500).json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      message: 'All sync processes executed',
      results: {
        contact_enrichment: enrichmentData,
        proveedores_instituciones: proveedoresData
      }
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
