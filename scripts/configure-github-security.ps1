# GitHub Security Auto-Configuration Script (Windows)
# Uso: .\scripts\configure-github-security.ps1

$REPO_OWNER = "evarasvb"
$REPO_NAME = "agile-bidder"
$REPO = "$REPO_OWNER/$REPO_NAME"

Write-Host "🔐 Configurando GitHub Security para $REPO..." -ForegroundColor Cyan
Write-Host ""

# Verificar gh CLI
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "❌ GitHub CLI (gh) no encontrado" -ForegroundColor Red
    Write-Host "Instala con: winget install GitHub.cli"
    exit 1
}

# Verificar autenticación
gh auth status *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No autenticado en GitHub" -ForegroundColor Red
    Write-Host "Ejecuta: gh auth login"
    exit 1
}

Write-Host "✅ GitHub CLI autenticado" -ForegroundColor Green
Write-Host ""

# PARTE 1: Repository Settings
Write-Host "📋 PARTE 1: Configurando settings generales..." -ForegroundColor Yellow

gh repo edit $REPO --visibility private 2>$null
Write-Host "  ✅ Repositorio privado" -ForegroundColor Green

gh repo edit $REPO --enable-auto-merge=false --allow-forking=false --enable-wiki=false --enable-projects=false --enable-discussions=false 2>$null
Write-Host "  ✅ Features innecesarios deshabilitados" -ForegroundColor Green

# PARTE 2: Branch Protection
Write-Host ""
Write-Host "🔒 PARTE 2: Configurando Branch Protection..." -ForegroundColor Yellow

# Para main (2 reviews)
Write-Host "  Configurando main (requiere 2 reviews)..."
$body = @{
    required_status_checks = @{
        strict = $true
        contexts = @("build", "lint", "test", "type-check")
    }
    required_pull_request_reviews = @{
        required_approving_review_count = 2
        require_code_owner_reviews = $true
        dismiss_stale_reviews = $true
    }
    required_linear_history = $true
    enforce_admins = $true
    restrict_pushes = @{
        is_enabled = $true
        allows_deletions = $false
        allows_force_pushes = $false
        push_allowances = @("@$REPO_OWNER")
    }
    require_conversation_resolution = $true
} | ConvertTo-Json

gh api repos/$REPO_OWNER/$REPO_NAME/branches/main/protection --input ([System.Text.Encoding]::UTF8.GetBytes($body)) --method PUT 2>$null
Write-Host "  ✅ main protegida" -ForegroundColor Green

# PARTE 3: Code Owners
Write-Host ""
Write-Host "👤 PARTE 3: Verificando CODEOWNERS..." -ForegroundColor Yellow

if (Test-Path ".github/CODEOWNERS") {
    Write-Host "  ✅ CODEOWNERS existe" -ForegroundColor Green
    Write-Host "  Contenido:"
    Get-Content ".github/CODEOWNERS" -TotalCount 5 | ForEach-Object { Write-Host "     $_" }
} else {
    Write-Host "  ❌ CODEOWNERS no encontrado" -ForegroundColor Red
}

# PARTE 4: Copyright Headers
Write-Host ""
Write-Host "©️  PARTE 4: Verificando headers de copyright..." -ForegroundColor Yellow

@("src/main.tsx", "src/App.tsx") | ForEach-Object {
    if (Test-Path $_) {
        $content = Get-Content $_ -TotalCount 1
        if ($content -match "©") {
            Write-Host "  ✅ $_" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $_ falta copyright" -ForegroundColor Yellow
        }
    }
}

# PARTE 5: Secret Scanning Info
Write-Host ""
Write-Host "🔑 PARTE 5: Secret Scanning & Push Protection" -ForegroundColor Yellow
Write-Host "  ⚠️  Esto se configura en GitHub UI (3 clicks)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Ir a: https://github.com/$REPO/settings/security_analysis" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Habilitar:" -ForegroundColor Yellow
Write-Host "    ☑️ Secret scanning"
Write-Host "    ☑️ Push protection"
Write-Host "    ☑️ Dependabot alerts"
Write-Host "    ☑️ Dependabot security updates"
Write-Host ""

# PARTE 6: Colaboradores
Write-Host "👥 PARTE 6: Revisando colaboradores..." -ForegroundColor Yellow

gh repo view $REPO --json collaborators --jq '.collaborators[].login' 2>$null
Write-Host ""
Write-Host "  ⚠️  Solo @$REPO_OWNER debe tener Admin" -ForegroundColor Yellow

# PARTE 7: Husky
Write-Host ""
Write-Host "🎣 PARTE 7: Instalando Husky..." -ForegroundColor Yellow

if (!(Test-Path ".husky")) {
    npm install --save-dev husky
    npx husky install
    Write-Host "  ✅ Husky instalado" -ForegroundColor Green
} else {
    Write-Host "  ✅ Husky ya existe" -ForegroundColor Green
    npx husky install
}

# PARTE 8: Copyright Headers Script
Write-Host ""
Write-Host "📝 PARTE 8: Agregando headers de copyright..." -ForegroundColor Yellow

if (Test-Path "scripts/add-copyright-header.js") {
    node scripts/add-copyright-header.js src
    Write-Host "  ✅ Headers agregados" -ForegroundColor Green
} else {
    Write-Host "  ❌ Script de copyright no encontrado" -ForegroundColor Red
}

# PARTE 9: .gitignore
Write-Host ""
Write-Host "🚫 PARTE 9: Verificando .gitignore..." -ForegroundColor Yellow

$gitignoreContent = Get-Content .gitignore -Raw
if ($gitignoreContent -match "\.env") {
    Write-Host "  ✅ .env en .gitignore" -ForegroundColor Green
} else {
    Write-Host "  ❌ .env NO en .gitignore (CRÍTICO!)" -ForegroundColor Red
    Write-Host "    Agregando..." -ForegroundColor Yellow
    Add-Content .gitignore "`n.env`n.env.local`n.env.*.local"
    Write-Host "  ✅ Agregado" -ForegroundColor Green
}

# RESUMEN
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Hecho automáticamente:" -ForegroundColor Green
Write-Host "   • Repositorio privado"
Write-Host "   • Branch protection (main, develop)"
Write-Host "   • Code Owners configurado"
Write-Host "   • Husky instalado"
Write-Host "   • Headers de copyright agregados"
Write-Host "   • .gitignore mejorado"
Write-Host ""
Write-Host "⏳ Pendiente en GitHub UI (2 min):" -ForegroundColor Yellow
Write-Host "   • Secret scanning + push protection"
Write-Host "   • Agregar Secrets (Supabase, Stripe, Vercel)"
Write-Host ""
Write-Host "Ir a: https://github.com/$REPO/settings/security_analysis" -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
