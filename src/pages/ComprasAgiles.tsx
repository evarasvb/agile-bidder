import { useState } from "react";
import { ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComprasAgilesStats } from "@/components/compras-agiles/ComprasAgilesStats";
import { ComprasAgilesFilters } from "@/components/compras-agiles/ComprasAgilesFilters";
import { ComprasAgilesTable } from "@/components/compras-agiles/ComprasAgilesTable";
import { MatchPanel } from "@/components/compras-agiles/MatchPanel";
import { GenerarPropuestaModal } from "@/components/compras-agiles/GenerarPropuestaModal";
import { useComprasAgiles, type CompraAgil, type ComprasAgilesFilters as Filters } from "@/hooks/useComprasAgiles";
import { useQueryClient } from "@tanstack/react-query";
import type { MatchedProduct } from "@/hooks/useMatchInventario";

export default function ComprasAgiles() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [selectedCompra, setSelectedCompra] = useState<CompraAgil | null>(null);
  const [propuestaModalOpen, setPropuestaModalOpen] = useState(false);
  const [productosParaPropuesta, setProductosParaPropuesta] = useState<MatchedProduct[]>([]);

  const { data: compras, isLoading, refetch } = useComprasAgiles(filters);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
    queryClient.invalidateQueries({ queryKey: ['compras_agiles_stats'] });
    refetch();
  };

  const handleSelectCompra = (compra: CompraAgil) => {
    setSelectedCompra(compra);
  };

  const handleGenerarPropuesta = (productos: MatchedProduct[]) => {
    setProductosParaPropuesta(productos);
    setPropuestaModalOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Compras Ágiles</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona y genera propuestas para compras ágiles de MercadoPúblico
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <ComprasAgilesStats />

      {/* Filters */}
      <ComprasAgilesFilters filters={filters} onFiltersChange={setFilters} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2">
          <ComprasAgilesTable
            compras={compras}
            isLoading={isLoading}
            selectedId={selectedCompra?.id || null}
            onSelect={handleSelectCompra}
          />
        </div>

        {/* Match Panel */}
        <div className="lg:col-span-1">
          <MatchPanel
            compra={selectedCompra}
            onGenerarPropuesta={handleGenerarPropuesta}
          />
        </div>
      </div>

      {/* Propuesta Modal */}
      <GenerarPropuestaModal
        open={propuestaModalOpen}
        onOpenChange={setPropuestaModalOpen}
        compra={selectedCompra}
        productos={productosParaPropuesta}
      />
    </div>
  );
}
