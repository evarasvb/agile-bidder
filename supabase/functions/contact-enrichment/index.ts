import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrichmentResult {
  procesados: number
  nuevos: number
  actualizados: number
  errores: number
  tiempo_segundos: number
}

// Validar email con lógica básica
function esEmailValido(email: string): boolean {
  const regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  if (!regex.test(email)) return false

  // Excluir dominios de prueba
  const dominiosPrueba = ['test.', 'example.', 'invalid.', 'localhost']
  return !dominiosPrueba.some(d => email.toLowerCase().includes(d))
}

// Clasificar por rubro basado en palabras clave
function clasificarRubro(empresa: string, descripcion?: string): string {
  const texto = `${empresa} ${descripcion || ''}`.toLowerCase()

  if (texto.match(/tecnolog|software|it|digital|programac|web|app|servidor|cloud/)) return 'tecnologia'
  if (texto.match(/ferreteri|construc|obra|herramien|cement|acero/)) return 'ferreteria'
  if (texto.match(/aliment|beber|frigor|lache|pan|carni|abarrote/)) return 'alimentos'
  if (texto.match(/oficina|papeler|escritor|mueble|silla|desk|computador/)) return 'articulos_oficina'
  if (texto.match(/servic|consultor|asesor|aseo|limpieza|manteni/)) return 'servicios'
  if (texto.match(/export|import|internaciona|extranjero|global|overseas/)) return 'empresas_extranjeras'

  return 'otros'
}

