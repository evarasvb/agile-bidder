# 🔐 Configuración GitHub - GUÍA VISUAL RÁPIDA

**Tiempo: 10 minutos | Dificultad: Trivial | Pasos: 5**

---

## 📍 PASO 1: Branch Protection MAIN (3 min)

### 1️⃣ Abre esta URL:
```
https://github.com/evarasvb/agile-bidder/settings/branches/main/protection
```

### 2️⃣ Copia y Pega Esta Configuración:

```
☑️  Require a pull request before merging
    └─ Required number of approvals: 2
    └─ ☑️ Require review from Code Owners
    └─ ☑️ Dismiss stale pull request approvals when new commits are pushed

☑️  Require status checks to pass before merging
    └─ ☑️ Require branches to be up to date before merging
    └─ Status checks that are required:
       • build
       • lint
       • test
       • type-check

☑️  Require conversation resolution before merging

☑️  Restrict who can push to matching branches
    └─ Allow specified actors to bypass required pull requests
    └─ @evarasvb

☑️  Enforce all the above settings for administrators
```

### 3️⃣ Click "Save changes"

---

## 📍 PASO 2: Branch Protection DEVELOP (2 min)

### 1️⃣ Abre esta URL:
```
https://github.com/evarasvb/agile-bidder/settings/branches/develop/protection
```

### 2️⃣ Configuración (igual que MAIN pero con 1 review):

```
☑️  Require a pull request before merging
    └─ Required number of approvals: 1  ← SOLO 1
    └─ ☑️ Require review from Code Owners
    └─ ☑️ Dismiss stale reviews

☑️  Require status checks to pass
    └─ ☑️ Require branches to be up to date
    └─ Status checks:
       • build
       • lint
       • test
       (sin type-check)

☑️  Require conversation resolution

☑️  Restrict who can push
    └─ @evarasvb

☑️  Enforce for administrators
```

### 3️⃣ Click "Save changes"

---

## 📍 PASO 3: Branch Protection RELEASE/* (2 min)

### 1️⃣ Abre esta URL:
```
https://github.com/evarasvb/agile-bidder/settings/branches
```

### 2️⃣ Click "Add rule"

### 3️⃣ Usa este patrón:
```
Branch name pattern: release/*
```

### 4️⃣ Configuración (igual que MAIN):
```
☑️  Require pull request before merging (2 reviews)
☑️  Require Code Owner reviews
☑️  Dismiss stale reviews

☑️  Require status checks
    └─ build, lint, test, type-check

☑️  Require conversation resolution

☑️  Restrict who can push
    └─ @evarasvb

☑️  Enforce for administrators
```

### 5️⃣ Click "Create"

---

## 📍 PASO 4: Secret Scanning (2 min)

### 1️⃣ Abre esta URL:
```
https://github.com/evarasvb/agile-bidder/settings/security_analysis
```

### 2️⃣ Habilita estos (click los toggles):

```
✅ Secret scanning
   └─ Enable secret scanning

✅ Push protection
   └─ Enable push protection

✅ Dependabot alerts
   └─ Enable Dependabot alerts

✅ Dependabot security updates
   └─ Enable Dependabot security updates
```

---

## 📍 PASO 5: GitHub Secrets (2 min)

### 1️⃣ Abre esta URL:
```
https://github.com/evarasvb/agile-bidder/settings/secrets/actions
```

### 2️⃣ Click "New repository secret" 6 veces:

**Secret 1:**
```
Name: SUPABASE_URL
Value: [Tu URL de Supabase, ej: https://xxxxx.supabase.co]
```
Click "Add secret"

**Secret 2:**
```
Name: SUPABASE_ANON_KEY
Value: [Tu clave pública de Supabase]
```
Click "Add secret"

**Secret 3:**
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [Tu clave de servicio]
```
Click "Add secret"

**Secret 4:**
```
Name: STRIPE_SECRET_KEY
Value: [sk_live_...]
```
Click "Add secret"

**Secret 5:**
```
Name: STRIPE_PUBLISHABLE_KEY
Value: [pk_live_...]
```
Click "Add secret"

**Secret 6:**
```
Name: DEPLOYMENT_TOKEN
Value: [Tu token de Vercel]
```
Click "Add secret"

---

## ✅ VERIFICACIÓN FINAL (1 min)

### Verifica que todo está correcto:

1️⃣ **Branch Protection**
```
Ir a: Settings > Branches

Debe haber:
✅ main (2 reviews required)
✅ develop (1 review required)
✅ release/* (2 reviews required)
```

2️⃣ **Secret Scanning**
```
Ir a: Settings > Code security

Debe estar ENABLED:
✅ Secret scanning
✅ Push protection
✅ Dependabot alerts
✅ Dependabot updates
```

3️⃣ **Secrets**
```
Ir a: Settings > Secrets > Actions

Debe haber 6 secrets:
✅ SUPABASE_URL
✅ SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ STRIPE_SECRET_KEY
✅ STRIPE_PUBLISHABLE_KEY
✅ DEPLOYMENT_TOKEN
```

---

## 🎉 ¡LISTO!

**Tu aplicación está 100% protegida legalmente.**

```
✅ Documentos legales: Merged a main
✅ Headers de copyright: En código
✅ Pre-commit hooks: Instalado
✅ Branch protection: CONFIGURADO
✅ Secret scanning: ACTIVADO
✅ GitHub Secrets: AGREGADOS
✅ CODEOWNERS: Activo
```

---

## 📞 Si Algo Falla

**Branch Protection Error:**
- ✓ Verifica que eres admin del repo
- ✓ Verifica que la rama existe (main/develop)
- ✓ Intenta de nuevo

**Secret Error:**
- ✓ Verifica que el nombre sea exacto (may-sensitive)
- ✓ Verifica que el valor no esté vacío

**Secret Scanning No Aparece:**
- ✓ Es normal en algunos planes de GitHub
- ✓ Puedes habilitarlo en Settings > Code security

---

**Tiempo total: 10 minutos. Tu idea está protegida.**
