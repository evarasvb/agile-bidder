# 🤖 Documentación Completa de Evaristo

**Evaristo** es un bot autónomo programador que mantiene, mejora y programa el sistema FirmaVB sin necesidad de supervisión constante.

---

## 📍 Ubicación en el Proyecto

### Estructura de Directorios

```
agile-bidder/
├── evaristo/                          # 📁 Directorio principal de Evaristo
│   ├── evaristo_manager.py            # 🎯 Script principal (888 líneas)
│   ├── evaristo_autonomo.py          # 🔄 Script de mantenimiento automático (116 líneas)
│   ├── README.md                      # 📖 Documentación básica
│   ├── backups/                       # 💾 Backups automáticos de archivos modificados
│   ├── reportes/                      # 📊 Reportes de ejecución (43 archivos JSON)
│   ├── misiones/                      # 🎯 Misiones predefinidas
│   │   ├── mantenimiento_automatico.json
│   │   ├── mision_completa_firmavb.json
│   │   └── ejemplo.json
│   ├── evaristo.log                   # 📝 Log de ejecuciones
│   └── [varios archivos .md de documentación]
│
├── src/
│   ├── hooks/
│   │   └── useEvaristo.ts             # 🔌 Hook React para interactuar con Evaristo (130 líneas)
│   ├── components/
│   │   └── evaristo/
│   │       ├── EvaristoPanel.tsx     # 🎛️ Panel de control (197 líneas)
│   │       └── EvaristoChat.tsx      # 💬 Chat interactivo (291 líneas)
│   └── pages/
│       └── AdminEvaristo.tsx         # 📄 Página de administración (134 líneas)
│
└── supabase/
    └── functions/
        └── evaristo-api/
            └── index.ts              # 🌐 Edge Function API (151 líneas)
```

**Ruta absoluta del proyecto**: `/Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder/`

---

## 🎯 ¿Qué es Evaristo?

Evaristo es un **programador autónomo** que:

1. **Mantiene el código** - Revisa y corrige errores automáticamente
2. **Optimiza el rendimiento** - Mejora queries, reduce re-renders, optimiza algoritmos
3. **Mejora la calidad** - Aplica mejores prácticas, corrige tipos TypeScript
4. **Genera reportes** - Documenta todo lo que hace
5. **Hace backups** - Siempre respalda antes de modificar código

### Personalidad del Agente

Evaristo se define como un **Ingeniero de Software Senior** experto en:
- TypeScript/React
- Supabase (PostgreSQL, Edge Functions)
- Node.js y ecosistema moderno
- Arquitectura de software y mejores prácticas

---

## 🔧 ¿Cómo Funciona?

### Arquitectura

```
┌─────────────────┐
│  Frontend React │
│  /admin/evaristo│
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐
│  Edge Function  │
│ evaristo-api    │
└────────┬────────┘
         │ Deno.run
         ▼
┌─────────────────┐
│ evaristo_manager│
│     .py         │
└────────┬────────┘
         │
         ├─► Lee archivos del proyecto
         ├─► Envía código a IA (Gemini/DeepSeek)
         ├─► Recibe código mejorado
         ├─► Hace backup
         └─► Guarda cambios
```

### Flujo de Ejecución

1. **Usuario** accede a `/admin/evaristo` (solo email `evaras@firmavb.cl`)
2. **Frontend** llama a Edge Function `evaristo-api`
3. **Edge Function** ejecuta `evaristo_manager.py` usando `Deno.run`
4. **Evaristo** lee código, lo analiza con IA, mejora y guarda
5. **Reporte** se genera en `evaristo/reportes/`

---

## 💻 Código Principal

### 1. `evaristo_manager.py` (Script Principal)

**Ubicación**: `evaristo/evaristo_manager.py`  
**Líneas**: 888  
**Función**: Script principal que ejecuta todas las misiones

**Características principales**:

```python
class Evaristo:
    def __init__(self):
        # Soporta múltiples proveedores de IA
        # Orden: Gemini → DeepSeek → Ollama (fallback)
        self.gemini_key = GEMINI_API_KEY
        self.deepseek_key = DEEPSEEK_API_KEY
        
    def cerebro_pensante(self, codigo_actual, instruccion, archivo, contexto):
        """Envía código a IA para mejorarlo"""
        # Llama a Gemini o DeepSeek
        # Retorna código mejorado
        
    def ejecutar_mision(self, mision):
        """Ejecuta una misión específica"""
        # Tipos: revisar, modificar, crear, verificar, instalar
        
    def revisar_proyecto_completo(self):
        """Revisa todo el proyecto con misiones predefinidas"""
```

