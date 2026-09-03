# 🔍 Revisión Exhaustiva de Botones y Acciones

**Fecha:** 2026-01-15  
**Objetivo:** Verificar que cada botón genere valor, tenga información necesaria, cumpla lo prometido y use elementos disponibles

---

## 📊 DASHBOARD (`/dashboard`)

### 1. Botón "Actualizar" 🔄
**Ubicación:** Header del Dashboard  
**Acción:** `handleForceRefresh()` → `refetchMetrics()`

**✅ LO BUENO:**
- Funciona correctamente
- Tiene feedback visual (spinner durante carga)
- Deshabilitado durante carga

**❌ PROBLEMAS:**
- **No genera suficiente valor:** Solo refresca métricas, no hace matching ni actualiza datos
- **Falta información:** No indica qué se está actualizando
- **No usa elementos disponibles:** Podría mostrar qué métricas se actualizaron

**💡 MEJORAS SUGERIDAS:**
- Agregar tooltip explicando qué actualiza
- Mostrar toast con detalles de qué se actualizó
- Opción de actualizar también matching

---

### 2. Botón "Ejecutar Matching IA" ✨
**Ubicación:** Header del Dashboard  
**Acción:** `runMatching()` → `useMatchingAI()`

**✅ LO BUENO:**
- Funciona correctamente
- Procesa compras ágiles y licitaciones
- Tiene feedback visual (loading state)
- Deshabilitado durante proceso

**❌ PROBLEMAS:**
- **Falta información crítica:**
  - No indica cuántas compras ágiles procesará
  - No muestra progreso durante ejecución
  - No explica qué hace exactamente
  - No muestra resultados después de ejecutar
- **No usa elementos disponibles:**
  - Podría mostrar preview de qué procesará
  - Podría mostrar estadísticas antes/después

**💡 MEJORAS SUGERIDAS:**
- Agregar tooltip explicando el proceso
- Mostrar dialog con:
  - Cantidad de compras ágiles a procesar
  - Progreso en tiempo real
  - Resultados al finalizar (matches encontrados, tiempo, etc.)
- Agregar confirmación si hay muchas compras ágiles pendientes

---

### 3. Badge "En vivo" 🟢
**Ubicación:** Header del Dashboard  
**Acción:** Ninguna (solo visual)

**❌ PROBLEMAS:**
- **No genera valor:** Es solo decorativo
- **Falta información:** No indica qué está "en vivo"
- **No cumple con lo que dice:** No hay actualización en tiempo real visible

**💡 MEJORAS SUGERIDAS:**
- Convertir en tooltip que muestre última actualización
- Agregar funcionalidad de actualización automática
- O eliminar si no agrega valor

---

### 4. Botón "Reintentar" (en error banner) 🔄
**Ubicación:** Banner de error  
**Acción:** `refetchMetrics()`

**✅ LO BUENO:**
- Funciona correctamente
- Solo aparece cuando hay error

**❌ PROBLEMAS:**
- **Falta información:** No explica por qué falló
- **No genera suficiente valor:** Solo reintenta, no diagnostica

**💡 MEJORAS SUGERIDAS:**
- Mostrar detalles del error en tooltip
- Agregar opción de reportar error

---

### 5. Botón "Ver todas" (en Próximas a Vencer) 👁️
**Ubicación:** Card de licitaciones urgentes  
**Acción:** Navega a `/licitaciones`

**✅ LO BUENO:**
- Funciona correctamente
- Navegación clara

**❌ PROBLEMAS:**
- **Falta información:** No indica cuántas hay en total
- **No usa elementos disponibles:** Podría filtrar por urgentes automáticamente

**💡 MEJORAS SUGERIDAS:**
- Agregar contador de total
- Filtrar automáticamente por urgentes al navegar

---

## 📦 INVENTARIO (`/inventory`)

### 1. Botón "+ Agregar Producto" ➕
**Revisar:** ¿Tiene todos los campos necesarios? ¿Valida correctamente?

### 2. Botón "Importar Excel" 📥
**Revisar:** ¿Muestra preview? ¿Valida formato? ¿Muestra errores claros?

### 3. Botón "Exportar" 📤
**Revisar:** ¿Qué formato exporta? ¿Incluye todos los campos?

### 4. Botón "Eliminar" (bulk) 🗑️
**Revisar:** ¿Tiene confirmación? ¿Muestra qué se eliminará?

### 5. Columna "Oportunidades" 🔗
**Revisar:** ¿El link funciona? ¿Filtra correctamente?

---

## 🛒 COMPRAS ÁGILES (`/compras-agiles`)

### 1. Botón "Actualizar" 🔄
**Revisar:** Similar a Dashboard

### 2. Botón "Generar Propuesta" 📄
**Revisar:** ¿Muestra preview? ¿Valida datos? ¿Guarda borrador?

### 3. Filtros 🔍
**Revisar:** ¿Usan clasificación 100 UTM? ¿Son claros?

---

## 📋 LICITACIONES (`/licitaciones`)

### 1. Botón "Ejecutar Matching" 🤖
**Revisar:** Similar a Dashboard

### 2. Botones de acciones en tabla
**Revisar:** ¿Cada acción tiene confirmación? ¿Feedback claro?

---

## 🎯 PRIORIDADES DE MEJORA

### 🔴 CRÍTICO
1. **Botón "Ejecutar Matching IA":** Agregar información y resultados
2. **Badge "En vivo":** Agregar funcionalidad o eliminar
3. **Verificar clasificación 100 UTM:** Asegurar que se use en todo el sistema

### 🟡 IMPORTANTE
4. **Botón "Actualizar":** Mejorar feedback
5. **Botones de eliminación:** Agregar confirmaciones
6. **Tooltips en todos los botones:** Explicar qué hacen

### 🟢 NICE TO HAVE
7. **Progreso visual en acciones largas**
8. **Preview antes de acciones importantes**
9. **Estadísticas de resultados**

---

## 📝 NOTAS TÉCNICAS

- Verificar que `clasificacion.ts` se use en:
  - Filtros de compras ágiles
  - Clasificación al guardar
  - Visualización de badges
  - Queries y vistas SQL
