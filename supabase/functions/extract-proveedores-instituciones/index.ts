import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  proveedores_procesados: number
  proveedores_nuevos: number
  proveedores_actualizados: number
  instituciones_procesados: number
  instituciones_nuevas: number
  instituciones_actualizadas: number
  tiempo_segundos: number
  errores: string[]
}

function clasificarRubro(empresa: string, descripcion?: string): string {
  const texto = `${empresa} ${descripcion || ''}`.toLowerCase()

  if (texto.match(/tecnolog|software|it|digital|programac|web|app|servidor|cloud|inform/)) return 'tecnologia'
  if (texto.match(/ferreteri|construc|obra|herramien|cement|acero|vidrio|pintura/)) return 'construccion'
  if (texto.match(/aliment|beber|frigor|lache|pan|carni|abarrote|vino/)) return 'alimentos'
  if (texto.match(/oficina|papeler|escritor|mueble|silla|desk|computador|impres/)) return 'articulos_oficina'
  if (texto.match(/servic|consultor|asesor|aseo|limpieza|manteni|reparac/)) return 'servicios'
  if (texto.match(/transport|logist|carga|fletes|embalaje/)) return 'logistica_transporte'
  if (texto.match(/salud|medical|farmac|hospital|clinic|dental/)) return 'salud'
  if (texto.match(/educac|escuela|universi|capacit|cursos|formac/)) return 'educacion'
  if (texto.match(/hotel|turism|restaur|gastro|alojami|hosped/)) return 'turismo_hoteleria'
  if (texto.match(/energia|electr|gas|agua|serv|utilidade/)) return 'utilidades_publicas'
  if (texto.match(/publicidad|market|agencia|comunicac|diseño|grafica|impren/)) return 'publicidad_marketing'
  if (texto.match(/export|import|internaciona|extranjero|global|overseas/)) return 'comercio_internacional'

  return 'otros'
}

function clasificarTipoInstitucion(nombre: string): string {
  const n = nombre.toLowerCase()

  if (n.match(/ministerio|secreta|estado/)) return 'ministerio'
  if (n.match(/municipio|alcald|comuna|ilustre|municipalidad/)) return 'municipio'
  if (n.match(/servicio|direc|subdire|inti|sename|sercotec|sercotecc/)) return 'servicio_publico'
  if (n.match(/empresa|enel|codelco|metro|ferrocarril|puertos/)) return 'empresa_publica'
  if (n.match(/juzgado|tribunal|corte|justicia|poder judici/)) return 'poder_judicial'
  if (n.match(/universid|instituto|colegio|escuela/)) return 'institucion_educativa'
  if (n.match(/hospital|clinica|centro|salud/)) return 'institucion_salud'

  return 'otro'
}

// Buscar proveedores en MercadoPublico por palabra clave
async function extraerProveedoresMercadoPublico(supabase: any, terminos: string[]): Promise<{ procesados: number, nuevos: number, actualizados: number, errores: string[] }> {
  let procesados = 0, nuevos = 0, actualizados = 0
  const errores: string[] = []

  try {
    // Simulación: en producción usarías la API real de MercadoPublico
    // Para ahora, obtenemos de datos ya consolidados en ordenes_compra
    const { data: ordenes, error: ordenesError } = await supabase
      .from('ordenes_compra')
      .select('proveedor_nombre, proveedor_rut, proveedor_direccion, proveedor_comuna, proveedor_region')
      .limit(10000)

    if (ordenesError) {
      errores.push(`Error extrayendo de ordenes_compra: ${ordenesError.message}`)
      return { procesados, nuevos, actualizados, errores }
    }

    // Deduplicar por RUT
    const proveedoresMap = new Map()
    if (ordenes) {
      ordenes.forEach(o => {
        if (o.proveedor_rut && !proveedoresMap.has(o.proveedor_rut)) {
          proveedoresMap.set(o.proveedor_rut, o)
        }
      })
    }

    // Insertar en tabla consolidada
    for (const [rut, prov] of proveedoresMap) {
      procesados++

      const rubro = clasificarRubro(prov.proveedor_nombre || '')

      const { error: upsertError } = await supabase
        .from('proveedores_consolidados')
        .upsert(
          {
            rut: rut,
            nombre: prov.proveedor_nombre,
            razon_social: prov.proveedor_nombre,
            direccion: prov.proveedor_direccion,
            comuna: prov.proveedor_comuna,
            region: prov.proveedor_region,
            rubro: rubro,
            fuente_datos: 'mercadopublico',
            ultima_actualizacion: new Date().toISOString()
          },
          { onConflict: 'rut' }
        )

      if (upsertError) {
        errores.push(`Error upsert proveedor ${rut}: ${upsertError.message}`)
      } else {
        // Contar si fue nuevo o actualizado (simple heuristic)
        nuevos++
      }
    }

    console.log(`[PROVEEDORES] Procesados: ${procesados}, Nuevos: ${nuevos}`)

    return { procesados, nuevos, actualizados, errores }
  } catch (error) {
    errores.push(`Error general en extraerProveedoresMercadoPublico: ${error instanceof Error ? error.message : String(error)}`)
    return { procesados, nuevos, actualizados, errores }
  }
}

