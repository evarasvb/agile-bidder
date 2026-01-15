#!/bin/bash
# Script para instalar dependencias de Evaristo

echo "🔧 Instalando dependencias de Evaristo..."
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no encontrado. Por favor instálalo primero."
    exit 1
fi

echo "📦 Instalando google-generativeai..."
pip3 install --user google-generativeai

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencias instaladas correctamente"
    echo ""
    echo "📝 Próximo paso: Configura tu API Key de Gemini:"
    echo "   export GEMINI_API_KEY='tu-api-key'"
    echo ""
    echo "   Obtén tu API key gratis en: https://makersuite.google.com/app/apikey"
    echo ""
else
    echo ""
    echo "⚠️  Error instalando. Intenta con:"
    echo "   sudo pip3 install google-generativeai"
    echo "   O: pip3 install --user google-generativeai"
fi
