// @ts-nocheck
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  User,
  FileText,
  AlertCircle,
  HelpCircle,
  Shield,
  Filter,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { useAsignacionesDetalle, useVendedores } from "@/hooks/useVendedores";

// Colores según estado de asignación
const estadoConfig: Record<string, { label: string; color: string; dotColor: string; badgeClass: string }> = {
  asignada: {
    label: "Asignada",
    color: "bg-blue-500 text-white",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  postulada: {
    label: "Postulada",
    color: "bg-amber-500 text-white",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  adjudicada: {
    label: "Adjudicada",
    color: "bg-green-500 text-white",
    dotColor: "bg-green-500",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  perdida: {
    label: "Perdida",
    color: "bg-red-500 text-white",
    dotColor: "bg-red-500",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
};

function getEstadoConfig(estado: string) {
  return estadoConfig[estado] || estadoConfig["asignada"];
}

export default function Calendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedVendedor, setSelectedVendedor] = useState("Todos");
  const [selectedEstado, setSelectedEstado] = useState("Todos");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: asignaciones, isLoading } = useAsignacionesDetalle();
  const { data: vendedores } = useVendedores();

  // Convertir asignaciones a eventos del calendario
  const events = useMemo(() => {
    if (!asignaciones) return [];
    return asignaciones
      .filter((a) => a.fecha_cierre)
      .map((a) => ({
        id: a.id,
        licitacionId: a.licitacion_codigo || a.licitacion_id,
        title: a.licitacion_codigo || "Sin código",
        date: parseISO(a.fecha_cierre!),
        estado: a.estado,
        monto: a.monto_estimado || 0,
        responsable: a.vendedor_nombre,
        vendedorId: a.vendedor_id,
        notas: a.notas,
      }));
  }, [asignaciones]);

  // Filtrar eventos
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const monthMatch = isSameMonth(event.date, currentDate);
      const vendedorMatch =
        selectedVendedor === "Todos" || event.responsable === selectedVendedor;
      const estadoMatch =
        selectedEstado === "Todos" || event.estado === selectedEstado;
      return monthMatch && vendedorMatch && estadoMatch;
    });
  }, [events, currentDate, selectedVendedor, selectedEstado]);

  // Próximos eventos (7 días)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const in7days = addDays(now, 7);
    return events
      .filter((event) => event.date >= now && event.date <= in7days)
      .filter((event) => {
        const vendedorMatch =
          selectedVendedor === "Todos" || event.responsable === selectedVendedor;
        const estadoMatch =
          selectedEstado === "Todos" || event.estado === selectedEstado;
        return vendedorMatch && estadoMatch;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [events, selectedVendedor, selectedEstado]);

  // Días del calendario
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });

    // Padding del inicio (lunes = 0)
    const startDay = start.getDay();
    const paddingDays = startDay === 0 ? 6 : startDay - 1;

    const prevMonthEnd = endOfMonth(subMonths(start, 1));
    const paddingStart: Date[] = [];
    for (let i = paddingDays - 1; i >= 0; i--) {
      const day = new Date(prevMonthEnd);
      day.setDate(prevMonthEnd.getDate() - i);
      paddingStart.push(day);
    }

    return [...paddingStart, ...days];
  }, [currentDate]);

  const getEventsForDay = (day: Date) =>
    filteredEvents.filter((event) => isSameDay(event.date, day));

  const formatMonto = (monto: number) => {
    if (!monto) return "-";
    if (monto >= 1000000) return `$${(monto / 1000000).toFixed(1)}M`;
    if (monto >= 1000) return `$${(monto / 1000).toFixed(0)}K`;
    return `$${monto.toLocaleString("es-CL")}`;
  };

  // Lista de vendedores para filtro
  const vendedorNames = useMemo(() => {
    const names = new Set(events.map((e) => e.responsable));
    return ["Todos", ...Array.from(names).sort()];
  }, [events]);

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
            Calendario de Negocios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Seguimiento de negocios asignados a ejecutivos - fechas de cierre
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="w-[180px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              {vendedorNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEstado} onValueChange={setSelectedEstado}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos los estados</SelectItem>
              <SelectItem value="asignada">Asignadas</SelectItem>
              <SelectItem value="postulada">Postuladas</SelectItem>
              <SelectItem value="adjudicada">Adjudicadas</SelectItem>
              <SelectItem value="perdida">Perdidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Próximos Cierres */}
      {!isLoading && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Próximos Cierres (7 días)
          </h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pb-4">
              {upcomingEvents.length === 0 ? (
                <Card className="min-w-[300px] border-dashed">
                  <CardContent className="p-4 text-center text-muted-foreground">
                    No hay cierres próximos en los siguientes 7 días
                  </CardContent>
                </Card>
              ) : (
                upcomingEvents.map((event) => {
                  const config = getEstadoConfig(event.estado);
                  return (
                    <Card
                      key={event.id}
                      className="min-w-[320px] hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/compras-agiles/${event.licitacionId}`)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="font-mono text-sm text-muted-foreground">
                              {event.licitacionId}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">{formatMonto(event.monto)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>
                              {format(event.date, "dd MMM HH:mm", { locale: es })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{event.responsable?.split(" ")[0]}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Grid del Calendario */}
      {!isLoading && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium capitalize">
                {format(currentDate, "MMMM yyyy", { locale: es })}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Hoy
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Días */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDay && isSameDay(day, selectedDay);

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[100px] p-2 rounded-lg border cursor-pointer transition-colors",
                      isCurrentMonth ? "bg-card" : "bg-muted/30",
                      isToday(day) && "border-primary",
                      isSelected && "ring-2 ring-primary",
                      "hover:bg-muted/50"
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-medium mb-1",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isToday(day) && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const config = getEstadoConfig(event.estado);
                        return (
                          <div
                            key={event.id}
                            className={cn(
                              "text-xs p-1 rounded truncate flex items-center gap-1",
                              config.color
                            )}
                            title={`${event.licitacionId} - ${event.responsable} - ${formatMonto(event.monto)}`}
                          >
                            <span className="truncate">{event.responsable?.split(" ")[0]}</span>
                            <span className="font-mono ml-auto">{formatMonto(event.monto)}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-1">
                          +{dayEvents.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalle del día seleccionado */}
      {selectedDay && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Negocios del {format(selectedDay, "d 'de' MMMM yyyy", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEventsForDay(selectedDay).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay negocios con cierre para este día
              </p>
            ) : (
              <div className="space-y-4">
                {getEventsForDay(selectedDay).map((event) => {
                  const config = getEstadoConfig(event.estado);
                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/compras-agiles/${event.licitacionId}`)}
                    >
                      <div
                        className={cn(
                          "w-1 h-full min-h-[80px] rounded-full",
                          config.dotColor
                        )}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={cn("text-xs", config.badgeClass)}>
                                {config.label}
                              </Badge>
                            </div>
                            <p className="font-mono text-sm text-muted-foreground flex items-center gap-1">
                              {event.licitacionId}
                              <ExternalLink className="h-3 w-3" />
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-xl">{formatMonto(event.monto)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{format(event.date, "HH:mm")} hrs</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>{event.responsable}</span>
                          </div>
                        </div>
                        {event.notas && (
                          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            {event.notas}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        {Object.entries(estadoConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", config.dotColor)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
