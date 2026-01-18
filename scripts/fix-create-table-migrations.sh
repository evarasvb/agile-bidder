#!/bin/bash

# Script para agregar IF NOT EXISTS a CREATE TABLE en migraciones
# Esto hace que las migraciones sean idempotentes

echo "🔧 Arreglando CREATE TABLE sin IF NOT EXISTS..."

MIGRATIONS_DIR="supabase/migrations"

for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    
    # Verificar si el archivo tiene CREATE TABLE sin IF NOT EXISTS
    if grep -q "^CREATE TABLE public\." "$file" && ! grep -q "^CREATE TABLE IF NOT EXISTS public\." "$file"; then
      echo "Procesando: $filename"
      
      # Reemplazar CREATE TABLE con CREATE TABLE IF NOT EXISTS
      # Usar perl para hacer el reemplazo de forma segura
      perl -i -pe 's/^CREATE TABLE (public\.\w+)/CREATE TABLE IF NOT EXISTS $1/g' "$file"
      
      echo "  ✅ Actualizado"
    fi
  fi
done

echo ""
echo "✅ Migraciones arregladas"
