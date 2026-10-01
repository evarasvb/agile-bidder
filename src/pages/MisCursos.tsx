import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { CursoCard } from "@/components/academia/CursoCard";
import { CURSOS, SAGA_BUNDLE } from "@/data/academiaCursos";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAcademyPayment } from "@/services/academyPayments";
import { toast } from "sonner";

// Academia dentro de la app: los cursos de FirmaVB para que los clientes los
// tomen sin salir del sistema. Mismo catálogo (CURSOS) y misma tarjeta
// (CursoCard) que la Academia pública en firmavb.cl/academia — el lector de
// cada curso (/academia/curso/:slug) también es el mismo.
export default function MisCursos() {
  const [comprandoSaga, setComprandoSaga] = useState(false);
  const cursosGratis = CURSOS.filter((c) => !c.premium);
  const cursosSaga = CURSOS.filter((c) => c.premium && c.slug.startsWith("saga-"));
  const cursosExpres = CURSOS.filter((c) => c.premium && !c.slug.startsWith("saga-"));

  const comprarSaga = async () => {
    setComprandoSaga(true);
    try {
      const checkout = await createAcademyPayment(SAGA_BUNDLE.slug);
      window.location.href = checkout.url;
    } catch (error) {
      setComprandoSaga(false);
      toast.error(error instanceof Error ? error.message : "No pudimos iniciar el pago.");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
          <GraduationCap className="h-6 w-6 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academia — Mis cursos</h1>
          <p className="text-sm text-muted-foreground">
            Aprende a vender al Estado a tu ritmo: empieza gratis, resuelve rápido con un curso exprés, o haz la Saga completa.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          1. Empieza gratis
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursosGratis.map((c, i) => (
            <CursoCard key={c.slug} c={c} destacar={i === 0} />
          ))}
        </div>
      </div>

      {cursosExpres.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            2. ¿Con prisa? Cursos exprés
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {cursosExpres.map((c) => (
              <CursoCard key={c.slug} c={c} />
            ))}
          </div>
        </div>
      )}

      {cursosSaga.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            3. El camino completo: Saga Véndele al Estado
          </h2>
          {SAGA_BUNDLE.activo && (
            <Card className="mb-4 overflow-hidden border-0 bg-gradient-to-br from-firmavb-blue to-header-dark text-white shadow-xl">
              <CardContent className="py-6 md:flex items-center justify-between gap-6">
                <div>
                  <Badge className="mb-2 bg-white/20 text-white border-white/30 hover:bg-white/30">
                    🎁 Pack con descuento
                  </Badge>
                  <h3 className="text-xl md:text-2xl font-bold">{SAGA_BUNDLE.titulo}</h3>
                  <p className="text-white/90 max-w-xl">{SAGA_BUNDLE.descripcion}</p>
                </div>
                <div className="mt-4 md:mt-0 text-center shrink-0">
                  <p className="text-3xl font-bold mb-2">{SAGA_BUNDLE.precio}</p>
                  <Button
                    type="button"
                    size="lg"
                    onClick={comprarSaga}
                    disabled={comprandoSaga}
                    className="bg-white text-firmavb-blue hover:bg-white/90 font-semibold gap-2"
                    aria-label="Comprar la saga completa con Mercado Pago"
                  >
                    {comprandoSaga && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                    {comprandoSaga ? "Preparando pago…" : "Comprar la saga completa"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cursosSaga.map((c, i) => (
              <CursoCard key={c.slug} c={{ ...c, titulo: `${i + 1}. ${c.titulo}` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
