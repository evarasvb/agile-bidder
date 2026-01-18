#!/bin/bash

# Script completo para hacer todas las migraciones idempotentes
# Agrega IF NOT EXISTS, DROP IF EXISTS, etc. donde sea necesario

echo "🔧 Haciendo todas las migraciones idempotentes..."
echo ""

MIGRATIONS_DIR="supabase/migrations"
FIXED=0

for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    changed=false
    
    # 1. CREATE INDEX sin IF NOT EXISTS
    if grep -q "CREATE INDEX " "$file" && ! grep -q "CREATE INDEX IF NOT EXISTS" "$file"; then
      perl -i -pe 's/CREATE INDEX (idx_[a-zA-Z0-9_]+)/CREATE INDEX IF NOT EXISTS $1/g' "$file"
      changed=true
    fi
    
    # 2. CREATE POLICY sin DROP IF EXISTS antes
    # (Esto es más complejo, mejor dejarlo manual)
    
    # 3. CREATE TYPE sin IF NOT EXISTS (ya deberían tenerlo, pero por si acaso)
    if grep -q "CREATE TYPE public\." "$file" && ! grep -q "CREATE TYPE IF NOT EXISTS" "$file"; then
      perl -i -pe 's/CREATE TYPE (public\.[a-zA-Z0-9_]+)/CREATE TYPE IF NOT EXISTS $1/g' "$file"
      changed=true
    fi
    
    if [ "$changed" = true ]; then
      echo "✅ Arreglado: $filename"
      FIXED=$((FIXED + 1))
    fi
  fi
done

echo ""
echo "✅ Total de archivos arreglados: $FIXED"
echo ""
echo "Ahora puedes ejecutar:"
echo "  supabase db push"
