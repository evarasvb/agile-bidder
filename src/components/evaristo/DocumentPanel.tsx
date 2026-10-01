import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocumentPanelProps {
  document?: {
    id: string;
    name: string;
    uploadedAt: Date;
    content?: string;
  };
  onUpload: () => void;
}

export function DocumentPanel({ document, onUpload }: DocumentPanelProps) {
  return (
    <div className="flex-1 flex flex-col border-r bg-background">
      {document ? (
        <>
          <div className="h-16 border-b px-6 flex items-center justify-between bg-muted/50">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-firmavb-blue" />
              <div>
                <p className="font-semibold text-sm">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {document.uploadedAt.toLocaleDateString('es-CL')}
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 max-w-3xl">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {document.content || 'Sin contenido'}
                </pre>
              </div>
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Sin documento seleccionado</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Sube un documento para analizarlo con Don Evaristo
            </p>
          </div>
          <Button
            onClick={onUpload}
            className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
          >
            <Upload className="h-4 w-4" />
            Subir documento
          </Button>
        </div>
      )}
    </div>
  );
}
