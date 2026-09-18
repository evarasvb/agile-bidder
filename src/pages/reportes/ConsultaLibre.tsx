import { useMemo, useState } from "react";
import { Search, Sparkles, X, Download, Boxes, DollarSign, Users, Building2, Layers, Gavel } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn, type DataTableSort } from "@/components/ui/data-table";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCurrency, formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import {
  useCuboConsulta, interpretarPregunta, DIMS_OC, DIMS_LIC, TIPOS_OC, METRICAS_OC, METRICAS_LIC,
  type Fuente, type Dim, type FiltrosCubo, type FilaCubo,
} from "@/hooks/useCubo";

// Consulta libre (tipo QlikView): elige la fuente, cruza dimensiones, filtra y
// haz clic en una fila para profundizar. Sin IA: cada consulta es SQL sobre el cubo.

const ETIQUETA_DIM: Record<string, string> = Object.fromEntries([...DIMS_OC, ...DIMS_LIC].map((d) => [d.id, d.label]));
const ETIQUETA_TIPO: Record<string, string> = Object.fromEntries(TIPOS_OC.map((t) => [t.valor, t.label]));

const ETIQUETA_FILTRO: Record<keyof FiltrosCubo, string> = {
  tipo: "Tipo", texto: "Busca", producto: "Producto", proveedor: "Proveedor", rut_proveedor: "RUT proveedor",
  organismo: "Institución", rut_organismo: "RUT institución", categoria: "Categoría", precio_min: "Precio ≥", precio_max: "Precio ≤",
  comprador: "Comprador", comprador_rut: "RUT comprador", adjudicatario: "Adjudicatario", rut_adjudicatario: "RUT adjudicatario",
  rubro: "Rubro", metodo: "Método",
};

const fmtMes = (v: unknown) => {
  if (!v) return "—";
  const [y, m] = String(v).split("-");
  return `${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][Number(m) - 1] ?? m} ${y}`;
};
const num = (v: unknown) => (v == null ? null : Number(v));
const pesos = (v: unknown) => (v == null ? "—" : formatCurrency(Math.round(Number(v))));

// Al hacer clic en un valor de dimensión se convierte en filtro (drill-down).
const FILTRO_DE_DIM: Partial<Record<Dim, keyof FiltrosCubo>> = {
  producto: "producto", proveedor: "proveedor", organismo: "organismo", categoria: "categoria", tipo: "tipo",
  comprador: "comprador", adjudicatario: "adjudicatario", rubro: "rubro", metodo: "metodo", titulo: "texto",
};

const EJEMPLOS = [
  "convenio marco por proveedor",
  "quién compra resmas de papel",
  "top 20 instituciones que compran notebooks",
  "compra ágil por mes 2026",
  "licitaciones por adjudicatario rubro construcción",
];

