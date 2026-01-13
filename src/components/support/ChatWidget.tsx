import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Tawk.to widget integration
declare global {
  interface Window {
    Tawk_API?: {
      toggle: () => void;
      maximize: () => void;
      minimize: () => void;
      hideWidget: () => void;
      showWidget: () => void;
      popup: () => void;
      onLoad?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

interface ChatWidgetProps {
  propertyId?: string; // Tawk.to property ID
  widgetId?: string;   // Tawk.to widget ID
  fallbackEnabled?: boolean;
}

export function ChatWidget({ 
  propertyId = 'default', // Replace with actual Tawk.to ID in production
  widgetId = 'default',
  fallbackEnabled = true 
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFallback, setShowFallback] = useState(fallbackEnabled);

  // Load Tawk.to script
  useEffect(() => {
    if (propertyId === 'default' || widgetId === 'default') {
      // Use fallback if no Tawk.to credentials
      return;
    }

    // Load Tawk.to
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    window.Tawk_LoadStart = new Date();

    // Set up onLoad callback
    const checkTawkApi = setInterval(() => {
      if (window.Tawk_API && window.Tawk_API.hideWidget) {
        window.Tawk_API.hideWidget();
        setShowFallback(false);
        clearInterval(checkTawkApi);
      }
    }, 500);

    return () => {
      clearInterval(checkTawkApi);
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [propertyId, widgetId]);

  const handleClick = () => {
    if (window.Tawk_API && propertyId !== 'default') {
      window.Tawk_API.toggle();
    } else {
      setIsOpen(!isOpen);
    }
  };

  if (!showFallback && propertyId === 'default') {
    return null;
  }

  return (
    <>
      {/* Fallback Chat Panel */}
      {showFallback && isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 bg-card border rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="bg-primary p-4 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                <span className="font-semibold">Soporte FirmaVB</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-4">
              ¡Hola! 👋 ¿En qué podemos ayudarte?
            </p>
            <div className="space-y-3">
              <a 
                href="mailto:soporte@firmavb.cl" 
                className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="text-lg">📧</span>
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">soporte@firmavb.cl</p>
                </div>
              </a>
              <a 
                href="https://wa.me/56912345678" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="text-lg">💬</span>
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">+56 9 1234 5678</p>
                </div>
              </a>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  Horario: Lun-Vie 9:00 - 18:00
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <Button
        onClick={handleClick}
        className={cn(
          "fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90",
          "transition-transform hover:scale-110"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
