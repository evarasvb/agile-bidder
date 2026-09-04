# 🚀 Ejecutar Migración SQL - Instrucciones Automáticas

## ✅ Estado Actual

- ✅ Migración SQL creada: `supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql`
- ✅ Edge Function actualizada: `supabase/functions/sync-compras-agiles/index.ts`
- ✅ Frontend actualizado con mejoras visuales
- ✅ Código verificado y sin errores

---

## 📋 PASO 1: Aplicar Migración SQL

### Opción A: Usando Supabase CLI (Recomendado)

```bash
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder
supabase db push
```

### Opción B: Manualmente en Supabase Dashboard

1. **Abrir Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/euzqadopjvdszcdjegmo
   - Navegar a: **SQL Editor**

2. **Copiar y ejecutar migración:**
   - Abrir archivo: `supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql`
   - Copiar TODO el contenido
   - Pegar en SQL Editor
   - Click en **Run** o presionar `Cmd/Ctrl + Enter`

3. **Verificar ejecución:**
   - Debe mostrar: "Success. No rows returned"
   - O mostrar cantidad de filas actualizadas

---

## ✅ PASO 2: Verificar Migración

Ejecutar en SQL Editor:

```sql
-- Verificar que las columnas existen
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'compras_agiles'
AND column_name IN ('nombre_organismo', 'monto_estimado', 'tipo_proceso', 'categoria')
ORDER BY column_name;
```

**Resultado esperado:** 4 filas (una por cada columna)

---

## ✅ PASO 3: Verificar Clasificación

Ejecutar en SQL Editor:

```sql
-- Verificar clasificación de registros
SELECT 
  tipo_proceso,
  categoria,
  COUNT(*) as cantidad,
  MIN(COALESCE(monto_estimado, monto)) as monto_min,
  MAX(COALESCE(monto_estimado, monto)) as monto_max,
  AVG(COALESCE(monto_estimado, monto)) as monto_promedio
FROM public.compras_agiles
GROUP BY tipo_proceso, categoria
ORDER BY 
  CASE tipo_proceso WHEN 'compra_agil' THEN 1 ELSE 2 END,
  CASE categoria WHEN 'L1' THEN 1 WHEN 'LE' THEN 2 WHEN 'LP' THEN 3 WHEN 'LR' THEN 4 END;
```

**Resultado esperado:** Registros clasificados correctamente según monto

---

## ✅ PASO 4: Verificar Edge Function

La Edge Function `sync-compras-agiles` ahora:
- ✅ Guarda `nombre_organismo` y `monto_estimado`
- ✅ Calcula y guarda `tipo_proceso` y `categoria`
- ✅ Mantiene compatibilidad con campos antiguos

**No requiere acción adicional** - se aplicará automáticamente en la próxima sincronización.

---

## ✅ PASO 5: Verificar Frontend

1. **Abrir aplicación:**
   ```bash
   npm run dev
   ```

2. **Verificar visualizaciones:**
   - ✅ Badge de categoría visible en tabla de Compras Ágiles
   - ✅ Información detallada en MatchPanel
   - ✅ Tooltips con requisitos (FEA, Garantía)
   - ✅ Clasificación visible en LicitacionesNuevas

---

## 🎯 Resumen de Cambios

### Base de Datos
- ✅ Agregadas columnas: `nombre_organismo`, `monto_estimado`, `tipo_proceso`, `categoria`
- ✅ Migrados datos existentes
- ✅ Clasificados registros según regla 100 UTM
- ✅ Creados índices para performance

### Backend
- ✅ Edge Function actualizada para guardar campos reales
- ✅ Clasificación automática al sincronizar

### Frontend
- ✅ Visualización mejorada de clasificación
- ✅ Tooltips informativos
- ✅ Mapeo correcto de campos

---

## ⚠️ Si Algo Falla

### Error: "column already exists"
- La migración es idempotente, pero si las columnas ya existen, simplemente continúa.

### Error: "permission denied"
- Verificar que estás usando el rol correcto (service_role o admin).

### Error: "relation does not exist"
- Verificar que la tabla `compras_agiles` existe.
- Ejecutar primero la migración de creación de tabla.

---

## 📞 Siguiente Paso

Una vez aplicada la migración:
1. ✅ Las nuevas compras ágiles se clasificarán automáticamente
2. ✅ La tabla mostrará badges de categoría
3. ✅ Los tooltips mostrarán información completa
4. ✅ Los filtros funcionarán con la clasificación

**¡Todo listo para usar!** 🎉
