# Investigación: lici.cl y cómo hace el match

Fecha: 25 de septiembre de 2026. Fuentes: sitio público lici.cl renderizado con Chromium, los 308 módulos JavaScript del sitio (SvelteKit), la API `api.golici.com`, Platanus, LinkedIn y búsqueda web. Capturas en `docs/investigacion-lici/`.

Resumen en una línea: Lici no compara palabras. Vectoriza (embeddings) una **descripción en texto de lo que vende cada empresa** (sus "segmentos de negocio") y su **catálogo de productos**, extrae con IA los ítems de cada licitación desde los anexos, los clasifica en UNSPSC por vecinos más cercanos, y recomienda una licitación cuando la similitud semántica supera un umbral y luego pasa una cadena de verificaciones con un modelo de lenguaje. Además tiene una regla directa: "recomienda si N ítems o X % de los ítems calzan con tu catálogo".

---

## (a) Qué es Lici y a quién apunta

- **Empresa:** Lici SpA, RUT 76.711.182-7, Santiago de Chile (política de privacidad). Marca: "La forma inteligente de licitar. Tu área de licitaciones con IA para venderle al Estado". Correo contacto@lici.cl.
- **Fundadores:** Tomás Castillo (CEO, "building the AI infrastructure for public procurement in Latin America, from discovery to award") y Jorge Quinteros (CTO). Incorporados a la aceleradora **Platanus** en el primer semestre de 2024 (https://platan.us/startups/lici). No se encontró Start-Up Chile, Crunchbase ni Product Hunt.
- **Producto:** una "área de licitaciones con IA" para proveedores de Mercado Público. Cubre licitaciones, compras ágiles, tratos directos, consultas al mercado y Convenio Marco (marketplace).
- **A quién apunta:** empresas que venden **productos con catálogo** (los rubros de la landing: insumos médicos, construcción, ferretería, artículos de oficina, aseo, agricultura, transporte, EPP y vestuario, consultoría y software). Clientes citados: Dcomac ("Antes hacíamos 50 cotizaciones al mes. Hoy superamos las 700"), Petiwi, Chivensu.
- **Modelo comercial:** venta consultiva. No hay registro público: el login dice "¿No tienes una cuenta? Contáctanos". El alta es por **enlace de onboarding con token** que crea el equipo de ventas (`/onboarding/{slug}?token=`), con una **demo de N días** y un KAM ("un KAM de Lici te capacita al inicio y acompaña tus primeras postulaciones").
- **Stack observado:** SvelteKit SPA + API Go (framework Huma) en `https://api.golici.com`, autenticación Google Identity Platform (proyecto `lici-405717`, login con email, Google o Microsoft), base vectorial **Qdrant** (los productos tienen `embeddingId` y `qdrantId`), asistente IA llamado **"Lisa"**, alertas por WhatsApp (plantillas de WhatsApp Business) y correo.

## (b) Funciones

Lista completa según rutas y textos del código:

| Área | Qué hace |
|---|---|
| Oportunidades recomendadas (`/tenders/recommended`) | Lista de licitaciones y compras ágiles "seleccionadas para tu empresa", con % de match, chips de segmento, seguir, descartar con motivo, asignar a un miembro, vistas guardadas, exportar a Excel. |
| Búsqueda (`/tenders/search`) | Búsqueda por palabras clave y filtros (región, comuna, comprador, presupuesto, categoría, primer/segundo llamado, líneas de negocio), orden por relevancia o score. |
| Segmentos de negocio (`/account/company/business-lines`) | Perfil de la empresa en texto: uno o más "focos de negocio" cuya descripción se usa para recomendar. Botón "Mejorar con IA". |
| Preferencias de oportunidades | Regiones permitidas, presupuesto mínimo, recomendar compras ágiles en primer llamado, empresa grande, **cobertura de catálogo** (regla directa). |
| Instituciones bloqueadas | Organismos (con filiales) cuyas licitaciones "no serán recomendadas ni ofertadas automáticamente", con fecha o permanente. |
| Catálogo de productos (`/company/products`) | Importar Excel, sincronizar stock/precio/costo desde ERP, variantes por región, imágenes, fichas técnicas, sugerencia de nombres descriptivos "para que Lisa pueda usar mejor tus productos". |
| Ofertas (`/bids`) | La oferta se arma "línea por línea con los productos extraídos" de los anexos; cotización PDF con logo e imágenes; anexos y declaraciones; envío a Mercado Público con credenciales del cliente. |
| Ofertas automáticas (`/auto_bids`) | "Lisa encontrará licitaciones compatibles y preparará ofertas automáticas por ti": se genera cuando la licitación tiene ≥ N productos y ≥ X % de ellos calzan con el catálogo. |
| Resumen IA de bases | "Información extraída automáticamente de las bases de licitación utilizando IA"; fórmula de puntaje final y puntaje mínimo de admisibilidad. |
| Licitaciones similares / inteligencia histórica | "Lici encuentra licitaciones similares del mismo comprador y te muestra quién ganó, a qué precio y qué priorizó". Con % de similitud ("Casi idéntica"). Parte del paywall "Centro de Datos". |
| Explorar mercado (`/explore`, `/organizations`, `/providers`, `/products`) | Directorio de organismos, proveedores y **productos transados con su categoría UNSPSC y productos similares**; rankings, HHI, competencia por organismo. |
| Órdenes de compra, notificaciones, chatbot Lisa, marketplace Convenio Marco, integraciones/API keys, roles y equipo | Gestión completa post-adjudicación y de catálogos CM. |

## (c) Cómo hace el match

### 1. Qué le pide al proveedor

Del onboarding (pasos: Inicio, Tu cuenta, Tu empresa, **Descripción**, Regiones, Mercado Público, Notificaciones, Equipo, Facturación, Preparando, Listo):

- **Descripción de la empresa** (paso "Perfil de tu empresa"): dos campos, "¿Qué ofrece tu empresa?" y "**Exclusiones**". El subtítulo es literal: *"Esto es lo que hace la magia — con esta info encontramos las licitaciones perfectas para ti"*. Lici **redacta un borrador automático**: *"Estamos preparando una descripción inicial basada en tu historial..."* (es decir, a partir del historial de ventas del RUT en Mercado Público). Luego: *"La descripción es clave para encontrar licitaciones relevantes. Puedes editarla y luego mejorarla con IA."* (endpoint `POST /v1/lici/companies/{id}/profile/segments/refine`).
- **Segmentos de negocio**: nombre ("Ej: Equipamiento médico"), descripción ("Describe qué productos o servicios cubre este segmento"), activo/inactivo, color. Texto de la pantalla: *"Lici usa estos segmentos para encontrar oportunidades relevantes para tu empresa. Edita el segmento general o agrega más para apuntar a distintos rubros."* y *"Aún no tienes segmentos. Crea el primero para empezar a recibir recomendaciones."*
- **Regiones de interés** y **presupuesto mínimo** ("Solo mostrar oportunidades con presupuestos iguales o mayores a este monto").
- **Catálogo de productos** con nombre descriptivo, descripción, proveedor, SKU, precio, costo, stock, ficha técnica, imagen. Consejo literal: *"utiliza nombres descriptivos (tipo, medidas, capacidad, marca, etc.). Ej: 'Resma Papel Oficio Blanco 500 hojas Torre', o 'Servicio Mantención Aire Acondicionado Split 12000 BTU'"*.
- **Instituciones bloqueadas** y preferencia de primer/segundo llamado.

No pide rubros ONU ni palabras clave. Todo es texto libre + catálogo.

### 2. Señales que usa (inferido del código)

**Lado licitación**

- Lee los anexos con IA y **extrae los ítems**: *"Lici lee los anexos y extrae los productos específicos solicitados, con sus cantidades, unidades y especificaciones técnicas"*; *"Los items 'Globales' ahora se desglosan automáticamente en productos específicos"*. Cada ítem tiene `name, quantity, unit, category, groupName, specifications`.
- **Clasifica cada ítem en UNSPSC con embeddings + kNN**. El backoffice expone la tubería completa: `unspsc/upload` (CSV del catálogo UNSPSC), `unspsc/embed`, `unspsc/backfill-items`, `unspsc/match`, `unspsc/knn-inspect` y `unspsc/knn-propagate`. La respuesta de inspección tiene `neighbors[{itemId, name, cosine, unspscCode, unspscScore, isAnchor}]`, `votes[{code, name, weight}]`, `verdict{assign, commodityId, score, reason, anchorsConsidered, agreementPct}`, `directTopCode/directTopScore`. Es decir: cada ítem se vectoriza; se buscan vecinos ya clasificados ("anclas"), se vota por código ponderando la similitud coseno, y se asigna si el acuerdo (`agreementPct`) supera un umbral; si no, se abstiene.
- Cada licitación tiene título, descripción, categoría, región, comprador, presupuesto, primer/segundo llamado, `hasAiSummary`.

**Lado proveedor**

- La **descripción de cada segmento se vectoriza**. Al guardar un segmento la API responde `{businessLineId, embedded: true, embedMs, deletedRecommendations, regenStarted: true}`: se embebe la descripción, se borran las recomendaciones antiguas y se relanza la generación.
- Cada **producto del catálogo se vectoriza** en Qdrant (`embeddingId`, `qdrantId`). "Sin productos similares con embedding disponible" aparece cuando falta el vector.

**Cruce**

- **Recall semántico** licitación ↔ segmento. Los filtros de búsqueda aceptan `businessLines`, y cada recomendación devuelve `businessLines: [{id, name, color, score}]` (un puntaje por segmento) más un `score` global. Tooltip: *"Afinidad de esta oportunidad con tus líneas de negocio."* Si no calza con ninguno: "Sin segmento".
- **Fuentes de coincidencia** (`matchSources`), con tooltips literales: *"Coincidencia en los productos/items solicitados"*, *"Coincidencia en título o descripción de la licitación"* y *"Coincidencia exacta por código de licitación"* (`exactMatch`).
- **Cobertura de catálogo**: `catalogCoverage {matchedItemCount, totalItemCount, recommended}` → *"${matched} de ${total} ítems coincidieron con productos de tu catálogo al evaluarla"*. La regla configurable por el cliente: *"Define cuándo una oportunidad se recomienda directamente porque sus ítems tienen productos equivalentes en tu catálogo"*, por tipo (Compras Ágiles / Licitaciones) y modo (*"Porcentaje de ítems cubiertos"* o *"Cantidad mínima de ítems"*). Y la salvedad: *"Esta regla solo permite recomendaciones directas por catálogo. Si no se cumple, Lici conserva la evaluación habitual de tus líneas de negocio."* Es decir, hay **dos caminos para recomendar**: catálogo (duro, por ítems) y segmentos (semántico).
- **Match ítem ↔ producto**: `POST /companies/{id}/products/suggestions {itemIds}` devuelve `suggestions: {itemId: [productos]}` y `trigramFallbackCount`. Primero vectores; si no hay embedding, **cae a trigramas** (lo mismo que hoy usa Agile Bidder, pero como respaldo).
- **Verificación con modelo de lenguaje**. El backoffice tiene un "reco-debug" cuya salida es `{tenderId, companyId, config: {modelId, useBatch, similarityThreshold}, steps: [{name, passed, details, durationMs}], finalVerdict: bool, finalScore, totalDurationMs}`. Interpretación: tras el recall por similitud (umbral `similarityThreshold`), corre una **cadena de pasos que pasan o fallan** (filtros duros, cobertura, y al menos un paso con un modelo `modelId`, en lote `useBatch`) y termina en un veredicto sí/no con puntaje. El backoffice también puede crear una recomendación manual y recibe `{created, alreadyExisted, blocked, score}`, o sea el score se calcula igual aunque la fuerce un humano. Hay prompts editables y versionados (`/backoffice/prompts`).
- **Filtros duros**: regiones permitidas, presupuesto mínimo, instituciones bloqueadas (`blocked`), primer llamado de compra ágil, rubro "empresa grande".
- **Retroalimentación**: al descartar se exige motivo: "No coincide con lo que ofrezco", "No tengo este producto o servicio disponible", "El monto no es atractivo", "El comprador no me interesa", "La ubicación no me conviene", "Otro". La privacidad declara usar datos para "Personalizar experiencia y recomendaciones" y "Mejorar funcionalidades de IA y algoritmos".
- **Oferta automática**: *"Una oferta automática se generará cuando una licitación tenga al menos ${minProducts} productos y al menos ${matchPercentage}% de esos productos coincidan con tu catálogo"*; mínimo 50 %.

### 3. Cómo presenta el resultado

- Tarjeta con **"97% match"** (landing), título, código, tipo (Compra Ágil), comprador, y chips de segmento con color y su propio score. En listas: `Math.round(score*100)%` junto al nombre UNSPSC y el código.
- Tooltips de fuente de coincidencia (ítems / título / código exacto), "Cobertura de catálogo", "Categorías UNSPSC de las coincidencias", "Productos Emparejados" en la auto-oferta.
- Orden por `relevance`, `score`, cierre, publicación, presupuesto. Espacios: todas / recomendadas / seguidas / descartadas / asignadas a mí.
- Estado de espera literal: *"Nuestro sistema está revisando las oportunidades disponibles y seleccionando las más relevantes para ti. Esto puede tomar unos minutos."* y *"Nuevas recomendaciones aparecerán automáticamente."*
- Notificación: "Notificaciones cuando aparezcan nuevas oportunidades recomendadas a tu empresa" (WhatsApp y correo).

### 4. Ejemplo literal de la landing

Sección "Detecta · Búsqueda semántica": *"Las búsquedas por palabra clave traen ruido: impresoras 3D cuando vendes artículos de oficina. Lici entiende qué hace tu empresa y busca por contexto, encontrando oportunidades incluso fuera de tu vertical principal."*

Demo animada: entrada `vendo: insumos dentales` → "Impresoras 3D para prototipado industrial: RUIDO", "Cemento estructural obra gruesa: RUIDO", "Resina dental fotocurable A2: ✓", "Instrumental odontológico básico: ✓". Cierre: *"2 resultados relevantes de 74 encontrados. El ruido se descarta solo."*

## (d) Precios y planes

No hay precios públicos en el sitio ni en fuentes externas. Lo que el código revela:

- Planes por empresa administrados desde backoffice (`plans/templates`, `plans/features`, `overrides`). En la cuenta: "Plan vigente" y **"+ comisiones por OC"** (cobran comisión por orden de compra además del fijo).
- La demo tiene `demoLengthDays` y `priceUF`: el precio se cotiza en **UF**. La propuesta comercial tiene `pricingTier`, `customPrice` y descuentos `prontoPago6m` / `prontoPago12m` (pago anticipado de 6 o 12 meses).
- Cobro mensual automático con tarjeta o transferencia. "No te preocupes, no te cobraremos durante tu período de prueba."
- Paywalls dentro del producto: "Centro de Datos" (licitaciones similares, competencia, rankings), "Mejora tu plan para ofertar", "Desbloquea tus Estadísticas".
- Referencia de mercado hallada por búsqueda (no verificada en sus sitios): Licitados desde $14.990/mes, LicitaIA entre $29.990 y $79.990/mes.

## (e) Evidencia

**Páginas y capturas** (todas en `docs/investigacion-lici/`):

- https://lici.cl/ → `landing.png` (página completa). Título: "Lici | Tu área de licitaciones con IA".
- https://lici.cl/contacto → `contacto.png` (formulario de demo: "¿Qué vendes?", "¿Tu ingreso depende de las ventas por Mercado Público?").
- https://lici.cl/login → `login.png` (email/Google/Microsoft; testimonios de Petiwi, Chivensu, Dcomac; "+35% facturación, −70% trabajo manual, hasta 20× más participaciones").
- https://lici.cl/blog → `blog.png` (vacío: "No hay publicaciones"; la API pública `GET /v1/blog/posts` devuelve `posts: []`).
- https://lici.cl/privacy → `privacy.png` (Lici SpA, RUT, Ley 19.628).
- https://lici.cl/onboarding/demo → `onboarding_demo.png` ("Enlace de onboarding no encontrado": requiere slug y token).
- `/about`, `/en/about`, `/pricing`, `/faq`, `/terms` no existen: la SPA devuelve la misma página raíz para cualquier ruta. `robots.txt` y `sitemap.xml` también devuelven la SPA.
- Rutas privadas (`/explore`, `/products`, `/providers`, `/organizations`, `/tenders/recommended`, `/home`, `/go/{slug}`) redirigen a `/login?returnTo=…`.

**API** (`https://api.golici.com`): `/v1/lici/me`, `/v1/lici/tenders/recommended`, `/v1/lici/search/tenders/cards` responden `401 authentication required`; `/v1/onboarding/demo` → `404 Demo not found`; no hay OpenAPI público. Endpoints relevantes vistos en el cliente JS:

```
GET  /v1/lici/tenders?workspace=recommended&businessLines=…&sort=score
GET  /v1/lici/tenders/recommended/export
GET  /v1/lici/companies/{id}/business-lines
GET/POST/PATCH /v1/lici/companies/{id}/profile/segments[/{id}]
POST /v1/lici/companies/{id}/profile/segments/refine        (Mejorar con IA)
GET/PATCH /v1/lici/companies/{id}/tender-preferences        (regiones, presupuesto, catalogCoverage)
GET/POST /v1/lici/companies/{id}/forbidden-organizations
POST /v1/lici/companies/{id}/products/suggestions {itemIds} (→ suggestions + trigramFallbackCount)
GET  /v1/lici/tenders/{id}/detailed-products                 (ítems extraídos de anexos; algunos "blurred" según plan)
GET  /v1/lici/tenders/{id}/items/{itemId}/compatible-listings (productos de Convenio Marco compatibles con el ítem)
GET  /v1/lici/tenders/{id}/similar-tenders                   (licitaciones similares, con % de similitud)
GET  /v1/lici/market-products/search/item-insight?id=…      (producto transado + UNSPSC + similares)
POST /v1/backoffice/unspsc/{upload,embed,backfill-items,match,knn-inspect,knn-propagate}
POST /v1/backoffice/reco-debug/run  → {config:{modelId,useBatch,similarityThreshold}, steps[], finalVerdict, finalScore}
GET  /v1/backoffice/prompts (prompts versionados)
```

**Fragmentos de código** (bundle `BVFx6aqF.js`, esquemas Zod):

```
Bu = { id, name, color, score }                       // segmento con puntaje
Vu.companySpecificData = { recommended, score, catalogCoverage:{matchedItemCount,totalItemCount,recommended}, businessLines:[Bu], discardReasonType, … }
Vu.matchSources: string[]; Vu.exactMatch: boolean
Xp.catalogCoverage.categories = [{ tenderCategory:'agile-purchase'|'regular-tender', coverageMode:'percentage'|'minimum_items', coverageValue }]
Nl = { businessLineId, deletedRecommendations, embedded, embedMs, regenStarted }
Xd = { suggestions: Record<itemId, Product[]>, trigramFallbackCount }
Jd (producto) = { …, embeddingId, qdrantId, specSheet, stock, stockSource }
oc (vecino UNSPSC) = { itemId, name, cosine, unspscCode, unspscScore, isAnchor }
ac (veredicto) = { assign, commodityId, score, reason, anchorsConsidered, agreementPct }
Ql (reco-debug) = { config:{modelId,useBatch,similarityThreshold}, steps:[{name,passed,details,durationMs}], finalVerdict, finalScore }
```

**Fuentes externas:** Platanus (fundadores, fecha), LinkedIn del CEO (post anunciando "Resumen de Bases: ahora ofrecemos un resumen completo del 100% de las bases"). Bloqueos: Instagram @lici.chile (HTTP 429; solo el snippet de búsqueda: 107 seguidores, 7 posts, bio "Venderle al estado nunca había sido tan fácil"), LinkedIn perfiles completos (HTTP 999), YouTube (captcha), web.archive.org (bloqueado por la política de red del entorno).

**Registro:** no fue posible crear cuenta. No existe formulario de registro; el onboarding exige un enlace con token emitido por Lici, y el formulario de contacto pide datos reales de empresa y teléfono, así que no se envió.

## (f) Comparación con Agile Bidder

Estado actual de Agile Bidder (migración `20260916050000_match_solo_descripcion_y_bono_codigo_condicional.sql` y `src/pages/CompraAgilDetalle.tsx`):

- `nombre_norm` del ítem = descripción del ítem (o el nombre) sin acentos; del inventario = nombre del producto.
- Similitud = `strict_word_similarity` (trigramas de pg_trgm, respetando límites de palabra) entre esos dos textos.
- Bono por código ONU solo si el texto ya se parece: `sim = 0.5 + 0.5 × texto` cuando `codigo_producto` coincide y `texto ≥ 0.30`.
- Se elige el mejor producto por ítem (umbral 0.30) y, por compra o licitación, el máximo (umbral 0.45 para "listo"/"match_encontrado").
- La pantalla muestra "Tu match, producto por producto" con badge de %, marca "dudoso" si < 60 % o < 80 % y supera el presupuesto, y permite confirmar/cambiar/descartar (overrides manuales).
- Ya existe `cliente_inventario.embedding vector(768)` (Gemini `gemini-embedding-001`) y la función `buscar_inventario_semantico`, pero **solo para el buscador global**, no para el match.

| Dimensión | Lici | Agile Bidder hoy |
|---|---|---|
| Entrada del proveedor | Descripción en texto + exclusiones (borrador IA desde su historial), segmentos, catálogo, regiones, presupuesto mínimo, bloqueos | Solo inventario (nombre + código ONU) |
| Representación | Embeddings en Qdrant (segmentos y productos); trigramas como respaldo | Trigramas sobre nombre; embeddings existen pero no se usan en el match |
| Ítems de la licitación | Extraídos de anexos con IA, desglose de ítems "globales", clasificación UNSPSC por kNN | Ítems tal como vienen de la API de Mercado Público |
| Dos caminos | Catálogo (cobertura N ítems / %) y semántico (segmento ↔ licitación) | Uno: parecido texto ítem ↔ producto |
| Verificación | Cadena de pasos + veredicto de modelo de lenguaje, umbral de similitud configurable | Umbrales fijos 0.30 / 0.45 |
| Filtros duros | Regiones, presupuesto mínimo, organismos bloqueados, primer llamado | Ninguno en el match |
| Presentación | % global, score por segmento, fuente de coincidencia, cobertura "X de Y ítems", UNSPSC | % por ítem, "dudoso", "N de M con match" |
| Retroalimentación | Motivo obligatorio al descartar; asignación; seguimiento | Override confirmar/cambiar/descartar por ítem |
| Cobertura de servicios | Sí (la descripción del segmento calza con licitaciones sin ítems de producto) | Débil (solo por título si no hay ítems) |

Lo que hace "buenos" los matches de Lici no es un algoritmo secreto: es que (1) compara significados y no letras, (2) usa una descripción rica de la empresa además del catálogo, (3) aplica una regla clara de cobertura de ítems, (4) filtra lo que el cliente nunca querría, y (5) verifica los casos límite con un modelo antes de mostrarlos.

## (g) Recomendaciones priorizadas para Agile Bidder

1. **Usar los embeddings que ya tenemos en el match ítem ↔ producto.** Vectorizar `nombre_norm` de los ítems de compras ágiles y licitaciones abiertas con el mismo `gemini-embedding-001` (768) y calcular `match_sim` como combinación: coseno del embedding con respaldo de trigramas cuando falte el vector, más el bono ONU condicional actual. Resuelve el caso "cordel de papel vs papelería" de raíz y es lo que Lici hace con `trigramFallbackCount`. Es el cambio de mayor impacto y menor costo porque el inventario ya está embebido.
2. **Perfil de empresa en texto ("qué vendo" y "qué no vendo").** Un campo por cliente, con borrador generado por IA a partir de sus órdenes de compra históricas en Mercado Público y su inventario, editable y con botón "Mejorar con IA". Embeberlo y usarlo como segundo camino de recomendación: licitaciones cuyo título/descripción/ítems se parezcan al perfil aunque ningún producto del inventario calce. Esto abre servicios y "rubros que no estabas mirando". Permitir varios segmentos con color, como Lici, en una segunda etapa.
3. **Cobertura de catálogo como regla explícita y visible.** Guardar por licitación `items_con_match / items_totales` y mostrar "X de Y ítems calzan con tu inventario". Dejar que el cliente configure "recomendar si ≥ 60 % de los ítems" o "≥ 3 ítems", distinto para compra ágil y licitación. Hoy `match_score` es el máximo de un solo ítem: una compra de 37 ítems donde calza 1 se ve igual que una donde calzan 30.
4. **Filtros duros y motivo de descarte.** Regiones permitidas, presupuesto mínimo y organismos bloqueados por cliente, aplicados antes de mostrar. Al descartar, pedir motivo (las seis opciones de Lici sirven tal cual) y usar "no coincide con lo que ofrezco" para bajar el peso de ese producto o categoría en futuros matches.
5. **Verificación barata solo en los casos dudosos.** Para matches entre 45 % y 75 %, una llamada a Gemini flash-lite con el ítem, sus especificaciones y el producto candidato que responda sí/no y una razón corta; guardar el veredicto y mostrarlo en el tooltip del "dudoso". Y clasificar en UNSPSC por vecinos más cercanos los ítems que llegan sin código ONU, usando los ítems ya clasificados como anclas, para que el bono por código también aplique a compras ágiles mal categorizadas.