**Misiones predefinidas**:
- Verificar compilación TypeScript
- Revisar hooks de compras ágiles
- Revisar página de Compras Ágiles
- Revisar función Edge sync-compras-agiles
- Revisar hooks de matching

**Comandos disponibles**:
```bash
# Revisión completa
python evaristo/evaristo_manager.py revisar

# Ejecutar misión específica
python evaristo/evaristo_manager.py mision mantenimiento_automatico.json
```

### 2. `evaristo_autonomo.py` (Mantenimiento Automático)

**Ubicación**: `evaristo/evaristo_autonomo.py`  
**Líneas**: 116  
**Función**: Ejecuta mantenimiento automático cada 24 horas

**Características**:
- Usa `schedule` para ejecutar periódicamente
- Carga `mantenimiento_automatico.json`
- Ejecuta todas las misiones automáticamente
- Genera reportes de mantenimiento

**Uso**:
```bash
python evaristo/evaristo_autonomo.py
# Ejecuta cada 24 horas automáticamente
```

### 3. `useEvaristo.ts` (Hook React)

**Ubicación**: `src/hooks/useEvaristo.ts`  
**Líneas**: 130  
**Función**: Hook para interactuar con Evaristo desde React

**Hooks disponibles**:

```typescript
// Obtener estado de Evaristo
useEvaristoStatus() → { status, has_gemini, has_deepseek }

// Ejecutar revisión completa
useEvaristoRevisar() → { success, output, error }

// Ejecutar misión específica
useEvaristoMision({ mision_file, api_keys }) → { success, output, error }
```

**Seguridad**: Solo permite acceso si `user.email === 'evaras@firmavb.cl'`

### 4. `EvaristoPanel.tsx` (Panel de Control)

**Ubicación**: `src/components/evaristo/EvaristoPanel.tsx`  
**Líneas**: 197  
**Función**: Interfaz para controlar Evaristo

**Características**:
- Muestra estado (online/offline)
- Muestra estado de API keys (Gemini/DeepSeek)
- Permite ingresar API keys opcionales
- Botón "Revisar Proyecto"
- Botón "Ejecutar Misión" con selector de archivo
- Muestra salida de Evaristo en tiempo real

### 5. `EvaristoChat.tsx` (Chat Interactivo)

**Ubicación**: `src/components/evaristo/EvaristoChat.tsx`  
**Líneas**: 291  
**Función**: Chat conversacional con Evaristo

**Comandos del chat**:
- `"revisar"` o `"revisa"` → Ejecuta revisión completa
- `"mision"` o `"misión"` → Ejecuta misión
- `"ayuda"` o `"help"` → Muestra ayuda

**Características**:
- Interfaz de chat tipo WhatsApp
- Muestra resultados con detalles expandibles
- Indicadores de éxito/error
- Timestamps en mensajes

### 6. `evaristo-api/index.ts` (Edge Function)

**Ubicación**: `supabase/functions/evaristo-api/index.ts`  
**Líneas**: 151  
**Función**: API backend que ejecuta Evaristo remotamente

**Endpoints**:
- `POST /functions/v1/evaristo-api` con `action: 'status'` → Estado
- `POST /functions/v1/evaristo-api` con `action: 'revisar'` → Revisión
- `POST /functions/v1/evaristo-api` con `action: 'mision'` → Ejecutar misión

**Flujo**:
1. Verifica autenticación (JWT token)
2. Configura variables de entorno (API keys)
3. Ejecuta `python3 evaristo_manager.py` usando `Deno.run`
4. Captura stdout/stderr
5. Lee último reporte de `evaristo/reportes/resumen_latest.json`
6. Retorna resultado JSON

**Ruta de ejecución**: `/workspace/evaristo/evaristo_manager.py` (en Supabase)

### 7. `AdminEvaristo.tsx` (Página Principal)

**Ubicación**: `src/pages/AdminEvaristo.tsx`  
**Líneas**: 134  
**Función**: Página de administración con tabs

**Estructura**:
- Header con título
- 3 cards de información (Estado, Configuración, Documentación)
- Tabs: "Conversar" (EvaristoChat) y "Panel" (EvaristoPanel)
- Lista de misiones disponibles

**Ruta**: `/admin/evaristo` (solo visible para `evaras@firmavb.cl`)

---

## 🔑 Configuración

### Variables de Entorno

