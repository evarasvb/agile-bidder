// deno-lint-ignore no-import-prefix
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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
  has_more?: boolean
  next_cursor?: number
}

const BATCH_SIZE = 100
type AdminClient = SupabaseClient

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
async function sincronizarMercadoPublico(supabase: AdminClient): Promise<EnrichmentResult> {
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
      return { procesados, nuevos, actualizados, errores: 1, tiempo_segundos: 0 }
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
        const { data: existente, error: existeError } = await supabase
          .from('marketing_contactos')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existeError) throw existeError

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
            .throwOnError()
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
            .throwOnError()
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
async function validarEmails(supabase: AdminClient, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, actualizados = 0, errores = 0
  const nuevos = 0

  try {
    // Obtener contactos sin validar
    const { data: contactos, error: fetchError } = await supabase
      .from('marketing_contactos')
      .select('id, email, estado_email, intentos_validacion')
      .or('email_validado.is.false,estado_email.is.null')
      .order('id', { ascending: true })
      .limit(batchSize)

    if (fetchError) {
      console.error('Error obteniendo emails pendientes:', fetchError)
      return { procesados, nuevos, actualizados, errores: 1, tiempo_segundos: (Date.now() - inicio) / 1000 }
    }

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
          .throwOnError()

        actualizados++
      } catch (e) {
        console.error('Error validando email:', e)
        errores++
      }
    }
  } catch (error) {
    console.error('Error en validación de emails:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: procesados === batchSize,
    next_cursor: 0
  }
}

