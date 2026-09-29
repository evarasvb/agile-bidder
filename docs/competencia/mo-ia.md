# Competencia: Radar de Licitaciones (LCTR) de Mo-IA

Fecha de la investigación: 29 de septiembre de 2026. Todo lo descrito se observó sin iniciar sesión. Donde un dato no aparece en las fuentes, se indica "no aparece".

## Qué es

"Radar de Licitaciones" (también se llama a sí mismo "LCTR") en https://licitar.mo-ia.cl/ es una plataforma web chilena que monitorea licitaciones y Compras Ágiles de Mercado Público usando la API oficial de ChileCompra, filtra las que "calzan con lo que vendes" mediante un puntaje de afinidad, y ofrece análisis de bases con inteligencia artificial más un tablero de seguimiento de postulaciones para equipos.

Lema del sitio: "Las licitaciones del Estado que calzan con tu empresa, cada día y sin buscar."

El propio sitio aclara: "LCTR es un servicio independiente de Mo-IA, no afiliado ni patrocinado por la Dirección ChileCompra."

Fecha de lanzamiento aproximada: no aparece en ninguna fuente pública. Indicios: la política de privacidad dice "Versión septiembre 2026"; el sitio no tiene capturas en Wayback Machine (archive.org) y no aparece en resultados de Google/Bing para "licitar.mo-ia.cl", "LCTR" ni "Radar de Licitaciones Mo-IA". Todo indica un producto muy reciente (semanas), sin difusión indexada aún. El sitio corporativo mo-ia.cl tampoco lo lista entre sus productos.

## Quién está detrás

- Empresa: Mo-IA, razón social "Automatización y Asesoría Tecnológica Moya Molina SpA", RUT 78.140.851-4 (según mo-ia.cl y la política de privacidad del Radar).
- Fundador: Cristian Moya. Según https://mo-ia.cl/IA2/sobre-mo-ia.html: "Dieciocho años en tecnología dentro de la banca chilena: EFTGroup, GTD, Scotiabank e Itaú"; escaló la práctica de RPA en Scotiabank a 40 personas y más de 100 procesos; fue Jefe de Operaciones Digitales en Itaú. Ingeniero en Informática (UNAB), Magíster en TI y Gestión de Proyectos (PUC), formación en IA en MIT Professional Education (2025).
- Equipo: la página "sobre" presenta solo al fundador; tamaño del equipo no aparece. Se presenta como operación unipersonal con foco en automatización.
- Ubicación: Santiago, Chile.
- Otros productos y servicios de Mo-IA: automatización de procesos, agentes de IA (WhatsApp, Telegram, web, correo), datos y dashboards, "CTO fraccional", workshops. Productos propios listados: ReservasCalendar (agenda online), GestionAKD (gestión de academias deportivas), El Buen Dato (directorio de negocios). Clientes mencionados: AutoPlanet, Academia Mario Lepe, Piazza Carrara, EcoPallet, Aymara Skincare.
- Precios de la consultoría (mo-ia.cl/IA2): implementaciones a precio fijo desde $100.000 hasta más de $5.500.000 y suscripciones mensuales de $30.000 a $100.000.
- Contacto: cris@mo-ia.cl, WhatsApp +56 9 7888 1049, LinkedIn linkedin.com/in/crmoya83, Instagram cr.mo.ia, YouTube @CrisMo-IA.
- Año de fundación de Mo-IA: no aparece.

## Funcionalidades

Leyenda: [visto] = descrito con detalle y con maqueta o ejemplo en la landing; [prometido] = solo mencionado en texto, sin poder verificarlo sin cuenta. Nada pudo probarse en el producto real porque exige login.

