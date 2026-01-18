#!/bin/bash

# Script para agregar IF NOT EXISTS a ADD COLUMN en migraciones
# Esto hace que las migraciones sean idempotentes

echo "🔧 Arreglando migraciones con ADD COLUMN..."

MIGRATIONS_DIR="supabase/migrations"

for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    
    # Verificar si el archivo tiene ADD COLUMN sin IF NOT EXISTS
    if grep -q "ADD COLUMN" "$file" && ! grep -q "ADD COLUMN IF NOT EXISTS" "$file"; then
      echo "Procesando: $filename"
      
      # Reemplazar ADD COLUMN con ADD COLUMN IF NOT EXISTS
      # Usar una forma más segura que funcione en macOS
      perl -i -pe 's/ADD COLUMN ([a-zA-Z_][a-zA-Z0-9_]*)/ADD COLUMN IF NOT EXISTS $1/g' "$file"
      
      echo "  ✅ Actualizado"
    fi
  fi
done

echo ""
echo "✅ Migraciones arregladas"
echo ""
echo "Ahora puedes ejecutar:"
echo "  supabase db push"
