import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  type ChatMessage,
  type ChatLicitacion,
  useSendChatMessage,
  useClearChat,
} from '@/hooks/useChatIA';

const SUGGESTED_QUESTIONS = [
  { label: 'Requisitos técnicos', question: '¿Cuáles son los requisitos técnicos?' },
  { label: 'Plazo de entrega', question: '¿Cuál es el plazo de entrega?' },
  { label: 'Garantías', question: '¿Qué garantías se requieren?' },
  { label: 'Criterios de evaluación', question: '¿Cuáles son los criterios de evaluación?' },
  { label: 'Presupuesto', question: '¿Cuál es el presupuesto estimado?' },
  { label: 'Resumen', question: 'Resume los puntos clave de esta licitación' },
];

interface ChatInterfaceProps {
  licitacionId: string;
  chat: ChatLicitacion | null;
  hasDocuments: boolean;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`
        shrink-0 h-7 w-7 rounded-full flex items-center justify-center
        ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
      `}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`
        max-w-[80%] rounded-lg px-3 py-2 text-sm
        ${isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted'
        }
      `}>
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {formatMessage(message.content)}
        </div>
        {message.pages_referenced && message.pages_referenced.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {message.pages_referenced.map((page, i) => (
              <Badge key={i} variant="outline" className="text-[10px] h-4">
                Pág. {page}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Simple markdown-like formatting
function formatMessage(text: string) {
  // Bold: **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function ChatInterface({ licitacionId, chat, hasDocuments }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendChatMessage(licitacionId);
  const clearChat = useClearChat(licitacionId);

  const messages: ChatMessage[] = chat?.mensajes || [];

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sendMessage.isPending]);

  const handleSend = () => {
    const question = input.trim();
    if (!question || sendMessage.isPending) return;

    setInput('');
    sendMessage.mutate({
      question,
      chatId: chat?.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (question: string) => {
    if (sendMessage.isPending) return;
    sendMessage.mutate({
      question,
      chatId: chat?.id,
    });
  };

  if (!hasDocuments) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          Sube las bases de licitación para comenzar a chatear
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          El asistente IA responderá preguntas basándose en los documentos
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Asistente IA de Licitaciones</p>
              <p className="text-xs text-muted-foreground mb-4">
                Pregúntame sobre requisitos, plazos, garantías o cualquier detalle de las bases
              </p>

              {/* Suggested questions */}
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map(({ label, question }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSuggestion(question)}
                    disabled={sendMessage.isPending}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-3">
              <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analizando documentos...
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Quick questions (when there are messages) */}
      {messages.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.slice(0, 4).map(({ label, question }) => (
              <Button
                key={label}
                variant="ghost"
                size="sm"
                className="text-[11px] h-6 px-2"
                onClick={() => handleSuggestion(question)}
                disabled={sendMessage.isPending}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder="Pregunta sobre las bases de licitación..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={sendMessage.isPending}
          />
          <div className="flex flex-col gap-1">
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {chat && messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => clearChat.mutate(chat.id)}
                title="Limpiar conversación"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
