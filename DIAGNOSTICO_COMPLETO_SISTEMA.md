# 🔍 DIAGNÓSTICO COMPLETO DEL SISTEMA

**Fecha:** 18 de Enero 2026  
**Usuario:** evaras@firmavb.cl

---

## ❌ PROBLEMAS IDENTIFICADOS

### 1. ✅ DATOS DE PRUEBA ELIMINADOS (YA HECHO)
- **Estado:** ✅ Migración aplicada
- **Acción:** Ya se ejecutó el DELETE SQL
- **Verificar:** Si aún aparecen, puede ser caché del frontend

### 2. ❌ COMPRAS ÁGILES REALES NO LLEGAN
- **Problema:** El scraper funciona pero no está ejecutándose automáticamente
- **Causa:** No hay cron job configurado
- **Solución:** Configurar cron en GitHub Actions o ejecutar manualmente

### 3. ❌ ITEMS/PRODUCTOS NO SE VEN EN COMPRAS ÁGILES
- **Problema:** `MatchPanel` usa `useLicitacionItems` que busca en `licitacion_items` pero el scraper puede no estar guardando items
- **Causa:** Scraper no extrae items o tabla `licitacion_items` no tiene RLS correcto
- **Solución:** Verificar scraper extrae items + arreglar RLS

### 4. ⚠️ MATCHING LIMITADO A 5 PRODUCTOS
- **Problema:** `useMatchItemInventario` tiene `.slice(0, 5)` limitando sugerencias
- **Ubicación:** `src/components/compras-agiles/MatchPanel.tsx:98`
- **Solución:** Aumentar límite a 10-20 o hacer configurable

### 5. ⚠️ INCORPORACIÓN DE PRODUCTOS - NO HAY LÍMITE HARDCODED
- **Problema:** No encontré límite de 5 en `GenerarPropuestaModal`
- **Posible causa:** Límite en otra parte o confusión con el límite de matching
- **Solución:** Verificar si existe, si no, el límite es solo visual (matching)

### 6. ⚠️ ÓRDENES DE COMPRA EN DETALLE
- **Problema:** Página existe pero puede no mostrar todos los datos
- **Causa:** `useOrdenesCompra` enriquece datos de `raw_data` pero puede faltar info
- **Solución:** Mejorar extracción de datos de `datos_json`

### 7. ❌ EVARISTO NO FUNCIONA EN LÍNEA
- **Problema:** `EvaristoChat` usa `useEvaristoMision` y `useEvaristoRevisar` que llaman a Edge Function
- **Causa:** Edge Function `evaristo-api` puede no estar funcionando o no tiene permisos
- **Solución:** Verificar Edge Function + permisos + estado del agente Python

### 8. ❌ USUARIOS NO PUEDEN VER NADA (RLS)
- **Problema:** RLS policies muy restrictivas o usuarios sin rol correcto
- **Causa:** `compras_agiles` tiene `USING (true)` pero otras tablas pueden tener restricciones
- **Solución:** Revisar todas las RLS policies y ajustar para usuarios autenticados

### 9. ❌ NO SE PUEDEN DAR PERMISOS A USUARIOS
- **Problema:** Sistema de permisos existe pero UI/admin panel puede no estar completo
- **Causa:** Falta página/admin para gestionar `user_roles` y `role_permissions`
- **Solución:** Crear/mejorar admin panel para gestión de usuarios y roles

---

## ✅ PLAN DE ACCIÓN

1. **Eliminar límite de 5 en matching** → Aumentar a 20
2. **Verificar y mejorar RLS policies** → Permitir lectura a todos los autenticados
3. **Verificar Edge Function de Evaristo** → Desplegar si falta
4. **Mejorar extracción de datos en órdenes** → Asegurar todos los campos
5. **Crear admin panel de usuarios** → Gestión de roles y permisos
6. **Verificar scraper guarda items** → Asegurar `licitacion_items` se llena
7. **Configurar cron para scraper** → Ejecución automática diaria

---

## 📋 ORDEN DE EJECUCIÓN

**PRIORIDAD ALTA:**
1. Arreglar RLS para que usuarios vean datos
2. Eliminar límite de 5 en matching
3. Verificar Evaristo Edge Function
4. Mejorar extracción de datos

**PRIORIDAD MEDIA:**
5. Admin panel de usuarios
6. Verificar scraper items
7. Configurar cron

---

## 🎯 RESULTADO ESPERADO

Después de las correcciones:
- ✅ Todos los usuarios autenticados pueden ver compras y órdenes
- ✅ Matching muestra más sugerencias (20 en vez de 5)
- ✅ Evaristo funciona en línea como soporte virtual
- ✅ Órdenes muestran toda la información
- ✅ Items/productos visibles en compras ágiles
- ✅ Admin puede dar permisos a usuarios
