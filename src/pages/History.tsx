import { useState } from "react";
import { ExternalLink, Download, Search, Filter, CheckCircle2, Clock, XCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface BidRecord {
  id: string;
  licitacionId: string;
  organism: string;
  item: string;
  priceOffered: number;
  date: Date;
  status: "accepted" | "pending" | "rejected";
}

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Empty state - no mock data, waiting for real ofertas table
  const history: BidRecord[] = [];
  const isLoading = false;

  const handleRefresh = () => {
    toast.info('Actualizando historial...');
  };

  const filteredHistory = history.filter((record) => {
    const matchesSearch =
      record.organism?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.item?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.licitacionId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: BidRecord["status"]) => {
    switch (status) {
      case "accepted":
        return (
          <Badge className="bg-success/10 text-success border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Aceptada
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning/10 text-warning border-0 gap-1">
            <Clock className="h-3 w-3" />
            Pendiente
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-destructive/10 text-destructive border-0 gap-1">
            <XCircle className="h-3 w-3" />
            Rechazada
          </Badge>
        );
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalAccepted = history.filter((r) => r.status === "accepted").length;
  const totalAmount = history
    .filter((r) => r.status === "accepted")
    .reduce((acc, r) => acc + (r.priceOffered || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Historial de Ofertas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de todas las ofertas enviadas a Mercado Público
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total Ofertas</p>
          <p className="text-2xl font-semibold font-mono mt-1">{history.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Ofertas Aceptadas</p>
          <p className="text-2xl font-semibold font-mono text-success mt-1">{totalAccepted}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Monto Total Ganado</p>
          <p className="text-2xl font-semibold font-mono text-success mt-1">
            ${totalAmount.toLocaleString("es-CL")}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por organismo, ítem o ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="accepted">Aceptadas</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="rejected">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay ofertas registradas</p>
            <p className="text-sm">Las ofertas enviadas aparecerán aquí cuando se implemente el sistema de ofertas</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">ID Licitación</TableHead>
                <TableHead className="font-semibold">Organismo</TableHead>
                <TableHead className="font-semibold">Ítem</TableHead>
                <TableHead className="font-semibold text-right">Precio Ofertado</TableHead>
                <TableHead className="font-semibold">Fecha</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.map((record) => (
                <TableRow key={record.id} className="data-row">
                  <TableCell className="font-mono text-sm font-medium text-primary">
                    {record.licitacionId}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {record.organism}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground">
                    {record.item}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    ${(record.priceOffered || 0).toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(record.date)}
                  </TableCell>
                  <TableCell>{getStatusBadge(record.status)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}