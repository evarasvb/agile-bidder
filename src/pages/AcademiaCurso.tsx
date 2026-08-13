import { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  Lightbulb,
  CheckCircle2,
  ClipboardList,
  ShoppingCart,
  Lock,
  Check,
  KeyRound,
  Loader2,
  Unlock,
  Download,
  Video,
  TrendingUp,
  Calendar,
} from "lucide-react";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getCursoBySlug,
  ACENTO,
  type Bloque,
  type Modulo,
} from "@/data/academiaCursos";

function BloqueView({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "subtitulo":
      return (
        <h4 className="text-lg font-semibold text-foreground mt-6 mb-2">{bloque.texto}</h4>
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
    case "descarga":
      return (
        <a
          href={bloque.url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-4 inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 px-4 py-3 text-sm font-semibold text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20 transition-colors"
        >
          <Download className="h-4 w-4" />
          {bloque.texto}
        </a>
      );
    case "caso":
      return (
        <div className="my-4 rounded-xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success))]/5 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--success))]">
              {bloque.titulo || "Caso real"}
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{bloque.texto}</p>
        </div>
      );
    case "dato":
      return (
        <div className="my-4 flex items-start gap-3 rounded-xl border border-firmavb-blue/20 bg-firmavb-blue/[0.07] p-4">
          <BarChart3 className="h-5 w-5 text-firmavb-blue shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-semibold text-firmavb-blue">Dato: </span>
              {bloque.texto}
            </p>
            {bloque.fuente && (
              <p className="text-xs text-muted-foreground mt-1">Fuente: {bloque.fuente}</p>
            )}
          </div>
        </div>
      );
    case "cta":
      return (
        <a
          href={bloque.url}
          target="_blank"
          rel="noopener noreferrer"
          className="my-4 inline-flex items-center gap-2 rounded-xl bg-firmavb-blue px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-firmavb-blue/90 transition-colors"
        >
          <Calendar className="h-4 w-4" />
          {bloque.texto}
        </a>
      );
    case "parrafo":
    default:
      return <p className="text-muted-foreground leading-relaxed my-3">{bloque.texto}</p>;
  }
}

// Render de los módulos con lecciones numeradas (cursos gratis y premium ya desbloqueados)
function ModulosContenido({ modulos }: { modulos: Modulo[] }) {
  let leccionNum = 0;
  return (
    <>
      {modulos.map((modulo, mi) => (
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
    </>
  );
}

export default function AcademiaCurso() {
  const { slug } = useParams<{ slug: string }>();
  const curso = slug ? getCursoBySlug(slug) : undefined;

  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState<Modulo[] | null>(null);
  const [email, setEmail] = useState("");
  const [recuperando, setRecuperando] = useState(false);

  if (!curso) {
    return <Navigate to="/academia" replace />;
  }

  const validarCodigo = async () => {
    if (!codigo.trim()) {
      toast.error("Ingresa tu código de acceso.");
      return;
    }
    setCargando(true);
    const { data, error } = await supabase.functions.invoke("academia-premium", {
      body: { action: "validar", slug: curso.slug, codigo: codigo.trim() },
    });
    setCargando(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "No pudimos validar el código. Intenta nuevamente.");
      return;
    }
    setDesbloqueado(data.modulos as Modulo[]);
    toast.success("¡Acceso desbloqueado! 🎉");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const recuperarPorCorreo = async () => {
    if (!email.trim()) {
      toast.error("Ingresa el correo de tu pago.");
      return;
    }
    setRecuperando(true);
    const { data, error } = await supabase.functions.invoke("academia-premium", {
      body: { action: "recuperar", slug: curso.slug, email: email.trim() },
    });
    setRecuperando(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "No encontramos tu compra con ese correo.");
      return;
    }
    setDesbloqueado(data.modulos as Modulo[]);
    toast.success("¡Acceso recuperado! 🎉");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const esPremiumBloqueado = curso.premium && !desbloqueado;

  const agendarUrl =
    curso.sesionEnVivo?.agendarUrl ||
    "https://wa.me/56994259157?text=" +
      encodeURIComponent(`Hola, compré "${curso.titulo}" y quiero agendar mi sesión en vivo.`);

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
          <div className={`${ACENTO[curso.acento].portada} rounded-2xl p-8 md:p-10 text-white shadow-lg`}>
            <Badge className="mb-4 bg-white/20 text-white border-white/30 hover:bg-white/30">
              Academia FirmaVB · {curso.premium ? "Programa premium" : "Curso gratuito"}
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
          {/* Curso gratis: contenido completo */}
          {!curso.premium && <ModulosContenido modulos={curso.modulos} />}

          {/* Curso premium ya desbloqueado */}
          {curso.premium && desbloqueado && (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-4 text-sm text-foreground">
                <Unlock className="h-5 w-5 text-[hsl(var(--success))]" />
                Acceso desbloqueado. ¡Disfruta el programa!
              </div>

              {curso.sesionEnVivo?.incluida && (
                <Card className="border-firmavb-blue/30 bg-gradient-to-br from-firmavb-blue/5 to-transparent">
                  <CardContent className="py-6 md:flex items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Video className="h-5 w-5 text-firmavb-blue" />
                        <h3 className="font-semibold text-foreground">
                          Tu sesión en vivo de {curso.sesionEnVivo.minutos} min está incluida
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground max-w-xl">
                        Agéndala por Google Meet para que te explique el programa y resuelvas tus
                        dudas 1 a 1.
                      </p>
                    </div>
                    <Button
                      asChild
                      className="mt-4 md:mt-0 bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2 shrink-0"
                    >
                      <a href={agendarUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="h-4 w-4" />
                        Agendar mi sesión
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}

              <ModulosContenido modulos={desbloqueado} />
            </>
          )}

          {/* Curso premium bloqueado: página de venta + desbloqueo por código */}
          {esPremiumBloqueado && (
            <>
              <Card className="border-firmavb-blue/30 shadow-lg">
                <CardContent className="py-8 text-center">
                  <div className="text-4xl mb-2">{curso.emoji}</div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Programa premium</h2>
                  <p className="text-muted-foreground max-w-xl mx-auto mb-4">
                    Accede al método completo, paso a paso, para adjudicar de forma constante.
                  </p>
                  {curso.precio && (
                    <p className="text-3xl font-bold text-firmavb-blue mb-5">{curso.precio}</p>
                  )}
                  {curso.sesionEnVivo?.incluida && (
                    <div className="mb-5 mx-auto max-w-md text-left rounded-xl border border-border/50 bg-muted/30 p-4">
                      <p className="text-sm font-semibold text-foreground mb-2">Incluye:</p>
                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-firmavb-blue shrink-0" />
                          Sesión en vivo de {curso.sesionEnVivo.minutos} min por Google Meet
                        </li>
                        <li className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
                          Planillas Excel de control descargables
                        </li>
                        <li className="flex items-center gap-2">
                          <Unlock className="h-4 w-4 text-firmavb-blue shrink-0" />
                          Acceso al curso completo online
                        </li>
                      </ul>
                    </div>
                  )}
                  {curso.pagoUrl ? (
                    <Button
                      asChild
                      size="lg"
                      className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2"
                    >
                      <a href={curso.pagoUrl} target="_blank" rel="noopener noreferrer">
                        <ShoppingCart className="h-5 w-5" />
                        Comprar con Mercado Pago
                      </a>
                    </Button>
                  ) : (
                    <Button size="lg" disabled className="gap-2">
                      <Lock className="h-5 w-5" />
                      Disponible muy pronto
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Temario */}
              <Card className="border-border/50">
                <CardContent className="py-6">
                  <h2 className="text-xl font-bold text-firmavb-blue mb-4">Temario del programa</h2>
                  <div className="space-y-5">
                    {curso.modulos.map((m, mi) => (
                      <div key={mi}>
                        <h3 className="font-semibold text-foreground mb-2">{m.titulo}</h3>
                        <ul className="space-y-1.5 sm:pl-4">
                          {m.lecciones.map((l, li) => (
                            <li
                              key={li}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <Check className="h-4 w-4 text-firmavb-blue shrink-0 mt-0.5" />
                              {l.titulo}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Ya compré: desbloquear con código */}
              <Card className="border-border/50">
                <CardContent className="py-6">
                  <div className="flex items-center gap-2 mb-3">
                    <KeyRound className="h-5 w-5 text-firmavb-blue" />
                    <h3 className="font-semibold text-foreground">¿Ya lo compraste? Ingresa tu código</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Después de pagar recibirás un código de acceso. Ingrésalo aquí para leer el
                    programa completo.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ej: PRO-XXXXXX"
                      className="sm:max-w-xs"
                      onKeyDown={(e) => e.key === "Enter" && validarCodigo()}
                    />
                    <Button
                      onClick={validarCodigo}
                      disabled={cargando}
                      className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2"
                    >
                      {cargando ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Validando…
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4" />
                          Desbloquear
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="mt-5 pt-5 border-t border-border/50">
                    <p className="text-sm text-muted-foreground mb-3">
                      ¿Pagaste y no tienes el código? Recupéralo con el correo que usaste en
                      Mercado Pago:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.cl"
                        className="sm:max-w-xs"
                        onKeyDown={(e) => e.key === "Enter" && recuperarPorCorreo()}
                      />
                      <Button
                        variant="outline"
                        onClick={recuperarPorCorreo}
                        disabled={recuperando}
                        className="gap-2"
                      >
                        {recuperando ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Buscando…
                          </>
                        ) : (
                          "Recuperar acceso"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* CTA final */}
          <Card className="border-0 bg-gradient-to-br from-firmavb-blue to-header-dark text-white shadow-xl">
            <CardContent className="py-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-90" />
              <h3 className="text-2xl font-bold mb-2">¿Quieres ayuda personalizada?</h3>
              <p className="opacity-90 mb-6 max-w-xl mx-auto">
                Cuéntame tu caso y te oriento para vender al Estado.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-white text-firmavb-blue hover:bg-white/90 font-semibold"
              >
                <Link to="/academia#asesoria">Ir a asesoría</Link>
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
