// Monitoreo del Experto (admin): qué preguntan los clientes -con sesión, suscritos
// o en plan free- y los visitantes anónimos del landing (comodín), y qué les
// respondimos. Junta experto.consultas (comodín + Libro del Experto) y las
// conversaciones de Don Evaristo (el asistente general, requiere sesión).
import { useState } from 'react';
import { FirmaVBHeader } from '@/components/layout/FirmaVBHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { MessageSquare, User, UserX, Clock, BookOpen } from 'lucide-react';
import {
  useExpertoResumen, useExpertoConsultas, useEvaristoConversaciones, useEvaristoMensajes,
  type ExpertoConsulta, type EvaristoConversacion,
} from '@/hooks/useAdminExpertoActividad';

const MODO_LABEL: Record<string, string> = {
  chat: 'Chat', matriz: 'Matriz', estudio: 'Estudio profundo', mapa: 'Mapa conceptual',
  bajo_agua: 'Bajo el Agua', informe: 'Informe',
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Cliente({ empresa, email, huella }: { empresa: string | null; email: string | null; huella?: string | null }) {
  if (empresa || email) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 text-firmavb-blue shrink-0" />
        <span className="min-w-0">
          <p className="font-medium truncate max-w-[160px]">{empresa || email}</p>
          {empresa && email && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{email}</p>}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <UserX className="h-3.5 w-3.5 shrink-0" />
      <span className="text-xs">Anónimo{huella ? ` · ${huella.slice(0, 8)}` : ''}</span>
    </span>
  );
}

const DIAS_OPCIONES = [
  { v: '1', l: 'Hoy' }, { v: '7', l: '7 días' }, { v: '30', l: '30 días' }, { v: '90', l: '90 días' },
];

