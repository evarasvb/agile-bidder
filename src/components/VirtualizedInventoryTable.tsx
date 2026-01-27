import { useEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Product {
  id: string;
  codigo: string;
  nombre: string;
  precio_base: number;
  stock: number;
  categoria?: string;
}

interface VirtualizedInventoryTableProps {
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}

const PAGE_SIZE = 50;

export function VirtualizedInventoryTable({ 
  searchTerm = '', 
  onSearchChange 
}: VirtualizedInventoryTableProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch paginated products from Supabase
  const fetchProducts = useCallback(async (pageNum: number, search: string) => {
    setLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const start = (pageNum - 1) * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end);

      if (search) {
        query = query.or(`codigo.ilike.%${search}%,nombre.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setProducts(data || []);
      setTotalCount(count || 0);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(page, searchTerm);
  }, [page, searchTerm, fetchProducts]);

  // Virtualizer configuration
  const rowVirtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {totalCount.toLocaleString()} productos
        </div>
      </div>

      {/* Virtualized table */}
      <div 
        ref={parentRef} 
        className="border rounded-lg overflow-auto" 
        style={{ height: '600px' }}
      >
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[120px]">Código</TableHead>
              <TableHead className="min-w-[300px]">Nombre</TableHead>
              <TableHead className="w-[120px]">Precio Base</TableHead>
              <TableHead className="w-[100px]">Stock</TableHead>
              <TableHead className="w-[150px]">Categoría</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <tr style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              <td style={{ position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const product = products[virtualRow.index];
                  return (
                    <TableRow
                      key={product.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell className="font-mono text-sm">
                        {product.codigo}
                      </TableCell>
                      <TableCell>{product.nombre}</TableCell>
                      <TableCell>${product.precio_base.toLocaleString()}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.categoria || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </td>
            </tr>
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore || loading}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}