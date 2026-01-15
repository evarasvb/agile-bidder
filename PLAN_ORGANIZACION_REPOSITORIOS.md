# 🗂️ Plan de Organización de Repositorios FirmaVB

## 📊 Situación Actual Verificada

### Estructura Real del Repositorio Principal

```
CompraAgil_VB/                          # ⭐ Repositorio PRINCIPAL (GitHub: evarasvb/CompraAgil_VB)
├── .git/                               # Repositorio Git principal
├── agilvb_matcher.py                   # Scripts Python de matching
├── match_compra_agil.py
├── match_mercado_publico.py
├── matcher_db_adapter.py
├── run_matcher.py
├── mercadopublico-scraper/
│   └── agile-bidder/                   # ✅ Frontend www.firmavb.cl
│       ├── src/                        # React app completa
│       ├── chrome-extension/           # Extensión Chrome
│       ├── evaristo/                   # Bot autónomo
│       ├── supabase/                   # Edge Functions + Migrations
│       └── package.json
├── supabase/                           # ⚠️ Verificar si es duplicado
└── [archivos Python de matching]
```

### Repositorios en GitHub

1. **`evarasvb/CompraAgil_VB`** ⭐ (69 commits) - **REPOSITORIO PRINCIPAL**
   - Contiene todo el sistema
   - www.firmavb.cl se deploya desde `agile-bidder/`

2. **`evarasvb/agile-bidder`** (TypeScript) - **¿DUPLICADO?**
   - Probablemente un fork o copia
   - Debería estar dentro de `CompraAgil_VB/mercadopublico-scraper/agile-bidder/`

3. **`evarasvb/firmin-scraper`** (Python) - **¿NECESARIO?**
   - Verificar si se usa o si está integrado

4. **`evarasvb/firmin-extension`** (JavaScript) - **¿DUPLICADO?**
   - Verificar si es diferente a `chrome-extension/` en `agile-bidder`

5. **`evarasvb/MercadoPublicoOCDS`** (R) - **ARCHIVAR**
   - Sistema antiguo, probablemente no se usa

## ✅ Plan de Organización

### Objetivo: Un Solo Repositorio Principal

**Repositorio único**: `evarasvb/CompraAgil_VB`

### Estructura Propuesta Final

```
CompraAgil_VB/                          # Repositorio PRINCIPAL
├── README.md                           # Documentación principal
├── .github/                            # Workflows CI/CD
│   └── workflows/
│       └── deploy.yml
├── frontend/                           # www.firmavb.cl (renombrar agile-bidder)
│   ├── src/                            # React app
│   ├── chrome-extension/               # Extensión Chrome
│   ├── evaristo/                       # Bot autónomo
│   ├── supabase/                       # Edge Functions + Migrations
│   └── package.json
├── scrapers/                           # Scripts de scraping
│   ├── python/                         # Scripts Python (agilvb_matcher.py, etc.)
│   └── README.md
├── supabase/                           # Backend compartido (si es necesario)
│   └── migrations/                     # Migraciones globales
└── docs/                               # Documentación
    ├── ARCHITECTURE.md
    ├── DEPLOY.md
    └── EVARISTO.md
```

### Acciones Inmediatas

#### 1. Verificar y Limpiar Duplicados

**Verificar**:
- [ ] ¿`evarasvb/agile-bidder` es duplicado de `CompraAgil_VB/mercadopublico-scraper/agile-bidder/`?
- [ ] ¿`evarasvb/firmin-extension` es diferente a `chrome-extension/`?
- [ ] ¿Hay dos carpetas `supabase/`?

**Acciones**:
- Si son duplicados → Archivar o eliminar repositorios en GitHub
- Si son diferentes → Integrar en repositorio principal

#### 2. Configurar Evaristo Correctamente

**Evaristo debe trabajar sobre**:
- **Repositorio**: `CompraAgil_VB` (raíz)
- **Directorio principal**: `mercadopublico-scraper/agile-bidder/` (frontend)
- **Objetivo**: Mantener www.firmavb.cl operativo

**Actualizar `evaristo_manager.py`**:
```python
PROYECTO_ROOT = Path(__file__).parent.parent.parent  # CompraAgil_VB/
FRONTEND_ROOT = PROYECTO_ROOT / "mercadopublico-scraper" / "agile-bidder"
```

#### 3. Documentar Estructura

Crear `README.md` principal en `CompraAgil_VB/` que explique:
- Estructura del proyecto
- Dónde está www.firmavb.cl
- Cómo funciona Evaristo
- Cómo hacer deploy

#### 4. Archivar Repositorios No Usados

- [ ] `evarasvb/MercadoPublicoOCDS` → Archivar (sistema antiguo)
- [ ] `evarasvb/agile-bidder` → Si es duplicado, archivar
- [ ] `evarasvb/firmin-extension` → Si es duplicado, archivar
- [ ] `evarasvb/firmin-scraper` → Si no se usa, archivar o integrar

## 🎯 Configuración de Evaristo

### Evaristo debe saber:

1. **Repositorio principal**: `CompraAgil_VB`
2. **Frontend**: `mercadopublico-scraper/agile-bidder/`
3. **Objetivo**: Mantener www.firmavb.cl operativo
4. **Scope de trabajo**: Todo el repositorio, pero enfocado en frontend

### Misiones de Evaristo:

- ✅ Mantener frontend operativo
- ✅ Verificar compilación
- ✅ Optimizar código
- ✅ Revisar integraciones
- ✅ Actualizar documentación

## 📋 Checklist de Implementación

### Fase 1: Verificación (Ahora)
- [x] Analizar estructura actual
- [ ] Verificar duplicados en GitHub
- [ ] Confirmar qué repositorios se usan

### Fase 2: Configuración (Inmediato)
- [ ] Actualizar `evaristo_manager.py` con rutas correctas
- [ ] Crear `README.md` principal
- [ ] Documentar estructura

### Fase 3: Limpieza (Próximo)
- [ ] Archivar repositorios duplicados
- [ ] Integrar código necesario
- [ ] Actualizar documentación

### Fase 4: Validación (Final)
- [ ] Verificar que Evaristo funciona
- [ ] Confirmar que www.firmavb.cl deploya correctamente
- [ ] Documentar proceso completo

## 🚀 Resultado Final

**Un solo repositorio principal** (`CompraAgil_VB`) que contiene:
- ✅ Frontend de www.firmavb.cl
- ✅ Extensión Chrome
- ✅ Evaristo (bot autónomo)
- ✅ Scripts de scraping
- ✅ Backend (Supabase)
- ✅ Documentación completa

**Evaristo trabaja sobre**:
- ✅ Repositorio: `CompraAgil_VB`
- ✅ Enfocado en: `mercadopublico-scraper/agile-bidder/` (frontend)
- ✅ Objetivo: Mantener www.firmavb.cl 100% operativo
