import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Plus, Ban, TrendingUp, Loader2 } from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import { useAprendizaje } from "@/hooks/useSenales";

/**
 * Nivel 2: muestra lo que la IA aprendió del comportamiento del cliente
 * (qué descarta / qué cotiza) y sugiere palabras a excluir/incluir. El cliente
 * las agrega con un clic; se guardan con el resto de los filtros.
 */
export default function AprendizajeIA({
  onAgregarIncluir,
  onAgregarExcluir,
  yaIncluidas = [],
  yaExcluidas = [],
}: {
  onAgregarIncluir: (palabra: string) => void;
  onAgregarExcluir: (palabra: string) => void;
  yaIncluidas?: string[];
  yaExcluidas?: string[];
}) {
  const { data, isLoading } = useAprendizaje();

  const incluir = (data?.incluir_sugeridas ?? []).filter((s) => !yaIncluidas.includes(s.palabra));
  const excluir = (data?.excluir_sugeridas ?? []).filter((s) => !yaExcluidas.includes(s.palabra));
  const haySugerencias = incluir.length > 0 || excluir.length > 0;
  const total = data?.total_senales ?? 0;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-primary" />
          Lo que la IA aprendió de ti
          <InfoHint text="La IA analiza lo que descartas y lo que cotizas. Con eso te sugiere qué excluir (lo que sueles descartar) y qué incluir (lo que sí trabajas). Mientras más uses el panel, mejor afina tus matches." />
        </CardTitle>
        <CardDescription>
          {total === 0
            ? "Aún estoy aprendiendo de ti. A medida que descartes o cotices oportunidades en el panel, aquí verás sugerencias para afinar tus filtros."
            : `Analicé ${total} acción${total === 1 ? "" : "es"} tuya${total === 1 ? "" : "s"} en el panel.`}
        </CardDescription>
      </CardHeader>
      {(isLoading || haySugerencias) && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Analizando tu actividad…
            </div>
          ) : (
            <>
              {excluir.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <Ban className="h-3.5 w-3.5 text-destructive" /> Sueles descartar estas — ¿excluirlas?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {excluir.map((s) => (
                      <button
                        type="button"
                        key={s.palabra}
                        onClick={() => onAgregarExcluir(s.palabra)}
                        className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="font-medium">{s.palabra}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.veces}×</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {incluir.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" /> Sí trabajas estas — ¿incluirlas?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {incluir.map((s) => (
                      <button
                        type="button"
                        key={s.palabra}
                        onClick={() => onAgregarIncluir(s.palabra)}
                        className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span className="font-medium">{s.palabra}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.veces}×</Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
