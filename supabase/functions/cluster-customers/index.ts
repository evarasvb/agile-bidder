import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClusteringResult {
  clientes_procesados: number
  clusters_generados: number
  tiempo_segundos: number
  errores: string[]
}

// Caracteriación basada en historial de compras
async function caracterizarCliente(supabase: any, rut: string): Promise<any> {
  try {
    // Obtener histórico de compras como proveedor
    const { data: comprasProveedor, error: errorProv } = await supabase
      .from('ordenes_compra')
      .select('monto_orden, fecha_orden, rubro_compra, institucion_nombre, cantidad_items')
      .eq('proveedor_rut', rut)
      .limit(100)

    // Obtener histórico de compras como institución
    const { data: comprasInstitucion, error: errorInst } = await supabase
      .from('ordenes_compra')
      .select('monto_orden, fecha_orden, rubro_compra, proveedor_nombre, cantidad_items')
      .eq('institucion_rut', rut)
      .limit(100)

    const allCompras = [...(comprasProveedor || []), ...(comprasInstitucion || [])]

    if (allCompras.length === 0) return null

    // Calcular características
    const montos = allCompras.map(c => c.monto_orden || 0).filter(m => m > 0)
    const rubros = [...new Set(allCompras.map(c => c.rubro_compra).filter(Boolean))]
    const cantidadCompras = allCompras.length
    const montoPromedio = montos.length > 0 ? montos.reduce((a, b) => a + b, 0) / montos.length : 0
    const montoTotal = montos.reduce((a, b) => a + b, 0)

    // Determinar nivel de actividad
    let nivelActividad = 'bajo'
    if (cantidadCompras >= 50) nivelActividad = 'muy_alto'
    else if (cantidadCompras >= 20) nivelActividad = 'alto'
    else if (cantidadCompras >= 5) nivelActividad = 'medio'

    // Determinar tamaño basado en montos
    let tamanio = 'pequeño'
    if (montoTotal > 100000000) tamanio = 'grande'
    else if (montoTotal > 20000000) tamanio = 'mediano'

    return {
      cantidadCompras,
      montoTotal,
      montoPromedio,
      rubros: rubros.slice(0, 5),
      nivelActividad,
      tamanio,
      customerType: comprasProveedor?.length > 0 ? 'proveedor' : 'institucion'
    }
  } catch (error) {
    console.error(`Error caracterizando cliente ${rut}:`, error)
    return null
  }
}

// Agrupar clientes en clusters basado en características
function asignarCluster(caracteristicas: any): { clusterId: number; clusterName: string } {
  const { nivelActividad, tamanio, rubros, montoTotal, customerType } = caracteristicas

  // Lógica simple de clustering basada en patrones
  if (customerType === 'institucion') {
    if (nivelActividad === 'muy_alto') return { clusterId: 1, clusterName: 'Instituciones Activas - Gran Comprador' }
    if (nivelActividad === 'alto') return { clusterId: 2, clusterName: 'Instituciones Activas - Comprador Medio' }
    return { clusterId: 3, clusterName: 'Instituciones Ocasionales' }
  } else {
    if (tamanio === 'grande' && nivelActividad === 'muy_alto') return { clusterId: 4, clusterName: 'Proveedores Premium - Especialistas' }
    if (tamanio === 'mediano' && nivelActividad === 'alto') return { clusterId: 5, clusterName: 'Proveedores Consolidados' }
    if (nivelActividad === 'medio') return { clusterId: 6, clusterName: 'Proveedores Emergentes' }
    return { clusterId: 7, clusterName: 'Proveedores Nuevos/Ocasionales' }
  }
}

