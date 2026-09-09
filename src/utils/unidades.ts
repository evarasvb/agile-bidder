// Traduce los códigos de unidad de medida que entrega Mercado Público (en inglés:
// EA = each, BX = box, etc.) a algo legible en español. Si no conocemos el código,
// se devuelve tal cual (pero limpio), para no romper nada.
const UNIDADES: Record<string, string> = {
  EA: "un.",          // each
  UN: "un.",
  UND: "un.",
  UNID: "un.",
  C62: "un.",         // código ONU para "unidad"
  PZ: "un.",
  PCE: "un.",
  BX: "caja",
  CJ: "caja",
  BG: "bolsa",
  PK: "paquete",
  PAC: "paquete",
  PA: "paquete",
  SET: "set",
  KIT: "kit",
  RES: "resma",
  RM: "resma",
  KG: "kg",
  GR: "g",
  G: "g",
  LT: "L",
  L: "L",
  ML: "ml",
  MT: "m",
  M: "m",
  CM: "cm",
  MM: "mm",
  M2: "m²",
  M3: "m³",
  DOC: "docena",
  DZ: "docena",
  ROL: "rollo",
  RL: "rollo",
  TAM: "tambor",
  GL: "galón",
};

export function unidadLabel(codigo?: string | null): string {
  const c = String(codigo || "").trim();
  if (!c) return "un.";
  return UNIDADES[c.toUpperCase()] || c;
}