// Eliminar duplicados
async function eliminarDuplicados(supabase: AdminClient): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, actualizados = 0, errores = 0
  const nuevos = 0

  try {
    // Ejecutar función PL/pgSQL de limpieza
    const { data, error } = await supabase
      .rpc('limpiar_duplicados_contactos')

    if (error) throw error

    const result = Array.isArray(data) ? data[0] : data
    if (result) {
      procesados = Number(result.procesados) || 0
      actualizados = Number(result.eliminados) || 0
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
async function sincronizarProveedoresEstado(
  supabase: AdminClient,
  cursor = 0,
  batchSize = BATCH_SIZE,
): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0

  try {
    // Obtener todos los proveedores con email de la tabla proveedores
    const { data: proveedores, error: fetchError } = await supabase
      .from('proveedores')
      .select('id, rut, nombre, razon_social, email, rubro, actividad_economica, tamanio_empresa')
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(cursor, cursor + batchSize - 1)

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
        const { data: existente, error: existeError } = await supabase
          .from('marketing_contactos')
          .select('id')
          .eq('email', email)
          .maybeSingle()

        if (existeError) throw existeError

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
            .throwOnError()
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
            .throwOnError()
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
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: procesados === batchSize,
    next_cursor: cursor + procesados
  }
}

// Sincronizar contactos de webinars (convenios marcos) - con paginación
async function sincronizarWebinars(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: webinars, error: fetchError } = await supabase
        .from('webinar_inscripciones')
        .select('id, email, nombre, empresa')
        .not('email', 'is', null)
        .order('id', { ascending: true })
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

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'webinar',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
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
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando registro webinar:', e)
          errores++
        }
      }

      desde += limit
      hasMore = webinars.length === limit
      break
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
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar suscriptores de YouTube - con paginación
async function sincronizarYouTube(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: youtubers, error: fetchError } = await supabase
        .from('youtube_subscribers')
        .select('id, nombre, email')
        .not('email', 'is', null)
        .order('id', { ascending: true })
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

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'youtube',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
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
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando suscriptor YouTube:', e)
          errores++
        }
      }

      desde += limit
      hasMore = youtubers.length === limit
      break
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
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar clientes existentes - con paginación y columnas correctas
async function sincronizarClientes(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      // Columnas correctas: nombre_responsable, empresa_nombre, categoria_negocio
      const { data: clientes, error: fetchError } = await supabase
        .from('clientes')
        .select('id, nombre_responsable, email, empresa_nombre, categoria_negocio')
        .not('email', 'is', null)
        .order('id', { ascending: true })
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

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                rubro,
                fuente_primaria: 'clientes',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
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
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando cliente:', e)
          errores++
        }
      }

      desde += limit
      hasMore = clientes.length === limit
      break
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
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar webinar_invitacion (tabla separada de webinar_inscripciones) - con paginación
async function sincronizarWebinarInvitacion(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: registros, error: fetchError } = await supabase
        .from('webinar_invitacion')
        .select('id, email, nombre, empresa, campana')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching webinar_invitacion:', fetchError)
        errores++
        break
      }

      if (!registros || registros.length === 0) {
        hasMore = false
        break
      }

      for (const registro of registros) {
        try {
          procesados++
          const email = registro.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) continue

          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'webinar_invitacion',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: registro.nombre,
                empresa: registro.empresa,
                categoria: 'webinar_invitado',
                fuente_datos: 'webinar_invitacion',
                fuente_primaria: 'webinar_invitacion',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null,
                datos_enriquecimiento: { campana: registro.campana }
              })
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando webinar_invitacion:', e)
          errores++
        }
      }

      desde += limit
      hasMore = registros.length === limit
      break
    }
  } catch (error) {
    console.error('Error sincronizando webinar_invitacion:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar profiles (usuarios del sistema) - con paginación
async function sincronizarProfiles(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: profiles, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching profiles:', fetchError)
        errores++
        break
      }

      if (!profiles || profiles.length === 0) {
        hasMore = false
        break
      }

      for (const profile of profiles) {
        try {
          procesados++
          const email = profile.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) continue

          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'profiles',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: profile.full_name,
                categoria: 'usuario',
                fuente_datos: 'profiles',
                fuente_primaria: 'profiles',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null
              })
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando profile:', e)
          errores++
        }
      }

      desde += limit
      hasMore = profiles.length === limit
      break
    }
  } catch (error) {
    console.error('Error sincronizando profiles:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar vista_contacto_prospectos (view con prospectos validados) - con paginación
async function sincronizarProspectos(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: prospectos, error: fetchError } = await supabase
        .from('vista_contacto_prospectos')
        .select('id, email, contacto, empresa, categorias, puntaje')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching vista_contacto_prospectos:', fetchError)
        errores++
        break
      }

      if (!prospectos || prospectos.length === 0) {
        hasMore = false
        break
      }

      for (const prospecto of prospectos) {
        try {
          procesados++
          const email = prospecto.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) continue

          const rubro = prospecto.categorias ? clasificarRubro(prospecto.categorias, prospecto.empresa) : 'otros'

          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                rubro,
                fuente_primaria: 'prospecto',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: prospecto.contacto,
                empresa: prospecto.empresa,
                categoria: 'prospecto_validado',
                fuente_datos: 'prospectos',
                fuente_primaria: 'prospecto',
                rubro,
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null,
                datos_enriquecimiento: { puntaje: prospecto.puntaje }
              })
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando prospecto:', e)
          errores++
        }
      }

      desde += limit
      hasMore = prospectos.length === limit
      break
    }
  } catch (error) {
    console.error('Error sincronizando prospectos:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar academia_leads (leads de academias) - con paginación
async function sincronizarAcademiaLeads(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: leads, error: fetchError } = await supabase
        .from('academia_leads')
        .select('id, email, nombre_contacto, nombre_empresa')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching academia_leads:', fetchError)
        errores++
        break
      }

      if (!leads || leads.length === 0) {
        hasMore = false
        break
      }

      for (const lead of leads) {
        try {
          procesados++
          const email = lead.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) continue

          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'academia',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: lead.nombre_contacto,
                empresa: lead.nombre_empresa,
                categoria: 'academia_lead',
                fuente_datos: 'academia',
                fuente_primaria: 'academia',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null
              })
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando academia_lead:', e)
          errores++
        }
      }

      desde += limit
      hasMore = leads.length === limit
      break
    }
  } catch (error) {
    console.error('Error sincronizando academia_leads:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

// Sincronizar agendamientos_meet (leads con agendamientos) - con paginación
async function sincronizarAgendamientos(supabase: AdminClient, cursor = 0, batchSize = BATCH_SIZE): Promise<EnrichmentResult> {
  const inicio = Date.now()
  let procesados = 0, nuevos = 0, actualizados = 0, errores = 0
  let desde = cursor
  const limit = batchSize
  let hasMore = false

  try {
    hasMore = true
    while (hasMore) {
      const { data: agendamientos, error: fetchError } = await supabase
        .from('agendamientos_meet')
        .select('id, email, nombre, empresa')
        .not('email', 'is', null)
        .order('id', { ascending: true })
        .range(desde, desde + limit - 1)

      if (fetchError) {
        console.error('Error fetching agendamientos_meet:', fetchError)
        errores++
        break
      }

      if (!agendamientos || agendamientos.length === 0) {
        hasMore = false
        break
      }

      for (const agendamiento of agendamientos) {
        try {
          procesados++
          const email = agendamiento.email?.toLowerCase().trim()

          if (!email || !esEmailValido(email)) continue

          const { data: existente, error: existeError } = await supabase
            .from('marketing_contactos')
            .select('id')
            .eq('email', email)
            .single()

          if (existeError && existeError.code !== 'PGRST116') throw existeError
          if (existente) {
            await supabase
              .from('marketing_contactos')
              .update({
                fuente_primaria: 'agendamiento',
                actualizado_en: new Date().toISOString()
              })
              .eq('id', existente.id)
              .throwOnError()
            actualizados++
          } else if (!existeError || existeError.code === 'PGRST116') {
            await supabase
              .from('marketing_contactos')
              .insert({
                email,
                nombre: agendamiento.nombre,
                empresa: agendamiento.empresa,
                categoria: 'agendamiento_meet',
                fuente_datos: 'agendamientos',
                fuente_primaria: 'agendamiento',
                estado_suscripcion: 'suscrito',
                email_validado: true,
                estado_email: 'valido',
                consentimiento_marketing: false,
                consentimiento_fecha: null
              })
              .throwOnError()
            nuevos++
          }
        } catch (e) {
          console.error('Error procesando agendamiento:', e)
          errores++
        }
      }

      desde += limit
      hasMore = agendamientos.length === limit
      break
    }
  } catch (error) {
    console.error('Error sincronizando agendamientos:', error)
    errores++
  }

  return {
    procesados,
    nuevos,
    actualizados,
    errores,
    tiempo_segundos: (Date.now() - inicio) / 1000,
    has_more: hasMore,
    next_cursor: desde
  }
}

type EnrichmentAction = 'enqueue' | 'worker'

interface ClaimedJob {
  job_id: string
  run_id: string
  source: string
  cursor_value: number
  attempt: number
  max_attempts: number
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  })
}

