import { useState, useEffect } from "react";
import { Save, Building2, MapPin, Clock, DollarSign, Shield, Key, Eye, EyeOff, CheckCircle2, Bell, Loader2, Settings as SettingsIcon, AlertCircle, Percent, Info } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NotificacionesSettings from "@/components/settings/NotificacionesSettings";
import PermisosRolConfig from "@/components/settings/PermisosRolConfig";
import { getClienteId } from "@/hooks/useCliente";
import { Link } from "react-router-dom";
import { 
  useUserSettings, 
  useSaveUserSettings, 
  DEFAULT_SETTINGS,
  CompanySettings,
  BiddingSettings,
  DeliverySettings,
  AutomationSettings,
  UserSettings,
  RegionConfig
} from "@/hooks/useUserSettings";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const { user } = useAuth();
  const { isSuperAdmin } = useRolePermissions();
  const { data: savedSettings, isLoading: isLoadingSettings, error: settingsError } = useUserSettings();
  const saveSettingsMutation = useSaveUserSettings();
  const [activeTab, setActiveTab] = useState("general");
  
  const [settings, setSettings] = useState<Omit<UserSettings, 'id' | 'user_id'>>({
    ...DEFAULT_SETTINGS,
    api_key_encrypted: '',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load settings from database when available
  useEffect(() => {
    if (savedSettings) {
      // Inicializar regiones_config si no existe
      let regionesConfig = savedSettings.regiones_config || [];
      if (regionesConfig.length === 0 && savedSettings.regions) {
        // Migrar de regions a regiones_config
        regionesConfig = regions.map(region => ({
          nombre: region,
          activa: savedSettings.regions.includes(region),
          recargo_porcentaje: 0,
        }));
      }
      
      setSettings({
        company_settings: savedSettings.company_settings,
        bidding_settings: savedSettings.bidding_settings,
        delivery_settings: savedSettings.delivery_settings,
        automation_settings: savedSettings.automation_settings,
        regions: savedSettings.regions,
        regiones_config: regionesConfig,
        api_key_encrypted: savedSettings.api_key_encrypted || '',
        api_key_connected: savedSettings.api_key_connected,
      });
    }
  }, [savedSettings]);

  // Track changes
  const updateCompany = (field: keyof CompanySettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      company_settings: { ...prev.company_settings, [field]: value },
    }));
    setHasChanges(true);
  };

  const updateBidding = (field: keyof BiddingSettings, value: number) => {
    setSettings((prev) => ({
      ...prev,
      bidding_settings: { ...prev.bidding_settings, [field]: value },
    }));
    setHasChanges(true);
  };

  const updateDelivery = (field: keyof DeliverySettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      delivery_settings: { ...prev.delivery_settings, [field]: value },
    }));
    setHasChanges(true);
  };

  const updateAutomation = (field: keyof AutomationSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      automation_settings: { ...prev.automation_settings, [field]: value },
    }));
    setHasChanges(true);
  };

  const toggleRegion = (region: string) => {
    setSettings((prev) => {
      const isActive = prev.regions.includes(region);
      const newRegions = isActive
        ? prev.regions.filter((r) => r !== region)
        : [...prev.regions, region];
      
      // Actualizar también regiones_config
      const newRegionesConfig = prev.regiones_config || [];
      const regionIndex = newRegionesConfig.findIndex(r => r.nombre === region);
      
      if (regionIndex >= 0) {
        newRegionesConfig[regionIndex].activa = !isActive;
      } else {
        newRegionesConfig.push({
          nombre: region,
          activa: !isActive,
          recargo_porcentaje: 0,
        });
      }
      
      return {
        ...prev,
        regions: newRegions,
        regiones_config: newRegionesConfig,
      };
    });
    setHasChanges(true);
  };

  const updateRegionRecargo = (regionNombre: string, recargo: number) => {
    setSettings((prev) => {
      const newRegionesConfig = [...(prev.regiones_config || [])];
      const regionIndex = newRegionesConfig.findIndex(r => r.nombre === regionNombre);
      
      if (regionIndex >= 0) {
        newRegionesConfig[regionIndex].recargo_porcentaje = Math.max(0, Math.min(100, recargo));
      } else {
        newRegionesConfig.push({
          nombre: regionNombre,
          activa: prev.regions.includes(regionNombre),
          recargo_porcentaje: Math.max(0, Math.min(100, recargo)),
        });
      }
      
      return {
        ...prev,
        regiones_config: newRegionesConfig,
      };
    });
    setHasChanges(true);
  };

  const handleSaveApiKey = () => {
    if (!settings.api_key_encrypted || settings.api_key_encrypted.length < 10) {
      toast.error("La API Key debe tener al menos 10 caracteres");
      return;
    }
    setSettings(prev => ({ ...prev, api_key_connected: true }));
    setHasChanges(true);
    toast.success("API Key guardada - recuerda guardar los cambios");
  };

  const handleSaveAllChanges = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión para guardar configuraciones");
      return;
    }
    
    try {
      await saveSettingsMutation.mutateAsync(settings);
      setHasChanges(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  // Show loading state
  if (isLoadingSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show auth required message
  if (!user) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Debes iniciar sesión para ver y guardar tus configuraciones.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ajusta los parámetros globales del sistema
          </p>
        </div>
        {activeTab === 'general' && (
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="outline" className="gap-2">
                <SettingsIcon className="h-4 w-4" />
                Configurar Odoo
              </Button>
            </Link>
            <Button 
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={handleSaveAllChanges}
              disabled={saveSettingsMutation.isPending || !hasChanges}
            >
              {saveSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Guardar Cambios
              {hasChanges && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">•</Badge>}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="permisos" className="gap-2">
              <Shield className="h-4 w-4" />
              Permisos por Rol
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab: General Settings */}
        <TabsContent value="general" className="mt-6 max-w-4xl space-y-6">
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
                  variant={settings.api_key_connected ? "default" : "secondary"}
                  className={settings.api_key_connected ? "bg-success hover:bg-success" : ""}
                >
                  {settings.api_key_connected ? (
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
                      value={settings.api_key_encrypted || ''}
                      onChange={(e) => {
                        setSettings(prev => ({ ...prev, api_key_encrypted: e.target.value }));
                        setHasChanges(true);
                      }}
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
                <Input 
                  placeholder="76.XXX.XXX-X" 
                  value={settings.company_settings.rut}
                  onChange={(e) => updateCompany('rut', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Razón Social</Label>
                <Input 
                  placeholder="Empresa SpA" 
                  value={settings.company_settings.razonSocial}
                  onChange={(e) => updateCompany('razonSocial', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Código Organismo (Mercado Público)</Label>
                <Input 
                  placeholder="XXXXXX" 
                  value={settings.company_settings.codigoOrganismo}
                  onChange={(e) => updateCompany('codigoOrganismo', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email de Contacto</Label>
                <Input 
                  type="email" 
                  placeholder="contacto@empresa.cl" 
                  value={settings.company_settings.emailContacto}
                  onChange={(e) => updateCompany('emailContacto', e.target.value)}
                />
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
                    value={settings.bidding_settings.montoMaximoUTM}
                    onChange={(e) => updateBidding('montoMaximoUTM', Number(e.target.value))}
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
                    value={settings.bidding_settings.margenMinimoGlobal}
                    onChange={(e) => updateBidding('margenMinimoGlobal', Number(e.target.value))}
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
                <Select 
                  value={settings.delivery_settings.plazoEntrega}
                  onValueChange={(value) => updateDelivery('plazoEntrega', value)}
                >
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
                <Select 
                  value={settings.delivery_settings.tipoDespacho}
                  onValueChange={(value) => updateDelivery('tipoDespacho', value)}
                >
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

          {/* Regions with Recargo */}
          <SettingsSection
            icon={MapPin}
            title="Cobertura Regional con Recargos"
            description="Selecciona regiones donde quieres vender y configura recargos por región"
          >
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Solo se mostrarán compras ágiles de las regiones seleccionadas. El recargo se aplica al precio neto del producto.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              {regions.map((region) => {
                const isActive = settings.regions.includes(region);
                const regionConfig = settings.regiones_config?.find(r => r.nombre === region);
                const recargo = regionConfig?.recargo_porcentaje ?? 0;
                
                return (
                  <div 
                    key={region} 
                    className={`p-3 rounded-lg border transition-colors ${
                      isActive 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={region}
                          checked={isActive}
                          onCheckedChange={() => toggleRegion(region)}
                        />
                        <label
                          htmlFor={region}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          {region}
                        </label>
                      </div>
                      {isActive && (
                        <Badge variant={isActive ? "default" : "secondary"}>
                          Activa
                        </Badge>
                      )}
                    </div>
                    
                    {isActive && (
                      <div className="mt-2 pl-6 space-y-2">
                        <div className="flex items-center gap-2">
                          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label htmlFor={`recargo-${region}`} className="text-xs text-muted-foreground">
                            Recargo al precio neto:
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`recargo-${region}`}
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className="w-20 h-7 text-xs"
                              value={recargo}
                              onChange={(e) => updateRegionRecargo(region, Number(e.target.value))}
                              placeholder="0"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </div>
                        {recargo > 0 && (
                          <p className="text-xs text-muted-foreground pl-6">
                            Ejemplo: Producto de $10.000 → Precio con recargo: ${(10000 * (1 + recargo / 100)).toLocaleString('es-CL')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Total regiones activas:</strong> {settings.regions.length} de {regions.length}
              </p>
              {settings.regiones_config?.some(r => r.activa && r.recargo_porcentaje > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>Regiones con recargo:</strong>{' '}
                  {settings.regiones_config
                    .filter(r => r.activa && r.recargo_porcentaje > 0)
                    .map(r => `${r.nombre} (+${r.recargo_porcentaje}%)`)
                    .join(', ')}
                </p>
              )}
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
                <Switch 
                  checked={settings.automation_settings.autoMatch} 
                  onCheckedChange={(checked) => updateAutomation('autoMatch', checked)} 
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Auto-Bid (Ofertas Automáticas)</p>
                  <p className="text-xs text-muted-foreground">
                    Enviar ofertas automáticamente cuando el match supere el 90% de confianza
                  </p>
                </div>
                <Switch 
                  checked={settings.automation_settings.autoBid} 
                  onCheckedChange={(checked) => updateAutomation('autoBid', checked)}
                  className="data-[state=checked]:bg-success"
                />
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        {/* Tab: Permisos por Rol (Solo Super Admin) */}
        {isSuperAdmin && (
          <TabsContent value="permisos" className="mt-6">
            <PermisosRolConfig />
          </TabsContent>
        )}
      </Tabs>
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
