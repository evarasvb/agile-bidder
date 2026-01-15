#!/bin/bash
# Script para iniciar Evaristo Autónomo
# ======================================

echo "🤖 Iniciando Evaristo Autónomo..."
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado"
    exit 1
fi

# Verificar que estamos en el directorio correcto
if [ ! -f "evaristo/evaristo_autonomo.py" ]; then
    echo "❌ Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Verificar API keys
if [ -z "$GEMINI_API_KEY" ] && [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️  ADVERTENCIA: No hay API keys configuradas"
    echo "   Configura GEMINI_API_KEY o DEEPSEEK_API_KEY"
    echo ""
fi

# Iniciar Evaristo Autónomo
echo "🚀 Iniciando mantenimiento automático..."
echo "   Intervalo: Cada 24 horas"
echo "   Misión: mantenimiento_automatico.json"
echo ""
echo "💡 Presiona Ctrl+C para detener"
echo ""

cd "$(dirname "$0")/.."
python3 evaristo/evaristo_autonomo.py
