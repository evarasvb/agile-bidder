# Guía de Implementación - Nuevas Funcionalidades

## 📦 Resumen de Cambios

Esta actualización incluye tres mejoras principales:

1. **Tabla Virtualizada de Inventario** - Manejo eficiente de +16,000 productos
2. **ErrorBoundary** - Captura y manejo de errores en producción
3. **Sistema de Auto-Ofertas** - Generación automática de ofertas para Compras Ágiles

## 🚀 Pasos de Implementación
### 1. Instalar Dependencias

```bash
npm install @tanstack/react-virtual
```

### 2. Ejecutar Migración de Base de Datos

**Opción A: Supabase CLI (Recomendado)**
```bash
supabase db push
```

**Opción B: Supabase Dashboard**
1. Ir a [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Copiar y ejecutar el contenido de `supabase/migrations/20260127_auto_bids_schema.sql`

### 3. Usar el ErrorBoundary

Envuelve tus páginas con `<ErrorBoundary>` para capturar errores:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Instituciones() {
  return (
    <ErrorBoundary>
      <YourPageContent />
    </ErrorBoundary>
  );
}
```

### 4. Usar la Tabla Virtualizada

Reemplaza tu tabla de inventario actual con:

```tsx
import { VirtualizedInventoryTable } from '@/components/VirtualizedInventoryTable';

export function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <VirtualizedInventoryTable
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    />
  );
}
```

### 5. Configurar Auto-Ofertas

**Crear ruta en tu router:**

```tsx
import { AutoBidsConfig } from '@/components/auto-bids/AutoBidsConfig';

// En tu App.tsx o router
<Route path="/auto-bids" element={<AutoBidsConfig />} />
```

**Integrar con tu sistema de matching:**

```tsx
import { processMatchesForAutoBids } from '@/lib/auto-bidder';

// Después de obtener matches de MercadoPublico
const matches = await fetchMatchesFromMercadoPublico();
await processMatchesForAutoBids(matches);
```

## 📊 Arquitectura del Sistema de Auto-Ofertas

### Flujo de Datos

```
1. Configuración (UI)
   ↓
2. Almacenamiento (auto_bids table)
   ↓
3. Matching con Licitaciones
   ↓
4. Cálculo de Precios Competitivos
   ↓
5. Generación de Oportunidades (auto_bid_opportunities table)
   ↓
6. Revisión y Envío
```

### Tablas de Base de Datos

#### `auto_bids`
- **Propósito**: Configuración de productos para auto-ofertas
- **Campos clave**:
  - `codigo_producto`: Código SKU del producto
  - `precio_base`: Precio de costo
  - `margen_minimo`: Margen mínimo aceptable (%)
  - `tope_descuento`: Descuento máximo permitido (%)
  - `prioridad`: Orden de procesamiento

#### `auto_bid_opportunities`
- **Propósito**: Oportunidades generadas automáticamente
- **Campos clave**:
  - `licitacion_id`: ID de la licitación en MercadoPublico
  - `precio_sugerido`: Precio calculado automáticamente
  - `margen_calculado`: Margen real de la oferta
  - `estado`: pendiente | enviada | ganada | perdida
  - `match_score`: Puntuación de coincidencia (0-100)

## 🔧 Configuración Recomendada

### Parámetros de Auto-Ofertas

| Producto | Precio Base | Margen Mínimo | Tope Descuento | Prioridad |
|----------|-------------|----------------|----------------|------------|
| Alta Rotación | Variable | 10-15% | 20-30% | Alta (>50) |
| Margen Estándar | Variable | 15-20% | 15-25% | Media (25-50) |
| Productos Premium | Variable | 25-35% | 10-15% | Baja (<25) |

### Estrategia de Precios

El sistema calcula precios usando:

```typescript
precio_objetivo = precio_mercado * 0.97  // 3% bajo el mercado
precio_final = Math.max(precio_minimo, precio_objetivo)
```

## ⚙️ Variables de Entorno

Asegúrate de tener configuradas:

```env
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

## 🐛 Troubleshooting

### Error: "Table 'auto_bids' does not exist"
**Solución**: Ejecuta la migración SQL en Supabase

### Error: "Module not found: @tanstack/react-virtual"
**Solución**: Ejecuta `npm install @tanstack/react-virtual`

### Tabla virtualizada no renderiza correctamente
**Solución**: Verifica que el contenedor padre tenga una altura definida

### Auto-ofertas no se generan
**Solución**: 
1. Verifica que `systemActive` esté en `true`
2. Confirma que los productos estén marcados como `activo: true`
3. Revisa que el `margen_calculado >= margen_minimo`

## 📝 Próximos Pasos

1. **Testing**: Probar el sistema con datos reales de MercadoPublico
2. **Monitoreo**: Configurar alertas para oportunidades generadas
3. **Optimización**: Ajustar parámetros según resultados
4. **Automatización**: Integrar con sistema de envío automático de ofertas

## 📞 Soporte

Para dudas o problemas:
- Revisar logs en Supabase Dashboard
- Verificar consola del navegador
- Consultar documentación de [Tanstack Virtual](https://tanstack.com/virtual/latest)

---

**Versión**: 1.0.0  
**Fecha**: 27 de enero, 2026  
**Stack**: React + TypeScript + Vite + Tailwind CSS + Radix UI + Supabase