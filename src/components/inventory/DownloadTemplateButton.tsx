import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateTemplateData, generateInstructionsData } from '@/hooks/useClienteInventarioBulk';
import { toast } from 'sonner';

export function DownloadTemplateButton() {
  const handleDownload = () => {
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Products sheet with template data
      const templateData = generateTemplateData();
      const wsProducts = XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths for products sheet
      wsProducts['!cols'] = [
        { wch: 15 },  // SKU
        { wch: 35 },  // Nombre del Producto
        { wch: 50 },  // Descripción
        { wch: 20 },  // Categoría
        { wch: 15 },  // Precio Unitario
        { wch: 15 },  // Unidad de Medida
        { wch: 40 },  // Keywords para Matching
      ];
      
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');
      
      // Instructions sheet
      const instructionsData = generateInstructionsData();
      const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
      wsInstructions['!cols'] = [{ wch: 80 }];
      
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');
      
      // Download file
      XLSX.writeFile(wb, 'plantilla_productos_firmavb.xlsx');
      
      toast.success('📥 Plantilla descargada correctamente');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  return (
    <Button 
      variant="outline" 
      className="gap-2 border-primary text-primary hover:bg-primary/10"
      onClick={handleDownload}
    >
      <Download className="h-4 w-4" />
      Descargar Plantilla
    </Button>
  );
}
