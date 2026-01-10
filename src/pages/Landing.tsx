import { 
  ArrowRight, 
  Zap, 
  Target, 
  Clock, 
  Shield, 
  BarChart3, 
  CheckCircle2,
  FileText,
  Bot,
  TrendingUp,
  Building2,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-[hsl(var(--firmavb-blue))]/5">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--firmavb-blue))]/80 flex items-center justify-center shadow-lg shadow-[hsl(var(--firmavb-blue))]/20">
              <span className="text-white font-bold text-sm">FV</span>
            </div>
            <div>
              <span className="font-bold text-foreground text-lg">FirmaVB</span>
              <p className="text-xs text-muted-foreground">Licitaciones Inteligentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Ir al Dashboard</Link>
            </Button>
            <Button asChild className="bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90">
              <Link to="/onboarding">
                Comenzar Gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-6 bg-[hsl(var(--firmavb-blue))]/10 text-[hsl(var(--firmavb-blue))] border-[hsl(var(--firmavb-blue))]/20 hover:bg-[hsl(var(--firmavb-blue))]/20">
              <Zap className="h-3 w-3 mr-1" />
              Potenciado por IA
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
              Gana más licitaciones
              <span className="block text-[hsl(var(--firmavb-blue))]">sin esfuerzo</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              FirmaVB monitorea Mercado Público 24/7, identifica oportunidades que 
              coinciden con tu inventario y genera ofertas automáticamente. 
              <span className="text-foreground font-medium"> Enfócate en vender, nosotros hacemos el resto.</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                asChild
                className="bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90 shadow-lg shadow-[hsl(var(--firmavb-blue))]/25 text-base h-12 px-8"
              >
                <Link to="/onboarding">
                  Configurar mi empresa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                asChild
                className="text-base h-12 px-8"
              >
                <Link to="/dashboard">Ver demostración</Link>
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value="500+" label="Licitaciones/día" icon={FileText} />
            <StatCard value="95%" label="Precisión IA" icon={Target} />
            <StatCard value="30s" label="Tiempo de match" icon={Clock} />
            <StatCard value="3x" label="Más ofertas enviadas" icon={TrendingUp} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              ¿Cómo funciona FirmaVB?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Automatizamos todo el proceso de licitación, desde la detección hasta la oferta final
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              step={1}
              icon={Bot}
              title="Monitoreo Automático"
              description="Escaneamos Mercado Público constantemente buscando oportunidades que coincidan con tu negocio"
              color="blue"
            />
            <FeatureCard
              step={2}
              icon={Target}
              title="Matching Inteligente"
              description="Nuestra IA compara cada licitación con tu inventario y asigna un score de coincidencia"
              color="green"
            />
            <FeatureCard
              step={3}
              icon={FileText}
              title="Ofertas Automáticas"
              description="Generamos y enviamos ofertas optimizadas con los precios y márgenes que tú defines"
              color="amber"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Deja de perder oportunidades
              </h2>
              <div className="space-y-4">
                <BenefitItem 
                  text="Nunca más te pierdas una licitación por falta de tiempo" 
                />
                <BenefitItem 
                  text="Ahorra horas de trabajo manual revisando el portal" 
                />
                <BenefitItem 
                  text="Aumenta tu tasa de adjudicación con ofertas optimizadas" 
                />
                <BenefitItem 
                  text="Controla márgenes mínimos y regiones de despacho" 
                />
                <BenefitItem 
                  text="Historial completo de todas tus participaciones" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-6 bg-gradient-to-br from-[hsl(var(--firmavb-blue))]/10 to-transparent border-[hsl(var(--firmavb-blue))]/20">
                <BarChart3 className="h-10 w-10 text-[hsl(var(--firmavb-blue))] mb-4" />
                <h3 className="font-semibold text-foreground mb-1">Dashboard en Tiempo Real</h3>
                <p className="text-sm text-muted-foreground">Métricas y KPIs actualizados al instante</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-success/10 to-transparent border-success/20">
                <Shield className="h-10 w-10 text-success mb-4" />
                <h3 className="font-semibold text-foreground mb-1">100% Seguro</h3>
                <p className="text-sm text-muted-foreground">Tus datos protegidos con encriptación</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-warning/10 to-transparent border-warning/20">
                <Clock className="h-10 w-10 text-warning mb-4" />
                <h3 className="font-semibold text-foreground mb-1">24/7 Activo</h3>
                <p className="text-sm text-muted-foreground">Nunca se pierde una oportunidad</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-[hsl(var(--firmavb-red))]/10 to-transparent border-[hsl(var(--firmavb-red))]/20">
                <Zap className="h-10 w-10 text-[hsl(var(--firmavb-red))] mb-4" />
                <h3 className="font-semibold text-foreground mb-1">Ultra Rápido</h3>
                <p className="text-sm text-muted-foreground">Respuestas en segundos, no horas</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Empresas que confían en FirmaVB
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              quote="Aumentamos nuestras adjudicaciones en un 40% el primer mes. El matching de IA es increíblemente preciso."
              author="María González"
              company="Suministros Oficina SpA"
            />
            <TestimonialCard
              quote="Antes revisaba el portal 3 horas diarias. Ahora solo reviso las alertas y envío ofertas con un clic."
              author="Carlos Muñoz"
              company="TechPro Ltda"
            />
            <TestimonialCard
              quote="La generación automática de ofertas nos ahorra muchísimo tiempo. ROI positivo desde la primera semana."
              author="Ana Rodríguez"
              company="Distribuidora Central"
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 md:p-12 bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(217,91%,35%)] text-white border-0 shadow-2xl shadow-[hsl(var(--firmavb-blue))]/30">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                ¿Listo para ganar más licitaciones?
              </h2>
              <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
                Configura tu empresa en 5 minutos y comienza a recibir oportunidades 
                que coinciden con tu inventario hoy mismo.
              </p>
              <Button 
                size="lg" 
                asChild
                className="bg-white text-[hsl(var(--firmavb-blue))] hover:bg-white/90 shadow-lg text-base h-12 px-8"
              >
                <Link to="/onboarding">
                  Comenzar Configuración
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <p className="text-sm opacity-70 mt-4">
                Sin tarjeta de crédito • Configuración en 5 minutos • Soporte 24/7
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--firmavb-blue))]/80 flex items-center justify-center">
              <span className="text-white font-bold text-xs">FV</span>
            </div>
            <span className="font-semibold text-foreground">FirmaVB</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 FirmaVB. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer">Términos</span>
            <span className="hover:text-foreground cursor-pointer">Privacidad</span>
            <span className="hover:text-foreground cursor-pointer">Contacto</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ value, label, icon: Icon }: { value: string; label: string; icon: React.ElementType }) {
  return (
    <Card className="p-4 text-center border-border/50 bg-card/50 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-[hsl(var(--firmavb-blue))] mx-auto mb-2" />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </Card>
  );
}

