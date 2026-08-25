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

Dos formas, según qué tan "hands-off" lo quieras:

**A) A mano / probando (dry-run primero):**

```bash
python publicador/meta_poster.py --dry-run
```

Muestra qué publicaría hoy según el calendario, sin llamar a la API. Cuando estés conforme:

```bash
python publicador/meta_poster.py
```

Publica el post del día en Facebook e Instagram (si el formato es compatible), y marca la fila como `publicado` en el CSV para no duplicar.

**B) El bot automático (GitHub Actions):**

Ya está el workflow `.github/workflows/publicar-libro-redes.yml` — corre todos los días
y publica el siguiente post pendiente del calendario, sin que tengas que hacer nada ni
tener tu computador prendido. Para activarlo:

1. En GitHub: `Settings → Secrets and variables → Actions → New repository secret`, agrega:
   - `META_PAGE_ID`
   - `META_IG_BUSINESS_ID`
   - `META_PAGE_ACCESS_TOKEN`
   - `BOOK_URL`
   - `IG_HANDLE`
2. Importante sobre el token: si lo sacaste rápido desde el Graph API Explorer, probablemente
   dura solo 1-2 horas. Para que el bot funcione día a día necesitas extenderlo a un token
   de **larga duración** (60 días) desde el [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken),
   botón "Extend Access Token" — y guardar ESE token en el secret, no el original.
3. El disparador programado (`schedule`) solo se activa cuando este workflow vive en la
   rama principal (`main`). Mientras el trabajo esté en una rama aparte, pruébalo manual:
   pestaña **Actions → "Publicar libro en redes" → Run workflow** (con "Modo prueba" activado
   la primera vez).
4. Instagram no acepta posts de solo texto: el calendario ya trae `imagen_url` completo,
   apuntando a `viral-agent/imagenes/` (las 6 plantillas ya renderizadas con tu portada y
   foto reales, servidas como raw.githubusercontent.com porque el repo es público). No
   necesitas subir nada a mano. **Eso sí:** una vez que esta rama se fusione a `main`, regenera
   el CSV para que las URLs apunten a `main` en vez de a esta rama (que eventualmente se borra):
   `python contenido/generador_captions.py` (ya usa `main` por defecto — solo hazlo de nuevo
   sin la variable `IMAGENES_BASE_URL` que se usó para probar en esta rama).

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
