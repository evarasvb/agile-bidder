# ✅ Implementación Estilo Lici - Licitaciones por Producto

## 🎯 Objetivo

Mostrar en la tabla de Inventario cuántas licitaciones/tenders abiertas hay para cada producto, similar a cómo Lici presenta esta información.

## 📋 Lo que se Implementó

### 1. Vista SQL: `licitaciones_por_producto`

**Archivo**: `supabase/migrations/20260115000001_vista_licitaciones_por_producto.sql`

Esta vista:
- Agrupa licitaciones activas por producto del inventario
- Calcula match score basado en keywords
- Incluye compras ágiles y licitaciones tradicionales
- Retorna:
  - `total_licitaciones_abiertas`: Cantidad de tenders abiertas
  - `mejor_match_score`: Mejor score de match encontrado
  - `presupuesto_total_estimado`: Suma de presupuestos
  - `licitaciones_detalle`: Array con detalles de cada licitación

### 2. Hook React: `useLicitacionesPorProducto`

**Archivo**: `src/hooks/useLicitacionesPorProducto.ts`

Hooks disponibles:
- `useLicitacionesPorProducto()` - Obtiene todas las licitaciones agrupadas por producto
- `useLicitacionesPorProductoId(productoId)` - Obtiene licitaciones para un producto específico

### 3. Modificación de Inventory.tsx

**Cambios realizados**:
- ✅ Agregada columna "Oportunidades" en la tabla
- ✅ Muestra badge con conteo de licitaciones abiertas
- ✅ Incluye porcentaje de match cuando está disponible
- ✅ Link clickeable que lleva a `/compras-agiles?producto={id}`

**Visualización**:
```
[🔨 5 (85%)]  ← Badge azul con icono, número y porcentaje
```

Si no hay oportunidades:
```
-  ← Texto gris discreto
```

## 🚀 Cómo Funciona

1. **Vista SQL** calcula matches en tiempo real:
   - Extrae keywords de cada producto
   - Busca coincidencias en títulos de licitaciones
   - Agrupa por producto
   - Filtra solo matches con score >= 30%

2. **Hook React** carga los datos:
   - Cache de 1 minuto para optimizar
   - Se actualiza automáticamente

3. **UI muestra**:
   - Badge visual con conteo
   - Porcentaje de match
   - Link para ver detalles

## 📊 Ejemplo de Datos

```json
{
  "producto_id": "abc-123",
  "sku": "PROD-001",
  "nombre_producto": "Notebook HP",
  "total_licitaciones_abiertas": 5,
  "mejor_match_score": 85,
  "presupuesto_total_estimado": 15000000,
  "licitaciones_codigos": ["CA-2025-001", "CA-2025-002", ...],
  "licitaciones_detalle": [...]
}
```

## 🔧 Próximos Pasos

1. **Ejecutar migración SQL** en Supabase:
   - Ve a SQL Editor
   - Ejecuta: `supabase/migrations/20260115000001_vista_licitaciones_por_producto.sql`

2. **Probar en la UI**:
   - Ve a `/inventory`
   - Deberías ver la columna "Oportunidades" con badges

3. **Filtrar por producto** (opcional):
   - Modificar `ComprasAgiles.tsx` para aceptar query param `?producto={id}`
   - Filtrar licitaciones que matchean con ese producto

## ✅ Estado

- ✅ Vista SQL creada
- ✅ Hook React creado
- ✅ UI actualizada
- ⏳ Migración pendiente de ejecutar en Supabase
- ⏳ Filtro por producto en ComprasAgiles (opcional)

---

**¡Implementación estilo Lici completada!** 🎉

Ahora cada producto en el inventario muestra cuántas licitaciones abiertas tiene, igual que Lici.
