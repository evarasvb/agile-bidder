import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";

export default function Reportes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <FirmaVBHeader
        title="Reportes"
        subtitle="Análisis y reportes de rendimiento"
      />
      <Card className="border-border/50 shadow-sm">
        <CardContent className="py-16 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
            Próximamente
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Estamos trabajando en reportes avanzados de rendimiento, análisis de
            pipeline y exportación de datos. Esta sección estará disponible
            pronto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
