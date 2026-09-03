import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  DollarSign, 
  Percent, 
  FileText, 
  CreditCard, 
  Download, 
  Search,
  Calendar,
  Plus,
  Receipt
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  useBillingStats,
  useMonthlyBillingData,
  useCurrentMonthSales,
  useInvoiceHistory,
  useBillingSettings
} from "@/hooks/useBilling";
import { SuscripcionProCard } from "@/components/pro/SuscripcionProCard";
import { FacturasAdminCard } from "@/components/pro/FacturasAdminCard";
import { useAuth } from "@/hooks/useAuth";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading 
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Billing() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: stats, isLoading: statsLoading } = useBillingStats();
  const { data: monthlyData, isLoading: chartLoading } = useMonthlyBillingData();
  const { data: sales, isLoading: salesLoading } = useCurrentMonthSales(searchTerm);
  const { data: invoices, isLoading: invoicesLoading } = useInvoiceHistory();
  const { session } = useAuth();
  const [pagando, setPagando] = useState<string | null>(null);
  const pagarFactura = async (facturaId: string) => {
    if (!session?.access_token) return;
    setPagando(facturaId);
    try {
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-pago-experto`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string, Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ producto: "factura", factura_id: facturaId, back_url: window.location.origin + "/cuenta/facturacion" }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      window.location.href = j.url;
    } catch (e: any) { toast.error("No pude iniciar el pago: " + e.message); setPagando(null); }
  };
  const { data: billingSettings, isLoading: settingsLoading } = useBillingSettings();

  const chartConfig = {
    ventas: {
      label: "Ventas",
      color: "hsl(var(--primary))",
    },
    comisiones: {
      label: "Comisiones",
      color: "hsl(var(--destructive))",
    },
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "preforma":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">Preforma en validación</Badge>;
      case "por_facturar":
        return <Badge variant="outline" className="bg-accent text-accent-foreground">Por facturar</Badge>;
      case "facturada":
        return <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">Emitida · por pagar</Badge>;
      case "pagada":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Pagada</Badge>;
      case "pendiente":
        return <Badge variant="outline" className="bg-accent text-accent-foreground">Pendiente</Badge>;
      case "vencida":
        return <Badge variant="destructive">Vencida</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Facturación y Comisiones</h1>
        <p className="text-muted-foreground">
          Tu plan y suscripción
        </p>
      </div>

      {/* Suscripción / Plan Pro */}
      <SuscripcionProCard />
      <FacturasAdminCard />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas del Mes"
          value={formatCurrency(stats?.ventasMesActual || 0)}
          icon={DollarSign}
          loading={statsLoading}
        />
        <StatCard
          title="Comisión del Mes"
          value={formatCurrency(stats?.comisionMesActual || 0)}
          icon={Percent}
          loading={statsLoading}
        />
        <StatCard
          title="OC Procesadas"
          value={String(stats?.ocProcesadas || 0)}
          icon={FileText}
          loading={statsLoading}
        />
        <StatCard
          title="Saldo Pendiente"
          value={formatCurrency(stats?.saldoPendiente || 0)}
          icon={Receipt}
          loading={statsLoading}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ventas y Comisiones por Mes</CardTitle>
          <CardDescription>Últimos 6 meses de actividad</CardDescription>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis 
                    className="text-xs" 
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar 
                    dataKey="ventas" 
                    name="Ventas" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="comisiones" 
                    name="Comisiones" 
                    fill="hsl(var(--destructive))" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Current Month Sales Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Detalle de Ventas - {format(new Date(), "MMMM yyyy", { locale: es })}</CardTitle>
              <CardDescription>Órdenes de compra aceptadas este mes</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código o comprador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {salesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sales && sales.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código OC</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Comprador</TableHead>
                    <TableHead className="text-right">Monto Neto</TableHead>
                    <TableHead className="text-right">Comisión 2%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((venta) => (
                    <TableRow key={venta.id}>
                      <TableCell className="font-medium">{venta.codigo_oc}</TableCell>
                      <TableCell>
                        {venta.fecha_aceptacion 
                          ? format(new Date(venta.fecha_aceptacion), "dd/MM/yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>{venta.comprador || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(venta.monto_neto)}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">
                        {formatCurrency(venta.comision_monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay ventas registradas este mes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice History & Payment Method */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Invoice History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Historial de Facturas
            </CardTitle>
            <CardDescription>Facturas mensuales de comisiones</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : invoices && invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map((factura) => (
                  <div key={factura.id} className="p-4 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="font-medium">{factura.numero_factura || `Período ${factura.periodo}`}</div>
                        <div className="text-sm text-muted-foreground">
                          {factura.por_suscripcion
                            ? <>Fijo {formatCurrency(factura.fijo_monto ?? 0)} lo cobra tu suscripción · comisiones <b>{formatCurrency(factura.total_comision)}</b>{factura.cobro_programado_en && !factura.cobro_revertido_en && factura.estado !== "pagada" ? " · se suman a tu próximo cobro automático" : ""}</>
                            : <>Fijo {formatCurrency(factura.fijo_monto ?? 0)} + comisiones {formatCurrency(factura.total_comision)} = <b>{formatCurrency(factura.total ?? (factura.fijo_monto ?? 0) + factura.total_comision)}</b></>}
                          {factura.estado === "preforma" && factura.validacion_hasta && ` · puedes objetar hasta el ${new Date(factura.validacion_hasta).toLocaleDateString("es-CL")}`}
                          {factura.fecha_pago && ` · pagada el ${new Date(factura.fecha_pago + "T00:00:00").toLocaleDateString("es-CL")}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getEstadoBadge(factura.estado)}
                        {factura.documento_url && (
                          <Button variant="outline" size="sm" asChild><a href={factura.documento_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-1" />PDF</a></Button>
                        )}
                        {(factura.estado === "facturada" || factura.estado === "por_facturar") && (factura.total ?? 0) > 0 && !(factura.por_suscripcion && factura.cobro_programado_en && !factura.cobro_revertido_en) && (
                          <Button size="sm" disabled={pagando === factura.id} onClick={() => pagarFactura(factura.id)}>
                            {pagando === factura.id ? "Abriendo Mercado Pago…" : "Pagar con Mercado Pago"}
                          </Button>
                        )}
                      </div>
                    </div>
                    {factura.detalle?.ocs && factura.detalle.ocs.length > 0 && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer">Órdenes de compra aceptadas del período ({factura.detalle.ocs.length})</summary>
                        <div className="mt-1 space-y-0.5">
                          {factura.detalle.ocs.map((o) => (
                            <div key={o.oc}>OC {o.oc} · {o.licitacion} · {o.comprador} · {new Date(o.fecha).toLocaleDateString("es-CL")} · neto {formatCurrency(o.neto)} · comisión {formatCurrency(o.comision)}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay facturas registradas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Método de Pago
            </CardTitle>
            <CardDescription>Tarjeta registrada para pagos automáticos</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : billingSettings?.tarjeta_ultimos_4 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/50">
                  <div className="p-3 rounded-full bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {billingSettings.tarjeta_marca || "Tarjeta"} •••• {billingSettings.tarjeta_ultimos_4}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Expira: {billingSettings.tarjeta_expiracion || "N/A"}
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Cambiar Tarjeta
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="p-4 rounded-full bg-muted w-fit mx-auto">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Sin tarjeta registrada</p>
                  <p className="text-sm text-muted-foreground">
                    Agrega una tarjeta para pagos automáticos
                  </p>
                </div>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Tarjeta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
