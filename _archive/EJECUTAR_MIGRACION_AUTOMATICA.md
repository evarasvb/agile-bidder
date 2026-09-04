# 🚀 Ejecutar Migración SQL - Script Automático

## ⚠️ IMPORTANTE

La migración SQL **DEBE ejecutarse manualmente** en Supabase Dashboard porque requiere:
- Acceso a tu cuenta de Supabase
- Permisos de administrador
- Conexión directa a la base de datos

**No se puede ejecutar automáticamente desde el código.**

---

## 📋 PASO ÚNICO: Ejecutar Migración

### Opción 1: Supabase CLI (Si tienes acceso)

```bash
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder
supabase db push
```

### Opción 2: Supabase Dashboard (Recomendado)

1. **Abrir:** https://supabase.com/dashboard/project/euzqadopjvdszcdjegmo/sql/new

2. **Copiar contenido de:**
   ```
   supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql
   ```

3. **Pegar en SQL Editor y ejecutar**

4. **Verificar:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns
   WHERE table_name = 'compras_agiles'
   AND column_name IN ('nombre_organismo', 'monto_estimado', 'tipo_proceso', 'categoria');
   ```

---

## ✅ ESTADO ACTUAL

- ✅ Código actualizado y funcionando
- ✅ Migración SQL lista
- ⚠️ **Pendiente:** Ejecutar migración SQL manualmente

---

**Archivo de migración:** `supabase/migrations/20260115000004_add_clasificacion_compras_agiles.sql`
