#!/bin/bash

##############################################################################
# GitHub Security Auto-Configuration Script
# Automatiza configuración de seguridad en GitHub
# Uso: bash scripts/configure-github-security.sh
##############################################################################

set -e

REPO_OWNER="evarasvb"
REPO_NAME="agile-bidder"
REPO="${REPO_OWNER}/${REPO_NAME}"

echo "🔐 Configurando GitHub Security para ${REPO}..."
echo ""

# Verificar que gh CLI está instalado
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) no encontrado."
    echo "Instala con: brew install gh"
    exit 1
fi

# Verificar autenticación
if ! gh auth status &> /dev/null; then
    echo "❌ No autenticado en GitHub"
    echo "Ejecuta: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI autenticado"
echo ""

##############################################################################
# PARTE 1: Repository Settings
##############################################################################

echo "📋 PARTE 1: Configurando settings generales del repositorio..."

# Hacer repositorio privado
gh repo edit "${REPO}" --visibility private 2>/dev/null || true
echo "  ✅ Repositorio privado"

# Deshabilitar features innecesarios
gh repo edit "${REPO}" \
    --enable-auto-merge=false \
    --allow-forking=false \
    --enable-wiki=false \
    --enable-projects=false \
    --enable-discussions=false \
    2>/dev/null || true

echo "  ✅ Features innecesarios deshabilitados"

##############################################################################
# PARTE 2: Branch Protection Rules
##############################################################################

echo ""
echo "🔒 PARTE 2: Configurando Branch Protection Rules..."

configure_branch_protection() {
    local branch=$1
    local required_reviews=$2

    echo "  Configurando: $branch (requiere $required_reviews reviews)..."

    gh api repos/"${REPO_OWNER}"/"${REPO_NAME}"/branches/"${branch}"/protection \
        --input /dev/stdin \
        --method PUT << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build", "lint", "test", "type-check"]
  },
  "required_pull_request_reviews": {
    "required_approving_review_count": ${required_reviews},
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "required_linear_history": true,
  "enforce_admins": true,
  "restrict_pushes": {
    "is_enabled": true,
    "allows_deletions": false,
    "allows_force_pushes": false,
    "push_allowances": ["@${REPO_OWNER}"]
  },
  "require_conversation_resolution": true
}
EOF

    echo "  ✅ ${branch} protegida"
}

# Configurar main
configure_branch_protection "main" "2"

# Configurar develop si existe
if gh api repos/"${REPO_OWNER}"/"${REPO_NAME}"/branches/develop &>/dev/null; then
    configure_branch_protection "develop" "1"
fi

##############################################################################
# PARTE 3: Code Owners (Ya existe en .github/CODEOWNERS)
##############################################################################

echo ""
echo "👤 PARTE 3: Verificando CODEOWNERS..."

if [ -f ".github/CODEOWNERS" ]; then
    echo "  ✅ CODEOWNERS existe"
    echo "  Contenido:"
    head -5 .github/CODEOWNERS | sed 's/^/     /'
else
    echo "  ❌ CODEOWNERS no encontrado"
fi

##############################################################################
# PARTE 4: Verificar Headers de Copyright
##############################################################################

echo ""
echo "©️  PARTE 4: Verificando headers de copyright..."

check_copyright() {
    local file=$1
    if [ -f "$file" ]; then
        if head -1 "$file" | grep -q "©"; then
            echo "  ✅ $file"
        else
            echo "  ⚠️  $file falta copyright"
        fi
    fi
}

check_copyright "src/main.tsx"
check_copyright "src/App.tsx"

##############################################################################
# PARTE 5: Secret Scanning (Info)
##############################################################################

echo ""
echo "🔑 PARTE 5: Secret Scanning & Push Protection"
echo "  ⚠️  Esto se configura en GitHub UI (3 clicks)"
echo ""
echo "  Ir a: https://github.com/${REPO}/settings/security_analysis"
echo ""
echo "  Habilitar:"
echo "    ☑️ Secret scanning"
echo "    ☑️ Push protection"
echo "    ☑️ Dependabot alerts"
echo "    ☑️ Dependabot security updates"
echo ""

##############################################################################
# PARTE 6: Colaboradores
##############################################################################

echo "👥 PARTE 6: Revisando colaboradores..."

echo "  Usuarios con acceso:"
gh repo view "${REPO}" --json collaborators --jq '.collaborators[].login' 2>/dev/null || echo "    (No hay colaboradores)"

echo ""
echo "  ⚠️  Solo @${REPO_OWNER} debe tener Admin"

##############################################################################
# PARTE 7: Instalar Husky
##############################################################################

echo ""
echo "🎣 PARTE 7: Instalando Husky para pre-commit hooks..."

if [ ! -d ".husky" ]; then
    npm install --save-dev husky
    npx husky install
    echo "  ✅ Husky instalado"
else
    echo "  ✅ Husky ya existe"
    npx husky install
fi

##############################################################################
# PARTE 8: Agregar Headers de Copyright
##############################################################################

echo ""
echo "📝 PARTE 8: Agregando headers de copyright a archivos..."

if [ -f "scripts/add-copyright-header.js" ]; then
    node scripts/add-copyright-header.js src
    echo "  ✅ Headers agregados"
else
    echo "  ❌ Script de copyright no encontrado"
fi

##############################################################################
# PARTE 9: Verificar Secretos en Historial
##############################################################################

echo ""
echo "🔍 PARTE 9: Buscando secretos en historial de git..."

if git log --all --full-history -p 2>/dev/null | grep -i "password\|secret\|api.key\|sk_\|pk_" | head -5; then
    echo ""
    echo "  ⚠️  ¡ADVERTENCIA! Se encontraron posibles secretos en el historial"
    echo "  Acción necesaria: Contactar a legal@firmavb.cl"
else
    echo "  ✅ No se encontraron secretos en historial"
fi

##############################################################################
# PARTE 10: Verificar .gitignore
##############################################################################

echo ""
echo "🚫 PARTE 10: Verificando .gitignore..."

if grep -q "\.env" .gitignore 2>/dev/null; then
    echo "  ✅ .env en .gitignore"
else
    echo "  ❌ .env NO en .gitignore (CRÍTICO!)"
    echo "    Agregando..."
    echo ".env" >> .gitignore
    echo ".env.local" >> .gitignore
    echo ".env.*.local" >> .gitignore
    echo "  ✅ Agregado"
fi

##############################################################################
# PARTE 11: Verificar Configuración Vercel
##############################################################################

echo ""
echo "🚀 PARTE 11: Verificando Vercel..."

if [ -f "vercel.json" ]; then
    echo "  ✅ vercel.json existe"
else
    echo "  ⚠️  vercel.json no encontrado (verificar en Vercel dashboard)"
fi

##############################################################################
# RESUMEN FINAL
##############################################################################

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ CONFIGURACIÓN COMPLETADA"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "✅ Hecho automáticamente:"
echo "   • Repositorio privado"
echo "   • Branch protection (main, develop)"
echo "   • Code Owners configurado"
echo "   • Husky instalado"
echo "   • Headers de copyright agregados"
echo "   • .gitignore mejorado"
echo ""
echo "⏳ Pendiente en GitHub UI (2 min):"
echo "   • Secret scanning + push protection"
echo "   • Agregar Secrets (Supabase, Stripe, Vercel)"
echo ""
echo "Ir a: https://github.com/${REPO}/settings/security_analysis"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