- [visto] Radar con puntaje de afinidad: revisa licitaciones cada hora y Compras Ágiles cada media hora desde la API de ChileCompra; ordena por afinidad con el perfil; filtros por región, monto, rubro y plazo. La landing muestra un contador en vivo ("4.127 licitaciones abiertas", "1.155 Compras Ágiles que cierran en 3 días") y tarjetas de ejemplo con las palabras del perfil resaltadas.
- [visto] Análisis de bases con IA: trae la ficha oficial de Mercado Público "con un clic" o se suben bases, anexos, formularios y planillas. Lee PDF, Word, Excel, texto e imágenes. Un resumen por documento (cada documento se procesa una sola vez) y luego un análisis cruzado con la ficha de la empresa: si conviene postular, requisitos y cuáles se cumplen, criterios de evaluación con ponderaciones, "cómo ganar", riesgos, preguntas para el foro y documentos a presentar. La maqueta muestra "Recomendación: Postular, probabilidad de adjudicar media".
- [visto] Tablero de seguimiento en equipo: estados "me interesa, preparando oferta, enviada, adjudicada"; plan de postulación por etapas con fechas límite y responsables armado por la IA; documentos, notas y bitácora por oportunidad.
- [visto] Ficha de empresa generada por IA: lee el sitio web de la empresa y documentos subidos (brochure, CV, certificados), redacta qué hace, experiencia, equipo y certificaciones; "No inventa"; sugiere qué falta (inscripción en ChileProveedores, certificaciones, montos de proyectos anteriores).
- [visto] "Trae tu propia IA" (BYO API key): el usuario conecta su cuenta de Claude (Anthropic), ChatGPT (OpenAI) o Gemini (Google) y paga directo al proveedor "sin recargos"; alternativa gratis vía OpenRouter con guía paso a paso; también DeepSeek, Groq, Mistral u otro compatible. Se pueden guardar varias claves y elegir cuál usar por licitación.
- [prometido] Alertas: correo diario con lo nuevo que calza, lo que está por cerrar y tareas que vencen.
- [prometido] Compartir por WhatsApp una oportunidad y copiar su código para buscarla en Mercado Público (es compartir manual, no un canal de aviso automático).
- [prometido] Usuarios ilimitados por empresa y uso desde el celular (web responsiva; no hay app).
- [prometido] Lista de adjuntos de cada Compra Ágil.
- Limitación reconocida por ellos: los anexos "protegidos con captcha en Mercado Público se descargan desde el portal y se suben al Radar" a mano.
- No aparece: seguimiento de instituciones u organismos específicos, historial de adjudicaciones o proveedores, datos abiertos o convenio marco, cobranza o reclamos de pago, capacitación o academia, blog, términos y condiciones (solo hay política de privacidad), generación o llenado de anexos oficiales, redacción de la propuesta.

## Onboarding

