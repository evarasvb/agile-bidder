// =============================================================================
//  CURSOS DE LA ACADEMIA FIRMAVB
// -----------------------------------------------------------------------------
//  Contenido de los cursos gratuitos, leíbles dentro de firmavb.cl/academia.
//  Para editar: cambia los textos aquí. Para agregar un curso, copia un objeto
//  del arreglo CURSOS y ajusta slug (único), título, módulos y lecciones.
//
//  Nota: los montos del Estado se expresan en UTM y se actualizan; cuando se
//  mencionan tramos, conviene verificar los valores vigentes en ChileCompra.
// =============================================================================

export type Bloque =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "lista"; items: string[] }
  | { tipo: "tip"; texto: string }
  | { tipo: "descarga"; texto: string; url: string };

export interface Leccion {
  titulo: string;
  bloques: Bloque[];
}

export interface Modulo {
  titulo: string;
  lecciones: Leccion[];
}

export type Acento = "azul" | "verde" | "ambar";

export interface Curso {
  slug: string;
  emoji: string;
  titulo: string;
  descripcion: string;
  nivel: string;
  duracion: string;
  acento: Acento;
  // --- Monetización (opcional) ---------------------------------------------
  // Si premium = true, el curso se vende: en el lector se muestra una página
  // de venta (temario + precio + botón Comprar) en vez del contenido completo.
  premium?: boolean;
  precio?: string; // ej. "$29.990"
  pagoUrl?: string; // link de pago de Mercado Pago (déjalo "" hasta tenerlo)
  // Sesión en vivo incluida (opcional). agendarUrl: link de agenda (Calendly/
  // Google) o déjalo "" para coordinar por WhatsApp.
  sesionEnVivo?: { incluida: boolean; minutos: number; agendarUrl?: string };
  modulos: Modulo[];
}

// Clases de color por acento (fijas, para que Tailwind no las purgue).
export const ACENTO: Record<
  Acento,
  { portada: string; texto: string; chip: string }
