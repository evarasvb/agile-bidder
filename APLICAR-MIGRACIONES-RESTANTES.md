# Aplicar Migraciones Restantes

## Estado Actual

✅ **La mayoría de las migraciones están aplicadas** (más de 40)

⚠️ **Quedan 4 migraciones pendientes:**
1. `20260116000003_limpiar_datos_prueba_compras_agiles.sql` - Registrada pero con error (duplicate key)
2. `20260116000004_create_ordenes_compra.sql` - Pendiente
3. `20260117000000_add_costo_neto_margen_comercial_inventory.sql` - Pendiente  
4. `20260117000001_create_exec_sql_function.sql` - Pendiente

## Solución

### Opción 1: Aplicar manualmente en Supabase SQL Editor

1. Ve a: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql/new
2. Abre cada archivo de migración pendiente
3. Copia y pega el SQL
4. Ejecuta

### Opción 2: Usar el script consolidado

He creado un archivo consolidado con las 3 migraciones que no tienen problemas:
- `20260116000004_create_ordenes_compra.sql`
- `20260117000000_add_costo_neto_margen_comercial_inventory.sql`
- `20260117000001_create_exec_sql_function.sql`

Puedes ejecutarlas todas juntas en Supabase SQL Editor.

## Nota sobre 20260116000003

Esta migración está registrada pero falló. Si necesitas las vistas y funciones que crea, puedes ejecutarla manualmente en Supabase SQL Editor (ignorará el error de duplicate key si ya existe el registro).
