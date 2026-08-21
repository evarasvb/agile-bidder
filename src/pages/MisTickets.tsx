import { useState } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, ChevronDown, MessageCircle, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useMisTickets, ESTADO_LABEL, ESTADO_BADGE, type SoporteTicket } from "@/hooks/useSoporteTickets";

function EstadoBadge({ estado }: { estado: SoporteTicket["estado"] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

function TicketCard({ t }: { t: SoporteTicket }) {
  const [abierto, setAbierto] = useState(false);
  const conv = t.conversacion || [];
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{t.numero}</span>
            <EstadoBadge estado={t.estado} />
            <span className="text-xs text-muted-foreground">
              {t.created_at ? format(new Date(t.created_at), "d 'de' MMM, HH:mm", { locale: es }) : ""}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium truncate">{t.asunto || "Consulta"}</p>
          {t.mensaje && <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{t.mensaje}</p>}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && conv.length > 0 && (
        <div className="border-t border-border/60 px-4 py-3 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground">Conversación</p>
          {conv.filter((m) => m.content).map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                m.role === "user" ? "bg-firmavb-blue text-white rounded-br-sm" : "bg-card border border-border/60 rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            El equipo te responde por correo a <span className="font-medium">{t.email}</span>.
          </p>
        </div>
      )}
    </div>
  );
}

export default function MisTickets() {
  const { data: tickets, isLoading } = useMisTickets();
  const { user } = useAuth();
  const esFundador = (user?.email || "").toLowerCase() === "evaras@firmavb.cl";

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="p-2.5 rounded-xl bg-firmavb-blue/10 text-firmavb-blue"><LifeBuoy className="h-6 w-6" /></div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight">Mis consultas</h1>
          <p className="text-sm text-muted-foreground">El estado de los casos que dejaste con nuestro equipo.</p>
        </div>
        {esFundador && (
          <Link
            to="/admin/soporte"
            className="inline-flex items-center gap-1.5 rounded-lg border border-firmavb-blue/30 bg-firmavb-blue/5 px-3 py-1.5 text-sm font-medium text-firmavb-blue hover:bg-firmavb-blue/10"
          >
            <ShieldCheck className="h-4 w-4" /> Ver todos (admin)
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Aún no has dejado ninguna consulta</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ¿Necesitas ayuda? Abre el asistente <span className="font-medium text-firmavb-blue">Evaristo</span> (abajo a la derecha) y toca
            «¿Prefieres que te contacte el equipo?». Aquí verás el estado de tu caso.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => <TicketCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
