# 🌐 Configuración de Evaristo para Trabajo en Línea

## 📋 Resumen

Evaristo ahora puede ejecutarse remotamente a través de una API de Supabase Edge Function, permitiendo ejecutar misiones desde cualquier lugar sin necesidad de acceso directo al servidor.

## 🚀 Configuración Inicial

### 1. Configurar API Keys en Supabase Secrets

Ve a tu proyecto en Supabase Dashboard:
1. Settings → Edge Functions → Secrets
2. Agrega los siguientes secrets:

```
GEMINI_API_KEY=tu-api-key-de-gemini
DEEPSEEK_API_KEY=tu-api-key-de-deepseek
```

### 2. Desplegar Edge Function

La función `evaristo-api` ya está creada en:
```
supabase/functions/evaristo-api/index.ts
```

Para desplegarla:

```bash
# Desde la raíz del proyecto
supabase functions deploy evaristo-api
```

O desde el dashboard de Supabase:
1. Edge Functions → New Function
2. Copia el contenido de `supabase/functions/evaristo-api/index.ts`
3. Nómbrala `evaristo-api`
4. Deploy

### 3. Configurar Ruta en el Frontend

El componente `EvaristoPanel` ya está creado y listo para usar. Solo necesitas agregarlo a una página de administración:

```tsx
import { EvaristoPanel } from '@/components/evaristo/EvaristoPanel';

// En tu página de admin
<EvaristoPanel />
```

## 📡 Uso de la API

### Endpoint

```
POST /functions/v1/evaristo-api
```

### Headers Requeridos

```
Authorization: Bearer <token_de_usuario>
Content-Type: application/json
```

### Acciones Disponibles

#### 1. Verificar Estado

```json
{
  "action": "status"
}
```

Respuesta:
```json
{
  "status": "online",
  "has_gemini": true,
  "has_deepseek": true,
  "timestamp": "2026-01-15T..."
}
```

#### 2. Revisar Proyecto

```json
{
  "action": "revisar",
  "api_keys": {
    "gemini": "opcional-override",
    "deepseek": "opcional-override"
  }
}
```

#### 3. Ejecutar Misión

```json
{
  "action": "mision",
  "mision_file": "mision_completa_firmavb.json",
  "api_keys": {
    "gemini": "opcional-override",
    "deepseek": "opcional-override"
  }
}
```

## 🎯 Uso desde el Frontend

### Hook: useEvaristoStatus

```tsx
import { useEvaristoStatus } from '@/hooks/useEvaristo';

function MyComponent() {
  const { data: status } = useEvaristoStatus();
  
  return (
    <div>
      Estado: {status?.status}
      Gemini: {status?.has_gemini ? '✓' : '✗'}
    </div>
  );
}
```

### Hook: useEvaristoRevisar

```tsx
import { useEvaristoRevisar } from '@/hooks/useEvaristo';

function MyComponent() {
  const revisar = useEvaristoRevisar();
  
  const handleClick = async () => {
    const result = await revisar.mutateAsync();
    console.log(result.output);
  };
  
  return <button onClick={handleClick}>Revisar</button>;
}
```

### Hook: useEvaristoMision

```tsx
import { useEvaristoMision } from '@/hooks/useEvaristo';

function MyComponent() {
  const mision = useEvaristoMision();
  
  const handleClick = async () => {
    const result = await mision.mutateAsync({
      mision_file: 'mision_completa_firmavb.json'
    });
    console.log(result.output);
  };
  
  return <button onClick={handleClick}>Ejecutar Misión</button>;
}
```

## 🔒 Seguridad

1. **Autenticación**: Solo usuarios autenticados pueden ejecutar Evaristo
2. **API Keys**: Se pueden pasar opcionalmente, pero se recomienda usar Secrets de Supabase
3. **Logs**: Todos los outputs se registran para auditoría

## 🛠️ Troubleshooting

### Error: "No authorization header"
- Asegúrate de estar autenticado en la aplicación
- Verifica que el token se esté enviando correctamente

### Error: "Invalid token"
- El token puede haber expirado, recarga la página
- Verifica que el usuario tenga permisos

### Error: "Failed to execute"
- Verifica que la Edge Function esté desplegada
- Revisa los logs en Supabase Dashboard → Edge Functions → Logs

### Evaristo no encuentra archivos
- Verifica que los archivos estén en `/workspace/evaristo/`
- La función se ejecuta desde `/workspace/` como directorio base

## 📝 Notas Importantes

1. **Ruta del Workspace**: La Edge Function asume que Evaristo está en `/workspace/evaristo/`. Ajusta según tu configuración de Supabase.

2. **Python en Edge Functions**: Supabase Edge Functions usa Deno, no Python directamente. Necesitarás:
   - Usar un servicio externo (como Railway, Render, etc.) para ejecutar Python
   - O adaptar Evaristo a Deno/TypeScript

3. **Alternativa Recomendada**: Para ejecutar Python en línea, considera:
   - Desplegar Evaristo como servicio separado (Railway, Render, Fly.io)
   - Crear un webhook que llame a ese servicio
   - O adaptar la lógica de Evaristo a TypeScript/Deno para ejecutarse directamente en Edge Functions

## 🔄 Próximos Pasos

1. ✅ Edge Function creada
2. ✅ Hooks de React creados
3. ✅ Componente de UI creado
4. ⏳ Desplegar Edge Function en Supabase
5. ⏳ Agregar EvaristoPanel a página de admin
6. ⏳ Configurar API keys en Secrets
7. ⏳ Probar ejecución remota

---

**Evaristo está listo para trabajar en línea** 🚀
