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
            key={`${item.compra_agil_id}-${item.id}`}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{item.nombre_producto}</h4>
                {item.descripcion && (
                  <p className="text-sm text-gray-600 mt-1">{item.descripcion}</p>
                )}
                {item.codigo_producto && (
                  <p className="text-xs text-gray-400 mt-1">Código: {item.codigo_producto}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <Badge variant="secondary" className="mb-1">
                  {item.cantidad || 1} {item.unidad || 'UN'}
                </Badge>
                {item.categoria && (
                  <p className="text-xs text-gray-400">{item.categoria}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
