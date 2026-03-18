import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { PdfUploadArea } from '@/components/chat-ia/PdfUploadArea';
import { ChatInterface } from '@/components/chat-ia/ChatInterface';
import {
  useDocumentosLicitacion,
  useChatLicitacion,
} from '@/hooks/useChatIA';

export default function ChatIA() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const licitacionId = id || '';
  const { data: documents = [], isLoading: docsLoading } = useDocumentosLicitacion(licitacionId);
  const { data: chat, isLoading: chatLoading } = useChatLicitacion(licitacionId);

  const readyDocs = documents.filter(d => d.status === 'ready');
  const hasDocuments = readyDocs.length > 0;
  const isLoading = docsLoading || chatLoading;

  if (!id) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">ID de licitación no encontrado</p>
        <Button variant="link" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Chat IA — Bases de Licitación</h1>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{licitacionId}</p>
        </div>
        {hasDocuments && (
          <Badge variant="outline" className="text-green-600 border-green-200">
            <FileText className="h-3 w-3 mr-1" />
            {readyDocs.length} doc{readyDocs.length > 1 ? 's' : ''} listo{readyDocs.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Main layout: sidebar (docs) + chat */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100%-4rem)]">
        {/* Documents sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <PdfUploadArea
                  licitacionId={licitacionId}
                  documents={documents}
                  compact
                />
              )}
            </CardContent>
          </Card>

          {/* Auto summary card */}
          {readyDocs.some(d => d.resumen_automatico) && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Resumen Automático
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {readyDocs.filter(d => d.resumen_automatico).map(doc => {
                  const summary = doc.resumen_automatico;
                  return (
                    <div key={doc.id} className="space-y-2 text-xs">
                      {summary?.objeto && (
                        <div>
                          <p className="font-medium text-muted-foreground">Objeto</p>
                          <p>{summary.objeto}</p>
                        </div>
                      )}
                      {summary?.presupuesto && (
                        <div>
                          <p className="font-medium text-muted-foreground">Presupuesto</p>
                          <p>{summary.presupuesto}</p>
                        </div>
                      )}
                      {summary?.requisitos_tecnicos?.length > 0 && (
                        <div>
                          <p className="font-medium text-muted-foreground">Requisitos</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {summary.requisitos_tecnicos.slice(0, 3).map((r: string, i: number) => (
                              <li key={i}>{r}</li>
                            ))}
                            {summary.requisitos_tecnicos.length > 3 && (
                              <li className="text-muted-foreground">
                                +{summary.requisitos_tecnicos.length - 3} más
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      {summary?.garantias && (
                        <div>
                          <p className="font-medium text-muted-foreground">Garantías</p>
                          {summary.garantias.seriedad && <p>Seriedad: {summary.garantias.seriedad}</p>}
                          {summary.garantias.fiel_cumplimiento && <p>Fiel cumplimiento: {summary.garantias.fiel_cumplimiento}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Chat area */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat con IA
              {chat?.mensajes?.length ? (
                <Badge variant="secondary" className="text-[10px]">
                  {chat.mensajes.filter((m: any) => m.role === 'user').length} preguntas
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <Separator />
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-12 w-1/2 ml-auto" />
                <Skeleton className="h-12 w-2/3" />
              </div>
            ) : (
              <ChatInterface
                licitacionId={licitacionId}
                chat={chat || null}
                hasDocuments={hasDocuments}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
