// @ts-nocheck
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

// Formulario nativo de asesoría gratuita. Los envíos se guardan en la tabla
// `academia_leads` de Supabase (insert público vía RLS). Se pueden revisar
// desde la app en /academia/leads.

interface FormState {
  vende_estado: string;
  estado_debe: string;
  rut_empresa: string;
  nombre_empresa: string;
  nombre_contacto: string;
  email: string;
  whatsapp: string;
  dolor: string;
}

const INICIAL: FormState = {
  vende_estado: "",
  estado_debe: "",
  rut_empresa: "",
  nombre_empresa: "",
  nombre_contacto: "",
  email: "",
  whatsapp: "",
  dolor: "",
};

export function AcademiaLeadForm() {
  const [form, setForm] = useState<FormState>(INICIAL);
  const [honeypot, setHoneypot] = useState(""); // anti-spam: los bots lo llenan
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const set = (campo: keyof FormState, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trampa anti-spam: si el campo oculto viene con datos, es un bot.
    if (honeypot.trim() !== "") {
      setEnviado(true);
      return;
    }

    if (
      !form.vende_estado ||
      !form.estado_debe ||
      !form.rut_empresa.trim() ||
      !form.nombre_empresa.trim() ||
      !form.nombre_contacto.trim() ||
      !form.email.trim() ||
      !form.whatsapp.trim()
    ) {
      toast.error("Completa los campos obligatorios (*).");
      return;
    }

    setEnviando(true);
    const { error } = await supabase.from("academia_leads").insert({
      vende_estado: form.vende_estado,
      estado_debe: form.estado_debe,
      rut_empresa: form.rut_empresa.trim(),
      nombre_empresa: form.nombre_empresa.trim(),
      nombre_contacto: form.nombre_contacto.trim(),
      email: form.email.trim(),
      whatsapp: form.whatsapp.trim(),
      dolor: form.dolor.trim() || null,
    });
    setEnviando(false);

    if (error) {
      console.error("Error guardando lead de academia:", error);
      toast.error("No pudimos enviar tu solicitud. Intenta nuevamente.");
      return;
    }

    setEnviado(true);
    setForm(INICIAL);
  };

  if (enviado) {
    return (
      <div className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-[hsl(var(--success))] mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">¡Recibido! 🎉</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Gracias por escribirme. Revisaré tu situación y te contacto pronto por
          WhatsApp o correo para tu asesoría gratuita.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setEnviado(false)}
        >
          Enviar otra solicitud
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot oculto anti-spam */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {/* 1. ¿Vendes al Estado? */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          ¿Le vendes al Estado hoy? <span className="text-firmavb-red">*</span>
        </Label>
        <RadioGroup
          value={form.vende_estado}
          onValueChange={(v) => set("vende_estado", v)}
          className="flex flex-wrap gap-4"
        >
          {["Sí", "No", "Recién empezando"].map((op) => (
            <div key={op} className="flex items-center gap-2">
              <RadioGroupItem value={op} id={`vende-${op}`} />
              <Label htmlFor={`vende-${op}`} className="font-normal cursor-pointer">
                {op}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* 2. ¿Te deben? */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          ¿El Estado te debe pagos? <span className="text-firmavb-red">*</span>
        </Label>
        <RadioGroup
          value={form.estado_debe}
          onValueChange={(v) => set("estado_debe", v)}
          className="flex flex-wrap gap-4"
        >
          {["Sí", "No"].map((op) => (
            <div key={op} className="flex items-center gap-2">
              <RadioGroupItem value={op} id={`debe-${op}`} />
              <Label htmlFor={`debe-${op}`} className="font-normal cursor-pointer">
                {op}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Datos empresa / contacto */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rut">
            RUT de la empresa <span className="text-firmavb-red">*</span>
          </Label>
          <Input
            id="rut"
            value={form.rut_empresa}
            onChange={(e) => set("rut_empresa", e.target.value)}
            placeholder="76.123.456-7"
            maxLength={40}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="empresa">
            Nombre de la empresa <span className="text-firmavb-red">*</span>
          </Label>
          <Input
            id="empresa"
            value={form.nombre_empresa}
            onChange={(e) => set("nombre_empresa", e.target.value)}
            placeholder="Mi Empresa SpA"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contacto">
            Nombre de contacto <span className="text-firmavb-red">*</span>
          </Label>
          <Input
            id="contacto"
            value={form.nombre_contacto}
            onChange={(e) => set("nombre_contacto", e.target.value)}
            placeholder="Tu nombre"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            Mail de contacto <span className="text-firmavb-red">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="tu@correo.cl"
            maxLength={200}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="whatsapp">
            WhatsApp <span className="text-firmavb-red">*</span>
          </Label>
          <Input
            id="whatsapp"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="+56 9 1234 5678"
            maxLength={40}
          />
        </div>
      </div>

      {/* Dolor / urgencia */}
      <div className="space-y-2">
        <Label htmlFor="dolor" className="text-base font-medium">
          ¿Qué es lo que más te aprieta hoy?
        </Label>
        <Textarea
          id="dolor"
          value={form.dolor}
          onChange={(e) => set("dolor", e.target.value)}
          placeholder="Cuéntame en una o dos líneas lo que más te urge resolver."
          rows={3}
          maxLength={2000}
        />
      </div>

      <Button
        type="submit"
        disabled={enviando}
        className="bg-firmavb-blue hover:bg-firmavb-blue/90 gap-2 w-full sm:w-auto"
        size="lg"
      >
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Quiero mi asesoría gratuita
          </>
        )}
      </Button>
    </form>
  );
}
