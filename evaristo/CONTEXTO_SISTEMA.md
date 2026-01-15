# 📚 Contexto del Sistema para Evaristo

## 🎯 Regla de Negocio Crítica

### Clasificación de Procesos por Monto

**DISTINCIÓN FUNDAMENTAL:**

- **LICITACIONES**: Monto **> 100 UTM**
- **COMPRAS ÁGILES**: Monto **<= 100 UTM**

### Valores Actuales (Enero 2026)

- **UTM Enero 2026**: $69.751 CLP
- **Umbral de Licitación**: 100 UTM = **$6.975.100 CLP**

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