function TabExperto() {
  const [dias, setDias] = useState('7');
  const [buscar, setBuscar] = useState('');
  const { data: consultas, isLoading } = useExpertoConsultas(Number(dias), buscar);
  const [abierta, setAbierta] = useState<ExpertoConsulta | null>(null);

  const columnas: DataTableColumn<ExpertoConsulta>[] = [
    {
      id: 'fecha', header: 'Fecha',
      cell: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fecha(c.creado_en)}</span>,
      sortValue: (c) => c.creado_en, exportValue: (c) => fecha(c.creado_en),
    },
    {
      id: 'cliente', header: 'Cliente',
      cell: (c) => <Cliente empresa={c.empresa_nombre} email={c.email} huella={c.huella} />,
      sortValue: (c) => c.empresa_nombre || c.email || '',
      exportValue: (c) => c.empresa_nombre || c.email || `anónimo · ${c.huella ?? ''}`,
    },
    {
      id: 'modo', header: 'Tipo',
      cell: (c) => <Badge variant="outline">{MODO_LABEL[c.modo] ?? c.modo}</Badge>,
      sortValue: (c) => c.modo, exportValue: (c) => MODO_LABEL[c.modo] ?? c.modo,
    },
    {
      id: 'licitacion', header: 'Licitación',
      cell: (c) => c.licitacion ? <span className="text-xs font-mono">{c.licitacion}</span> : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (c) => c.licitacion || '',
    },
    {
      id: 'pregunta', header: 'Pregunta', className: 'max-w-md',
      cell: (c) => <p className="text-sm line-clamp-2">{c.pregunta || <span className="text-muted-foreground">(sin texto, ej. generó un entregable)</span>}</p>,
      sortValue: (c) => c.pregunta,
    },
    {
      id: 'ms', header: 'Tardó', align: 'right',
      cell: (c) => <span className="text-xs text-muted-foreground">{c.ms ? `${(c.ms / 1000).toFixed(1)}s` : 's/i'}</span>,
      sortValue: (c) => c.ms ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">Comodín del landing (anónimo) + Libro del Experto. Haz clic en una fila para ver la pregunta y la respuesta completas.</p>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DIAS_OPCIONES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <DataTable<ExpertoConsulta>
          storageKey="admin-experto-consultas"
          rows={consultas ?? []}
          rowKey={(c) => c.id}
          itemLabel="consultas"
          columns={columnas}
          searchText={(c) => `${c.pregunta} ${c.respuesta} ${c.empresa_nombre ?? ''} ${c.email ?? ''} ${c.licitacion ?? ''}`}
          onSearchChange={setBuscar}
          searchPlaceholder="Buscar por pregunta, respuesta, cliente o licitación…"
          defaultSort={{ id: 'fecha', dir: 'desc' }}
          exportFileName="experto-consultas"
          onRowClick={(c) => setAbierta(c)}
          emptyMessage={<span className="inline-flex flex-col items-center gap-2"><MessageSquare className="h-10 w-10 opacity-40" />Sin consultas en este período.</span>}
        />
      )}

      <Dialog open={!!abierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {abierta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
                  <Cliente empresa={abierta.empresa_nombre} email={abierta.email} huella={abierta.huella} />
                  <Badge variant="outline">{MODO_LABEL[abierta.modo] ?? abierta.modo}</Badge>
                  {abierta.licitacion && <span className="text-xs font-mono text-muted-foreground">{abierta.licitacion}</span>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fecha(abierta.creado_en)}{abierta.ms ? ` · tardó ${(abierta.ms / 1000).toFixed(1)}s` : ''}</p>
                {abierta.pregunta && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 whitespace-pre-wrap">{abierta.pregunta}</div>
                )}
                <div className="rounded-lg bg-muted/40 border px-3 py-2 whitespace-pre-wrap">{abierta.respuesta}</div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabEvaristo() {
  const [dias, setDias] = useState('7');
  const { data: conversaciones, isLoading } = useEvaristoConversaciones(Number(dias));
  const [abierta, setAbierta] = useState<EvaristoConversacion | null>(null);
  const { data: mensajes, isLoading: cargandoMensajes } = useEvaristoMensajes(abierta?.id ?? null);

  const columnas: DataTableColumn<EvaristoConversacion>[] = [
    {
      id: 'fecha', header: 'Última actividad',
      cell: (c) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fecha(c.actualizado_en)}</span>,
      sortValue: (c) => c.actualizado_en, exportValue: (c) => fecha(c.actualizado_en),
    },
    {
      id: 'cliente', header: 'Cliente',
      cell: (c) => <Cliente empresa={c.empresa_nombre} email={c.email} />,
      sortValue: (c) => c.empresa_nombre || c.email || '',
    },
    {
      id: 'canal', header: 'Canal',
      cell: (c) => <Badge variant="outline">{c.canal}</Badge>, sortValue: (c) => c.canal,
    },
    {
      id: 'ultima', header: 'Última pregunta', className: 'max-w-md',
      cell: (c) => <p className="text-sm line-clamp-2">{c.ultima_pregunta || <span className="text-muted-foreground">—</span>}</p>,
      sortValue: (c) => c.ultima_pregunta || '',
    },
    {
      id: 'mensajes', header: 'Mensajes', align: 'right',
      cell: (c) => <span className="text-xs text-muted-foreground">{c.mensajes}</span>, sortValue: (c) => c.mensajes,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">Asistente general "Don Evaristo" (memoria; solo usuarios con sesión). Haz clic en una fila para ver la conversación completa.</p>
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DIAS_OPCIONES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <DataTable<EvaristoConversacion>
          storageKey="admin-evaristo-conversaciones"
          rows={conversaciones ?? []}
          rowKey={(c) => c.id}
          itemLabel="conversaciones"
          columns={columnas}
          searchText={(c) => `${c.empresa_nombre ?? ''} ${c.email ?? ''} ${c.ultima_pregunta ?? ''} ${c.titulo ?? ''}`}
          searchPlaceholder="Buscar por cliente o pregunta…"
          defaultSort={{ id: 'fecha', dir: 'desc' }}
          exportFileName="evaristo-conversaciones"
          onRowClick={(c) => setAbierta(c)}
          emptyMessage={<span className="inline-flex flex-col items-center gap-2"><MessageSquare className="h-10 w-10 opacity-40" />Sin conversaciones en este período.</span>}
        />
      )}

      <Dialog open={!!abierta} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {abierta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
                  <Cliente empresa={abierta.empresa_nombre} email={abierta.email} />
                  <Badge variant="outline">{abierta.canal}</Badge>
                </DialogTitle>
              </DialogHeader>
              {cargandoMensajes ? <Skeleton className="h-40 w-full" /> : (
                <div className="space-y-2 text-sm">
                  {(mensajes ?? []).map((m) => (
                    <div key={m.id} className={`rounded-lg px-3 py-2 whitespace-pre-wrap ${m.rol === 'user' ? 'bg-blue-50 border border-blue-100' : 'bg-muted/40 border'}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{m.rol === 'user' ? 'Cliente' : 'Don Evaristo'}</p>
                      {m.contenido}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminExpertoActividad() {
  const { data: resumen, isLoading } = useExpertoResumen();

  return (
    <div className="space-y-6 p-6">
      <FirmaVBHeader
        title="Monitoreo del Experto"
        subtitle="Qué preguntan los clientes (con sesión o anónimos) y qué respondimos"
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { k: 'Total histórico', v: resumen?.consultas_total, icon: BookOpen },
          { k: 'Hoy', v: resumen?.consultas_hoy, icon: Clock },
          { k: 'Últimos 7 días', v: resumen?.consultas_7d, icon: MessageSquare },
          { k: 'Anónimas (7d)', v: resumen?.anonimas_7d, icon: UserX },
          { k: 'Mensajes Don Evaristo (7d)', v: resumen?.evaristo_mensajes_7d, icon: User },
        ].map(({ k, v, icon: Icon }) => (
          <Card key={k}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />{k}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-7 w-12" /> : <p className="text-2xl font-bold">{v ?? 0}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="experto">
        <TabsList>
          <TabsTrigger value="experto">Experto / Libro</TabsTrigger>
          <TabsTrigger value="evaristo">Don Evaristo (asistente)</TabsTrigger>
        </TabsList>
        <TabsContent value="experto"><TabExperto /></TabsContent>
        <TabsContent value="evaristo"><TabEvaristo /></TabsContent>
      </Tabs>
    </div>
  );
}
