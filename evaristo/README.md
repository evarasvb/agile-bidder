# 🤖 Evaristo - Programador Autónomo de FirmaVB

Evaristo es tu programador autónomo que mantiene, mejora y programa el sistema FirmaVB sin necesidad de supervisión constante.

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
pip install google-generativeai
```

### 2. Configurar API Key de Gemini

```bash
# Opción 1: Variable de entorno (recomendado)
export GEMINI_API_KEY="tu-api-key-aqui"
# O también funciona:
export GOOGLE_API_KEY="tu-api-key-aqui"

# Opción 2: Editar evaristo_manager.py
# Busca la línea: API_KEY = os.getenv("GEMINI_API_KEY", ...)
# Y agrégalo directamente (menos seguro)
```

**Obtén tu API Key gratis:**
1. Ve a https://makersuite.google.com/app/apikey
2. Inicia sesión con tu cuenta de Google
3. Crea una nueva API key
4. Cópiala y configúrala como variable de entorno

### 3. Ejecutar Evaristo

```bash
# Revisión completa del proyecto
python evaristo/evaristo_manager.py revisar

# O simplemente (hace lo mismo)
python evaristo/evaristo_manager.py
```

## 📋 Funcionalidades

### ✅ Revisión Automática
- Revisa el código completo del proyecto
- Detecta y corrige errores
- Optimiza el rendimiento
- Mejora la calidad del código

### 🛡️ Seguridad
- **Siempre hace backup** antes de modificar código
- Los backups se guardan en `evaristo/backups/`
- Puedes restaurar cualquier versión anterior

### 📊 Reportes
- Genera reportes detallados de cada misión
- Reportes guardados en `evaristo/reportes/`
- Resumen final en `evaristo/reportes/resumen_latest.json`

## 🎯 Misiones Predefinidas

Evaristo ejecuta automáticamente estas misiones:

1. **Verificar compilación** - Asegura que el proyecto compile sin errores
2. **Revisar hooks** - Optimiza los hooks de React Query
3. **Revisar páginas** - Verifica componentes y handlers
4. **Revisar funciones Edge** - Valida funciones de Supabase
5. **Revisar matching** - Optimiza el sistema de matching

## 📝 Crear Misiones Personalizadas

Crea un archivo JSON en `evaristo/misiones/`:

```json
{
  "nombre": "Optimizar componente X",
  "tipo": "revisar",
  "archivo": "src/components/X.tsx",
  "instruccion": "Optimiza este componente para mejor rendimiento y corrige cualquier error de TypeScript"
}
```

Luego ejecuta:
```bash
python evaristo/evaristo_manager.py mision tu_mision.json
```

## 📁 Estructura

```
evaristo/
├── evaristo_manager.py    # Código principal de Evaristo
├── README.md              # Esta documentación
├── backups/              # Backups automáticos
├── reportes/             # Reportes de misiones
│   └── resumen_latest.json  # Último resumen
└── misiones/             # Misiones personalizadas
```

## 🔍 Ver Reportes

```bash
# Ver último resumen
cat evaristo/reportes/resumen_latest.json

# Ver todos los reportes
ls -la evaristo/reportes/
```

## ⚙️ Configuración Avanzada

### Cambiar modelo de IA

En `evaristo_manager.py`, busca:
```python
model="gpt-4o-mini",  # Cambia por el modelo que prefieras
```

Opciones:
- `gpt-4o-mini` - Rápido y económico (recomendado)
- `gpt-4o` - Más inteligente pero más caro
- `gpt-4-turbo` - Balance entre velocidad e inteligencia

### Agregar más misiones

Edita la función `revisar_proyecto_completo()` en `evaristo_manager.py` y agrega más misiones al array `misiones`.

## 🚨 Solución de Problemas

### "No hay API_KEY configurada"
```bash
export OPENAI_API_KEY="sk-tu-key"
```

### "OpenAI no instalado"
```bash
pip install openai
```

### "Archivo no encontrado"
Asegúrate de ejecutar el script desde la raíz del proyecto:
```bash
cd /ruta/a/agile-bidder
python evaristo/evaristo_manager.py revisar
```

## 📞 Logs

Todos los logs se guardan en:
```
evaristo/evaristo.log
```

## 🎯 Próximas Mejoras

- [ ] Integración con GitHub Actions para ejecución automática
- [ ] Notificaciones por email/Slack
- [ ] Dashboard web para ver estado
- [ ] Misiones programadas (cron)
- [ ] Análisis de código estático integrado

---

**Evaristo trabaja 24/7 para mantener FirmaVB funcionando perfectamente** 🤖✨
