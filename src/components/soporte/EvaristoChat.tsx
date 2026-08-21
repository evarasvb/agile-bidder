import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Send, X, ImagePlus, Loader2, Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryStats } from "@/hooks/useInventory";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";

interface Msg { role: "user" | "assistant"; content: string; img?: string }

const LS_MSGS = "fvb_evaristo_msgs";
const LS_OPEN = "fvb_evaristo_open";

const SALUDO: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy Evaristo, tu asistente de firmavb. Cuéntame en qué estás y te ayudo al tiro. Por ejemplo: “¿cómo bajo la extensión?” o “no me aparecen oportunidades”. Si algo te da error, mándame un print. 📸",
};

// Divide una línea en: links de acción markdown [txt](/ruta) o [txt](http…),
// **negritas** y URLs sueltas. Todo sin HTML crudo.
const TOKEN = /(\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]+)\)|\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g;
const MD_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

// Renderiza el texto de Evaristo con negritas y links (internos = botón que
// navega dentro de la app; externos = nueva pestaña).
function Rico({ text, onInternal }: { text: string; onInternal: (path: string) => void }) {
  return (
    <>
      {text.split("\n").map((linea, i) => (
        <span key={i} className="block">
          {linea.split(TOKEN).map((frag, j) => {
            const md = frag.match(MD_LINK);
            if (md) {
              const [, txt, href] = md;
              if (href.startsWith("/")) {
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => onInternal(href)}
                    className="inline-flex items-center gap-1 my-0.5 rounded-full bg-firmavb-blue/10 text-firmavb-blue hover:bg-firmavb-blue/20 font-medium px-2.5 py-1 text-[13px] transition-colors"
                  >
                    {txt} →
                  </button>
                );
              }
              return <a key={j} href={href} target="_blank" rel="noreferrer" className="underline text-firmavb-blue break-all">{txt}</a>;
            }
            if (frag.startsWith("**") && frag.endsWith("**")) return <strong key={j}>{frag.slice(2, -2)}</strong>;
            if (/^https?:\/\//.test(frag)) return (
              <a key={j} href={frag} target="_blank" rel="noreferrer" className="underline text-firmavb-blue break-all">{frag}</a>
            );
            return <span key={j}>{frag}</span>;
          })}
        </span>
      ))}
    </>
  );
}

const nombrePagina = (path: string): string => {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard", "/inventario": "Inventario", "/mis-oportunidades": "Mis Oportunidades",
    "/licitaciones": "Licitaciones", "/compras-agiles": "Compras Ágiles", "/oportunidades": "Oportunidades",
    "/configuracion/extension": "Configuración · Extensión", "/reportes": "Reportes", "/cuenta": "Cuenta",
    "/planes": "Planes", "/onboarding": "Onboarding",
  };
  const hit = Object.keys(map).find((k) => path.startsWith(k));
  return hit ? map[hit] : path;
};

export function EvaristoChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: invStats } = useInventoryStats();
  const { isConnected } = useExtensionStatus();

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(LS_OPEN) === "1"; } catch { return false; }
  });
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(LS_MSGS);
      return raw ? JSON.parse(raw) : [SALUDO];
    } catch { return [SALUDO]; }
  });
  const [input, setInput] = useState("");
  const [img, setImg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(LS_MSGS, JSON.stringify(msgs.slice(-30))); } catch { /* noop */ } }, [msgs]);
  useEffect(() => { try { localStorage.setItem(LS_OPEN, open ? "1" : "0"); } catch { /* noop */ } }, [open]);
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, loading]);

  const onPickImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { alert("La imagen es muy grande (máx 4MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setImg(String(reader.result));
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const enviar = async () => {
    const texto = input.trim();
    if ((!texto && !img) || loading) return;

    const userMsg: Msg = { role: "user", content: texto || "Te mando una captura 📸", img: img || undefined };
    const historial = [...msgs, userMsg];
    setMsgs(historial);
    setInput("");
    const imagen = img;
    setImg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("evaristo-soporte", {
        body: {
          messages: historial.map((m) => ({ role: m.role, content: m.content })),
          contexto: {
            page: nombrePagina(location.pathname),
            tieneInventario: (invStats?.total ?? 0) > 0,
            extensionConectada: !!isConnected,
          },
          imagen,
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "No te entendí bien 😅 ¿me lo repites?";
      setMsgs((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: "Uf, no pude responderte. Reintenta en un ratito 🙏" }]);
    } finally {
      setLoading(false);
    }
  };

  const limpiar = () => { setMsgs([SALUDO]); setImg(null); };

  return (
    <>
      {/* Burbuja flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-firmavb-blue text-white pl-3 pr-4 py-3 shadow-lg hover:bg-firmavb-blue/90 transition-all hover:scale-105"
          aria-label="Abrir ayuda de Evaristo"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-firmavb-green ring-2 ring-firmavb-blue" />
          </span>
          <span className="text-sm font-semibold hidden sm:block">¿Te ayudo?</span>
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:right-5 sm:bottom-5 z-50 w-auto sm:w-[380px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-slide-in" style={{ height: "min(70vh, 560px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-firmavb-blue to-indigo-700 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Bot className="h-5 w-5" /></span>
              <div className="leading-tight">
                <p className="font-semibold text-sm">Evaristo</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-firmavb-green inline-block" /> Asistente de firmavb
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://wa.me/56990996055"
                target="_blank"
                rel="noreferrer"
                title="Hablar con un humano por WhatsApp"
                className="flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-2.5 h-7 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Humano
              </a>
              <Button variant="ghost" size="sm" onClick={limpiar} className="text-white/80 hover:text-white hover:bg-white/10 h-7 px-2 text-xs">Reiniciar</Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-white hover:bg-white/10 h-7 w-7"><X className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/20">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-firmavb-blue/10 text-firmavb-blue mr-2 mt-0.5"><Sparkles className="h-4 w-4" /></span>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-firmavb-blue text-white rounded-br-sm" : "bg-card border border-border/60 rounded-bl-sm"
                }`}>
                  {m.img && <img src={m.img} alt="captura" className="rounded-lg mb-1.5 max-h-40 w-auto" />}
                  <Rico text={m.content} onInternal={(path) => { navigate(path); if (window.innerWidth < 640) setOpen(false); }} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-firmavb-blue/10 text-firmavb-blue mr-2"><Sparkles className="h-4 w-4" /></span>
                <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Evaristo está escribiendo…
                </div>
              </div>
            )}
          </div>

          {/* Preview imagen */}
          {img && (
            <div className="px-3 pt-2 flex items-center gap-2">
              <div className="relative">
                <img src={img} alt="adjunto" className="h-12 w-12 rounded-lg object-cover border" />
                <button onClick={() => setImg(null)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center"><X className="h-2.5 w-2.5" /></button>
              </div>
              <span className="text-xs text-muted-foreground">Captura lista para enviar</span>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-2.5 flex items-end gap-2 bg-card">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImg} />
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} aria-label="Adjuntar captura">
              <ImagePlus className="h-5 w-5" />
            </Button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escribe tu duda…"
              rows={1}
              className="flex-1 resize-none max-h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
            />
            <Button size="icon" className="h-9 w-9 shrink-0 bg-firmavb-blue hover:bg-firmavb-blue/90" onClick={enviar} disabled={loading || (!input.trim() && !img)} aria-label="Enviar">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
