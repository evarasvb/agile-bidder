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
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { downloadExtension } from '@/utils/extensionDownload';
import { toast } from 'sonner';

export default function ExtensionConfig() {
  const { data: cliente } = useCliente();
  const clienteId = cliente?.id || null;
  
  const { data: apiKeys, isLoading } = useExtensionApiKeys(clienteId);
  const { data: activity } = useExtensionActivity(clienteId);
  const createApiKey = useCreateApiKey();
  const toggleApiKey = useToggleApiKey();
  const deleteApiKey = useDeleteApiKey();

  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '••••••••••••••••••••';
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
            Gestiona las API Keys para FirmaVB Postulador
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

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                ¿No tienes la extensión?
              </h3>
              <p className="text-sm text-blue-700">
                Descarga FirmaVB Postulador para automatizar tus postulaciones en MercadoPúblico.cl
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
                        {maskKey(key.api_key)}
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

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Cómo usar la extensión</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <strong>Instala la extensión</strong>
                <p className="text-muted-foreground">Descarga y carga la extensión en Chrome</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <strong>Genera una API Key</strong>
                <p className="text-muted-foreground">Crea una key desde esta página y cópiala</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <strong>Conecta la extensión</strong>
                <p className="text-muted-foreground">Abre el popup de la extensión y pega tu API Key</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
              <div>
                <strong>¡Listo para postular!</strong>
                <p className="text-muted-foreground">Ve a MercadoPúblico y usa el botón "Postular con FirmaVB"</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
