# 🚀 Cómo Activar a Evaristo

## Paso 1: Instalar Python (si no lo tienes)

```bash
# Verificar si tienes Python
python --version

# Si no lo tienes, instálalo desde python.org
```

## Paso 2: Instalar dependencias de Python

```bash
pip install google-generativeai
```

## Paso 3: Configurar API Key de Gemini (GRATIS)

### Obtener API Key (Gratis)

1. Ve a: https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia tu API key

### Opción A: Variable de entorno (RECOMENDADO)

```bash
# Linux/Mac
export GEMINI_API_KEY="tu-api-key-aqui"
# O también funciona:
export GOOGLE_API_KEY="tu-api-key-aqui"

# Windows (PowerShell)
$env:GEMINI_API_KEY="tu-api-key-aqui"

# Windows (CMD)
set GEMINI_API_KEY=tu-api-key-aqui
```

### Opción B: Archivo .env

Crea un archivo `.env` en la raíz del proyecto:
```
GEMINI_API_KEY=tu-api-key-aqui
```

## Paso 4: Ejecutar Evaristo

```bash
# Desde la raíz del proyecto
npm run evaristo

# O directamente
python evaristo/evaristo_manager.py revisar
```

## 🎯 Uso Diario

### Revisión Completa (Recomendado)
```bash
npm run evaristo
```

Esto ejecutará todas las misiones predefinidas:
- ✅ Verificar que el proyecto compile
- ✅ Revisar hooks de compras ágiles
- ✅ Revisar páginas principales
- ✅ Revisar funciones Edge
- ✅ Revisar sistema de matching

### Misión Personalizada

1. Crea un archivo JSON en `evaristo/misiones/`:
```json
{
  "nombre": "Arreglar bug en componente X",
  "tipo": "revisar",
  "archivo": "src/components/X.tsx",
  "instruccion": "Corrige el error de TypeScript en la línea 45 y optimiza el renderizado"
}
```

2. Ejecuta:
```bash
npm run evaristo:mision tu_mision.json
```

## 📊 Ver Resultados

### Reporte Resumido
```bash
cat evaristo/reportes/resumen_latest.json
```

### Ver Logs
```bash
tail -f evaristo/evaristo.log
```

## 🔄 Automatización (Opcional)

### Ejecutar cada hora (Linux/Mac)

```bash
# Agregar a crontab
crontab -e

# Agregar esta línea (ejecuta cada hora)
0 * * * * cd /ruta/a/agile-bidder && npm run evaristo
```

### Ejecutar cada día (Windows)

Usa el Programador de Tareas de Windows para ejecutar:
```
python evaristo/evaristo_manager.py revisar
```

## ⚠️ Importante

- Evaristo **SIEMPRE** hace backup antes de modificar código
- Los backups están en `evaristo/backups/`
- Puedes restaurar cualquier versión anterior
- Revisa los reportes antes de hacer commit

## 🆘 Problemas Comunes

### "No module named 'openai'"
```bash
pip install openai
```

### "No hay API_KEY configurada"
```bash
export OPENAI_API_KEY="sk-tu-key"
```

### "Archivo no encontrado"
Asegúrate de estar en la raíz del proyecto:
```bash
cd /ruta/completa/a/agile-bidder
```

---

**¡Evaristo está listo para trabajar!** 🤖✨
