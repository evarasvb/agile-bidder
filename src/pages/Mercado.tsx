import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Mercado() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mercado
</h1>
        <p className="text-muted-foreground">
          Análisis de órdenes de compra y tendencias del mercado
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Esta sección estará disponible próximamente. Aquí podrás ver y analizar órdenes de compra del mercado público.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Store className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Tus Órdenes de Compra</CardTitle>
                <CardDescription>
                  Historial de órdenes de compra adjudicadas
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente disponible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Store className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Mercado Completo</CardTitle>
                <CardDescription>
                  Análisis de todas las órdenes de compra del mercado
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente disponible
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