Formulario público de registro (https://licitar.mo-ia.cl/registro.php), sin tarjeta:

- Nombre de la empresa (obligatorio).
- Sitio web (opcional): "La IA lo usa para completar la ficha de tu empresa".
- "¿Qué vende tu empresa?" (selector de rubro): Lo defino después; Tecnología y software; Capacitación y consultoría; Construcción y mantención; Salud e insumos médicos; Aseo, seguridad y servicios generales; Alimentación y eventos; Transporte y logística; Artículos de oficina e impresión.
- Tu nombre, teléfono (obligatorio), correo, contraseña (mínimo 10 caracteres).
- Aceptación de la política de privacidad (obligatoria) y casilla opcional para que Mo-IA lo contacte comercialmente.
- RUT: no se pide en el registro. La política de privacidad sí menciona que guardan "nombre, RUT y datos de contacto de la empresa", así que probablemente se completa dentro de la app (no verificado).
- Palabras clave: según la landing se ajustan después del registro ("Eliges tu rubro y ajustas las palabras que describen tu oferta. En dos minutos el Radar sabe qué buscar").
- Región: no se pide en el registro; existe como filtro del radar.
- Prueba gratis: 3 días con acceso completo, sin tarjeta. "No necesitas cuenta en Mercado Público para revisar oportunidades."

## Planes y precios

Un solo plan con todas las funciones y usuarios ilimitados; cambia solo la periodicidad. Precios en pesos chilenos, pago con Flow (tarjetas, Webpay y transferencia).

| Plan | Precio | Equivalente mensual |
|---|---|---|
| Prueba | Gratis 3 días, sin tarjeta | - |
| Mensual | $9.990 al mes, sin permanencia | $9.990 |
| Semestral | $49.950 por 6 meses ("Ahorras 17%") | $8.325 |
| Anual | $89.990 por 12 meses ("Ahorras 25%") | $7.499 |

Costo de la IA aparte: lo cobra el proveedor elegido al usuario ("un análisis suele costar desde centavos hasta un par de dólares"); "El Radar no cobra recargo por el uso de IA". Con OpenRouter puede ser gratis.

Plan gratuito permanente: no aparece (solo la prueba de 3 días).

## Canales de aviso

- Correo: sí, un correo diario con nuevas oportunidades, cierres próximos y tareas que vencen. Es el único canal automático mencionado.
- WhatsApp: no como canal de alertas. Solo "Comparte por WhatsApp una oportunidad" (botón manual) y WhatsApp como canal de soporte y contacto comercial (+56 9 7888 1049).
- Panel: sí, panel web con tablero y radar, "funciona en el celular".
- App móvil, notificaciones push, SMS, Telegram: no aparecen.

## Diferencias frente a FirmaVB

| Aspecto | Radar de Licitaciones (Mo-IA) | FirmaVB |
|---|---|---|
| Descubrimiento | Puntaje de afinidad por rubro y palabras clave; filtros región, monto, rubro, plazo | Alertas por instituciones seguidas, más búsqueda |
| Inteligencia sobre la licitación | Resumen de bases y anexos con IA, criterios ponderados, "cómo ganar", riesgos, preguntas al foro | Libro de licitación con matriz de adjudicación y "Bajo el Agua" (historial del organismo, proveedores recurrentes, convenios, lobby, precios promedio) |
| Preparación de la oferta | Plan de tareas con fechas y responsables; no redacta anexos ni propuesta | Anexos y propuesta |
| Después de adjudicar | Nada | Cobranza con nota de cobro y Abogado; reclamos de pago por organismo |
| Datos de mercado | No | Datos abiertos y convenio marco |
| Formación | No | Academia |
| Trabajo en equipo | Tablero por estados, usuarios ilimitados, bitácora | (comparar con lo que tenga FirmaVB) |
| Modelo de IA | El usuario trae su propia clave (Claude, ChatGPT, Gemini) o usa OpenRouter gratis; costo de IA fuera del precio | IA incluida en el plan |
| Aviso | Correo diario | Según plan de FirmaVB |
| Precio | $9.990 al mes, $7.499 al mes en plan anual; prueba 3 días | Gratis; Experto Pro $50.000 por 30 días; Experto Plus $100.000 por 30 días |
| Plan gratis permanente | No | Sí |
| Ficha de empresa | La IA la arma leyendo la web y documentos | (verificar en FirmaVB) |
| Respaldo | Consultora unipersonal de automatización, producto nuevo sin difusión indexada | Producto en operación con varios módulos |

Resumen: Mo-IA cubre bien "encontrar y leer" (radar, análisis de bases, plan de tareas) a un precio 5 a 13 veces menor que los planes pagados de FirmaVB. FirmaVB cubre además "ganar y cobrar" (Bajo el Agua, anexos, propuesta, cobranza, reclamos de pago, datos de mercado, academia), que Mo-IA no tiene.

## Riesgos y oportunidades para FirmaVB

1. Riesgo de precio: $9.990 mensuales con usuarios ilimitados y todas las funciones contra $50.000 y $100.000 por 30 días. Un cliente que solo quiere alertas y lectura de bases va a comparar y elegir lo barato. Conviene que la landing de FirmaVB deje claro qué cubre cada plan que Mo-IA no ofrece (Bajo el Agua, anexos, cobranza) y que el plan Gratis compita de frente con su prueba de 3 días.
2. Riesgo de percepción de "IA sin recargo": su modelo "trae tu propia clave" suena barato, pero traslada costo y complejidad técnica al usuario (crear cuentas en OpenRouter o Anthropic). Oportunidad para FirmaVB: vender "IA incluida, sin configurar nada" como ventaja para pymes que no programan.
3. Oportunidad de producto: su plan de postulación con etapas, fechas y responsables, y la ficha de empresa armada leyendo la web, son ideas simples y visibles que FirmaVB podría incorporar al Libro de licitación (checklist con fechas por licitación) y al onboarding (autocompletar perfil desde el sitio web y documentos).
4. Riesgo de onboarding: Mo-IA promete estar operativo "en dos minutos" con rubro y palabras clave, sin cuenta de Mercado Público ni tarjeta. Si el registro de FirmaVB pide más pasos antes de mostrar valor, conviene simplificarlo y mostrar oportunidades reales antes de pedir datos.
5. Oportunidad de posicionamiento: hoy nadie indexa a Mo-IA ni a "Radar de Licitaciones" en buscadores y el fundador no tiene difusión del producto. FirmaVB puede ocupar primero las búsquedas y el contenido (comparativas, "cómo leer bases con IA", casos de cobranza) antes de que ellos empiecen a difundir. Vigilar cada mes si aparecen en Google, LinkedIn o YouTube (@CrisMo-IA).

## Fuentes

- https://licitar.mo-ia.cl/ (landing: funcionalidades, precios, FAQ, contador de licitaciones)
- https://licitar.mo-ia.cl/perfil.php (redirige al login; solo correo y contraseña)
- https://licitar.mo-ia.cl/registro.php (formulario de registro y rubros)
- https://licitar.mo-ia.cl/privacidad.php (razón social, "Versión septiembre 2026", datos tratados, proveedores de IA)
- https://licitar.mo-ia.cl/funcionalidades.php, /planes.php, /precios.php, /blog.php, /terminos.php: no existen (404 o sin respuesta)
- https://mo-ia.cl/ (empresa, servicios, productos, clientes, contacto, RUT)
- https://mo-ia.cl/IA2/ (servicios y precios de la consultoría)
- https://mo-ia.cl/IA2/sobre-mo-ia.html (trayectoria de Cristian Moya)
- Búsquedas en Google/Bing: "licitar.mo-ia.cl", "Mo-IA licitaciones Chile Mercado Público", "Radar de Licitaciones Mo-IA Cristian Moya": sin resultados sobre el producto
- http://archive.org/wayback/available?url=licitar.mo-ia.cl : sin capturas
