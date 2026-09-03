import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Crown, Building2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useCliente } from "@/hooks/useCliente";
import { usePlan, type PlanId } from "@/hooks/usePlan";
import { PlanesEscalera } from "@/components/pro/PlanesEscalera";

const PLAN_LABEL: Record<PlanId, string> = {
  free: "Gratis",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export default function Cuenta() {
  const { data: cliente } = useCliente();
  const { plan, isPro } = usePlan();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuenta</h1>
        <p className="text-muted-foreground">Gestiona tu empresa, plan y facturación</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Información de la Cuenta — datos reales del cliente */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Información de la empresa</CardTitle>
                <CardDescription>Datos que aparecen en tus documentos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Empresa</div>
              <div className="text-sm">{cliente?.empresa_nombre || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Correo</div>
              <div className="text-sm">{cliente?.email || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">RUT</div>
              <div className="text-sm">{cliente?.rut || "—"}</div>
            </div>
            <Button variant="outline" className="w-full mt-2 gap-2" asChild>
              <Link to="/configuracion/empresa">
                Editar datos de la empresa
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Plan y Suscripción — plan real */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Plan y suscripción</CardTitle>
                <CardDescription>Tu plan actual y beneficios</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PlanesEscalera />
          </CardContent>
        </Card>

        {/* Facturación — enlaza a la página real */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Facturación y comisiones</CardTitle>
                <CardDescription>Historial de pagos, comisiones y método de pago</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/cuenta/facturacion">
                Ir a Facturación
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