async function authorizeCaller(
  admin: AdminClient,
  token: string,
  serviceRoleKey: string,
) {
  if (token === serviceRoleKey) return { serviceRole: true, userId: null }

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null

  if (
    user.email?.toLowerCase() === 'evaras@firmavb.cl' &&
    Boolean(user.email_confirmed_at)
  ) {
    return { serviceRole: false, userId: user.id }
  }

  return null
}

function processSourceBatch(
  admin: AdminClient,
  source: string,
  cursor: number,
): Promise<EnrichmentResult> {
  switch (source) {
    case 'mercadopublico': return sincronizarMercadoPublico(admin)
    case 'proveedores_estado': return sincronizarProveedoresEstado(admin, cursor)
    case 'webinars': return sincronizarWebinars(admin, cursor)
    case 'youtube': return sincronizarYouTube(admin, cursor)
    case 'clientes': return sincronizarClientes(admin, cursor)
    case 'webinar_invitacion': return sincronizarWebinarInvitacion(admin, cursor)
    case 'profiles': return sincronizarProfiles(admin, cursor)
    case 'prospectos': return sincronizarProspectos(admin, cursor)
    case 'academia_leads': return sincronizarAcademiaLeads(admin, cursor)
    case 'agendamientos': return sincronizarAgendamientos(admin, cursor)
    case 'validacion': return validarEmails(admin)
    case 'duplicados': return eliminarDuplicados(admin)
    default: throw new Error('unknown_enrichment_source')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Service unavailable' }, 503)

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const caller = await authorizeCaller(admin, token, serviceRoleKey)
    if (!caller) return jsonResponse({ error: 'Forbidden' }, 403)

    const rawBody = await req.text()
    if (new TextEncoder().encode(rawBody).byteLength > 10_000) {
      return jsonResponse({ error: 'Request too large' }, 413)
    }

    let action: EnrichmentAction = 'enqueue'
    if (rawBody.trim()) {
      try {
        const parsed = JSON.parse(rawBody) as { action?: unknown }
        if (parsed.action === 'enqueue' || parsed.action === 'worker') action = parsed.action
        else if (parsed.action !== undefined) return jsonResponse({ error: 'Invalid action' }, 400)
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400)
      }
    }

    if (action === 'enqueue') {
      const { data, error } = await admin.rpc('contact_enrichment_enqueue', {
        p_trigger_source: caller.serviceRole ? 'cron' : 'manual',
        p_requested_by: caller.userId,
      })
      if (error) {
        console.error('No se pudo encolar el enriquecimiento:', error.code)
        return jsonResponse({ error: 'Queue unavailable' }, 503)
      }
      return jsonResponse({ accepted: true, ...data }, 202)
    }

    if (!caller.serviceRole) return jsonResponse({ error: 'Forbidden' }, 403)

    const { data: claimed, error: claimError } = await admin
      .rpc('contact_enrichment_claim_job')
      .maybeSingle()
    if (claimError) {
      console.error('No se pudo reclamar un lote:', claimError.code)
      return jsonResponse({ error: 'Worker unavailable' }, 503)
    }
    if (!claimed) return jsonResponse({ accepted: true, work: 'none' })

    const job = claimed as ClaimedJob
    try {
      const result = await processSourceBatch(admin, job.source, job.cursor_value)
      if (result.errores > 0 && result.nuevos + result.actualizados === 0) {
        throw new Error(`${job.source}_batch_failed`)
      }
      if (
        result.has_more === true &&
        result.procesados > 0 &&
        result.nuevos + result.actualizados === 0 &&
        (result.next_cursor ?? job.cursor_value) <= job.cursor_value
      ) {
        throw new Error(`${job.source}_batch_without_progress`)
      }

      const { error: finishError } = await admin.rpc('contact_enrichment_finish_job', {
        p_job_id: job.job_id,
        p_has_more: result.has_more === true,
        p_next_cursor: result.next_cursor ?? job.cursor_value,
        p_processed: result.procesados,
        p_new: result.nuevos,
        p_updated: result.actualizados,
        p_errors: result.errores,
      })
      if (finishError) throw new Error('finish_job_failed')

      return jsonResponse({
        accepted: true,
        job_id: job.job_id,
        source: job.source,
        has_more: result.has_more === true,
        result,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'batch_failed'
      const { data: retry, error: retryError } = await admin.rpc('contact_enrichment_fail_job', {
        p_job_id: job.job_id,
        p_error: message,
      })
      if (retryError) {
        console.error('No se pudo persistir el fallo del lote:', retryError.code)
        return jsonResponse({ error: 'Batch state unavailable' }, 503)
      }
      // HTTP 200 significa que el resultado (incluido el fallo) quedo durable.
      return jsonResponse({ accepted: true, job_id: job.job_id, source: job.source, retry })
    }
  } catch (error) {
    console.error('Error no controlado en contact-enrichment:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
