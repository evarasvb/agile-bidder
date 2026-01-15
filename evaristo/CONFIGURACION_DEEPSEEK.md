# 🔒 Configuración de Límite de Gasto DeepSeek

## ✅ Configuración Actual

- **Balance actual**: $2.00 USD
- **Alerta configurada**: ✅ Sí (umbral $1 USD)
- **API Key**: `sk-58fc334d3e4443c4a0fecf2bc8aaa178`
- **Uso**: Evaristo DeepSeek

## 💰 Estrategia de Control de Gasto

### Límite Objetivo: $20 USD máximo

**Estrategia implementada:**

1. **Orden de Fallback**:
   - 1️⃣ **Gemini** (gratis) - Usar primero hasta agotar cuota
   - 2️⃣ **Ollama** (local, sin costo) - Si está disponible
   - 3️⃣ **DeepSeek** (ultra barato) - Solo como respaldo

2. **Control de Gasto DeepSeek**:
   - ✅ Alerta configurada en $1 USD
   - ⚠️ Control manual: Solo cargar lo necesario
   - 📊 Monitoreo: Revisar balance regularmente

### Costos DeepSeek

- **Input**: $0.14 / millón de tokens
- **Output**: $0.28 / millón de tokens
- **Cache hit**: $0.014 / millón de tokens

**Con $2 USD puedes hacer:**
- ~14 millones de tokens input
- ~7 millones de tokens output
- Miles de consultas típicas

### Recomendaciones

1. **No recargar más de $18 adicionales** (total $20)
2. **Usar Gemini primero** siempre que sea posible
3. **Monitorear alertas** cuando el saldo baje de $1
4. **Revisar uso mensual** en dashboard de DeepSeek

## 🔔 Alertas Configuradas

- **Umbral**: $1 USD
- **Notificación**: Email cuando el saldo baje del umbral
- **Acción**: Decidir si recargar o usar solo Gemini/Ollama

---

**DeepSeek está configurado de forma segura** - Solo se usará cuando Gemini no esté disponible. 💰✅
