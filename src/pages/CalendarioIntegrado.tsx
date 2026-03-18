import { useState, useMemo, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { EventClickArg, DateSelectArg } from "@fullcalendar/core";
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Filter,
  X,
  ExternalLink,
  DollarSign,
  Building2,
  User,
  Tag,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, parseISO, isFuture, isToday, compareAsc } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  useCalendarioIntegrado,
  type CalendarioEvent,
  type TipoEventoCalendario,
  type RepetirEvento,
  type CreateEventInput,
} from "@/hooks/useCalendarioIntegrado";
import { useNavigate } from "react-router-dom";

// ── Color / type config ────────────────────────────────────────────
const typeFilters = [
  { key: "deadline_red", label: "Cierres Urgentes", color: "bg-red-500", dotColor: "bg-red-500" },
  { key: "deadline_yellow", label: "Cierres Próximos", color: "bg-amber-500", dotColor: "bg-amber-500" },
  { key: "pipeline", label: "Pipeline", color: "bg-blue-500", dotColor: "bg-blue-500" },
  { key: "won", label: "Adjudicadas / OC", color: "bg-green-500", dotColor: "bg-green-500" },
  { key: "team", label: "Tareas Equipo", color: "bg-purple-500", dotColor: "bg-purple-500" },
  { key: "custom", label: "Eventos Manuales", color: "bg-gray-500", dotColor: "bg-gray-500" },
] as const;

type FilterKey = (typeof typeFilters)[number]["key"];

