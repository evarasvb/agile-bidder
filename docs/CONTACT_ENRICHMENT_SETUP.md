# Sistema de Enriquecimiento Automático de Contactos

Sistema automático que:
- **Consolida contactos** desde las tablas internas ya cargadas
- **Valida emails** y limpia rebotes automáticamente
- **Clasifica por rubro**: Tecnología, Ferretería, Alimentos, Oficina, Servicios, Extranjeras
- **Evita nuevos duplicados** al normalizar emails y enriquece datos
- **Se ejecuta cada 24 horas** sin intervención manual

## Arquitectura

```
Supabase pg_cron (inicio diario + worker cada minuto)
    ↓
Cola durable contact_enrichment_jobs
    ├── Sincronizar Proveedores del Estado (tabla local proveedores)
    ├── Sincronizar Webinars (convenios marcos)
    ├── Sincronizar YouTube Suscriptores
    ├── Sincronizar Clientes existentes
    ├── Clasificar por rubro
    └── Validar emails por lotes
    ↓
Edge Function procesa un lote de hasta 100 filas
    ↓
Resultado durable + reintento con backoff
    ↓
contact_enrichment_logs (estado real)
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

### 2. Programación automática en Supabase

La migración `*_contact_enrichment_pg_cron.sql` crea un inicio diario a las
02:00 UTC y un worker liviano que solo invoca la función cuando existe trabajo.
Cada fuente se procesa por lotes durables. La respuesta HTTP, su `request_id`,
estado y error quedan registrados; los fallos usan espera creciente y, al
agotarse, generan un registro de error visible en el panel.

La autorización se lee en cada ejecución desde el secreto existente de Vault
`service_role_jwt_legacy`. Nunca se debe copiar su valor a la migración ni a
`vercel.json`.

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
2. **Webinars** (tabla webinar_inscripciones) - Inscritos a convenios marcos y eventos
3. **YouTube** (tabla youtube_subscribers) - Suscriptores de canales corporativos
4. **Clientes** (tabla clientes) - Base de clientes existentes

### Fuentes Futuras

- Datos Abiertos - Registros públicos (datos.gob.cl)
- Empresas Chilanas - Base SII cuando esté disponible
- APIs estatales - Conforme se agreguen

## Consolidación Centralizada

**marketing_contactos** es el repositorio unificado de TODOS los contactos del negocio:

- ✅ **Proveedores del Estado** - Desde tabla `proveedores` (órdenes de compra)
- ✅ **Webinars** - Inscritos a convenios marcos y eventos corporativos
- ✅ **YouTube** - Suscriptores de canales de marketing
- ✅ **Clientes** - Base de clientes existentes de la empresa

**Automatización:**
- Sincronización automática cada 24h sin intervención manual
- Cola durable: un fallo no pierde el avance ni duplica una corrida activa
- Lotes de hasta 100 filas para no depender de una solicitud larga
- Altas y actualizaciones normalizan el email para evitar nuevos duplicados
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
- Supabase → `contact_enrichment_runs`, `contact_enrichment_jobs` y `contact_enrichment_http_dispatches`
- Supabase → Cron y Functions
- Dashboard → Pestaña "Salud de Base"

## Uso Manual

Ejecutar enriquecimiento a demanda desde el dashboard. El servidor exige el
JWT vigente y correo confirmado de `evaras@firmavb.cl`; otro administrador no
puede iniciarlo. No hay una API pública de Vercel para este proceso.

## Corte a producción y verificación

Realizar fuera de las 02:00 UTC, en este orden:

1. Desplegar primero la versión compatible de `contact-enrichment` en Supabase.
2. Aplicar la migración para activar los dos trabajos de Cron.
3. Ejecutar una vez `select public.contact_enrichment_dispatch('enqueue');`.
4. Esperar al worker y comprobar que el despacho terminó `succeeded` con HTTP
   2xx, que la corrida está `processing` o `completed` y que los trabajos
   avanzan a `completed` sin quedar bloqueados.
5. Confirmar el resultado en `contact_enrichment_logs` y en Salud de Base.
6. Solo entonces desplegar `vercel.json` y la eliminación de la API antigua.

Rollback del programador: desactivar **solo** `contact-enrichment-daily`, dejar
`contact-enrichment-worker` activo y restaurar la API/Cron de Vercel anterior.
La API antigua enviará `{}` y la Edge nueva lo tratará como `enqueue`; el worker
seguirá drenando la cola sin que existan dos inicios diarios. No desactivar el
worker mientras siga desplegada la Edge por lotes. Conservar tablas y resultados
para investigar; no borrar la cola durante el incidente.

## Mejoras Futuras

- [ ] Validación SMTP de emails (cuando presupuesto lo permita)
- [ ] Integración con más APIs estatales
- [ ] Clasificación por segmento de mercado
- [ ] Detección de empresas competidoras
- [ ] Score de calidad de contacto
- [ ] Sincronización con LinkedIn (cuando API disponible)

## Costos

- **$0 adicional** - Reutiliza datos internos y servicios ya contratados
- **Vercel**: sin invocaciones de Cron para este proceso
- **Supabase**: consume la cuota existente; revisar métricas antes de aumentar frecuencia

## Troubleshooting

### "No se sincroniza"
- Verificar el trabajo `contact-enrichment-daily` en Supabase Cron
- Verificar también `contact-enrichment-worker` y los resultados HTTP persistidos
- Verificar que Vault contenga `service_role_jwt_legacy`
- Verificar que Edge Functions estén desplegadas
- Ver logs en Supabase → Cron y Functions

### "Emails no se validan"
- Verificar que la columna email_validado existe
- Ejecutar migración nuevamente: `npx supabase migration up`

### "Hay duplicados históricos"
- La cola diaria no elimina ni marca duplicados históricos automáticamente.
- Ejecutar una limpieza idempotente revisada por separado; no usar la función
  antigua `limpiar_duplicados_contactos`, porque no fusiona registros.
