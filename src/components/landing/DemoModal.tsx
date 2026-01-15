import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Play, 
  BarChart3, 
  Target, 
  FileText, 
  Zap,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const demoSlides = [
  {
    title: "Dashboard Inteligente",
    description: "Visualiza todas tus oportunidades en tiempo real con métricas clave y alertas automáticas.",
    icon: BarChart3,
    features: ["KPIs en tiempo real", "Alertas de vencimiento", "Seguimiento de ofertas"],
  },
  {
    title: "Matching con IA",
    description: "Nuestra IA analiza tu inventario y encuentra las licitaciones perfectas para tu negocio.",
    icon: Target,
    features: ["95% de precisión", "Análisis 24/7", "Score de coincidencia"],
  },
  {
    title: "Generación de Ofertas",
    description: "Crea ofertas profesionales en segundos con cálculo automático de márgenes.",
    icon: FileText,
    features: ["Plantillas optimizadas", "Cálculo de precios", "Envío automático"],
  },
  {
    title: "Compras Ágiles",
    description: "Responde rápidamente a oportunidades del mercado con nuestra herramienta especializada.",
    icon: Zap,
    features: ["Detección instantánea", "Propuestas rápidas", "Seguimiento completo"],
  },
];

export function DemoModal({ open, onOpenChange }: DemoModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % demoSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + demoSlides.length) % demoSlides.length);
  };

  const slide = demoSlides[currentSlide];
  const Icon = slide.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Play className="h-5 w-5 text-firmavb-red" />
            Demo de FirmaVB
          </DialogTitle>
          <DialogDescription>
            Descubre cómo FirmaVB puede transformar tu participación en licitaciones
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Slide Content */}
          <div className="bg-gradient-to-br from-firmavb-blue/10 to-firmavb-red/5 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-firmavb-blue p-3">
                <Icon className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground mb-2">{slide.title}</h3>
                <p className="text-muted-foreground font-light mb-4">{slide.description}</p>
                <div className="flex flex-wrap gap-2">
                  {slide.features.map((feature) => (
                    <Badge 
                      key={feature} 
                      variant="secondary"
                      className="bg-firmavb-blue/10 text-firmavb-blue border-0"
                    >
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex justify-center gap-2 mb-4">
            {demoSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide 
                    ? "w-6 bg-firmavb-blue" 
                    : "w-2 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              {currentSlide + 1} de {demoSlides.length}
            </span>

            {currentSlide === demoSlides.length - 1 ? (
              <Button
                size="sm"
                className="bg-firmavb-blue hover:bg-firmavb-blue/90"
                onClick={() => onOpenChange(false)}
              >
                Comenzar
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={nextSlide}
              >
                Siguiente
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}