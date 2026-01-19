// Componente de Chat con Evaristo
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, User, Code, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useEvaristoRevisar, useEvaristoMision } from '@/hooks/useEvaristo';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'evaristo';
  content: string;
  timestamp: Date;
  type?: 'text' | 'code' | 'result';
  result?: {
    success: boolean;
    output?: string;
  };
}

export function EvaristoChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'evaristo',
      content: '¡Hola! Soy Evaristo, tu programador autónomo. ¿En qué puedo ayudarte? Puedo revisar código, ejecutar misiones, o responder preguntas sobre el proyecto.',
      timestamp: new Date(),
      type: 'text',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const revisar = useEvaristoRevisar();
  const mision = useEvaristoMision();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Procesar comando
    const command = input.trim().toLowerCase();

    try {
      if (command.includes('revisar') || command.includes('revisa')) {
        const result = await revisar.mutateAsync();
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: result.message,
          timestamp: new Date(),
          type: 'result',
          result: {
            success: result.success,
            output: result.message,
          },
        };
        setMessages(prev => [...prev, evaristoMessage]);
      } else if (command.includes('mision') || command.includes('misión')) {
        // Extraer nombre de misión si está
        const misionMatch = input.match(/mision[:\s]+(\w+)/i);
        const misionFile = misionMatch ? `${misionMatch[1]}.json` : 'mision_completa_firmavb.json';
        
        const result = await mision.mutateAsync({ mision_file: misionFile });
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: result.message,
          timestamp: new Date(),
          type: 'result',
          result: {
            success: result.success,
            output: result.message,
          },
        };
        setMessages(prev => [...prev, evaristoMessage]);
      } else if (command.includes('migrar') || command.includes('migraciones')) {
        // Nueva capacidad: aplicar migraciones
        const result = await mision.mutateAsync({ mision_file: 'poderes_ampliados.json' });
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: result.message,
          timestamp: new Date(),
          type: 'result',
          result: {
            success: result.success,
            output: result.message,
          },
        };
        setMessages(prev => [...prev, evaristoMessage]);
      } else if (command.includes('poderes') || command.includes('ampliados')) {
        // Nueva capacidad: ejecutar poderes ampliados
        const result = await mision.mutateAsync({ mision_file: 'poderes_ampliados.json' });
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: result.message,
          timestamp: new Date(),
          type: 'result',
          result: {
            success: result.success,
            output: result.message,
          },
        };
        setMessages(prev => [...prev, evaristoMessage]);
      } else if (command.includes('hola') || command.includes('ayuda') || command.includes('help')) {
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: `Puedo ayudarte con:

🔍 **Revisar proyecto**: Di "revisar" o "revisa el código"
🎯 **Ejecutar misión**: Di "mision" o "ejecuta mision_completa_firmavb"
🔄 **Aplicar migraciones**: Di "migraciones" o "aplica migraciones"
⚡ **Poderes ampliados**: Di "poderes ampliados" para activar todas las capacidades
❓ **Preguntas**: Hazme cualquier pregunta sobre el proyecto

Ejemplos:
- "Revisa el proyecto"
- "Ejecuta la misión completa"
- "Aplica migraciones"
- "Poderes ampliados"`,
          timestamp: new Date(),
          type: 'text',
        };
        setMessages(prev => [...prev, evaristoMessage]);
      } else {
        // Respuesta genérica
        const evaristoMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'evaristo',
          content: `Entiendo que quieres: "${input.trim()}"

Puedo ayudarte con:
- Revisar el código del proyecto
- Ejecutar misiones predefinidas
- Responder preguntas sobre el sistema

Di "revisar" para una revisión completa, o "mision" para ejecutar una misión.`,
          timestamp: new Date(),
          type: 'text',
        };
        setMessages(prev => [...prev, evaristoMessage]);
      }
    } catch (error: any) {
      const evaristoMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'evaristo',
        content: `❌ Error: ${error.message || 'No pude procesar tu solicitud'}`,
        timestamp: new Date(),
        type: 'text',
      };
      setMessages(prev => [...prev, evaristoMessage]);
      toast.error('Error al ejecutar comando');
    } finally {
      setIsTyping(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border-firmavb-blue/20 h-[600px] flex flex-col">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-firmavb-blue to-firmavb-red flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold">Evaristo</p>
            <p className="text-xs text-muted-foreground">Programador Autónomo</p>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'evaristo' && (
                  <div className="h-8 w-8 rounded-full bg-firmavb-blue/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-firmavb-blue" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    msg.role === 'user'
                      ? 'bg-firmavb-blue text-white'
                      : 'bg-muted'
                  )}
                >
                  {msg.type === 'code' && (
                    <div className="mb-2">
                      <Code className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  
                  {msg.type === 'result' && msg.result && (
                    <div className="mb-2 flex items-center gap-2">
                      {msg.result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs font-medium">
                        {msg.result.success ? 'Completado' : 'Error'}
                      </span>
                    </div>
                  )}
                  
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  
                  {msg.result?.output && msg.result.output !== msg.content && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer">
                        Ver detalles
                      </summary>
                      <pre className="mt-2 text-xs bg-background p-2 rounded overflow-auto max-h-40">
                        {msg.result.output}
                      </pre>
                    </details>
                  )}
                  
                  <p className="text-xs opacity-70 mt-1">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-firmavb-blue/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-firmavb-blue" />
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-firmavb-blue/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-firmavb-blue" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t p-4">
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
              placeholder="Escribe un mensaje... (ej: 'revisar', 'mision', 'ayuda')"
              className="flex-1"
              disabled={isTyping}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90"
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Comandos: "revisar" | "mision" | "ayuda"
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
