import { useState } from "react";
import { LifeBuoy, Loader2, Mail, Monitor, Building2, Phone } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  useTicketsAdmin, useActualizarEstadoTicket,
  ESTADO_LABEL, ESTADO_BADGE, type EstadoTicket, type SoporteTicket,
} from "@/hooks/useSoporteTickets";

const FILTROS: { key: EstadoTicket | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "abierto", label: "Abiertos" },
  { key: "en_proceso", label: "En proceso" },
  { key: "resuelto", label: "Resueltos" },
];

function TicketRow({ t }: { t: SoporteTicket }) {
  const actualizar = useActualizarEstadoTicket();
  const conv = t.conversacion || [];
  const [verConv, setVerConv] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{t.numero}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[t.estado]}`}>
              {ESTADO_LABEL[t.estado]}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.created_at ? format(new Date(t.created_at), "d 'de' MMM, HH:mm", { locale: es }) : ""}
            </span>
            {t.canal && <span className="text-xs text-muted-foreground">· {t.canal}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold">{t.asunto || "Consulta"}</p>
        </div>
        {/* Cambiar estado */}
        <select
          value={t.estado}
          onChange={(e) => actualizar.mutate({ id: t.id, estado: e.target.value as EstadoTicket })}
          disabled={actualizar.isPending}
          className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
        >
          {(["abierto", "en_proceso", "resuelto"] as EstadoTicket[]).map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
      </div>

      {/* Identidad */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(t.nombre || t.email) && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {t.nombre ? `${t.nombre} · ` : ""}<a className="text-firmavb-blue hover:underline" href={`mailto:${t.email}`}>{t.email}</a></span>}
        {t.empresa && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {t.empresa}</span>}
        {t.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {t.telefono}</span>}
        {t.pantalla && <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {t.pantalla}</span>}
      </div>

      {t.mensaje && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm">{t.mensaje}</div>
      )}

      {conv.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setVerConv((v) => !v)} className="text-xs font-medium text-firmavb-blue hover:underline">
            {verConv ? "Ocultar conversación" : `Ver conversación (${conv.length})`}
          </button>
          {verConv && (
            <div className="mt-2 space-y-1.5">
              {conv.filter((m) => m.content).map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${
                    m.role === "user" ? "bg-firmavb-blue text-white rounded-br-sm" : "bg-muted border border-border/60 rounded-bl-sm"
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminSoporte() {
  const [filtro, setFiltro] = useState<EstadoTicket | "todos">("todos");
  const { data: tickets, isLoading } = useTicketsAdmin(filtro);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-firmavb-blue/10 text-firmavb-blue"><LifeBuoy className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Tickets de soporte</h1>
          <p className="text-sm text-muted-foreground">Casos que Evaristo canalizó al equipo. Responde al correo del cliente y marca el estado.</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filtro === f.key ? "bg-firmavb-blue text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay tickets {filtro !== "todos" ? `en estado "${ESTADO_LABEL[filtro as EstadoTicket]}"` : "todavía"}.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => <TicketRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
