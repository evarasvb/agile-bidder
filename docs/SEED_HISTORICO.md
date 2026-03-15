# Seed Histórico de Licitaciones y Órdenes de Compra

Pobla la base de datos con datos históricos de MercadoPúblico utilizando dos
mecanismos complementarios: la API oficial (day-by-day) y los CSVs de datos abiertos.

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `scripts/seed-historico.ts` | Itera día a día llamando a la API de MercadoPúblico |
| `scripts/seed-csv.ts` | Descarga CSVs mensuales de datos-abiertos.chilecompra.cl |

---

## seed-historico.ts

### Descripción

Llama a la edge function `mercadopublico-api` con las acciones
`sync-licitaciones` y/o `sync-ordenes` para cada día del período indicado.
Incluye rate limiting de **1 request cada 2 segundos** para no saturar la API.

### Variables de entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `SUPABASE_URL` | ✅ | — | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key |
| `MP_API_TICKET` | ✅ | — | Ticket de la API de MercadoPúblico |
| `MESES_ATRAS` | ❌ | `6` | Meses hacia atrás a importar |
| `TIPO` | ❌ | `ambos` | `licitaciones` \| `ordenes` \| `ambos` |

### Ejecución local

```bash
export SUPABASE_URL="https://juiskeeutbaipwbeeezw.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export MP_API_TICKET="<mp-api-ticket>"
export MESES_ATRAS=6
export TIPO=ambos

npx tsx scripts/seed-historico.ts
```

### Estimación de tiempo

Con `MESES_ATRAS=6` (~180 días) y `TIPO=ambos`:

- 180 días × 2 acciones = 360 llamadas
- 2 segundos de delay entre cada llamada
- **Tiempo estimado: ~12 minutos**

---

## seed-csv.ts

### Descripción

Llama a la edge function `sync-compras-agiles-csv?months=N` para descargar
y procesar CSVs mensuales de datos-abiertos.chilecompra.cl.

### Variables de entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `SUPABASE_URL` | ✅ | — | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | — | Service role key |
| `MESES_CSV` | ❌ | `12` | Meses hacia atrás a importar |

### Ejecución local

```bash
export SUPABASE_URL="https://juiskeeutbaipwbeeezw.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export MESES_CSV=12

npx tsx scripts/seed-csv.ts
```

---

## GitHub Action: Seed Histórico

El workflow `.github/workflows/seed-historico.yml` permite ejecutar el seed
de forma manual desde la interfaz de GitHub Actions.

### Parámetros

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `meses_atras` | `6` | Meses de historial a importar |
| `tipo` | `ambos` | `licitaciones` \| `ordenes` \| `ambos` |
| `incluir_csv` | `true` | Si se ejecuta también el seed CSV |

### Secrets requeridos

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MP_API_TICKET`

### Cómo ejecutar manualmente

1. Ir a **Actions** → **Seed Histórico MercadoPúblico**
2. Clic en **Run workflow**
3. Completar los parámetros
4. Clic en **Run workflow**

---

## Tablas afectadas

| Tabla | Script | Conflict key |
|-------|--------|-------------|
| `licitaciones_bi` | seed-historico | `codigo` |
| `licitaciones_bi_items` | seed-historico | `licitacion_codigo, correlativo` |
| `licitaciones_adjudicaciones` | seed-historico | — |
| `ordenes_compra` | seed-historico | `codigo` |
| `ordenes_compra_items` | seed-historico | — |
| `proveedores` | seed-historico | `rut` |
| `instituciones` | seed-historico | `rut` |
| `compras_agiles` | seed-csv | `codigo` |

Todos los inserts usan **upsert** para evitar duplicados.

---

## Notas técnicas

- La edge function `mercadopublico-api` acepta `POST { action, fecha, ticket }`.
  El formato de fecha es `ddmmaaaa` (p. ej. `15032026`).
- La edge function `sync-compras-agiles-csv` acepta `GET ?months=N`.
- El seed histórico itera desde el **día 1 del mes N meses atrás** hasta hoy.
- Para grandes volúmenes, se recomienda ejecutar primero con `TIPO=licitaciones`
  y luego con `TIPO=ordenes` para facilitar el monitoreo.
