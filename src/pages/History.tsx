import { useState } from "react";
import { ExternalLink, Download, Search, Filter, CheckCircle2, Clock, XCircle } from "lucide-react";
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

interface BidRecord {
  id: string;
  licitacionId: string;
  organism: string;
  item: string;
  priceOffered: number;
  date: Date;
  status: "accepted" | "pending" | "rejected";
}

const mockHistory: BidRecord[] = [
  {
    id: "1",
    licitacionId: "2024-01-2847",
    organism: "Municipalidad de Santiago",
    item: "Detergente Industrial 5L x 24 unidades",
    priceOffered: 213600,
    date: new Date(2024, 0, 15, 14, 32),
    status: "accepted",
  },
  {
    id: "2",
    licitacionId: "2024-01-2851",
    organism: "Hospital San José",
    item: "Jabón Líquido Antibacterial 5L x 12 unidades",
    priceOffered: 89400,
    date: new Date(2024, 0, 15, 11, 15),
    status: "accepted",
  },
  {
    id: "3",
    licitacionId: "2024-01-2856",
    organism: "SENAME Región Metropolitana",
    item: "Papel Toalla 250m x 48 rollos",
    priceOffered: 182400,
    date: new Date(2024, 0, 14, 16, 45),
    status: "pending",
  },
  {
    id: "4",
    licitacionId: "2024-01-2862",
    organism: "Ministerio de Salud",
    item: "Cloro Concentrado 2L x 36 unidades",
    priceOffered: 108000,
    date: new Date(2024, 0, 14, 9, 20),
    status: "rejected",
  },
  {
    id: "5",
    licitacionId: "2024-01-2870",
    organism: "Carabineros de Chile",
    item: "Kit Limpieza Completo x 10 sets",
    priceOffered: 450000,
    date: new Date(2024, 0, 13, 15, 10),
    status: "accepted",
  },
];

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [history] = useState<BidRecord[]>(mockHistory);

  const filteredHistory = history.filter((record) => {
    const matchesSearch =
      record.organism.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.licitacionId.toLowerCase().includes(searchQuery.toLowerCase());
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
    .reduce((acc, r) => acc + r.priceOffered, 0);

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
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
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
                  ${record.priceOffered.toLocaleString("es-CL")}
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
      </div>
    </div>
  );
}
