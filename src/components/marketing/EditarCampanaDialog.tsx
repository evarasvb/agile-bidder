import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { MarketingCampaign, MarketingPieza } from '@/hooks/useMarketingCampaigns';

const ESTADOS: MarketingCampaign['estado'][] = ['draft', 'scheduled', 'ejecutando', 'completada', 'cancelada'];
const ESTADO_LABEL: Record<MarketingCampaign['estado'], string> = {
  draft: 'Borrador', scheduled: 'Programada', ejecutando: 'Ejecutando',
  completada: 'Completada', cancelada: 'Cancelada',
};

// Mismo mapeo canal→tipo/nombre que NuevaCampanaRapida, para que una pieza
// creada acá se vea y se comporte igual que una creada al armar la campaña.
type CanalTipo = 'email' | 'whatsapp' | 'facebook' | 'instagram';
const CANALES: { id: CanalTipo; label: string; icon: typeof Mail; tipo: MarketingPieza['tipo'] }[] = [
  { id: 'email', label: 'Email', icon: Mail, tipo: 'email' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tipo: 'whatsapp' },
  // La tabla real acepta 'social' para facebook/instagram (igual que
  // NuevaCampanaRapida), aunque el tipo MarketingPieza no lo liste todavía.
  { id: 'facebook', label: 'Facebook', icon: Facebook, tipo: 'social' as MarketingPieza['tipo'] },
  { id: 'instagram', label: 'Instagram', icon: Instagram, tipo: 'social' as MarketingPieza['tipo'] },
];
const nombrePieza = (canal: CanalTipo, nombreCampana: string) =>
  `${canal.charAt(0).toUpperCase() + canal.slice(1)}: ${nombreCampana}`;

const TODAS = '__todas__';

interface EditarCampanaDialogProps {
  campana: MarketingCampaign | null;
  piezas: MarketingPieza[];
  rubros: string[];
  categorias: string[];
  suscripciones: string[];
  onOpenChange: (open: boolean) => void;
  onGuardar: (id: string, updates: Partial<MarketingCampaign>) => Promise<unknown>;
  onCrearPieza: (pieza: Omit<MarketingPieza, 'id' | 'creado_en'>) => Promise<unknown>;
  onActualizarPieza: (input: { id: string } & Partial<MarketingPieza>) => Promise<unknown>;
  onEliminarPieza: (id: string) => Promise<unknown>;
  guardando: boolean;
  procesandoPiezas: boolean;
}

