import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VendedorDashboard } from '@/components/equipo/VendedorDashboard';
import { useVendedorDetail } from '@/hooks/useEquipo';

export default function VendedorDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vendedor, isLoading } = useVendedorDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Vendedor no encontrado</p>
        <Button variant="link" onClick={() => navigate('/equipo')}>
          Volver al equipo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate('/equipo')}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        Volver al equipo
      </Button>

      <VendedorDashboard vendedor={vendedor} />
    </div>
  );
}
