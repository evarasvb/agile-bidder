// @ts-nocheck
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Building2, Inbox, Landmark, Mail, MailCheck, UploadCloud, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Comprador {
  institucion: string;
  rut: string;
  region: string | null;
  sector: string | null;
  n_oc: number;
  monto_total: number;
  ultima_compra: string | null;
  contacto_email: string | null;
  contacto_nombre: string | null;
  contacto_estado: string | null;
  tiene_contacto: boolean;
  consentimiento: boolean;
}

const CLP = (v: number) => "$" + Math.round(v || 0).toLocaleString("es-CL");
function fmtFecha(iso: string | null) {
  if (!iso) return "s/i";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function FundadorCompradores() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Comprador | null>(null);
  const [form, setForm] = useState({ email: "", nombre: "", cargo: "", telefono: "", consentimiento: false });
  const [importOpen, setImportOpen] = useState(false);
  const [importTexto, setImportTexto] = useState("");

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["fundador-directorio-compradores"],
    queryFn: async (): Promise<Comprador[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_directorio_compradores", {
        p_buscar: null,
        p_limite: 500,
      });
      if (error) throw error;
      return (data ?? []) as Comprador[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: resumen } = useQuery({
    queryKey: ["fundador-compradores-resumen"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("fundador_compradores_resumen");
      if (error) throw error;
      return (data?.[0] ?? null) as { total_organismos: number; con_contacto: number; con_consentimiento: number } | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const guardar = useMutation({
    mutationFn: async () => {
      if (!editando) return;
      const { error } = await (supabase.rpc as any)("fundador_comprador_guardar_contacto", {
        p_rut: editando.rut,
        p_institucion: editando.institucion,
        p_email: form.email || null,
        p_nombre: form.nombre || null,
        p_cargo: form.cargo || null,
        p_telefono: form.telefono || null,
        p_consentimiento: form.consentimiento,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contacto guardado");
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["fundador-directorio-compradores"] });
      qc.invalidateQueries({ queryKey: ["fundador-compradores-resumen"] });
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo guardar"),
  });

  const importar = useMutation({
    mutationFn: async () => {
      const items = importTexto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [rut, email, nombre, cargo] = l.split(/[;,\t]/).map((x) => (x ?? "").trim());
          return { rut, email, nombre, cargo };
        })
        .filter((x) => x.rut);
      if (!items.length) throw new Error("No hay líneas válidas (usa: RUT, correo, nombre, cargo)");
      const { data, error } = await (supabase.rpc as any)("fundador_comprador_importar_contactos", { p_items: items });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} contactos importados`);
      setImportOpen(false);
      setImportTexto("");
      qc.invalidateQueries({ queryKey: ["fundador-directorio-compradores"] });
      qc.invalidateQueries({ queryKey: ["fundador-compradores-resumen"] });
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo importar"),
  });

  function abrirEdicion(f: Comprador) {
    setEditando(f);
    setForm({
      email: f.contacto_email || "",
      nombre: f.contacto_nombre || "",
      cargo: "",
      telefono: "",
      consentimiento: !!f.consentimiento,
    });
  }

  const montoTotal = filas.reduce((a, f) => a + (f.monto_total || 0), 0);

  const columnas = useMemo<DataTableColumn<Comprador>[]>(
    () => [
      {
        id: "institucion",
        header: "Institución",
        cell: (f) => (
          <>
            <p className="font-medium text-foreground">{f.institucion}</p>
            <p className="text-xs text-muted-foreground">{f.rut}</p>
          </>
        ),
        sortValue: (f) => f.institucion,
        exportValue: (f) => `${f.institucion} (${f.rut})`,
      },
      {
        id: "contacto",
        header: "Contacto",
        cell: (f) =>
          f.tiene_contacto && f.contacto_email ? (
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                <MailCheck className="h-3.5 w-3.5" /> {f.contacto_email}
              </span>
              {f.consentimiento && (
                <Badge variant="outline" className="ml-0.5 border-emerald-300 text-emerald-700 text-[10px]">
                  <ShieldCheck className="h-3 w-3 mr-0.5" /> consiente
                </Badge>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5 opacity-50" /> sin contacto
            </span>
          ),
        sortValue: (f) => (f.tiene_contacto ? 1 : 0),
        exportValue: (f) => f.contacto_email ?? "",
      },
      {
        id: "region",
        header: "Región",
        cell: (f) => <span className="text-sm">{f.region || "—"}</span>,
        sortValue: (f) => f.region,
        exportValue: (f) => f.region ?? "",
      },
      {
        id: "n_oc",
        header: "N° OC",
        align: "right",
        cell: (f) => <span className="whitespace-nowrap">{Number(f.n_oc).toLocaleString("es-CL")}</span>,
        sortValue: (f) => Number(f.n_oc),
        exportValue: (f) => String(f.n_oc),
      },
      {
        id: "monto",
        header: "Monto comprado",
        align: "right",
        cell: (f) => <span className="whitespace-nowrap font-medium">{CLP(f.monto_total)}</span>,
        sortValue: (f) => Number(f.monto_total),
        exportValue: (f) => String(Math.round(f.monto_total || 0)),
      },
      {
        id: "accion",
        header: "",
        cell: (f) => (
          <Button size="sm" variant="outline" onClick={() => abrirEdicion(f)}>
            {f.tiene_contacto ? "Editar" : "Agregar contacto"}
          </Button>
        ),
        exportValue: () => "",
      },
    ],
    [],
  );

  const cobertura = resumen
    ? Math.round((Number(resumen.con_contacto) / Math.max(Number(resumen.total_organismos), 1)) * 100)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
            <Landmark className="h-6 w-6 text-firmavb-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fundador — Compradores públicos</h1>
            <p className="text-sm text-muted-foreground">
              Directorio de quién compra en Mercado Público. Captura el correo institucional de cada organismo para tus campañas.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-2" /> Importar lista
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Organismos
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {(resumen?.total_organismos ?? filas.length).toLocaleString("es-CL")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MailCheck className="h-3.5 w-3.5" /> Con contacto
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {(resumen?.con_contacto ?? 0).toLocaleString("es-CL")}
              <span className="ml-1 text-xs font-normal text-muted-foreground">({cobertura}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Con consentimiento
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {(resumen?.con_consentimiento ?? 0).toLocaleString("es-CL")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Monto comprado (top 500)</div>
            <p className="mt-1 text-2xl font-bold text-foreground">{CLP(montoTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <DataTable<Comprador>
            storageKey="fundador-compradores"
            rows={filas}
            rowKey={(f) => f.rut}
            loading={isLoading}
            itemLabel="organismos"
            columns={columnas}
            searchText={(f) => `${f.institucion} ${f.rut} ${f.region ?? ""} ${f.contacto_email ?? ""}`}
            searchPlaceholder="Buscar por institución, RUT, región o correo…"
            defaultSort={{ id: "monto", dir: "desc" }}
            exportFileName="compradores-publicos"
            emptyMessage={
              <span className="inline-flex flex-col items-center">
                <Inbox className="h-10 w-10 mb-3 opacity-40" />
                <span>Sin datos de compradores todavía.</span>
              </span>
            }
          />
        </CardContent>
      </Card>

      {/* Dialog: agregar / editar contacto */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contacto del organismo</DialogTitle>
            <DialogDescription>{editando?.institucion}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="c-email">Correo institucional</Label>
              <Input id="c-email" type="email" placeholder="adquisiciones@organismo.cl"
                value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="c-nombre">Encargado (opcional)</Label>
                <Input id="c-nombre" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="c-cargo">Cargo (opcional)</Label>
                <Input id="c-cargo" value={form.cargo} onChange={(e) => setForm((s) => ({ ...s, cargo: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="c-tel">Teléfono (opcional)</Label>
              <Input id="c-tel" value={form.telefono} onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Autorizó recibir comunicaciones</p>
                <p className="text-xs text-muted-foreground">Márcalo solo si el organismo lo consintió (Ley 19.628).</p>
              </div>
              <Switch checked={form.consentimiento} onCheckedChange={(v) => setForm((s) => ({ ...s, consentimiento: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
              {guardar.isPending ? "Guardando…" : "Guardar contacto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: importar lista */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar contactos</DialogTitle>
            <DialogDescription>
              Pega una línea por organismo con: <strong>RUT, correo, nombre, cargo</strong> (separados por coma o punto y coma). El RUT debe existir en el directorio.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={8}
            placeholder={"61.608.700-2, adquisiciones@cenabast.cl, Juan Pérez, Jefe de Compras\n60.104.000-9, contacto@minsal.cl"}
            value={importTexto}
            onChange={(e) => setImportTexto(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={() => importar.mutate()} disabled={importar.isPending}>
              {importar.isPending ? "Importando…" : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
