import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Las RPC del cubo aún no están en los tipos generados: cliente sin tipar para estas dos llamadas.
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

// Cubo de consulta de ventas al Estado: órdenes de compra (Convenio Marco, Compra
// Ágil, Trato Directo…) y licitaciones adjudicadas. Todo se resuelve en SQL sobre
// vistas materializadas: ninguna pregunta gasta tokens de IA.

export type Fuente = "oc" | "lic";
export type DimOC = "mes" | "tipo" | "categoria" | "producto" | "proveedor" | "organismo";
export type DimLic = "mes" | "comprador" | "adjudicatario" | "rubro" | "metodo" | "titulo" | "codigo";
export type Dim = DimOC | DimLic;

export interface FiltrosCubo {
  tipo?: string;
  texto?: string;
  producto?: string;
  proveedor?: string;
  rut_proveedor?: string;
  organismo?: string;
  rut_organismo?: string;
  categoria?: string;
  precio_min?: number;
  precio_max?: number;
  comprador?: string;
  comprador_rut?: string;
  adjudicatario?: string;
  rut_adjudicatario?: string;
  rubro?: string;
  metodo?: string;
}

export interface ConsultaCubo {
  fuente: Fuente;
  dims: Dim[];
  filtros: FiltrosCubo;
  desde?: string | null;
  hasta?: string | null;
  orden: string;
  desc: boolean;
  limite: number;
  offset: number;
}

export type FilaCubo = Record<string, string | number | null>;

export interface ResultadoCubo {
  total_filas: number;
  totales: Record<string, number | null>;
  filas: FilaCubo[];
}

export const DIMS_OC: { id: DimOC; label: string }[] = [
  { id: "producto", label: "Producto" },
  { id: "proveedor", label: "Proveedor" },
  { id: "organismo", label: "Institución" },
  { id: "categoria", label: "Categoría" },
  { id: "tipo", label: "Tipo de compra" },
  { id: "mes", label: "Mes" },
];

export const DIMS_LIC: { id: DimLic; label: string }[] = [
  { id: "adjudicatario", label: "Adjudicatario" },
  { id: "comprador", label: "Comprador" },
  { id: "rubro", label: "Rubro" },
  { id: "metodo", label: "Método" },
  { id: "mes", label: "Mes" },
  { id: "titulo", label: "Licitación" },
];

// Etiquetas amigables de los tipos de OC tal como vienen de Mercado Público.
export const TIPOS_OC: { valor: string; label: string }[] = [
  { valor: "Convenio Marco", label: "Convenio Marco" },
  { valor: "Compra Ágil", label: "Compra Ágil" },
  { valor: "Sin emisión automática", label: "Licitación (OC manual)" },
  { valor: "Proveniente de Ficha de Trato Directo", label: "Trato Directo" },
  { valor: "Compra Coordinada", label: "Compra Coordinada" },
];

export const METRICAS_OC = ["monto", "lineas", "cantidad", "precio_min", "precio_med", "precio_max", "proveedores", "organismos", "productos"];
export const METRICAS_LIC = ["monto", "procesos", "adjudicaciones", "monto_estimado", "oferentes", "compradores", "adjudicatarios", "pct_del_estimado"];

