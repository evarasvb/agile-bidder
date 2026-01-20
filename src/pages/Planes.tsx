import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Building2, Crown, Sparkles } from 'lucide-react';
import { usePlanes, formatPrecio, calcularAhorroAnual } from '@/hooks/usePlanes';
import { Skeleton } from '@/components/ui/skeleton';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  'Free': <Sparkles className="h-6 w-6" />,
  'Starter': <Zap className="h-6 w-6" />,
  'Professional': <Building2 className="h-6 w-6" />,
  'Enterprise': <Crown className="h-6 w-6" />,
};

const PLAN_COLORS: Record<string, string> = {
  'Free': 'border-gray-200',
  'Starter': 'border-blue-200',
  'Professional': 'border-purple-200 ring-2 ring-purple-500',
  'Enterprise': 'border-yellow-200',
};

export default function Planes() {
  const { data: planes, isLoading } = usePlanes();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Planes y Precios</h1>
            <p className="text-muted-foreground mt-2">
              Elige el plan que mejor se adapte a tu negocio
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[400px] w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Planes y Precios</h1>
          <p className="text-muted-foreground mt-2">
            Elige el plan que mejor se adapte a tu negocio
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {planes?.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col ${PLAN_COLORS[plan.nombre] || 'border-gray-200'}`}
            >
              {plan.nombre === 'Professional' && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500">
                  Más Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 p-3 bg-muted rounded-full w-fit">
                  {PLAN_ICONS[plan.nombre] || <Sparkles className="h-6 w-6" />}
                </div>
                <CardTitle className="text-xl">{plan.nombre}</CardTitle>
                <CardDescription>{plan.descripcion}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold">
                    {formatPrecio(plan.precio_mensual)}
                  </div>
                  <div className="text-sm text-muted-foreground">/mes</div>
                  {plan.precio_anual && plan.precio_mensual > 0 && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Ahorra {formatPrecio(calcularAhorroAnual(plan.precio_mensual, plan.precio_anual))} al año
                      </Badge>
                    </div>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 pt-4 border-t space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Licitaciones/mes:</span>
                    <span className="font-medium text-foreground">
                      {plan.limite_licitaciones === null ? 'Ilimitadas' : plan.limite_licitaciones}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Usuarios:</span>
                    <span className="font-medium text-foreground">
                      {plan.limite_usuarios === 1 ? '1' : plan.limite_usuarios || 'Ilimitados'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-Bid:</span>
                    <span className="font-medium text-foreground">
                      {plan.tiene_auto_bid ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>BI Avanzado:</span>
                    <span className="font-medium text-foreground">
                      {plan.tiene_bi_avanzado ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.nombre === 'Professional' ? 'default' : 'outline'}
                >
                  {plan.precio_mensual === 0 ? 'Comenzar Gratis' : 'Seleccionar Plan'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ or additional info */}
        <Card>
          <CardHeader>
            <CardTitle>¿Tienes preguntas?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-1">¿Puedo cambiar de plan?</h4>
              <p className="text-sm text-muted-foreground">
                Sí, puedes actualizar o degradar tu plan en cualquier momento. Los cambios se aplican inmediatamente.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">¿Hay descuento por pago anual?</h4>
              <p className="text-sm text-muted-foreground">
                Sí, al pagar anualmente obtienes 2 meses gratis (ahorro del ~17%).
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">¿Qué incluye el plan Enterprise?</h4>
              <p className="text-sm text-muted-foreground">
                Account manager dedicado, integraciones personalizadas, SLA garantizado y soporte 24/7.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-1">¿Necesito tarjeta de crédito para el plan Free?</h4>
              <p className="text-sm text-muted-foreground">
                No, puedes comenzar a usar el plan gratuito sin ingresar datos de pago.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
