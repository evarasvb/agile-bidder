import { useState } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  ToggleLeft, 
  ToggleRight,
  Chrome,
  Shield,
  Download,
  Activity,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  useExtensionApiKeys, 
  useCreateApiKey, 
  useToggleApiKey, 
  useDeleteApiKey,
  useExtensionActivity 
} from '@/hooks/useExtensionApiKeys';
import { useCliente } from '@/hooks/useCliente';
import { useExtensionStatus } from '@/hooks/useExtensionStatus';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { downloadExtension } from '@/utils/extensionDownload';
import { toast } from 'sonner';

export default function ExtensionConfig() {
  const { data: cliente } = useCliente();
  // Estado REAL de conexión: antes esta pantalla no decía si la extensión
  // estaba conectada (el indicador vivía en una barra oculta en móvil).
  const { isConnected: extConectada, isLoading: extVerificando, lastActivity: extUltimaActividad } = useExtensionStatus();
  const clienteId = cliente?.id || null;
  
  const { data: apiKeys, isLoading } = useExtensionApiKeys(clienteId);
  const { data: activity } = useExtensionActivity(clienteId);
  const createApiKey = useCreateApiKey();
  const toggleApiKey = useToggleApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // chrome://extensions no se puede abrir como enlace desde una web (Chrome lo
  // bloquea), así que ofrecemos copiarlo para pegarlo en la barra de direcciones.
  const handleCopyExtensionsUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopiedUrl(true);
    toast.success('Copiado: pégalo en la barra de direcciones de Chrome');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleDownloadExtension = async () => {
    setIsDownloading(true);
    try {
      await downloadExtension();
      toast.success('Extensión descargada correctamente');
    } catch (error) {
      console.error('Error downloading extension:', error);
      toast.error('Error al descargar la extensión');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!clienteId) return;
    
    const result = await createApiKey.mutateAsync({
      clienteId,
      nombre: newKeyName || 'API Key'
    });
    
    setCreatedKey(result.plainKey);
    setNewKeyName('');
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseDialog = () => {
    setCreateDialogOpen(false);
    setCreatedKey(null);
    setNewKeyName('');
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
  };

  const maskKey = (key: string | null | undefined) => {
    return (key ? key.substring(0, 12) : 'fvb_ext_') + '••••••••••••••••••••';
  };

  if (!clienteId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              Debes estar logueado como cliente para gestionar las API Keys de la extensión.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Chrome className="h-7 w-7 text-primary" />
            Extensión Chrome
          </h1>
          <p className="text-muted-foreground mt-1">
            Postula más rápido: la extensión autocompleta tus ofertas en Mercado Público
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {!createdKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>Crear API Key</DialogTitle>
                  <DialogDescription>
                    Genera una nueva API Key para conectar la extensión de Chrome.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Nombre (opcional)</Label>
                    <Input
                      id="keyName"
                      placeholder="Ej: Laptop oficina"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Un nombre para identificar dónde usas esta key
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateKey}
                    disabled={createApiKey.isPending}
                  >
                    {createApiKey.isPending ? 'Creando...' : 'Generar API Key'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-green-600">
                    <Check className="h-5 w-5" />
                    API Key Creada
                  </DialogTitle>
                  <DialogDescription>
                    Copia esta key ahora. Por seguridad, no podrás verla de nuevo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="relative">
                    <Input
                      value={createdKey}
                      readOnly
                      className="pr-20 font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1"
                      onClick={handleCopyKey}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚠️ <strong>Importante:</strong> Guarda esta key en un lugar seguro. 
                      No la compartas con nadie.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCloseDialog}>
                    Entendido, ya la copié
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Estado de conexión, grande y claro (lo primero que el usuario quiere
          saber, especialmente en celular). */}
      {!extVerificando && (
        extConectada ? (
          <div className="rounded-xl border border-firmavb-green/30 bg-firmavb-green/10 px-4 py-3 flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-firmavb-green animate-pulse" />
            <p className="text-sm font-semibold text-firmavb-green">✅ Extensión conectada</p>
            {extUltimaActividad && (
              <p className="text-xs text-muted-foreground">
                Última actividad {formatDistanceToNow(extUltimaActividad, { addSuffix: true, locale: es })}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <p className="text-sm font-semibold text-amber-800">Aún no está conectada</p>
              <p className="text-xs text-amber-700">Sigue la guía y quedará lista en ~3 minutos.</p>
            </div>
            <a href="#guia-instalacion" className="text-sm font-semibold text-amber-800 underline underline-offset-2">
              Ir a la guía paso a paso ↓
            </a>
          </div>
        )
      )}

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                ¿No tienes la extensión?
              </h3>
              <p className="text-sm text-blue-700">
                Descarga FirmaVB Postulador para automatizar tus postulaciones en MercadoPúblico.cl.
                Es un archivo <strong>.zip</strong>: descárgalo, <strong>descomprímelo</strong> y cárgalo en Chrome.
                Sigue el paso a paso de más abajo 👇
              </p>
            </div>
            <Button 
              variant="outline" 
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={handleDownloadExtension}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isDownloading ? 'Descargando...' : 'Descargar Extensión (.zip)'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Tus API Keys
          </CardTitle>
          <CardDescription>
            Cada key permite una sesión activa de la extensión
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando...
            </div>
          ) : !apiKeys || apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">Sin API Keys</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primera API Key para usar la extensión
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear API Key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.nombre}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {maskKey((key as any).api_key_prefix ?? key.api_key)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.activa ? "default" : "secondary"}>
                        {key.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatRelative(key.last_used)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleApiKey.mutate({ 
                            id: key.id, 
                            activa: !key.activa 
                          })}
                          title={key.activa ? 'Desactivar' : 'Activar'}
                        >
                          {key.activa ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Eliminar">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar API Key?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. La extensión dejará de funcionar 
                                si está usando esta key.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteApiKey.mutate(key.id)}
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      {activity && activity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>
              Últimas acciones realizadas desde la extensión
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity.slice(0, 10).map((log: any) => (
                <div 
                  key={log.id}
                  className="flex items-center gap-3 text-sm py-2 border-b border-border last:border-0"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    log.action === 'submit-result' ? 'bg-green-500' :
                    log.action === 'get-offer' ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`} />
                  <div className="flex-1">
                    <span className="font-medium capitalize">
                      {log.action.replace(/-/g, ' ')}
                    </span>
                    {log.licitacion_id && (
                      <span className="text-muted-foreground ml-2">
                        - {log.licitacion_id}
                      </span>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatRelative(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions — guía detallada paso a paso (pensada para alguien que
          nunca ha instalado una extensión "descomprimida" en Chrome). */}
      <Card id="guia-instalacion">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Chrome className="h-5 w-5 text-primary" />
            Cómo instalar y usar la extensión (paso a paso)
          </CardTitle>
          <CardDescription>
            La primera vez toma ~2 minutos. Solo se instala una vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Parte A: instalar en Chrome */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">A</span>
              Instalar en Chrome (una sola vez)
            </h3>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <strong>Descarga la extensión</strong>
                  <p className="text-muted-foreground">Usa el botón <em>“Descargar Extensión (.zip)”</em> de más arriba. Se guardará el archivo <code className="bg-muted px-1 rounded">firmavb-extension.zip</code>.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <strong>Descomprime el .zip</strong>
                  <p className="text-muted-foreground">
                    Búscalo en tu carpeta de Descargas. En Windows: clic derecho → <em>“Extraer todo”</em>. En Mac: doble clic.
                    Quedará una <strong>carpeta</strong> llamada <code className="bg-muted px-1 rounded">firmavb-extension</code>. Recuerda dónde quedó.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <div className="flex-1">
                  <strong>Abre la página de extensiones de Chrome</strong>
                  <p className="text-muted-foreground mb-2">
                    Copia esta dirección y pégala en la barra de direcciones de Chrome (no se puede abrir como enlace):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded text-xs">chrome://extensions</code>
                    <Button size="sm" variant="outline" className="h-7" onClick={handleCopyExtensionsUrl}>
                      {copiedUrl ? <Check className="h-3.5 w-3.5 mr-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copiedUrl ? 'Copiado' : 'Copiar'}
                    </Button>
                  </div>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                <div>
                  <strong>Activa el “Modo de desarrollador”</strong>
                  <p className="text-muted-foreground">Es un interruptor arriba a la derecha de esa página. Actívalo.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</span>
                <div>
                  <strong>Haz clic en “Cargar descomprimida”</strong>
                  <p className="text-muted-foreground">
                    (en inglés “Load unpacked”). Se abrirá un explorador de archivos: selecciona la <strong>carpeta</strong> <code className="bg-muted px-1 rounded">firmavb-extension</code> que descomprimiste en el paso 2.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">6</span>
                <div>
                  <strong>¡Ya está instalada!</strong>
                  <p className="text-muted-foreground">
                    Verás <em>“FirmaVB Postulador”</em> en la lista. Para tenerla a mano, haz clic en el ícono de puzzle 🧩 de Chrome y fíjala con el pin 📌.
                  </p>
                </div>
              </li>
            </ol>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="text-sm text-amber-900">ℹ️ Chrome avisará que es una extensión en “modo desarrollador”: la publicación en Chrome Web Store está en trámite y mientras tanto se instala así. Si tu área de TI bloquea ese modo, puedes seguir usando FirmaVB completo y postular a mano.</p>
              <p className="text-xs text-amber-900"><strong>Qué hace y qué no:</strong> solo actúa en mercadopublico.cl y solo cuando tú postulas. No recibe ni guarda tu clave de Mercado Público: esa sesión queda en tu Chrome. Lo único que viaja a FirmaVB (por HTTPS) es la oferta que estás enviando y el registro de la postulación.</p>
              <p className="text-xs text-amber-900"><strong>Tu API key:</strong> se guarda cifrada (solo su huella), la ves una única vez, puedes desactivarla o borrarla cuando quieras y aquí queda registrado su último uso.</p>
            </div>
          </div>

          {/* Parte B: conectar y postular */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">B</span>
              Conectar tu cuenta y postular
            </h3>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">7</span>
                <div>
                  <strong>Genera tu API Key</strong>
                  <p className="text-muted-foreground">En esta misma página, haz clic en <em>“Nueva API Key”</em>, y cópiala (solo se muestra una vez).</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">8</span>
                <div>
                  <strong>Conecta la extensión</strong>
                  <p className="text-muted-foreground">Haz clic en el ícono de FirmaVB en Chrome, pega tu API Key y guarda.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">9</span>
                <div>
                  <strong>¡Listo para postular!</strong>
                  <p className="text-muted-foreground">Entra a MercadoPúblico.cl a una compra ágil o licitación y usa el botón <em>“Postular con FirmaVB”</em>.</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="border-t pt-4 text-sm text-muted-foreground">
            ¿Te quedaste pegado en algún paso? Escríbenos a <a className="text-primary font-medium" href="mailto:contacto@firmavb.cl">contacto@firmavb.cl</a> o por WhatsApp al <a className="text-primary font-medium" href="https://wa.me/56994259157" target="_blank" rel="noopener noreferrer">+56 9 9425 9157</a> y te ayudamos a instalarla.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
