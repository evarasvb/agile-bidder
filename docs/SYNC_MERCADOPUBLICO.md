# Sincronización MercadoPúblico

## Descripción

El sistema sincroniza datos de licitaciones y órdenes de compra desde la API de MercadoPúblico.cl 3 veces al día mediante GitHub Actions.

## Horario de Sincronización

| Hora Chile (CLT) | Hora UTC | Cron Expression |
|---|---|---|
| 6:00 AM | 9:00 AM | `0 9 * * *` |
| 12:00 PM | 3:00 PM | `0 15 * * *` |
| 6:00 PM | 9:00 PM | `0 21 * * *` |

## Secrets Requeridos en GitHub

Configura estos secrets en **Settings > Secrets and variables > Actions** del repositorio:

| Secret | Descripción | Ejemplo |
|---|---|---|
| `MP_API_TICKET` | API key de MercadoPúblico.cl. Se obtiene en el portal de desarrolladores de MercadoPúblico. | `F5A3E2B1-...` |
| `SUPABASE_URL` | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key de Supabase (acceso completo, NO la anon key) | `eyJhbGciOi...` |

## Ejecución Manual

El workflow se puede ejecutar manualmente desde GitHub Actions con los siguientes parámetros:

- **fecha**: Fecha en formato `ddmmaaaa` (ej: `15032026`). Si no se especifica, usa la fecha actual.
- **tipo**: `licitaciones`, `ordenes`, o `ambos` (default).

## Flujo de Datos

```
GitHub Actions (cron 3x/día)
    │
    ├─► POST /functions/v1/mercadopublico-api {action: "sync-licitaciones"}
    │       └─► api.mercadopublico.cl/servicios/v1/publico/licitaciones.json
    │       └─► Upsert en tabla: licitaciones_bi, licitaciones_bi_items
    │
    ├─► POST /functions/v1/mercadopublico-api {action: "sync-ordenes"}
    │       └─► api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json
    │       └─► Upsert en tablas: ordenes_compra, ordenes_compra_items
    │
    └─► POST /functions/v1/sync-health {action: "update"}
            └─► Registra timestamp y resultado en tabla: sync_status
```

## Manejo de Errores

- **Reintentos**: Cada llamada a la API se reintenta hasta 3 veces con backoff exponencial (30s, 60s, 120s).
- **Notificaciones**: Si el workflow falla, se crea automáticamente un GitHub Issue con la etiqueta `sync-failure`.
- **Monitoreo**: El estado de cada sync se registra en la tabla `sync_status`.

## Health Check

Endpoint: `GET /functions/v1/sync-health`

Respuesta:
```json
{
  "healthy": true,
  "checked_at": "2026-03-15T12:00:00Z",
  "syncs": [
    {
      "sync_type": "mercadopublico",
      "last_sync_at": "2026-03-15T09:00:00Z",
      "hours_since_sync": 3.0,
      "is_stale": false,
      "licitaciones_status": "success",
      "licitaciones_synced": 42,
      "ordenes_status": "success",
      "ordenes_synced": 18
    }
  ]
}
```

Si `hours_since_sync > 10`, el campo `is_stale` será `true` y `healthy` será `false`.

## Troubleshooting

1. **Sync no se ejecuta**: Verificar que los 3 secrets estén configurados en GitHub.
2. **Error 401/403**: El `MP_API_TICKET` puede estar expirado. Renovar en el portal de MercadoPúblico.
3. **Error 500 en edge function**: Verificar que `SUPABASE_SERVICE_ROLE_KEY` sea correcto y no la anon key.
4. **Datos no aparecen**: Revisar que las tablas `licitaciones_bi` y `ordenes_compra` existan con los campos esperados.
