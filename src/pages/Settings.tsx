import { useState } from "react";
import { Save, Building2, MapPin, Clock, DollarSign, Shield, Key, Eye, EyeOff, CheckCircle2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import NotificacionesSettings from "@/components/settings/NotificacionesSettings";
import { getClienteId } from "@/hooks/useCliente";

const regions = [
  "Metropolitana",
  "Valparaíso",
  "Biobío",
  "Maule",
  "O'Higgins",
  "Araucanía",
  "Los Lagos",
  "Coquimbo",
  "Antofagasta",
  "Los Ríos",
  "Atacama",
  "Tarapacá",
  "Ñuble",
  "Arica y Parinacota",
  "Magallanes",
  "Aysén",
];

export default function Settings() {
  const clienteId = getClienteId();
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    "Metropolitana",
    "Valparaíso",
  ]);
  const [autoMatch, setAutoMatch] = useState(true);
  const [autoBid, setAutoBid] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyConnected, setApiKeyConnected] = useState(false);

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleSaveApiKey = () => {
    if (apiKey.length < 10) {
      toast.error("La API Key debe tener al menos 10 caracteres");
      return;
    }
    // Simular guardado
    setApiKeyConnected(true);
    toast.success("API Key de Mercado Público guardada correctamente");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajusta los parámetros globales del sistema
          </p>
        </div>
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Save className="h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      {/* Notificaciones Section */}
      <SettingsSection
        icon={Bell}
        title="Notificaciones"
        description="Configura tus preferencias de alertas por email"
      >
        <NotificacionesSettings clienteId={clienteId} />
      </SettingsSection>

      {/* API Key Section */}
      <SettingsSection
        icon={Key}
        title="Conexión Mercado Público"
        description="Configura tu API Key para enviar ofertas automáticamente"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Badge 
              variant={apiKeyConnected ? "default" : "secondary"}
              className={apiKeyConnected ? "bg-success hover:bg-success" : ""}
            >
              {apiKeyConnected ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </>
              ) : (
                "No conectado"
              )}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label>API Key de Mercado Público</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  type={showApiKey ? "text" : "password"}
                  placeholder="Ingresa tu API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey}>
                Guardar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtén tu API Key en{" "}
              <a 
                href="https://www.mercadopublico.cl" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Mercado Público
              </a>
              {" "}→ Mi Cuenta → Integraciones
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Company Info */}
      <SettingsSection
        icon={Building2}
        title="Información de Empresa"
        description="Datos de tu empresa para la licitación"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>RUT Empresa</Label>
            <Input placeholder="76.XXX.XXX-X" defaultValue="76.123.456-7" />
          </div>
          <div className="space-y-2">
            <Label>Razón Social</Label>
            <Input placeholder="Empresa SpA" defaultValue="FirmaVB SpA" />
          </div>
          <div className="space-y-2">
            <Label>Código Organismo (Mercado Público)</Label>
            <Input placeholder="XXXXXX" defaultValue="123456" />
          </div>
          <div className="space-y-2">
            <Label>Email de Contacto</Label>
            <Input type="email" placeholder="contacto@empresa.cl" defaultValue="ventas@firminvb.cl" />
          </div>
        </div>
      </SettingsSection>

      {/* Bidding Parameters */}
      <SettingsSection
        icon={DollarSign}
        title="Parámetros de Oferta"
        description="Límites y reglas para las ofertas automáticas"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monto Máximo por Oferta</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                placeholder="30" 
                defaultValue="30" 
                className="font-mono"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">UTM</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo participar en Compra Ágil (máx. 30 UTM)
            </p>
          </div>
          <div className="space-y-2">
            <Label>Margen Mínimo Global</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number" 
                placeholder="10" 
                defaultValue="10" 
                className="font-mono"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Delivery */}
      <SettingsSection
        icon={Clock}
        title="Tiempo de Entrega"
        description="Promesa de entrega para las ofertas"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Plazo de Entrega</Label>
            <Select defaultValue="24">
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12 horas</SelectItem>
                <SelectItem value="24">24 horas</SelectItem>
                <SelectItem value="48">48 horas</SelectItem>
                <SelectItem value="72">72 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de Despacho</Label>
            <Select defaultValue="delivery">
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Despacho a Domicilio</SelectItem>
                <SelectItem value="pickup">Retiro en Bodega</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      {/* Regions */}
      <SettingsSection
        icon={MapPin}
        title="Cobertura Regional"
        description="Regiones donde puedes despachar"
      >
        <div className="grid grid-cols-4 gap-3">
          {regions.map((region) => (
            <div key={region} className="flex items-center space-x-2">
              <Checkbox
                id={region}
                checked={selectedRegions.includes(region)}
                onCheckedChange={() => toggleRegion(region)}
              />
              <label
                htmlFor={region}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {region}
              </label>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Automation */}
      <SettingsSection
        icon={Shield}
        title="Automatización"
        description="Controla el comportamiento automático del sistema"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Auto-Matching</p>
              <p className="text-xs text-muted-foreground">
                Buscar coincidencias automáticamente cuando se detecten nuevas oportunidades
              </p>
            </div>
            <Switch checked={autoMatch} onCheckedChange={setAutoMatch} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Auto-Bid (Ofertas Automáticas)</p>
              <p className="text-xs text-muted-foreground">
                Enviar ofertas automáticamente cuando el match supere el 90% de confianza
              </p>
            </div>
            <Switch 
              checked={autoBid} 
              onCheckedChange={setAutoBid}
              className="data-[state=checked]:bg-success"
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

interface SettingsSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ icon: Icon, title, description, children }: SettingsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Separator className="mb-5" />
      {children}
    </div>
  );
}
