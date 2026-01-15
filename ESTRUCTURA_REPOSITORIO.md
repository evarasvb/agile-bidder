# 🗂️ Estructura del Repositorio FirmaVB

## 📍 Repositorio Principal

**GitHub**: `evarasvb/CompraAgil_VB`  
**Local**: `/Users/marketingdiseno/CompraAgil_VB/`

## 🎯 www.firmavb.cl

**Ubicación**: `CompraAgil_VB/mercadopublico-scraper/agile-bidder/`

Este es el **frontend principal** que se deploya a www.firmavb.cl

## 📁 Estructura Completa

```
CompraAgil_VB/                          # ⭐ REPOSITORIO PRINCIPAL
│
├── .git/                               # Control de versiones
├── README.md                            # Documentación principal
│
├── mercadopublico-scraper/             # Directorio de scraping
│   ├── agile-bidder/                   # ✅ FRONTEND www.firmavb.cl
│   │   ├── src/                        # React app completa
│   │   │   ├── components/             # Componentes React
│   │   │   ├── pages/                  # Páginas/rutas
│   │   │   ├── hooks/                  # Custom hooks
│   │   │   └── services/              # Servicios
│   │   ├── chrome-extension/          # Extensión Chrome
│   │   ├── evaristo/                   # 🤖 Bot autónomo
│   │   │   ├── evaristo_manager.py    # Script principal
│   │   │   ├── misiones/              # Misiones JSON
│   │   │   └── reportes/             # Reportes generados
│   │   ├── supabase/                   # Backend
│   │   │   ├── functions/             # Edge Functions
│   │   │   └── migrations/           # Migraciones SQL
│   │   └── package.json               # Dependencias frontend
│   │
│   ├── scraper.js                      # Scraper principal
│   ├── utils.js                        # Utilidades scraper
│   └── package.json                    # Dependencias scraper
│
├── agilvb_matcher.py                   # Scripts Python de matching
├── match_compra_agil.py
├── match_mercado_publico.py
├── matcher_db_adapter.py
├── run_matcher.py
│
└── supabase/                           # ⚠️ Verificar si se usa
    └── [migraciones antiguas?]
```

## 🤖 Evaristo - Configuración

**Evaristo trabaja sobre**:
- **Repositorio**: `CompraAgil_VB` (raíz)
- **Directorio principal**: `mercadopublico-scraper/agile-bidder/` (frontend)
- **Objetivo**: Mantener www.firmavb.cl 100% operativo

**Rutas en Evaristo**:
```python
PROYECTO_ROOT = Path(__file__).parent.parent  # agile-bidder/
REPOSITORIO_ROOT = PROYECTO_ROOT.parent.parent  # CompraAgil_VB/
FRONTEND_ROOT = PROYECTO_ROOT                   # agile-bidder/
```

## 🔍 Repositorios en GitHub

### ✅ Repositorio Principal (Usar)
- **`evarasvb/CompraAgil_VB`** - 69 commits
  - Contiene todo el sistema
  - www.firmavb.cl se deploya desde aquí

### ⚠️ Repositorios a Verificar

1. **`evarasvb/agile-bidder`** (TypeScript)
   - **Acción**: Verificar si es duplicado de `agile-bidder/` dentro de `CompraAgil_VB`
   - Si es duplicado → Archivar o eliminar

2. **`evarasvb/firmin-extension`** (JavaScript)
   - **Acción**: Verificar si es diferente a `chrome-extension/` en `agile-bidder`
   - Si es duplicado → Archivar o eliminar

3. **`evarasvb/firmin-scraper`** (Python)
   - **Acción**: Verificar si se usa o si está integrado en `mercadopublico-scraper/`
   - Si no se usa → Archivar o integrar

4. **`evarasvb/MercadoPublicoOCDS`** (R)
   - **Acción**: Archivar (sistema antiguo, probablemente no se usa)

## ✅ Estado Actual

- ✅ Repositorio principal identificado: `CompraAgil_VB`
- ✅ Frontend identificado: `agile-bidder/` (www.firmavb.cl)
- ✅ Evaristo configurado para trabajar sobre el repositorio correcto
- ⚠️ Verificar duplicados en GitHub
- ⚠️ Verificar carpeta `supabase/` en raíz (posible duplicado)

## 🎯 Próximos Pasos

1. **Verificar duplicados** en GitHub
2. **Archivar repositorios** no usados
3. **Limpiar estructura** local si es necesario
4. **Documentar** proceso de deploy

---

**Evaristo está configurado para mantener www.firmavb.cl operativo** 🤖✨
