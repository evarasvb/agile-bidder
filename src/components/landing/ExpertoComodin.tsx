import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneCall, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Misma URL/llave pública que usa el cliente canónico (src/integrations/supabase/client.ts),
// pero por fetch crudo (no supabase.functions.invoke) porque esta respuesta es streaming (SSE).
const SUPA = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EJEMPLOS = [
  "¿Cómo paga la Municipalidad de Valparaíso?",
  "¿Pueden exigir ISO 9001 como requisito de admisibilidad?",
  "¿Quién gana las licitaciones de software municipal?",
];

// Misma huella que usa /experto.html: el comodín es uno por navegador.
function huella(): string {
  try {
    let h = localStorage.getItem("fvb_huella");
    if (!h) { h = "h_" + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("fvb_huella", h); }
    return h;
  } catch { return "anon"; }
}

// Markdown mínimo (mismo que experto.html): títulos, listas, negrita, links.
function md(t: string): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (x: string) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline">$1</a>');
  let out = "", lista: string | null = null;
  const cierra = () => { if (lista) { out += `</${lista}>`; lista = null; } };
  for (const ln of t.split("\n")) {
    let m: RegExpMatchArray | null;
    if ((m = ln.match(/^\s*(#{1,3})\s+(.*)/))) { cierra(); out += `<p class="font-semibold mt-3">${inline(m[2])}</p>`; continue; }
    if ((m = ln.match(/^\s*[-*•]\s+(.*)/))) { if (lista !== "ul") { cierra(); out += '<ul class="list-disc pl-5 my-2">'; lista = "ul"; } out += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = ln.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== "ol") { cierra(); out += '<ol class="list-decimal pl-5 my-2">'; lista = "ol"; } out += `<li>${inline(m[1])}</li>`; continue; }
    if (ln.trim() === "") { cierra(); continue; }
    cierra(); out += `<p class="my-2">${inline(ln)}</p>`;
  }
  cierra(); return out;
}

/**
 * "Comodín telefónico": una pregunta gratis al Experto FirmaVB respondida aquí mismo, en la portada.
 * Con sesión se va a /experto (dentro de la app). Sin sesión, el servidor limita a 1 pregunta por
 * navegador y 3 por IP al día; al agotarse invita a crear la cuenta gratis (3 preguntas al mes).
 */
export function ExpertoComodin() {
  const [q, setQ] = useState("");
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"idle" | "cargando" | "listo" | "agotado">("idle");
  const [aviso, setAviso] = useState("");
  const navigate = useNavigate();
  const { session } = useAuth();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (estado !== "idle") ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [estado]);

  const preguntar = async (pregunta: string) => {
    const p = pregunta.trim();
    if (!p) return;
    if (session) { navigate(`/experto?q=${encodeURIComponent(p)}`); return; }
    setEstado("cargando"); setTexto(""); setAviso("");
    try {
      const r = await fetch(`${SUPA}/functions/v1/experto-consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ modo: "chat", pregunta: p, huella: huella() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setAviso(j.mensaje || j.error || `Error ${r.status}`);
        setEstado(r.status === 402 ? "agotado" : "idle");
        return;
      }
      const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = "", acc = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() || "";
        for (const part of parts) {
          const ln = part.trim(); if (!ln.startsWith("data:")) continue;
          try { const j = JSON.parse(ln.slice(5)); if (j.delta) { acc += j.delta; setTexto(acc); } } catch { /* ignorar */ }
        }
      }
      setEstado("listo");
    } catch (e) {
      setAviso("No pude responder: " + (e as Error).message); setEstado("idle");
    }
  };

  const usado = estado === "listo" || estado === "agotado";
  return (
    <section className="py-10 px-6" ref={ref}>
      <div className="max-w-4xl mx-auto">
        <Card className="p-8 border-firmavb-blue/30 bg-gradient-to-br from-firmavb-blue/10 to-transparent shadow-md">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-firmavb-blue text-white">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">¿Te trabaste en una licitación? Usa tu comodín telefónico: llama al Experto</h2>
              <p className="mt-2 text-muted-foreground">
                17 años vendiéndole al Estado, la Ley 19.886, 3.148 dictámenes de Contraloría y los datos vivos de Mercado Público
                (quién gana, cómo paga cada organismo). Tu primera pregunta es gratis y se responde aquí mismo.
              </p>
              {!usado && (
                <>
                  <form className="mt-5 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); preguntar(q); }}>
                    <Input value={q} onChange={(e) => setQ(e.target.value)} disabled={estado === "cargando"}
                      placeholder="Escribe tu pregunta, ej. ¿Puedo reclamar si evaluaron mal mi oferta?"
                      className="h-12 text-base" aria-label="Pregunta para el Experto FirmaVB" />
                    <Button type="submit" size="lg" disabled={estado === "cargando"} className="h-12 bg-firmavb-blue hover:bg-firmavb-blue/90 whitespace-nowrap">
                      {estado === "cargando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Llamar al Experto<ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                  </form>
                  {estado === "idle" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {EJEMPLOS.map((e) => (
                        <button key={e} type="button" onClick={() => { setQ(e); preguntar(e); }}
                          className="rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground hover:border-firmavb-blue hover:text-foreground transition-colors">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {(texto || estado === "cargando") && (
                <div className="mt-5 rounded-xl border bg-background p-5 text-[15px] leading-relaxed">
                  {q && <p className="text-sm text-muted-foreground mb-2">Tú: {q}</p>}
                  {texto ? <div dangerouslySetInnerHTML={{ __html: md(texto) }} /> : <p className="text-muted-foreground">Buscando en la ley, la jurisprudencia y Mercado Público…</p>}
                </div>
              )}
              {aviso && <p className="mt-3 text-sm text-amber-700">{aviso}</p>}
              {usado && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-firmavb-blue/30 bg-firmavb-blue/5 p-4">
                  <p className="flex-1 text-sm">
                    <b>{estado === "listo" ? "Usaste tu comodín." : "Comodín usado."}</b> Con una cuenta gratis tienes 3 preguntas y 1 informe de licitación al mes, y ves las oportunidades de tu rubro.
                  </p>
                  <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90"><Link to="/auth?tab=signup">Crear cuenta gratis</Link></Button>
                  <Button asChild variant="outline"><Link to="/auth">Ya tengo cuenta</Link></Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
