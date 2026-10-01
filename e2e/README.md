# E2E por personas (Playwright)

Recorre la app como cada persona: **visita/usuario nuevo, gerente, supervisor,
jefe de productos y vendedor**.

> ⚠️ Necesita red hacia la preview de Vercel y Supabase. NO corre dentro del
> sandbox de Claude (su política de red bloquea esos hosts). Correr en CI o local.

## Requisitos

- Node + dependencias del repo (`npm ci`).
- Un Chromium. En local: `npx playwright install chromium`. En imágenes con
  Chromium ya instalado, exportar `PW_CHROMIUM=/ruta/al/chromium`.
- Una **cuenta de prueba** con rol **admin** (para cubrir todas las pantallas).

## Variables de entorno

| Variable        | Descripción                                        | Default |
|-----------------|----------------------------------------------------|---------|
| `E2E_BASE_URL`  | URL a testear                                      | preview del branch |
| `E2E_EMAIL`     | correo de la cuenta de prueba (admin)              | — (requerido) |
| `E2E_PASSWORD`  | contraseña de la cuenta de prueba                  | — (requerido) |
| `PW_CHROMIUM`   | ruta a un Chromium ya instalado                    | (descarga PW) |

## Correr

```bash
export E2E_BASE_URL="https://<tu-preview>.vercel.app"
export E2E_EMAIL="qa@firmavb.cl"
export E2E_PASSWORD="********"

npm run e2e            # todas las personas
npm run e2e -- --project=visita       # solo la visita (no necesita login)
npm run e2e -- --project=vendedor     # una persona
npx playwright show-report            # reporte HTML
```

## Estructura

- `auth.setup.ts` — inicia sesión una vez y guarda la sesión en `.auth/user.json`.
- `visita.spec.ts` — sin sesión: landing, búsqueda del teaser, signup, soporte.
- `gerente.spec.ts` — dashboard, KPIs, Cierres Próximos, Reportes.
- `supervisor.spec.ts` — equipo unificado, invitar miembro, roles.
- `jefe-producto.spec.ts` — inventario, incompletos, acciones de catálogo.
- `vendedor.spec.ts` — bandeja + chips, compra ágil → Generar propuesta, pipeline.

## Notas

### Seguimiento de instituciones sin servicios externos

`npx playwright test --config playwright.institution.config.ts` ejecuta la
campanita y la ficha `Instituciones` reales con hooks de datos simulados. No
requiere cuenta ni credenciales; bloquea solicitudes externas. Usa un Chromium
instalado por Playwright o `PW_CHROMIUM` para indicar uno local.

Comprueba el aviso exacto (incluidas noticias antiguas), cambios de institución
sin recargar, enlaces adulterados, estados vacíos/errores, restricciones de plan
y navegación móvil. Estas pruebas de interfaz no sustituyen una validación de
RLS contra Supabase; las pruebas SQL aisladas están en
`supabase/tests/institution-following.mjs`.

### Pruebas con servicios conectados

- Las personas autenticadas usan **una** cuenta admin (ve todas las pantallas).
  Para probar segregación por rol real, crear cuentas por rol y un
  `storageState` por persona.
- Algunas aserciones dependen de que haya **stock activo** (p. ej. abrir una
  compra ágil). Esos casos se auto-`skip` si no hay datos, para no dar falsos
  negativos.
