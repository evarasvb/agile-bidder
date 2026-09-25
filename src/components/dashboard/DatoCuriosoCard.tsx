import { PartyPopper, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useDatoCurioso } from "@/hooks/useDashboardPrincipal";

const formatCompact = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("es-CL")}`;
};

// Abre el Inicio con algo que llame la atención (una compra ágil real y
// vigente, con nombre freak/gracioso) antes de las tablas de negocio serias.
// Se autooculta si hoy no hay ninguna: nunca se inventa un dato.
export function DatoCuriosoCard() {
  const { data: dato, isLoading } = useDatoCurioso();

  if (isLoading || !dato) return null;

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 text-white overflow-hidden relative">
      <div className="absolute -right-6 -top-6 opacity-20">
        <PartyPopper className="h-32 w-32" />
      </div>
      <CardContent className="pt-6 relative">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-white/20 p-2 shrink-0">
            <PartyPopper className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              El dato curioso del día en Mercado Público
            </p>
            <p className="font-heading font-semibold text-lg mt-1 leading-snug">
              {dato.nombre}
            </p>
            <p className="text-sm text-white/90 mt-1">
              {dato.institucion} · {formatCompact(Number(dato.monto_estimado) || 0)}
            </p>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className="mt-3 bg-white/90 text-purple-700 hover:bg-white"
            >
              <Link to={`/compras-agiles/${dato.codigo}`}>
                Ver esta compra ágil <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
