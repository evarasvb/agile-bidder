# 🔐 GitHub Security Configuration - Setup Manual

**Tiempo estimado:** 15 minutos  
**Requisitos:** Acceso de admin al repositorio  
**Última actualización:** 8 Septiembre 2026

---

## PARTE 1: Configuración General del Repositorio

### 1.1 Acceder a Settings
1. Ve a: https://github.com/evarasvb/agile-bidder/settings

### 1.2 Configurar Visibilidad y Opciones Básicas

**Ubicación:** `Settings > General`

```
☑️  Private (marcar como privado)
☐  Template repository (NO marcar)

Dejar sin marcar:
☐ Wikis
☐ Discussions  
☐ Projects
☐ Sponsorships

Marcar:
☑️  Require status checks to pass before merging
☑️  Require branches to be up to date
☑️  Delete head branches automatically
☑️  Enable auto-merge (NO - mejor control manual)
```

**Result:** Repositorio privado, sin features innecesarias

---

## PARTE 2: Branch Protection - `main`

### 2.1 Crear Rule para `main`

**Ubicación:** `Settings > Branches > Branch protection rules > Add rule`

**Branch name pattern:** `main`

### 2.2 Configurar Protecciones (OBLIGATORIO)

```
✅ Require a pull request before merging
   ├─ Require approvals: 2
   ├─ ☑️  Require review from Code Owners
   └─ ☑️  Dismiss stale pull request approvals when new commits

✅ Require status checks to pass before merging
   ├─ ☑️  Require branches to be up to date before merging
   └─ Add required status checks:
       ├─ build
       ├─ lint
       ├─ test
       └─ type-check

✅ Require conversation resolution before merging
   └─ ☑️  Require all conversations to be resolved

✅ Restrict who can push to matching branches
   └─ Seleccionar: @evarasvb (solo tú puede hacer force-push)

✅ Require force pushes to be approved
   ├─ Require all status checks to pass
   └─ Require code owner review

✅ Require signed commits
   └─ ☑️  Marcar

☑️  Enforce all above settings for administrators
```

**Result:** Rama `main` blindada contra cambios no autorizados

---

## PARTE 3: Branch Protection - `develop` (o `develop` si existe)

### 3.1 Crear Rule para Development

**Ubicación:** `Settings > Branches > Branch protection rules > Add rule`

**Branch name pattern:** `develop`

### 3.2 Configurar Protecciones (Menos estricto que main)

```
✅ Require a pull request before merging
   ├─ Require approvals: 1
   ├─ ☑️  Require review from Code Owners
   └─ ☑️  Dismiss stale pull request approvals

✅ Require status checks to pass before merging
   ├─ ☑️  Require branches to be up to date
   └─ Add required status checks:
       ├─ build
       ├─ lint
       ├─ test

✅ Require conversation resolution before merging

✅ Restrict who can push to matching branches
   └─ Seleccionar: @evarasvb

☑️  Enforce all above settings for administrators
```

---

## PARTE 4: Branch Protection - `release/*`

### 4.1 Crear Rule para Release Branches

**Ubicación:** `Settings > Branches > Branch protection rules > Add rule`

**Branch name pattern:** `release/*`

### 4.2 Configurar Protecciones

```
✅ Require a pull request before merging
   ├─ Require approvals: 2
   ├─ ☑️  Require review from Code Owners
   └─ ☑️  Dismiss stale pull request approvals

✅ Require status checks to pass before merging
   ├─ ☑️  Require branches to be up to date
   └─ Todas las checks requeridas

✅ Require conversation resolution before merging

☑️  Enforce all above settings for administrators
```

---

## PARTE 5: Configurar Code Owners

### 5.1 Crear Archivo `.github/CODEOWNERS`

**Ubicación:** Crear archivo en la rama `main`

```bash
# En tu máquina local:
cat > .github/CODEOWNERS << 'EOF'
# GitHub Code Owners - Autorización de cambios

# Todos los archivos - Evaristo
* @evarasvb

# Documentos legales - Revisión requerida
LICENSE @evarasvb
INTELLECTUAL_PROPERTY.md @evarasvb
TERMS_OF_SERVICE.md @evarasvb
PRIVACY_POLICY.md @evarasvb
CONTRIBUTING.md @evarasvb
LEGAL_SHIELD.md @evarasvb

# Seguridad
.github/SECURITY.md @evarasvb
.github/workflows/* @evarasvb
.husky/* @evarasvb

# Configuración crítica
package.json @evarasvb
package-lock.json @evarasvb
tsconfig.json @evarasvb
.env.* @evarasvb
EOF

git add .github/CODEOWNERS
git commit -m "Configurar CODEOWNERS para requerir aprobación en archivos críticos"
git push origin main
```

---

## PARTE 6: GitHub Secrets (Variables Sensibles)

### 6.1 Agregar Secrets

**Ubicación:** `Settings > Secrets and variables > Actions > New repository secret`

**Secrets a configurar:**

