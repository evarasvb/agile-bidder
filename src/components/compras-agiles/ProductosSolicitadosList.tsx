import React from 'react';
import { useLicitacionItems, type LicitacionItem } from '@/hooks/useLicitacionItems';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ProductosSolicitadosListProps {
  licitacionCodigo: string;
  className?: string;
}

export const ProductosSolicitadosList: React.FC<ProductosSolicitadosListProps> = ({
  licitacionCodigo,
  className = ''
}) => {
  const { data: items, isLoading: loading } = useLicitacionItems(licitacionCodigo);

  if (loading) {
    return (
      <div className={`flex justify-center items-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className={`bg-muted/50 border border-border rounded-lg p-6 text-center ${className}`}>
        <p className="text-muted-foreground">No hay productos solicitados para esta compra ágil</p>
      </div>
    );
  }

  const renderMatchIndicator = (item: LicitacionItem) => {
    const tieneMatch = item.match_sku !== null && item.confidence_score !== null;
    const confidenceScore = item.confidence_score ? Math.round(item.confidence_score * 100) : 0;
    
    if (!tieneMatch) {
      return (
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary" className="text-xs">Sin match</Badge>
        </div>
      );
    }

    const variant = confidenceScore >= 70 ? 'default' : confidenceScore >= 40 ? 'secondary' : 'outline';
    
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <Badge variant={variant} className="text-xs">{confidenceScore}% match</Badge>
      </div>
    );
  };

  const renderMatchDetails = (item: LicitacionItem) => {
    if (!item.match_sku) return null;

    return (
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">SKU: </span>
            <span className="font-mono font-medium">{item.match_sku}</span>
          </div>
          {item.costo_unitario && (
            <div>
              <span className="text-muted-foreground">Costo: </span>
              <span className="font-medium">
                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.costo_unitario)}
              </span>
            </div>
          )}
          {item.margen_estimado && (
            <div>
              <span className="text-muted-foreground">Margen: </span>
              <span className={`font-medium ${item.margen_estimado >= 0.2 ? 'text-green-600' : 'text-yellow-600'}`}>
                {Math.round(item.margen_estimado * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Productos Solicitados</h3>
        <span className="text-sm text-gray-500">{items.length} productos</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.licitacion_codigo}-${item.item_index}`}
            className={`border rounded-lg p-4 transition-colors ${
              item.match_sku 
                ? 'border-primary/50 bg-primary/5' 
                : 'border-border bg-background'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Item #{item.item_index}
                  </span>
                </div>
                <h4 className="font-medium">{item.nombre || 'Sin nombre'}</h4>
                {item.descripcion && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.descripcion}</p>
                )}
                
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  {item.cantidad && (
                    <div>
                      <span>Cantidad: </span>
                      <span className="font-medium">{item.cantidad}</span>
                    </div>
                  )}
                  {item.unidad && (
                    <div>
                      <span>Unidad: </span>
                      <span className="font-medium">{item.unidad}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="ml-4">
                {renderMatchIndicator(item)}
              </div>
            </div>

            {renderMatchDetails(item)}
          </div>
        ))}
      </div>
    </div>
  );
};