# Deploy de www.firmavb.cl — runbook

Este archivo existe para responder, sin adivinar, tres preguntas: **qué está conectado**,
**dónde mirar** y **cómo dejar un cambio en producción**. Todo lo de abajo fue verificado
contra la API de Vercel y el repo, no es de memoria.

---

## 1. Qué está conectado

```
GitHub  evarasvb/agile-bidder  (repo PÚBLICO)
   │
   │  push  ──────────────────────────────────┐
   ▼                                          │
Vercel  proyecto "agile-bidder"               │
   ├─ id      prj_o4rwj8aEwjcnOuraUJ2zXSJfpgGx│
   ├─ team    vamosle (team_Pm5sajvBQQzhiv0p5oi8AAmU)
   ├─ framework  vite
   └─ dominios
        ├─ www.firmavb.cl        ← el sitio productivo
        ├─ firmavb.cl            ← apex
        ├─ agile-bidder.vercel.app
        └─ agile-bidder-git-main-vamosle.vercel.app   ← alias de la rama main
```

**No hay ningún paso manual.** Vercel escucha el repo por webhook de GitHub.

## 2. Cómo se despliega (el mecanismo real)

Verificado sobre los últimos 20 deployments: **el 100% son disparados por git**. No hay
deploys por CLI en este proyecto.

| Empujas a… | Vercel crea… | Queda en |
|---|---|---|
| `main` | deployment con `target: "production"` | **www.firmavb.cl** y `firmavb.cl` |
| cualquier otra rama | deployment de **preview** (`target: null`) | `agile-bidder-git-<rama>-vamosle.vercel.app` |

Build que corre Vercel: `npm run build` → `tsc -b && vite build`.
Salida estática servida desde `dist/`.

## 3. Procedimiento para dejar un cambio en producción

```bash
# 0. SIEMPRE partir del main real. Los clones de sesiones viejas quedan atrás.
git fetch origin main
git checkout -B mi-rama origin/main

# 1. Cambios + verificación local con el MISMO comando que usa Vercel
npm ci
npm run build        # tsc -b && vite build  -> si falla acá, falla en Vercel
npm run lint
npm test

# 2. Subir la rama -> genera un PREVIEW, no toca producción
git push -u origin mi-rama

# 3. Revisar el preview en agile-bidder-git-<rama>-vamosle.vercel.app

# 4. Merge del PR a main -> ESO es el deploy a producción
```

**El merge a `main` es el deploy.** No hay que ejecutar nada más.

## 4. Dónde mirar

- **Dashboard**: https://vercel.com/vamosle/agile-bidder
- **Inspector de un deployment**: `https://vercel.com/vamosle/agile-bidder/<deploymentId>`
- **Estado actual del proyecto** (dominios + último deployment):
  herramienta MCP `mcp__Vercel__get_project` con
  `projectId=prj_o4rwj8aEwjcnOuraUJ2zXSJfpgGx`, `teamId=team_Pm5sajvBQQzhiv0p5oi8AAmU`.
- **Historial**: `mcp__Vercel__list_deployments` con los mismos ids. El campo `target`
  distingue producción de preview, y `meta.githubCommitRef` dice de qué rama salió.
- **Por qué falló un build**: `mcp__Vercel__get_deployment_build_logs` con `errorsOnly: true`.
- **Errores en runtime**: `mcp__Vercel__get_runtime_errors` / `get_runtime_logs`.

## 5. Cómo verificar que quedó arriba

`curl` desde el sandbox **no sirve**: el proxy devuelve `HTTP 000` aunque el sitio esté bien.
Usar `mcp__Vercel__web_fetch_vercel_url`, que va por la API de Vercel:

```
mcp__Vercel__web_fetch_vercel_url  url=https://www.firmavb.cl/
```

Comprobado el 02-09-2026: responde **HTTP 200**, `server: Vercel`.

## 6. Rollback

Los deployments de producción vienen con `isRollbackCandidate: true`. Desde el dashboard:
*Deployments → el último bueno → Promote to Production*. No requiere revertir el commit.

## 7. Trampas conocidas de este repo

- **No hay CI que valide el build antes del merge.** Los 5 workflows de `.github/workflows/`
  son tareas de datos (`sync-mercadopublico`, `seed-*`, `poblar-riesgo-semanal`,
  `evaristo-maintenance`), ninguno compila ni corre tests en los PR. El único filtro real es
  el build de Vercel — de ahí que el paso 1 (`npm run build` local) importe.
- **`vercel.json` reescribe todo a `/index.html`** (SPA). Cualquier ruta que no exista cae en
  la app de React, no en un 404.
- **`public/` se sirve tal cual.** `public/validador-cm2239.html` y `.js` son el validador que
  se enlaza en los mailings; se publican sin pasar por el build. Cuidado con lo que se deja ahí:
  es contenido público.
- **Los clones locales envejecen rápido.** Este repo recibe muchos commits; al retomar una
  sesión antigua conviene `git fetch origin main` antes de cualquier cosa (se encontró un clon
  18 commits atrás).
- **El repo es público.** `DEPLOY_CHECKLIST.md`, `evaristo/INSTRUCCIONES_AUTONOMO.md` y
  `evaristo/RESUMEN_CONFIGURACION.md` contienen claves de API en texto plano (Gemini y
  DeepSeek). Borrarlas del archivo no basta: quedan en el historial de git, hay que **rotarlas**.
  El JWT que aparece en `public/validador-cm2239.js` es la key `anon` de Supabase, que es
  pública por diseño y no representa una fuga.

## 8. Otros proyectos del mismo team (para no confundirse)

| Proyecto Vercel | Repo GitHub | Notas |
|---|---|---|
| `agile-bidder` | `evarasvb/agile-bidder` | **www.firmavb.cl** |
| `vamosle-chile` | `evarasvb/vamosle-8688c38d` | la app real de VamosLe |
| `vamosle` | `evarasvb/vamosle` | landing + registro |
| `vamosle-webhook` | `evarasvb/vamosle` | producción desplegada por CLI, código **no versionado** |
| `tenute-web` | `evarasvb/tenute-web` | |
| `vamosle-8688c38d` | (sin vínculo) | |

Ojo con dos nombres que engañan: el proyecto `vamosle-chile` compila el repo
`vamosle-8688c38d`, y el proyecto `vamosle-8688c38d` no tiene repo asociado.
