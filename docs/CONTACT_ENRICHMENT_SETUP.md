# Sistema de Enriquecimiento Automático de Contactos

Sistema completamente automático que:
- **Ingiere contactos** de Mercado Público, datos abiertos, APIs estatales
- **Valida emails** y limpia rebotes automáticamente
- **Clasifica por rubro**: Tecnología, Ferretería, Alimentos, Oficina, Servicios, Extranjeras
- **Elimina duplicados** y enriquece datos
- **Se ejecuta cada 24 horas** sin intervención manual

## Arquitectura

```
Scheduler (cada 24h)
    ↓
Enrichment Edge Function (paralelo)
    ├── Sincronizar MercadoPublico
    ├── Sincronizar Proveedores del Estado (tabla proveedores)
    ├── Sincronizar Webinars (convenios marcos)
    ├── Sincronizar YouTube Suscriptores
    ├── Sincronizar Clientes existentes
    ├── Validar emails (lógica propia)
    ├── Clasificar por rubro
    └── Eliminar duplicados
    ↓
contact_enrichment_logs (registro)
    ↓
marketing_contactos (base unificada: TODOS los contactos del negocio)
```

## Configuración

### 1. Aplicar Migración de Base de Datos

```bash
npx supabase migration up
```

Esto crea:
- Campos en `marketing_contactos`: email_validado, estado_email, rubro, fuente_primaria, etc.
- Tabla `contact_enrichment_logs` para auditar procesos
- Tabla `contact_data_sources` para rastrear fuentes
- Funciones PL/pgSQL para validación y limpieza

### 2. Configurar Vercel Cron (Ejecutar automáticamente cada 24h)

En `vercel.json` (crear si no existe):

```json
{
  "crons": [
    {
      "path": "/api/enrichment-scheduler",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Luego crear archivo `/pages/api/enrichment-scheduler.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verificar que viene de Vercel Cron
    const cronSecret = process.env.VERCEL_CRON_SECRET
    if (cronSecret !== req.headers['x-vercel-cron-secret']) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Invocar Edge Function
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enrichment-scheduler`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('Error en scheduler:', error)
    return res.status(500).json({ error: error.message })
  }
}
```

### 3. Variables de Entorno Necesarias

En Vercel Settings → Environment Variables:

```
ENRICHMENT_SCHEDULER_TOKEN=tu_token_secreto
SUPABASE_SERVICE_ROLE_KEY=clave_supabase_service_role
```

## Características

### Validación de Emails (sin costo)

- Validación de formato regex
- Detección de dominios falsos (test.*, example.*, etc.)
- Sin servicios externos pagos
- Funciona offline

### Clasificación por Rubro

Detecta automáticamente por palabras clave:

- **Tecnología**: software, cloud, desarrollo, digital, IT
- **Ferretería**: construcción, herramientas, cemento, acero
- **Alimentos**: bebidas, lácteos, carnes, abarrotes
- **Artículos de Oficina**: papelería, muebles, escritorios
- **Servicios**: consultoría, asesoría, limpieza, mantenimiento
- **Empresas Extranjeras**: import, export, internacional

### Fuentes de Datos Consolidadas

1. **Tabla proveedores** - Proveedores del Estado de órdenes de compra (personas que compraron al Estado)
2. **Mercado Público API** - Proveedores registrados en MercadoPublico
3. **Webinars** (tabla webinar_inscripciones) - Inscritos a convenios marcos y eventos
4. **YouTube** (tabla youtube_subscribers) - Suscriptores de canales corporativos
5. **Clientes** (tabla clientes) - Base de clientes existentes

### Fuentes Futuras

- Datos Abiertos - Registros públicos (datos.gob.cl)
- Empresas Chilanas - Base SII cuando esté disponible
- APIs estatales - Conforme se agreguen

## Consolidación Centralizada

**marketing_contactos** es el repositorio unificado de TODOS los contactos del negocio:

- ✅ **Proveedores del Estado** - Desde tabla `proveedores` (órdenes de compra)
- ✅ **MercadoPublico** - API pública de proveedores
- ✅ **Webinars** - Inscritos a convenios marcos y eventos corporativos
- ✅ **YouTube** - Suscriptores de canales de marketing
- ✅ **Clientes** - Base de clientes existentes de la empresa

**Automatización:**
- Sincronización automática cada 24h sin intervención manual
- Ejecuta en paralelo (más rápido)
- Deduplicación por email lowercase, mantiene registro más reciente
- Email validation con lógica propia (sin costo)
- Clasificación por rubro automática (keywords)
- Auditoría completa en `contact_enrichment_logs`

## Dashboard

En Marketing → Centro de Control → Salud de Base:

- ✅ Total de contactos (consolidados de todas fuentes)
- ✅ Porcentaje de emails válidos
- ✅ Distribución por rubro
- ✅ Histórico de sincronizaciones
- ✅ Botón manual para enriquecer ahora
- ✅ Estadísticas de cada fuente de datos

## Monitoreo

Ver logs en:
- Supabase → `contact_enrichment_logs`
- Vercel → Function logs
- Dashboard → Pestaña "Salud de Base"

## Uso Manual

Ejecutar enriquecimiento a demanda desde el dashboard o:

```bash
curl -X POST https://tu-api.vercel.app/api/enrichment-scheduler \
  -H "x-vercel-cron-secret: $VERCEL_CRON_SECRET"
```

## Mejoras Futuras

- [ ] Validación SMTP de emails (cuando presupuesto lo permita)
- [ ] Integración con más APIs estatales
- [ ] Clasificación por segmento de mercado
- [ ] Detección de empresas competidoras
- [ ] Score de calidad de contacto
- [ ] Sincronización con LinkedIn (cuando API disponible)

## Costos

- **$0** - Usa solo APIs públicas gratuitas
- **Vercel**: Cron incluido en plan pro
- **Supabase**: Storage y queries incluidas en plan
- **Sin límites**: Procesa ilimitados contactos

## Troubleshooting

### "No se sincroniza"
- Verificar SUPABASE_SERVICE_ROLE_KEY en Vercel
- Verificar que Edge Functions estén desplegadas
- Ver logs en Supabase → Functions

### "Emails no se validan"
- Verificar que la columna email_validado existe
- Ejecutar migración nuevamente: `npx supabase migration up`

### "Duplicados no se eliminan"
- Función `limpiar_duplicados_contactos` debe estar en BD
- Verificar que existe tabla contact_enrichment_logs
