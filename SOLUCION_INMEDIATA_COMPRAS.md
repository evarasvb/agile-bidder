# 🔧 SOLUCIÓN INMEDIATA: Eliminar Datos de Prueba

## ❌ PROBLEMA IDENTIFICADO

En la interfaz de firmavb.cl todavía aparecen compras con códigos de prueba como:
- `CA-2025-004`
- `CA-2025-002`
- `CA-2025-001`
- `CA-2025-003`

## ✅ SOLUCIÓN RÁPIDA

### Opción 1: Ejecutar SQL directamente en Supabase (RECOMENDADO)

1. **Abre Supabase Dashboard:**
   - Ve a: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw
   - O abre tu proyecto directamente

2. **Ve a SQL Editor:**
   - En el menú lateral, haz clic en "SQL Editor"
   - O ve a: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql

3. **Copia y pega este SQL:**
   ```sql
   DELETE FROM public.compras_agiles
   WHERE 
     codigo LIKE 'CA-2025-%' OR
     codigo LIKE 'CA-2024-%' OR
     codigo LIKE 'TEST-%' OR
     codigo LIKE 'PRUEBA-%' OR
     codigo LIKE 'DEMO-%' OR
     codigo LIKE 'SAMPLE-%' OR
     codigo IN ('test', 'prueba', 'demo', 'sample') OR
     LOWER(nombre) LIKE '%test%' OR
     LOWER(nombre) LIKE '%prueba%' OR
     LOWER(nombre) LIKE '%ejemplo%' OR
     LOWER(nombre) LIKE '%dummy%' OR
     LOWER(nombre) LIKE '%sample%' OR
     LOWER(nombre) LIKE '%demo%';
   ```

4. **Ejecuta el SQL:**
   - Haz clic en "RUN" o presiona `Cmd + Enter`
   - Debería mostrar cuántas filas fueron eliminadas

5. **Refresca el navegador:**
   - En firmavb.cl, presiona `Cmd + Shift + R` (Mac) o `Ctrl + Shift + R` (Windows)
   - Los datos de prueba deberían desaparecer

### Opción 2: Usar Supabase CLI (Si tienes acceso)

```bash
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder
supabase db execute -f scripts/eliminar-compras-prueba-directo.sql
```

---

## 🔍 VERIFICACIÓN

Después de ejecutar el SQL, verifica:

```sql
-- Contar cuántas quedan con códigos de prueba
SELECT COUNT(*) 
FROM public.compras_agiles 
WHERE codigo LIKE 'CA-2025-%';
-- Debería mostrar: 0

-- Ver cuántas compras hay en total
SELECT COUNT(*) FROM public.compras_agiles;
-- Deberías ver solo las compras reales (como 813-50-COT26, etc.)
```

---

## ⚠️ IMPORTANTE

**El filtro en el código del frontend ya está funcionando** (línea 88 de `useComprasAgiles.ts`), pero si los datos todavía están en la base de datos, puede haber cache o problemas de sincronización.

**Lo mejor es eliminar los datos directamente de la base de datos** usando el SQL de arriba.

---

## 🚀 DESPUÉS DE ELIMINAR

Una vez eliminados los datos de prueba:
1. **Refresca firmavb.cl** (`Cmd + Shift + R`)
2. **Deberías ver solo las compras reales** del scraper (como `813-50-COT26`, `1380-363-COT26`, etc.)
3. **O una lista vacía** si solo había datos de prueba

---

**Archivo SQL listo:** `scripts/eliminar-compras-prueba-directo.sql`
