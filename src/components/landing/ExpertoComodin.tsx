import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneCall, ArrowRight } from "lucide-react";

const EJEMPLOS = [
  "¿Cómo paga la Municipalidad de Valparaíso?",
  "¿Pueden exigir ISO 9001 como requisito de admisibilidad?",
  "¿Quién gana las licitaciones de software municipal?",
];

/**
 * "Comodín telefónico": primera pregunta gratis al Experto FirmaVB desde la portada.
 * Con sesión va a /experto (dentro de la app); sin sesión, a la página pública /experto.html,
 * que no exige registro para la primera pregunta.
 */
export function ExpertoComodin() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { session } = useAuth();
  const ir = (pregunta: string) => {
    const p = pregunta.trim();
    const qs = p ? `?q=${encodeURIComponent(p)}` : "";
    if (session) navigate(`/experto${qs}`);
    else window.location.assign(`/experto.html${qs}`);
  };
  return (
    <section className="py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 border-firmavb-blue/30 bg-gradient-to-br from-firmavb-blue/10 to-transparent shadow-md">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-firmavb-blue text-white">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">¿Te trabaste en una licitación? Usa tu comodín telefónico: llama al Experto</h2>
              <p className="mt-2 text-muted-foreground">
                17 años vendiéndole al Estado, la Ley 19.886, 3.148 dictámenes de Contraloría y los datos vivos de Mercado Público
                (quién gana, cómo paga cada organismo). Tu primera pregunta es gratis, sin registrarte.
              </p>
              <form
                className="mt-5 flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => { e.preventDefault(); ir(q); }}
              >
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Escribe tu pregunta, ej. ¿Puedo reclamar si evaluaron mal mi oferta?"
                  className="h-12 text-base"
                  aria-label="Pregunta para el Experto FirmaVB"
                />
                <Button type="submit" size="lg" className="h-12 bg-firmavb-blue hover:bg-firmavb-blue/90 whitespace-nowrap">
                  Llamar al Experto
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {EJEMPLOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => ir(e)}
                    className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground hover:border-firmavb-blue hover:text-foreground transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
