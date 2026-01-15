# 🔧 Configuración de Evaristo - Repositorio

## 📍 Repositorio Principal

**GitHub**: `evarasvb/CompraAgil_VB`  
**Local**: `/Users/marketingdiseno/CompraAgil_VB/`

## 🎯 Frontend (www.firmavb.cl)

**Ubicación**: `CompraAgil_VB/mercadopublico-scraper/agile-bidder/`

## 🤖 Evaristo - Rutas Configuradas

Evaristo está configurado para trabajar sobre:

```python
# En evaristo_manager.py
PROYECTO_ROOT = Path(__file__).parent.parent  # agile-bidder/
REPOSITORIO_ROOT = PROYECTO_ROOT.parent.parent  # CompraAgil_VB/
FRONTEND_ROOT = PROYECTO_ROOT                   # agile-bidder/
```

**Estructura**:
```
CompraAgil_VB/                          # Repositorio principal
└── mercadopublico-scraper/
    └── agile-bidder/                    # Frontend (www.firmavb.cl)
        └── evaristo/                    # Evaristo aquí
            └── evaristo_manager.py
```

## ✅ Verificación

Evaristo trabaja sobre:
- ✅ **Repositorio**: `CompraAgil_VB`
- ✅ **Directorio principal**: `mercadopublico-scraper/agile-bidder/`
- ✅ **Objetivo**: Mantener www.firmavb.cl operativo

## 📋 Misiones de Evaristo

Evaristo mantiene automáticamente:
- Frontend React (src/)
- Extensión Chrome (chrome-extension/)
- Edge Functions (supabase/functions/)
- Migraciones SQL (supabase/migrations/)
- Documentación (README.md, etc.)

---

**Evaristo está listo para mantener www.firmavb.cl** 🤖✨
