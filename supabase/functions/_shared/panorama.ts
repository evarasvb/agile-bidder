// Panorama completo de una licitación para el Experto (Don Evaristo): documentos
// subidos por error, antecedentes del organismo, compras ágiles del mismo tema
// (fragmentación), reclamos de proveedores y match con el inventario del usuario.
// Viene de la RPC experto_panorama_licitacion(p_codigo, p_user_id).

const fmt = (n: unknown) => n == null || n === "" ? "s/i" : "$" + Math.round(Number(n)).toLocaleString("es-CL");
const fecha = (d: unknown) => d ? String(d).slice(0, 10) : "s/i";
const tipoReclamo = (t: unknown) => Number(t) === 1 ? "pago no oportuno" : Number(t) === 2 ? "irregularidad en el proceso" : "otro";

// deno-lint-ignore no-explicit-any
export function textoPanorama(p: any, codigo: string): string {
  if (!p || typeof p !== "object") return "";
  const out: string[] = [];

  const docs: any[] = Array.isArray(p.documentos_de_otra_licitacion) ? p.documentos_de_otra_licitacion : [];
  if (docs.length) {
    out.push("DOCUMENTOS SUBIDOS BAJO ESTE CÓDIGO QUE HABLAN DE OTRA LICITACIÓN (detección automática por el código que aparece en el texto):\n" +
      docs.map((d) => `- "${d.archivo}" menciona ${d.codigo_detectado} y no ${codigo} → ${d.relacion === "antecedente_mismo_organismo"
        ? "es una licitación ANTERIOR del mismo organismo: úsalo como antecedente y contexto, no como bases de esta"
        : "parece de OTRA licitación (otro organismo): avísale al usuario que probablemente lo subió aquí por error, no lo uses como bases de esta y sugiérele quitarlo"}`).join("\n"));
  } else out.push("Documentos ajenos: ninguno detectado entre las bases subidas.");

  const ant: any[] = Array.isArray(p.antecedentes) ? p.antecedentes : [];
  if (ant.length) {
    out.push("ANTECEDENTES (licitaciones anteriores del mismo organismo con nombre parecido, últimos 3 años):\n" +
      ant.map((a) => `- ${a.codigo} | ${a.nombre} | ${a.estado} | publicada ${fecha(a.fecha_publicacion)} | presupuesto ${fmt(a.presupuesto)} ${a.moneda ?? ""} | oferentes ${a.oferentes ?? "s/i"} | adjudicatarios: ${a.adjudicatarios ?? "s/i"} | sus bases en FirmaVB: ${Number(a.bases_cargadas) > 0 ? `SÍ (${a.bases_cargadas} doc.)` : "NO (pídelas)"} | reclamos sobre ese proceso: ${a.reclamos ?? 0}`).join("\n"));
  } else out.push("Antecedentes: no encontré licitaciones anteriores del mismo organismo con nombre parecido (puede haberlas con otro nombre: pregúntale al usuario si conoce el proceso anterior y su código).");

  const ca: any[] = Array.isArray(p.compras_agiles_relacionadas) ? p.compras_agiles_relacionadas : [];
  if (ca.length) {
    out.push("COMPRAS ÁGILES DEL MISMO ORGANISMO SOBRE EL MISMO TEMA (últimos 180 días; posible fragmentación o compra puente):\n" +
      ca.map((c) => `- ${c.codigo} | ${c.nombre} | ${c.estado} | ${fmt(c.monto)} | publicada ${fecha(c.publicada)} | cierra ${fecha(c.cierra)}${c.unidad_compra ? " | " + c.unidad_compra : ""}`).join("\n"));
  }

  const r = p.reclamos_organismo;
  if (r && Number(r.total_12m) > 0) {
    const ult: any[] = Array.isArray(r.ultimos) ? r.ultimos : [];
    out.push(`COMENTARIOS Y RECLAMOS DE PROVEEDORES CONTRA EL ORGANISMO (12 meses, buscador de reclamos de Mercado Público): ${r.total_12m} en total; por pago no oportuno: ${r.por_tipo?.["1"] ?? 0}; por irregularidad en el proceso: ${r.por_tipo?.["2"] ?? 0}. Últimos:\n` +
      ult.map((u) => `- ${fecha(u.fecha)} | ${tipoReclamo(u.tipo)} | ${u.reclamante ?? "s/i"} | proceso ${u.proceso ?? "s/i"} | ${u.estado ?? ""}`).join("\n"));
  }

  const m: any[] = Array.isArray(p.matches_cliente) ? p.matches_cliente : [];
  if (m.length) {
    out.push("MATCH CON EL INVENTARIO DEL USUARIO (ítems de esta licitación que calzan con lo que vende):\n" +
      m.map((x) => `- pide "${x.pedido}"${x.cantidad ? ` x${x.cantidad}` : ""} → tiene "${x.tu_producto}"${x.sku ? ` (SKU ${x.sku})` : ""} a ${fmt(x.precio)} | calce ${x.score ?? "?"}%`).join("\n"));
  }

  return `PANORAMA COMPLETO DE ${codigo} (Datos Mercado Público vía FirmaVB):\n${out.join("\n\n")}`;
}

// Reglas de criterio para los prompts del Experto (chat, informe y estudio).
export const REGLAS_PANORAMA = `- PANORAMA COMPLETO (úsalo siempre que haya código): (a) Si hay DOCUMENTOS que hablan de OTRA licitación, dilo en la primera línea útil: nombra el archivo y el código que menciona; si es de otro organismo, avisa que se subió por error y no lo uses como bases de esta. (b) Si hay ANTECEDENTES, nómbralos con código y fecha, quién ganó y con cuántos oferentes; si sus bases NO están en FirmaVB, PIDE al usuario que suba las bases y anexos de esa licitación anterior con el botón "Subir bases (PDF)" de este mismo Libro ("súbeme las bases y anexos de la N° X para analizar el contexto completo"): el sistema las reconoce como antecedente. (c) Si hay COMPRAS ÁGILES del mismo organismo sobre el tema, menciónalas como posible fragmentación o compra puente y qué revelan del presupuesto real y del proveedor que ya le vende. (d) Reclamos de proveedores, noticias y ficha del organismo van juntos en tu lectura del riesgo. (e) Si hay MATCH con el inventario, parte por ahí: qué ítems puede ofertar y a qué precio. Si para el análisis falta algo (bases, anexos, antecedentes, precio o capacidad del usuario), pídelo de forma concreta al final, como pregunta directa.
- TIEMPOS: arma la línea de tiempo con las fechas reales (publicación, preguntas, respuestas, cierre, apertura, adjudicación, plazo de entrega o implementación) y di cuánto queda para cada hito y si el plazo de entrega es realista para una pyme.
- MULTAS: cuantifícalas (monto o % por día o por evento, tope, causal) y compáralas con el monto del contrato y el margen probable. Una multa acotada y con tope bajo se asume como parte del negocio y no debe frenar la postulación: dilo con el número. Una multa sin tope, acumulable o por causales vagas es riesgo real: dilo sin rodeos.`;
