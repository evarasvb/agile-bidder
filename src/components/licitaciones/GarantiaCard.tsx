// Detección de garantía en la ficha de licitación. Lee lo que las bases exigen
// (garantía de seriedad de la oferta y de fiel cumplimiento) ya extraído por el
// Experto, y ofrece obtenerla en línea con una fintech (FinFast) en vez de ir al
// banco por una boleta. Si la licitación no tiene garantía detectada, no se muestra.
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGarantiaBases } from "@/hooks/useGarantiaBases";

// URL de la fintech de garantías (deep-link; el paso siguiente es API/convenio).
const FINFAST_URL = "https://finfast.com/garantias?utm_source=firmavb&utm_medium=app&utm_campaign=garantia_licitacion";

export function GarantiaCard({ codigo }: { codigo: string }) {
  const { data, isLoading } = useGarantiaBases(codigo);

  // Mientras carga, o si las bases no traen garantía, no ocupamos espacio.
  if (isLoading || !data) return null;
  const seriedad = data.seriedad?.trim() || null;
  const fiel = data.fiel_cumplimiento?.trim() || null;
  if (!seriedad && !fiel) return null;

  return (
    <Card className="border-firmavb-blue/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-firmavb-blue">
          <ShieldCheck className="h-4 w-4" />
          Esta licitación exige garantía
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Según las bases:</p>

        {seriedad && (
          <div>
            <p className="text-xs font-semibold text-foreground">Seriedad de la oferta</p>
            <p className="text-sm text-muted-foreground mt-0.5">{seriedad}</p>
          </div>
        )}
        {fiel && (
          <div>
            <p className="text-xs font-semibold text-foreground">Fiel cumplimiento</p>
            <p className="text-sm text-muted-foreground mt-0.5">{fiel}</p>
          </div>
        )}

        <div className="rounded-lg bg-firmavb-blue/5 p-3">
          <p className="text-xs text-muted-foreground">
            Obtenla <b className="text-foreground">100% online</b>, sin ir al banco ni congelar tu capital de trabajo.
          </p>
          <Button
            className="mt-2 w-full gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
            onClick={() => window.open(FINFAST_URL, "_blank", "noopener")}
          >
            <ExternalLink className="h-4 w-4" />
            Solicitar garantía online
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
