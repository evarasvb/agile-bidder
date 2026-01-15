# 📚 Reglas Completas de MercadoPúblico para Evaristo

## 🎯 Clasificación por Monto (UTM)

### COMPRAS ÁGILES (<= 100 UTM)

**L1 - Licitación Pública Menor**: < 100 UTM
- Plazo mínimo: **5 días corridos**
- Garantía de Seriedad: **NO exigida** generalmente
- Firma Electrónica: **Simple** suficiente
- Perfil: Compras rutinarias, alta frecuencia
- Oportunidad FirmaVB: Venta masiva de certificados de bajo costo

### LICITACIONES (> 100 UTM)

**LE - Licitación Pública Intermedia**: 100 a 1.000 UTM
- Plazo mínimo: **10 días corridos** (rebajable a 5 si bienes simples)
- Garantía de Seriedad: **Discrecional**
- Firma Electrónica: Simple (FEA discrecional)
- Perfil: Equipamiento, servicios profesionales estándar

**LP - Licitación Pública Mayor**: 1.000 a 5.000 UTM
- Plazo mínimo: **20 días corridos**
- Garantía de Seriedad: **Obligatoria** sobre 2.000 UTM
- Garantía de Fiel Cumplimiento: **5% del contrato** (obligatoria)
- Firma Electrónica: **FEA a menudo obligatoria**
- Perfil: Procesos complejos, alto valor
- Oportunidad FirmaVB: FEA obligatoria = venta de certificados avanzados

**LR - Licitación Pública de Gran Compra**: > 5.000 UTM
- Plazo mínimo: **30 días corridos**
- Garantía: **Máxima rigurosidad** (altos montos)
- Firma Electrónica: **FEA obligatoria**
- Requiere: Uniones Temporales (UTP) a menudo
- Perfil: Grandes obras, concesiones, suministros nacionales

## 📊 Valores UTM

- **UTM Enero 2026**: $69.751 CLP
- **Umbral Compra Ágil**: 100 UTM = $6.975.100 CLP
- **Umbral LE**: 1.000 UTM = $69.751.000 CLP
- **Umbral LP**: 5.000 UTM = $348.755.000 CLP

## ⚠️ Cambios Normativos 2024-2025

1. **LQ eliminada**: Categoría histórica eliminada, absorbida por L1/LE
2. **Nueva Ley N° 21.634**: Modernización de compras públicas
3. **Principio de Combinación Más Ventajosa**: No solo precio, también:
   - Costos de Ciclo de Vida
   - Sustentabilidad
   - Desarrollo Local

## 🔐 Firma Electrónica

- **Firma Simple**: Para L1 (compras ágiles)
- **FEA (Firma Electrónica Avanzada)**: Obligatoria para LP, LR, y a menudo LE

## 💰 Garantías

- **Seriedad de Oferta**: Obligatoria sobre 2.000 UTM
- **Fiel Cumplimiento**: 5-30% del contrato, obligatoria > 1.000 UTM

## 📡 API MercadoPúblico

- **Endpoint**: `http://api.mercadopublico.cl/servicios/v1/publico/`
- **Horario Masivo**: 22:00 - 07:00 hrs (consultas masivas)
- **Horario Transaccional**: 07:01 - 21:59 hrs (consultas puntuales)
- **Formato**: JSON recomendado

## 🏷️ Códigos de Estado

- **5**: Publicada (activa, recibiendo ofertas)
- **6**: Cerrada (en evaluación)
- **7**: Desierta (sin ofertas, oportunidad para Trato Directo)
- **8**: Adjudicada (finalizada con ganador)
- **18**: Revocada (cancelada)
- **19**: Suspendida (pausada)

## 📦 UNSPSC (Clasificación de Productos)

Estructura jerárquica:
- **Segmento** (XX.00.00.00): Agrupación macro
- **Familia** (XX.XX.00.00): Grupo interrelacionado
- **Clase** (XX.XX.XX.00): Categoría específica
- **Producto** (XX.XX.XX.XX): Bien preciso

**Estrategia de búsqueda**: No solo coincidencia exacta, también buscar en Clase y Familia para capturar mal clasificados.

## 🎯 Para Evaristo

Cuando modifiques código relacionado con procesos:

1. **SIEMPRE** clasificar por monto usando UTM
2. **RESPETAR** la distinción: <= 100 UTM = Compra Ágil, > 100 UTM = Licitación
3. **CONSIDERAR** requisitos según categoría (FEA, garantías, plazos)
4. **ACTUALIZAR** UTM mensualmente según Banco Central
5. **NO USAR** categoría LQ (eliminada)

---

**Fuente**: Informe de Inteligencia Técnica y Estratégica - Ecosistema de Compras Públicas
**Última actualización**: Enero 2026
