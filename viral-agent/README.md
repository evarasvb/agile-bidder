# Agente de Marketing Viral — "Véndele al Estado y no mueras en el intento"

Multiplicador de contenido y publicación para lanzar y sostener el marketing del libro en Instagram y Facebook.

Libro: https://www.amazon.com/-/es/dp/B0G4NLY5TL
Instagram existente: [@surfeandolicitaciones](https://www.instagram.com/surfeandolicitaciones/)

## Qué hace este agente (y qué NO hace)

**Sí hace:**
- Genera decenas de variantes de captions/posts a partir de unos pocos pilares de contenido (el "multiplicador").
- Arma un calendario de lanzamiento de 30 días listo para copiar/pegar o publicar automáticamente.
- Mantiene bancos de hashtags segmentados por nicho (compras públicas, PYMES, libros de negocio).
- Genera las 6 imágenes de post (con tu portada y foto reales) y las deja con URL pública lista para el bot — no hay que exportar ni subir nada a mano.
- Publica automáticamente en tu Página de Facebook y tu cuenta de Instagram (Business) usando la API oficial de Meta, una vez que las tengas configuradas.
- Te da una lista de tipos de comunidades reales donde tu audiencia (PYMES/emprendedores/proveedores del Estado en Chile) ya está activa, con la etiqueta correcta para no quemar la cuenta.

**No hace (a propósito):**
- No crea tu Página de Facebook por ti (Meta exige que lo haga un humano dueño de la cuenta).
- No se une automáticamente a grupos ni publica en ellos sin supervisión. Meta no ofrece una API pública para eso, y automatizarlo con bots de navegador viola los Términos de Servicio y puede terminar en suspensión de tu cuenta personal. Esa parte la haces tú (o alguien de tu equipo), siguiendo la guía en `comunidades/`.

## Paso a paso

### 1. Crear tu Facebook Page (aún no la tienes)

1. Entra a https://www.facebook.com/pages/create con tu cuenta personal de Facebook.
2. Categoría: "Autor" o "Empresa/Marca" → usa el **mismo nombre que ya tienes en Instagram**, "Surfeando Licitaciones", para que la marca sea reconocible cruzando plataformas y puedas vincularlas en el paso 2.
3. Foto de perfil: la misma que usas en @surfeandolicitaciones (consistencia visual). Foto de portada: mockup del libro + frase gancho.
4. En "Acerca de": pega la sinopsis del libro y el link de Amazon.

### 2. Vincular tu Instagram existente

1. Pasa tu cuenta de Instagram a **Cuenta profesional → Empresa** (Ajustes → Cuenta → Cambiar a cuenta profesional).
2. En Ajustes de Instagram → Cuenta vinculada, conéctala a la Página de Facebook creada en el paso 1.
3. Verifica en Meta Business Suite (business.facebook.com) que la Página y la cuenta de Instagram aparecen juntas.

### 3. Crear credenciales de API (Meta for Developers)

Necesarias solo para la publicación automática (`publicador/`). Si prefieres publicar todo a mano, puedes saltar esto y usar solo el generador de contenido.

1. https://developers.facebook.com/apps → Crear app → tipo "Business".
2. Agrega los productos "Facebook Login" e "Instagram Graph API".
3. Genera un **token de página de larga duración** (Page Access Token) con permisos `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
4. Copia `viral-agent/.env.example` a `viral-agent/.env` y completa:
   - `META_PAGE_ID`
   - `META_IG_BUSINESS_ID`
   - `META_PAGE_ACCESS_TOKEN`

### 4. Generar contenido

```bash
cd viral-agent
pip install -r requirements.txt
python contenido/generador_captions.py
```

Esto crea `contenido/calendario_lanzamiento.csv` con 30 días de posts (red, formato, pilar, caption, hashtags, CTA, imagen_url), combinando los 6 pilares de contenido con los bancos de hashtags y las imágenes ya renderizadas en `imagenes/`. Revísalo y edita a mano lo que quieras antes de publicar — el agente multiplica variantes, pero tú eres quien conoce mejor tu voz.

### 5. Publicar

**El bot que está corriendo de verdad vive en Supabase**, no en GitHub Actions
(ver sección "Estado actual" más abajo). Formas de interactuar con él:

**A) A mano / probando en tu computador (dry-run primero):**

```bash
python publicador/meta_poster.py --dry-run
```

Esto usa `viral-agent/.env` + el CSV local, no la base de Supabase — sirve para
probar cambios de copy antes de subirlos a la tabla `viral_agent_calendario`.

**B) El bot automático real (Supabase Edge Function + pg_cron):**

La Edge Function `publicar-libro-redes` (en `supabase/functions/publicar-libro-redes/`)
corre todos los días a las 15:00 UTC vía `pg_cron`, lee la config y el calendario desde
las tablas `viral_agent_config` / `viral_agent_calendario` (RLS bloqueado — solo la
función, con el service role, puede leerlas) y publica el siguiente post pendiente.

Para probarla o dispararla a mano (fuera del horario del cron), desde el SQL Editor de
Supabase o con `execute_sql`:

```sql
select net.http_post(
  url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/publicar-libro-redes',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-viral-agent-secret', (select value from public.viral_agent_config where key = 'cron_shared_secret')
  ),
  body := jsonb_build_object('dry_run', true)  -- saca dry_run para publicar de verdad
);
-- el resultado (async) aparece poco después en:
select * from net._http_response order by id desc limit 1;
```

Para pausar el bot: `select cron.unschedule('publicar-libro-redes-diario');` — para
reactivarlo, vuelve a correr la migración `cron_publicar_libro_redes`.

**C) GitHub Actions (`.github/workflows/publicar-libro-redes.yml`)** quedó como
respaldo manual únicamente (sin `schedule`) — usa el CSV del repo, con estado
independiente del de Supabase. No actives su cron mientras el de Supabase esté
activo: publicarían el mismo día dos veces por caminos separados.

### Estado actual

- ✅ Credenciales cargadas en `viral_agent_config` (Page ID, IG Business ID, Page
  Access Token, book URL, handle).
- ✅ 30 días de calendario cargados en `viral_agent_calendario`.
- ✅ Edge Function desplegada y probada (dry-run real vía `pg_net`, HTTP 200).
- ✅ `pg_cron` programado — corre solo, todos los días.
- ⚠️ El `META_PAGE_ACCESS_TOKEN` cargado puede ser de corta duración (1-2h) si
  salió directo del Graph API Explorer sin extenderlo. Si el cron empieza a fallar
  con error de token expirado, genera uno de **larga duración** (60 días) desde el
  [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken)
  y actualízalo: `update public.viral_agent_config set value = 'NUEVO_TOKEN' where key = 'meta_page_access_token';`

### 6. Comunidades

Lee `comunidades/COMUNIDADES_OBJETIVO.md`. Es una guía para que tú (cuenta personal) te unas y participes — no un bot.

## Estructura

```
viral-agent/
├── README.md
├── .env.example
├── requirements.txt
├── contenido/
│   ├── pilares.py              # pilares de contenido + plantillas de caption
│   ├── banco_hashtags.py       # hashtags por segmento
│   ├── generador_captions.py   # arma el calendario de 30 días
│   └── calendario_lanzamiento.csv  # (generado, con imagen_url ya completo)
├── plantillas-diseno/
│   ├── *.dc.html                # las 6 plantillas visuales (editables en Claude Design)
│   ├── render.mjs + package.json  # las renderiza a PNG (npm run render)
│   └── canvas.json
├── imagenes/
│   └── pilar-*.png              # PNGs ya renderizados, con portada y foto reales
├── comunidades/
│   └── COMUNIDADES_OBJETIVO.md
└── publicador/
    └── meta_poster.py          # publica en FB/IG vía Graph API oficial
```