export function useCuboConsulta(c: ConsultaCubo, enabled = true) {
  return useQuery({
    queryKey: ["cubo", c],
    queryFn: async () => {
      const { data, error } = await db.rpc("cubo_consultar", {
        p_fuente: c.fuente,
        p_dims: c.dims,
        p_filtros: c.filtros,
        p_desde: c.desde ?? null,
        p_hasta: c.hasta ?? null,
        p_orden: c.orden,
        p_desc: c.desc,
        p_limite: c.limite,
        p_offset: c.offset,
      });
      if (error) throw error;
      return (data ?? { total_filas: 0, totales: {}, filas: [] }) as ResultadoCubo;
    },
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useCuboOpciones(fuente: Fuente, dim: string, texto: string, tipo?: string) {
  return useQuery({
    queryKey: ["cubo-opciones", fuente, dim, texto, tipo ?? null],
    queryFn: async () => {
      const { data, error } = await db.rpc("cubo_opciones", { p_fuente: fuente, p_dim: dim, p_texto: texto, p_tipo: tipo ?? null, p_limite: 12 });
      if (error) throw error;
      return (data ?? []) as { valor: string; monto: number }[];
    },
    enabled: texto.trim().length >= 2,
    staleTime: 10 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Intérprete de preguntas en lenguaje natural, determinista y sin IA.
// "ventas de convenio marco por proveedor en marzo", "quién compra resmas de papel",
// "top 20 instituciones que compran notebooks", "76.123.456-7 por producto 2026".
// ---------------------------------------------------------------------------
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const RE_RUT = /\b(\d{1,2}\.?\d{3}\.?\d{3})-?([\dkK])\b/;
const STOP = new Set(["de", "del", "la", "el", "los", "las", "en", "por", "con", "para", "que", "qué", "quien", "quién", "cuanto", "cuánto", "cuanta", "cuánta", "cuantos", "cuántos", "cuantas", "cuántas", "vende", "venden", "vendio", "vendió", "compra", "compran", "compro", "compró", "ventas", "venta", "compras", "muestra", "muestrame", "muéstrame", "dame", "ver", "lista", "listar", "y", "o", "a", "al", "un", "una", "unos", "unas", "mas", "más", "menos", "este", "esta", "año", "ano", "mes", "meses", "ultimo", "último", "ultimos", "últimos", "top", "ranking", "todo", "todos", "toda", "todas", "cuales", "cuáles", "cual", "cuál", "son", "es", "hay", "estado", "mercado", "publico", "público", "se", "le", "les", "quienes", "quiénes"]);

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// En la base los RUT vienen como "76.508.518-7": normalizamos a ese formato.
const limpiarRut = (s: string) => {
  const d = s.replace(/[^0-9kK]/g, "").toUpperCase();
  const cuerpo = d.slice(0, -1), dv = d.slice(-1);
  return `${Number(cuerpo).toLocaleString("es-CL")}-${dv}`.replace(/\s/g, "");
};

export interface Interpretacion {
  fuente: Fuente;
  dims: Dim[];
  filtros: FiltrosCubo;
  desde?: string | null;
  hasta?: string | null;
  orden: string;
  limite: number;
  explicacion: string;
}

export function interpretarPregunta(pregunta: string, fuenteActual: Fuente): Interpretacion {
  const q = normalizar(pregunta).trim();
  let fuente: Fuente = fuenteActual;
  const filtros: FiltrosCubo = {};
  const dims: Dim[] = [];
  let orden = "monto";
  let limite = 50;
  let desde: string | null = null;
  let hasta: string | null = null;
  const notas: string[] = [];
  let resto = " " + q + " ";

  const quitar = (re: RegExp, nota?: string) => {
    if (re.test(resto)) { resto = resto.replace(re, " "); if (nota) notas.push(nota); return true; }
    return false;
  };

  // Fuente y tipo de compra
  if (quitar(/\b(licitacion(es)?|adjudicad[oa]s?|adjudicacion(es)?)\b/g, "licitaciones adjudicadas")) fuente = "lic";
  if (quitar(/\bconvenio(s)? marco\b/g, "Convenio Marco")) { fuente = "oc"; filtros.tipo = "Convenio Marco"; }
  else if (quitar(/\bcompras? agil(es)?\b/g, "Compra Ágil")) { fuente = "oc"; filtros.tipo = "Compra Ágil"; }
  else if (quitar(/\btratos? directos?\b/g, "Trato Directo")) { fuente = "oc"; filtros.tipo = "Proveniente de Ficha de Trato Directo"; }
  else if (quitar(/\bcompras? coordinadas?\b/g, "Compra Coordinada")) { fuente = "oc"; filtros.tipo = "Compra Coordinada"; }
  else if (quitar(/\bordenes? de compra\b/g)) fuente = "oc";

  // Top N
  const top = resto.match(/\btop\s*(\d{1,3})\b/);
  if (top) { limite = Math.min(500, Math.max(5, Number(top[1]))); quitar(/\btop\s*\d{1,3}\b/g); }

  // Fechas: año, mes, "últimos N meses"
  const ult = resto.match(/\bultimos?\s+(\d{1,2})\s+mes(es)?\b/);
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (ult) {
    const n = Number(ult[1]);
    desde = iso(new Date(hoy.getFullYear(), hoy.getMonth() - n + 1, 1));
    quitar(/\bultimos?\s+\d{1,2}\s+mes(es)?\b/g, `últimos ${n} meses`);
  }
  if (quitar(/\beste mes\b/g, "este mes")) { desde = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); hasta = desde; }
  const anio = resto.match(/\b(20\d{2})\b/);
  let anioNum = anio ? Number(anio[1]) : null;
  const mesIdx = MESES.findIndex((m) => new RegExp(`\\b${m}\\b`).test(resto));
  if (mesIdx >= 0) {
    const y = anioNum ?? hoy.getFullYear();
    desde = iso(new Date(y, mesIdx, 1)); hasta = desde;
    quitar(new RegExp(`\\b${MESES[mesIdx]}\\b`, "g"), `${MESES[mesIdx]} ${y}`);
    quitar(/\b20\d{2}\b/g); anioNum = null;
  }
  if (anioNum) { desde = `${anioNum}-01-01`; hasta = `${anioNum}-12-01`; quitar(/\b20\d{2}\b/g, `año ${anioNum}`); }

  // RUT → proveedor (OC) o adjudicatario (licitaciones)
  const rut = resto.match(RE_RUT);
  if (rut) {
    const r = limpiarRut(rut[0]);
    if (fuente === "lic") filtros.rut_adjudicatario = r; else filtros.rut_proveedor = r;
    quitar(RE_RUT, `RUT ${rut[0]}`);
  }

  // Dimensiones pedidas ("por proveedor", "por institución", "quién compra", "quién vende")
  const pedir = (d: Dim) => { if (!dims.includes(d)) dims.push(d); };
  if (fuente === "oc") {
    if (quitar(/\b(por|segun|cada)\s+(proveedor(es)?|vendedor(es)?|empresas?)\b/g) || /\bquien(es)?\s+(le\s+)?vende/.test(q)) pedir("proveedor");
    if (quitar(/\b(por|segun|cada)\s+(institucion(es)?|organismos?|compradores?|municipalidad(es)?|servicios?|ministerios?|hospital(es)?)\b/g) || /\bquien(es)?\s+(le\s+)?compra/.test(q)) pedir("organismo");
    if (quitar(/\b(por|segun|cada)\s+(productos?|articulos?|items?)\b/g) || /\bque\s+(se\s+)?(vende|compra)/.test(q)) pedir("producto");
    if (quitar(/\b(por|segun|cada)\s+(categorias?|rubros?)\b/g)) pedir("categoria");
    if (quitar(/\b(por|segun|cada)\s+(tipos?( de compra)?|modalidad(es)?)\b/g)) pedir("tipo");
    if (quitar(/\b(por|segun|cada)\s+mes(es)?\b|\bmensual(es)?\b|\bevolucion\b|\btendencia\b/g)) pedir("mes");
  } else {
    if (quitar(/\b(por|segun|cada)\s+(adjudicatarios?|proveedor(es)?|ganador(es)?|empresas?)\b/g) || /\bquien(es)?\s+(se\s+)?(gana|adjudic)/.test(q)) pedir("adjudicatario");
    if (quitar(/\b(por|segun|cada)\s+(compradores?|institucion(es)?|organismos?|municipalidad(es)?)\b/g) || /\bquien(es)?\s+licita/.test(q)) pedir("comprador");
    if (quitar(/\b(por|segun|cada)\s+(rubros?|categorias?)\b/g)) pedir("rubro");
    if (quitar(/\b(por|segun|cada)\s+(metodos?|tipos?)\b/g)) pedir("metodo");
    if (quitar(/\b(por|segun|cada)\s+mes(es)?\b|\bmensual(es)?\b|\bevolucion\b|\btendencia\b/g)) pedir("mes");
  }
  quitar(/\bquien(es)?\s+(le\s+|se\s+)?(vende|compra|gana|adjudica|licita)\w*\b/g);
  quitar(/\bque\s+(se\s+)?(vende|compra)\w*\b/g);

  // Métrica de orden
  if (quitar(/\b(mas caro|precio(s)? (alto|mayor)|mayor precio)\b/g, "ordenado por precio")) orden = "precio_med";
  else if (quitar(/\b(mas barato|precio(s)? (bajo|menor)|menor precio)\b/g, "ordenado por precio")) orden = "precio_med";
  else if (quitar(/\b(cantidad(es)?|unidades|volumen)\b/g, "ordenado por cantidad")) orden = fuente === "oc" ? "cantidad" : "procesos";
  else if (quitar(/\b(oferentes|competencia)\b/g, "ordenado por oferentes")) orden = fuente === "lic" ? "oferentes" : "proveedores";

  // Texto entre comillas → producto exacto (contiene)
  const entreComillas = pregunta.match(/["“”']([^"“”']{2,})["“”']/);
  if (entreComillas) {
    if (fuente === "oc") filtros.producto = entreComillas[1].trim(); else filtros.texto = entreComillas[1].trim();
    resto = resto.replace(normalizar(entreComillas[1]), " ");
    notas.push(`"${entreComillas[1].trim()}"`);
  }

  // Lo que queda son palabras de búsqueda libre (producto, proveedor o institución)
  const palabras = resto.split(/\s+/).map((w) => w.replace(/[^a-z0-9ñ]/g, "")).filter((w) => w.length > 2 && !STOP.has(w));
  if (palabras.length && !filtros.producto && !filtros.texto) {
    filtros.texto = palabras.slice(0, 4).join(" ");
    notas.push(`busca "${filtros.texto}"`);
  }

  if (!dims.length) dims.push(fuente === "oc" ? (filtros.rut_proveedor ? "producto" : "proveedor") : "adjudicatario");

  return {
    fuente, dims, filtros, desde, hasta, orden, limite,
    explicacion: `${fuente === "oc" ? "Órdenes de compra" : "Licitaciones adjudicadas"} · por ${dims.join(" y ")}${notas.length ? " · " + notas.join(" · ") : ""}`,
  };
}
