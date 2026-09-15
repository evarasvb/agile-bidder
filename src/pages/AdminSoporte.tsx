import { useMemo, useState } from "react";
import { LifeBuoy, Mail, Monitor, Building2, Phone, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  useTicketsAdmin, useActualizarEstadoTicket,
  ESTADO_LABEL, ESTADO_BADGE, type EstadoTicket, type SoporteTicket,
} from "@/hooks/useSoporteTickets";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";

const FILTROS: { key: EstadoTicket | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "abierto", label: "Abiertos" },
  { key: "en_proceso", label: "En proceso" },
  { key: "resuelto", label: "Resueltos" },
];

const ESTADOS: EstadoTicket[] = ["abierto", "en_proceso", "resuelto"];

const fmtFecha = (iso: string | null) => (iso ? format(new Date(iso), "d 'de' MMM, HH:mm", { locale: es }) : "");

/** Selector para cambiar el estado del ticket (columna "Acciones"). */
function SelectorEstado({ t }: { t: SoporteTicket }) {
  const actualizar = useActualizarEstadoTicket();
  return (
    <select
      value={t.estado}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => actualizar.mutate({ id: t.id, estado: e.target.value as EstadoTicket })}
      disabled={actualizar.isPending}
      aria-label={`Estado del ticket #${t.numero}`}
      className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-firmavb-blue/30"
    >
      {ESTADOS.map((e) => (
        <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
      ))}
    </select>
  );
}

/** Detalle del ticket (mensaje completo, datos de contacto y conversación). */
function TicketDetalle({ t, onCerrar }: { t: SoporteTicket; onCerrar: () => void }) {
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
            <span className="text-xs text-muted-foreground">{fmtFecha(t.created_at)}</span>
            {t.canal && <span className="text-xs text-muted-foreground">· {t.canal}</span>}
          </div>
          <p className="mt-1 text-sm font-semibold">{t.asunto || "Consulta"}</p>
        </div>
        <div className="flex items-center gap-2">
          <SelectorEstado t={t} />
          <Button variant="ghost" size="sm" onClick={onCerrar} aria-label="Cerrar detalle"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Identidad */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(t.nombre || t.email) && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {t.nombre ? `${t.nombre} · ` : ""}<a className="text-firmavb-blue hover:underline" href={`mailto:${t.email}`}>{t.email}</a></span>}
        {t.empresa && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {t.empresa}</span>}
        {t.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {t.telefono}</span>}
        {t.pantalla && <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {t.pantalla}</span>}
      </div>

      {t.mensaje && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm whitespace-pre-wrap">{t.mensaje}</div>
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

const COLUMNAS_TICKETS: DataTableColumn<SoporteTicket>[] = [
  {
    id: "numero",
    header: "N°",
    cell: (t) => <span className="font-mono text-xs text-muted-foreground">#{t.numero}</span>,
    sortValue: (t) => Number(t.numero || 0),
  },
  {
    id: "fecha",
    header: "Fecha",
    cell: (t) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtFecha(t.created_at)}</span>,
    sortValue: (t) => t.created_at,
    exportValue: (t) => fmtFecha(t.created_at),
  },
  {
    id: "cliente",
    header: "Cliente",
    cell: (t) => (
      <>
        <p className="font-medium truncate max-w-[220px]">{t.nombre || t.empresa || "—"}</p>
        <a className="text-xs text-firmavb-blue hover:underline" href={`mailto:${t.email}`} onClick={(e) => e.stopPropagation()}>{t.email}</a>
      </>
    ),
    sortValue: (t) => t.nombre || t.empresa || t.email,
    exportValue: (t) => [t.nombre, t.empresa, t.email].filter(Boolean).join(" · "),
  },
  {
    id: "asunto",
    header: "Asunto",
    className: "max-w-xs",
    cell: (t) => (
      <>
        <p className="text-sm font-medium truncate" title={t.asunto || "Consulta"}>{t.asunto || "Consulta"}</p>
        {t.mensaje && <p className="text-xs text-muted-foreground line-clamp-1" title={t.mensaje}>{t.mensaje}</p>}
      </>
    ),
    sortValue: (t) => t.asunto || "Consulta",
    exportValue: (t) => [t.asunto || "Consulta", t.mensaje].filter(Boolean).join(" — "),
  },
  {
    id: "canal",
    header: "Canal",
    cell: (t) => <span className="text-xs text-muted-foreground">{t.canal || "—"}</span>,
    sortValue: (t) => t.canal,
  },
  {
    id: "estado",
    header: "Estado",
    cell: (t) => (
      <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[t.estado]}`}>
        {ESTADO_LABEL[t.estado]}
      </span>
    ),
    sortValue: (t) => ESTADOS.indexOf(t.estado),
    exportValue: (t) => ESTADO_LABEL[t.estado],
  },
  // Encabezado como nodo (no texto) para que la columna quede fuera del CSV.
  { id: "acciones", header: <span>Acciones</span>, align: "right", cell: (t) => <SelectorEstado t={t} /> },
];

export default function AdminSoporte() {
  const [filtro, setFiltro] = useState<EstadoTicket | "todos">("todos");
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const { data: tickets = [], isLoading } = useTicketsAdmin(filtro);

  // Se busca por id para que el panel refleje cambios de estado al instante.
  const abierto = useMemo(() => tickets.find((t) => t.id === abiertoId) ?? null, [tickets, abiertoId]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-firmavb-blue/10 text-firmavb-blue"><LifeBuoy className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-bold leading-tight">Tickets de soporte</h1>
          <p className="text-sm text-muted-foreground">Casos que Don Evaristo canalizó al equipo. Responde al correo del cliente y marca el estado. Haz clic en una fila para ver el mensaje completo.</p>
        </div>
      </div>

      <DataTable<SoporteTicket>
        storageKey="soporte-tickets"
        rows={tickets}
        rowKey={(t) => t.id}
        loading={isLoading}
        itemLabel="tickets"
        columns={COLUMNAS_TICKETS}
        searchText={(t) => `#${t.numero} ${t.nombre ?? ""} ${t.email} ${t.empresa ?? ""} ${t.asunto ?? ""} ${t.mensaje ?? ""} ${t.canal ?? ""}`}
        searchPlaceholder="Buscar por número, cliente, correo o asunto…"
        defaultSort={{ id: "fecha", dir: "desc" }}
        exportFileName="tickets-soporte"
        emptyMessage={`No hay tickets ${filtro !== "todos" ? `en estado "${ESTADO_LABEL[filtro as EstadoTicket]}"` : "todavía"}.`}
        onRowClick={(t) => setAbiertoId((prev) => (prev === t.id ? null : t.id))}
        rowClassName={(t) => (t.id === abiertoId ? "bg-firmavb-blue/5" : undefined)}
        maxHeight={abierto ? "45vh" : undefined}
        toolbar={
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
        }
      />

      {abierto && <TicketDetalle t={abierto} onCerrar={() => setAbiertoId(null)} />}
    </div>
  );
}
