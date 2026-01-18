# 🚨 PLAN DE CONSOLIDACIÓN GIT - FIRMAVB

**Fecha:** 18 de Enero 2026  
**Problema:** Rama divergida, cambios locales no sincronizados

---

## ❌ SITUACIÓN ACTUAL

### Estado Git:
- **Rama local:** `main`
- **Rama remota:** `origin/main`
- **Problema:** **DIVERGIDA** - 1 commit local, 18 commits remotos no sincronizados
- **Cambios sin commitear:** ~30 archivos modificados + archivos nuevos

### Cambios Locales Críticos (No Commitados):

**Componentes Frontend:**
- `src/hooks/useComprasAgiles.ts` - Filtro datos de prueba
- `src/hooks/useOrdenesCompra.ts` - Extracción mejorada de datos
- `src/components/compras-agiles/MatchPanel.tsx` - Matching 5→20
- `src/components/bi/BIFiltersPanel.tsx` - Fix BI pages
- `src/pages/OrdenesCompra.tsx` - Mejoras UI

**Migraciones Supabase:**
- `20260118000001_limpiar_datos_prueba_final.sql` - Eliminar datos prueba
- `20260118000002_fix_rls_usuarios.sql` - Fix RLS usuarios
- `20260118000003_fix_rls_licitacion_items.sql` - Fix RLS scraper

**Edge Functions:**
- `supabase/functions/sync-compras-agiles/index.ts` - Fix bug
- `evaristo/evaristo_manager.py` - Poderes ampliados

---

## 🎯 PLAN DE ACCIÓN

### Paso 1: Guardar Cambios Actuales (Stash)
```bash
# Excluir .env del stash (tiene credenciales)
git stash push -m "Cambios críticos antes de sync" -- src/ supabase/ evaristo/ scripts/
```

### Paso 2: Traer Cambios Remotos
```bash
# Traer commits remotos
git fetch origin

# Ver qué hay en origin/main que no tenemos
git log --oneline HEAD..origin/main
```

### Paso 3: Merge o Rebase (Decision Required)
**Opción A: Merge (Más Seguro)**
```bash
git pull origin main --no-rebase
# Resolver conflictos si hay
```

**Opción B: Rebase (Limpio pero más riesgoso)**
```bash
git pull origin main --rebase
# Resolver conflictos si hay
```

### Paso 4: Aplicar Cambios Locales
```bash
# Recuperar cambios guardados
git stash pop

# Resolver conflictos si hay
```

### Paso 5: Commit de Cambios Críticos
```bash
# Agregar archivos críticos (sin .env)
git add src/ supabase/migrations/ supabase/functions/ evaristo/

# Commit con mensaje descriptivo
git commit -m "feat: Correcciones críticas - filtro datos prueba, RLS usuarios, matching mejorado, extracción datos órdenes"
```

### Paso 6: Push a GitHub
```bash
git push origin main
```

---

## ⚠️ ARCHIVOS A NO COMMITEAR

- `.env` - Tiene credenciales (ya está en .gitignore)
- `deno.lock` - Puede ser específico del entorno
- Archivos de documentación temporal (opcional)

---

## 📋 CHECKLIST PRE-COMMIT

Antes de hacer commit, verificar:

- [ ] `.env` NO está en staging
- [ ] Todas las migraciones tienen `IF NOT EXISTS` donde corresponde
- [ ] No hay errores de TypeScript (`npm run type-check`)
- [ ] No hay errores de lint (`npm run lint`)
- [ ] Migraciones ya aplicadas en Supabase (ya están aplicadas)

---

## 🔧 COMANDOS DE VERIFICACIÓN

```bash
# Ver estado actual
git status

# Ver diferencias con origin/main
git log --oneline HEAD..origin/main

# Ver cambios locales sin commitear
git diff --stat HEAD

# Verificar que .env no esté en staging
git diff --cached .env  # Debe dar error o no mostrar nada
```

---

## 🚀 DESPUÉS DEL PUSH

1. **Verificar en GitHub** que el push fue exitoso
2. **Verificar en Lovable** que detecta los cambios
3. **Trigger deploy manual** si auto-deploy no funciona
4. **Verificar en firmavb.cl** que los cambios se reflejan

---

## 📝 NOTAS

- **No hacer force push** - puede romper el historial
- **Revisar conflictos cuidadosamente** - pueden ser importantes
- **Probar localmente** antes de push si es posible
- **Las migraciones ya están aplicadas** - no afectan al deploy

---

## ⚡ ACCIÓN INMEDIATA RECOMENDADA

**Ejecutar estos comandos en orden:**

1. `git stash push -m "Pre-sync cambios críticos" -- src/ supabase/ evaristo/`
2. `git fetch origin`
3. `git pull origin main --no-rebase` (o --rebase si prefieres)
4. `git stash pop`
5. Resolver conflictos si hay
6. `git add src/ supabase/ evaristo/`
7. `git commit -m "feat: Correcciones críticas del sistema"`
8. `git push origin main`
