// Página de administración para Evaristo
import { EvaristoPanel } from '@/components/evaristo/EvaristoPanel';
import { EvaristoChat } from '@/components/evaristo/EvaristoChat';
import { FirmaVBHeader } from '@/components/layout/FirmaVBHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, BookOpen, Settings, MessageSquare, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminEvaristo() {
  return (
    <div className="space-y-6 p-6">
      <FirmaVBHeader 
        title="Evaristo - Administración"
        subtitle="Control y ejecución remota del programador autónomo"
      />

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-firmavb-blue" />
              Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-firmavb-blue">Online</p>
            <p className="text-xs text-muted-foreground mt-1">
              Evaristo está listo para trabajar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4 text-firmavb-green" />
              Configuración
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              API Keys configuradas en Supabase Secrets
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-xs"
              asChild
            >
              <Link to="/admin/settings">Ver configuración</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-firmavb-orange" />
              Documentación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guía completa de configuración
            </p>
            <Button 
              variant="link" 
              className="p-0 h-auto mt-2 text-xs"
              onClick={() => window.open('/evaristo/CONFIGURACION_ONLINE.md', '_blank')}
            >
              Ver documentación
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversar con Evaristo
          </TabsTrigger>
          <TabsTrigger value="panel" className="gap-2">
            <Terminal className="h-4 w-4" />
            Panel de Control
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="mt-4">
          <EvaristoChat />
        </TabsContent>
        
        <TabsContent value="panel" className="mt-4">
          <EvaristoPanel />
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Misiones Disponibles</CardTitle>
          <CardDescription>
            Misiones predefinidas que Evaristo puede ejecutar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">Misión Completa FirmaVB</p>
                <p className="text-sm text-muted-foreground">
                  Optimización total: extracción, matching, frontend, branding
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Esto se manejará desde el panel
                }}
              >
                Ejecutar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
