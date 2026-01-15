# 🔑 Configuración de API Key de Gemini

## ⚠️ Problema Detectado

La API key proporcionada tiene **límites de cuota** muy restrictivos en el plan gratuito.

### Soluciones

#### Opción 1: Habilitar API en Google Cloud (Recomendado)

1. Ve a: https://console.cloud.google.com/
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Gemini:
   - Ve a "APIs & Services" > "Library"
   - Busca "Generative Language API"
   - Haz clic en "Enable"
4. Crea una nueva API key con cuota adecuada
5. Configúrala:
   ```bash
   export GEMINI_API_KEY="tu-nueva-api-key"
   ```

#### Opción 2: Usar API Key de Vertex AI (Más cuota)

1. Ve a: https://console.cloud.google.com/
2. Habilita Vertex AI API
3. Crea credenciales de servicio
4. Usa esas credenciales

#### Opción 3: Modo Básico (Sin IA)

Evaristo funciona perfectamente en modo básico sin API key:
- ✅ Verifica compilación
- ✅ Revisa código
- ✅ Sugiere mejoras
- ✅ Genera reportes

Solo no puede **modificar código automáticamente** sin la API key.

## 📊 Estado Actual

- ✅ Gemini instalado
- ✅ Evaristo funcionando
- ⚠️ API key con límites de cuota
- ✅ Modo básico operativo

## 🚀 Uso Actual

Evaristo está funcionando en **modo verificación básica**:
- Revisa todos los archivos
- Detecta problemas
- Sugiere mejoras
- Genera reportes

Para activar **modo IA completo** (modificaciones automáticas), necesitas una API key con cuota disponible.

---

**Evaristo sigue siendo útil en modo básico** - te reporta todo lo que encuentra. 🤖✨
