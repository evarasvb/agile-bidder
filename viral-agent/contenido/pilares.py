"""
Pilares de contenido para el lanzamiento de
"Véndele al Estado y no mueras en el intento".

Cada pilar trae varias plantillas de caption con placeholders.
El generador combina pilares x plantillas x formatos x hashtags
para "multiplicar" contenido sin sonar repetitivo.
"""

BOOK_TITLE = "Véndele al Estado y no mueras en el intento"

PILARES = [
    {
        "clave": "mitos",
        "nombre": "Mitos y errores comunes",
        "formatos": ["carrusel", "reel"],
        "captions": [
            (
                "🚫 Mito: \"vender al Estado es solo para empresas grandes\".\n\n"
                "La realidad es otra, y te la cuento con casos reales en '{titulo}'. "
                "Swipe para ver los 3 errores que más veo repetir a las PYMES en Mercado Público 👇"
            ),
            (
                "El 90% de las PYMES que dejan de postular a licitaciones lo hacen por el "
                "mismo motivo — y no es la competencia. En '{titulo}' te muestro cuál es y "
                "cómo evitarlo desde tu primera oferta."
            ),
            (
                "Nadie te dice esto antes de tu primera licitación pública... hasta ahora. "
                "3 errores que le cuestan contratos a proveedores del Estado (y cómo los "
                "resolví escribiendo '{titulo}') 🧵"
            ),
            (
                "Mito: \"si ofrezco el precio más bajo, gano\". Falso. La ficha de "
                "evaluación pondera precio, plazo, experiencia y cumplimiento de "
                "requisitos técnicos — y ahí es donde se pierden más puntos de los que "
                "crees. Te muestro cómo leerla en '{titulo}'."
            ),
            (
                "¿Cuánto te ha costado una licitación descartada por un anexo mal llenado? "
                "A la mayoría de las PYMES les pasa al menos una vez. En '{titulo}' te "
                "dejo el checklist que uso para que no te vuelva a pasar a ti."
            ),
            (
                "Mito: \"el Estado paga cuando quiere\". Hay datos públicos de conducta de "
                "pago por organismo — y no todos son iguales. En '{titulo}' te explico "
                "dónde mirarlos antes de postular, no después de ganar."
            ),
        ],
    },
    {
        "clave": "tips",
        "nombre": "Tips prácticos / checklists",
        "formatos": ["carrusel", "post_imagen"],
        "captions": [
            (
                "✅ Checklist antes de postular a tu próxima licitación en Mercado Público:\n"
                "1. Revisa las bases hasta el final (ahí están las descalificaciones)\n"
                "2. Verifica tu inscripción y garantías\n"
                "3. Calcula tu margen real, no el que \"suena bien\"\n"
                "Más detalle en '{titulo}', link en bio 📖"
            ),
            (
                "Guarda este post 📌 — Antes de subir tu oferta, pregúntate: ¿mi propuesta "
                "responde EXACTAMENTE lo que piden las bases? La mayoría de las ofertas se "
                "caen por esto, no por precio. Todo el proceso paso a paso en '{titulo}'."
            ),
            (
                "3 cosas que reviso ANTES de calcular el precio de una oferta:\n"
                "1. Fecha y hora exacta de cierre (con huso horario)\n"
                "2. Garantía de seriedad: monto, plazo y forma de entrega\n"
                "3. Criterios de evaluación y su ponderación\n"
                "El resto del método, en '{titulo}'."
            ),
            (
                "¿Sabes calcular tu margen real en una licitación? No es precio menos "
                "costo — hay que sumar la garantía, el plazo de pago del organismo y el "
                "riesgo de multas. Te lo dejo con ejemplos en '{titulo}'."
            ),
        ],
    },
    {
        "clave": "historias",
        "nombre": "Historias y casos reales",
        "formatos": ["reel", "post_imagen"],
        "captions": [
            (
                "De perder la primera licitación por un detalle administrativo, a "
                "entender cómo funciona realmente el Estado como cliente. Esa fue la "
                "historia que me hizo escribir '{titulo}'. Cuéntame en los comentarios "
                "cuál fue tu primer 'papelón' con Mercado Público 👇"
            ),
            (
                "Una PYME, un error de $50.000 en la boleta de garantía, y una lección que "
                "no se olvida. Estas son las historias reales detrás de '{titulo}' — "
                "el libro que me hubiera gustado tener antes de empezar."
            ),
            (
                "Un cliente perdió una licitación adjudicable por subir el anexo en el "
                "formato equivocado. Nada de precio, nada de calidad técnica — un PDF. "
                "Por eso el capítulo de admisibilidad de '{titulo}' es el que más releo "
                "recomendar."
            ),
            (
                "La primera vez que gané una licitación pública no fue por tener el mejor "
                "precio, fue por ser el único que cumplió TODOS los requisitos formales. "
                "Esa fue la lección que armó buena parte de '{titulo}'."
            ),
        ],
    },
    {
        "clave": "backstage",
        "nombre": "Detrás de cámara / por qué escribí el libro",
        "formatos": ["reel", "post_imagen"],
        "captions": [
            (
                "Por qué escribí '{titulo}': llevo años ayudando a PYMES a vender al Estado "
                "chileno y vi el mismo patrón una y otra vez — el problema nunca es la "
                "oferta, es no entender las reglas del juego. Este libro es esa guía."
            ),
            (
                "Spoiler: este libro no es teoría. Es lo que aprendí (a golpes) postulando y "
                "ayudando a postular a licitaciones públicas en Chile. '{titulo}' ya está "
                "disponible, link en bio."
            ),
            (
                "Me preguntan seguido por qué me metí a escribir sobre Mercado Público en "
                "vez de solo seguir asesorando en privado: porque el mismo error se repite "
                "en cientos de PYMES que nunca se conocen entre sí. '{titulo}' junta esos "
                "errores en un solo lugar."
            ),
            (
                "Detrás de cada capítulo de '{titulo}' hay una pregunta real que me hizo "
                "algún cliente antes de postular por primera vez. Si tienes una duda que no "
                "está en el libro, cuéntamela en los comentarios."
            ),
        ],
    },
    {
        "clave": "prueba_social",
        "nombre": "Prueba social / reseñas",
        "formatos": ["post_imagen", "story"],
        "captions": [
            (
                "\"{cita_lector}\" — gracias por leer '{titulo}' 🙌 Si tú también lo leíste, "
                "cuéntame qué capítulo te sirvió más."
            ),
            (
                "Lo que más me repiten los lectores de '{titulo}': \"{cita_lector}\". "
                "Si postulas a licitaciones y aún no lo lees, este es tu momento 📖"
            ),
            (
                "Cada semana llega un mensaje como este sobre '{titulo}': \"{cita_lector}\". "
                "Gracias por leerlo y compartirlo con tu equipo."
            ),
        ],
    },
    {
        "clave": "cta_directo",
        "nombre": "Llamado a la acción directo",
        "formatos": ["post_imagen", "reel"],
        "captions": [
            (
                "'{titulo}' ya está disponible en Amazon 📚 Si vendes o quieres vender "
                "productos o servicios al Estado en Chile, este libro te ahorra meses de "
                "prueba y error. Link en bio."
            ),
            (
                "¿Tu empresa está inscrita en Mercado Público pero no ha ganado ninguna "
                "licitación todavía? Empieza por '{titulo}'. Todo el proceso explicado sin "
                "vueltas, de PYME a PYME."
            ),
            (
                "Si vendes al Estado hace años a puro instinto, '{titulo}' te ordena el "
                "proceso de punta a punta: bases, evaluación, garantías y contrato. "
                "Disponible en Amazon, link en bio."
            ),
            (
                "Última llamada para quienes postulan seguido y siguen perdiendo por temas "
                "administrativos: '{titulo}' resuelve justo eso. Link en bio."
            ),
        ],
    },
]

CTA_DEFAULT = "📖 Consíguelo en Amazon — link en la bio / {book_url}"
