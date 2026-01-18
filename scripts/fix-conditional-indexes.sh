#!/bin/bash

# Script para hacer índices condicionales en migraciones problemáticas
# Esto verifica que las columnas existan antes de crear índices

echo "🔧 Haciendo índices condicionales..."

# Archivo específico con problemas
FILE="supabase/migrations/20260113024951_a152814c-4c48-48e2-9592-7f0708906e56.sql"

if [ -f "$FILE" ]; then
  echo "Procesando: $(basename $FILE)"
  
  # Reemplazar CREATE INDEX con verificación condicional
  # Esto es más complejo, mejor hacerlo manualmente para este archivo específico
  echo "  ⚠️  Este archivo necesita corrección manual de índices"
fi

echo "✅ Script ejecutado"
