// Página ADMIN: "Tracción". Clientes nuevos y su activación (inventario, ofertas,
// última conexión) + estado de las campañas en curso (webinar, prospección).
// Solo la ve el admin (AdminOnlyRoute + RPC security-definer). Sirve para saber
// a quién contactar y si el negocio está creciendo o no.
import { useState } from "react";
import { useTraccionResumen, useClientesNuevos, useCampanasResumen } from "@/hooks/useAdminTraccion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Users, Package, FileText, Wifi, Crown, Mail, UserPlus } from "lucide-react";

function fecha(f: string | null): string {
  if (!f) return "s/i";
  return new Date(f).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

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
  const { data: resumen, isLoading: cargandoResumen } = useTraccionResumen();
  const { data: clientes = [], isLoading: cargandoClientes } = useClientesNuevos(dias);
  const { data: campanas, isLoading: cargandoCampanas } = useCampanasResumen();

  const activacionPct = resumen && resumen.clientes_total > 0
    ? Math.round((resumen.activados / resumen.clientes_total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-firmavb-blue" />
        <div>
          <h1 className="text-2xl font-bold">Tracción</h1>
          <p className="text-sm text-muted-foreground">Clientes nuevos, activación y campañas en curso. Solo tú ves esto.</p>
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

      {/* Clientes nuevos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Clientes nuevos</CardTitle>
          <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="14">Últimos 14 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {cargandoClientes ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin registros nuevos en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Se registró</TableHead>
                    <TableHead>Última conexión</TableHead>
                    <TableHead>Busca</TableHead>
                    <TableHead className="text-center">Inventario</TableHead>
                    <TableHead className="text-center">Ofertas</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <p className="font-medium truncate max-w-[180px]">{c.empresa_nombre || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fecha(c.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{fecha(c.last_sign_in_at)}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="flex flex-wrap gap-1">
                          {(c.palabras_clave_busqueda ?? []).slice(0, 4).map((p) => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                          {(c.palabras_clave_busqueda ?? []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {c.items_inventario > 0
                          ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{c.items_inventario}</Badge>
                          : <span className="text-xs text-muted-foreground">no</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.ofertas > 0
                          ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{c.ofertas}</Badge>
                          : <span className="text-xs text-muted-foreground">no</span>}
                      </TableCell>
                      <TableCell><Badge variant={c.plan && c.plan !== "free" ? "default" : "secondary"} className="text-[10px]">{c.plan || "free"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
                {campanas.webinar_por_campana.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Campaña</TableHead><TableHead className="text-center">Total</TableHead><TableHead className="text-center">Enviadas</TableHead><TableHead className="text-center">Pendientes</TableHead><TableHead className="text-center">Bajas</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {campanas.webinar_por_campana.map((w) => (
                          <TableRow key={w.campana}>
                            <TableCell className="font-medium">{w.campana}</TableCell>
                            <TableCell className="text-center">{w.total}</TableCell>
                            <TableCell className="text-center">{w.enviados}</TableCell>
                            <TableCell className="text-center">{w.pendientes}</TableCell>
                            <TableCell className="text-center">{w.bajas}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
    </div>
  );
}
