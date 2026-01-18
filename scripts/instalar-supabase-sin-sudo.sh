#!/bin/bash

# Script para instalar Supabase CLI sin usar sudo
# Configura npm para usar un directorio local
# Uso: ./scripts/instalar-supabase-sin-sudo.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Instalando Supabase CLI (sin sudo)${NC}"
echo ""

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm no está instalado${NC}"
    echo "   Instala Node.js desde: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ npm encontrado${NC}"

# Crear directorio para paquetes globales
echo -e "${YELLOW}📁 Configurando directorio para paquetes globales...${NC}"
mkdir -p ~/.npm-global

# Configurar npm
echo -e "${YELLOW}⚙️  Configurando npm...${NC}"
npm config set prefix '~/.npm-global'

# Agregar al PATH si no está
if ! grep -q '~/.npm-global/bin' ~/.zshrc 2>/dev/null; then
    echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
    echo -e "${GREEN}✅ PATH agregado a ~/.zshrc${NC}"
else
    echo -e "${YELLOW}⚠️  PATH ya está configurado${NC}"
fi

# Recargar configuración
export PATH=~/.npm-global/bin:$PATH

echo ""
echo -e "${YELLOW}📦 Instalando Supabase CLI...${NC}"
npm install -g supabase

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Supabase CLI instalado correctamente${NC}"
    echo ""
    ~/.npm-global/bin/supabase --version
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
    echo "   Cierra y vuelve a abrir tu terminal, o ejecuta:"
    echo -e "   ${GREEN}source ~/.zshrc${NC}"
    echo ""
    echo -e "${GREEN}✨ ¡Instalación completada!${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos pasos:${NC}"
    echo ""
    echo "1. Recargar terminal o ejecutar:"
    echo -e "   ${GREEN}source ~/.zshrc${NC}"
    echo ""
    echo "2. Autenticarte:"
    echo -e "   ${GREEN}supabase login${NC}"
    echo ""
    echo "3. Vincular tu proyecto:"
    echo -e "   ${GREEN}cd /Users/marketingdiseno/CompraAgil_VB/mercadopublico-scraper/agile-bidder${NC}"
    echo -e "   ${GREEN}supabase link --project-ref juiskeeutbaipwbeeezw${NC}"
    echo ""
    echo "4. Aplicar migraciones:"
    echo -e "   ${GREEN}supabase db push${NC}"
    echo ""
else
    echo -e "${RED}❌ Error instalando Supabase CLI${NC}"
    exit 1
fi