export function EditarCampanaDialog({
  campana, piezas, rubros, categorias, suscripciones, onOpenChange, onGuardar,
  onCrearPieza, onActualizarPieza, onEliminarPieza, guardando, procesandoPiezas,
}: EditarCampanaDialogProps) {
  const [nombre, setNombre] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [estado, setEstado] = useState<MarketingCampaign['estado']>('draft');
  const [audienciaFuente, setAudienciaFuente] = useState(TODAS);
  const [audienciaRubro, setAudienciaRubro] = useState(TODAS);
  const [audienciaCategoria, setAudienciaCategoria] = useState(TODAS);
  const [audienciaSuscripcion, setAudienciaSuscripcion] = useState(TODAS);
  const [canalesElegidos, setCanalesElegidos] = useState<Set<CanalTipo>>(new Set());

  useEffect(() => {
    if (campana) {
      setNombre(campana.nombre);
      setObjetivo(campana.objetivo);
      setEstado(campana.estado);
      setAudienciaFuente(campana.audiencia_fuente || TODAS);
      setAudienciaRubro(campana.audiencia_rubro || TODAS);
      setAudienciaCategoria(campana.audiencia_categoria || TODAS);
      setAudienciaSuscripcion(campana.audiencia_suscripcion || TODAS);
      setCanalesElegidos(new Set(piezas.map((p) => p.canal as CanalTipo).filter((c) => CANALES.some((x) => x.id === c))));
    }
    // Los canales solo se sincronizan al abrir (piezas cambia todo el tiempo
    // por invalidaciones de React Query; no queremos pisar lo que el usuario
    // recién marcó mientras el diálogo sigue abierto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campana]);

  const toggleCanal = (c: CanalTipo) => {
    setCanalesElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  };

  const guardar = async () => {
    if (!campana || !nombre.trim() || !objetivo.trim()) { toast.error('Nombre y objetivo son obligatorios'); return; }
    try {
      const nombreAnterior = campana.nombre;
      const nombreNuevo = nombre.trim();

      // 1. Datos de la campaña + a quién le llega.
      await onGuardar(campana.id, {
        nombre: nombreNuevo,
        objetivo: objetivo.trim(),
        estado,
        audiencia_fuente: audienciaFuente === TODAS ? null : audienciaFuente,
        audiencia_rubro: audienciaRubro === TODAS ? null : audienciaRubro,
        audiencia_categoria: audienciaCategoria === TODAS ? null : audienciaCategoria,
        audiencia_suscripcion: audienciaSuscripcion === TODAS ? null : audienciaSuscripcion,
      });

      // 2. Si cambió el nombre, las piezas con el nombre automático ("Canal:
      // nombre anterior") se renombran para no quedar desactualizadas. Una
      // pieza que el usuario ya renombró a mano no se toca.
      if (nombreNuevo !== nombreAnterior) {
        for (const p of piezas) {
          const canal = p.canal as CanalTipo;
          if (!CANALES.some((x) => x.id === canal)) continue;
          if (p.nombre === nombrePieza(canal, nombreAnterior)) {
            await onActualizarPieza({ id: p.id, nombre: nombrePieza(canal, nombreNuevo) });
          }
        }
      }

      // 3. Canales agregados/quitados desde este diálogo.
      const actuales = new Set(piezas.map((p) => p.canal as CanalTipo));
      for (const canal of canalesElegidos) {
        if (actuales.has(canal)) continue;
        const def = CANALES.find((c) => c.id === canal)!;
        await onCrearPieza({
          campana_id: campana.id,
          nombre: nombrePieza(canal, nombreNuevo),
          tipo: def.tipo,
          canal,
          estado: 'draft',
          contenido: '',
          asunto: canal === 'email' ? '' : undefined,
        });
      }
      for (const p of piezas) {
        const canal = p.canal as CanalTipo;
        if (CANALES.some((x) => x.id === canal) && !canalesElegidos.has(canal)) {
          await onEliminarPieza(p.id);
        }
      }

      toast.success('Campaña actualizada');
      onOpenChange(false);
    } catch (error) {
      toast.error(`No se pudo guardar: ${error instanceof Error ? error.message : 'error desconocido'}`);
    }
  };

  const procesando = guardando || procesandoPiezas;

  return (
    <Dialog open={!!campana} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar campaña</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editar-campana-nombre">Nombre</Label>
              <Input id="editar-campana-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editar-campana-objetivo">Objetivo</Label>
              <Textarea id="editar-campana-objetivo" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editar-campana-estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as MarketingCampaign['estado'])}>
                <SelectTrigger id="editar-campana-estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Canales</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Al agregar un canal se crea la pieza en borrador; edita su contenido después desde "Piezas".
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CANALES.map((c) => {
                const Icon = c.icon;
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox checked={canalesElegidos.has(c.id)} onCheckedChange={() => toggleCanal(c.id)} />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>A quién le llega (cluster de clientes)</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              No todas las campañas son para todos: define el segmento de esta campaña.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="editar-campana-fuente" className="text-xs font-normal text-muted-foreground">Fuente</Label>
                <Select value={audienciaFuente} onValueChange={setAudienciaFuente}>
                  <SelectTrigger id="editar-campana-fuente" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas las fuentes</SelectItem>
                    <SelectItem value="prospects">Prospects</SelectItem>
                    <SelectItem value="clientes">Clientes</SelectItem>
                    <SelectItem value="webinar">Webinar</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="editar-campana-rubro" className="text-xs font-normal text-muted-foreground">Rubro</Label>
                <Select value={audienciaRubro} onValueChange={setAudienciaRubro}>
                  <SelectTrigger id="editar-campana-rubro" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todos los rubros</SelectItem>
                    {rubros.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="editar-campana-categoria" className="text-xs font-normal text-muted-foreground">Categoría</Label>
                <Select value={audienciaCategoria} onValueChange={setAudienciaCategoria}>
                  <SelectTrigger id="editar-campana-categoria" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas las categorías</SelectItem>
                    {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="editar-campana-suscripcion" className="text-xs font-normal text-muted-foreground">Suscripción</Label>
                <Select value={audienciaSuscripcion} onValueChange={setAudienciaSuscripcion}>
                  <SelectTrigger id="editar-campana-suscripcion" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todos los estados</SelectItem>
                    {suscripciones.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={procesando}>
            {procesando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