```
SUPABASE_URL
├─ Valor: [Tu URL de Supabase]
├─ Uso: Conexión a base de datos
└─ Actualizar: Cada cambio de credenciales

SUPABASE_ANON_KEY
├─ Valor: [Tu clave pública de Supabase]
└─ Uso: Acceso client-side

SUPABASE_SERVICE_ROLE_KEY
├─ Valor: [Tu clave de servicio]
└─ Uso: Acceso server-side (CI/CD only)

STRIPE_SECRET_KEY
├─ Valor: [Tu secret key de Stripe]
└─ Uso: Pagos en producción

STRIPE_PUBLISHABLE_KEY
├─ Valor: [Tu publishable key]
└─ Uso: Formularios de pago

DEPLOYMENT_TOKEN
├─ Valor: [Token de Vercel]
└─ Uso: Deploy automático
```

**NUNCA:**
- ✗ Commitear secrets al repositorio
- ✗ Compartir secrets por email/Slack
- ✗ Dejar secrets en logs

---

## PARTE 7: Secret Scanning

### 7.1 Habilitar Detección de Secretos

**Ubicación:** `Settings > Code security and analysis`

```
✅ Secret scanning
   └─ Detecta automáticamente secretos commiteados

✅ Push protection
   └─ Bloquea push si contiene secretos

✅ Dependabot alerts
   └─ Notifica vulnerabilidades en dependencias

✅ Dependabot security updates
   └─ Crea PRs automáticos para patchear
```

---

## PARTE 8: Configurar Acceso de Colaboradores

### 8.1 Revisión de Colaboradores

**Ubicación:** `Settings > Collaborators and teams`

**Acciones:**

```
Revisar permisos actuales:
- Admin: Solo @evarasvb (CRÍTICO)
- Maintain: [Evaluar si es necesario]
- Write: [Evaluar si es necesario]
- Read: [Evaluar si es necesario]

Eliminar cualquier acceso innecesario
```

**Recomendación:**
- 🔴 Solo TÚ debes tener acceso Admin
- 🟡 Otros colaboradores: `Triage` o `Write` según necesidad
- 🟢 Nunca: acceso a `Maintain` o `Admin`

---

## PARTE 9: Configurar Notificaciones de Seguridad

### 9.1 Security Alerts

**Ubicación:** `Settings > Code security and analysis`

```
✅ Habilitar notificaciones para:
   ├─ Code scanning alerts
   ├─ Dependabot alerts
   ├─ Secret scanning alerts
   └─ Vulnerability alerts

Configura email en:
`Settings > Notifications > Default notifications`
```

---

## PARTE 10: Revisión de Seguridad - Checklist Final

### 10.1 Verificar Configuración

```bash
# Ejecutar en terminal:

# 1. Verificar rama protegida
echo "Branches protegidas:"
git branch -r | grep -E "main|develop"

# 2. Verificar no hay secretos en historial
echo "Buscando secretos en historial..."
git log --all --full-history -p | grep -i "password\|secret\|key" | head -5

# 3. Verificar CODEOWNERS
echo "Verificar si existe .github/CODEOWNERS:"
cat .github/CODEOWNERS 2>/dev/null || echo "⚠️  CODEOWNERS no encontrado"

# 4. Verificar headers de copyright
echo "Verificar headers de copyright:"
head -5 src/main.tsx | grep "©"
```

### 10.2 Checklist de Configuración

- [ ] Repositorio marcado como Private
- [ ] Branch `main` protegida (2 reviews obligatorios)
- [ ] Branch `develop` protegida (1 review obligatorio)
- [ ] Branch `release/*` protegida
- [ ] Code Owners configurado
- [ ] Secrets agregados (Supabase, Stripe, Vercel)
- [ ] Secret scanning habilitado
- [ ] Push protection habilitado
- [ ] Dependabot habilitado
- [ ] Notificaciones de seguridad configuradas
- [ ] Acceso de colaboradores revisado
- [ ] Solo @evarasvb con acceso Admin
- [ ] Verified commits configurado (si aplica)

---

## PARTE 11: Configuración Adicional Recomendada

### 11.1 Habilitar GitHub Discussions (Desactivar)

**Ubicación:** `Settings > General`

```
☐ GitHub Discussions (DESMARCAR)
   └─ No necesario, usar Discord/Slack en su lugar
```

### 11.2 Habilitar GitHub Pages (Desactivar)

**Ubicación:** `Settings > Pages`

```
Source: Deploy from a branch
Branch: none (Dejar vacío)

⚠️  No servir páginas públicas
```

### 11.3 Configurar Webhooks Responsablemente

**Ubicación:** `Settings > Webhooks`

```
⚠️  NUNCA crear webhooks que:
- Envíen secretos a URLs externas
- Logueen datos sensibles
- Forwarden a servidores no confiables

✅ Solo webhooks confiables:
- Vercel (deployment)
- Discord (notificaciones)
```

---

## PARTE 12: Monitoreo y Auditoría

