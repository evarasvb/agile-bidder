# ⚡ Evaristo - Poderes Ampliados

## 🚀 Nuevas Capacidades de Evaristo

Evaristo ahora tiene **mucho más poder de acción** y puede trabajar de forma autónoma en múltiples tareas.

---

## 🎯 Nuevas Acciones Disponibles

### 1. **Aplicar Migraciones de Supabase** 🔄
```json
{
  "tipo": "migrar",
  "instruccion": "Aplica todas las migraciones pendientes"
}
```

**Uso**: Evaristo puede aplicar migraciones automáticamente desde el frontend o de forma programada.

### 2. **Ejecutar Comandos Git** 🔀
```json
{
  "tipo": "git",
  "accion": "status",
  "parametros": []
}
```

**Ejemplos**:
- `git status` - Ver estado del repositorio
- `git log` - Ver historial
- `git diff` - Ver cambios

### 3. **Ejecutar Comandos de Supabase CLI** 🗄️
```json
{
  "tipo": "supabase",
  "accion": "db push",
  "parametros": []
}
```

**Ejemplos**:
- `supabase db push` - Aplicar migraciones
- `supabase db pull` - Sincronizar schema
- `supabase migration list` - Listar migraciones

### 4. **Ejecutar Comandos del Sistema** ⚙️
```json
{
  "tipo": "comando",
  "comando": "npm run build",
  "instruccion": "Compila el proyecto"
}
```

**Ejemplos**:
- `npm run build` - Compilar proyecto
- `npm run type-check` - Verificar tipos TypeScript
- `npm run lint` - Ejecutar linter

### 5. **Revisar y Optimizar Archivos** 🔍
```json
{
  "tipo": "revisar",
  "archivo": "src/components/Componente.tsx",
  "instruccion": "Optimiza este componente"
}
```

### 6. **Modificar Archivos con IA** ✏️
```json
{
  "tipo": "modificar",
  "archivo": "src/hooks/useHook.ts",
  "instruccion": "Mejora este hook para que sea más eficiente"
}
```

---

## 📋 Misión: Poderes Ampliados

Nueva misión predefinida: `poderes_ampliados.json`

**Acciones incluidas**:
1. ✅ Aplicar migraciones de Supabase
2. ✅ Verificar estado de Git
3. ✅ Verificar migraciones pendientes
4. ✅ Verificar compilación TypeScript
5. ✅ Ejecutar linter
6. ✅ Instalar dependencias
7. ✅ Revisar y optimizar hooks
8. ✅ Mejorar componentes

---

## 💬 Comandos desde el Chat

Desde `www.firmavb.cl/admin/evaristo` (pestaña "Conversar"):

### Comandos Básicos:
- **"revisar"** → Revisa todo el proyecto
- **"mision"** → Ejecuta misión predefinida
- **"mision poderes_ampliados"** → Ejecuta poderes ampliados

### Nuevos Comandos:
- **"migraciones"** → Aplica migraciones de Supabase
- **"poderes ampliados"** → Activa todas las capacidades mejoradas
- **"ayuda"** → Muestra todos los comandos disponibles

---

## 🎛️ Panel de Control

Desde `www.firmavb.cl/admin/evaristo` (pestaña "Panel de Control"):

### Acciones Disponibles:
1. **Revisar Proyecto**: Ejecuta revisión completa del código
2. **Ejecutar Misión**: Selecciona y ejecuta una misión predefinida
   - `mision_completa_firmavb.json` - Optimización total
   - `poderes_ampliados.json` - Nuevas capacidades
   - `mantenimiento_automatico.json` - Mantenimiento diario

### API Keys (Opcionales):
- Puedes proporcionar API keys de Gemini o DeepSeek para override
- Si no se proporcionan, usa las configuradas en Supabase Secrets

---

## ⚙️ Configuración Automática

### Variables de Entorno (Supabase Secrets):
```
GEMINI_API_KEY=tu_api_key
DEEPSEEK_API_KEY=tu_api_key
```

### Ejecución Automática (Cron Job):
```bash
# Ejecutar mantenimiento automático cada 24 horas
0 2 * * * cd /ruta/al/proyecto && python3 evaristo/evaristo_autonomo.py >> evaristo/logs/autonomo.log 2>&1
```

---

## 🚀 Ejemplos de Uso

### Ejemplo 1: Aplicar Migraciones
```bash
# Desde terminal
python3 evaristo/evaristo_manager.py mision poderes_ampliados.json

# Desde frontend
Chat: "migraciones"
```

### Ejemplo 2: Optimizar Componente
```json
{
  "nombre": "Optimizar MatchPanel",
  "tipo": "modificar",
  "archivo": "src/components/compras-agiles/MatchPanel.tsx",
  "instruccion": "Optimiza el rendimiento, mejora la UX y asegúrate de que no haya memory leaks"
}
```

### Ejemplo 3: Verificar Proyecto
```bash
# Desde terminal
python3 evaristo/evaristo_manager.py revisar

# Desde frontend
Chat: "revisar"
```

---

## 📊 Reportes

Evaristo genera reportes detallados en:
- `evaristo/reportes/reporte_YYYYMMDD_HHMMSS.json`
- `evaristo/reportes/resumen_latest.json`

Cada reporte incluye:
- ✅ Estado de cada tarea
- ✅ Salida de comandos
- ✅ Errores (si los hay)
- ✅ Timestamp de ejecución

---

## 🔒 Seguridad

- ✅ Solo `evaras@firmavb.cl` puede acceder
- ✅ Validación de email en Edge Function
- ✅ Verificación de autenticación en hooks
- ✅ Logs detallados de todas las acciones

---

## 💡 Mejores Prácticas

1. **Revisa primero**: Antes de modificar, ejecuta "revisar" para ver el estado
2. **Backups automáticos**: Evaristo crea backups antes de modificar archivos
3. **Prueba misiones pequeñas**: Empieza con misiones pequeñas antes de ejecutar la completa
4. **Revisa reportes**: Siempre revisa los reportes después de ejecutar misiones

---

## 🎯 Próximas Mejoras

Evaristo puede evolucionar para:
- 🤖 Ejecutar tests automáticamente
- 🔄 Sincronizar con repositorio remoto
- 📊 Generar reportes de métricas
- 🐛 Detectar y corregir bugs automáticamente
- ⚡ Optimizar rendimiento de forma continua

---

**Evaristo ahora tiene más poder y puede trabajar de forma más autónoma** ⚡🤖
