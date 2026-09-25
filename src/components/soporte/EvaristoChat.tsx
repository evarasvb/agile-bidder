import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Send, X, ImagePlus, Loader2, Bot, MessageCircle, LifeBuoy, CheckCircle2, Zap, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryStats } from "@/hooks/useInventory";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";

// Acción que Don Evaristo dejó en cola y la extensión de Chrome ejecuta en Mercado Público.
interface AccionChat {
  id: string;
  tipo: string;
  codigo: string | null;
  estado: string; // confirmar | pendiente | en_curso | hecha | fallida | cancelada
  error?: string | null;
  resultado?: Record<string, unknown> | null;
}
interface Msg { role: "user" | "assistant"; content: string; img?: string; acciones?: AccionChat[] }

const NOMBRE_ACCION: Record<string, string> = {
  sincronizar_licitacion: "Sincronizar licitación y bases",
  sincronizar_ca: "Traer documentos de la compra ágil",
  preparar_oferta: "Dejar la oferta lista en Mercado Público",
  publicar_cm: "Publicar productos en Convenio Marco",
};
const ESTADO_ACCION: Record<string, { label: string; cls: string }> = {
  confirmar: { label: "Esperando tu confirmación", cls: "bg-amber-100 text-amber-800" },
  pendiente: { label: "En cola · la extensión la toma en 1 min", cls: "bg-sky-100 text-sky-800" },
  en_curso: { label: "Ejecutando en tu Chrome…", cls: "bg-sky-100 text-sky-800" },
  hecha: { label: "Hecha", cls: "bg-emerald-100 text-emerald-800" },
  fallida: { label: "Falló", cls: "bg-rose-100 text-rose-800" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};
const ACTIVAS = new Set(["confirmar", "pendiente", "en_curso"]);

function resumenResultado(a: AccionChat): string | null {
  const r = a.resultado || {};
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  if (a.estado !== "hecha") return null;
  if (a.tipo === "sincronizar_licitacion") return `Ficha sincronizada · ${n("adjuntos") ?? 0} adjunto(s) a FirmaVB${n("bases_pdf") ? ` · ${n("bases_pdf")} PDF que el Experto leerá` : ""}`;
  if (a.tipo === "sincronizar_ca") return n("documentos") ? `${n("documentos")} documento(s) a FirmaVB` : "Sin documentos nuevos (ya estaban o no tiene)";
  if (a.tipo === "preparar_oferta") return `Oferta abierta en Mercado Público (${n("productos") ?? 0} producto(s)). Revísala y envíala tú.`;
  if (a.tipo === "publicar_cm") return `${n("guardados") ?? 0} publicado(s) · ${n("saltados") ?? 0} saltado(s) · ${n("sin_precio") ?? 0} sin precio`;
  return null;
}

function AccionCard({ a, onDecidir }: { a: AccionChat; onDecidir: (id: string, confirmar: boolean) => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false);
  const est = ESTADO_ACCION[a.estado] ?? { label: a.estado, cls: "bg-muted" };
  const decidir = async (ok: boolean) => { setOcupado(true); try { await onDecidir(a.id, ok); } finally { setOcupado(false); } };
  const resumen = resumenResultado(a);
  return (
    <div className="mt-2 rounded-xl border border-border/70 bg-background px-2.5 py-2 text-xs space-y-1.5">
      <div className="flex items-start gap-1.5">
        {a.estado === "hecha" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" /> :
         a.estado === "fallida" ? <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" /> :
         a.estado === "en_curso" ? <Loader2 className="h-3.5 w-3.5 text-sky-600 shrink-0 mt-0.5 animate-spin" /> :
         a.estado === "confirmar" ? <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" /> :
         <Zap className="h-3.5 w-3.5 text-firmavb-blue shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{NOMBRE_ACCION[a.tipo] ?? a.tipo}{a.codigo ? <span className="font-normal text-muted-foreground"> · {a.codigo}</span> : null}</p>
          <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${est.cls}`}>{est.label}</span>
        </div>
      </div>
      {resumen && <p className="text-muted-foreground">{resumen}</p>}
      {a.estado === "fallida" && a.error && <p className="text-rose-700">{a.error}</p>}
      {a.estado === "confirmar" && (
        <div className="flex gap-1.5">
          <Button size="sm" className="h-7 text-xs bg-firmavb-blue hover:bg-firmavb-blue/90" disabled={ocupado} onClick={() => decidir(true)}>
            {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar</>}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={ocupado} onClick={() => decidir(false)}>Cancelar</Button>
        </div>
      )}
      {a.estado === "pendiente" && (
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" disabled={ocupado} onClick={() => decidir(false)}>Cancelar</Button>
      )}
    </div>
  );
}

const LS_MSGS = "fvb_evaristo_msgs";
const LS_OPEN = "fvb_evaristo_open";
const LS_CONV = "fvb_evaristo_conv";

const SALUDO: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy Don Evaristo, tu experto en Mercado Público y en FirmaVB. Cuéntame en qué estás y te ayudo al tiro. Por ejemplo: “¿cómo bajo la extensión?” o “¿me conviene esta licitación?”. Si algo te da error, mándame un print. 📸",
};

// Código de licitación o compra ágil en la URL (ej: /licitaciones/1234-56-LE26).
const RE_CODIGO = /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/i;
const codigoEnRuta = (path: string): string | null => {
  const hit = path.split("/").filter(Boolean).map(decodeURIComponent).find((s) => RE_CODIGO.test(s));
  return hit ? hit.toUpperCase() : null;
};

// Tablas de memoria de Don Evaristo (aún no están en los tipos generados).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
              return <a key={j} href={href} target="_blank" rel="noreferrer" className="underline text-firmavb-blue break-all" aria-label={`${txt} (abre en nueva pestaña)`}>{txt}</a>;
            }
            if (frag.startsWith("**") && frag.endsWith("**")) return <strong key={j}>{frag.slice(2, -2)}</strong>;
            if (/^https?:\/\//.test(frag)) return (
              <a key={j} href={frag} target="_blank" rel="noreferrer" className="underline text-firmavb-blue break-all" aria-label={`${frag} (abre en nueva pestaña)`}>{frag}</a>
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

  // Identidad del usuario (para canalizar el caso al equipo).
  const [identidad, setIdentidad] = useState<{ userId?: string; email?: string }>({});
  // Estado del formulario "Dejar mi caso al equipo".
  const [escalando, setEscalando] = useState(false);
  const [escEmail, setEscEmail] = useState("");
  const [escNombre, setEscNombre] = useState("");
  const [escMensaje, setEscMensaje] = useState("");
  const [enviandoTicket, setEnviandoTicket] = useState(false);

  // Memoria: id de la conversación abierta (se guarda en Supabase, sobrevive al
  // dispositivo) y último código sobre el que Don Evaristo ya saludó.
  const [convId, setConvId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_CONV); } catch { return null; }
  });
  const historialCargado = useRef(false);
  const ultimoSaludo = useRef<string | null>(null);
  const codigo = codigoEnRuta(location.pathname);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (u) setIdentidad({ userId: u.id, email: u.email ?? undefined });
    }).catch(() => { /* sin sesión (landing): pediremos el correo en el form) */ });
  }, []);

  // Saludo con contexto (sin IA): qué está mirando, qué le urge, qué le falta.
  const saludar = async (codigoActual: string | null, reemplazar: boolean) => {
    try {
      const { data } = await supabase.functions.invoke("evaristo-soporte", { body: { modo: "contexto", contexto: { codigo: codigoActual } } });
      const saludo = (data as any)?.saludo as string | undefined;
      if (!saludo) return;
      ultimoSaludo.current = codigoActual ?? "";
      setMsgs((prev) => {
        if (reemplazar) return [{ role: "assistant", content: saludo }];
        const ultimo = prev[prev.length - 1];
        return ultimo?.role === "assistant" && ultimo.content === saludo ? prev : [...prev, { role: "assistant", content: saludo }];
      });
    } catch { /* sin contexto: queda el saludo genérico */ }
  };

  // Al entrar con sesión: retomar la última conversación guardada; si no hay,
  // pedir un saludo con contexto en vez del genérico.
  useEffect(() => {
    if (!identidad.userId || historialCargado.current) return;
    historialCargado.current = true;
    (async () => {
      try {
        let id = convId;
        if (!id) {
          const { data: conv } = await db.from("evaristo_conversaciones").select("id").eq("user_id", identidad.userId)
            .order("actualizado_en", { ascending: false }).limit(1).maybeSingle();
          id = conv?.id ?? null;
        }
        if (id) {
          const { data: rows } = await db.from("evaristo_mensajes").select("rol, contenido, adjuntos, meta").eq("conversacion_id", id)
            .order("id", { ascending: false }).limit(30);
          const cargados: Msg[] = (rows ?? []).reverse().map((r: any) => ({
            role: r.rol, content: r.contenido,
            acciones: Array.isArray(r.meta?.acciones) && r.meta.acciones.length ? r.meta.acciones : undefined,
          }));
          // El estado guardado en el mensaje es el del momento: se refresca con el real.
          const ids = cargados.flatMap((m) => (m.acciones ?? []).map((a) => a.id));
          if (ids.length) {
            const { data: vivas } = await db.from("evaristo_acciones").select("id, estado, error, resultado").in("id", ids);
            const porId = new Map<string, AccionChat>((vivas ?? []).map((v: AccionChat) => [v.id, v]));
            for (const m of cargados) m.acciones = m.acciones?.map((a) => ({ ...a, ...(porId.get(a.id) ?? {}) }));
          }
          if (cargados.length) {
            setConvId(id);
            setMsgs(cargados);
            if (open && codigo && codigo !== ultimoSaludo.current) await saludar(codigo, false);
            return;
          }
        }
        await saludar(codigo, msgs.length <= 1);
      } catch { /* sin memoria: seguimos con localStorage */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidad.userId]);

  // Al abrir el chat mirando una licitación/compra ágil nueva, Don Evaristo la comenta.
  useEffect(() => {
    if (!open || !identidad.userId || !historialCargado.current || !codigo || codigo === ultimoSaludo.current || loading) return;
    saludar(codigo, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, codigo, identidad.userId]);

  // Estado en vivo de las acciones: realtime sobre evaristo_acciones y, de respaldo,
  // un sondeo cada 20 s mientras haya alguna en cola o en curso.
  const actualizarAccion = (fila: Partial<AccionChat> & { id: string }) => {
    setMsgs((prev) => prev.map((m) => m.acciones?.some((a) => a.id === fila.id)
      ? { ...m, acciones: m.acciones!.map((a) => (a.id === fila.id ? { ...a, ...fila } : a)) }
      : m));
  };
  useEffect(() => {
    if (!identidad.userId) return;
    const canal = db.channel("evaristo-acciones-" + identidad.userId)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "evaristo_acciones", filter: `user_id=eq.${identidad.userId}` },
        (p: { new: AccionChat }) => { if (p?.new?.id) actualizarAccion(p.new); })
      .subscribe();
    return () => { db.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identidad.userId]);
  const activasKey = msgs.flatMap((m) => (m.acciones ?? []).filter((a) => ACTIVAS.has(a.estado)).map((a) => a.id)).join(",");
  useEffect(() => {
    if (!activasKey || !identidad.userId) return;
    const ids = activasKey.split(",");
    const t = setInterval(async () => {
      const { data } = await db.from("evaristo_acciones").select("id, estado, error, resultado").in("id", ids);
      (data ?? []).forEach((f: AccionChat) => actualizarAccion(f));
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activasKey, identidad.userId]);

  const decidirAccion = async (id: string, confirmar: boolean) => {
    const { data, error } = await db.rpc("evaristo_accion_decidir", { p_id: id, p_confirmar: confirmar });
    if (error) { alert("No pude actualizar la acción: " + error.message); return; }
    if (data?.id) actualizarAccion(data as AccionChat);
  };

  useEffect(() => { try { localStorage.setItem(LS_MSGS, JSON.stringify(msgs.slice(-30))); } catch { /* noop */ } }, [msgs]);
  useEffect(() => {
    try { if (convId) localStorage.setItem(LS_CONV, convId); else localStorage.removeItem(LS_CONV); } catch { /* noop */ }
  }, [convId]);
  useEffect(() => { try { localStorage.setItem(LS_OPEN, open ? "1" : "0"); } catch { /* noop */ } }, [open]);
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open, loading]);

  const cargarArchivo = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    if (f.size > 4 * 1024 * 1024) { alert("La imagen es muy grande (máx 4MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => setImg(String(reader.result));
    reader.readAsDataURL(f);
  };

  const onPickImg = (e: React.ChangeEvent<HTMLInputElement>) => {
    cargarArchivo(e.target.files?.[0]);
    e.target.value = "";
  };

  // Pegar un print (Ctrl/Cmd+V) directo en el chat.
  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
    if (item) {
      e.preventDefault();
      cargarArchivo(item.getAsFile());
    }
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
            ruta: location.pathname,
            codigo,
            tieneInventario: (invStats?.total ?? 0) > 0,
            extensionConectada: !!isConnected,
          },
          identidad,
          imagen,
          conversacion_id: convId,
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || "No te entendí bien 😅 ¿me lo repites?";
      const nuevoId = (data as any)?.conversacion_id;
      if (typeof nuevoId === "string" && nuevoId !== convId) setConvId(nuevoId);
      const acciones = (data as any)?.acciones as AccionChat[] | undefined;
      setMsgs((prev) => [...prev, { role: "assistant", content: reply, acciones: acciones?.length ? acciones : undefined }]);
    } catch {
      setMsgs((prev) => [...prev, { role: "assistant", content: "Uf, no pude responderte. Reintenta en un ratito 🙏" }]);
    } finally {
      setLoading(false);
    }
  };

  // Nueva conversación: la anterior queda guardada en la memoria de Don Evaristo.
  const limpiar = () => {
    setMsgs([SALUDO]);
    setImg(null);
    setConvId(null);
    ultimoSaludo.current = null;
    if (identidad.userId) saludar(codigo, true);
  };

  // Abre el formulario para dejar el caso al equipo, prellenando lo que sabemos.
  const abrirEscalar = () => {
    setEscEmail((prev) => prev || identidad.email || "");
    // Prellenamos el mensaje con la última duda escrita por el usuario.
    const ultimaDuda = [...msgs].reverse().find((m) => m.role === "user" && m.content && !m.img);
    setEscMensaje((prev) => prev || (ultimaDuda?.content ?? ""));
    setEscalando(true);
  };

  const enviarTicket = async () => {
    const email = escEmail.trim().toLowerCase();
    const mensaje = escMensaje.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert("Escribe un correo válido para poder responderte."); return; }
    if (!mensaje) { alert("Cuéntanos brevemente tu caso."); return; }
    setEnviandoTicket(true);
    try {
      const { data, error } = await supabase.functions.invoke("soporte-ticket", {
        body: {
          email,
          nombre: escNombre.trim() || undefined,
          user_id: identidad.userId,
          canal: identidad.userId ? "app" : "landing",
          pantalla: nombrePagina(location.pathname),
          mensaje,
          conversacion: msgs
            .filter((m) => m.content)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const numero = (data as any)?.numero;
      setEscalando(false);
      setEscMensaje("");
      setMsgs((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            `✅ ¡Listo! Registré tu caso${numero ? ` con el número **#${numero}**` : ""}. ` +
            `Te envié un correo de confirmación a **${email}** y el equipo te responderá ahí lo antes posible. ` +
            `Si es urgente, escríbenos por WhatsApp: https://wa.me/56994259157`,
        },
      ]);
    } catch {
      alert("No pude enviar tu caso ahora. Reintenta en un ratito o escríbenos a contacto@firmavb.cl.");
    } finally {
      setEnviandoTicket(false);
    }
  };

  // Dentro del Experto el asistente flotante tapa el cuadro de pregunta.
  // Este chequeo va DESPUÉS de todos los hooks (no antes): si el usuario navega
  // entre /experto y el resto de la app sin que el componente se desmonte, un
  // return temprano antes de los hooks cambia cuántos hooks se llaman entre
  // renders, lo que rompe React ("Rendered fewer hooks than expected").
  if (location.pathname.startsWith("/experto")) return null;

  return (
    <>
      {/* Burbuja flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-firmavb-blue text-white pl-3 pr-4 py-3 shadow-lg hover:bg-firmavb-blue/90 transition-all hover:scale-105"
          aria-label="Abrir ayuda de Don Evaristo"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-firmavb-green ring-2 ring-firmavb-blue" />
          </span>
          <span className="text-sm font-semibold hidden sm:block">Don Evaristo · ¿Te ayudo?</span>
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
                <p className="font-semibold text-sm">Don Evaristo</p>
                <p className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-firmavb-green inline-block" /> Experto en Mercado Público · firmavb
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="https://wa.me/56994259157"
                target="_blank"
                rel="noreferrer"
                aria-label="Hablar con un humano por WhatsApp (abre en nueva ventana)"
                className="flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium px-2.5 h-7 transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> Humano
              </a>
              <Button variant="ghost" size="sm" onClick={limpiar} title="Empezar una conversación nueva (la anterior queda guardada)" className="text-white/80 hover:text-white hover:bg-white/10 h-7 px-2 text-xs">Nueva</Button>
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
                  {m.acciones?.map((a) => <AccionCard key={a.id} a={a} onDecidir={decidirAccion} />)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-firmavb-blue/10 text-firmavb-blue mr-2"><Sparkles className="h-4 w-4" /></span>
                <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Don Evaristo está escribiendo…
                </div>
              </div>
            )}
          </div>

          {/* Preview imagen */}
          {!escalando && img && (
            <div className="px-3 pt-2 flex items-center gap-2">
              <div className="relative">
                <img src={img} alt="adjunto" className="h-12 w-12 rounded-lg object-cover border" />
                <button onClick={() => setImg(null)} className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center"><X className="h-2.5 w-2.5" /></button>
              </div>
              <span className="text-xs text-muted-foreground">Captura lista para enviar</span>
            </div>
          )}

          {escalando ? (
            /* Canalizar el caso al equipo: deja REGISTRO (ticket) y manda correo a
               contacto@firmavb.cl. El equipo responde al correo del cliente. */
            <div className="border-t border-border p-3 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><LifeBuoy className="h-4 w-4 text-firmavb-blue" /> Dejar mi caso al equipo</p>
                <button onClick={() => setEscalando(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cancelar"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-xs text-muted-foreground">Te responderemos por correo y queda registrado para hacerle seguimiento. Adjuntamos tu conversación con Evaristo.</p>
              <input
                type="email"
                value={escEmail}
                onChange={(e) => setEscEmail(e.target.value)}
                placeholder="Tu correo (para responderte)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
              />
              <input
                type="text"
                value={escNombre}
                onChange={(e) => setEscNombre(e.target.value)}
                placeholder="Tu nombre (opcional)"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
              />
              <textarea
                value={escMensaje}
                onChange={(e) => setEscMensaje(e.target.value)}
                placeholder="Cuéntanos tu caso…"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
              />
              <Button onClick={enviarTicket} disabled={enviandoTicket} className="w-full bg-firmavb-blue hover:bg-firmavb-blue/90">
                {enviandoTicket
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Enviando…</>
                  : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Enviar mi caso al equipo</>}
              </Button>
            </div>
          ) : (
            <>
              {/* CTA sutil: canalizar al equipo cuando el chat no basta */}
              <button
                onClick={abrirEscalar}
                className="w-full flex items-center justify-center gap-1.5 border-t border-border py-2 text-xs font-medium text-firmavb-blue hover:bg-firmavb-blue/5 transition-colors"
              >
                <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> ¿Prefieres que te contacte el equipo?
              </button>

              {/* Input */}
              <div className="border-t border-border p-2.5 flex items-end gap-2 bg-card">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImg} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileRef.current?.click()} aria-label="Adjuntar captura">
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                </Button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  onPaste={onPaste}
                  placeholder="Escribe tu duda… (puedes pegar un print)"
                  rows={1}
                  className="flex-1 resize-none max-h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
                />
                <Button size="icon" className="h-9 w-9 shrink-0 bg-firmavb-blue hover:bg-firmavb-blue/90" onClick={enviar} disabled={loading || (!input.trim() && !img)} aria-label="Enviar">
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
