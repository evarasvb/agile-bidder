import { Link } from "react-router-dom";
import { Check, Crown, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { PLANES } from "@/data/planes";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";

// Antes /planes redirigía a /cuenta (que exige sesión iniciada): un visitante
// nunca podía saber cuánto cuesta FirmaVB antes de registrarse. Esta página
// muestra el precio real y público; solo la activación del pago requiere
// cuenta (Mercado Pago necesita saber a quién cobrarle).
export default function Planes() {
  const { isAuthenticated } = useAuth();
  const { isPro } = usePlan();

  return (
    <div className="min-h-screen bg-firmavb-gray">
      <Seo
        title="Planes y precios — FirmaVB"
        description="Desde gratis hasta FirmaVB ERP: precios y beneficios de cada plan para vender a Mercado Público con IA. Sin letra chica."
        path="/planes"
      />

      <header className="px-6 py-4 border-b border-border/50 bg-white">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoFirmavbOriginal}
              alt="FirmaVB"
              className="h-10 w-auto object-contain"
              style={{ padding: "2px" }}
            />
          </Link>
          {isAuthenticated ? (
            <Button variant="outline" asChild className="gap-2">
              <Link to="/cuenta/facturacion">Ir a mi cuenta</Link>
            </Button>
          ) : (
            <Button asChild className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90">
              <Link to="/auth?tab=signup">Crear cuenta gratis</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a FirmaVB
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
            Precios simples, sin letra chica
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Empieza gratis viendo las oportunidades de tu rubro. Sube de plan cuando quieras
            postular, automatizar y gestionar todo desde FirmaVB.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANES.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 flex flex-col bg-white ${
                p.id === "erp" ? "border-firmavb-blue shadow-md ring-1 ring-firmavb-blue/20" : "border-border/60"
              }`}
            >
              {p.id === "erp" && (
                <Badge className="w-fit mb-2 bg-firmavb-blue">Más completo</Badge>
              )}
              <p className="font-semibold flex items-center gap-1.5 text-foreground">
                {p.id === "erp" ? (
                  <Crown className="h-4 w-4 text-firmavb-blue" />
                ) : p.id !== "free" ? (
                  <Sparkles className="h-4 w-4 text-firmavb-blue" />
                ) : null}
                {p.nombre}
              </p>
              <div className="mt-2 mb-1">
                <span className="text-2xl font-bold">{p.precio}</span>
              </div>
              {p.periodo && (
                <p className="text-xs text-muted-foreground mb-3">{p.periodo}</p>
              )}
              <ul className="mt-1 space-y-2 text-sm text-muted-foreground flex-1">
                {p.puntos.map((punto) => (
                  <li key={punto} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5 text-[hsl(var(--success))] shrink-0" />
                    <span>{punto}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isAuthenticated ? (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={p.id === "erp" ? "default" : "outline"}
                    asChild
                  >
                    <Link to={p.id === "free" ? "/dashboard" : "/cuenta/facturacion"}>
                      {p.id === "free"
                        ? isPro
                          ? "Incluido"
                          : "Tu plan actual"
                        : `Activar ${p.nombre}`}
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    variant={p.id === "erp" ? "default" : "outline"}
                    asChild
                  >
                    <Link to="/auth?tab=signup">
                      {p.id === "free" ? "Crear cuenta gratis" : "Crear cuenta y activar"}
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagos con Mercado Pago. Experto Pro y Plus son pagos únicos por 30 días; el ERP es
          suscripción mensual que puedes cancelar cuando quieras. Sin tarjeta de crédito para el
          plan gratuito.
        </p>
      </main>
    </div>
  );
}
