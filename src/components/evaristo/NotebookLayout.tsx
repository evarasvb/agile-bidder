import { useState, useRef } from 'react';
import { Plus, Menu, X, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DocumentPanel } from './DocumentPanel';
import { ChatPanel } from './ChatPanel';
import { DocumentSidebar } from './DocumentSidebar';

interface Document {
  id: string;
  name: string;
  uploadedAt: Date;
  content?: string;
}

export function NotebookLayout() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const doc: Document = {
          id: Date.now().toString(),
          name: file.name,
          uploadedAt: new Date(),
          content: event.target?.result as string,
        };
        setDocuments(prev => [doc, ...prev]);
        setActiveDocId(doc.id);
      };
      reader.readAsText(file);
    });
  };

  const activeDoc = documents.find(d => d.id === activeDocId);

  return (
    <div className="h-screen flex bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r bg-muted/30 transition-all duration-300",
          showSidebar ? "w-64" : "w-0"
        )}
      >
        {showSidebar && (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Documentos</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(false)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-3 border-b">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Nuevo documento
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <DocumentSidebar
              documents={documents}
              activeDocId={activeDocId}
              onSelectDoc={setActiveDocId}
              onDeleteDoc={(id) => setDocuments(prev => prev.filter(d => d.id !== id))}
            />
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {!showSidebar && (
          <div className="h-12 border-b px-4 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(true)}
              className="h-6 w-6"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex-1 flex gap-0">
          {/* Document Panel */}
          <DocumentPanel
            document={activeDoc}
            onUpload={() => fileInputRef.current?.click()}
          />

          {/* Chat Panel */}
          <ChatPanel document={activeDoc} />
        </div>
      </div>
    </div>
  );
}
