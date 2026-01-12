import { useState, useMemo } from "react";
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
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Event types
type EventType = 'licitacion' | 'compra_agil';
type EventStatus = 'cierre' | 'garantia' | 'preguntas';

interface CalendarEvent {
  id: string;
  licitacionId: string;
  title: string;
  date: Date;
  time: string;
  type: EventType;
  status: EventStatus;
  monto: number;
  responsable: string;
  organismo: string;
}

// Sample data for demonstration
const SAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: '1',
    licitacionId: 'LP-2024-001',
    title: 'Suministro de Equipos de Oficina',
    date: new Date(2026, 0, 15, 14, 0),
    time: '14:00',
    type: 'licitacion',
    status: 'cierre',
    monto: 45000000,
    responsable: 'Juan Pérez',
    organismo: 'Ministerio de Salud'
  },
  {
    id: '2',
    licitacionId: 'CA-2024-125',
    title: 'Compra de Insumos Médicos',
    date: new Date(2026, 0, 15, 10, 0),
    time: '10:00',
    type: 'compra_agil',
    status: 'garantia',
    monto: 8500000,
    responsable: 'María González',
    organismo: 'Hospital Regional'
  },
  {
    id: '3',
    licitacionId: 'LP-2024-002',
    title: 'Servicio de Mantención TI',
    date: new Date(2026, 0, 18, 12, 0),
    time: '12:00',
    type: 'licitacion',
    status: 'preguntas',
    monto: 120000000,
    responsable: 'Carlos Rodríguez',
    organismo: 'Municipalidad de Santiago'
  },
  {
    id: '4',
    licitacionId: 'CA-2024-130',
    title: 'Materiales de Construcción',
    date: new Date(2026, 0, 20, 16, 0),
    time: '16:00',
    type: 'compra_agil',
    status: 'cierre',
    monto: 5200000,
    responsable: 'Juan Pérez',
    organismo: 'MOP'
  },
  {
    id: '5',
    licitacionId: 'LP-2024-003',
    title: 'Equipamiento Laboratorio',
    date: new Date(2026, 0, 22, 11, 0),
    time: '11:00',
    type: 'licitacion',
    status: 'garantia',
    monto: 85000000,
    responsable: 'María González',
    organismo: 'Universidad de Chile'
  },
  {
    id: '6',
    licitacionId: 'CA-2024-142',
    title: 'Mobiliario Escolar',
    date: new Date(2026, 0, 25, 15, 0),
    time: '15:00',
    type: 'compra_agil',
    status: 'cierre',
    monto: 12000000,
    responsable: 'Carlos Rodríguez',
    organismo: 'MINEDUC'
  },
  {
    id: '7',
    licitacionId: 'LP-2024-004',
    title: 'Sistema de Seguridad',
    date: new Date(2026, 0, 28, 9, 0),
    time: '09:00',
    type: 'licitacion',
    status: 'preguntas',
    monto: 200000000,
    responsable: 'Juan Pérez',
    organismo: 'Carabineros de Chile'
  },
  {
    id: '8',
    licitacionId: 'CA-2024-155',
    title: 'Artículos de Limpieza',
    date: new Date(2026, 0, 30, 14, 0),
    time: '14:00',
    type: 'compra_agil',
    status: 'garantia',
    monto: 3500000,
    responsable: 'María González',
    organismo: 'Gobierno Regional'
  }
];

const RESPONSABLES = ['Todos', 'Juan Pérez', 'María González', 'Carlos Rodríguez'];

const statusConfig = {
  cierre: {
    label: 'Cierre',
    color: 'bg-destructive text-destructive-foreground',
    dotColor: 'bg-destructive',
    icon: AlertCircle
  },
  garantia: {
    label: 'Entrega Garantía',
    color: 'bg-warning text-warning-foreground',
    dotColor: 'bg-warning',
    icon: Shield
  },
  preguntas: {
    label: 'Cierre Preguntas',
    color: 'bg-blue-500 text-white',
    dotColor: 'bg-blue-500',
    icon: HelpCircle
  }
};