**En el servidor (Supabase Secrets)**:
- `GEMINI_API_KEY` - API key de Google Gemini
- `DEEPSEEK_API_KEY` - API key de DeepSeek
- `GOOGLE_API_KEY` - Alternativa a GEMINI_API_KEY

**En el frontend (opcional)**:
- Se pueden pasar API keys en el request para override temporal

### Proveedores de IA Soportados

1. **Google Gemini** (prioridad 1)
   - Modelos: `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-pro`
   - API: `https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent`
   - Fallback automático si hay rate limit

2. **DeepSeek** (prioridad 2)
   - Modelo: `deepseek-chat`
   - API: `https://api.deepseek.com/v1/chat/completions`

3. **Ollama** (futuro, no implementado aún)
   - URL: `http://localhost:11434`

### Rutas Configuradas

```python
PROYECTO_ROOT = Path(__file__).parent.parent  # agile-bidder/
REPOSITORIO_ROOT = PROYECTO_ROOT.parent.parent  # CompraAgil_VB/
FRONTEND_ROOT = PROYECTO_ROOT  # agile-bidder/

REPORTES_DIR = PROYECTO_ROOT / "evaristo" / "reportes"
MISIONES_DIR = PROYECTO_ROOT / "evaristo" / "misiones"
LOG_FILE = PROYECTO_ROOT / "evaristo" / "evaristo.log"
```

---

## 📋 Misiones Predefinidas

### `mantenimiento_automatico.json`

**Ubicación**: `evaristo/misiones/mantenimiento_automatico.json`

**Contiene 10 misiones**:
1. Verificar compilación y tipos
2. Revisar y optimizar hooks de datos
3. Revisar y optimizar servicios de matching
4. Revisar componentes principales del frontend
5. Revisar funciones Edge críticas
6. Revisar y mejorar diseño UI/UX
7. Verificar integraciones externas
8. Optimizar rendimiento general
9. Revisar seguridad y validaciones
10. Mejorar documentación y comentarios

**Ejecución**: Automática cada 24 horas (si `evaristo_autonomo.py` está corriendo)

---

## 🛡️ Seguridad

### Autenticación

1. **Frontend**: Solo `evaras@firmavb.cl` puede ver `/admin/evaristo`
   - Verificado en `AppSidebar.tsx` línea 91-107

2. **Backend**: Edge Function verifica JWT token
   - Verificado en `evaristo-api/index.ts` línea 28-51

3. **Hooks**: Verifican email antes de ejecutar
   - Verificado en `useEvaristo.ts` línea 29-32 y 99-102

### Backups Automáticos

- **Ubicación**: `evaristo/backups/`
- **Formato**: `{archivo}.{timestamp}.backup`
- **Cuándo**: Antes de cada modificación de código
- **Función**: `hacer_backup()` en `evaristo_manager.py` línea 147-160

---

## 📊 Reportes

### Tipos de Reportes

1. **Reportes individuales**: `evaristo/reportes/reporte_{timestamp}.json`
   - Generado por cada misión ejecutada
   - Contiene: timestamp, misión, archivo, estado, detalles

2. **Reporte resumen**: `evaristo/reportes/resumen_latest.json`
   - Último resumen de ejecución
   - Contiene: fecha, total_misiones, exitosas, fallidas, resultados

3. **Reporte mantenimiento**: `evaristo/reportes/mantenimiento_auto_{timestamp}.json`
   - Generado por `evaristo_autonomo.py`
   - Contiene: tipo, fecha, resultados, estadísticas

### Logs

- **Ubicación**: `evaristo/evaristo.log`
- **Formato**: `[YYYY-MM-DD HH:MM:SS] mensaje`
- **Contenido**: Todas las acciones de Evaristo

---

## 🎯 Reglas de Negocio Críticas

Evaristo conoce y aplica estas reglas:

### Clasificación de Procesos (MercadoPúblico)

**COMPRAS ÁGILES (<= 100 UTM)**:
- L1 - Licitación Pública Menor: < 100 UTM
- Plazo mínimo: 5 días corridos
- Generalmente NO exigen Garantía de Seriedad
- Firma Simple suficiente

**LICITACIONES (> 100 UTM)**:
- LE - Intermedia: 100 a 1.000 UTM
- LP - Mayor: 1.000 a 5.000 UTM (requiere FEA y garantía 5%)
- LR - Gran Compra: > 5.000 UTM

**UTM Enero 2026**: $69.751 CLP  
**Umbral Compra Ágil**: 100 UTM = $6.975.100 CLP

### Reglas de Oro

