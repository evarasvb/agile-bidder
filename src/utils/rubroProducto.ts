// Clasificación de un producto a un RUBRO (categoría real de producto), para
// agrupar las órdenes de compra "por categoría" — no por tipo de compra. Es
// heurístico por palabras clave: barato, determinista y sin costo de IA. Semilla
// tomada de las industrias del onboarding (misma taxonomía que ya ve el cliente)
// más algunos sinónimos frecuentes en Mercado Público.

export interface Rubro { id: string; label: string }

const norm = (s: string): string =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Orden importa: el primero que calza gana. Los más específicos arriba.
const REGLAS: { id: string; label: string; kw: string[] }[] = [
  { id: "medico", label: "Insumos médicos", kw: ["insumo medico", "clinico", "hospital", "mascarilla", "guante", "jeringa", "medico", "farmac", "medicament", "quirurgic", "sanitizante"] },
  { id: "oficina", label: "Artículos de oficina", kw: ["papel", "resma", "oficina", "utiles", "tinta", "toner", "archivador", "lapiz", "boligrafo", "corchete", "carpeta", "cuaderno", "libreta"] },
  { id: "tecnologia", label: "Tecnología", kw: ["computador", "notebook", "impresora", "software", "licencia", "tecnologia", "servidor", "monitor", "teclado", "mouse", "tablet", "disco", "memoria", "cable de red", "switch", "router", "proyector"] },
  { id: "aseo", label: "Aseo y limpieza", kw: ["aseo", "limpieza", "detergente", "cloro", "papel higienico", "sanitario", "escoba", "trapero", "jabon", "toalla"] },
  { id: "mobiliario", label: "Mobiliario", kw: ["mobiliario", "mueble", "silla", "escritorio", "estante", "repisa", "mesa", "sillon", "kardex", "casillero"] },
  { id: "construccion", label: "Construcción / Ferretería", kw: ["construccion", "ferreteria", "cemento", "herramienta", "pintura", "fierro", "clavo", "tornillo", "madera", "arido"] },
  { id: "automotriz", label: "Automotriz", kw: ["vehiculo", "automotriz", "repuesto", "neumatico", "lubricante", "bateria", "aceite", "filtro"] },
  { id: "textil", label: "Textil / Vestuario", kw: ["vestuario", "textil", "uniforme", "ropa", "calzado", "zapato", "polera", "chaqueta", "buzo"] },
  { id: "alimentos", label: "Alimentos", kw: ["alimento", "abarrote", "comida", "fruta", "verdura", "carne", "leche", "arroz", "bebida", "colacion"] },
  { id: "servicios", label: "Servicios", kw: ["servicio", "mantencion", "contratista", "reparacion", "arriendo", "capacitacion", "asesoria"] },
];

const OTRO: Rubro = { id: "otro", label: "Otros" };

/** Clasifica el nombre (y opcional descripción) de un producto a un rubro. */
export function clasificarRubro(nombre: string, descripcion?: string | null): Rubro {
  const t = norm(`${nombre || ""} ${descripcion || ""}`);
  if (!t) return OTRO;
  for (const r of REGLAS) {
    if (r.kw.some((k) => t.includes(k))) return { id: r.id, label: r.label };
  }
  return OTRO;
}
