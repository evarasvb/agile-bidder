# Eliminar Compras Ágiles de Prueba

Esta migración elimina todos los datos de prueba de la tabla `compras_agiles`, dejando solo las compras ágiles reales sincronizadas desde MercadoPúblico.

## ✅ Datos que se eliminarán:

- Códigos como: `CA-2025-001`, `CA-2025-002`, `TEST-*`, `PRUEBA-*`, `DEMO-*`, etc.
- Organismos genéricos: "Organismo no especificado", "Organismo de prueba"
- Nombres que contienen: "test", "prueba", "ejemplo", "dummy", "sample", "demo"

## 🚀 Aplicar la Migración

Tienes dos opciones:

### Opción 1: Usando Supabase CLI (Recomendado)

```bash
cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder
supabase db push
```

### Opción 2: Ejecutar SQL directamente en Supabase Dashboard

1. Abre el Supabase Dashboard: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw
2. Ve a **SQL Editor**
3. Copia y pega el contenido del archivo `supabase/migrations/20260118000000_eliminar_compras_agiles_prueba.sql`
4. Ejecuta el SQL

### Opción 3: Ejecutar SQL via CLI de Supabase

```bash
supabase db execute -f supabase/migrations/20260118000000_eliminar_compras_agiles_prueba.sql
```

## ⚠️ Nota Importante

Esta migración **solo elimina datos claramente identificados como de prueba**. Las compras ágiles reales que vengan del scraper de MercadoPúblico **NO se eliminarán**.

Después de ejecutar la migración, la página de "Compras Ágiles" mostrará solo datos reales (o estará vacía si aún no hay compras reales sincronizadas desde MercadoPúblico).