# Revisión: Compras Ágiles y Scraper

**Fecha:** 18 de Enero 2026  
**Estado:** ✅ Migración aplicada - Datos de prueba eliminados

---

## 1. Estado de la Base de Datos

### ✅ Migración Completada
- **Migración:** `20260118000000_eliminar_compras_agiles_prueba.sql`
- **Estado:** ✅ Aplicada exitosamente
- **Resultado:** Todas las compras de prueba han sido eliminadas

### 📊 Estado Actual de `compras_agiles`
- **Datos de prueba:** ❌ Eliminados
- **Compras reales:** ⚠️ Depende de la ejecución del scraper

---

## 2. Análisis del Scraper

### 📁 Ubicación del Scraper Principal
```
/Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/scraper.js
```

### 🔄 Flujo de Sincronización

#### A. Scraper Principal (`scraper.js`)
**Función:** `upsertComprasAgiles(supabase, licitacionesRows)` (líneas 500-582)

**Características:**
1. ✅ Filtra solo compras ágiles (<= 100 UTM = $6.975.100 CLP)
2. ✅ Mapea datos de `licitaciones` → `compras_agiles`
3. ✅ Usa `upsert` con `onConflict: 'codigo'` para evitar duplicados
4. ✅ Guarda información completa en `datos_json`
5. ✅ Procesa en batches de 200 registros

**Campos guardados:**
- `codigo` (único)
- `nombre` (desde `titulo`)
- `nombre_organismo` (desde `organismo` o `datos_json.organismo_nombre`)
- `monto_estimado` (desde `presupuesto_estimado`)
- `fecha_cierre` (desde `finaliza_el`)
- `estado` (desde `estado_detallado` o `estado`)
- `region` (desde `datos_json.region` o `departamento`)
- `descripcion` (desde `datos_json.descripcion_completa` o `titulo`)
- `link_oficial` (desde `link_detalle`)
- `match_encontrado: false` (por defecto)
- `datos_json` (con toda la información adicional)

**Cuándo se ejecuta:**
- Línea 1081: Después de obtener las compras de la página de resultados
- Línea 1164: Al actualizar información adicional desde el detalle

#### B. Extensión Chrome (`chrome-extension/background.js`)
**Función:** Sincronización directa a Edge Function (líneas 496-518)

**Características:**
1. ✅ Llama a `sync-compras-agiles` Edge Function
2. ✅ Envía compras ágiles capturadas desde MercadoPúblico
3. ✅ Requiere API key configurada en la extensión

**Flujo:**
```javascript
fetch(`${SUPABASE_URL}/functions/v1/sync-compras-agiles`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey
  },
  body: JSON.stringify({
    compras_agiles: [licitacion],
    items: payload.items || []
  })
})
```

#### C. Edge Function (`supabase/functions/sync-compras-agiles/index.ts`)
**Función:** Recibe compras ágiles y las guarda en la BD

**Características:**
1. ✅ Valida API key desde `extension_api_keys`
2. ✅ Clasifica proceso según monto (compra_agil vs licitacion)
3. ✅ Guarda datos completos en `datos_json`
4. ✅ Maneja items de productos si vienen incluidos

---

## 3. Verificación del Sistema

### ✅ Puntos Verificados

1. **Estructura de la tabla `compras_agiles`:**
   - ✅ Tabla existe con estructura correcta
   - ✅ Columnas: `codigo`, `nombre`, `organismo`, `monto`, `fecha_cierre`, `estado`, `region`, `descripcion`, `match_encontrado`, `datos_json`
   - ✅ Índice único en `codigo`
   - ✅ RLS habilitado

2. **Migraciones:**
   - ✅ `20260118000000_eliminar_compras_agiles_prueba.sql` aplicada
   - ✅ Datos de prueba eliminados

3. **Scraper:**
   - ✅ Función `upsertComprasAgiles` implementada correctamente
   - ✅ Filtro de compras ágiles (<= 100 UTM) funcional
   - ✅ Mapeo de datos completo

4. **Edge Function:**
   - ✅ `sync-compras-agiles` implementada
   - ✅ Validación de API key
   - ✅ Clasificación según monto

### ⚠️ Puntos a Verificar Manualmente

1. **Ejecución del Scraper:**
   ```bash
   cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper
   node scraper.js
   ```

2. **Variables de Entorno del Scraper:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Verificar que estén en `.env`

3. **Extensión Chrome:**
   - Verificar que la API key esté configurada
   - Verificar que esté activa y capturando compras

4. **GitHub Actions (si aplica):**
   - Verificar workflows automáticos
   - Revisar logs de ejecución

---

## 4. Próximos Pasos Recomendados

### Para Obtener Compras Reales:

1. **Opción 1: Ejecutar Scraper Manualmente**
   ```bash
   cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper
   node scraper.js --test  # Modo prueba
   node scraper.js         # Ejecución completa
   ```

2. **Opción 2: Usar Extensión Chrome**
   - Navegar por MercadoPúblico con la extensión instalada
   - La extensión capturará y sincronizará compras automáticamente

3. **Opción 3: Sincronización Programada (Cron)**
   - Configurar GitHub Actions para ejecutar el scraper periódicamente
   - O configurar un cron job local/servidor

### Para Verificar Datos:

```sql
-- Contar compras ágiles reales
SELECT COUNT(*) FROM compras_agiles;

-- Ver últimas compras
SELECT codigo, nombre, nombre_organismo, monto_estimado, estado, created_at 
FROM compras_agiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Verificar que no haya datos de prueba
SELECT COUNT(*) 
FROM compras_agiles 
WHERE codigo LIKE 'CA-2025-%' 
   OR codigo LIKE 'TEST-%' 
   OR LOWER(nombre) LIKE '%test%';
```

---

## 5. Resumen

### ✅ Lo que está funcionando:
- ✅ Migración para eliminar datos de prueba aplicada
- ✅ Scraper tiene función para guardar compras ágiles
- ✅ Edge Function `sync-compras-agiles` implementada
- ✅ Extensión Chrome configurada para sincronizar

### ⚠️ Lo que necesita ejecutarse:
- ⚠️ Scraper principal debe ejecutarse para obtener compras reales
- ⚠️ Extensión Chrome debe usarse activamente en MercadoPúblico
- ⚠️ Verificar que las variables de entorno estén configuradas

### 📝 Conclusión:
El sistema está **listo para recibir compras ágiles reales**. La estructura está correcta, las migraciones están aplicadas, y el código del scraper está implementado. Solo falta **ejecutar el scraper** o **usar la extensión** para capturar datos reales de MercadoPúblico.

---

**Nota:** La base de datos está limpia (sin datos de prueba). Una vez que se ejecute el scraper o se use la extensión, las compras reales aparecerán en la página "Compras Ágiles" del frontend.
