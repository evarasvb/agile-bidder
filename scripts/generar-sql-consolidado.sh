#!/bin/bash

# Script para generar archivo SQL consolidado con todas las migraciones
# Uso: ./scripts/generar-sql-consolidado.sh

echo "📦 Generando archivo SQL consolidado..."

OUTPUT_FILE="TODAS-LAS-MIGRACIONES.sql"
MIGRATIONS_DIR="supabase/migrations"

# Encabezado del archivo
cat > "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- MIGRACIONES CONSOLIDADAS PARA SUPABASE
-- ============================================
-- Este archivo contiene TODAS las migraciones del proyecto
-- Ejecuta este SQL completo en Supabase Dashboard → SQL Editor
-- 
-- INSTRUCCIONES:
-- 1. Ve a Supabase Dashboard → SQL Editor
-- 2. Copia TODO este archivo
-- 3. Pégalo en SQL Editor
-- 4. Haz clic en "Run" o presiona Ctrl+Enter
-- 5. Espera a que termine (puede tardar unos minutos)
-- ============================================

EOF

# Contador
COUNT=0
TOTAL=$(find "$MIGRATIONS_DIR" -name "*.sql" | wc -l | tr -d ' ')

echo "   Encontradas $TOTAL migraciones"

# Agregar cada migración
for file in $(find "$MIGRATIONS_DIR" -name "*.sql" | sort); do
    COUNT=$((COUNT + 1))
    filename=$(basename "$file")
    echo "   [$COUNT/$TOTAL] Procesando: $filename"
    
    echo "" >> "$OUTPUT_FILE"
    echo "-- ============================================" >> "$OUTPUT_FILE"
    echo "-- MIGRACIÓN $COUNT/$TOTAL: $filename" >> "$OUTPUT_FILE"
    echo "-- ============================================" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

# Footer
cat >> "$OUTPUT_FILE" << EOF

-- ============================================
-- FIN DE LAS MIGRACIONES
-- ============================================
-- Total de migraciones aplicadas: $COUNT
-- Fecha: $(date)
-- ============================================
EOF

echo ""
echo "✅ Archivo generado: $OUTPUT_FILE"
echo ""
echo "📋 Próximos pasos:"
echo "   1. Ve a: https://supabase.com/dashboard/project/juiskeeutbaipwbeeezw/sql/new"
echo "   2. Abre el archivo: $OUTPUT_FILE"
echo "   3. Copia TODO el contenido (Cmd+A, Cmd+C)"
echo "   4. Pégalo en SQL Editor (Cmd+V)"
echo "   5. Haz clic en 'Run' o presiona Ctrl+Enter"
echo "   6. Espera a que termine (puede tardar 2-5 minutos)"
echo ""
echo "✨ ¡Listo para ejecutar!"
