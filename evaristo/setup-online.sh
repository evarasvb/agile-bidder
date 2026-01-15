#!/bin/bash
# Script de configuración rápida para Evaristo Online
# ====================================================

echo "🤖 Configuración de Evaristo para Trabajo en Línea"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "evaristo/evaristo_manager.py" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del proyecto${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pasos para configurar Evaristo Online:${NC}"
echo ""
echo "1. Configurar API Keys en Supabase:"
echo "   - Ve a: https://supabase.com/dashboard"
echo "   - Selecciona tu proyecto"
echo "   - Settings → Edge Functions → Secrets"
echo "   - Agrega:"
echo "     • GEMINI_API_KEY=tu-api-key"
echo "     • DEEPSEEK_API_KEY=tu-api-key"
echo ""
echo "2. Desplegar Edge Function:"
echo "   - Opción A: Desde Supabase Dashboard"
echo "     • Edge Functions → New Function"
echo "     • Nombre: evaristo-api"
echo "     • Copia el contenido de: supabase/functions/evaristo-api/index.ts"
echo ""
echo "   - Opción B: Desde terminal (si tienes Supabase CLI):"
echo "     supabase functions deploy evaristo-api"
echo ""
echo "3. Agregar página de administración:"
echo "   - El componente EvaristoPanel ya está creado"
echo "   - Agrega la ruta en tu App.tsx:"
echo "     <Route path='/admin/evaristo' element={<AdminEvaristo />} />"
echo ""
echo -e "${GREEN}✅ Archivos creados:${NC}"
echo "   ✓ supabase/functions/evaristo-api/index.ts"
echo "   ✓ src/hooks/useEvaristo.ts"
echo "   ✓ src/components/evaristo/EvaristoPanel.tsx"
echo "   ✓ src/pages/AdminEvaristo.tsx"
echo "   ✓ evaristo/CONFIGURACION_ONLINE.md"
echo ""
echo -e "${YELLOW}⚠️  Nota Importante:${NC}"
echo "   Supabase Edge Functions usa Deno, no Python directamente."
echo "   Para ejecutar Python, necesitas:"
echo "   - Opción 1: Adaptar Evaristo a TypeScript/Deno"
echo "   - Opción 2: Desplegar Evaristo como servicio separado"
echo "   - Opción 3: Usar un webhook a un servicio externo"
echo ""
echo -e "${GREEN}📚 Documentación completa:${NC}"
echo "   Ver: evaristo/CONFIGURACION_ONLINE.md"
echo ""
