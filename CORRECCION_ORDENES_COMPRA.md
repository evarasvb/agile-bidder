# ✅ CORRECCIÓN: Órdenes de Compra - Extracción de Datos

**Fecha:** 18 de Enero 2026  
**Problema:** Órdenes de compra mostraban "N/A" en Institución, Proveedor, Total, Fecha, Estado

---

## ❌ PROBLEMA

En la captura de pantalla de `/ordenes-compra`:
- **Institución:** "N/A" para todas las órdenes
- **Proveedor:** "N/A" para todas las órdenes  
- **Total:** "N/A" para todas las órdenes
- **Fecha:** "N/A" para todas las órdenes
- **Estado:** "N/A" para todas las órdenes

Aunque los datos están en `raw_data` o `datos_json`, **no se estaban extrayendo correctamente**.

---

## ✅ SOLUCIÓN

**Archivo:** `src/hooks/useOrdenesCompra.ts`

**Cambio:** Mejorada la extracción de datos de `raw_data`/`datos_json`:

### Antes:
- Extracción **condicional** (solo si faltaban campos)
- Buscaba solo algunas claves (`Organismo`, `Proveedor`, `Total`)
- No intentaba múltiples variaciones de nombres

### Después:
- Extracción **siempre activa** (intenta extraer aunque algunos campos existan)
- Busca múltiples variaciones de claves:
  - `Organismo`, `organismo`, `Institucion`, `institucion`, `InstitucionNombre`
  - `RutOrganismo`, `rut_organismo`, `RUTOrganismo`, `rutOrganismo`
  - `Proveedor`, `proveedor`, `ProveedorNombre`
  - `Total`, `total`, `MontoTotal`, `monto_total`
  - `Estado`, `estado`, `Status`, `status`
  - Y más variaciones...

### Función Helper:
```typescript
const extractValue = (primary: any, ...keys: string[]): any => {
  if (primary !== null && primary !== undefined && primary !== '') return primary;
  if (!rawData || typeof rawData !== 'object') return null;
  
  for (const key of keys) {
    const value = rawData[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
};
```

---

## 📊 RESULTADO ESPERADO

Después de publicar en Lovable:

### Antes:
- Institución: "N/A"
- Proveedor: "N/A"
- Total: "N/A"
- Fecha: "N/A"
- Estado: "N/A"

### Después:
- Institución: **Nombre real de la institución**
- Proveedor: **Nombre real del proveedor**
- Total: **Monto total formateado** (ej: "$1.200.000")
- Fecha: **Fecha formateada** (ej: "18 ene 2026")
- Estado: **Estado real** (ej: "enviada", "aceptada")

---

## 🔧 CAMPOS CORREGIDOS

1. ✅ `institucion_nombre` - Extraído de múltiples variaciones de claves
2. ✅ `institucion_rut` - Extraído de múltiples variaciones
3. ✅ `proveedor_nombre` - Extraído de múltiples variaciones
4. ✅ `proveedor_rut` - Extraído de múltiples variaciones
5. ✅ `total` - Extraído de múltiples variaciones
6. ✅ `total_neto` - Extraído de múltiples variaciones
7. ✅ `estado` - Extraído de múltiples variaciones
8. ✅ `fecha_creacion` - Extraído de múltiples variaciones
9. ✅ `fecha_envio` - Extraído de múltiples variaciones

---

## 🚀 PRÓXIMO PASO

**Publicar en Lovable** para ver los cambios:

1. Abre Lovable
2. Haz clic en **"Publicar"** o **"Deploy"**
3. Espera 1-2 minutos
4. Refresca `firmavb.cl/ordenes-compra` con `Cmd + Shift + R`

---

## ✅ ESTADO

- ✅ **Código corregido:** Extracción mejorada en `useOrdenesCompra` y `useOrdenCompra`
- ⏳ **Pendiente:** Publicar en Lovable para ver cambios en producción

---

## 📝 NOTA

La extracción ahora es más robusta y busca múltiples variaciones de nombres de claves, lo que debería funcionar independientemente de cómo estén guardados los datos en `raw_data` o `datos_json`.
