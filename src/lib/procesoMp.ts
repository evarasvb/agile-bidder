// Link al proceso real en Mercado Público a partir de su código. Solo se
// linkea si el código calza el formato de proceso navegable
// ("algo-números-LETRASdígitos"): hay reclamos/compras con un código fuera de
// ese formato ("3747", "40101701") que no son un proceso navegable. Contra
// datos reales de `ordenes_compra.link_oficial` (que sí guarda el link
// oficial de Mercado Público para muchas órdenes ya scrapeadas): los
// códigos con formato "algo-números-LETRASdígitos" siempre abren en
// DetailsAcquisition.aspx?idlicitacion=, sea licitación, Convenio Marco o
// compra ágil con sufijo distinto a COT; el sufijo "COT" es el único caso
// que usa la ficha de compra-agil.mercadopublico.cl (igual que
// compras_agiles.url_ficha). Un código que no calza ese formato no se
// enlaza: mejor no linkear que llevar a una ficha equivocada o vacía.
export const FORMATO_PROCESO_MP = /^[a-z0-9]+-\d+-[a-z]{1,4}\d{2,4}$/i;

export const linkProcesoMp = (codigo: string): string | null => {
  if (!FORMATO_PROCESO_MP.test(codigo)) return null;
  return /cot/i.test(codigo)
    ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${codigo}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`;
};