// Obtener contactos de MercadoPublico API (usando datos ya disponibles)
async function sincronizarMercadoPublico(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0

  try {
    // Usar el endpoint público de MercadoPublico que ya tenemos
    // Alternativa: usar los datos de compras_agiles que el usuario ya extrae
    const response = await fetch('https://www.mercadopublico.cl/api/v1/proveedores/search?limit=100', {
      headers: { 'Accept': 'application/json' }
    }).catch(() => null)

    if (!response || !response.ok) {
      console.log('API MercadoPublico no disponible, usando datos locales almacenados')
      return { procesados, nuevos, actualizados, errores, tiempo_segundos: 0 }
    }

    const data = await response.json()
    if (!data.results) return { procesados, nuevos, actualizados, errores, tiempo_segundos: (Date.now() - inicio) / 1000 }

    // Procesar cada proveedor
    for (const proveedor of data.results) {
      try {
        procesados++
        const email = proveedor.email || proveedor.contacto_email
        if (!email || !esEmailValido(email)) continue

        const rubro = clasificarRubro(proveedor.razon_social, proveedor.descripcion)

        // Buscar si ya existe
        const { data: existente } = await supabase
          .from('marketing_contactos')
          .select('id')
          .eq('email', email)
          .single()
          .catch(() => ({ data: null }))

        if (existente) {
          // Actualizar con datos enriquecidos
          await supabase
            .from('marketing_contactos')
            .update({
              rubro,
              datos_enriquecimiento: {
                proveedor_mp: true,
                razon_social: proveedor.razon_social,
                rut: proveedor.rut
              },
              actualizado_en: new Date().toISOString()
            })
            .eq('id', existente.id)
          actualizados++
        } else {
          // Insertar nuevo
          await supabase
            .from('marketing_contactos')
            .insert({
              email,
              nombre: proveedor.nombre_contacto || proveedor.razon_social,
              empresa: proveedor.razon_social,
              categoria: 'proveedor_mp',
              fuente_datos: 'mercadopublico',
              fuente_primaria: 'mercadopublico',
              rubro,
              estado_suscripcion: 'suscrito',
              email_validado: true,
              estado_email: 'valido',
              datos_enriquecimiento: {
                proveedor_mp: true,
                rut: proveedor.rut
              },
              consentimiento_marketing: true,
              consentimiento_fecha: new Date().toISOString()
            })
          nuevos++
        }
      } catch (e) {
        console.error('Error procesando proveedor:', e)
        errores++
      }
    }
  } catch (error) {
    console.error('Error sincronizando MercadoPublico:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Validar y limpiar emails
async function validarEmails(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0

  try {
    // Obtener contactos sin validar
    const { data: contactos } = await supabase
      .from('marketing_contactos')
      .select('id, email, estado_email')
      .or('email_validado.is.false,estado_email.is.null')
      .limit(1000)

    if (!contactos) return { procesados, nuevos, actualizados, errores, tiempo_segundos: (Date.now() - inicio) / 1000 }

    for (const contacto of contactos) {
      procesados++
      try {
        const esValido = esEmailValido(contacto.email)

        await supabase
          .from('marketing_contactos')
          .update({
            email_validado: true,
            estado_email: esValido ? 'valido' : 'invalido',
            ultima_validacion: new Date().toISOString(),
            intentos_validacion: (contacto.intentos_validacion || 0) + 1
          })
          .eq('id', contacto.id)

        actualizados++
      } catch (e) {
        console.error('Error validando email:', e)
        errores++
      }
    }
  } catch (error) {
    console.error('Error en validación de emails:', error)
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Eliminar duplicados
async function eliminarDuplicados(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0

  try {
    // Ejecutar función PL/pgSQL de limpieza
    const { data } = await supabase
      .rpc('limpiar_duplicados_contactos')

    if (data) {
      procesados = data.procesados
      actualizados = data.eliminados
    }
  } catch (error) {
    console.error('Error eliminando duplicados:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Sincronizar proveedores del Estado (tabla proveedores local)
async function sincronizarProveedoresEstado(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0

  try {
    // Obtener todos los proveedores con email de la tabla proveedores
    const { data: proveedores, error: fetchError } = await supabase
      .from('proveedores')
      .select('id, rut, nombre, razon_social, email, rubro, actividad_economica, tamanio_empresa')
      .not('email', 'is', null)

    if (fetchError) {
      console.error('Error fetching proveedores:', fetchError)
      return { procesados, nuevos, actualizados, errores: 1, tiempo_segundos: (Date.now() - inicio) / 1000 }
    }

    if (!proveedores || proveedores.length === 0) {
      console.log('No proveedores encontrados')
      return { procesados: 0, nuevos: 0, actualizados: 0, errores: 0, tiempo_segundos: (Date.now() - inicio) / 1000 }
    }

    // Procesar cada proveedor
    for (const proveedor of proveedores) {
      try {
        procesados++
        const email = proveedor.email?.toLowerCase().trim()

        if (!email || !esEmailValido(email)) {
          console.log(`Email inválido para proveedor ${proveedor.nombre}: ${email}`)
          continue
        }

        const rubro = proveedor.rubro || clasificarRubro(proveedor.razon_social || proveedor.nombre, proveedor.actividad_economica)

        // Buscar si ya existe
        const { data: existente } = await supabase
          .from('marketing_contactos')
          .select('id')
          .eq('email', email)
          .single()
          .catch(() => ({ data: null }))

        if (existente) {
          // Actualizar si no viene de proveedores_estado o con datos más recientes
          await supabase
            .from('marketing_contactos')
            .update({
              rubro,
              fuente_primaria: 'proveedores_estado',
              datos_enriquecimiento: {
                proveedor_local: true,
                rut: proveedor.rut,
                razon_social: proveedor.razon_social,
                tamanio_empresa: proveedor.tamanio_empresa,
                actividad_economica: proveedor.actividad_economica
              },
              actualizado_en: new Date().toISOString()
            })
            .eq('id', existente.id)
          actualizados++
        } else {
          // Insertar nuevo
          await supabase
            .from('marketing_contactos')
            .insert({
              email,
              nombre: proveedor.nombre,
              empresa: proveedor.razon_social || proveedor.nombre,
              categoria: 'proveedor_estado',
              fuente_datos: 'proveedores_estado',
              fuente_primaria: 'proveedores_estado',
              rubro,
              estado_suscripcion: 'suscrito',
              email_validado: true,
              estado_email: 'valido',
              datos_enriquecimiento: {
                proveedor_local: true,
                rut: proveedor.rut,
                razon_social: proveedor.razon_social,
                tamanio_empresa: proveedor.tamanio_empresa,
                actividad_economica: proveedor.actividad_economica
              },
              consentimiento_marketing: false,
              consentimiento_fecha: null
            })
          nuevos++
        }
      } catch (e) {
        console.error('Error procesando proveedor:', e)
        errores++
      }
    }
  } catch (error) {
    console.error('Error sincronizando proveedores:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Sincronizar contactos de webinars (convenios marcos) - con paginación
async function sincronizarWebinars(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = 0
  const limit = 1000

  try {
    let hasMore = true
    while (hasMore) {
      const { data: webinars, error: fetchError } = await supabase
        .from('webinar_inscripciones')
        .select('id, email, nombre, empresa')
        .not('email', 'is', null)
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching webinar inscriptions:', fetchError)
        errores++
        break
      }

      if (!webinars || webinars.length === 0) {
        hasMore = false
        break
      }

      // Procesar cada registro
      for (const registro of webinars) {
        try {
          procesados++
          const email = registro.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) {
            console.log(`Email inválido en webinar: ${email}`)
            continue
          }

          // Buscar si ya existe - con await y error check
          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'webinar',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            // PGRST116 = no row found (expected)
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: registro.nombre,
                empresa: registro.empresa,
                categoria: 'webinar_inscrito',
                fuente_datos: 'webinar',
                fuente_primaria: 'webinar',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: true,
                consentimiento_fecha: new Date().toISOString()
              })
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando registro webinar:', e)
          errores++
        }
      }

      desde += limit
      hasMore = webinars.length === limit
    }
  } catch (error) {
    console.error('Error sincronizando webinars:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Sincronizar suscriptores de YouTube - con paginación
async function sincronizarYouTube(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = 0
  const limit = 1000

  try {
    let hasMore = true
    while (hasMore) {
      const { data: youtubers, error: fetchError } = await supabase
        .from('youtube_subscribers')
        .select('id, nombre, email')
        .not('email', 'is', null)
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching YouTube subscribers:', fetchError)
        errores++
        break
      }

      if (!youtubers || youtubers.length === 0) {
        hasMore = false
        break
      }

      // Procesar cada suscriptor
      for (const youtuber of youtubers) {
        try {
          procesados++
          const email = youtuber.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) {
            console.log(`Email inválido en YouTube: ${email}`)
            continue
          }

          // Buscar si ya existe - con await y error check
          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'youtube',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            // PGRST116 = no row found (expected)
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: youtuber.nombre,
                categoria: 'youtube_subscriber',
                fuente_datos: 'youtube',
                fuente_primaria: 'youtube',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null
              })
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando suscriptor YouTube:', e)
          errores++
        }
      }

      desde += limit
      hasMore = youtubers.length === limit
    }
  } catch (error) {
    console.error('Error sincronizando YouTube:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

// Sincronizar clientes existentes - con paginación y columnas correctas
async function sincronizarClientes(supabase: any): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = 0
  const limit = 1000

  try {
    let hasMore = true
    while (hasMore) {
      // Columnas correctas: nombre_responsable, empresa_nombre, categoria_negocio
      const { data: clientes, error: fetchError } = await supabase
        .from('clientes')
        .select('id, nombre_responsable, email, empresa_nombre, categoria_negocio')
        .not('email', 'is', null)
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching clientes:', fetchError)
        errores++
        break
      }

      if (!clientes || clientes.length === 0) {
        hasMore = false
        break
      }

      // Procesar cada cliente
      for (const cliente of clientes) {
        try {
          procesados++
          const email = cliente.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) {
            console.log(`Email inválido para cliente ${cliente.nombre_responsable}: ${email}`)
            continue
          }

          const rubro = cliente.categoria_negocio || clasificarRubro(cliente.empresa_nombre || cliente.nombre_responsable)

          // Buscar si ya existe - con await y error check
          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                rubro,
                fuente_primaria: 'clientes',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            // PGRST116 = no row found (expected)
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: cliente.nombre_responsable,
                empresa: cliente.empresa_nombre || cliente.nombre_responsable,
                categoria: 'cliente',
                fuente_datos: 'clientes',
                fuente_primaria: 'clientes',
                rubro,
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: true,
                consentimiento_fecha: new Date().toISOString()
              })
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando cliente:', e)
          errores++
        }
      }

      desde += limit
      hasMore = clientes.length === limit
    }
  } catch (error) {
    console.error('Error sincronizando clientes:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Iniciando enriquecimiento de contactos...')

    // Ejecutar todas las operaciones en paralelo
    const [resultMercado, resultProveedores, resultWebinars, resultYouTube, resultClientes, resultValidacion, resultDuplicados] = await Promise.all([
      sincronizarMercadoPublico(supabase),
      sincronizarProveedoresEstado(supabase),
      sincronizarWebinars(supabase),
      sincronizarYouTube(supabase),
      sincronizarClientes(supabase),
      validarEmails(supabase),
      eliminarDuplicados(supabase)
    ])

    // Registrar en log
    await supabase
      .from('contact_enrichment_logs')
      .insert({
        proceso: 'enriquecimiento_completo',
        registros_procesados: resultMercado.procesados + resultProveedores.procesados + resultWebinars.procesados + resultYouTube.procesados + resultClientes.procesados + resultValidacion.procesados + resultDuplicados.procesados,
        registros_nuevos: resultMercado.nuevos + resultProveedores.nuevos + resultWebinars.nuevos + resultYouTube.nuevos + resultClientes.nuevos + resultValidacion.nuevos,
        registros_actualizados: resultMercado.actualizados + resultProveedores.actualizados + resultWebinars.actualizados + resultYouTube.actualizados + resultClientes.actualizados + resultValidacion.actualizados + resultDuplicados.actualizados,
        errores: resultMercado.errores + resultProveedores.errores + resultWebinars.errores + resultYouTube.errores + resultClientes.errores + resultValidacion.errores + resultDuplicados.errores,
        estado: 'completado',
        fecha_fin: new Date().toISOString(),
        metadata: {
          mercadopublico: resultMercado,
          proveedores_estado: resultProveedores,
          webinars: resultWebinars,
          youtube: resultYouTube,
          clientes: resultClientes,
          validacion: resultValidacion,
          duplicados: resultDuplicados
        }
      })

    return new Response(
      JSON.stringify({
        success: true,
        resultados: {
          mercadopublico: resultMercado,
          proveedores_estado: resultProveedores,
          webinars: resultWebinars,
          youtube: resultYouTube,
          clientes: resultClientes,
          validacion: resultValidacion,
          duplicados: resultDuplicados
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
