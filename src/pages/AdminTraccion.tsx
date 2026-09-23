// Página ADMIN: "Tracción". Clientes nuevos y su activación (inventario, ofertas,
// última conexión) + estado de las campañas en curso (webinar, prospección).
// Solo la ve el fundador (FounderOnlyRoute + RPC security-definer). Sirve para saber
// a quién contactar y si el negocio está creciendo o no.
import { useState } from "react";
import { useTraccionResumen, useClientesNuevos, useCampanasResumen, useClientesActividad, type ClienteNuevo, type ClienteActividad, type CampanasResumen } from "@/hooks/useAdminTraccion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Package, FileText, Wifi, Crown, Mail, UserPlus, Activity, Pencil } from "lucide-react";
import { GestionClienteDialog } from "@/components/traccion/GestionClienteDialog";

type CampanaWebinar = CampanasResumen["webinar_por_campana"][number];

function fecha(f: string | null): string {
  if (!f) return "s/i";
  return new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const BadgeConteo = ({ n }: { n: number }) =>
  n > 0 ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{n}</Badge> : <span className="text-xs text-muted-foreground">no</span>;

const COLUMNAS_CLIENTES: DataTableColumn<ClienteNuevo>[] = [
  {
    id: "cliente",
    header: "Cliente",
    cell: (c) => (
      <>
        <p className="font-medium truncate max-w-[180px]">{c.empresa_nombre || "—"}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
      </>
    ),
    sortValue: (c) => c.empresa_nombre || c.email,
    exportValue: (c) => [c.empresa_nombre, c.email].filter(Boolean).join(" · "),
  },
  {
    id: "registro",
    header: "Se registró",
    cell: (c) => <span className="whitespace-nowrap text-xs">{fecha(c.created_at)}</span>,
    sortValue: (c) => c.created_at,
    exportValue: (c) => fecha(c.created_at),
  },
  {
    id: "conexion",
    header: "Última conexión",
    cell: (c) => <span className="whitespace-nowrap text-xs">{fecha(c.last_sign_in_at)}</span>,
    sortValue: (c) => c.last_sign_in_at,
    exportValue: (c) => fecha(c.last_sign_in_at),
  },
  {
    id: "busca",
    header: "Busca",
    className: "max-w-[220px]",
    cell: (c) => (
      <div className="flex flex-wrap gap-1">
        {(c.palabras_clave_busqueda ?? []).slice(0, 4).map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
        {(c.palabras_clave_busqueda ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
      </div>
    ),
    sortValue: (c) => (c.palabras_clave_busqueda ?? []).join(", "),
  },
  { id: "inventario", header: "Inventario", align: "center", cell: (c) => <BadgeConteo n={c.items_inventario} />, sortValue: (c) => Number(c.items_inventario || 0) },
  { id: "ofertas", header: "Ofertas", align: "center", cell: (c) => <BadgeConteo n={c.ofertas} />, sortValue: (c) => Number(c.ofertas || 0) },
  {
    id: "plan",
    header: "Plan",
    cell: (c) => <Badge variant={c.plan && c.plan !== "free" ? "default" : "secondary"} className="text-[10px]">{c.plan || "free"}</Badge>,
    sortValue: (c) => c.plan || "free",
  },
];

// "Nunca se conectó" debe ordenar como lo más antiguo (para verlo primero al
// ordenar ascendente), no como vacío al final (así ordena esta tabla por defecto).
const EPOCA = "1970-01-01T00:00:00Z";

// Mismos umbrales para la insignia en pantalla y para el CSV exportado.
function claseActividad(ultima: string | null): "nunca" | "activo" | "poco activo" | "inactivo" {
  if (!ultima) return "nunca";
  const dias = (Date.now() - new Date(ultima).getTime()) / 86_400_000;
  if (dias <= 7) return "activo";
  if (dias <= 30) return "poco activo";
  return "inactivo";
}

function EstadoActividad({ ultima }: { ultima: string | null }) {
  const clase = claseActividad(ultima);
  if (clase === "nunca") return <Badge variant="destructive" className="text-[10px]">nunca</Badge>;
  if (clase === "activo") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">activo</Badge>;
  if (clase === "poco activo") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">poco activo</Badge>;
  return <Badge variant="secondary" className="text-[10px]">inactivo</Badge>;
}

const ESTADO_GESTION_LABEL: Record<string, string> = {
  nuevo: "Nuevo", contactado: "Contactado", en_seguimiento: "En seguimiento",
  activo: "Activo", en_riesgo: "En riesgo", perdido: "Perdido",
};
const ESTADO_GESTION_CLASE: Record<string, string> = {
  nuevo: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  contactado: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  en_seguimiento: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  activo: "bg-green-100 text-green-700 hover:bg-green-100",
  en_riesgo: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  perdido: "bg-red-100 text-red-700 hover:bg-red-100",
};

function EstadoGestion({ estado }: { estado: string }) {
  return <Badge className={`text-[10px] ${ESTADO_GESTION_CLASE[estado] || ESTADO_GESTION_CLASE.nuevo}`}>{ESTADO_GESTION_LABEL[estado] || estado}</Badge>;
}

function columnasActividad(onGestionar: (c: ClienteActividad) => void): DataTableColumn<ClienteActividad>[] {
  return [
  {
    id: "cliente",
    header: "Cliente",
    cell: (c) => (
      <>
        <p className="font-medium truncate max-w-[180px]">{c.empresa_nombre || "—"}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
      </>
    ),
    sortValue: (c) => c.empresa_nombre || c.email,
    exportValue: (c) => [c.empresa_nombre, c.email].filter(Boolean).join(" · "),
  },
  {
    id: "estado",
    header: "Actividad",
    cell: (c) => <EstadoActividad ultima={c.last_sign_in_at} />,
    sortValue: (c) => c.last_sign_in_at ?? EPOCA,
    exportValue: (c) => claseActividad(c.last_sign_in_at),
  },
  {
    id: "conexion",
    header: "Última conexión",
    cell: (c) => <span className="whitespace-nowrap text-xs">{c.last_sign_in_at ? fecha(c.last_sign_in_at) : "Nunca"}</span>,
    sortValue: (c) => c.last_sign_in_at ?? EPOCA,
    exportValue: (c) => (c.last_sign_in_at ? fecha(c.last_sign_in_at) : "Nunca"),
  },
  {
    id: "registro",
    header: "Cliente desde",
    cell: (c) => <span className="whitespace-nowrap text-xs">{fecha(c.created_at)}</span>,
    sortValue: (c) => c.created_at,
    exportValue: (c) => fecha(c.created_at),
  },
  { id: "inventario", header: "Inventario", align: "center", cell: (c) => <BadgeConteo n={c.items_inventario} />, sortValue: (c) => Number(c.items_inventario || 0) },
  { id: "ofertas", header: "Ofertas", align: "center", cell: (c) => <BadgeConteo n={c.ofertas} />, sortValue: (c) => Number(c.ofertas || 0) },
  {
    id: "plan",
    header: "Plan",
    cell: (c) => <Badge variant={c.plan && c.plan !== "free" ? "default" : "secondary"} className="text-[10px]">{c.plan || "free"}</Badge>,
    sortValue: (c) => c.plan || "free",
  },
  {
    id: "gestion",
    header: "Gestión",
    className: "min-w-[180px]",
    cell: (c) => (
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <EstadoGestion estado={c.estado_gestion} />
          {c.proxima_accion && (
            <p className="text-[10px] text-muted-foreground truncate max-w-[160px] mt-0.5">
              {c.proxima_accion}{c.proxima_fecha ? ` · ${fecha(c.proxima_fecha)}` : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onGestionar(c)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    ),
    sortValue: (c) => `${c.prioridad}-${c.estado_gestion}`,
    exportValue: (c) => `${ESTADO_GESTION_LABEL[c.estado_gestion] || c.estado_gestion}${c.proxima_accion ? ` · ${c.proxima_accion}` : ""}`,
  },
  ];
}

const COLUMNAS_CAMPANAS: DataTableColumn<CampanaWebinar>[] = [
  { id: "campana", header: "Campaña", cell: (w) => <span className="font-medium">{w.campana}</span>, sortValue: (w) => w.campana },
  { id: "total", header: "Total", align: "center", cell: (w) => w.total, sortValue: (w) => Number(w.total || 0) },
  { id: "enviadas", header: "Enviadas", align: "center", cell: (w) => w.enviados, sortValue: (w) => Number(w.enviados || 0) },
  { id: "pendientes", header: "Pendientes", align: "center", cell: (w) => w.pendientes, sortValue: (w) => Number(w.pendientes || 0) },
  { id: "bajas", header: "Bajas", align: "center", cell: (w) => w.bajas, sortValue: (w) => Number(w.bajas || 0) },
];

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminTraccion() {
  const [dias, setDias] = useState(30);
  const [clienteGestionando, setClienteGestionando] = useState<ClienteActividad | null>(null);
  const { data: resumen, isLoading: cargandoResumen } = useTraccionResumen();
  const { data: clientes = [], isLoading: cargandoClientes } = useClientesNuevos(dias);
  const { data: campanas, isLoading: cargandoCampanas } = useCampanasResumen();
  const { data: actividad = [], isLoading: cargandoActividad } = useClientesActividad();
  const columnasActividadConGestion = columnasActividad(setClienteGestionando);

  const activacionPct = resumen && resumen.clientes_total > 0
    ? Math.round((resumen.activados / resumen.clientes_total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-firmavb-blue" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">Tracción</h1>
            <Badge variant="secondary">Personal · Enrique</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Área personal del fundador para revisar clientes, activación y campañas en curso.</p>
        </div>
      </div>

      {/* KPIs */}
      {cargandoResumen ? (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !resumen ? (
        <p className="text-sm text-muted-foreground">Sin acceso o sin datos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi icon={Users} label="Clientes totales" value={resumen.clientes_total} />
          <Kpi icon={UserPlus} label="Nuevos 7 días" value={resumen.clientes_7d} />
          <Kpi icon={UserPlus} label="Nuevos 30 días" value={resumen.clientes_30d} />
          <Kpi icon={Package} label="Activados" value={`${activacionPct}%`} sub={`${resumen.activados} de ${resumen.clientes_total} subió inventario`} />
          <Kpi icon={Wifi} label="Conectados 7 días" value={resumen.conectados_7d} />
          <Kpi icon={Crown} label="Plan Pro" value={resumen.plan_pro} />
        </div>
      )}

      {/* Actividad de TODOS los clientes: quién usa el sistema y quién no */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Actividad de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable<ClienteActividad>
            storageKey="traccion-actividad"
            rows={actividad}
            rowKey={(c) => c.id}
            loading={cargandoActividad}
            itemLabel="clientes"
            columns={columnasActividadConGestion}
            searchText={(c) => `${c.empresa_nombre ?? ""} ${c.email ?? ""} ${c.plan ?? ""}`}
            searchPlaceholder="Buscar por empresa, correo o plan…"
            defaultSort={{ id: "conexion", dir: "asc" }}
            exportFileName="clientes-actividad"
            emptyMessage="Sin clientes registrados."
            maxHeight="60vh"
          />
        </CardContent>
      </Card>

      {/* Clientes nuevos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Clientes nuevos</CardTitle></CardHeader>
        <CardContent>
          <DataTable<ClienteNuevo>
            storageKey="traccion-clientes"
            rows={clientes}
            rowKey={(c) => c.id}
            loading={cargandoClientes}
            itemLabel="clientes"
            columns={COLUMNAS_CLIENTES}
            searchText={(c) => `${c.empresa_nombre ?? ""} ${c.email ?? ""} ${(c.palabras_clave_busqueda ?? []).join(" ")} ${c.plan ?? ""}`}
            searchPlaceholder="Buscar por empresa, correo o rubro…"
            defaultSort={{ id: "registro", dir: "desc" }}
            exportFileName={`clientes-nuevos-${dias}d`}
            emptyMessage="Sin registros nuevos en este período."
            maxHeight="60vh"
            toolbar={
              <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
                <SelectTrigger className="w-40 h-10" aria-label="Período"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="14">Últimos 14 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>

      {/* Campañas */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" />Campañas en curso</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {cargandoCampanas ? (
            <Skeleton className="h-32 w-full" />
          ) : !campanas ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium mb-2">Webinar — invitaciones por correo</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-3">
                  <Kpi icon={FileText} label="Pendientes" value={campanas.webinar.pendiente ?? 0} />
                  <Kpi icon={Mail} label="Enviadas" value={campanas.webinar.enviado ?? 0} />
                  <Kpi icon={Users} label="Bajas" value={campanas.webinar.baja ?? 0} />
                </div>
                <DataTable<CampanaWebinar>
                  storageKey="traccion-campanas"
                  rows={campanas.webinar_por_campana}
                  rowKey={(w) => w.campana}
                  itemLabel="campañas"
                  columns={COLUMNAS_CAMPANAS}
                  searchText={(w) => w.campana}
                  searchPlaceholder="Buscar campaña…"
                  defaultSort={{ id: "total", dir: "desc" }}
                  exportFileName="campanas-webinar"
                  emptyMessage="Todavía no hay campañas de webinar."
                  maxHeight="50vh"
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Prospección — {campanas.prospects_total} contactos en el embudo</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(campanas.prospects).sort((a, b) => b[1] - a[1]).map(([estado, n]) => (
                    <Badge key={estado} variant="outline" className="text-xs">{estado}: {n}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <GestionClienteDialog cliente={clienteGestionando} onOpenChange={(open) => !open && setClienteGestionando(null)} />
    </div>
  );
}
