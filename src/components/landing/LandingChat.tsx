import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, X, Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

const BOT_RESPONSES: Record<string, string[]> = {
  "hola": [
    "¡Hola! 👋 Bienvenido a FirmaVB. Soy tu asistente virtual. ¿En qué puedo ayudarte?",
    "Hola, ¿cómo estás? Estoy aquí para ayudarte con cualquier pregunta sobre FirmaVB.",
  ],
  "precio": [
    "Nuestros planes están diseñados para empresas de todos los tamaños. ¿Te gustaría que te contactemos para una cotización personalizada? Puedes escribirnos a contacto@firmavb.cl o WhatsApp +56 9 9425 9157",
    "Tenemos diferentes planes según tus necesidades. ¿Quieres conocer más detalles? Contáctanos en contacto@firmavb.cl",
  ],
  "costo": [
    "Los precios varían según el plan que elijas. Te recomiendo contactarnos directamente para una cotización personalizada: contacto@firmavb.cl o WhatsApp +56 9 9425 9157",
  ],
  "como funciona": [
    "FirmaVB funciona en 3 pasos simples:\n1. Monitoreo automático de Mercado Público\n2. Matching inteligente con tu inventario\n3. Generación automática de ofertas\n\n¿Te gustaría ver una demostración?",
  ],
  "demo": [
    "¡Por supuesto! Puedes ver una demostración haciendo clic en el botón 'Ver demostración' en la página principal, o contactarnos directamente: contacto@firmavb.cl",
  ],
  "contacto": [
    "Puedes contactarnos de las siguientes formas:\n📧 Email: contacto@firmavb.cl\n💬 WhatsApp: +56 9 9425 9157\n\nEstamos disponibles de Lunes a Viernes de 9:00 a 18:00",
  ],
  "email": [
    "Nuestro email de contacto es: contacto@firmavb.cl\n\nTambién puedes escribirnos por WhatsApp: +56 9 9425 9157",
  ],
  "whatsapp": [
    "Nuestro WhatsApp es: +56 9 9425 9157\n\nTambién puedes escribirnos a: contacto@firmavb.cl",
  ],
  "licitaciones": [
    "FirmaVB te ayuda a encontrar y participar en licitaciones públicas de forma automatizada. Nuestra IA analiza Mercado Público 24/7 y encuentra oportunidades que coinciden con tu inventario.",
  ],
  "matching": [
    "El matching inteligente compara cada licitación con tu inventario usando IA. Asignamos un score de coincidencia y solo te mostramos las oportunidades más relevantes para tu negocio.",
  ],
  "ofertas": [
    "Generamos ofertas automáticamente con precios optimizados según tus márgenes. Puedes revisar, editar y enviar con un solo clic.",
  ],
  "default": [
    "Entiendo tu pregunta. Para información más detallada, te recomiendo contactarnos directamente:\n📧 contacto@firmavb.cl\n💬 WhatsApp: +56 9 9425 9157\n\n¿Hay algo más en lo que pueda ayudarte?",
    "Gracias por tu consulta. Para respuestas más específicas, contáctanos:\n📧 contacto@firmavb.cl\n💬 +56 9 9425 9157\n\n¿Tienes otra pregunta?",
  ],
};

function findBestResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase().trim();
  
  // Buscar palabras clave
  for (const [keyword, responses] of Object.entries(BOT_RESPONSES)) {
    if (keyword === "default") continue;
    
    if (lowerMessage.includes(keyword)) {
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
  
  // Respuesta por defecto
  return BOT_RESPONSES.default[Math.floor(Math.random() * BOT_RESPONSES.default.length)];
}

interface LandingChatProps {
  open: boolean;
  onClose: () => void;
}

export function LandingChat({ open, onClose }: LandingChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "¡Hola! 👋 Soy el asistente de FirmaVB. ¿En qué puedo ayudarte hoy?",
      isBot: true,
      timestamp: new Date(),
    },
    {
      id: "2",
      text: "Puedo ayudarte con:\n• Información sobre nuestros servicios\n• Cómo funciona FirmaVB\n• Precios y planes\n• Contacto directo\n\nEscribe tu pregunta y te responderé.",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    const historial = [...messages, userMessage];
    setMessages(historial);
    setInputValue("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("evaristo-soporte", {
        body: {
          messages: historial
            .filter((m) => m.id !== "1" && m.id !== "2") // saltar el saludo inicial
            .map((m) => ({ role: m.isBot ? "assistant" : "user", content: m.text })),
          contexto: {
            canal: "landing",
            whatsapp: "+56 9 9425 9157",
            email: "contacto@firmavb.cl",
          },
        },
      });
      if (error) throw error;
      const reply = (data as any)?.reply || findBestResponse(userMessage.text);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: reply, isBot: true, timestamp: new Date() }]);
    } catch {
      // Fallback a la respuesta local si la IA no está disponible.
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: findBestResponse(userMessage.text), isBot: true, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <Card className="w-80 h-[500px] flex flex-col shadow-2xl border-border/50 fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-firmavb-blue to-header-dark rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-medium text-white text-sm">Asistente FirmaVB</p>
            <p className="text-xs text-white/70">Respuestas automáticas</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-muted/30 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`rounded-lg p-3 max-w-[85%] shadow-sm ${
                message.isBot
                  ? "bg-card text-foreground"
                  : "bg-firmavb-blue text-white"
              }`}
            >
              <p className="text-sm whitespace-pre-line">{message.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card rounded-lg p-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border bg-background">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Escribe tu mensaje..."
            className="text-sm"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
          <Button
            size="icon"
            className="bg-firmavb-blue hover:bg-firmavb-blue/90 shrink-0"
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a
            href="mailto:contacto@firmavb.cl"
            className="hover:text-foreground transition-colors"
          >
            📧 contacto@firmavb.cl
          </a>
          <a
            href="https://wa.me/56994259157"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            💬 +56 9 9425 9157
          </a>
        </div>
      </div>
    </Card>
  );
}

interface LandingChatButtonProps {
  onClick: () => void;
}

export function LandingChatButton({ onClick }: LandingChatButtonProps) {
  return (
    <Button
      size="lg"
      className="h-14 w-14 rounded-full bg-gradient-to-br from-firmavb-blue to-header-dark hover:opacity-90 shadow-lg shadow-firmavb-blue/30 fixed bottom-6 right-6 z-40 animate-in fade-in duration-300"
      onClick={onClick}
      aria-label="Abrir chat de asistente"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}
