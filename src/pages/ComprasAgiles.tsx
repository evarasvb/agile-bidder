import { useState, useCallback, useMemo } from "react";
import { ShoppingCart, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ComprasAgilesStats } from "@/components/compras-agiles/ComprasAgilesStats";
import { ComprasAgilesFilters } from "@/components/compras-agiles/ComprasAgilesFilters";
import { ComprasAgilesTable } from "@/components/compras-agiles/ComprasAgilesTable";
import { MatchPanel } from "@/components/compras-agiles/MatchPanel";
import { GenerarPropuestaModal } from "@/components/compras-agiles/GenerarPropuestaModal";
import { useComprasAgiles, type CompraAgil, type ComprasAgilesFilters as Filters } from "@/hooks/useComprasAgiles";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ItemParaPropuesta {
  itemId: string;
  itemIndex: number;
  nombre: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  match: {
    id: string;
    sku: string;
    nombre: string;
    precio_unitario: number;
    stock: number | null;
    matchScore: number;
    margen_estimado: number;
  } | null;
}

export default function ComprasAgiles() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [selectedCompra, setSelectedCompra] = useState<CompraAgil | null>(null);
  const [propuestaModalOpen, setPropuestaModalOpen] = useState(false);
  const [productosParaPropuesta, setProductosParaPropuesta] = useState<ItemParaPropuesta[]>([]);

  const { data: compras, isLoading, error, refetch } = useComprasAgiles(filters);

  // Memoizar handlers para evitar re-renders innecesarios
  const handleRefresh = useCallback(async () => {
    try {
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
      queryClient.invalidateQueries({ queryKey: ['compras_agiles_stats'] });
      await refetch();
      toast.success('Compras ágiles actualizadas');
    } catch (err) {
      console.error('Error al actualizar:', err);
      toast.error('Error al actualizar las compras ágiles');
    }
  }, [queryClient, refetch]);

  const handleSelectCompra = useCallback((compra: CompraAgil) => {
    setSelectedCompra(compra);
  }, []);

  const handleGenerarPropuesta = useCallback((productos: ItemParaPropuesta[]) => {
    if (productos.length === 0) {
      toast.warning('No hay productos seleccionados para generar propuesta');
      return;
    }
    setProductosParaPropuesta(productos);
    setPropuestaModalOpen(true);
  }, []);

  const handleClosePropuestaModal = useCallback(() => {
    setPropuestaModalOpen(false);
    // Limpiar productos cuando se cierra el modal
    setProductosParaPropuesta([]);
  }, []);

  // Memoizar selectedId para evitar re-renders
  const selectedId = useMemo(() => selectedCompra?.id || null, [selectedCompra?.id]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gradient-to-br from-background via-firmavb-cream/5 to-background min-h-screen">
      {/* Header con branding FirmaVB */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-firmavb-blue/20 to-firmavb-red/10 border border-firmavb-blue/20 shadow-sm">
            <ShoppingCart className="h-6 w-6 sm:h-7 sm:w-7 text-firmavb-blue" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
              Compras Ágiles
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Gestiona y genera propuestas inteligentes para compras ágiles de MercadoPúblico con FirmaVB
            </p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              className="gap-2 border-firmavb-blue/30 hover:bg-firmavb-blue/10 hover:border-firmavb-blue transition-colors"
              disabled={isLoading}
              aria-label="Actualizar lista de compras ágiles"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
              <span className="sm:hidden">Refrescar</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Actualiza la lista de compras ágiles desde MercadoPúblico</p>
          </TooltipContent>
        </Tooltip>
      </header>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error al cargar compras ágiles</AlertTitle>
          <AlertDescription className="text-sm">
            {error instanceof Error ? error.message : 'Ocurrió un error desconocido. Intenta actualizar la página.'}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2"
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <ComprasAgilesStats />

      {/* Filters */}
      <ComprasAgilesFilters filters={filters} onFiltersChange={setFilters} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Table */}
        <div className="lg:col-span-2">
          <ComprasAgilesTable
            compras={compras}
            isLoading={isLoading}
            selectedId={selectedId}
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
        onOpenChange={handleClosePropuestaModal}
        compra={selectedCompra}
        productos={productosParaPropuesta}
      />
    </div>
  );
}
