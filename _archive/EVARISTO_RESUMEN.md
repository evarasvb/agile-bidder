# 🤖 Evaristo - Tu Programador Autónomo

## ✅ ¿Qué es Evaristo?

Evaristo es un **programador autónomo** que:
- ✅ Revisa 100% del código de FirmaVB
- ✅ Corrige errores automáticamente
- ✅ Optimiza el rendimiento
- ✅ Mantiene el proyecto funcionando
- ✅ Trabaja sin supervisión
- ✅ Reporta todo lo que hace

## 🚀 Inicio Rápido (3 pasos)

### 1. Instalar Python (si no lo tienes)
```bash
python3 --version  # Verificar
```

### 2. Instalar dependencias
```bash
pip install google-generativeai
```

### 3. Configurar API Key (GRATIS) y ejecutar

**Obtén tu API Key gratis:**
1. Ve a https://makersuite.google.com/app/apikey
2. Crea una API key
3. Configúrala:

```bash
export GEMINI_API_KEY="tu-api-key"
npm run evaristo
```

## 📍 ¿Dónde vive Evaristo?

Evaristo vive en la carpeta `evaristo/` en la raíz del proyecto:

```
agile-bidder/
├── evaristo/
│   ├── evaristo_manager.py  ← El cerebro de Evaristo
│   ├── README.md            ← Documentación completa
│   ├── INSTRUCCIONES.md     ← Guía paso a paso
│   ├── backups/             ← Backups automáticos
│   ├── reportes/            ← Reportes de misiones
│   └── misiones/            ← Misiones personalizadas
```

## 🎯 ¿Qué hace Evaristo automáticamente?

Cuando ejecutas `npm run evaristo`, Evaristo:

1. ✅ **Verifica compilación** - Asegura que todo compile
2. ✅ **Revisa hooks** - Optimiza useComprasAgiles, useMatching, etc.
3. ✅ **Revisa páginas** - Verifica ComprasAgiles.tsx, Licitaciones.tsx
4. ✅ **Revisa funciones Edge** - Valida sync-compras-agiles
5. ✅ **Revisa matching** - Optimiza el sistema de matching
6. ✅ **Genera reportes** - Te dice exactamente qué hizo

## 📊 Reportes Simples

Después de cada ejecución, Evaristo genera:

1. **Reporte resumido**: `evaristo/reportes/resumen_latest.json`
   - Misiones completadas
   - Errores encontrados
   - Archivos modificados

2. **Logs detallados**: `evaristo/evaristo.log`
   - Todo lo que hizo paso a paso

## 🛡️ Seguridad

- ✅ **Siempre hace backup** antes de modificar
- ✅ Backups en `evaristo/backups/`
- ✅ Puedes restaurar cualquier versión
- ✅ No modifica sin tu aprobación (puedes revisar primero)

## 💡 Uso Diario

### Revisión completa (recomendado)
```bash
npm run evaristo
```

### Misión específica
```bash
# Crear misión en evaristo/misiones/mi_mision.json
npm run evaristo:mision mi_mision.json
```

### Ver qué hizo
```bash
cat evaristo/reportes/resumen_latest.json
```

## 🔄 Automatización (Opcional)

Puedes programar Evaristo para que se ejecute automáticamente:

### Cada hora (Linux/Mac)
```bash
crontab -e
# Agregar: 0 * * * * cd /ruta/proyecto && npm run evaristo
```

### Cada día (Windows)
Usar Programador de Tareas para ejecutar:
```
python evaristo/evaristo_manager.py revisar
```

## 📝 Ejemplo de Misión Personalizada

Crea `evaristo/misiones/arreglar_bug.json`:
```json
{
  "nombre": "Arreglar error en componente",
  "tipo": "revisar",
  "archivo": "src/components/X.tsx",
  "instruccion": "Corrige el error de TypeScript en la línea 45"
}
```

Ejecuta:
```bash
npm run evaristo:mision arreglar_bug.json
```

## 🎯 Ventajas

✅ **No necesitas supervisar** - Evaristo trabaja solo
✅ **Reportes claros** - Sabes exactamente qué hizo
✅ **Seguro** - Siempre hace backup
✅ **Inteligente** - Usa IA para mejorar código
✅ **Rápido** - Revisa todo en minutos

## 🚨 Si algo sale mal

1. Revisa el log: `cat evaristo/evaristo.log`
2. Revisa el reporte: `cat evaristo/reportes/resumen_latest.json`
3. Restaura desde backup: `evaristo/backups/`

---

**Evaristo está listo para trabajar 24/7 en FirmaVB** 🤖✨

Ejecuta `npm run evaristo` y déjalo trabajar.
