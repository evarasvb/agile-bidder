# 📋 Guía: Cómo Subir Lista de Precios al Sistema

## 🎯 Resumen Rápido

Para subir una lista de precios masiva al sistema de FirmaVB, usa la funcionalidad **"Carga Masiva"** en la página de Inventario.

---

## 📍 Ubicación

**Ruta**: `www.firmavb.cl/inventory`  
**Botón**: "Carga Masiva" (botón azul en la parte superior)

---

## 📝 Pasos para Subir Lista de Precios

### Paso 1: Ir a Inventario
1. Inicia sesión en `www.firmavb.cl`
2. Ve a **"Inventario"** en el menú lateral
3. Haz clic en el botón **"Carga Masiva"** (botón azul con ícono de upload)

### Paso 2: Preparar tu Archivo

El sistema acepta dos formatos:
- ✅ **Excel (.xlsx, .xls)**
- ✅ **CSV (.csv)**

### Paso 3: Formato Requerido

Tu archivo debe tener estas columnas (algunas son opcionales):

#### ✅ Campos Obligatorios:
- **Código** (SKU): Código único del producto (no puede repetirse)
- **Descripción**: Nombre descriptivo del producto
- **Costo Neto**: Costo del producto
- **Precio de Venta**: Precio de venta del producto
- **Unidad**: Unidad de medida (ej: "unidad", "LT", "KG", "C/U")

#### ⭐ Campos Opcionales:
- **Categoría**: Categoría del producto (ej: "Computación", "Insumos")
- **Stock**: Cantidad disponible
- **Proveedor**: Nombre del proveedor
- **Margen Mínimo (%)**: Margen mínimo aceptable
- **Margen Objetivo (%)**: Margen objetivo deseado
- **Tiempo Entrega (días)**: Tiempo de entrega en días
- **Keywords**: Palabras clave separadas por comas
- **URL Imagen**: URL de la imagen del producto

### Paso 4: Descargar Plantilla (Recomendado)

1. En la página de Inventario, haz clic en **"Descargar Plantilla"**
2. La plantilla incluye ejemplos con el formato correcto
3. Completa la plantilla con tus productos

### Paso 5: Subir el Archivo

1. Haz clic en **"Carga Masiva"**
2. Selecciona tu archivo Excel o CSV
3. O arrastra el archivo al área indicada
4. El sistema validará automáticamente los datos
5. Revisa la previsualización de los productos

### Paso 6: Confirmar y Procesar

1. Revisa la previsualización de tus productos
2. Si hay errores, corrígelos en tu archivo y vuelve a subir
3. Haz clic en **"Importar Productos"**
4. El sistema procesará los productos y mostrará el progreso
5. Al finalizar, verás un resumen con:
   - ✅ Productos importados exitosamente
   - ⚠️ Productos actualizados (si el SKU ya existía)
   - ❌ Errores encontrados (si los hay)

---

## 📊 Ejemplo de Formato Excel/CSV

| Código | Descripción | Costo Neto | Precio de Venta | Unidad | Categoría | Stock | Proveedor |
|--------|-------------|------------|-----------------|--------|-----------|-------|-----------|
| PROD-001 | Notebook Dell Latitude | 450000 | 650000 | unidad | Computación | 10 | TechSupply |
| PROD-002 | Toner HP LaserJet | 15000 | 25000 | unidad | Impresión | 50 | PaperMax |
| PROD-003 | Alcohol Gel 1 Litro | 2560 | 3200 | LT | Limpieza | 200 | Higiene Total |

---

## ⚠️ Validaciones Importantes

El sistema valida automáticamente:

1. **SKU único**: No puede haber dos productos con el mismo código
2. **Precio > Costo**: El precio de venta debe ser mayor que el costo neto
3. **Campos obligatorios**: Código, Descripción, Costo Neto, Precio, Unidad deben estar presentes
4. **Tipos de datos**: Los números deben ser válidos

---

## 🔄 Actualización de Productos Existentes

Si un **SKU ya existe** en el inventario:
- ✅ El producto se **actualizará** con los nuevos datos
- ℹ️ El precio, stock y demás campos se actualizarán
- ⚠️ Los productos desactivados se reactivarán automáticamente

---

## 📥 Exportar Inventario Actual

Para descargar tu inventario actual:

1. Ve a **Inventario**
2. Haz clic en **"Exportar CSV"** o **"Exportar Excel"**
3. Se descargará un archivo con todos tus productos
4. Puedes editarlo y volver a subirlo

---

## 💡 Consejos

1. **Usa la plantilla**: Descarga la plantilla para asegurar el formato correcto
2. **Revisa antes de subir**: Verifica que los precios sean correctos
3. **Costo Neto**: Este campo ahora es obligatorio y se usa para calcular margen
4. **Keywords**: Usa palabras clave relevantes para mejorar el matching
5. **Categorías**: Usa categorías consistentes para mejor organización

---

## ❓ Problemas Comunes

### "Error: SKU duplicado"
- **Solución**: Cada producto debe tener un código único. Verifica que no haya duplicados en tu archivo.

### "Error: Precio debe ser mayor que Costo"
- **Solución**: Asegúrate de que el "Precio de Venta" sea mayor que el "Costo Neto".

### "Error: Unidad es obligatoria"
- **Solución**: Agrega una unidad de medida para cada producto (ej: "unidad", "LT", "KG").

---

## 📞 Soporte

Si tienes problemas subiendo tu lista de precios:
1. Revisa el formato con la plantilla descargada
2. Verifica que todos los campos obligatorios estén presentes
3. Consulta la sección de "Errores" en el proceso de importación

---

**¡Listo! Ya puedes subir tu lista de precios masivamente al sistema.** ✅
