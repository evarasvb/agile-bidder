import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, AlertCircle, TrendingUp, Package, DollarSign, ThumbsUp, ThumbsDown, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

// Tipos para los estados de ofertas
type OfferStatus = 'pending' | 'won' | 'lost' | 'in_progress' | 'rejected' | 'awarded';

interface OfferData {
  id: string;
  title: string;
  matchScore: number;
  status: OfferStatus;
  subtotal: number;
  iva: number;
  total: number;
  date: string;
}

const mockOffers: OfferData[] = [
  { id: "1", title: "Suministro de Equipos de Computación", matchScore: 92, status: "won", subtotal: 5000000, iva: 950000, total: 5950000, date: "2024-01-15" },
  { id: "2", title: "Servicios de Mantenimiento Preventivo", matchScore: 85, status: "in_progress", subtotal: 2500000, iva: 475000, total: 2975000, date: "2024-01-20" },
  { id: "3", title: "Mobiliario de Oficina", matchScore: 78, status: "pending", subtotal: 3200000, iva: 608000, total: 3808000, date: "2024-01-22" },
  { id: "4", title: "Material de Aseo y Limpieza", matchScore: 65, status: "lost", subtotal: 800000, iva: 152000, total: 952000, date: "2024-01-10" },
];

const statusLabels: Record<OfferStatus, string> = {
  pending: "Pendiente",
  won: "Ganada",
  lost: "Perdida",
  in_progress: "En Progreso",
  rejected: "Rechazada",
  awarded: "Adjudicada"
};

const statusColors: Record<OfferStatus, string> = {
  pending: "bg-yellow-500",
  won: "bg-green-500",
  lost: "bg-red-500",
  in_progress: "bg-blue-500",
  rejected: "bg-gray-500",
  awarded: "bg-purple-500"
};

export default function Mercado() {
  const [selectedOffer, setSelectedOffer] = useState<OfferData | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinMatch, setFilterMinMatch] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const handleFeedback = (offerId: string, isPositive: boolean) => {
    console.log(`Feedback para oferta ${offerId}: ${isPositive ? 'Positivo' : 'Negativo'}`);
    // Aquí se implementaría la lógica para enviar el feedback al backend
  };

  const filteredOffers = mockOffers.filter(offer => {
    const matchesStatus = filterStatus === "all" || offer.status === filterStatus;
    const matchesScore = offer.matchScore >= filterMinMatch;
    const matchesSearch = offer.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesScore && matchesSearch;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mercado</h1>
        <p className="text-muted-foreground">
          Análisis de órdenes de compra y tendencias del mercado
        </p>
      </div>

      {/* Filtros avanzados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input 
                placeholder="Buscar por título..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="won">Ganada</SelectItem>
                  <SelectItem value="lost">Perdida</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="awarded">Adjudicada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Match Mínimo: {filterMinMatch}%</label>
              <Input 
                type="range" 
                min="0" 
                max="100" 
                value={filterMinMatch}
                onChange={(e) => setFilterMinMatch(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Ofertas</p>
                <p className="text-2xl font-bold">{mockOffers.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ganadas</p>
                <p className="text-2xl font-bold text-green-600">
                  {mockOffers.filter(o => o.status === 'won').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Proceso</p>
                <p className="text-2xl font-bold text-blue-600">
                  {mockOffers.filter(o => o.status === 'in_progress').length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(mockOffers.reduce((sum, o) => sum + o.total, 0))}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de ofertas con barra de progreso */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredOffers.map(offer => (
          <Card 
            key={offer.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setSelectedOffer(offer)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{offer.title}</CardTitle>
                <Badge className={statusColors[offer.status]}>
                  {statusLabels[offer.status]}
                </Badge>
              </div>
              <CardDescription>Fecha: {offer.date}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Barra de progreso de matching */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Match Score</span>
                  <span className="font-bold text-primary">{offer.matchScore}%</span>
                </div>
                <Progress value={offer.matchScore} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {offer.matchScore >= 80 ? '🎯 Excelente coincidencia' : 
                   offer.matchScore >= 60 ? '✓ Buena coincidencia' : 
                   '⚠ Coincidencia moderada'}
                </p>
              </div>

              {/* Desglose económico */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(offer.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA (19%):</span>
                  <span>{formatCurrency(offer.iva)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(offer.total)}</span>
                </div>
              </div>

              {/* Botones de feedback */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback(offer.id, true);
                  }}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Match correcto
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback(offer.id, false);
                  }}
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  No coincide
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOffers.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se encontraron ofertas que coincidan con los filtros seleccionados.
          </AlertDescription>
        </Alert>
      )}

      {/* Sección de órdenes históricas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Tus Órdenes de Compra</CardTitle>
              <CardDescription>
                Historial de órdenes de compra adjudicadas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta sección mostrará tu historial completo de órdenes. Próximamente disponible.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
