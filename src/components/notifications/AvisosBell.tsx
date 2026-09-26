import { useState } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useAvisos, useMarcarAvisosLeidos, useMarcarAvisoLeido, type Aviso } from "@/hooks/useAvisos";

function icono(tipo: string) {
  switch (tipo) {
    case "nueva_licitacion": return "📋";
    case "nuevo_match": return "🎯";
    case "cierre_proximo": return "⏰";
    case "adjudicacion": return "🏆";
    default: return "🔔";
  }
}

function titulo(a: Aviso) {
  const d = a.datos || {};
  return d.licitacion_titulo || d.titulo || "Nuevo aviso";
}
function subtitulo(a: Aviso) {
  const d = a.datos || {};
  return d.organismo || d.institucion || (a.licitacion_id ? `Código ${a.licitacion_id}` : "");
}
// Licitaciones y compras ágiles comparten esta misma tabla de avisos, pero
// /oportunidades/:tipo/:id necesita distinguir cuál es cuál. Los avisos
// nuevos ya traen `tipo_oportunidad`; los generados antes de ese cambio no,
// así que se asume "licitacion" (el tipo más común hasta ahora).
function hrefOportunidad(a: Aviso): string | null {
  if (!a.licitacion_id) return null;
  const tipo = a.datos?.tipo_oportunidad === "compra_agil" ? "compra_agil" : "licitacion";
  return `/oportunidades/${tipo}/${a.licitacion_id}`;
}
function fecha(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

interface Props {
  className?: string;
}

// Campanita de avisos: muestra las notificaciones persistentes del cliente
// (notificaciones_log), con contador de no leídas y opción de marcarlas.
export function AvisosBell({ className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: avisos = [] } = useAvisos();
  const marcarTodas = useMarcarAvisosLeidos();
  const marcarUna = useMarcarAvisoLeido();

  const noLeidas = avisos.filter((a) => !a.leida).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)} aria-label="Avisos">
          <Bell className="h-5 w-5" />
          {noLeidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-firmavb-red px-1 text-[10px] font-bold text-white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Avisos</span>
            {noLeidas > 0 && <Badge variant="secondary" className="text-xs">{noLeidas} nuevos</Badge>}
          </div>
          {noLeidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => marcarTodas.mutate()}
              disabled={marcarTodas.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
            </Button>
          )}
        </div>

        {avisos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 opacity-40" />
            <p className="text-sm">No tienes avisos todavía.</p>
            <p className="text-xs">Sigue instituciones en tu panel y te avisamos cuando publiquen algo nuevo.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {avisos.map((a) => {
                const href = hrefOportunidad(a);
                const contenido = (
                  <>
                    <span className="text-lg leading-none">{icono(a.tipo)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{titulo(a)}</p>
                      {subtitulo(a) && <p className="truncate text-xs text-muted-foreground">{subtitulo(a)}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{fecha(a.created_at)}</p>
                    </div>
                    {!a.leida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-firmavb-blue" />}
                  </>
                );
                const onClick = () => {
                  if (!a.leida) marcarUna.mutate(a.id);
                  setOpen(false);
                };
                // Sin código de licitación/compra ágil asociado, no hay a dónde
                // llevar al usuario: se deja como fila no clickeable (solo marca leído).
                return href ? (
                  <li key={a.id} className={cn(!a.leida && "bg-firmavb-blue/5")}>
                    <Link
                      to={href}
                      onClick={onClick}
                      className="flex gap-3 p-3 text-sm hover:bg-muted/60 transition-colors"
                    >
                      {contenido}
                    </Link>
                  </li>
                ) : (
                  <li
                    key={a.id}
                    className={cn("flex gap-3 p-3 text-sm cursor-pointer", !a.leida && "bg-firmavb-blue/5")}
                    onClick={onClick}
                  >
                    {contenido}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
            <Link to="/oportunidades">Ver mis oportunidades</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AvisosBell;
