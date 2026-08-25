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
        ],
    },
]

CTA_DEFAULT = "📖 Consíguelo en Amazon — link en la bio / {book_url}"