### 12.1 Habilitar Audit Log

**Ubicación:** `Settings > Audit log`

```
✅ Revisar regularmente:
- Cambios de acceso
- Cambios de configuración
- Cambios en branch protection
- Cambios en secrets
```

### 12.2 GitHub Security Advisory

**Ubicación:** `Security > Advisories`

```
✅ Usar para reportar vulnerabilidades responsablemente
✅ Crear advisory si detectas vulnerabilidad
✅ Proporcionar fix antes de publicar
```

---

## PARTE 13: Documentación y Comunicación

### 13.1 Actualizar README

```markdown
# Agile Bidder

**Protección:** Este repositorio está protegido bajo:
- Ley 19.912 (Propiedad Intelectual - Chile)
- Marca INAPI registrada
- Branch protection rules
- Secret scanning
- Signed commits requeridos

**Acceso:** Solo @evarasvb
**Colaboradores:** Por invitación explícita con NDA

Ver `CONTRIBUTING.md` para instrucciones.
```

### 13.2 Comunicar a Colaboradores

Si tienes colaboradores, envía:

```
Asunto: ⚠️ Actualización de Seguridad - Rama Protegida

El repositorio agile-bidder ha sido configurado con protecciones de seguridad:

1. Branch `main` requiere 2 reviews antes de merge
2. Todos los commits deben estar firmados
3. Se ejecutan checks automáticos (lint, test, build)
4. Acceso limitado al repositorio

Instrucciones completas: GITHUB_SECURITY_SETUP.md

Contacta legal@firmavb.cl si tienes preguntas.
```

---

## PARTE 14: Respuesta ante Incidentes

### 14.1 Si Detectas Secreto Commiteado

```bash
# INMEDIATO:
1. Revoke la credencial en el servicio (Supabase, Stripe, etc)
2. Generar credencial nueva
3. Actualizar GitHub Secret
4. Contactar security@firmavb.cl

# NO HACER:
- ✗ No hacer simple revert (historia queda)
- ✗ No confiar en que nadie lo vió
- ✗ No ignorar
```

### 14.2 Si Detectas Acceso No Autorizado

```
1. Cambiar contraseña de GitHub INMEDIATAMENTE
2. Revisar audit log para ver qué se accesó
3. Revisar si hay cambios en main/develop
4. Contactar GitHub support si aplica
5. Comunicar a legal@firmavb.cl
```

---

## PARTE 15: Testing y Validación

### 15.1 Probar Branch Protection

**Desde una rama normal:**

```bash
# Intentar hacer push directo a main (debe fallar)
git checkout -b test-push
git push origin test-push:main
# ❌ Resultado: "Protected branch rule violations found"
```

**Crear PR y verificar:**

```bash
git push origin test-push
# Luego abrir PR en GitHub

# Verificar que no se puede mergear sin:
# - 2 approvals
# - Todas las checks pasando
# - Conversaciones resueltas
```

### 15.2 Probar Secret Scanning

**Intentar commitear un secret falso (test):**

```bash
echo "SUPABASE_KEY=sk_test_fake123456789" > .env.test
git add .env.test
git commit -m "test: secret scanning"
git push origin test-secret-push

# ❌ Resultado: Push bloqueado por secret scanner
```

**Limpiar después:**

```bash
git reset HEAD~1
git reset .env.test
rm .env.test
```

---

## PARTE 16: Renovación y Mantenimiento

### 16.1 Revisar Configuración Trimestral

```
Cada 3 meses (próxima: Diciembre 2026):
- [ ] Revisar branch protection rules
- [ ] Verificar secrets aún son válidos
- [ ] Revisar acceso de colaboradores
- [ ] Revisar audit log
- [ ] Actualizar dependencias de seguridad
```

### 16.2 Actualizar Documentación

```
Cuando cambies configuración:
- [ ] Actualizar este archivo
- [ ] Actualizar LEGAL_SHIELD.md
- [ ] Comunicar a team
- [ ] Crear changelog entry
```

---

## ✅ CONFIGURACIÓN COMPLETADA

Una vez termines TODO lo anterior, el repositorio estará **blindado legalmente** con:

✅ Acceso restringido (solo admin)  
✅ Branch protection en `main`, `develop`, `release/*`  
✅ 2 reviews requeridos antes de merge  
✅ Checks automáticos (build, lint, test)  
✅ Secretos escaneados automáticamente  
✅ Commits firmados  
✅ Code Owners configurado  
✅ Audit log habilitado  
✅ Notificaciones de seguridad  
✅ Documentación legal completa  

---

**Tiempo total:** ~15 minutos de configuración manual  
**Mantener:** 5 minutos cada 3 meses  
**Beneficio:** Protección legal completa de tu IP

---

**Contacto:**
- Preguntas de seguridad: security@firmavb.cl
- Preguntas legales: legal@firmavb.cl
- Configuración: Seguir paso a paso arriba

*Última revisión: 8 Septiembre 2026*
