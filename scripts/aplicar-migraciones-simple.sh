#!/bin/bash

# Script simple para aplicar migraciones usando Supabase CLI
# Requiere: supabase CLI instalado y autenticado

echo "🚀 Aplicando migraciones a Supabase..."
echo ""

# Verificar que supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI no está instalado"
    echo "   Instálalo con: npm install -g supabase"
    exit 1
fi

# Verificar que estamos en el directorio correcto
if [ ! -d "supabase/migrations" ]; then
    echo "❌ No se encontró el directorio supabase/migrations"
    echo "   Asegúrate de ejecutar este script desde la raíz del proyecto"
    exit 1
fi

# Aplicar migraciones
echo "📂 Aplicando migraciones desde supabase/migrations/..."
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Migraciones aplicadas exitosamente!"
else
    echo ""
    echo "❌ Error al aplicar migraciones"
    echo "   Verifica tu conexión y credenciales de Supabase"
    exit 1
fi
