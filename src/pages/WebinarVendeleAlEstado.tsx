// Página pública de la conversación semanal "Véndele al Estado y no mueras en el intento"
// (TODOS los martes 19:00–19:30 hrs Chile, por Google Meet). El formulario inserta directo en
// `webinar_inscripciones` con su propio evento_slug; el trigger de la base dispara el correo de
// confirmación con el evento RECURRENTE para el calendario (mismo flujo que el otro webinar).
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, MonitorPlay, Send, Sparkles, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { toast } from "sonner";
import logoFirmavbOriginal from "@/assets/logo-firmavb-original.png";

const EVENTO_SLUG = "vendele-al-estado-martes";

const AGENDA = [
  "Cómo encontrar las licitaciones y compras ágiles que sí puedes ganar",
  "Los errores de anexos y precio que dejan fuera a la mayoría",
  "Convenio Marco: cómo entrar y cómo dejar tus precios competitivos",
  "Preguntas en vivo: trae tu caso y lo revisamos juntos",
  "Cómo el Experto FirmaVB te arma la matriz y completa los anexos por ti",
];

interface FormState { nombre: string; email: string; whatsapp: string; empresa: string }
const INICIAL: FormState = { nombre: "", email: "", whatsapp: "", empresa: "" };

export default function WebinarVendeleAlEstado() {
  const [form, setForm] = useState<FormState>(INICIAL);
  const [honeypot, setHoneypot] = useState(""); // anti-spam: los bots lo llenan
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const set = (campo: keyof FormState, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim() !== "") { setEnviado(true); return; }
    if (!form.nombre.trim() || !form.email.trim()) {
      toast.error("Completa tu nombre y correo.");
      return;
    }
    setEnviando(true);
    const { error } = await (supabase as any).from("webinar_inscripciones").insert({
      evento_slug: EVENTO_SLUG,
      nombre: form.nombre.trim(),
      email: form.email.trim().toLowerCase(),
      whatsapp: form.whatsapp.trim() || null,
      empresa: form.empresa.trim() || null,
    });
    setEnviando(false);
    if (error) {
      if (String((error as any).code) === "23505") {
        toast.success("Ya estabas inscrito. Revisa tu correo para la invitación.");
        setEnviado(true);
        return;
      }
      console.error("Error inscribiendo:", error);
      toast.error("No pudimos guardar tu inscripción. Intenta de nuevo.");
      return;
    }
    setEnviado(true);
  };

  return (
    <div className="min-h-screen bg-firmavb-gray">
      <Seo
        title="Véndele al Estado y no mueras en el intento · todos los martes 19:00 | FirmaVB"
        description="Conversación semanal en vivo de FirmaVB: todos los martes de 19:00 a 19:30 (Chile) hablamos de cómo venderle al Estado —licitaciones, compras ágiles y convenio marco— sin morir en el intento. Inscríbete gratis y te llega la cita al calendario."
        path="/webinar/vendele-al-estado"
      />
      <header className="px-6 py-4 border-b border-border/50 bg-white/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a FirmaVB
          </Link>
          <img src={logoFirmavbOriginal} alt="FirmaVB" className="h-9 w-auto object-contain" />
        </div>
      </header>

      <section className="px-6 py-14">
        <div className="max-w-5xl mx-auto grid md:grid-cols-[1.15fr_0.85fr] gap-10 items-start">
          {/* Columna izquierda: propuesta + agenda */}
          <div>
            <Badge className="bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/20 mb-4">
              <MonitorPlay className="h-3.5 w-3.5 mr-1" /> En vivo · gratis · todas las semanas
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
              Véndele al Estado
              <span className="block text-firmavb-blue">y no mueras en el intento</span>
            </h1>
            <p className="text-muted-foreground text-lg mb-6">
              Todos los martes nos juntamos 30 minutos a hablar en serio de cómo venderle al Estado:
              licitaciones, compras ágiles y convenio marco. Trae tu caso, resolvemos dudas en vivo y te
              llevas algo aplicable para la semana.
            </p>

            <div className="flex flex-wrap gap-4 mb-8 text-sm">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                <Repeat className="h-4 w-4 text-firmavb-blue" />
                <span>Todos los martes</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                <Clock className="h-4 w-4 text-firmavb-blue" />
                <span>19:00 – 19:30 hrs (Chile) · Online</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                <CalendarDays className="h-4 w-4 text-firmavb-blue" />
                <span>Empieza el martes 15 de septiembre</span>
              </div>
            </div>

            <Card className="mb-8">
              <CardContent className="p-5">
                <p className="font-semibold text-foreground mb-3">De qué hablamos</p>
                <ul className="space-y-2.5">
                  {AGENDA.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-firmavb-green shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="flex items-center gap-4 rounded-xl border border-border bg-white p-4">
              <img
                src="/media/academia/foto-enrique.jpg"
                alt="Enrique Varas"
                className="h-14 w-14 rounded-full object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div>
                <p className="font-semibold text-foreground">Enrique Varas</p>
                <p className="text-sm text-muted-foreground">Fundador de FirmaVB · 17 años vendiéndole al Estado</p>
              </div>
            </div>
          </div>

          {/* Columna derecha: formulario */}
          <Card className="md:sticky md:top-6">
            <CardContent className="p-6">
              {enviado ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-12 w-12 text-firmavb-green mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-foreground mb-2">¡Listo, quedaste inscrito! 🎉</h3>
                  <p className="text-sm text-muted-foreground">
                    Te llegó un correo con la invitación y el evento recurrente (todos los martes) para
                    agregar a tu calendario, con el enlace de Google Meet.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="font-semibold text-foreground">Inscríbete gratis</p>
                  <p className="text-xs text-muted-foreground -mt-2">Te llega la cita al calendario, todos los martes, con el enlace para entrar.</p>
                  <input type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="hidden" aria-hidden="true" />
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Tu nombre" maxLength={200} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo *</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="tu@correo.cl" maxLength={200} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+56 9 1234 5678" maxLength={40} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa">Empresa</Label>
                    <Input id="empresa" value={form.empresa} onChange={(e) => set("empresa", e.target.value)} placeholder="Nombre de tu empresa" maxLength={200} />
                  </div>
                  <Button type="submit" disabled={enviando} className="w-full bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2" size="lg">
                    {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <><Send className="h-4 w-4" /> Inscribirme gratis</>}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">Una sola inscripción y quedas para todos los martes.</p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* CTA al Experto */}
        <div className="max-w-5xl mx-auto mt-12">
          <Card className="bg-gradient-to-br from-firmavb-blue to-firmavb-blue/80 border-0 text-white">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 shrink-0" />
                <p className="text-sm sm:text-base">
                  <b>¿No quieres esperar al martes?</b> El Experto FirmaVB lee las bases, arma tu matriz de
                  postulación y completa tus anexos con los datos de tu empresa.
                </p>
              </div>
              <Button asChild variant="secondary" className="shrink-0">
                <Link to="/auth">Probar el Experto FirmaVB</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