> = {
  azul: {
    portada: "bg-gradient-to-br from-firmavb-blue to-header-dark",
    texto: "text-firmavb-blue",
    chip: "bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/20",
  },
  verde: {
    portada: "bg-gradient-to-br from-[hsl(var(--success))] to-firmavb-blue",
    texto: "text-[hsl(var(--success))]",
    chip: "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20",
  },
  ambar: {
    portada: "bg-gradient-to-br from-[hsl(var(--warning))] to-firmavb-red",
    texto: "text-[hsl(var(--warning))]",
    chip: "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  },
};

export const CURSOS: Curso[] = [
  // ===========================================================================
  // CURSO 1
  // ===========================================================================
  {
    slug: "vende-al-estado-desde-cero",
    emoji: "🚀",
    titulo: "Vende al Estado desde Cero",
    descripcion:
      "Entiende cómo compra el Estado, deja tu empresa lista para vender y encuentra tu primera oportunidad.",
    nivel: "Principiante",
    duracion: "≈ 45 min",
    acento: "azul",
    modulos: [
      {
        titulo: "Módulo 1 · El mapa del juego",
        lecciones: [
          {
            titulo: "¿Cómo le compra el Estado a las empresas?",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "El Estado de Chile compra bienes y servicios todos los días: desde resmas de papel y artículos de aseo hasta software, equipamiento médico y obras. Casi todas esas compras pasan por un solo lugar: Mercado Público (mercadopublico.cl), la plataforma que administra ChileCompra.",
              },
              {
                tipo: "parrafo",
                texto:
                  "Esto es una oportunidad enorme: miles de organismos (municipalidades, hospitales, ministerios, servicios, universidades) publican sus necesidades y cualquier empresa registrada puede ofertar. No importa si eres una PYME o un emprendedor: compites por las mismas oportunidades que las grandes.",
              },
              {
                tipo: "lista",
                items: [
                  "Comprador: el organismo público que necesita algo (ej. un hospital).",
                  "Proveedor: tu empresa, que ofrece el producto o servicio.",
                  "Mercado Público: el portal donde se publican y adjudican las compras.",
                  "ChileProveedores: el registro oficial de proveedores del Estado.",
                ],
              },
              {
                tipo: "subtitulo",
                texto: "Los 3 mitos que frenan a todos",
              },
              {
                tipo: "lista",
                items: [
                  "\"El Estado paga tarde y mal\": falso. Paga en plazos definidos por ley (30 días); suele ser más predecible que un cliente privado.",
                  "\"Solo ganan los que tienen pituto\": falso. ChileCompra es de los sistemas más transparentes del mundo; todo queda registrado y gana la mejor oferta.",
                  "\"Necesitas ser grande\": falso. El 70% de las compras del Estado son de menos de 100 UTM. Ahí está tu oportunidad.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "La clave del negocio no es ganar una vez, es ganar de forma constante. Por eso conviene sistematizar: buscar, ofertar y hacer seguimiento como un proceso, no como algo ocasional.",
              },
            ],
          },
          {
            titulo: "Los 4 caminos para venderle al Estado",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "No todas las compras funcionan igual. Según el monto y la urgencia, el Estado usa distintos mecanismos (todo bajo la Ley 19.886 y sus principios: libre concurrencia, igualdad, transparencia y probidad). Conocerlos te permite elegir por dónde entrar.",
              },
              {
                tipo: "lista",
                items: [
                  "Menos de 3 UTM: compra directa, sin cotizar.",
                  "3 a 10 UTM: mínimo 3 cotizaciones.",
                  "10 a 100 UTM: licitación privada o convenio (aquí vive la Compra Ágil).",
                  "100 a 1.000 UTM: licitación pública. Más de 1.000 UTM: con más requisitos y garantías.",
                  "Referencia: la UTM vale aprox. $65.000, así que 100 UTM ≈ $6,5 millones (verifica el valor vigente).",
                ],
              },
              {
                tipo: "subtitulo",
                texto: "1. Compra Ágil",
              },
              {
                tipo: "parrafo",
                texto:
                  "Para compras de bajo monto (hasta 100 UTM). Es rápida y simple: el organismo pide cotizaciones y compara. Es la mejor puerta de entrada para empezar.",
              },
              {
                tipo: "subtitulo",
                texto: "2. Licitación Pública",
              },
              {
                tipo: "parrafo",
                texto:
                  "Para montos mayores. Tiene bases formales, plazos y criterios de evaluación. Según el monto en UTM se clasifican en distintos tipos (LE, LP, LR…) con más o menos exigencias y, a veces, garantías.",
              },
              {
                tipo: "subtitulo",
                texto: "3. Convenio Marco",
              },
              {
                tipo: "parrafo",
                texto:
                  "Es como un 'supermercado del Estado': un catálogo (la Tienda) donde los organismos compran directo. Para estar ahí primero postulas a la licitación del convenio; luego publicas tus productos.",
              },
              {
                tipo: "subtitulo",
                texto: "4. Trato Directo",
              },
              {
                tipo: "parrafo",
                texto:
                  "Compra excepcional, sin concurso, que solo procede en casos justificados por ley (proveedor único, emergencia, etc.).",
              },
              {
                tipo: "tip",
                texto:
                  "Si estás partiendo, enfócate en Compra Ágil: menos requisitos, ciclos cortos y aprendes rápido cómo funciona el portal.",
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 2 · Prepara tu empresa",
        lecciones: [
          {
            titulo: "Inscríbete en ChileProveedores",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "ChileProveedores es el registro oficial de proveedores del Estado. Estar inscrito y 'hábil' te permite recibir órdenes de compra y participar sin trabas. Puedes ofertar con el registro básico, pero mantenerlo completo y al día evita problemas al momento de adjudicar.",
              },
              {
                tipo: "lista",
                items: [
                  "Crea tu cuenta de empresa en Mercado Público con tu RUT.",
                  "Completa tus datos: representante legal, rubros, medios de contacto.",
                  "Sube la documentación que te soliciten (legal, tributaria, financiera).",
                  "Revisa tu estado: 'hábil' significa que puedes contratar con el Estado.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "Un proveedor 'inhábil' no puede recibir órdenes de compra. Antes de ofertar en serio, verifica que tu empresa esté hábil y con documentos vigentes.",
              },
            ],
          },
          {
            titulo: "Deja tu empresa lista para vender",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Antes de salir a competir, ordena la casa. Tener esto resuelto te hace ofertar más rápido y verte más profesional frente al comprador.",
              },
              {
                tipo: "lista",
                items: [
                  "Catálogo o lista de precios: qué vendes, con precios netos y costos claros.",
                  "Capacidad de despacho: a qué regiones llegas y en cuántos días.",
                  "Documentos tributarios: poder emitir factura electrónica.",
                  "Datos de contacto y bancarios actualizados para el pago.",
                ],
              },
              {
                tipo: "parrafo",
                texto:
                  "En FirmaVB puedes cargar tu inventario/lista de precios una vez y reutilizarlo en cada oferta. Eso es justamente lo que hace que ofertar deje de ser lento.",
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 3 · Tu primera oportunidad",
        lecciones: [
          {
            titulo: "Cómo encontrar oportunidades que te sirvan",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "El error típico es revisar el portal 'a mano' de vez en cuando. Se pierden oportunidades por tiempo. La forma correcta es buscar con criterio y de manera constante.",
              },
              {
                tipo: "lista",
                items: [
                  "Define tus palabras clave (lo que realmente vendes).",
                  "Filtra por rubro, región y monto para no perder tiempo.",
                  "Mira la fecha de cierre: prioriza lo que alcanzas a preparar bien.",
                  "Revisa el historial del comprador: qué compró antes y a qué precio.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "FirmaVB escanea Mercado Público por ti y te muestra las oportunidades que coinciden con tu inventario, con un puntaje de match. Así dejas de buscar a ciegas.",
              },
            ],
          },
          {
            titulo: "Tu primera oferta, sin miedo",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Ofertar por primera vez asusta, pero es más simple de lo que parece si sigues un checklist. Lo esencial: entender qué piden y responder exactamente eso.",
              },
              {
                tipo: "lista",
                items: [
                  "Lee las bases o la ficha completa antes de cotizar.",
                  "Verifica que cumples los requisitos (si no, no ofertes: pierdes tiempo).",
                  "Ofrece el producto correcto, con su precio, plazo y despacho.",
                  "Adjunta lo que pidan (ficha técnica, certificados) y revisa antes de enviar.",
                ],
              },
              {
                tipo: "parrafo",
                texto:
                  "No te frustres si no ganas la primera. Cada oferta te enseña qué valora el comprador. La constancia es la que adjudica.",
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================================================================
  // CURSO 2
  // ===========================================================================
  {
    slug: "gana-compras-agiles",
    emoji: "⚡",
    titulo: "Gana Compras Ágiles",
    descripcion:
      "La puerta de entrada más rápida: aprende a cotizar, poner el precio ganador y adjudicar Compras Ágiles.",
    nivel: "Principiante · Intermedio",
    duracion: "≈ 40 min",
    acento: "ambar",
    modulos: [
      {
        titulo: "Módulo 1 · Entiende la Compra Ágil",
        lecciones: [
          {
            titulo: "Qué es y por qué es tu mejor puerta de entrada",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "La Compra Ágil es un mecanismo simple y rápido para compras de bajo monto (hasta 100 UTM ≈ $6,5 millones). El organismo publica lo que necesita, los proveedores cotizan, y se adjudica a la mejor oferta. Sin bases complejas ni garantías. Dato clave: el 70% de las compras del Estado son bajo 100 UTM, así que aquí está la mayor cantidad de oportunidades.",
              },
              {
                tipo: "lista",
                items: [
                  "Ciclos cortos: puedes cotizar y adjudicar en pocos días.",
                  "Menos requisitos que una licitación grande.",
                  "Ideal para empezar, generar historial y flujo de caja.",
                  "Alto volumen: se publican muchísimas cada día.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "Como hay muchas Compras Ágiles y cierran rápido, la velocidad importa. El que cotiza bien y a tiempo, gana.",
              },
            ],
          },
          {
            titulo: "El flujo completo, paso a paso",
            bloques: [
              {
                tipo: "parrafo",
                texto: "Toda Compra Ágil sigue el mismo recorrido. Conocerlo te da control.",
              },
              {
                tipo: "lista",
                items: [
                  "1. Publicación: el organismo describe qué necesita y cuándo cierra.",
                  "2. Cotización: los proveedores envían su oferta (producto, precio, plazo).",
                  "3. Evaluación: el comprador compara según los criterios definidos.",
                  "4. Orden de compra (OC): al ganador se le emite la OC, que debe aceptar.",
                  "5. Entrega y pago: despachas, facturas y te pagan.",
                ],
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 2 · Arma ofertas que ganan",
        lecciones: [
          {
            titulo: "El precio ganador (sin regalar tu margen)",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "El precio es casi siempre el factor más importante, pero 'el más barato' no es la meta: la meta es el precio más competitivo que aún te deja utilidad. Rematar precios te hace ganar ventas que te cuestan plata.",
              },
              {
                tipo: "lista",
                items: [
                  "Parte del costo real: producto + despacho + tiempo + impuestos.",
                  "Define tu margen mínimo y no bajes de ahí.",
                  "Considera el costo de despacho a la región del comprador.",
                  "Si no te da el número, mejor no ofertes esa: cuida tu rentabilidad.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "FirmaVB calcula precios y márgenes automáticamente a partir de tu inventario, para que no ofertes por debajo de tu piso de rentabilidad.",
              },
            ],
          },
          {
            titulo: "La ficha perfecta",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Una oferta clara y completa transmite confianza y evita que te descarten por un detalle. Responde exactamente lo que piden.",
              },
              {
                tipo: "lista",
                items: [
                  "Describe el producto igual o mejor a lo solicitado (marca, modelo, especificaciones).",
                  "Indica plazo de entrega realista: prometer y no cumplir daña tu reputación.",
                  "Adjunta ficha técnica o certificados si los piden.",
                  "Revisa cantidades y unidades antes de enviar (un error acá te cuesta la venta).",
                ],
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 3 · Repite y escala",
        lecciones: [
          {
            titulo: "Sistematiza para ganar muchas, no una",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "El verdadero negocio aparece cuando repites el proceso con eficiencia. Si cada oferta te toma una hora, no escala. Si te toma minutos, sí.",
              },
              {
                tipo: "lista",
                items: [
                  "Mantén tu inventario y precios siempre actualizados.",
                  "Reutiliza plantillas de respuesta para lo que se repite.",
                  "Lleva registro de qué ganaste y a qué precio, para mejorar.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "FirmaVB puede generar ofertas automáticas cruzando cada Compra Ágil con tu inventario, dejándote la propuesta lista para revisar y postular.",
              },
            ],
          },
          {
            titulo: "Postúlala en el portal",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "El último paso es cargar tu oferta en Mercado Público. La extensión de FirmaVB para el navegador te ayuda a llenar el formulario de postulación con los datos y precios que ya preparaste, para que no lo hagas a mano.",
              },
              {
                tipo: "lista",
                items: [
                  "Prepara la oferta en FirmaVB (match + precios).",
                  "Abre la Compra Ágil en el portal con la extensión activa.",
                  "Autocompleta los valores y revisa antes de enviar.",
                  "Adjunta lo requerido y postula tú el envío final.",
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================================================================
  // CURSO 3
  // ===========================================================================
  {
    slug: "domina-los-convenios-marco",
    emoji: "🏆",
    titulo: "Domina los Convenios Marco",
    descripcion:
      "El 'supermercado del Estado': cómo postular, publicar tus productos y recibir órdenes de compra.",
    nivel: "Intermedio",
    duracion: "≈ 40 min",
    acento: "verde",
    modulos: [
      {
        titulo: "Módulo 1 · Qué es un Convenio Marco",
        lecciones: [
          {
            titulo: "El supermercado del Estado",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Un Convenio Marco (CM) es un acuerdo por el cual ChileCompra pone a disposición un catálogo de productos y servicios —la Tienda— donde los organismos pueden comprar directamente, sin hacer una licitación cada vez. Si estás en el catálogo, te compran con un par de clics.",
              },
              {
                tipo: "lista",
                items: [
                  "Catálogo (Tienda): vitrina donde publicas tus productos y precios.",
                  "Organismo: compra directo desde la Tienda emitiendo una orden de compra.",
                  "Ventaja: quedas 'siempre disponible' para miles de compradores.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "El Convenio Marco es el 'santo grial': ventas constantes sin cotizar cada vez. Estar ahí es como tener tu producto en la góndola oficial del Estado; la clave luego es tener buena ficha, buen precio y cumplir.",
              },
            ],
          },
          {
            titulo: "¿Te conviene postular?",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Los Convenios Marco son potentes, pero exigen capacidad de cumplimiento (stock, despacho, respaldo). Evalúa antes de entrar.",
              },
              {
                tipo: "lista",
                items: [
                  "¿Tu rubro tiene un Convenio Marco vigente o próximo a abrirse? (ej. aseo, software, mobiliario).",
                  "¿Puedes sostener precio y stock durante la vigencia del convenio?",
                  "¿Tienes capacidad de despacho a las regiones donde te comprarán?",
                ],
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 2 · Entra al Convenio",
        lecciones: [
          {
            titulo: "Cómo postular a un Convenio Marco",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Para estar en la Tienda primero debes adjudicar la licitación del Convenio Marco (habitualmente de gran tamaño). Ahí se define quiénes entran al catálogo.",
              },
              {
                tipo: "lista",
                items: [
                  "Revisa las bases del convenio: requisitos de admisibilidad y criterios.",
                  "Prepara la documentación legal, técnica y económica que exijan.",
                  "Cuida la admisibilidad: un requisito faltante te deja fuera antes de evaluar.",
                  "Respeta los plazos: los convenios abren en fechas específicas.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "FirmaVB tiene un validador de admisibilidad para algunos convenios: te dice en minutos si tu empresa cumple y qué puntaje técnico podrías alcanzar.",
              },
            ],
          },
          {
            titulo: "Publica tus productos en la Tienda",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Una vez dentro, tu trabajo es que tu ficha venda. Un catálogo bien armado y con precio competitivo es lo que hace que te elijan entre varios proveedores.",
              },
              {
                tipo: "lista",
                items: [
                  "Fichas claras: buen nombre, descripción, imagen y especificaciones.",
                  "Precio competitivo pero rentable (recuerda: incluye despacho).",
                  "Mantén el catálogo actualizado (precios, stock, vigencias).",
                ],
              },
            ],
          },
        ],
      },
      {
        titulo: "Módulo 3 · Vende y cumple",
        lecciones: [
          {
            titulo: "Cómo te llegan las órdenes de compra",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "Cuando un organismo te compra en la Tienda, se genera una Orden de Compra (OC). Debes aceptarla dentro del plazo y luego cumplir con la entrega en las condiciones publicadas.",
              },
              {
                tipo: "lista",
                items: [
                  "Revisa tus OC a diario para no perder plazos de aceptación.",
                  "Confirma stock y despacho antes de aceptar.",
                  "Cumple el plazo comprometido: es lo que cuida tu reputación.",
                ],
              },
              {
                tipo: "tip",
                texto:
                  "En FirmaVB puedes ver y ordenar tus órdenes de compra por tipo (Convenio Marco, Licitación, Compra Ágil) para llevar el control en un solo lugar.",
              },
            ],
          },
          {
            titulo: "Cumplimiento y reputación",
            bloques: [
              {
                tipo: "parrafo",
                texto:
                  "En el Estado, la reputación vale oro. Cumplir bien te trae más compras; incumplir te trae multas y mala evaluación que te cierran puertas.",
              },
              {
                tipo: "lista",
                items: [
                  "Entrega en el plazo y con la calidad ofrecida.",
                  "Comunica a tiempo si hay algún problema.",
                  "Mantén tu empresa 'hábil' y tus documentos vigentes.",
                  "Cuida tu evaluación: cada compra bien hecha es marketing para la siguiente.",
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ===========================================================================
  // CURSO PREMIUM (de pago)
  // ===========================================================================
  {
    slug: "programa-pro-adjudica-al-estado",
    emoji: "💎",
    titulo: "Programa Pro: Estudia y Gana Licitaciones como Experto",
    descripcion:
      "El método completo y accionable para estudiar una licitación de punta a cabo: analizar el pasado y los adjudicados, investigar a la institución, revisar conductas de pago, detectar fragmentación, simular tu presentación y adjudicar con estrategia. Incluye planillas Excel de control y una sesión en vivo de 45 min.",
    nivel: "Intermedio · Avanzado",
    duracion: "Programa completo + planillas + sesión en vivo",
    acento: "azul",
    premium: true,
    precio: "$45.000",
    pagoUrl: "https://mpago.la/345ua7Y", // link de pago de Mercado Pago
    sesionEnVivo: { incluida: true, minutos: 45, agendarUrl: "https://calendar.app.google/ccFTxwSnuHJbnsda8" },
    modulos: [
      {
        titulo: "Módulo 1 · El terreno de juego (y cómo pensar)",
        lecciones: [
          { titulo: "Los 3 mitos que matan al proveedor nuevo", bloques: [] },
          { titulo: "Compra Ágil, Licitación, Convenio Marco y Trato Directo", bloques: [] },
          { titulo: "Empieza donde hay menos pelea", bloques: [] },
        ],
      },
      {
        titulo: "Módulo 2 · Estudia la licitación como experto",
        lecciones: [
          { titulo: "Lee las bases con método (y el foro como arma secreta)", bloques: [] },
          { titulo: "Estudia el pasado: adjudicados y ofertas técnicas", bloques: [] },
          { titulo: "Investiga a la institución", bloques: [] },
        ],
      },
      {
        titulo: "Módulo 3 · Inteligencia competitiva (tu diferencial)",
        lecciones: [
          { titulo: "Conductas de pago: ¿este comprador paga bien?", bloques: [] },
          { titulo: "Detecta fragmentación: ¿hay una compra ágil de lo mismo?", bloques: [] },
          { titulo: "Arma tus 3 sobres y simula antes de enviar", bloques: [] },
        ],
      },
      {
        titulo: "Módulo 4 · Precio ganador, garantías y automatización",
        lecciones: [
          { titulo: "Estrategia de precio (sin regalar tu margen)", bloques: [] },
          { titulo: "Garantías, adjudicación y ejecución sin morir", bloques: [] },
          { titulo: "Automatiza con FirmaVB (y con IA)", bloques: [] },
        ],
      },
    ],
  },

  // ===========================================================================
  // CURSO PREMIUM DE ENTRADA (de pago, económico)
  // ===========================================================================
  {
    slug: "iniciar-en-mercado-publico",
    emoji: "🚀",
    titulo: "Inicia en Mercado Público (Curso Express)",
    descripcion:
      "En pocos pasos: inscríbete, entiende cómo se compra y consigue tu primera venta al Estado. El empujón para partir hoy.",
    nivel: "Principiante",
    duracion: "Curso express",
    acento: "verde",
    premium: true,
    precio: "$5.000",
    pagoUrl: "https://mpago.la/1WsbT5E", // link de pago de Mercado Pago ($5.000)
    modulos: [
      {
        titulo: "Módulo 1 · Prepárate para vender",
        lecciones: [
          { titulo: "Crea tu cuenta y entiende Mercado Público", bloques: [] },
          { titulo: "Inscríbete en ChileProveedores (paso a paso)", bloques: [] },
        ],
      },
      {
        titulo: "Módulo 2 · Tu primera venta",
        lecciones: [
          { titulo: "Encuentra tu primera oportunidad (Compra Ágil)", bloques: [] },
          { titulo: "Cotiza y postula sin miedo", bloques: [] },
        ],
      },
      {
        titulo: "Módulo 3 · No te frenes",
        lecciones: [
          { titulo: "Los errores típicos del que recién parte", bloques: [] },
          { titulo: "Qué hacer después de tu primera oferta", bloques: [] },
        ],
      },
    ],
  },
];

export function getCursoBySlug(slug: string): Curso | undefined {
  return CURSOS.find((c) => c.slug === slug);
}
