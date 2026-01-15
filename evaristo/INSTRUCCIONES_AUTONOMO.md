# 🤖 Instrucciones para Evaristo Autónomo

## 🎯 Objetivo

Evaristo mantiene **www.firmavb.cl** 100% operativo, funcional y óptimo de forma automática, trabajando como tu asistente personal de programación y diseño.

## 🔒 Acceso Exclusivo

**Solo para**: `evaras@firmavb.cl`

### Protecciones:
- ✅ Frontend: Solo tu email puede ver la página
- ✅ Backend: Edge Function valida email
- ✅ Hooks: Verifican email antes de ejecutar

## 🚀 Cómo Acceder

1. **Inicia sesión** con `evaras@firmavb.cl`
2. **Ve a**: `www.firmavb.cl/admin/evaristo`
3. **O desde el menú lateral**: Verás "Evaristo" solo si eres tú

## 💬 Cómo Usar Evaristo

### Como Asistente de Programación:

**En el Chat** (`/admin/evaristo` → Pestaña "Conversar"):

```
Tú: revisa el código de matching
Evaristo: ✅ Revisando motor de matching...

Tú: optimiza el frontend de Compras Ágiles
Evaristo: ✅ Optimizando diseño y rendimiento...

Tú: mejora el diseño para que se vea más profesional
Evaristo: ✅ Aplicando mejoras de diseño...
```

### Como Mantenedor Automático:

**Configurar ejecución automática cada 24 horas:**

#### Opción 1: Script Local (Desarrollo)
```bash
./evaristo/start-autonomo.sh
```

#### Opción 2: Cron Job (Producción)
```bash
# Agregar a crontab (ejecuta cada día a las 2 AM)
0 2 * * * cd /ruta/al/proyecto && python3 evaristo/evaristo_autonomo.py >> evaristo/logs/autonomo.log 2>&1
```

#### Opción 3: Servicio Systemd (Linux)
Crear servicio que ejecute `evaristo_autonomo.py` cada 24 horas

## 📋 Misiones Disponibles

### Mantenimiento Automático (Cada 24 horas)
- Verifica compilación
- Optimiza hooks y servicios
- Revisa componentes frontend
- Verifica funciones Edge
- Mejora diseño UI/UX
- Optimiza rendimiento
- Revisa seguridad
- Actualiza documentación

### Misión Completa FirmaVB
- Optimización total del proyecto
- Extracción, matching, frontend, branding

## 📊 Reportes

Evaristo genera reportes en:
- `evaristo/reportes/mantenimiento_auto_*.json`
- `evaristo/reportes/resumen_latest.json`

## 🎯 Comandos del Chat

- **"revisar"** → Revisa todo el proyecto
- **"mision"** → Ejecuta misión completa
- **"optimiza [componente]"** → Optimiza componente específico
- **"mejora [página]"** → Mejora diseño de página
- **"verifica [archivo]"** → Verifica archivo específico
- **"ayuda"** → Muestra comandos disponibles

## 🔧 Configuración

### API Keys (en Supabase Secrets):
```
GEMINI_API_KEY=AIzaSyAEOUdrAXyBW5Pws0EIAgNDVJmnW_jAiag
DEEPSEEK_API_KEY=sk-58fc334d3e4443c4a0fecf2bc8aaa178
```

### Variables de Entorno (Local):
```bash
export GEMINI_API_KEY="tu-api-key"
export DEEPSEEK_API_KEY="tu-api-key"
```

## ⚡ Inicio Rápido

1. **Acceder**: `www.firmavb.cl/admin/evaristo`
2. **Chat**: Escribe "revisar" o "ayuda"
3. **Automático**: Configura cron job para mantenimiento diario

---

**Evaristo está listo para mantener tu proyecto 100% operativo** 🤖✨
