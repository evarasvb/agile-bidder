# 📋 Instrucciones para Aplicar Migración de Clasificación UTM

## 🎯 Objetivo

Aplicar la migración SQL que agrega las columnas `tipo_proceso` y `categoria` a la tabla `compras_agiles` para implementar la clasificación según la regla de 100 UTM.

---

## 📝 Pasos para Aplicar

### Opción 1: Usando Supabase CLI (Recomendado)

```bash
# Desde el directorio del proyecto
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder

# Aplicar migración
supabase db push
```

### Opción 2: Manualmente en Supabase Dashboard

1. **Ir a Supabase Dashboard:**
   - Abre: https://supabase.com/dashboard/project/euzqadopjvdszcdjegmo
   - Navega a: **SQL Editor**

2. **Ejecutar la migración:**
   - Copia el contenido completo de: `supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql`
   - Pega en el SQL Editor
   - Click en **Run** o presiona `Cmd/Ctrl + Enter`

3. **Verificar:**
   ```sql
   -- Verificar que las columnas existen
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public' 
   AND table_name = 'compras_agiles'
   AND column_name IN ('tipo_proceso', 'categoria');
   
   -- Verificar clasificación de registros existentes
   SELECT 
     tipo_proceso,
     categoria,
     COUNT(*) as cantidad,
     MIN(monto) as monto_min,
     MAX(monto) as monto_max
   FROM public.compras_agiles
   GROUP BY tipo_proceso, categoria
   ORDER BY tipo_proceso, categoria;
   ```

---

## ✅ Verificación Post-Migración

### 1. Verificar Columnas
Las columnas `tipo_proceso` y `categoria` deben existir en `compras_agiles`.

### 2. Verificar Clasificación
Los registros existentes deben estar clasificados:
- **L1** (Compra Ágil): Monto <= $6.975.100 CLP
- **LE** (Licitación Intermedia): $6.975.100 < Monto <= $69.751.000 CLP
- **LP** (Licitación Mayor): $69.751.000 < Monto <= $348.755.000 CLP
- **LR** (Licitación Gran Compra): Monto > $348.755.000 CLP

### 3. Verificar Edge Function
La Edge Function `sync-compras-agiles` ahora guarda automáticamente `tipo_proceso` y `categoria` al sincronizar nuevas compras ágiles.

---

## 🔍 Qué Hace la Migración

1. **Agrega columnas:**
   - `tipo_proceso`: 'compra_agil' o 'licitacion'
   - `categoria`: 'L1', 'LE', 'LP', o 'LR'

2. **Clasifica registros existentes:**
   - Calcula tipo y categoría según monto
   - Aplica regla de 100 UTM

3. **Crea índices:**
   - Para mejor performance en filtros

4. **Agrega comentarios:**
   - Documenta el propósito de las columnas

---

## ⚠️ Notas Importantes

- La migración es **idempotente** (se puede ejecutar múltiples veces sin problemas)
- Los registros existentes se clasifican automáticamente
- Los nuevos registros se clasifican automáticamente por la Edge Function

---

## 🚀 Después de Aplicar

Una vez aplicada la migración:
1. ✅ Las compras ágiles nuevas se clasificarán automáticamente
2. ✅ La tabla mostrará badges de categoría (L1, LE, LP, LR)
3. ✅ Los filtros funcionarán correctamente con la clasificación

---

**Archivo de migración:** `supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql`
