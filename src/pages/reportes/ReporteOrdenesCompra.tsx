import { useMemo, useState } from "react";
import {
  useOrdenesCompra,
  useOrdenCompra,
  useSyncMisOC,
  useRutProveedor,
  type OrdenCompra,
  type OrdenesCompraFilters,
} from "@/hooks/useOrdenesCompra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Building2, User, Calendar, Package, Search, X, Download,
  FileSearch, Briefcase, Store, ShoppingCart, Tag, Tags, Layers, CalendarRange, Filter, RefreshCw,
} from "lucide-react";
import { clasificarRubro } from "@/utils/rubroProducto";
import { MultiSelectOC } from "@/components/reportes/MultiSelectOC";
import { ReportHero } from "@/components/reportes/ReportHero";
import { PeriodoSelector } from "@/components/reportes/PeriodoSelector";
import type { PeriodoPreset } from "@/hooks/useBI";
import { formatCurrency, formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import { esTratoDirecto, getTipoOCLabel } from "@/utils/tipoOrdenCompra";
import { descargarOrdenCompraPDF, descargarTopOrdenesCompraPDF } from "@/services/ordenesCompraPdf";
import { useCliente, formatearRUT } from "@/hooks/useCliente";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

// Cada eje del "cubo": clic en un valor filtra TODO el reporte (los otros ejes,
// los KPIs y el detalle) — así se navega la información cruzada, no en tablas
// sueltas. tipo=categoría de compra; el resto habla solo.
type Dim = "categoria" | "tipo" | "institucion" | "proveedor" | "producto" | "mes";
interface CuboFiltro { dim: Dim; value: string; label: string }

const DIM_LABEL: Record<Dim, string> = {
  categoria: "Categoría",
  tipo: "Tipo de compra",
  institucion: "Institución",
  proveedor: "Proveedor",
  producto: "Producto",
  mes: "Mes",
};

// PeriodoPreset -> fecha de corte (desde). "total" no corta.
function desdePreset(p: PeriodoPreset): string | undefined {
  const now = new Date();
  const d = new Date(now);
  switch (p) {
    case "mes": d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
    case "trimestre": d.setMonth(d.getMonth() - 3); return d.toISOString();
    case "12m": d.setMonth(d.getMonth() - 12); return d.toISOString();
    case "ano": return new Date(now.getFullYear(), 0, 1).toISOString();
    default: return undefined; // total
  }
}

interface Fila { key: string; label: string; monto: number; count: number }

export default function ReporteOrdenesCompra() {
  const { data: cliente } = useCliente();

  // Alcance: "Mis OC" (mi RUT como proveedor) es el foco por defecto; "Mercado"
  // abre el buscador libre para explorar/comparar cualquier proveedor u organismo.
  const [alcance, setAlcance] = useState<"mis" | "mercado">("mis");
  // Por defecto "histórico total": el reporte de OC muestra ventas/compras que
  // pueden ser de años atrás; con "últimos 12 meses" se ocultaban órdenes reales
  // y parecía que faltaban datos.
  const [periodo, setPeriodo] = useState<PeriodoPreset>("total");
  const [cubo, setCubo] = useState<CuboFiltro[]>([]);

  // Buscador libre (solo modo Mercado).
  const emptyForm = { search: "", proveedor: "", comprador: "" };
  const [form, setForm] = useState({ ...emptyForm });
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [instituciones, setInstituciones] = useState<string[]>([]);
  const [applied, setApplied] = useState<OrdenesCompraFilters | null>(null);
  const [buscoMercado, setBuscoMercado] = useState(false);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState<string | null>(null);
  const syncMisOC = useSyncMisOC();
  const anioActual = new Date().getFullYear();
  const [anioMisOC, setAnioMisOC] = useState<number>(anioActual);
  const ANIOS = Array.from({ length: 6 }, (_, i) => anioActual - i); // año actual y 5 atrás
  // En Mercado: si hay exactamente 1 proveedor elegido, se puede traer TODAS sus
  // OC del año desde MP (bajo demanda). Resolvemos su RUT desde la base.
  const provSel = alcance === "mercado" && proveedores.length === 1 ? proveedores[0] : null;
  const { data: rutProvSel } = useRutProveedor(provSel);

  const misOC = alcance === "mis";
  const tengoRut = !!cliente?.rut;

  // Filtros que van al backend (RUT propio o búsqueda de mercado) + periodo.
  const filtrosBackend: OrdenesCompraFilters = useMemo(() => {
    const f: OrdenesCompraFilters = {};
    const desde = desdePreset(periodo);
    if (desde) f.fecha_desde = desde;
    if (misOC) {
      if (cliente?.rut) f.proveedor_rut = formatearRUT(cliente.rut);
    } else if (applied) {
      Object.assign(f, applied);
    }
    return f;
  }, [misOC, cliente?.rut, periodo, applied]);

  // En "Mis OC" cargamos apenas hay RUT; en "Mercado" solo tras buscar (evita
  // traer todo el mercado sin filtro).
  const habilitado = misOC ? tengoRut : buscoMercado;
  const { data: ordenes = [], isLoading } = useOrdenesCompra(filtrosBackend, true, { enabled: habilitado });
  const { data: ordenDetalle, isLoading: isLoadingDetalle } = useOrdenCompra(ordenSeleccionada, true);

  // Aplica los filtros del cubo (cruzados) sobre las órdenes traídas.
  const ordenesFiltradas = useMemo(() => {
    if (!cubo.length) return ordenes;
    return ordenes.filter((o) =>
      cubo.every((f) => {
        switch (f.dim) {
          case "tipo": return (o.tipo || "—") === f.value;
          case "institucion": return (o.institucion_nombre || "—") === f.value;
          case "proveedor": return (o.proveedor_nombre || "—") === f.value;
          case "mes": return (o.fecha_creacion?.slice(0, 7) || "—") === f.value;
          case "producto": return (o.items || []).some((i) => i.nombre_producto === f.value);
          case "categoria": return (o.items || []).some((i) => (i.categoria ? i.categoria : clasificarRubro(i.nombre_producto, i.descripcion).id) === f.value);
          default: return true;
        }
      })
    );
  }, [ordenes, cubo]);

  // KPIs del subconjunto activo.
  const kpis = useMemo(() => {
    const monto = ordenesFiltradas.reduce((s, o) => s + (o.total || 0), 0);
    const insts = new Set(ordenesFiltradas.map((o) => o.institucion_nombre).filter(Boolean));
    const n = ordenesFiltradas.length;
    return {
      n,
      monto,
      ticket: n ? monto / n : 0,
      instituciones: insts.size,
    };
  }, [ordenesFiltradas]);

  // Agregaciones por eje (el "cubo"). Producto suma el valor de los ítems.
  const agrupar = (dim: Exclude<Dim, "producto">, labelFn: (o: OrdenCompra) => string): Fila[] => {
    const map = new Map<string, Fila>();
    for (const o of ordenesFiltradas) {
      const key = (dim === "tipo" ? o.tipo : dim === "institucion" ? o.institucion_nombre : dim === "proveedor" ? o.proveedor_nombre : o.fecha_creacion?.slice(0, 7)) || "—";
      const cur = map.get(key) || { key, label: labelFn(o), monto: 0, count: 0 };
      cur.monto += o.total || 0;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.values()];
  };

  const porTipo = useMemo(() => agrupar("tipo", (o) => getTipoOCLabel(o.tipo || "") || "Otro").sort((a, b) => b.monto - a.monto), [ordenesFiltradas]);
  const porInstitucion = useMemo(() => agrupar("institucion", (o) => o.institucion_nombre || "Sin institución").sort((a, b) => b.monto - a.monto), [ordenesFiltradas]);
  const porProveedor = useMemo(() => agrupar("proveedor", (o) => o.proveedor_nombre || "Sin proveedor").sort((a, b) => b.monto - a.monto), [ordenesFiltradas]);
  const porMes = useMemo(() => agrupar("mes", (o) => {
    const m = o.fecha_creacion?.slice(0, 7);
    return m ? format(parseISO(m + "-01"), "MMM yyyy", { locale: es }) : "Sin fecha";
  }, ).sort((a, b) => a.key.localeCompare(b.key)), [ordenesFiltradas]);

  // Categoría = rubro real del producto (clasificado por keywords). El monto
  // suma el valor de los ítems; el conteo son órdenes distintas con ese rubro.
  const porCategoria = useMemo(() => {
    const map = new Map<string, { key: string; label: string; monto: number; ordenes: Set<string> }>();
    for (const o of ordenesFiltradas) {
      for (const it of o.items || []) {
        // Rubro real (Datos Abiertos) si viene; si no, se adivina por keywords.
        const r = it.categoria ? { id: it.categoria, label: it.categoria } : clasificarRubro(it.nombre_producto, it.descripcion);
        const cur = map.get(r.id) || { key: r.id, label: r.label, monto: 0, ordenes: new Set<string>() };
        cur.monto += it.total_neto || 0;
        cur.ordenes.add(o.id);
        map.set(r.id, cur);
      }
    }
    return [...map.values()].map((f) => ({ key: f.key, label: f.label, monto: f.monto, count: f.ordenes.size })).sort((a, b) => b.monto - a.monto);
  }, [ordenesFiltradas]);

  const porProducto = useMemo(() => {
    // count = órdenes DISTINTAS con ese producto (no líneas: una OC puede tener
    // varias líneas del mismo producto y antes se contaban como "órdenes").
    const map = new Map<string, { key: string; label: string; monto: number; ordenes: Set<string> }>();
    for (const o of ordenesFiltradas) {
      for (const it of o.items || []) {
        const key = it.nombre_producto || "Ítem";
        const cur = map.get(key) || { key, label: key, monto: 0, ordenes: new Set<string>() };
        cur.monto += it.total_neto || 0;
        cur.ordenes.add(o.id);
        map.set(key, cur);
      }
    }
    return [...map.values()].map((f) => ({ key: f.key, label: f.label, monto: f.monto, count: f.ordenes.size })).sort((a, b) => b.monto - a.monto);
  }, [ordenesFiltradas]);

  // Toggle de un filtro del cubo (clic en una fila de cualquier eje).
  const toggleCubo = (dim: Dim, value: string, label: string) => {
    setCubo((prev) => {
      const existe = prev.find((f) => f.dim === dim && f.value === value);
      if (existe) return prev.filter((f) => f !== existe);
      // Un valor por eje (clic en otro valor del mismo eje lo reemplaza).
      return [...prev.filter((f) => f.dim !== dim), { dim, value, label }];
    });
  };
  const cuboActivo = (dim: Dim, value: string) => cubo.some((f) => f.dim === dim && f.value === value);

  const buscarMercado = () => {
    const f: OrdenesCompraFilters = {};
    if (form.search.trim()) f.search = form.search.trim();
    if (proveedores.length) f.proveedor_nombres = proveedores;
    if (instituciones.length) f.institucion_nombres = instituciones;
    if (!Object.keys(f).length) { toast.info("Elige un proveedor o institución (o escribe una búsqueda) para explorar el mercado."); return; }
    setApplied(f);
    setBuscoMercado(true);
    setCubo([]);
  };
  const limpiarMercado = () => {
    setForm({ ...emptyForm }); setProveedores([]); setInstituciones([]);
    setApplied(null); setBuscoMercado(false); setCubo([]);
  };

  const actualizarMisOC = async () => {
    const cid = (cliente as any)?.id;
    if (!cid) { toast.error("No encontramos tu cliente. Recarga e intenta de nuevo."); return; }
    try {
      const r = await syncMisOC.mutateAsync({ clienteId: cid, anio: anioMisOC });
      if (!r?.codigo_proveedor) {
        toast.warning("Mercado Público no reconoció tu RUT como proveedor (no encontré tu código). Revisa que el RUT en Mi empresa sea el que usas para vender al Estado.");
      } else if ((r?.encontradas ?? 0) === 0) {
        toast.info(`Identifiqué tu proveedor (código ${r.codigo_proveedor}), pero no tuviste órdenes en ${anioMisOC}. Prueba otro año.`);
      } else {
        toast.success(`Listo: ${r.enriquecidas} de ${r.encontradas} OC de ${anioMisOC} cargadas${r.parcial ? " (año parcial: vuelve a tocar para completar)" : ""}.`);
      }
    } catch (e) {
      toast.error("No pudimos traer tus OC: " + ((e as Error).message || "error"));
    }
  };

  // Mercado: traer TODAS las OC del año del proveedor elegido, desde MP.
  const traerProveedorOC = async () => {
    if (!provSel) return;
    if (!rutProvSel) { toast.error("No tengo el RUT de ese proveedor para consultarlo en Mercado Público."); return; }
    try {
      const r = await syncMisOC.mutateAsync({ rut: rutProvSel, anio: anioMisOC });
      if ((r?.encontradas ?? 0) === 0) {
        toast.info(`${provSel} no tuvo órdenes en ${anioMisOC} (según Mercado Público). Prueba otro año.`);
      } else {
        toast.success(`Listo: ${r.enriquecidas} de ${r.encontradas} OC de ${provSel} en ${anioMisOC}${r.parcial ? " (año parcial: vuelve a tocar)" : ""}.`);
        // Mostrar por RUT exacto (robusto ante variaciones del nombre en MP).
        setApplied({ proveedor_rut: rutProvSel });
        setBuscoMercado(true);
        setCubo([]);
      }
    } catch (e) {
      toast.error("No pudimos traer esas OC: " + ((e as Error).message || "error"));
    }
  };

  const exportarCSV = () => {
    exportToCSV(
      ordenesFiltradas.map((o) => ({
        codigo: o.codigo,
        nombre: o.nombre ?? "",
        tipo: getTipoOCLabel(o.tipo ?? ""),
        proveedor: o.proveedor_nombre ?? "",
        rut_proveedor: o.proveedor_rut ?? "",
        institucion: o.institucion_nombre ?? "",
        rut_institucion: o.institucion_rut ?? "",
        monto_neto: o.total_neto ?? 0,
        total: o.total ?? 0,
        estado: o.estado ?? "",
        fecha: o.fecha_creacion ?? "",
      })),
      misOC ? "mis_ordenes_compra_firmavb" : "ordenes_compra_firmavb"
    );
  };

  const heroKpis = habilitado
    ? [
        { label: "Órdenes", value: formatNumber(kpis.n), icon: FileText },
        { label: "Monto", value: formatCompact(kpis.monto), icon: ShoppingCart },
        { label: "Ticket promedio", value: kpis.n ? formatCompact(kpis.ticket) : "—", icon: Tag },
        { label: "Instituciones", value: formatNumber(kpis.instituciones), icon: Building2 },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Órdenes de compra"
        subtitle="Tu cubo de compras del Estado: cruza tipo, institución, producto y mes. En «Mis OC» ves lo que vendiste; en «Mercado», todo el rubro."
        icon={FileText}
        accent="orange"
        kpis={heroKpis}
        right={<PeriodoSelector value={periodo} onChange={setPeriodo} />}
      />

      {/* Alcance + buscador de mercado */}
      <Card className="border-firmavb-blue/10">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={misOC ? "default" : "outline"}
              onClick={() => setAlcance("mis")}
              className={misOC ? "gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90" : "gap-2"}
            >
              <Briefcase className="h-4 w-4" /> Mis OC
            </Button>
            <Button
              variant={!misOC ? "default" : "outline"}
              onClick={() => setAlcance("mercado")}
              className={!misOC ? "gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90" : "gap-2"}
            >
              <Store className="h-4 w-4" /> Mercado
            </Button>
            {misOC && (
              <Badge variant="secondary" className="ml-1">
                {tengoRut ? `Filtrado por tu RUT ${formatearRUT(cliente!.rut!)}` : "Falta tu RUT"}
              </Badge>
            )}
            <div className="ml-auto flex gap-2">
              {misOC && tengoRut && (
                <>
                  <Select value={String(anioMisOC)} onValueChange={(v) => setAnioMisOC(Number(v))}>
                    <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANIOS.map((y) => <SelectItem key={y} value={String(y)}>Año {y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="gap-2 border-firmavb-blue/30 text-firmavb-blue hover:bg-firmavb-blue/10" onClick={actualizarMisOC} disabled={syncMisOC.isPending}>
                    <RefreshCw className={`h-4 w-4 ${syncMisOC.isPending ? "animate-spin" : ""}`} /> {syncMisOC.isPending ? "Trayendo…" : "Traer mis OC"}
                  </Button>
                </>
              )}
              {provSel && (
                <>
                  <Select value={String(anioMisOC)} onValueChange={(v) => setAnioMisOC(Number(v))}>
                    <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANIOS.map((y) => <SelectItem key={y} value={String(y)}>Año {y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="gap-2 border-firmavb-blue/30 text-firmavb-blue hover:bg-firmavb-blue/10" onClick={traerProveedorOC} disabled={syncMisOC.isPending || !rutProvSel} title={!rutProvSel ? "Sin RUT para este proveedor" : ""}>
                    <RefreshCw className={`h-4 w-4 ${syncMisOC.isPending ? "animate-spin" : ""}`} /> {syncMisOC.isPending ? "Trayendo…" : "Traer sus OC de MP"}
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" className="gap-2" onClick={exportarCSV} disabled={!ordenesFiltradas.length}>
                <FileText className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-2" disabled={!ordenesFiltradas.length}
                onClick={() => descargarTopOrdenesCompraPDF([...ordenesFiltradas].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 20), misOC ? "Mis órdenes de compra" : "Órdenes de compra")}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {misOC && !tengoRut && (
            <p className="text-sm text-amber-700">
              Para ver tus OC necesitamos el RUT de tu empresa. Complétalo en <b>Mi empresa</b> y vuelve aquí.
            </p>
          )}

          {!misOC && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <MultiSelectOC
                campo="proveedor_nombre"
                label="Proveedor (uno o varios)"
                placeholder="Elegir proveedor…"
                values={proveedores}
                onChange={setProveedores}
              />
              <MultiSelectOC
                campo="organismo_comprador"
                label="Institución (una o varias)"
                placeholder="Elegir institución…"
                values={instituciones}
                onChange={setInstituciones}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">Búsqueda libre (código, nombre, RUT)</Label>
                <Input placeholder="Ej: papel, 2591-33-TD26…" value={form.search}
                  onChange={(e) => setForm({ ...form, search: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && buscarMercado()} />
              </div>
              <div className="lg:col-span-3 flex gap-2">
                <Button onClick={buscarMercado} className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"><Search className="h-4 w-4" /> Buscar</Button>
                <Button variant="outline" onClick={limpiarMercado} className="gap-2"><X className="h-4 w-4" /> Limpiar</Button>
              </div>
            </div>
          )}

          {/* Chips del cubo activo */}
          {cubo.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Cruzando por:</span>
              {cubo.map((f) => (
                <Badge key={f.dim + f.value} className="gap-1 bg-firmavb-blue/10 text-firmavb-blue hover:bg-firmavb-blue/20 cursor-pointer"
                  onClick={() => toggleCubo(f.dim, f.value, f.label)}>
                  <span className="opacity-70">{DIM_LABEL[f.dim]}:</span> {f.label} <X className="h-3 w-3" />
                </Badge>
              ))}
              <button className="text-xs text-muted-foreground underline hover:text-foreground" onClick={() => setCubo([])}>Limpiar cruces</button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado vacío */}
      {!habilitado ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-medium">{misOC ? "Cargando tus órdenes…" : "Busca en el mercado"}</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {misOC ? "Apenas tengamos tu RUT verás aquí tus ventas al Estado, cruzables por tipo, institución y producto."
                     : "Escribe un proveedor, institución o palabra y presiona Buscar para explorar el mercado."}
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}</div>
      ) : ordenes.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="font-medium">No hay órdenes para este periodo/filtro</p>
          <p className="text-sm text-muted-foreground mt-1">Prueba ampliar el periodo o cambiar la búsqueda.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Ejes del cubo */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title="Por categoría (rubro)" icon={Tags} filas={porCategoria} dim="categoria"
              activo={cuboActivo} onToggle={toggleCubo} />
            <Breakdown title="Por tipo de compra" icon={Layers} filas={porTipo} dim="tipo"
              activo={cuboActivo} onToggle={toggleCubo} />
            <Breakdown title="Por mes" icon={CalendarRange} filas={porMes} dim="mes"
              activo={cuboActivo} onToggle={toggleCubo} />
            <Breakdown title={misOC ? "A qué instituciones les vendo" : "Por institución (comprador)"} icon={Building2} filas={porInstitucion} dim="institucion"
              activo={cuboActivo} onToggle={toggleCubo} />
            <Breakdown title={misOC ? "Qué productos vendo" : "Por producto"} icon={Package} filas={porProducto} dim="producto"
              activo={cuboActivo} onToggle={toggleCubo} />
            {!misOC && (
              <Breakdown title="Por proveedor (competidores)" icon={User} filas={porProveedor} dim="proveedor"
                activo={cuboActivo} onToggle={toggleCubo} />
            )}
          </div>

          {/* Detalle de las órdenes del cruce actual */}
          <Card className="border-firmavb-blue/10">
            <CardHeader className="pb-3 bg-gradient-to-r from-firmavb-blue/5 to-transparent">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-firmavb-blue" /> Detalle de órdenes
                <Badge variant="secondary">{ordenesFiltradas.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID / Código</TableHead>
                      <TableHead className="font-semibold">Glosa</TableHead>
                      <TableHead className="font-semibold">Institución</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">RUT institución</TableHead>
                      {!misOC && <TableHead className="font-semibold">Proveedor</TableHead>}
                      <TableHead className="font-semibold">Estado</TableHead>
                      <TableHead className="font-semibold whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="font-semibold text-right whitespace-nowrap">Monto neto</TableHead>
                      <TableHead className="font-semibold text-right">Monto</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold text-center">Ver</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...ordenesFiltradas].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 300).map((orden) => (
                      <TableRow key={orden.id} className="hover:bg-firmavb-blue/5 transition-colors">
                        <TableCell className="font-mono text-xs font-medium whitespace-nowrap">{orden.codigo}</TableCell>
                        <TableCell className="max-w-[240px]"><div className="truncate" title={orden.nombre || ""}>{orden.nombre || "Sin nombre"}</div></TableCell>
                        <TableCell><span className="truncate max-w-[180px] block" title={orden.institucion_nombre || ""}>{orden.institucion_nombre || "N/A"}</span></TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{orden.institucion_rut || "—"}</TableCell>
                        {!misOC && <TableCell><span className="truncate max-w-[160px] block" title={orden.proveedor_nombre || ""}>{orden.proveedor_nombre || "N/A"}</span></TableCell>}
                        <TableCell className="text-sm whitespace-nowrap">{orden.estado || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{orden.fecha_creacion ? format(parseISO(orden.fecha_creacion), "dd MMM yyyy", { locale: es }) : "N/A"}</TableCell>
                        <TableCell className="text-right whitespace-nowrap text-sm">{orden.total_neto ? formatCurrency(orden.total_neto) : "—"}</TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{orden.total ? formatCurrency(orden.total) : "N/A"}</TableCell>
                        <TableCell>{esTratoDirecto(orden.tipo) ? <Badge variant="destructive" className="whitespace-nowrap">Trato Directo</Badge> : <Badge variant="outline" className="whitespace-nowrap">{getTipoOCLabel(orden.tipo)}</Badge>}</TableCell>
                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setOrdenSeleccionada(orden.codigo)}>Ver</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh]">
                              <DialogHeader>
                                <div className="flex items-center justify-between gap-2 pr-8">
                                  <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-firmavb-blue" />Detalle de Orden de Compra</DialogTitle>
                                  {ordenDetalle && (
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => descargarOrdenCompraPDF(ordenDetalle)}>
                                      <Download className="h-4 w-4" /> Exportar PDF
                                    </Button>
                                  )}
                                </div>
                              </DialogHeader>
                              <ScrollArea className="max-h-[70vh] pr-4">
                                {isLoadingDetalle ? (
                                  <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
                                ) : ordenDetalle ? <OrdenCompraDetalle orden={ordenDetalle} /> : <p className="text-muted-foreground">No se pudo cargar el detalle</p>}
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {ordenesFiltradas.length > 300 && (
                <p className="text-xs text-muted-foreground p-3 text-center">Mostrando las 300 de mayor monto. Afina con los cruces o exporta el CSV para el total.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Panel de un eje del cubo: top valores con barra proporcional; clic filtra todo.
// -----------------------------------------------------------------------------
function Breakdown({
  title, icon: Icon, filas, dim, activo, onToggle,
}: {
  title: string;
  icon: typeof Package;
  filas: Fila[];
  dim: Dim;
  activo: (dim: Dim, value: string) => boolean;
  onToggle: (dim: Dim, value: string, label: string) => void;
}) {
  const [verTodo, setVerTodo] = useState(false);
  const max = filas.reduce((m, f) => Math.max(m, f.monto), 0) || 1;
  const visibles = verTodo ? filas.slice(0, 50) : filas.slice(0, 8);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-firmavb-blue" /> {title}
          <Badge variant="secondary" className="ml-auto">{filas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>
        ) : (
          <>
            {visibles.map((f) => {
              const on = activo(dim, f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => onToggle(dim, f.key, f.label)}
                  className={`w-full text-left rounded-md px-2.5 py-1.5 transition-colors relative overflow-hidden ${on ? "ring-1 ring-firmavb-blue bg-firmavb-blue/5" : "hover:bg-muted/60"}`}
                  title={f.label}
                >
                  <div className="absolute inset-y-0 left-0 bg-firmavb-blue/10" style={{ width: `${(f.monto / max) * 100}%` }} />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{f.label}</span>
                    <span className="shrink-0 text-sm tabular-nums">{formatCompact(f.monto)}</span>
                  </div>
                  <div className="relative text-[11px] text-muted-foreground">{f.count} {f.count === 1 ? "orden" : "órdenes"}</div>
                </button>
              );
            })}
            {filas.length > 8 && (
              <button className="text-xs text-firmavb-blue hover:underline pt-1" onClick={() => setVerTodo((v) => !v)}>
                {verTodo ? "Ver menos" : `Ver ${Math.min(filas.length, 50) - 8} más`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Detalle de una OC (reutiliza el mismo layout que tenía la pantalla anterior).
// -----------------------------------------------------------------------------
function OrdenCompraDetalle({ orden }: { orden: OrdenCompra }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Información General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">Código</label><p className="font-mono font-medium">{orden.codigo}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Estado</label><div><Badge variant="secondary">{orden.estado || "N/A"}</Badge></div></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.nombre || "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Total</label><p className="font-semibold text-lg">{orden.total ? formatCurrency(orden.total) : "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Tipo</label><div>{esTratoDirecto(orden.tipo) ? <Badge variant="destructive">Trato Directo</Badge> : <Badge variant="outline">{getTipoOCLabel(orden.tipo)}</Badge>}</div></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-firmavb-blue" />Institución</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.institucion_nombre || "N/A"}</p></div>
            {orden.institucion_rut && <div><label className="text-sm font-medium text-muted-foreground">RUT</label><p className="font-mono">{orden.institucion_rut}</p></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-firmavb-blue" />Proveedor</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.proveedor_nombre || "N/A"}</p></div>
            {orden.proveedor_rut && <div><label className="text-sm font-medium text-muted-foreground">RUT</label><p className="font-mono">{orden.proveedor_rut}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-firmavb-blue" />Fechas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">Emisión</label><p>{orden.fecha_creacion ? format(parseISO(orden.fecha_creacion), "dd MMM yyyy HH:mm", { locale: es }) : "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Envío</label><p>{orden.fecha_envio ? format(parseISO(orden.fecha_envio), "dd MMM yyyy HH:mm", { locale: es }) : "N/A"}</p></div>
          </div>
        </CardContent>
      </Card>

      {orden.items && orden.items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-firmavb-blue" />Ítems ({orden.items.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-center">Unidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orden.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[220px]"><div className="truncate" title={item.nombre_producto}>{item.nombre_producto}</div></TableCell>
                      <TableCell className="text-center">{item.cantidad}</TableCell>
                      <TableCell className="text-center">{item.unidad || "-"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{item.precio_unitario_neto ? formatCurrency(item.precio_unitario_neto) : "-"}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{item.total_neto ? formatCurrency(item.total_neto) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