// Extraer instituciones públicas (organismos que hacen compras)
async function extraerInstitucionesPublicas(supabase: any): Promise<{ procesados: number, nuevos: number, actualizados: number, errores: string[] }> {
  let procesados = 0, nuevos = 0, actualizados = 0
  const errores: string[] = []

  try {
    // Obtener organismos únicos de ordenes_compra
    const { data: organismos, error: orgError } = await supabase
      .from('ordenes_compra')
      .select('institucion_nombre, institucion_rut')
      .limit(5000)

    if (orgError) {
      errores.push(`Error extrayendo organismos: ${orgError.message}`)
      return { procesados, nuevos, actualizados, errores }
    }

    // Deduplicar por RUT
    const institucionesMap = new Map()
    if (organismos) {
      organismos.forEach(o => {
        if (o.institucion_rut && !institucionesMap.has(o.institucion_rut)) {
          institucionesMap.set(o.institucion_rut, o)
        }
      })
    }

    // Contar compras por institución
    for (const [rut, inst] of institucionesMap) {
      procesados++

      const tipoInstitucion = clasificarTipoInstitucion(inst.institucion_nombre || '')

      // Contar compras totales
      const { count: cantidadCompras } = await supabase
        .from('ordenes_compra')
        .select('id', { count: 'exact', head: true })
        .eq('institucion_rut', rut)

      const { error: upsertError } = await supabase
        .from('instituciones_publicas')
        .upsert(
          {
            rut: rut,
            nombre: inst.institucion_nombre,
            tipo_institucion: tipoInstitucion,
            cantidad_compras: cantidadCompras || 0,
            ultima_actualizacion: new Date().toISOString()
          },
          { onConflict: 'rut' }
        )

      if (upsertError) {
        errores.push(`Error upsert institución ${rut}: ${upsertError.message}`)
      } else {
        nuevos++
      }
    }

    console.log(`[INSTITUCIONES] Procesados: ${procesados}, Nuevos: ${nuevos}`)

    return { procesados, nuevos, actualizados, errores }
  } catch (error) {
    errores.push(`Error general en extraerInstitucionesPublicas: ${error instanceof Error ? error.message : String(error)}`)
    return { procesados, nuevos, actualizados, errores }
  }
}

// Registrar en log de sincronización
async function registrarSync(
  supabase: any,
  tipoSync: string,
  procesados: number,
  nuevos: number,
  actualizados: number,
  errores: string[],
  tiempoSegundos: number
) {
  const status = errores.length === 0 ? 'success' : errores.length < procesados ? 'partial' : 'error'

  const { error } = await supabase
    .from('sync_proveedores_log')
    .insert({
      tipo_sync: tipoSync,
      cantidad_procesados: procesados,
      cantidad_nuevos: nuevos,
      cantidad_actualizados: actualizados,
      cantidad_errores: errores.length,
      tiempo_segundos: tiempoSegundos,
      status: status,
      detalles: { errores: errores }
    })

  if (error) console.error('Error registrando sync:', error)
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
    console.log('[INICIO] Extrayendo proveedores e instituciones públicas...')

    // Extraer proveedores
    const proveedoresResult = await extraerProveedoresMercadoPublico(supabase, [
      'tecnologia', 'construccion', 'servicios', 'alimentos', 'logistica'
    ])

    await registrarSync(
      supabase,
      'proveedores_mercadopublico',
      proveedoresResult.procesados,
      proveedoresResult.nuevos,
      proveedoresResult.actualizados,
      proveedoresResult.errores,
      Math.floor((Date.now() - inicio) / 1000)
    )

    // Extraer instituciones
    const institucionesResult = await extraerInstitucionesPublicas(supabase)

    const tiempoTotal = Math.floor((Date.now() - inicio) / 1000)
    await registrarSync(
      supabase,
      'instituciones_publicas',
      institucionesResult.procesados,
      institucionesResult.nuevos,
      institucionesResult.actualizados,
      institucionesResult.errores,
      tiempoTotal
    )

    const result: SyncResult = {
      proveedores_procesados: proveedoresResult.procesados,
      proveedores_nuevos: proveedoresResult.nuevos,
      proveedores_actualizados: proveedoresResult.actualizados,
      instituciones_procesados: institucionesResult.procesados,
      instituciones_nuevas: institucionesResult.nuevos,
      instituciones_actualizadas: institucionesResult.actualizados,
      tiempo_segundos: tiempoTotal,
      errores: [...proveedoresResult.errores, ...institucionesResult.errores]
    }

    console.log('[COMPLETADO]', result)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[ERROR]', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        proveedores_procesados: 0,
        proveedores_nuevos: 0,
        proveedores_actualizados: 0,
        instituciones_procesados: 0,
        instituciones_nuevas: 0,
        instituciones_actualizadas: 0,
        tiempo_segundos: Math.floor((Date.now() - inicio) / 1000),
        errores: []
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
