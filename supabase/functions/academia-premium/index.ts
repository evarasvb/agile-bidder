import { createClient } from 'jsr:@supabase/supabase-js@2';

const PLANILLAS = '/media/academia/planillas-programa-pro.xlsx';

// Contenido de cursos premium. Los cursos base viven aquí; los nuevos pueden
// vivir en la tabla academia_contenido (fallback). Todo SOLO en el servidor.
const CONTENIDO: Record<string, unknown> = {
  'programa-pro-adjudica-al-estado': [
    { titulo: 'Módulo 1 · El terreno de juego (y cómo pensar)', lecciones: [
      { titulo: 'Los 3 mitos que matan al proveedor nuevo', bloques: [
        { tipo: 'parrafo', texto: 'Antes de lo técnico: tu mentalidad determina tu éxito. Hay 3 mitos que destruyen a los nuevos proveedores. Derríbalos.' },
        { tipo: 'lista', items: ['Mito \"el Estado paga tarde y mal\": FALSO. El Estado paga en plazos definidos por ley (30 días). Es más predecible que muchos clientes privados.','Mito \"solo ganan los que tienen pituto\": FALSO. ChileCompra es de los sistemas más transparentes del mundo. Todo queda registrado. Gana quien hace la mejor oferta.','Mito \"necesitas ser grande\": FALSO. El 70% de las compras del Estado son de menos de 100 UTM. Ahí está tu oportunidad.'] },
        { tipo: 'tip', texto: 'Mentalidad de Surfista de Licitaciones: persistencia (no ganas la primera ni la segunda, pero aprendes), profesionalismo (cumple siempre) y visión de largo plazo (es un negocio, no un golpe de suerte).' } ] },
      { titulo: 'Compra Ágil, Licitación, Convenio Marco y Trato Directo', bloques: [
        { tipo: 'parrafo', texto: 'Según el monto (en UTM) y la urgencia, el Estado usa distintos mecanismos. Elegir bien dónde competir es media adjudicación. Base legal: Ley 19.886 y sus principios: libre concurrencia, igualdad, transparencia y probidad.' },
        { tipo: 'subtitulo', texto: 'Umbrales por monto (UTM ≈ $65.000; verifica el valor vigente)' },
        { tipo: 'lista', items: ['Menos de 3 UTM: compra directa, sin cotizar.','3 a 10 UTM: mínimo 3 cotizaciones.','10 a 100 UTM: licitación privada o convenio (aquí vive la Compra Ágil, hasta 100 UTM ≈ $6,5 millones).','100 a 1.000 UTM: licitación pública.','Más de 1.000 UTM: licitación pública con más requisitos y garantías.'] },
        { tipo: 'lista', items: ['Compra Ágil: rápida, sin garantías. Tu puerta de entrada y tu fábrica de flujo de caja.','Licitación pública: bases formales, criterios de evaluación, a veces garantías.','Convenio Marco: el \"santo grial\" — catálogo donde te compran directo, sin licitar cada vez.','Trato Directo: excepcional, solo con causal justificada por ley.'] },
        { tipo: 'tip', texto: 'Si estás partiendo, la Compra Ágil es tu mejor cancha: menos fricción, ciclos cortos, aprendes rápido.' },
        { tipo: 'descarga', texto: 'Descarga el Kit de Planillas de Control (Excel)', url: PLANILLAS } ] },
      { titulo: 'Empieza donde hay menos pelea', bloques: [
        { tipo: 'parrafo', texto: 'El Estado no es uno solo: son miles de organismos que compran independiente. Elegir bien a quién apuntar te ahorra competencia.' },
        { tipo: 'lista', items: ['Municipalidades: 345 en Chile, cada una compra lo suyo. Menos competencia, relación más directa.','Hospitales: los reyes de las compras; un hospital grande gasta más que muchos ministerios.','Ministerios y servicios: los grandes compradores, más competidos.','Consejo del autor: empieza por municipalidades pequeñas para construir historial.'] } ] } ] },
    { titulo: 'Módulo 2 · Estudia la licitación como experto', lecciones: [
      { titulo: 'Lee las bases con método (y el foro como arma secreta)', bloques: [
        { tipo: 'parrafo', texto: 'Las bases son el documento más importante: si no las lees bien, pierdes. Léelas con método para extraer lo que decide si ganas.' },
        { tipo: 'subtitulo', texto: 'Estructura típica de las bases' },
        { tipo: 'lista', items: ['Disposiciones generales: objeto (qué compran) y presupuesto (cuánto tienen).','Requisitos para ofertar: administrativos (declaraciones, poderes), técnicos (fichas, certificaciones) y garantía de seriedad si aplica.','Presentación de ofertas: formato de sobres, plazo y forma de entrega.','Evaluación: criterios y ponderación. Esto es ORO — aquí sabes qué les importa más.','Contrato: plazos, multas y forma de pago.'] },
        { tipo: 'subtitulo', texto: 'Checklist antes de decidir' },
        { tipo: 'lista', items: ['¿Tengo todos los documentos que piden?','¿Cumplo los requisitos técnicos?','¿El plazo de entrega es realista para mí?','¿Las multas son razonables?','¿El precio me deja margen?','¿Entiendo los criterios de evaluación?'] },
        { tipo: 'subtitulo', texto: 'El foro de preguntas: tu arma secreta' },
        { tipo: 'lista', items: ['Pregunta aclaraciones técnicas (\"¿se acepta certificación en trámite?\").','Pide flexibilidades (\"¿se aceptan productos equivalentes que cumplan las especificaciones?\").','Lee TODAS las preguntas de otros: las respuestas son públicas y a veces revelan oro.','Si algo está mal redactado en las bases, pregunta: a veces corrigen a tu favor.'] },
        { tipo: 'tip', texto: 'Marca cada requisito en las bases y respóndelo punto por punto. La mayoría pierde por no responder algo que sí pedían.' },
        { tipo: 'descarga', texto: 'Usa la planilla \"4. Admisibilidad\" del Kit', url: PLANILLAS } ] },
      { titulo: 'Estudia el pasado: adjudicados y ofertas técnicas', bloques: [
        { tipo: 'parrafo', texto: 'El pasado te dice el futuro. Mercado Público guarda el historial de adjudicaciones: úsalo. Antes de ofertar, revisa procesos anteriores de la misma institución por el mismo producto.' },
        { tipo: 'lista', items: ['Quién ganó y hace cuánto (identifica al incumbente).','Precio ganador y precio unitario (divide por la cantidad).','Qué presentó en la oferta técnica y qué valoró el comprador.','Banderas rojas: especificaciones \"a la medida\" de alguien, plazos muy cortos, o el mismo proveedor ganando siempre.'] },
        { tipo: 'tip', texto: 'Si el año pasado adjudicaron a X precio, ya sabes el rango para competir. No adivines: oferta con datos.' },
        { tipo: 'descarga', texto: 'Usa la planilla \"2. Adjudicados\" del Kit', url: PLANILLAS } ] },
      { titulo: 'Investiga a la institución', bloques: [
        { tipo: 'parrafo', texto: 'Detrás de cada compra hay una institución con contexto. Conocerla te ayuda a anticipar cómo decide y qué le importa hoy.' },
        { tipo: 'lista', items: ['Situación pública actual: noticias, presupuesto, prioridades del momento.','LinkedIn: quiénes deciden las compras y qué publican.','Su historial en Mercado Público: qué compra, cada cuánto y a quién.','Comentarios y señales en redes sobre la institución.'] } ] } ] },
    { titulo: 'Módulo 3 · Inteligencia competitiva (tu diferencial)', lecciones: [
      { titulo: 'Conductas de pago: ¿este comprador paga bien?', bloques: [
        { tipo: 'parrafo', texto: 'El Estado paga en 30 días por ley, pero no todos los organismos se comportan igual. Ganar no sirve si te pagan tarde: revisa el comportamiento histórico antes de comprometer capital.' },
        { tipo: 'subtitulo', texto: 'Semáforo de conducta de pago' },
        { tipo: 'lista', items: ['🟢 Bueno: paga en 30 días o menos.','🟡 Regular: entre 31 y 60 días.','🔴 Lento: más de 60 días — ajusta tu precio o evita.'] },
        { tipo: 'tip', texto: 'Un buen margen con pago lento puede quebrarte. Prioriza a los 🟢 para cuidar tu flujo de caja.' },
        { tipo: 'descarga', texto: 'Usa la planilla \"5. Conductas de Pago\" del Kit', url: PLANILLAS } ] },
      { titulo: 'Detecta fragmentación: ¿hay una compra ágil de lo mismo?', bloques: [
        { tipo: 'parrafo', texto: 'Señal clave: revisa si la misma institución tiene, en paralelo, una Compra Ágil por lo mismo que está licitando. Puede indicar fragmentación, urgencia, o una vía más rápida para entrar.' },
        { tipo: 'lista', items: ['Cruza la licitación con las Compras Ágiles recientes de la misma institución.','Compara fechas y montos: si compran lo mismo por varias vías, algo dice.','Úsalo a tu favor: a veces la Compra Ágil es la puerta más rápida al mismo cliente.'] },
        { tipo: 'tip', texto: 'Este cruce es tu diferencial: la mayoría mira solo la licitación y no ve el panorama completo de la institución.' } ] },
      { titulo: 'Arma tus 3 sobres y simula antes de enviar', bloques: [
        { tipo: 'parrafo', texto: 'Una oferta ganadora tiene 3 sobres. Si falla uno, pierdes. Ármalos y luego simula tu oferta como si fueras el evaluador.' },
        { tipo: 'lista', items: ['Sobre administrativo: declaración jurada de no inhabilidades, identificación, poder del representante legal. Olvidar UN documento = fuera.','Sobre técnico: fichas, certificaciones, metodología, experiencia. Personaliza, no copies y pegues.','Sobre económico: precios unitarios y total, forma de pago, validez. Respeta el formato (a veces exigen un Excel específico).'] },
        { tipo: 'subtitulo', texto: 'Errores que te eliminan' },
        { tipo: 'lista', items: ['Subir un archivo en el sobre equivocado.','Documento sin firmar o archivo que no abre.','Precio en formato incorrecto.','Enviar pasada la hora límite (ni un minuto). Envía con 2+ horas de anticipación: los servidores colapsan cerca del cierre.'] },
        { tipo: 'tip', texto: 'Ponte nota tú mismo contra cada criterio de evaluación. Si no llegas al puntaje ganador, ajusta antes de enviar.' },
        { tipo: 'descarga', texto: 'Usa las planillas \"1. Ir o No Ir\" y \"6. Seguimiento\" del Kit', url: PLANILLAS } ] } ] },
    { titulo: 'Módulo 4 · Precio ganador, garantías y automatización', lecciones: [
      { titulo: 'Estrategia de precio (sin regalar tu margen)', bloques: [
        { tipo: 'parrafo', texto: 'El precio importa, pero NO es todo: muchas licitaciones dan 40-60% al precio y el resto a calidad. Calcula con método y compite con datos, no con corazonadas.' },
        { tipo: 'subtitulo', texto: 'Fórmula' },
        { tipo: 'lista', items: ['Costo total = producto + flete + garantías + tiempo de tu equipo.','Precio neto = Costo total × (1 + margen mínimo).','Precio final = Precio neto + IVA (19%).','Investiga la competencia: mira quién ganó antes y a qué precio (historial en MP).'] },
        { tipo: 'tip', texto: 'Nunca bajes tanto que no puedas cumplir. Rematar precios te hace ganar ventas que te cuestan plata.' },
        { tipo: 'descarga', texto: 'Usa la planilla \"3. Precio y Margen\" del Kit', url: PLANILLAS } ] },
      { titulo: 'Garantías, adjudicación y ejecución sin morir', bloques: [
        { tipo: 'parrafo', texto: 'Ganar es fácil; cumplir es lo difícil. Aquí es donde muchos proveedores mueren. Conoce las garantías y ejecuta impecable.' },
        { tipo: 'lista', items: ['Garantía de fiel cumplimiento: normalmente 5-10% del monto; puede ser boleta bancaria, póliza o vale vista (la póliza suele ser más barata).','Firma el contrato dentro del plazo (10-15 días); si no firmas, pierdes y arriesgas inhabilidad.','Cumple los plazos: las multas son automáticas y se descuentan del pago; una multa se come tu margen.','Entrega exactamente lo ofertado; documenta todo (guías, actas) y comunica los problemas antes, nunca después.'] },
        { tipo: 'tip', texto: 'Si perdiste, lee el acta de evaluación y entiende por qué (precio, técnica o documento faltante). Cada intento te acerca a la próxima adjudicación.' } ] },
      { titulo: 'Automatiza con FirmaVB (y con IA)', bloques: [
        { tipo: 'parrafo', texto: 'Lo que aprendiste a mano, FirmaVB lo hace a escala: escanea Mercado Público, cruza con tu inventario, prepara ofertas automáticas y te ayuda a postular en minutos con la extensión.' },
        { tipo: 'lista', items: ['Búsqueda y match 24/7 de oportunidades que calzan contigo.','Ofertas automáticas listas para revisar.','Postulación asistida en el portal con la extensión de FirmaVB.','IA para analizar bases rápido y para apoyar tus propuestas (siempre revisa lo que genera).'] },
        { tipo: 'tip', texto: 'Con el método claro y la herramienta trabajando por ti, pasas de participar de vez en cuando a adjudicar de forma constante.' } ] } ] }
  ],

  'iniciar-en-mercado-publico': [
    { titulo: 'Módulo 1 · Prepárate para vender', lecciones: [
      { titulo: 'Crea tu cuenta y entiende Mercado Público', bloques: [
        { tipo: 'parrafo', texto: 'Mercado Público (mercadopublico.cl) es la plataforma donde el Estado de Chile compra. Todo empieza creando tu cuenta de empresa con tu RUT. Es gratis.' },
        { tipo: 'lista', items: ['Entra a mercadopublico.cl y crea la cuenta de tu empresa.','Ten a mano el RUT de la empresa y los datos del representante legal.','Familiarízate con el buscador: ahí verás lo que el Estado necesita comprar.'] },
        { tipo: 'tip', texto: 'Registrarte no cuesta nada. El costo es no estar: si no estás, no te pueden comprar.' } ] },
      { titulo: 'Inscríbete y queda HÁBIL (el pasaporte para cotizar)', bloques: [
        { tipo: 'parrafo', texto: 'ChileProveedores es el registro oficial. Pero estar inscrito no basta: necesitas estar en ESTADO HÁBIL, con tus documentos al día.' },
        { tipo: 'lista', items: ['Certificado de antecedentes laborales y previsionales (F30-1) en previred.com — gratis, vence cada mes.','Certificado de deuda fiscal (TGR) en tesoreria.cl — si debes impuestos, no puedes cotizar.','Certificado de quiebras en boletinconcursal.cl.','Rubros: agrega TODOS los que apliquen (no solo \"lápices\": papel, archivadores, tintas...).'] },
        { tipo: 'tip', texto: 'Crea un recordatorio mensual para renovar el F30-1. Si se te vence un viernes y hay licitación el lunes, perdiste.' } ] } ] },
    { titulo: 'Módulo 2 · Tu primera venta', lecciones: [
      { titulo: 'Encuentra tu primera oportunidad (Compra Ágil)', bloques: [
        { tipo: 'parrafo', texto: 'La Compra Ágil (hasta 100 UTM) es la puerta de entrada perfecta: rápida y sin trámites pesados. El 70% de las compras del Estado son bajo 100 UTM: ahí está tu oportunidad.' },
        { tipo: 'lista', items: ['Define 2 o 3 palabras clave de lo que vendes y activa alertas por rubro.','Filtra por región y monto (estado \"Publicada\") para no perder tiempo.','Prioriza las que alcanzas a preparar bien antes del cierre.'] },
        { tipo: 'tip', texto: 'FirmaVB puede buscar por ti y mostrarte las que calzan con tu inventario, con un puntaje de match.' } ] },
      { titulo: 'Cotiza y postula sin miedo', bloques: [
        { tipo: 'parrafo', texto: 'Ofertar por primera vez asusta, pero es simple si respondes exactamente lo que piden.' },
        { tipo: 'lista', items: ['Lee la ficha completa antes de cotizar.','Ofrece el producto correcto, con precio, plazo y despacho claros.','Revisa cantidades y adjuntos; envía con anticipación.'] },
        { tipo: 'tip', texto: 'No te frustres si no ganas la primera. Cada oferta te enseña qué valora el comprador.' } ] } ] },
    { titulo: 'Módulo 3 · No te frenes', lecciones: [
      { titulo: 'Los errores típicos del que recién parte', bloques: [
        { tipo: 'lista', items: ['Ofertar sin leer bien la ficha o las bases.','Poner un precio que no deja utilidad por ganar como sea.','No revisar si la empresa está hábil.','Prometer plazos que no puedes cumplir.','Rendirse después de una sola oferta.'] },
        { tipo: 'tip', texto: 'Evitar estos 5 errores ya te pone por delante de la mayoría que recién parte.' } ] },
      { titulo: 'Qué hacer después de tu primera oferta', bloques: [
        { tipo: 'parrafo', texto: 'El negocio real aparece con la constancia: participar seguido, aprender de cada intento y sistematizar el proceso.' },
        { tipo: 'lista', items: ['Lleva registro de lo que ofertaste y a qué precio.','Mantén tu inventario y precios al día.','Cuando quieras escalar, deja que FirmaVB busque, haga match y prepare ofertas por ti.'] },
        { tipo: 'tip', texto: 'Cuando domines esto, el paso siguiente es el Programa Pro: estudiar y ganar licitaciones como experto.' } ] } ] }
  ]
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { action, slug, codigo, email } = await req.json();
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let contenido: unknown = CONTENIDO[slug as string];
    if (!contenido) {
      const { data: c } = await admin.from('academia_contenido').select('modulos').eq('slug', slug).maybeSingle();
      contenido = c?.modulos ?? undefined;
    }
    if (!contenido) return json({ ok: false, error: 'Curso no encontrado' }, 404);

    if (action === 'validar') {
      const code = String(codigo || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Ingresa tu código.' }, 400);
      const { data, error } = await admin.from('academia_accesos').select('id, estado').eq('curso_slug', slug).eq('codigo', code).maybeSingle();
      if (error) return json({ ok: false, error: 'Error validando el código.' }, 500);
      if (!data || data.estado === 'revocado') return json({ ok: false, error: 'Código inválido. Revísalo o escríbenos.' }, 200);
      if (data.estado === 'disponible') {
        await admin.from('academia_accesos').update({ estado: 'usado', asignado_at: new Date().toISOString(), email: email || null }).eq('id', data.id);
      }
      return json({ ok: true, modulos: contenido });
    }

    if (action === 'recuperar') {
      const mail = String(email || '').trim().toLowerCase();
      if (!mail) return json({ ok: false, error: 'Ingresa tu correo.' }, 400);
      const { data } = await admin.from('academia_accesos').select('codigo').eq('curso_slug', slug).eq('email', mail).not('mp_payment_id', 'is', null).maybeSingle();
      if (!data) return json({ ok: false, error: 'No encontramos una compra con ese correo. Si acabas de pagar, espera un minuto.' }, 200);
      return json({ ok: true, codigo: data.codigo, modulos: contenido });
    }

    return json({ ok: false, error: 'Acción no válida' }, 400);
  } catch (_e) {
    return json({ ok: false, error: 'Error inesperado' }, 500);
  }
});
