import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function Productos() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redireccionar temporalmente a lista-precios hasta que se implemente esta página
    navigate("/lista-precios", { replace: true });
  }, [navigate]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Productos</CardTitle>
              <CardDescription>
                Gestiona tu catálogo de productos y precios
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Redireccionando a lista de precios...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
