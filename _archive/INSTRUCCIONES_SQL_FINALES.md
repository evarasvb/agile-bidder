# ✅ INSTRUCCIONES FINALES - Ejecutar SQL para Eliminar Datos de Prueba

## 🎯 OBJETIVO
Eliminar todos los datos de prueba (CA-2025-004, CA-2025-002, etc.) de la base de datos.

---

## 📋 PASOS (5 MINUTOS)

### 1. Abre Supabase Dashboard
- URL: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql
- O ve a: Dashboard → Tu Proyecto → SQL Editor

### 2. Copia y Pega este SQL

```sql
DELETE FROM public.compras_agiles
WHERE 
  codigo LIKE 'CA-2025-%' OR
  codigo LIKE 'CA-2024-%' OR
  codigo LIKE 'TEST-%' OR
  codigo LIKE 'PRUEBA-%' OR
  codigo LIKE 'DEMO-%' OR
  codigo LIKE 'SAMPLE-%';
```

### 3. Ejecuta el SQL
- Haz clic en **"RUN"** o presiona `Cmd + Enter` (Mac) / `Ctrl + Enter` (Windows)
- Debería mostrar: `Success. No rows returned` o similar

### 4. Refresca firmavb.cl
- Abre: https://firmavb.cl/compras-agiles
- Presiona `Cmd + Shift + R` (Mac) o `Ctrl + Shift + R` (Windows)
- **¡Los datos de prueba desaparecerán!**

---

## ✅ VERIFICACIÓN

Después de ejecutar, verifica en SQL Editor:

```sql
SELECT COUNT(*) FROM public.compras_agiles WHERE codigo LIKE 'CA-2025-%';
-- Debería mostrar: 0
```

---

## 🎯 RESULTADO ESPERADO

- ✅ Los códigos `CA-2025-*` desaparecerán de la interfaz
- ✅ Si hay compras reales (ej: `813-50-COT26`), aparecerán
- ✅ Si no hay compras reales, la lista quedará vacía (correcto)

---

## 💡 IMPORTANTE

**NO necesitas hacer nada en Lovable** para esto. Los cambios de datos en Supabase se reflejan automáticamente en firmavb.cl cuando refrescas el navegador.
