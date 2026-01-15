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
  Star,
  Search,
  Brain,
  DollarSign,
  PieChart,
  Users,
  MessageSquare,
  Send,
  Sparkles,
  LineChart,
  Calculator,
  FileSearch,
  Lightbulb,
  Repeat,
  Scale,
  X,
  LogOut,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DemoModal } from "@/components/landing/DemoModal";
import firmavbLogo from "@/assets/firmavb-logo.png";
import { toast } from "sonner";

export default function Landing() {
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const { isAuthenticated, signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Ingresa un producto o servicio para buscar");
      return;
    }
    // Navigate to licitaciones with search query
    navigate(`/licitaciones?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="min-h-screen bg-firmavb-gray">
      {/* Demo Modal */}
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />

      {/* Header with FirmaVB Branding */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md bg-white/90 border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={firmavbLogo} 
              alt="FirmaVB" 
              className="h-10 w-auto object-contain"
            />
            <div className="relative inline-block">
              <span className="font-bold text-firmavb-blue text-lg">FirmaVB</span>
              {/* Red underline - brand characteristic */}
              <div className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-firmavb-red rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user?.email}
                </span>
                <Button variant="ghost" asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar Sesión
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Iniciar Sesión</Link>
                </Button>
                <Button asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90">
                  <Link to="/auth">
                    Comenzar Gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Smart Search */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/20 hover:bg-firmavb-blue/20 px-4 py-2">
              <Sparkles className="h-4 w-4 mr-2" />
              Plataforma de Inteligencia Comercial para Licitaciones
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
              Adjudicar es clave.
            </h1>
            <h2 className="text-3xl md:text-5xl font-bold text-firmavb-blue mb-6">
              Hacerlo constante es vital.
            </h2>
            
            <p className="text-xl text-muted-foreground font-light mb-8 max-w-3xl mx-auto">
              FirmaVB maximiza tu <span className="text-success font-medium">flujo de caja</span> y 
              <span className="text-firmavb-blue font-medium"> rentabilidad</span> con inteligencia 
              artificial que transforma cómo compites en Mercado Público.
            </p>

            {/* Smart Search Bar */}
            <div className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder="¿Qué producto o servicio quieres ofertar? Ej: suministros médicos, tecnología..."
                  className="pl-12 pr-32 h-14 text-lg rounded-xl border-2 border-border focus:border-firmavb-blue transition-colors bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-firmavb-blue hover:bg-firmavb-blue/90"
                  onClick={handleSearch}
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Analizar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-light mt-2">
                Nuestra IA analizará tu intención comercial y te mostrará oportunidades relevantes
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                asChild
                className="bg-firmavb-blue hover:bg-firmavb-blue/90 shadow-lg shadow-firmavb-blue/25 text-base h-12 px-8"
              >
                <Link to="/auth">
                  Configurar mi empresa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base h-12 px-8 gap-2"
                onClick={() => setDemoOpen(true)}
              >
                <Play className="h-4 w-4" />
                Ver demostración
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Comparativo */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Resultados que transforman tu negocio
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Empresas que usan FirmaVB vs competidores tradicionales
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <ComparisonCard
              metric="Días Promedio de Pago"
              withFirma={45}
              withoutFirma={65}
              unit="días"
              icon={Clock}
              better="lower"
              description="Mejores términos de pago con licitaciones seleccionadas"
            />
            <ComparisonCard
              metric="Tasa de Éxito"
              withFirma={7}
              withoutFirma={5}
              unit="%"
              icon={Target}
              better="higher"
              description="Mayor porcentaje de adjudicación con IA optimizada"
            />
            <ComparisonCard
              metric="Utilidad Neta Promedio"
              withFirma={25}
              withoutFirma={15}
              unit="%"
              icon={TrendingUp}
              better="higher"
              description="Márgenes protegidos con análisis automático"
            />
          </div>
        </div>
      </section>

      {/* Inteligencia Generativa - 3 Pilares */}
      <section className="py-20 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20">
              <Brain className="h-3 w-3 mr-1" />
              Powered by AI
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Inteligencia Generativa para tu Negocio
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Tres pilares fundamentales que trabajan juntos para maximizar tus resultados
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <PillarCard
              icon={DollarSign}
              title="Flujo de Caja Optimizado"
              description="Priorizamos licitaciones con mejores condiciones de pago para mantener tu empresa líquida"
              features={[
                "Análisis de términos de pago",
                "Predicción de fechas de cobro",
                "Scoring de riesgo financiero"
              ]}
              color="success"
            />
            <PillarCard
              icon={PieChart}
              title="Rentabilidad Protegida"
              description="Nunca comprometas tus márgenes. La IA calcula precios óptimos automáticamente"
              features={[
                "Cálculo automático de márgenes",
                "Alertas de rentabilidad mínima",
                "Análisis de competencia"
              ]}
              color="blue"
            />
            <PillarCard
              icon={Repeat}
              title="Crecimiento Sostenido"
              description="Más adjudicaciones con menos esfuerzo. Escala tu participación en licitaciones"
              features={[
                "Matching inteligente 24/7",
                "Ofertas automáticas",
                "Historial de éxito"
              ]}
              color="warning"
            />
          </div>
        </div>
      </section>

      {/* 10 Herramientas de IA */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              10 Herramientas de IA a tu servicio
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Cada herramienta está diseñada para darte una ventaja competitiva única
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <ToolCard icon={Search} title="Scanner de Mercado" description="Monitoreo 24/7" />
            <ToolCard icon={Brain} title="Matching IA" description="95% precisión" />
            <ToolCard icon={FileText} title="Generador de Ofertas" description="30 segundos" />
            <ToolCard icon={Calculator} title="Calculadora de Márgenes" description="Automática" />
            <ToolCard icon={LineChart} title="Predictor de Éxito" description="Machine Learning" />
            <ToolCard icon={FileSearch} title="Análisis de Bases" description="Extracción de requisitos" />
            <ToolCard icon={Users} title="Perfil de Compradores" description="Historial completo" />
            <ToolCard icon={Scale} title="Comparador de Precios" description="Benchmark automático" />
            <ToolCard icon={Lightbulb} title="Recomendador" description="Sugerencias IA" />
            <ToolCard icon={Shield} title="Validador Legal" description="Cumplimiento normativo" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
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
        <div className="max-w-7xl mx-auto">
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
              <Card className="p-6 bg-gradient-to-br from-firmavb-blue/10 to-transparent border-firmavb-blue/20 shadow-sm">
                <BarChart3 className="h-10 w-10 text-firmavb-blue mb-4" />
                <h3 className="font-medium text-foreground mb-1">Dashboard en Tiempo Real</h3>
                <p className="text-sm text-muted-foreground font-light">Métricas y KPIs actualizados al instante</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-success/10 to-transparent border-success/20 shadow-sm">
                <Shield className="h-10 w-10 text-success mb-4" />
                <h3 className="font-medium text-foreground mb-1">100% Seguro</h3>
                <p className="text-sm text-muted-foreground font-light">Tus datos protegidos con encriptación</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-warning/10 to-transparent border-warning/20 shadow-sm">
                <Clock className="h-10 w-10 text-warning mb-4" />
                <h3 className="font-medium text-foreground mb-1">24/7 Activo</h3>
                <p className="text-sm text-muted-foreground font-light">Nunca se pierde una oportunidad</p>
              </Card>
              <Card className="p-6 bg-gradient-to-br from-firmavb-red/10 to-transparent border-firmavb-red/20 shadow-sm">
                <Zap className="h-10 w-10 text-firmavb-red mb-4" />
                <h3 className="font-medium text-foreground mb-1">Ultra Rápido</h3>
                <p className="text-sm text-muted-foreground font-light">Respuestas en segundos, no horas</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
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
          <Card className="p-8 md:p-12 bg-gradient-to-br from-firmavb-blue to-header-dark text-white border-0 shadow-2xl shadow-firmavb-blue/30">
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
                <Link to="/auth">
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
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center">
              <span className="text-white font-bold text-xs">FV</span>
            </div>
            <span className="font-semibold text-foreground">FirmaVB</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 FirmaVB - Inteligencia para Ganar Más. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer">Términos</span>
            <span className="hover:text-foreground cursor-pointer">Privacidad</span>
            <span className="hover:text-foreground cursor-pointer">Contacto</span>
          </div>
        </div>
      </footer>

      {/* Chat Assistant Flotante */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <Card className="w-80 h-96 flex flex-col shadow-2xl border-border/50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white text-sm">Asistente FirmaVB</p>
                  <p className="text-xs text-white/70">En línea</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20"
                onClick={() => setChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-muted/30">
              <div className="space-y-3">
                <div className="bg-card rounded-lg p-3 max-w-[85%] shadow-sm">
                  <p className="text-sm">¡Hola! 👋 Soy el asistente de FirmaVB. ¿En qué puedo ayudarte hoy?</p>
                </div>
                <div className="bg-card rounded-lg p-3 max-w-[85%] shadow-sm">
                  <p className="text-sm text-muted-foreground">Puedo ayudarte con:</p>
                  <ul className="text-sm mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
                      Configurar tu empresa
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
                      Buscar licitaciones
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" />
                      Analizar oportunidades
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input placeholder="Escribe tu mensaje..." className="text-sm" />
                <Button size="icon" className="bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button 
            size="lg"
            className="h-14 w-14 rounded-full bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] hover:opacity-90 shadow-lg shadow-[hsl(var(--firmavb-blue))]/30 animate-in fade-in duration-300"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Comparison Card for Dashboard
function ComparisonCard({ 
  metric, 
  withFirma, 
  withoutFirma, 
  unit, 
  icon: Icon, 
  better,
  description 
}: { 
  metric: string; 
  withFirma: number; 
  withoutFirma: number; 
  unit: string;
  icon: React.ElementType;
  better: 'higher' | 'lower';
  description: string;
}) {
  const improvement = better === 'higher' 
    ? ((withFirma - withoutFirma) / withoutFirma * 100).toFixed(0)
    : ((withoutFirma - withFirma) / withoutFirma * 100).toFixed(0);

  return (
    <Card className="p-6 border-border/50 bg-card hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-[hsl(var(--firmavb-blue))]/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-[hsl(var(--firmavb-blue))]" />
        </div>
        <h3 className="font-semibold text-foreground">{metric}</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-[hsl(var(--success))]/10">
          <p className="text-2xl font-bold text-[hsl(var(--success))]">{withFirma}{unit}</p>
          <p className="text-xs text-muted-foreground">Con FirmaVB</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <p className="text-2xl font-bold text-muted-foreground">{withoutFirma}{unit}</p>
          <p className="text-xs text-muted-foreground">Sin FirmaVB</p>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 mb-2">
        <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-0">
          <TrendingUp className="h-3 w-3 mr-1" />
          +{improvement}% mejor
        </Badge>
      </div>
      
      <p className="text-xs text-center text-muted-foreground">{description}</p>
    </Card>
  );
}

// Pillar Card for 3 pillars section
function PillarCard({ 
  icon: Icon, 
  title, 
  description, 
  features, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  features: string[];
  color: 'success' | 'blue' | 'warning';
}) {
  const colorClasses = {
    success: 'from-[hsl(var(--success))]/10 to-transparent border-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
    blue: 'from-[hsl(var(--firmavb-blue))]/10 to-transparent border-[hsl(var(--firmavb-blue))]/20 text-[hsl(var(--firmavb-blue))]',
    warning: 'from-[hsl(var(--warning))]/10 to-transparent border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]',
  };

  const iconColors = {
    success: 'text-[hsl(var(--success))]',
    blue: 'text-[hsl(var(--firmavb-blue))]',
    warning: 'text-[hsl(var(--warning))]',
  };

  return (
    <Card className={`p-8 bg-gradient-to-br ${colorClasses[color]} relative overflow-hidden h-full`}>
      <Icon className={`h-12 w-12 mb-4 ${iconColors[color]}`} />
      <h3 className="font-bold text-foreground text-xl mb-3">{title}</h3>
      <p className="text-muted-foreground mb-6">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className={`h-4 w-4 ${iconColors[color]}`} />
            <span className="text-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Tool Card for 10 tools grid
function ToolCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer group border-border/50">
      <div className="h-12 w-12 rounded-xl bg-[hsl(var(--firmavb-blue))]/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-[hsl(var(--firmavb-blue))]/20 transition-colors">
        <Icon className="h-6 w-6 text-[hsl(var(--firmavb-blue))]" />
      </div>
      <h4 className="font-medium text-foreground text-sm mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Card>
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
    green: 'from-[hsl(var(--success))]/10 to-transparent border-[hsl(var(--success))]/20 text-[hsl(var(--success))]',
    amber: 'from-[hsl(var(--warning))]/10 to-transparent border-[hsl(var(--warning))]/20 text-[hsl(var(--warning))]',
  };

  return (
    <Card className={`p-6 bg-gradient-to-br ${colors[color]} relative overflow-hidden`}>
      <div className="absolute top-4 right-4 text-6xl font-bold opacity-10 text-foreground">
        {step}
      </div>
      <Icon className={`h-10 w-10 mb-4 ${color === 'blue' ? 'text-[hsl(var(--firmavb-blue))]' : color === 'green' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'}`} />
      <h3 className="font-semibold text-foreground text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0 mt-0.5" />
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
          <Star key={i} className="h-4 w-4 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />
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
