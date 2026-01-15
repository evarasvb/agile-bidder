#!/bin/bash
# Script para aplicar migración RLS de user_roles
# ================================================

echo "🔧 Aplicando migración SQL para arreglar RLS de user_roles..."
echo ""

# Verificar si Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no está instalado"
    echo ""
    echo "Instala Supabase CLI:"
    echo "  npm install -g supabase"
    echo ""
    echo "O ejecuta el SQL manualmente en Supabase Dashboard → SQL Editor"
    exit 1
fi

# Verificar que estamos en el directorio correcto
if [ ! -f "supabase/migrations/20260115000002_fix_user_roles_rls.sql" ]; then
    echo "❌ No se encontró la migración"
    echo "   Asegúrate de estar en la raíz del proyecto"
    exit 1
fi

# Aplicar migración usando Supabase CLI
echo "📋 Aplicando migración..."
echo ""

supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migración aplicada correctamente"
    echo ""
    echo "Ahora puedes:"
    echo "  1. Crear usuarios desde /users"
    echo "  2. Activar roles de usuarios (como Jorge)"
else
    echo ""
    echo "❌ Error al aplicar migración"
    echo ""
    echo "Alternativa: Ejecuta el SQL manualmente en Supabase Dashboard → SQL Editor"
    echo "   Archivo: supabase/migrations/20260115000002_fix_user_roles_rls.sql"
fi