export default function ConsultaLibre() {
  const [fuente, setFuente] = useState<Fuente>("oc");
  const [dims, setDims] = useState<Dim[]>(["proveedor"]);
  const [filtros, setFiltros] = useState<FiltrosCubo>({ tipo: "Convenio Marco" });
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [sort, setSort] = useState<DataTableSort | null>({ id: "monto", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pregunta, setPregunta] = useState("");
  const [explicacion, setExplicacion] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Partial<Record<keyof FiltrosCubo, string>>>({});

  const metricas = fuente === "oc" ? METRICAS_OC : METRICAS_LIC;
  const orden = sort && metricas.includes(sort.id) ? sort.id : "monto";
  const desc = sort ? sort.dir === "desc" : true;

  const consulta = useMemo(() => ({
    fuente, dims, filtros, desde: desde || null, hasta: hasta || null, orden, desc, limite: pageSize, offset: (page - 1) * pageSize,
  }), [fuente, dims, filtros, desde, hasta, orden, desc, page, pageSize]);
  const { data, isLoading, isFetching, error } = useCuboConsulta(consulta);

  const reiniciarPagina = () => setPage(1);

  const cambiarFuente = (f: Fuente) => {
    setFuente(f);
    setDims([f === "oc" ? "proveedor" : "adjudicatario"]);
    setFiltros(f === "oc" ? { tipo: "Convenio Marco" } : {});
    setSort({ id: "monto", dir: "desc" });
    setExplicacion(null);
    reiniciarPagina();
  };

  const alternarDim = (d: Dim) => {
    setDims((prev) => (prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d]));
    reiniciarPagina();
  };

  const ponerFiltro = (k: keyof FiltrosCubo, v: string | number | undefined) => {
    setFiltros((prev) => {
      const n = { ...prev };
      if (v === undefined || v === "" || v === null) delete n[k]; else (n as Record<string, unknown>)[k] = v;
      return n;
    });
    reiniciarPagina();
  };

  const profundizar = (dim: Dim, valor: string | number | null) => {
    if (valor == null) return;
    if (dim === "mes") { setDesde(String(valor)); setHasta(String(valor)); }
    else { const k = FILTRO_DE_DIM[dim]; if (k) ponerFiltro(k, String(valor)); }
    setDims((prev) => {
      const sin = prev.filter((d) => d !== dim);
      if (sin.length) return sin;
      const siguiente: Dim = fuente === "oc" ? (dim === "producto" ? "proveedor" : "producto") : (dim === "adjudicatario" ? "comprador" : "adjudicatario");
      return [siguiente];
    });
    reiniciarPagina();
  };

  const interpretar = () => {
    if (!pregunta.trim()) return;
    const r = interpretarPregunta(pregunta, fuente);
    setFuente(r.fuente);
    setDims(r.dims);
    setFiltros(r.filtros);
    setDesde(r.desde ?? "");
    setHasta(r.hasta ?? "");
    setSort({ id: r.orden, dir: "desc" });
    setPageSize(Math.min(100, r.limite));
    setExplicacion(r.explicacion);
    reiniciarPagina();
  };

  const limpiar = () => {
    setFiltros(fuente === "oc" ? { tipo: "Convenio Marco" } : {});
    setDesde(""); setHasta(""); setPregunta(""); setExplicacion(null); setBorrador({});
    reiniciarPagina();
  };

  const columnas = useMemo<DataTableColumn<FilaCubo>[]>(() => {
    const cols: DataTableColumn<FilaCubo>[] = dims.map((d) => ({
      id: d,
      header: ETIQUETA_DIM[d] ?? d,
      className: "max-w-[280px]",
      sortValue: (r) => (r[d] == null ? null : String(r[d])),
      exportValue: (r) => (d === "mes" ? fmtMes(r[d]) : d === "tipo" ? (ETIQUETA_TIPO[String(r[d])] ?? String(r[d] ?? "")) : String(r[d] ?? "")),
      cell: (r) => (
        <button
          type="button"
          onClick={() => profundizar(d, r[d])}
          title="Profundizar en este valor"
          className="text-left hover:underline line-clamp-2 text-firmavb-blue"
        >
          {d === "mes" ? fmtMes(r[d]) : d === "tipo" ? (ETIQUETA_TIPO[String(r[d])] ?? r[d]) : (r[d] ?? "—")}
        </button>
      ),
    }));
    const total = Number(data?.totales?.monto ?? 0);
    const m = (id: string, header: string, cell: (r: FilaCubo) => string, align: "right" = "right"): DataTableColumn<FilaCubo> => ({
      id, header, align, className: "font-mono whitespace-nowrap", sortValue: (r) => num(r[id]), exportValue: (r) => r[id] == null ? "" : String(r[id]), cell,
    });
    if (fuente === "oc") {
      cols.push(
        m("monto", "Monto", (r) => pesos(r.monto)),
        m("participacion", "% del total", (r) => (total > 0 && r.monto != null ? `${(100 * Number(r.monto) / total).toFixed(1)}%` : "—")),
        m("lineas", "Líneas", (r) => formatNumber(Number(r.lineas ?? 0))),
        m("cantidad", "Unidades", (r) => formatNumber(Math.round(Number(r.cantidad ?? 0)))),
        m("precio_min", "Precio mín.", (r) => pesos(r.precio_min)),
        m("precio_med", "Precio mediano", (r) => pesos(r.precio_med)),
        m("precio_max", "Precio máx.", (r) => pesos(r.precio_max)),
        m("proveedores", "Proveedores", (r) => formatNumber(Number(r.proveedores ?? 0))),
        m("organismos", "Instituciones", (r) => formatNumber(Number(r.organismos ?? 0))),
        m("productos", "Productos", (r) => formatNumber(Number(r.productos ?? 0))),
      );
    } else {
      cols.push(
        m("monto", "Monto adjudicado", (r) => pesos(r.monto)),
        m("participacion", "% del total", (r) => (total > 0 && r.monto != null ? `${(100 * Number(r.monto) / total).toFixed(1)}%` : "—")),
        m("procesos", "Licitaciones", (r) => formatNumber(Number(r.procesos ?? 0))),
        m("adjudicaciones", "Adjudicaciones", (r) => formatNumber(Number(r.adjudicaciones ?? 0))),
        m("monto_estimado", "Presupuesto", (r) => pesos(r.monto_estimado)),
        m("pct_del_estimado", "% del presupuesto", (r) => (r.pct_del_estimado == null ? "—" : `${r.pct_del_estimado}%`)),
        m("oferentes", "Oferentes prom.", (r) => (r.oferentes == null ? "—" : String(r.oferentes))),
        m("compradores", "Compradores", (r) => formatNumber(Number(r.compradores ?? 0))),
        m("adjudicatarios", "Adjudicatarios", (r) => formatNumber(Number(r.adjudicatarios ?? 0))),
      );
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, fuente, data?.totales?.monto]);

  const filas = useMemo(() => (data?.filas ?? []).map((r, i) => ({ ...r, __k: `${(page - 1) * pageSize + i}` })), [data, page, pageSize]);
  const t = data?.totales ?? {};
  const kpis = fuente === "oc"
    ? [
        { label: "Monto", value: t.monto != null ? formatCompact(Number(t.monto)) : "…", icon: DollarSign },
        { label: "Líneas de OC", value: t.lineas != null ? formatNumber(Number(t.lineas)) : "…", icon: Layers },
        { label: "Proveedores", value: t.proveedores != null ? formatNumber(Number(t.proveedores)) : "…", icon: Users },
        { label: "Instituciones", value: t.organismos != null ? formatNumber(Number(t.organismos)) : "…", icon: Building2 },
      ]
    : [
        { label: "Adjudicado", value: t.monto != null ? formatCompact(Number(t.monto)) : "…", icon: DollarSign },
        { label: "Licitaciones", value: t.procesos != null ? formatNumber(Number(t.procesos)) : "…", icon: Gavel },
        { label: "Adjudicatarios", value: t.adjudicatarios != null ? formatNumber(Number(t.adjudicatarios)) : "…", icon: Users },
        { label: "Compradores", value: t.compradores != null ? formatNumber(Number(t.compradores)) : "…", icon: Building2 },
      ];

  const filtrosActivos = (Object.entries(filtros) as [keyof FiltrosCubo, string | number][]).filter(([, v]) => v !== undefined && v !== "");
  const listaDims = fuente === "oc" ? DIMS_OC : DIMS_LIC;
  const camposFiltro: { k: keyof FiltrosCubo; ph: string }[] = fuente === "oc"
    ? [{ k: "producto", ph: "Producto (contiene)" }, { k: "proveedor", ph: "Proveedor" }, { k: "organismo", ph: "Institución" }, { k: "categoria", ph: "Categoría" }]
    : [{ k: "texto", ph: "Licitación (título)" }, { k: "adjudicatario", ph: "Adjudicatario" }, { k: "comprador", ph: "Comprador" }, { k: "rubro", ph: "Rubro" }];

  return (
    <div className="space-y-4 pb-24">
      <ReportHero
        title="Consulta libre"
        subtitle="Cruza proveedores, instituciones, productos, precios y meses. Órdenes de compra por Convenio Marco, Compra Ágil y Trato Directo, o licitaciones adjudicadas. Haz clic en cualquier valor para profundizar."
        icon={Boxes}
        accent="celeste"
        kpis={kpis}
      />

      {/* Pregunta en lenguaje natural (intérprete local, sin IA) */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") interpretar(); }}
                placeholder='Pregunta: "convenio marco por proveedor", "quién compra resmas de papel", "top 20 instituciones que compran notebooks"'
                className="pl-9"
              />
            </div>
            <Button onClick={interpretar} className="bg-firmavb-blue hover:bg-firmavb-blue/90"><Search className="h-4 w-4 mr-1.5" /> Consultar</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {explicacion ? <span>Entendí: <strong className="text-foreground">{explicacion}</strong></span> : <span>Ejemplos:</span>}
            {!explicacion && EJEMPLOS.map((e) => (
              <button key={e} type="button" onClick={() => { setPregunta(e); }} className="rounded-full border px-2 py-0.5 hover:bg-muted">{e}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fuente, tipo y dimensiones */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border p-0.5">
              <button type="button" onClick={() => cambiarFuente("oc")} className={`px-3 py-1.5 text-sm rounded-md ${fuente === "oc" ? "bg-firmavb-blue text-white" : "hover:bg-muted"}`}>Órdenes de compra</button>
              <button type="button" onClick={() => cambiarFuente("lic")} className={`px-3 py-1.5 text-sm rounded-md ${fuente === "lic" ? "bg-firmavb-blue text-white" : "hover:bg-muted"}`}>Licitaciones adjudicadas</button>
            </div>
            {fuente === "oc" && (
              <Select value={filtros.tipo ?? "todos"} onValueChange={(v) => ponerFiltro("tipo", v === "todos" ? undefined : v)}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Tipo de compra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS_OC.map((tp) => <SelectItem key={tp.valor} value={tp.valor}>{tp.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input type="month" value={desde} onChange={(e) => { setDesde(e.target.value ? e.target.value + "-01" : ""); reiniciarPagina(); }} className="w-[150px]" title="Desde" />
            <Input type="month" value={hasta} onChange={(e) => { setHasta(e.target.value ? e.target.value + "-01" : ""); reiniciarPagina(); }} className="w-[150px]" title="Hasta" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Agrupar por:</span>
            {listaDims.map((d) => {
              const activo = dims.includes(d.id);
              const pos = dims.indexOf(d.id);
              return (
                <button key={d.id} type="button" onClick={() => alternarDim(d.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${activo ? "bg-firmavb-blue text-white border-firmavb-blue" : "hover:bg-muted"}`}>
                  {activo && dims.length > 1 ? `${pos + 1}. ` : ""}{d.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {camposFiltro.map(({ k, ph }) => (
              <Input
                key={k}
                value={borrador[k] ?? (filtros[k] as string | undefined) ?? ""}
                onChange={(e) => setBorrador((b) => ({ ...b, [k]: e.target.value }))}
                onBlur={() => { if (borrador[k] !== undefined) { ponerFiltro(k, borrador[k]); setBorrador((b) => { const n = { ...b }; delete n[k]; return n; }); } }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder={ph}
              />
            ))}
          </div>

          {(filtrosActivos.length > 0 || desde || hasta) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {filtrosActivos.map(([k, v]) => (
                <Badge key={k} variant="secondary" className="gap-1 font-normal">
                  {ETIQUETA_FILTRO[k]}: {k === "tipo" ? (ETIQUETA_TIPO[String(v)] ?? v) : v}
                  <button type="button" onClick={() => ponerFiltro(k, undefined)} aria-label={`Quitar filtro ${ETIQUETA_FILTRO[k]}`}><X className="h-3 w-3" /></button>
                </Badge>
              ))}
              {(desde || hasta) && (
                <Badge variant="secondary" className="gap-1 font-normal">
                  {desde ? fmtMes(desde) : "…"} → {hasta ? fmtMes(hasta) : "…"}
                  <button type="button" onClick={() => { setDesde(""); setHasta(""); reiniciarPagina(); }} aria-label="Quitar período"><X className="h-3 w-3" /></button>
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={limpiar} className="h-6 px-2 text-xs">Limpiar todo</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">No pude consultar el cubo: {String((error as Error).message ?? error)}</p>}

      <DataTable<FilaCubo & { __k: string }>
        columns={columnas as DataTableColumn<FilaCubo & { __k: string }>[]}
        rows={filas}
        rowKey={(r) => r.__k}
        loading={isLoading || isFetching}
        emptyMessage="Sin resultados para esta combinación. Prueba con menos filtros."
        itemLabel="filas"
        storageKey="cubo-consulta-libre"
        exportFileName={`consulta-${fuente}-${dims.join("-")}`}
        manual={{
          total: data?.total_filas ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (n) => { setPageSize(n); setPage(1); },
          sort,
          onSortChange: (s) => { if (!s || metricas.includes(s.id)) { setSort(s); setPage(1); } },
        }}
        toolbar={
          <Button variant="outline" size="sm" onClick={() => exportToCSV(filas.map(({ __k, ...r }) => r), `consulta-${fuente}-${dims.join("-")}`)}>
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
        }
      />
    </div>
  );
}
