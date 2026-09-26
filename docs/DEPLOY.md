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

## 9. Orden seguro para publicar Academia y Mercado Pago

No desplegar estas piezas parcialmente. En producción ya existen versiones
anteriores de `crear-pago-curso` y `mp-curso-webhook`: primero hay que cerrar la
ventana de ventas y notificaciones, y recién después cambiar la base.

1. En Supabase Edge Secrets, cargar `MERCADOPAGO_WEBHOOK_SECRET` desde la clave
   generada en *Mercado Pago → Tus integraciones → Webhooks*. No inventarla.
2. Confirmar en Vault que existe `service_role_jwt_legacy`; el cron usa esa
   credencial sin materializarla en `cron.job` ni en Git. Preparar también la
   edición nueva de la planilla, sin publicarla todavía.
3. Hacer un preflight de solo lectura: guardar la hora UTC del corte, contar
   pagos, preferencias pendientes, accesos ligados a pagos y cualquier entrega
   legacy. Resolver toda entrega sin vínculo antes de continuar.
4. Activar `ACADEMIA_CHECKOUT_MAINTENANCE=true` y
   `ACADEMIA_WEBHOOK_MAINTENANCE=true`; desplegar primero las versiones de
   `crear-pago-curso` y `mp-curso-webhook` que entienden esos interruptores.
   Comprobar que ambas responden 503 con `Retry-After` y que no crean pagos ni
   entregan accesos. El 503 del webhook obliga a Mercado Pago a reintentar.
5. Esperar a que terminen las invocaciones iniciadas antes del corte y revisar
   en Mercado Pago todos los pagos desde la hora guardada. Registrar sus ids;
   si aparece un pago aprobado no conciliado, no seguir hasta identificarlo.
6. Aplicar las migraciones de Academia. Su preflight debe ejecutarse nuevamente
   con el checkout cerrado. La primera crea el bucket privado
   `academia-premium`; la de seguridad crea el cron de la bandeja cada 5 minutos.
7. La planilla histórica estuvo en Git público y **no se puede vender como
   exclusiva**. Revisar la edición nueva y subir únicamente esa versión al
   bucket privado con la clave `planillas-programa-pro.xlsx`. El XLSX queda
   ignorado por Git y nunca debe volver a `public/`.
8. Desplegar `procesar-academia-mp-inbox`, `academia-premium` y la versión final
   de `mp-curso-webhook`. Desactivar solo
   `ACADEMIA_WEBHOOK_MAINTENANCE`, manteniendo el checkout cerrado. El worker
   acepta únicamente el bearer `service_role`.
9. En Mercado Pago, activar el tópico `topic_chargebacks_wh` sobre
   `https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/mp-curso-webhook` y
   ejecutar el simulador. Confirmar HTTP 200, una sola fila firmada en
   `academia_mp_inbox` y una ejecución correcta del cron.
10. Reconsultar y reprocesar todos los pagos registrados desde el corte,
    incluidos los que recibieron 503. Cada aprobación debe quedar ligada en
    `academia_pago_accesos`; ningún acceso puede existir solo en la tabla legacy.
11. Publicar el frontend y verificar Academia, Mis cursos y la descarga firmada
    mientras el checkout continúa en mantenimiento. Solo entonces desactivar
    `ACADEMIA_CHECKOUT_MAINTENANCE` y crear una preferencia controlada por el
    precio persistido, sin efectuar una compra real. Si falla cualquier
    comprobación, reactivar el interruptor de checkout antes de investigar.

No basta con que las migraciones terminen: el corte se considera cerrado solo
cuando la conciliación desde la hora UTC guardada arroja cero pagos sin vínculo.

Si falta `MERCADOPAGO_WEBHOOK_SECRET`, las notificaciones firmadas fallan cerrado
con 503. Todo contracargo sin firma válida se rechaza con 401 y nunca entra a la
bandeja ni consulta la API de MP. Solo los avisos antiguos de pago pueden llegar
sin firma: se limitan por red y pago, y antes de entregar verifican Payment y
Merchant Order directamente en MP.
