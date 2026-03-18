import { useCallback, useState } from 'react';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  type DocumentoLicitacion,
  useUploadDocument,
  useDeleteDocument,
} from '@/hooks/useChatIA';

interface PdfUploadAreaProps {
  licitacionId: string;
  documents: DocumentoLicitacion[];
  compact?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusIcon(status: string) {
  switch (status) {
    case 'uploading':
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'ready':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'uploading': return 'Subiendo...';
    case 'processing': return 'Procesando...';
    case 'ready': return 'Listo';
    case 'error': return 'Error';
    default: return status;
  }
}

export function PdfUploadArea({ licitacionId, documents, compact }: PdfUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadDocument(licitacionId);
  const deleteMutation = useDeleteDocument(licitacionId);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    pdfFiles.forEach(file => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const readyCount = documents.filter(d => d.status === 'ready').length;
  const processingCount = documents.filter(d => d.status === 'processing' || d.status === 'uploading').length;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg transition-colors cursor-pointer
          ${compact ? 'p-3' : 'p-6'}
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
          }
        `}
        onClick={() => document.getElementById('pdf-upload-input')?.click()}
      >
        <input
          id="pdf-upload-input"
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />
        <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col items-center gap-2'}`}>
          <Upload className={`${compact ? 'h-5 w-5' : 'h-8 w-8'} text-muted-foreground`} />
          <div className={compact ? '' : 'text-center'}>
            <p className={`font-medium ${compact ? 'text-sm' : ''}`}>
              {compact ? 'Subir bases de licitación (PDF)' : 'Arrastra PDFs aquí o haz clic para seleccionar'}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-1">
                Bases de licitación en formato PDF (máx. 50MB cada uno)
              </p>
            )}
          </div>
        </div>
        {uploadMutation.isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Subiendo...</span>
            </div>
          </div>
        )}
      </div>

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {!compact && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Documentos ({documents.length})
              </p>
              {readyCount > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-200">
                  {readyCount} listo{readyCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}

          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-2 rounded-md bg-muted/50 text-sm"
            >
              {statusIcon(doc.status)}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-xs">{doc.filename}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{statusLabel(doc.status)}</span>
                  {doc.total_pages && <span>{doc.total_pages} pág.</span>}
                  {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                </div>
                {doc.status === 'error' && doc.error_message && (
                  <p className="text-xs text-red-500 mt-0.5">{doc.error_message}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ documentId: doc.id, storagePath: doc.storage_path });
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {processingCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              Procesando {processingCount} documento{processingCount > 1 ? 's' : ''}...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
