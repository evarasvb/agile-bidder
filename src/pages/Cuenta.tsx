import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, CreditCard, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Cuenta() {
  // TODO: Obtener datos reales del usuario y suscripción
  const userData = {
    email: "usuario@ejemplo.cl",
    empresa: "Mi Empresa",
    plan: "Starter",
    usuarios: 1,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cuenta</h1>
        <p className="text-muted-foreground">
          Gestiona tu cuenta y suscripción
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Información de la Cuenta */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Información de la Cuenta</CardTitle>
                <CardDescription>
                  Datos de tu cuenta y empresa
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div className="text-sm">{userData.email}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Empresa</div>
              <div className="text-sm">{userData.empresa}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Usuarios</div>
              <div className="text-sm">{userData.usuarios}</div>
            </div>
            <Button variant="outline" className="w-full mt-4">
              Editar Información
            </Button>
          </CardContent>
        </Card>

        {/* Plan y Suscripción */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Plan y Suscripción</CardTitle>
                <CardDescription>
                  Detalles de tu plan actual
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Plan Actual</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">{userData.plan}</Badge>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Acceso a funcionalidades básicas de FirmaVB
            </div>
            <Button className="w-full mt-4">
              Actualizar Plan
            </Button>
          </CardContent>
        </Card>

        {/* Método de Pago */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Método de Pago</CardTitle>
                <CardDescription>
                  Configura tu método de pago
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              No hay método de pago configurado
            </p>
            <Button variant="outline" className="w-full">
              Agregar Método de Pago
            </Button>
          </CardContent>
        </Card>

        {/* Facturación */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Facturación</CardTitle>
                <CardDescription>
                  Historial de pagos y facturas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              No hay facturas disponibles
            </p>
            <Button variant="outline" className="w-full">
              Ver Historial
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
