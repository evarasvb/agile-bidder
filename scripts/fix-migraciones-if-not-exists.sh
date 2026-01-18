#!/bin/bash

# Script para agregar IF NOT EXISTS a todas las migraciones
# Esto hace que las migraciones sean idempotentes (se pueden ejecutar múltiples veces)

echo "🔧 Agregando IF NOT EXISTS a migraciones..."

MIGRATIONS_DIR="supabase/migrations"

# Lista de tablas que necesitan IF NOT EXISTS
TABLES=(
  "licitaciones"
  "licitacion_items"
  "compras_agiles"
  "vendedores"
  "ordenes_compra"
  "user_settings"
  "import_history"
)

for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "Procesando: $filename"
    
    # Agregar IF NOT EXISTS a CREATE TABLE que no lo tienen
    for table in "${TABLES[@]}"; do
      # Buscar CREATE TABLE sin IF NOT EXISTS
      if grep -q "CREATE TABLE public\.$table" "$file" && ! grep -q "CREATE TABLE IF NOT EXISTS public\.$table" "$file"; then
        echo "  → Agregando IF NOT EXISTS a $table"
        sed -i '' "s/CREATE TABLE public\.$table/CREATE TABLE IF NOT EXISTS public.$table/g" "$file"
      fi
    done
  fi
done

echo ""
echo "✅ Migraciones actualizadas"
echo ""
echo "Ahora puedes ejecutar:"
echo "  supabase db push"
