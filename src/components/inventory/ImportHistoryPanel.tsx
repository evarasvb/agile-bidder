import { useState } from 'react';
import { useImportHistory } from '@/hooks/useImportHistory';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, ChevronDown, FileSpreadsheet, CheckCircle2, AlertCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function ImportHistoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: history, isLoading } = useImportHistory();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completado
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <AlertCircle className="h-3 w-3" />
            Parcial
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Fallido
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFileTypeIcon = (fileType: string) => {
    return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Historial de Importaciones</CardTitle>
                {history && history.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {history.length}
                  </Badge>
                )}
              </div>
              <ChevronDown 
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} 
              />
            </div>
            <CardDescription className="text-xs">
              Registro de todas las importaciones de Excel/CSV
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay importaciones registradas</p>
                <p className="text-xs mt-1">Las importaciones aparecerán aquí</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Fecha</TableHead>
                      <TableHead>Archivo</TableHead>
                      <TableHead className="text-center w-[80px]">Total</TableHead>
                      <TableHead className="text-center w-[80px]">Nuevos</TableHead>
                      <TableHead className="text-center w-[80px]">Actualizados</TableHead>
                      <TableHead className="text-center w-[80px]">Errores</TableHead>
                      <TableHead className="w-[100px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(record.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFileTypeIcon(record.file_type)}
                            <span className="text-sm font-medium truncate max-w-[200px]" title={record.file_name}>
                              {record.file_name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              .{record.file_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {record.total_rows}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 font-medium">
                            +{record.inserted_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-blue-600 font-medium">
                            ↻{record.updated_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {record.error_count > 0 ? (
                            <span className="text-destructive font-medium">
                              {record.error_count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(record.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
