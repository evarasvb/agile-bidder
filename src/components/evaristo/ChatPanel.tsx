import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  document?: {
    id: string;
    name: string;
    content?: string;
  };
}

export function ChatPanel({ document }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      content: 'Soy Don Evaristo, experto en licitaciones. Sube un documento para que lo analice y respondé tus preguntas.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !document || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simular respuesta de IA
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        content: `He analizado "${input.toLowerCase()}". ${document?.name} contiene ${document?.content?.length || 0} caracteres. Puedo ayudarte a extraer información clave, identificar cláusulas importantes, o responder preguntas específicas sobre el contenido.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="w-96 flex flex-col border-l bg-muted/30">
      {/* Header */}
      <div className="h-16 border-b px-4 flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-firmavb-blue to-firmavb-red flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Evaristo</p>
            <p className="text-xs text-muted-foreground">Análisis en vivo</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'bot' && (
                <div className="h-6 w-6 rounded-full bg-firmavb-blue/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-firmavb-blue" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[85%] rounded-lg p-2.5 text-xs",
                  msg.role === 'user'
                    ? 'bg-firmavb-blue text-white'
                    : 'bg-background border border-border'
                )}
              >
                <p className="leading-relaxed">{msg.content}</p>
              </div>

              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-firmavb-blue flex items-center justify-center shrink-0">
                  <User className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 justify-start">
              <div className="h-6 w-6 rounded-full bg-firmavb-blue/10 flex items-center justify-center">
                <Bot className="h-3 w-3 text-firmavb-blue" />
              </div>
              <div className="bg-background border border-border rounded-lg p-2.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t bg-background p-3">
        {!document ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Sube un documento para hacer preguntas
          </p>
        ) : (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Pregunta sobre el documento..."
              className="h-8 text-xs"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || !document}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90 h-8 w-8 p-0"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
