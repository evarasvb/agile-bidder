#!/bin/bash

# Script para instalar y configurar Supabase CLI
# Uso: ./scripts/instalar-y-usar-supabase-cli.sh

set -e

echo "🚀 Instalando y Configurando Supabase CLI"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar si npm está instalado
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm no está instalado${NC}"
    echo "   Instala Node.js desde: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ npm encontrado${NC}"

# Verificar si supabase ya está instalado
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI ya está instalado${NC}"
    supabase --version
else
    echo -e "${YELLOW}📦 Instalando Supabase CLI...${NC}"
    npm install -g supabase
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Supabase CLI instalado correctamente${NC}"
        supabase --version
    else
        echo -e "${RED}❌ Error al instalar Supabase CLI${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${YELLOW}📋 Próximos pasos:${NC}"
echo ""
echo "1. Autenticarte:"
echo "   ${GREEN}supabase login${NC}"
echo ""
echo "2. Vincular tu proyecto:"
echo "   ${GREEN}supabase link --project-ref juiskeeutbaipwbeeezw${NC}"
echo ""
echo "3. Aplicar migraciones:"
echo "   ${GREEN}supabase db push${NC}"
echo ""
echo "¿Deseas continuar con la autenticación ahora? (s/n)"
read -r response

if [[ "$response" =~ ^[Ss]$ ]]; then
    echo ""
    echo -e "${YELLOW}🔐 Abriendo navegador para autenticarte...${NC}"
    supabase login
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Autenticación exitosa${NC}"
        echo ""
        echo "Ahora vincula tu proyecto:"
        echo "   ${GREEN}supabase link --project-ref juiskeeutbaipwbeeezw${NC}"
    else
        echo -e "${RED}❌ Error en la autenticación${NC}"
    fi
else
    echo ""
    echo "Ejecuta manualmente:"
    echo "   ${GREEN}supabase login${NC}"
fi

echo ""
echo -e "${GREEN}✨ ¡Listo!${NC}"
