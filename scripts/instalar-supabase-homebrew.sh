#!/bin/bash

# Script para instalar Supabase CLI usando Homebrew (macOS)
# Uso: ./scripts/instalar-supabase-homebrew.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Instalando Supabase CLI con Homebrew${NC}"
echo ""

# Verificar si Homebrew está instalado
if ! command -v brew &> /dev/null; then
    echo -e "${YELLOW}📦 Homebrew no está instalado. Instalando...${NC}"
    echo ""
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Homebrew instalado${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Agrega Homebrew a tu PATH:${NC}"
        echo '   echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zshrc'
        echo '   eval "$(/opt/homebrew/bin/brew shellenv)"'
        echo ""
        read -p "Presiona Enter después de agregar Homebrew a tu PATH..."
    else
        echo -e "${RED}❌ Error instalando Homebrew${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Homebrew encontrado${NC}"
    brew --version
fi

echo ""
echo -e "${YELLOW}📦 Instalando Supabase CLI...${NC}"

# Agregar tap de Supabase
brew tap supabase/tap

# Instalar Supabase CLI
brew install supabase

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Supabase CLI instalado correctamente${NC}"
    echo ""
    supabase --version
    echo ""
    echo -e "${GREEN}✨ ¡Instalación completada!${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos pasos:${NC}"
    echo ""
    echo "1. Autenticarte:"
    echo -e "   ${GREEN}supabase login${NC}"
    echo ""
    echo "2. Vincular tu proyecto:"
    echo -e "   ${GREEN}cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder${NC}"
    echo -e "   ${GREEN}supabase link --project-ref juiskeeutbaipwbeeezw${NC}"
    echo ""
    echo "3. Aplicar migraciones:"
    echo -e "   ${GREEN}supabase db push${NC}"
    echo ""
else
    echo -e "${RED}❌ Error instalando Supabase CLI${NC}"
    exit 1
fi
