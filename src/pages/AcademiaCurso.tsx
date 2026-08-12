import { Link, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Lightbulb,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";
import { getCursoBySlug, ACENTO, type Bloque } from "@/data/academiaCursos";

function BloqueView({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "subtitulo":
      return (
        <h4 className="text-lg font-semibold text-foreground mt-6 mb-2">
          {bloque.texto}
        </h4>
      );
    case "lista":
      return (
        <ul className="space-y-2 my-3">
          {bloque.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-firmavb-blue shrink-0 mt-1" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "tip":
      return (
        <div className="my-4 flex items-start gap-3 rounded-xl border border-firmavb-blue/20 bg-firmavb-blue/5 p-4">
          <Lightbulb className="h-5 w-5 text-firmavb-blue shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            <span className="font-semibold">Tip: </span>
            {bloque.texto}
          </p>
        </div>
      );
    case "parrafo":
    default:
      return <p className="text-muted-foreground leading-relaxed my-3">{bloque.texto}</p>;
  }
}

export default function AcademiaCurso() {
  const { slug } = useParams<{ slug: string }>();
  const curso = slug ? getCursoBySlug(slug) : undefined;

  if (!curso) {
    return <Navigate to="/academia" replace />;
  }

  let leccionNum = 0;

  return (
    <div className="min-h-screen bg-firmavb-gray">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-white/90 border-b border-border/50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoFirmavbOriginal}
              alt="FirmaVB"
              className="h-10 w-auto object-contain drop-shadow-sm"
              style={{ padding: "2px" }}
            />
          </Link>
          <Button variant="outline" asChild className="gap-2">
            <Link to="/academia">
              <ArrowLeft className="h-4 w-4" />
              Volver a la Academia
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero del curso */}
      <section className="pt-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div
            className={`${ACENTO[curso.acento].portada} rounded-2xl p-8 md:p-10 text-white shadow-lg`}
          >
            <Badge className="mb-4 bg-white/20 text-white border-white/30 hover:bg-white/30">
              Academia FirmaVB · Curso gratuito
            </Badge>
            <div className="flex items-start gap-4">
              <span className="text-5xl leading-none">{curso.emoji}</span>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{curso.titulo}</h1>
                <p className="text-lg text-white/90">{curso.descripcion}</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Badge className="bg-white/20 text-white border-white/30 gap-1 hover:bg-white/30">
                    <BarChart3 className="h-3 w-3" />
                    {curso.nivel}
                  </Badge>
                  <Badge className="bg-white/20 text-white border-white/30 gap-1 hover:bg-white/30">
                    <Clock className="h-3 w-3" />
                    {curso.duracion}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Índice del curso */}
          <div className="mt-6 rounded-xl border border-border/50 bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-3">En este curso verás:</p>
            <ol className="space-y-2">
              {curso.modulos.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className={`font-bold ${ACENTO[curso.acento].texto}`}>{i + 1}.</span>
                  {m.titulo}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {curso.modulos.map((modulo, mi) => (
            <Card key={mi} className="border-border/50">
              <CardContent className="py-6">
                <h2 className="text-xl font-bold text-firmavb-blue mb-4 pb-3 border-b border-border/50">
                  {modulo.titulo}
                </h2>
                <div className="space-y-8">
                  {modulo.lecciones.map((leccion, li) => {
                    leccionNum += 1;
                    return (
                      <article key={li}>
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-firmavb-blue text-white text-sm font-bold">
                            {leccionNum}
                          </span>
                          {leccion.titulo}
                        </h3>
                        <div className="mt-2 sm:pl-10">
                          {leccion.bloques.map((bloque, bi) => (
                            <BloqueView key={bi} bloque={bloque} />
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* CTA final */}
          <Card className="border-0 bg-gradient-to-br from-firmavb-blue to-header-dark text-white shadow-xl">
            <CardContent className="py-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-90" />
              <h3 className="text-2xl font-bold mb-2">¿Quieres ayuda personalizada?</h3>
              <p className="opacity-90 mb-6 max-w-xl mx-auto">
                Cuéntame tu caso y te oriento para vender al Estado, sin costo.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-white text-firmavb-blue hover:bg-white/90 font-semibold"
              >
                <Link to="/academia#asesoria">Pedir asesoría gratuita</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="text-center">
            <Button variant="outline" asChild className="gap-2">
              <Link to="/academia">
                <ArrowLeft className="h-4 w-4" />
                Volver a la Academia
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
