#!/bin/bash
# Script de inicio rápido para Evaristo

echo "🤖 Iniciando Evaristo..."
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 no encontrado. Por favor instálalo primero."
    exit 1
fi

# Verificar API Key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY no configurada"
    echo ""
    echo "Configúrala con:"
    echo "  export OPENAI_API_KEY='sk-tu-api-key'"
    echo ""
    read -p "¿Quieres continuar de todas formas? (s/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

# Ejecutar Evaristo
cd "$(dirname "$0")/.."
python3 evaristo/evaristo_manager.py revisar