const typeConfig = {
  licitacion: {
    label: 'Licitación',
    color: 'bg-primary/10 text-primary border-primary/20'
  },
  compra_agil: {
    label: 'Compra Ágil',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  }
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1)); // January 2026
  const [selectedResponsable, setSelectedResponsable] = useState('Todos');
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Filter events
  const filteredEvents = useMemo(() => {
    return SAMPLE_EVENTS.filter(event => {
      const monthMatch = isSameMonth(event.date, currentDate);
      const responsableMatch = selectedResponsable === 'Todos' || event.responsable === selectedResponsable;
      return monthMatch && responsableMatch;
    });
  }, [currentDate, selectedResponsable]);

  // Get upcoming events (next 7 days from current month start)
  const upcomingEvents = useMemo(() => {
    return SAMPLE_EVENTS
      .filter(event => event.date >= new Date() && isSameMonth(event.date, currentDate))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5);
  }, [currentDate]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    // Add padding days from previous month
    const startDay = start.getDay();
    const paddingDays = startDay === 0 ? 6 : startDay - 1; // Monday start
    
    const prevMonth = subMonths(start, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    const paddingStart = [];
    for (let i = paddingDays - 1; i >= 0; i--) {
      const day = new Date(prevMonthEnd);
      day.setDate(prevMonthEnd.getDate() - i);
      paddingStart.push(day);
    }
    
    return [...paddingStart, ...days];
  }, [currentDate]);

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(event => isSameDay(event.date, day));
  };

  const formatMonto = (monto: number) => {
    if (monto >= 1000000) {
      return `$${(monto / 1000000).toFixed(1)}M`;
    }
    return `$${(monto / 1000).toFixed(0)}K`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendario de Negocios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona fechas importantes de licitaciones y compromisos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedResponsable} onValueChange={setSelectedResponsable}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Responsable" />
            </SelectTrigger>
            <SelectContent>
              {RESPONSABLES.map(resp => (
                <SelectItem key={resp} value={resp}>{resp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upcoming Events Carousel */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Próximos Eventos
        </h2>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {upcomingEvents.length === 0 ? (
              <Card className="min-w-[300px] border-dashed">
                <CardContent className="p-4 text-center text-muted-foreground">
                  No hay eventos próximos este mes
                </CardContent>
              </Card>
            ) : (
              upcomingEvents.map(event => (
                <Card key={event.id} className="min-w-[320px] hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", typeConfig[event.type].color)}>
                            {typeConfig[event.type].label}
                          </Badge>
                          <Badge className={cn("text-xs", statusConfig[event.status].color)}>
                            {statusConfig[event.status].label}
                          </Badge>
                        </div>
                        <p className="font-mono text-sm text-muted-foreground">{event.licitacionId}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">{formatMonto(event.monto)}</p>
                      </div>
                    </div>
                    <p className="font-medium text-foreground truncate">{event.title}</p>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{format(event.date, 'dd MMM', { locale: es })}</span>
                        <span className="mx-1">•</span>
                        <Clock className="h-4 w-4" />
                        <span>{event.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{event.responsable.split(' ')[0]}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-medium">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
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
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
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
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isToday(day) && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs p-1 rounded truncate flex items-center gap-1",
                          statusConfig[event.status].color
                        )}
                        title={`${event.licitacionId} - ${event.title}`}
                      >
                        <span className="font-mono">{event.time}</span>
                        <span className="truncate">{event.licitacionId}</span>
                      </div>
                    ))}
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

      {/* Selected Day Details */}
      {selectedDay && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Eventos del {format(selectedDay, "d 'de' MMMM", { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getEventsForDay(selectedDay).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No hay eventos para este día
              </p>
            ) : (
              <div className="space-y-4">
                {getEventsForDay(selectedDay).map(event => (
                  <div 
                    key={event.id} 
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn("w-1 h-full min-h-[80px] rounded-full", statusConfig[event.status].dotColor)} />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={cn("text-xs", typeConfig[event.type].color)}>
                              {typeConfig[event.type].label}
                            </Badge>
                            <Badge className={cn("text-xs", statusConfig[event.status].color)}>
                              {statusConfig[event.status].label}
                            </Badge>
                          </div>
                          <p className="font-mono text-sm text-muted-foreground">{event.licitacionId}</p>
                          <p className="font-medium text-foreground">{event.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-xl">{formatMonto(event.monto)}</p>
                          <p className="text-sm text-muted-foreground">{event.organismo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{event.time} hrs</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{event.responsable}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Cierre Licitación</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-muted-foreground">Entrega Garantía</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-muted-foreground">Cierre Preguntas</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary text-xs">Licitación</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-xs">Compra Ágil</Badge>
        </div>
      </div>
    </div>
  );
}
