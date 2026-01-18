import React from 'react';
import { useLicitacionItems, type LicitacionItem } from '@/hooks/useLicitacionItems';
import { Badge } from '@/components/ui/badge';

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

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Productos Solicitados</h3>
        <span className="text-sm text-gray-500">{items.length} productos</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.licitacion_id}-${item.id}`}
            className="border rounded-lg p-4 transition-colors border-border bg-background"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    Item #{item.id}
                  </span>
                </div>
                <h4 className="font-medium">{item.nombre_producto || 'Sin nombre'}</h4>
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
                <Badge variant="secondary" className="text-xs">Pendiente</Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
