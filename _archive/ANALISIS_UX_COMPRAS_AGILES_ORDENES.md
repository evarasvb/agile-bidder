# Análisis UX - Compras Ágiles y Órdenes de Compra

## 🔍 Problemas Identificados (Perspectiva Usuario)

### 1. **Compras Ágiles - Validación de Datos Reales**
❌ **Problema**: No hay filtro visible para asegurar que solo se muestren compras ágiles reales
- Los usuarios pueden ver datos de prueba/ejemplo
- No hay indicador claro de qué es real vs prueba
- La migración `20260116000003_limpiar_datos_prueba_compras_agiles.sql` fue eliminada

✅ **Solución necesaria**:
- Agregar filtro por defecto que excluya datos sospechosos
- Mostrar badge "Datos de Prueba" si aplica
- Validar que `nombre_organismo` no sea genérico ("test", "prueba", etc.)
- Verificar que haya productos asociados (`licitacion_items`)

### 2. **Compras Ágiles - Información Incompleta**
❌ **Problema**: Pueden faltar campos importantes
- `nombre_organismo` vs `organismo` - inconsistencia
- `monto_estimado` vs `monto` - inconsistencia  
- Falta información de contacto, condiciones de pago
- No se muestra si tiene productos asociados

✅ **Solución necesaria**:
- Unificar campos (`nombre_organismo`, `monto_estimado`)
- Mostrar badge si faltan datos críticos
- Agregar indicador de productos asociados
- Mostrar datos completos desde `datos_json`

### 3. **Órdenes de Compra - Falta Información Detallada**
❌ **Problema**: La tabla muestra información básica pero falta:
- Verificación de items completos
- Información financiera detallada (total_neto, total_iva, total)
- Link a MercadoPúblico si está disponible
- Referencia a licitación original si aplica

✅ **Solución necesaria**:
- Agregar columna "Items" con contador
- Mostrar desglose financiero en detalle
- Agregar botón "Ver en MercadoPúblico" si hay link
- Mostrar licitación origen si existe

### 4. **UX - Feedback Visual**
❌ **Problema**: 
- No hay indicador de carga durante actualizaciones
- Mensajes de error no son claros
- No hay confirmación cuando se filtran datos

✅ **Solución necesaria**:
- Agregar spinners en botones de acción
- Mensajes de error más descriptivos
- Toast notifications para acciones exitosas

## 📊 Correcciones Prioritarias

### Prioridad 1: Validación de Datos Reales (Compras Ágiles)
- Filtrar datos de prueba por defecto
- Agregar vista/query que identifique compras sospechosas
- Mostrar advertencia si hay datos de prueba

### Prioridad 2: Completar Información (Ambas)
- Unificar campos en compras ágiles
- Mostrar todos los campos disponibles en órdenes
- Extraer datos de `datos_json` cuando falten campos

### Prioridad 3: Mejorar UX Visual
- Indicadores de carga
- Mensajes claros
- Badges informativos