// Generar descripción de AI usando Anthropic
async function generarPerfilIA(supabase: any, rut: string, caracteristicas: any, clusterName: string): Promise<string> {
  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return `${clusterName}: Cliente con ${caracteristicas.cantidadCompras} compras. Rubros: ${caracteristicas.rubros.join(', ')}.`
    }

    const prompt = `Genera un perfil profesional breve (máx 2 líneas) de un cliente ${caracteristicas.customerType} de MercadoPublico con estas características:
- Número de compras: ${caracteristicas.cantidadCompras}
- Monto total: $${(caracteristicas.montoTotal / 1000000).toFixed(1)}M
- Monto promedio por orden: $${(caracteristicas.montoPromedio / 1000000).toFixed(1)}M
- Rubros principales: ${caracteristicas.rubros.join(', ')}
- Nivel de actividad: ${caracteristicas.nivelActividad}
- Cluster: ${clusterName}

Describe el perfil de compra y recomendaciones de oferta personalizada.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const result = await response.json()
    if (result.content?.[0]?.text) {
      return result.content[0].text.trim()
    }
  } catch (error) {
    console.error('Error generando perfil IA:', error)
  }

  return `${clusterName}: Cliente con ${caracteristicas.cantidadCompras} compras. Rubros: ${caracteristicas.rubros.join(', ')}.`
}

// Registrar en log de clustering
async function registrarClusteringLog(
  supabase: any,
  procesados: number,
  clusters: number,
  tiempo: number,
  errores: string[]
) {
  const status = errores.length === 0 ? 'success' : errores.length < procesados ? 'partial' : 'error'

  await supabase.from('clustering_log').insert({
    clientes_procesados: procesados,
    clusters_generados: clusters,
    tiempo_segundos: tiempo,
    status: status,
    detalles: { errores: errores },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const inicio = Date.now()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Supabase credentials' }),
      { status: 500, headers: corsHeaders }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log('[CLUSTERING] Iniciando análisis de clustering de clientes...')

    // Obtener todos los RUT únicos (proveedores + instituciones)
    const { data: proveedores, error: errProv } = await supabase
      .from('ordenes_compra')
      .select('proveedor_rut')
      .not('proveedor_rut', 'is', null)

    const { data: instituciones, error: errInst } = await supabase
      .from('ordenes_compra')
      .select('institucion_rut')
      .not('institucion_rut', 'is', null)

    const rutsProv = [...new Set((proveedores || []).map(p => p.proveedor_rut))].filter(Boolean)
    const rutsInst = [...new Set((instituciones || []).map(i => i.institucion_rut))].filter(Boolean)
    const todosRuts = [...rutsProv, ...rutsInst]

    let procesados = 0
    let clustersMap = new Map()
    const errores: string[] = []

    // Procesar cada cliente
    for (const rut of todosRuts.slice(0, 5000)) {
      try {
        const caracteristicas = await caracterizarCliente(supabase, rut)
        if (!caracteristicas) continue

        const { clusterId, clusterName } = asignarCluster(caracteristicas)
        const aiProfile = await generarPerfilIA(supabase, rut, caracteristicas, clusterName)

        procesados++

        // Obtener nombre del cliente
        let customerName = ''
        if (caracteristicas.customerType === 'proveedor') {
          const { data } = await supabase
            .from('ordenes_compra')
            .select('proveedor_nombre')
            .eq('proveedor_rut', rut)
            .limit(1)
          customerName = data?.[0]?.proveedor_nombre || rut
        } else {
          const { data } = await supabase
            .from('ordenes_compra')
            .select('institucion_nombre')
            .eq('institucion_rut', rut)
            .limit(1)
          customerName = data?.[0]?.institucion_nombre || rut
        }

        // Upsert en customer_clusters
        await supabase.from('customer_clusters').upsert(
          {
            cluster_id: clusterId,
            cluster_name: clusterName,
            customer_rut: rut,
            customer_type: caracteristicas.customerType,
            customer_name: customerName,
            characteristics: caracteristicas,
            purchase_history: {
              total_orders: caracteristicas.cantidadCompras,
              total_value: caracteristicas.montoTotal,
              avg_value: caracteristicas.montoPromedio,
              categories: caracteristicas.rubros,
            },
            ai_profile: aiProfile,
            ultima_actualizacion: new Date().toISOString(),
          },
          { onConflict: 'customer_rut,cluster_id' }
        )

        clustersMap.set(clusterId, clusterName)
      } catch (error) {
        errores.push(`Error procesando cliente ${rut}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Actualizar metadata de clusters
    for (const [clusterId, clusterName] of clustersMap) {
      const { data: clientesCluster } = await supabase
        .from('customer_clusters')
        .select('purchase_history')
        .eq('cluster_id', clusterId)

      const countClientes = clientesCluster?.length || 0
      const avgValue = clientesCluster?.reduce((sum: number, c: any) => sum + (c.purchase_history?.avg_value || 0), 0) / countClientes

      await supabase.from('cluster_metadata').upsert(
        {
          cluster_id: clusterId,
          cluster_name: clusterName,
          customer_count: countClientes,
          avg_purchase_value: avgValue,
          recommended_messaging: `Contactar ${clusterName} con ofertas personalizadas basadas en su historial.`,
          ultima_actualizacion: new Date().toISOString(),
        },
        { onConflict: 'cluster_id' }
      )
    }

    const tiempoTotal = Math.floor((Date.now() - inicio) / 1000)
    await registrarClusteringLog(supabase, procesados, clustersMap.size, tiempoTotal, errores)

    console.log('[COMPLETADO]', {
      clientes_procesados: procesados,
      clusters_generados: clustersMap.size,
      tiempo_segundos: tiempoTotal,
      errores: errores.length,
    })

    return new Response(
      JSON.stringify({
        success: true,
        clientes_procesados: procesados,
        clusters_generados: clustersMap.size,
        tiempo_segundos: tiempoTotal,
        errores: errores,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[ERROR]', error)
    const tiempoTotal = Math.floor((Date.now() - inicio) / 1000)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tiempo_segundos: tiempoTotal,
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