1. ✅ SIEMPRE hacer backup antes de modificar código
2. ✅ Mantener compatibilidad con código existente
3. ✅ Seguir convenciones del proyecto
4. ✅ Probar cambios antes de aplicarlos
5. ✅ Reportar claramente qué se hizo y por qué
6. ✅ SIEMPRE respetar clasificación: >100 UTM = Licitación, <=100 UTM = Compra Ágil

---

## 🚀 Uso

### Desde el Frontend

1. Acceder a `www.firmavb.cl/admin/evaristo`
2. Usar tab "Conversar" para chat interactivo
3. Usar tab "Panel" para control avanzado

### Desde la Terminal

```bash
# Revisión completa
python evaristo/evaristo_manager.py revisar

# Ejecutar misión específica
python evaristo/evaristo_manager.py mision mantenimiento_automatico.json

# Mantenimiento automático (corre cada 24h)
python evaristo/evaristo_autonomo.py
```

### Desde npm scripts

```bash
npm run evaristo              # Revisar proyecto
npm run evaristo:mision <file> # Ejecutar misión
```

---

## 📝 Archivos Clave - Referencias de Código

### Archivo Principal
```1:888:evaristo/evaristo_manager.py
# Contiene toda la lógica principal de Evaristo
```

### Script Autónomo
```1:116:evaristo/evaristo_autonomo.py
# Mantenimiento automático cada 24 horas
```

### Hook React
```1:130:src/hooks/useEvaristo.ts
# Integración con frontend
```

### Componente Panel
```1:197:src/components/evaristo/EvaristoPanel.tsx
# Interfaz de control
```

### Componente Chat
```1:291:src/components/evaristo/EvaristoChat.tsx
# Chat interactivo
```

### Edge Function
```1:151:supabase/functions/evaristo-api/index.ts
# API backend
```

### Página Admin
```1:134:src/pages/AdminEvaristo.tsx
# Página principal
```

---

## 🔍 Integración con el Sistema

### Sistema que Mantiene

Evaristo mantiene **www.firmavb.cl** que gestiona:
- Compras Ágiles de MercadoPúblico
- Matching de inventario con licitaciones
- Generación automática de ofertas
- Integración con Odoo
- Extensiones de Chrome para scraping
- Bot autónomo (Evaristo mismo) para mantenimiento continuo

### Stack Tecnológico

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **IA**: Google Gemini / DeepSeek
- **Estado**: TanStack Query (React Query)
- **UI**: Radix UI, shadcn/ui

---

## 📚 Documentación Adicional

En `evaristo/` hay varios archivos `.md`:
- `README.md` - Guía básica
- `INSTRUCCIONES.md` - Instrucciones de uso
- `INSTRUCCIONES_AUTONOMO.md` - Uso del modo autónomo
- `SISTEMA_AUTONOMO.md` - Documentación del sistema autónomo
- `CONFIGURACION_REPOSITORIO.md` - Configuración de rutas
- `REGLAS_MERCADOPUBLICO.md` - Reglas de negocio
- `CONTEXTO_SISTEMA.md` - Contexto del sistema

---

## ✅ Estado Actual

- ✅ Evaristo configurado y operativo
- ✅ Integración con frontend completa
- ✅ Edge Function funcionando
- ✅ Múltiples proveedores de IA soportados
- ✅ Backups automáticos funcionando
- ✅ Reportes generándose correctamente
- ✅ Seguridad implementada (solo admin autorizado)
- ✅ Misiones predefinidas listas

---

## 🎯 Resumen Ejecutivo

**Evaristo** es un bot autónomo que:
- 📍 Está ubicado en `agile-bidder/evaristo/`
- 🤖 Usa IA (Gemini/DeepSeek) para mejorar código
- 🔄 Se ejecuta manualmente o automáticamente cada 24h
- 🛡️ Hace backups antes de cada cambio
- 📊 Genera reportes de todo lo que hace
- 🔒 Solo accesible por `evaras@firmavb.cl`
- 🎯 Mantiene www.firmavb.cl 100% operativo

**Archivos principales**:
- `evaristo_manager.py` (888 líneas) - Lógica principal
- `evaristo_autonomo.py` (116 líneas) - Mantenimiento automático
- `useEvaristo.ts` (130 líneas) - Hook React
- `EvaristoPanel.tsx` (197 líneas) - Panel de control
- `EvaristoChat.tsx` (291 líneas) - Chat interactivo
- `evaristo-api/index.ts` (151 líneas) - Edge Function

---

**Documentación generada para otra IA** 🤖  
**Fecha**: 2026-01-15  
**Proyecto**: FirmaVB - Agile Bidder