function FeatureCard({ 
  step, 
  icon: Icon, 
  title, 
  description, 
  color 
}: { 
  step: number; 
  icon: React.ElementType; 
  title: string; 
  description: string;
  color: 'blue' | 'green' | 'amber';
}) {
  const colors = {
    blue: 'from-[hsl(var(--firmavb-blue))]/10 to-transparent border-[hsl(var(--firmavb-blue))]/20 text-[hsl(var(--firmavb-blue))]',
    green: 'from-success/10 to-transparent border-success/20 text-success',
    amber: 'from-warning/10 to-transparent border-warning/20 text-warning',
  };

  return (
    <Card className={`p-6 bg-gradient-to-br ${colors[color]} relative overflow-hidden`}>
      <div className="absolute top-4 right-4 text-6xl font-bold opacity-10 text-foreground">
        {step}
      </div>
      <Icon className={`h-10 w-10 mb-4 ${color === 'blue' ? 'text-[hsl(var(--firmavb-blue))]' : color === 'green' ? 'text-success' : 'text-warning'}`} />
      <h3 className="font-semibold text-foreground text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
      <span className="text-foreground">{text}</span>
    </div>
  );
}

function TestimonialCard({ 
  quote, 
  author, 
  company 
}: { 
  quote: string; 
  author: string; 
  company: string;
}) {
  return (
    <Card className="p-6 border-border/50">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-warning text-warning" />
        ))}
      </div>
      <p className="text-foreground mb-4 italic">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{author}</p>
          <p className="text-sm text-muted-foreground">{company}</p>
        </div>
      </div>
    </Card>
  );
}
