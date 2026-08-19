import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plug, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCliente, useActualizarCliente } from '@/hooks/useCliente';

/**
 * Conexión opcional con Odoo para importar fotos de producto por SKU. Las
 * credenciales se guardan en el cliente (protegidas por RLS) y sólo las usa la
 * Edge Function importar-odoo (server-side).
 */
export function OdooConexionCard() {
  const { data: cliente } = useCliente();
  const actualizar = useActualizarCliente();

  const [url, setUrl] = useState('');
  const [db, setDb] = useState('');
  const [user, setUser] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (cliente) {
      setUrl(cliente.odoo_url || '');
      setDb(cliente.odoo_db || '');
      setUser(cliente.odoo_user || '');
      setApiKey(cliente.odoo_api_key || '');
    }
  }, [cliente]);

  const guardar = () => {
    if (!cliente?.id) return;
    actualizar.mutate(
      {
        id: cliente.id,
        odoo_url: url.trim() || null,
        odoo_db: db.trim() || null,
        odoo_user: user.trim() || null,
        odoo_api_key: apiKey.trim() || null,
      } as any,
      { onSuccess: () => toast.success('Conexión con Odoo guardada') }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Conexión con Odoo (opcional)
        </CardTitle>
        <CardDescription>
          Si usas Odoo, importamos las fotos de tus productos por SKU (default_code). Usa una API key de Odoo,
          no tu contraseña. Se guarda de forma segura y solo se usa en el servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="odoo-url">URL de Odoo</Label>
            <Input id="odoo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://miempresa.odoo.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="odoo-db">Base de datos</Label>
            <Input id="odoo-db" value={db} onChange={(e) => setDb(e.target.value)} placeholder="miempresa" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="odoo-user">Usuario (email)</Label>
            <Input id="odoo-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="usuario@empresa.cl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="odoo-key">API key</Label>
            <Input id="odoo-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={guardar} disabled={actualizar.isPending}>
            {actualizar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar conexión
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Luego, en Inventario → “Enriquecer con IA” → “Importar fotos de Odoo”.
        </p>
      </CardContent>
    </Card>
  );
}
