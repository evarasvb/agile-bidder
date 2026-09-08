# 🤖 GitHub Auto-Configuration Guide

Automatización de configuración de seguridad en GitHub.

---

## 🚀 OPCIÓN 1: Script Bash (Recomendado - Linux/Mac)

### Requisitos
```bash
# Instalar GitHub CLI
brew install gh  # Mac
# o en Linux:
# sudo apt install gh

# Autenticar
gh auth login
```

### Ejecutar
```bash
bash scripts/configure-github-security.sh
```

**Lo que hace:**
- ✅ Repositorio privado
- ✅ Branch protection (main, develop)
- ✅ Code Owners configurado
- ✅ Husky instalado
- ✅ Headers de copyright agregados
- ✅ .gitignore mejorado

**Pendiente (manual):**
- ⏳ Secret scanning en GitHub UI
- ⏳ GitHub Secrets (Supabase, Stripe, Vercel)

---

## 🪟 OPCIÓN 2: Script PowerShell (Windows)

### Requisitos
```powershell
# Instalar GitHub CLI
winget install GitHub.cli

# Autenticar
gh auth login
```

### Ejecutar
```powershell
.\scripts\configure-github-security.ps1
```

**Mismo resultado que Bash**

---

## ⚙️ OPCIÓN 3: GitHub Actions Workflow (Verificación Automática)

Se ejecuta en GitHub automáticamente.

### Usarlo
```
Ve a: GitHub > Actions > "🔐 Security Configuration"

Haz clic en: "Run workflow"

Elige acción:
- verify      → Verifica todo está correcto
- check-headers    → Busca archivos sin copyright
- scan-secrets    → Busca secretos en historial
- setup-secrets   → Instrucciones para agregar secrets
```

---

## 📋 OPCIÓN 4: Manual (Web)

Si no quieres usar scripts:

### Paso 1: Repository Settings (2 min)
```
https://github.com/evarasvb/agile-bidder/settings

☑️  Private
☑️  Delete head branches on merge
☐  Wikis, Discussions, Projects
```

### Paso 2: Branch Protection (5 min)
```
Settings > Branches > Add rule

Branch: main
Require: 2 reviews
Code Owners: ✅
Status checks: build, lint, test, type-check
Enforce for admins: ✅
```

### Paso 3: Security Features (2 min)
```
Settings > Code security and analysis

✅ Secret scanning
✅ Push protection
✅ Dependabot alerts
✅ Dependabot updates
```

### Paso 4: GitHub Secrets (2 min)
```
Settings > Secrets and variables > Actions

Add 6 secrets:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_PUBLISHABLE_KEY
- DEPLOYMENT_TOKEN
```

---

## ✅ Verificación Post-Configuración

### Test 1: Branch Protection
```bash
git checkout -b test-push
echo "test" > test.txt
git add test.txt
git commit -m "test"
git push origin test-push:main  # Debe FALLAR
# Expected: Protected branch rule violations found

# Limpiar:
git checkout main
git branch -D test-push
git push origin --delete test-push
```

### Test 2: Secret Scanning
```bash
# Intentar agregar un secret falso
echo "SUPABASE_KEY=sk_test_fake123" >> .env
git add .env
git commit -m "test"
git push  # Debe FALLAR

# Limpiar:
git reset HEAD~1
rm .env
```

### Test 3: Verificar CODEOWNERS
```bash
# Ver CODEOWNERS
cat .github/CODEOWNERS

# Expected: @evarasvb en archivos críticos
```

---

## 🔍 Verificación en GitHub

### Verificar Branch Protection
```
Settings > Branches

Debe haber reglas para:
✅ main (2 reviews)
✅ develop (1 review)
✅ release/* (2 reviews)
```

### Verificar Secret Scanning
```
Settings > Code security and analysis

Debe estar ENABLED:
✅ Secret scanning
✅ Push protection
✅ Dependabot
```

### Verificar Secrets
```
Settings > Secrets and variables > Actions

Debe haber 6 secrets:
✅ SUPABASE_URL
✅ SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ STRIPE_SECRET_KEY
✅ STRIPE_PUBLISHABLE_KEY
✅ DEPLOYMENT_TOKEN
```

### Verificar Colaboradores
```
Settings > Collaborators

Only @evarasvb should have Admin
```

---

## 📊 Comparación de Opciones

| Opción | Tiempo | Automatización | Requisitos |
|--------|--------|-----------------|-----------|
| Script Bash | 5 min | 90% | gh CLI |
| Script PowerShell | 5 min | 90% | gh CLI |
| GitHub Actions | 2 min | 70% | N/A |
| Manual Web | 15 min | 0% | Navegador |

---

## ⚠️ Notas Importantes

### 1. GitHub CLI Autenticación
```bash
# Si no está autenticado:
gh auth login

# Elegir:
# - GitHub.com
# - HTTPS
# - Y o Authenticate with your GitHub credentials
```

### 2. Secrets Seguros
```
NUNCA:
- ✗ Commitear .env
- ✗ Compartir secrets por email
- ✗ Loguear secrets

SIEMPRE:
- ✓ Usar GitHub Secrets
- ✓ Mantener .env en .gitignore
- ✓ Rotar secrets anualmente
```

### 3. Si Algo Falla
```
Ejecuta verificación:
gh repo view evarasvb/agile-bidder --json branchProtectionRules

Si no funciona branch protection:
1. Asegúrate de tener permisos de admin
2. Verifica que main existe
3. Intenta configurar manualmente en web
```

---

## 🔗 Enlaces Útiles

- [GitHub CLI Docs](https://cli.github.com/manual/)
- [Branch Protection Guide](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Code Owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

---

## 📞 Soporte

Si tienes problemas:
1. Ejecuta el workflow de verificación: `verify`
2. Revisa los logs del workflow
3. Contacta: legal@firmavb.cl

---

**Última actualización:** 8 Septiembre 2026
