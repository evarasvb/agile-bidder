import { Trash2, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  name: string;
  uploadedAt: Date;
}

interface DocumentSidebarProps {
  documents: Document[];
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
}

export function DocumentSidebar({
  documents,
  activeDocId,
  onSelectDoc,
  onDeleteDoc,
}: DocumentSidebarProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'hace un momento';
    if (diffMins < 60) return `hace ${diffMins}m`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    if (diffDays < 7) return `hace ${diffDays}d`;

    return date.toLocaleDateString('es-CL');
  };

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-2 p-3">
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Sin documentos</p>
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              className={cn(
                "group p-3 rounded-lg cursor-pointer transition-all hover:bg-muted",
                activeDocId === doc.id && "bg-firmavb-blue/10 border border-firmavb-blue/30"
              )}
              onClick={() => onSelectDoc(doc.id)}
            >
              <div className="flex items-start gap-2 mb-1">
                <FileText className="h-4 w-4 text-firmavb-blue/70 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(doc.uploadedAt)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ml-auto -mt-6 relative z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDoc(doc.id);
                }}
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
