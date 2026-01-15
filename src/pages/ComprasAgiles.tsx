import { useState } from "react";
import { ShoppingCart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <div className="p-6 space-y-6 bg-gradient-to-br from-background via-firmavb-cream/5 to-background min-h-screen">
      {/* Header con branding FirmaVB */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-firmavb-blue/20 to-firmavb-red/10 border border-firmavb-blue/20">
            <ShoppingCart className="h-7 w-7 text-firmavb-blue" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
              Compras Ágiles
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona y genera propuestas inteligentes para compras ágiles de MercadoPúblico con FirmaVB
            </p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              className="gap-2 border-firmavb-blue/30 hover:bg-firmavb-blue/10 hover:border-firmavb-blue"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Actualiza la lista de compras ágiles desde MercadoPúblico</p>
          </TooltipContent>
        </Tooltip>
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
