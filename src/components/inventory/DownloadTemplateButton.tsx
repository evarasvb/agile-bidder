import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { generateInventoryTemplateData, generateInventoryInstructions } from '@/hooks/useInventoryBulk';
import { toast } from 'sonner';
import { downloadSpreadsheetWorkbook, recordsToSpreadsheetRows } from '@/lib/excelFiles';

export function DownloadTemplateButton() {
  const handleDownload = async () => {
    try {
      const templateData = generateInventoryTemplateData();
      const instructionsData = generateInventoryInstructions();
      await downloadSpreadsheetWorkbook('plantilla_inventario.xlsx', [
        {
          name: 'Productos',
          rows: recordsToSpreadsheetRows(templateData),
          columnWidths: [15, 40, 12, 10, 20, 10, 15, 15, 18, 20, 40, 50],
        },
        {
          name: 'Instrucciones',
          rows: recordsToSpreadsheetRows(instructionsData),
          columnWidths: [80],
        },
      ]);
      
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
