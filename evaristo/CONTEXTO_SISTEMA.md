# 📚 Contexto del Sistema para Evaristo

## 🎯 Regla de Negocio Crítica

### Clasificación de Procesos por Monto (MercadoPúblico)

**DISTINCIÓN FUNDAMENTAL:**

- **COMPRAS ÁGILES**: Monto **<= 100 UTM** (L1 - Licitación Pública Menor)
  - Plazo mínimo: 5 días corridos
  - NO exigen Garantía de Seriedad generalmente
  - Firma Simple suficiente

- **LICITACIONES**: Monto **> 100 UTM**
  - **LE**: 100 a 1.000 UTM (Intermedia, 10 días, garantía discrecional)
  - **LP**: 1.000 a 5.000 UTM (Mayor, 20 días, requiere FEA y garantía 5%)
  - **LR**: > 5.000 UTM (Gran Compra, 30 días, máxima rigurosidad)

### Valores Actuales (Enero 2026)

- **UTM Enero 2026**: $69.751 CLP (Banco Central)
- **Umbral Compra Ágil**: 100 UTM = **$6.975.100 CLP**
- **Umbral LE**: 1.000 UTM = **$69.751.000 CLP**
- **Umbral LP**: 5.000 UTM = **$348.755.000 CLP**

### Implementación

```typescript
// src/utils/clasificacion.ts
const UMBRAL_LICITACION_CLP = 100 * 69751; // $6.975.100

function esLicitacion(monto: number): boolean {
  return monto > UMBRAL_LICITACION_CLP;
}

function esCompraAgil(monto: number): boolean {
  return monto <= UMBRAL_LICITACION_CLP;
}
```

## 📊 Estructura de Datos

### Tablas en Supabase

1. **`licitaciones`**: TODOS los procesos (licitaciones + compras ágiles)
2. **`compras_agiles`**: SOLO procesos <= 100 UTM
3. **`licitacion_items`**: Productos solicitados (relacionados por código)

### Flujo de Datos

```
Scraper → Extrae procesos
  ↓
Clasifica por monto
  ↓
> 100 UTM → Solo a `licitaciones`
<= 100 UTM → A `licitaciones` Y `compras_agiles`
```

## 🔧 Archivos Clave

- `scraper.js`: Clasifica y guarda según regla
- `src/utils/clasificacion.ts`: Utilidades de clasificación
- `src/hooks/useLicitaciones.ts`: Lee de `compras_agiles`
- `src/hooks/useComprasAgiles.ts`: Lee de `compras_agiles`

## ⚠️ Importante para Evaristo

Cuando modifiques código relacionado con procesos de compra:

1. **SIEMPRE** verificar el monto antes de clasificar
2. **NO** guardar licitaciones (> 100 UTM) en `compras_agiles`
3. **USAR** `clasificacion.ts` para determinar tipo
4. **ACTUALIZAR** UTM mensualmente según Banco Central

## 🔄 Actualización de UTM

**Cada mes**, actualizar en:
- `scraper.js`: Constante `UTM_2026`
- `src/utils/clasificacion.ts`: Constante `UTM_ACTUAL`

Fuente: https://si3.bcentral.cl/bdemovil/BDE/Series/MOV_SC_PR12

---

**Última actualización**: Enero 2026
**UTM Actual**: $69.751 CLP
