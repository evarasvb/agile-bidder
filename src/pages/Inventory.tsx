import { useState } from "react";
import { Plus, Upload, Search, MoreHorizontal, Edit2, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  keywords: string[];
  baseCost: number;
  minMargin: number;
  stock: number;
  status: "active" | "low_stock" | "out_of_stock";
}

const mockInventory: InventoryItem[] = [
  {
    id: "1",
    sku: "CLX-2L-01",
    name: "Cloro Concentrado 2L",
    keywords: ["clorox", "cloro", "desinfectante", "blanqueador"],
    baseCost: 2500,
    minMargin: 15,
    stock: 450,
    status: "active",
  },
  {
    id: "2",
    sku: "DET-5L-IND",
    name: "Detergente Industrial 5L",
    keywords: ["detergente", "lavado", "limpieza", "industrial"],
    baseCost: 8900,
    minMargin: 12,
    stock: 180,
    status: "active",
  },
  {
    id: "3",
    sku: "JAB-LIQ-5L",
    name: "Jabón Líquido Antibacterial 5L",
    keywords: ["jabón", "antibacterial", "manos", "higiene"],
    baseCost: 6500,
    minMargin: 18,
    stock: 25,
    status: "low_stock",
  },
  {
    id: "4",
    sku: "PAP-HIG-400",
    name: "Papel Higiénico Industrial 400m",
    keywords: ["papel", "higiénico", "baño", "industrial"],
    baseCost: 4200,
    minMargin: 10,
    stock: 0,
    status: "out_of_stock",
  },
  {
    id: "5",
    sku: "TOA-250M",
    name: "Papel Toalla 250m",
    keywords: ["toalla", "papel", "secado", "manos"],
    baseCost: 3800,
    minMargin: 14,
    stock: 320,
    status: "active",
  },
];

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [inventory] = useState<InventoryItem[]>(mockInventory);

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: InventoryItem["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-0">Activo</Badge>;
      case "low_stock":
        return <Badge className="bg-warning/10 text-warning border-0">Stock Bajo</Badge>;
      case "out_of_stock":
        return <Badge className="bg-destructive/10 text-destructive border-0">Sin Stock</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus productos y reglas de matching
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{filteredInventory.length} productos</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-semibold">SKU</TableHead>
              <TableHead className="font-semibold">Producto</TableHead>
              <TableHead className="font-semibold">Keywords</TableHead>
              <TableHead className="font-semibold text-right">Costo Base</TableHead>
              <TableHead className="font-semibold text-right">Margen Mín.</TableHead>
              <TableHead className="font-semibold text-right">Stock</TableHead>
              <TableHead className="font-semibold">Estado</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => (
              <TableRow key={item.id} className="data-row">
                <TableCell className="font-mono text-sm font-medium">
                  {item.sku}
                </TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {item.keywords.slice(0, 3).map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {keyword}
                      </span>
                    ))}
                    {item.keywords.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{item.keywords.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${item.baseCost.toLocaleString("es-CL")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.minMargin}%
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono font-medium",
                  item.stock === 0 && "text-destructive",
                  item.stock > 0 && item.stock < 50 && "text-warning"
                )}>
                  {item.stock.toLocaleString("es-CL")}
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2">
                        <Edit2 className="h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