const formatMonto = (monto: number) => {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toFixed(1)}M`;
  if (monto >= 1_000) return `$${(monto / 1_000).toFixed(0)}K`;
  return `$${monto.toLocaleString("es-CL")}`;
};

// ── Component ──────────────────────────────────────────────────────
export default function CalendarioIntegrado() {
  const navigate = useNavigate();
  const calendarRef = useRef<FullCalendar>(null);
  const { events, isLoading, createEvent } = useCalendarioIntegrado();

  // Filters
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    new Set(typeFilters.map((f) => f.key))
  );
  const [showSidebar, setShowSidebar] = useState(true);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<CalendarioEvent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormDate, setAddFormDate] = useState<string>("");

  // Add event form state
  const [newEvent, setNewEvent] = useState<CreateEventInput>({
    titulo: "",
    descripcion: "",
    tipo: "otro",
    fecha_inicio: "",
    fecha_fin: "",
    todo_el_dia: true,
    repetir: "none",
    recordatorio_minutos: undefined,
  });

  // Toggle a filter type
  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filtered events for FullCalendar
  const filteredEvents = useMemo(
    () => events.filter((e) => activeFilters.has(e.type)),
    [events, activeFilters]
  );

  // Upcoming events for sidebar
  const upcomingEvents = useMemo(() => {
    return events
      .filter((e) => {
        const d = parseISO(e.start);
        return (isFuture(d) || isToday(d)) && activeFilters.has(e.type);
      })
      .sort((a, b) => compareAsc(parseISO(a.start), parseISO(b.start)))
      .slice(0, 10);
  }, [events, activeFilters]);

  // Today's events
  const todayEvents = useMemo(
    () => events.filter((e) => isToday(parseISO(e.start)) && activeFilters.has(e.type)),
    [events, activeFilters]
  );

  // FullCalendar event click
  const handleEventClick = useCallback((arg: EventClickArg) => {
    const evt = events.find((e) => e.id === arg.event.id);
    if (evt) setSelectedEvent(evt);
  }, [events]);

  // FullCalendar date select (for creating events)
  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    setAddFormDate(arg.startStr);
    setNewEvent((prev) => ({
      ...prev,
      fecha_inicio: arg.startStr,
      fecha_fin: arg.endStr || "",
      todo_el_dia: arg.allDay,
    }));
    setShowAddModal(true);
  }, []);

  // Navigate to opportunity
  const navigateToOpportunity = (event: CalendarioEvent) => {
    if (event.sourceType === "licitacion" && event.sourceId) {
      navigate(`/licitaciones/${event.sourceId}`);
    } else if (event.sourceType === "compra_agil" && event.sourceId) {
      navigate(`/compras-agiles/${event.sourceId}`);
    } else if (event.sourceType === "pipeline") {
      navigate("/pipeline");
    }
  };

  // Submit new event
  const handleCreateEvent = async () => {
    if (!newEvent.titulo || !newEvent.fecha_inicio) {
      toast.error("Título y fecha son obligatorios");
      return;
    }
    try {
      await createEvent.mutateAsync(newEvent);
      toast.success("Evento creado exitosamente");
      setShowAddModal(false);
      setNewEvent({
        titulo: "",
        descripcion: "",
        tipo: "otro",
        fecha_inicio: "",
        fecha_fin: "",
        todo_el_dia: true,
        repetir: "none",
        recordatorio_minutos: undefined,
      });
    } catch {
      toast.error("Error al crear el evento");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendario Integrado</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualiza cierres, hitos de pipeline, tareas y eventos del equipo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Filter className="h-4 w-4 mr-1" />
            {showSidebar ? "Ocultar Panel" : "Mostrar Panel"}
          </Button>
          <Button size="sm" onClick={() => {
            setAddFormDate(new Date().toISOString().slice(0, 10));
            setNewEvent((prev) => ({
              ...prev,
              fecha_inicio: new Date().toISOString().slice(0, 10),
              todo_el_dia: true,
            }));
            setShowAddModal(true);
          }}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Main layout: Calendar + Sidebar */}
      <div className="flex gap-4">
        {/* Calendar */}
        <Card className={cn("flex-1 min-w-0", showSidebar ? "" : "")}>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,timeGridDay",
                }}
                locale="es"
                buttonText={{
                  today: "Hoy",
                  month: "Mes",
                  week: "Semana",
                  day: "Día",
                }}
                firstDay={1}
                selectable
                selectMirror
                dayMaxEvents={3}
                moreLinkText={(n) => `+${n} más`}
                height="auto"
                contentHeight={600}
                events={filteredEvents.map((e) => ({
                  id: e.id,
                  title: e.title,
                  start: e.start,
                  end: e.end || undefined,
                  allDay: e.allDay,
                  backgroundColor: e.color,
                  borderColor: e.borderColor,
                  textColor: e.textColor,
                }))}
                eventClick={handleEventClick}
                select={handleDateSelect}
                eventDisplay="block"
                eventTimeFormat={{
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        {showSidebar && (
          <div className="w-80 shrink-0 space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {typeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => toggleFilter(f.key)}
                    className={cn(
                      "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
                      activeFilters.has(f.key)
                        ? "bg-muted"
                        : "opacity-50 hover:opacity-75"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full shrink-0", f.dotColor)} />
                    <span className="flex-1">{f.label}</span>
                    {activeFilters.has(f.key) && (
                      <Badge variant="secondary" className="text-xs px-1.5">
                        {events.filter((e) => e.type === f.key).length}
                      </Badge>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Today */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Hoy ({todayEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {todayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sin eventos hoy
                  </p>
                ) : (
                  <ScrollArea className="max-h-40">
                    <div className="space-y-2">
                      {todayEvents.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: e.color }}
                          />
                          <span className="text-xs truncate">{e.title}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Próximos Eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Sin eventos próximos
                  </p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {upcomingEvents.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setSelectedEvent(e)}
                          className="flex items-start gap-2 w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors group"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                            style={{ backgroundColor: e.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {e.title}
                            </p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CalendarIcon className="h-3 w-3" />
                              {format(parseISO(e.start), "dd MMM", { locale: es })}
                              <span className="mx-0.5">·</span>
                              <span>{e.tipoBadge}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Event Detail Modal ─────────────────────────────────── */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">Detalle del Evento</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {/* Color bar + title */}
              <div className="flex items-start gap-3">
                <div
                  className="w-1 h-14 rounded-full shrink-0"
                  style={{ backgroundColor: selectedEvent.color }}
                />
                <div className="flex-1 min-w-0">
                  <Badge
                    className="text-xs mb-1"
                    style={{
                      backgroundColor: selectedEvent.color,
                      color: selectedEvent.textColor,
                    }}
                  >
                    {selectedEvent.tipoBadge}
                  </Badge>
                  <p className="font-medium text-foreground leading-tight">
                    {selectedEvent.title}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Details grid */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="h-4 w-4 shrink-0" />
                  <span>
                    {format(parseISO(selectedEvent.start), "EEEE d 'de' MMMM, yyyy", {
                      locale: es,
                    })}
                  </span>
                </div>

                {selectedEvent.monto != null && selectedEvent.monto > 0 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-foreground">
                      {formatMonto(selectedEvent.monto)}
                    </span>
                  </div>
                )}

                {selectedEvent.institucion && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span>{selectedEvent.institucion}</span>
                  </div>
                )}

                {selectedEvent.asignado && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{selectedEvent.asignado}</span>
                  </div>
                )}

                {selectedEvent.descripcion && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Tag className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{selectedEvent.descripcion}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedEvent.sourceType !== "custom" && selectedEvent.sourceId && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        navigateToOpportunity(selectedEvent);
                        setSelectedEvent(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ver Oportunidad
                    </Button>
                    {selectedEvent.sourceType === "pipeline" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          navigate("/pipeline");
                          setSelectedEvent(null);
                        }}
                      >
                        Ir al Pipeline
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Event Modal ────────────────────────────────────── */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="evt-title">Título *</Label>
              <Input
                id="evt-title"
                placeholder="Nombre del evento"
                value={newEvent.titulo}
                onChange={(e) =>
                  setNewEvent((prev) => ({ ...prev, titulo: e.target.value }))
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="evt-desc">Descripción</Label>
              <Textarea
                id="evt-desc"
                placeholder="Descripción opcional"
                rows={2}
                value={newEvent.descripcion}
                onChange={(e) =>
                  setNewEvent((prev) => ({ ...prev, descripcion: e.target.value }))
                }
              />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="evt-start">Fecha Inicio *</Label>
                <Input
                  id="evt-start"
                  type={newEvent.todo_el_dia ? "date" : "datetime-local"}
                  value={newEvent.fecha_inicio}
                  onChange={(e) =>
                    setNewEvent((prev) => ({ ...prev, fecha_inicio: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="evt-end">Fecha Fin</Label>
                <Input
                  id="evt-end"
                  type={newEvent.todo_el_dia ? "date" : "datetime-local"}
                  value={newEvent.fecha_fin}
                  onChange={(e) =>
                    setNewEvent((prev) => ({ ...prev, fecha_fin: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* All-day toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="evt-allday">Todo el día</Label>
              <Switch
                id="evt-allday"
                checked={newEvent.todo_el_dia}
                onCheckedChange={(checked) =>
                  setNewEvent((prev) => ({ ...prev, todo_el_dia: checked }))
                }
              />
            </div>

            {/* Type + Repeat row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newEvent.tipo}
                  onValueChange={(v) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      tipo: v as TipoEventoCalendario,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cierre">Cierre</SelectItem>
                    <SelectItem value="adjudicacion">Adjudicación</SelectItem>
                    <SelectItem value="tarea">Tarea</SelectItem>
                    <SelectItem value="recordatorio">Recordatorio</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Repetir</Label>
                <Select
                  value={newEvent.repetir}
                  onValueChange={(v) =>
                    setNewEvent((prev) => ({
                      ...prev,
                      repetir: v as RepetirEvento,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repetir</SelectItem>
                    <SelectItem value="daily">Diario</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reminder */}
            <div className="space-y-2">
              <Label>Recordatorio</Label>
              <Select
                value={
                  newEvent.recordatorio_minutos != null
                    ? String(newEvent.recordatorio_minutos)
                    : "none"
                }
                onValueChange={(v) =>
                  setNewEvent((prev) => ({
                    ...prev,
                    recordatorio_minutos: v === "none" ? undefined : Number(v),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin recordatorio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin recordatorio</SelectItem>
                  <SelectItem value="15">15 minutos antes</SelectItem>
                  <SelectItem value="60">1 hora antes</SelectItem>
                  <SelectItem value="1440">1 día antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>
              {createEvent.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Crear Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs flex-wrap">
        {typeFilters.map((f) => (
          <div key={f.key} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", f.dotColor)} />
            <span className="text-muted-foreground">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
