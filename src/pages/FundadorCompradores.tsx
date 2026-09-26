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
import { Building2, Inbox, Landmark, Mail, MailCheck, UploadCloud, ShieldCheck, Users, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Comprador {
  institucion: string;
  rut: string;
  region: string | null;
  tipo: string | null;
  n_oc: number;
  monto_total: number;
  ultima_compra: string | null;
  n_correos: number;
  n_encargados: number;
  encargados: string | null;
  tiene_contacto: boolean;
  consentimiento: boolean;
}

const TIPOS = ["Todos", "Municipalidad", "Salud", "Educación", "Gobierno", "Otros"];
const CLP = (v: number) => "$" + Math.round(v || 0).toLocaleString("es-CL");
function fmtFecha(iso: string | null) {
  if (!iso) return "s/i";
  try { return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return iso; }
}

export default function FundadorCompradores() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState("Todos");
  const [org, setOrg] = useState<Comprador | null>(null);
  const [form, setForm] = useState({ email: "", nombre: "", cargo: "", telefono: "", consentimiento: false });
  const [importOpen, setImportOpen] = useState(false);
  const [importTexto, setImportTexto] = useState("");

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["fundador-directorio-compradores", tipo],
    queryFn: async (): Promise<Comprador[]> => {
      const { data, error } = await (supabase.rpc as any)("fundador_directorio_compradores", { p_buscar: null, p_limite: 500, p_tipo: tipo });
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

  const { data: contactos = [] } = useQuery({
    queryKey: ["fundador-org-contactos", org?.rut],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("fundador_comprador_contactos", { p_rut: org!.rut });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const { data: encargados = [] } = useQuery({
    queryKey: ["fundador-org-encargados", org?.rut],
    enabled: !!org,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("fundador_comprador_encargados", { p_rut: org!.rut });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["fundador-directorio-compradores"] });
    qc.invalidateQueries({ queryKey: ["fundador-compradores-resumen"] });
    if (org) qc.invalidateQueries({ queryKey: ["fundador-org-contactos", org.rut] });
  };

  const guardar = useMutation({
    mutationFn: async () => {
      if (!org) return;
      const { error } = await (supabase.rpc as any)("fundador_comprador_guardar_contacto", {
        p_rut: org.rut, p_institucion: org.institucion,
        p_email: form.email || null, p_nombre: form.nombre || null,
        p_cargo: form.cargo || null, p_telefono: form.telefono || null,
        p_consentimiento: form.consentimiento,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Correo guardado"); setForm({ email: "", nombre: "", cargo: "", telefono: "", consentimiento: false }); refrescar(); },
    onError: (e: any) => toast.error(e?.message || "No se pudo guardar"),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("fundador_comprador_eliminar_contacto", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Contacto eliminado"); refrescar(); },
    onError: (e: any) => toast.error(e?.message || "No se pudo eliminar"),
  });

  const importar = useMutation({
    mutationFn: async () => {
      const items = importTexto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
        const [rut, email, nombre, cargo] = l.split(/[;,\t]/).map((x) => (x ?? "").trim());
        return { rut, email, nombre, cargo };
      }).filter((x) => x.rut && x.email);
      if (!items.length) throw new Error("No hay líneas válidas (usa: RUT, correo, nombre, cargo)");
      const { data, error } = await (supabase.rpc as any)("fundador_comprador_importar_contactos", { p_items: items });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => { toast.success(`${n} correos importados`); setImportOpen(false); setImportTexto(""); refrescar(); },
    onError: (e: any) => toast.error(e?.message || "No se pudo importar"),
  });

  const montoTotal = filas.reduce((a, f) => a + (f.monto_total || 0), 0);

  const columnas = useMemo<DataTableColumn<Comprador>[]>(
    () => [
      {
        id: "institucion",
        header: "Institución",
        className: "min-w-[220px] max-w-[320px]",
        cell: (f) => (
          <>
            <p className="font-medium text-foreground truncate">{f.institucion}</p>
            <p className="text-xs text-muted-foreground">{f.rut}{f.region ? ` · ${f.region}` : ""}</p>
          </>
        ),
        sortValue: (f) => f.institucion,
        exportValue: (f) => `${f.institucion} (${f.rut})`,
      },
      {
        id: "tipo",
        header: "Tipo",
        cell: (f) => (f.tipo ? <Badge variant="outline" className="whitespace-nowrap">{f.tipo}</Badge> : <span className="text-muted-foreground">—</span>),
        sortValue: (f) => f.tipo,
        exportValue: (f) => f.tipo ?? "",
      },
      {
        id: "correos",
        header: "Correos",
        align: "center",
        cell: (f) =>
          f.n_correos > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
              <MailCheck className="h-3.5 w-3.5" /> {f.n_correos}
              {f.consentimiento && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 opacity-50" /> 0</span>
          ),
        sortValue: (f) => f.n_correos,
        exportValue: (f) => String(f.n_correos),
      },
      {
        id: "encargados",
        header: "Encargados conocidos (MP)",
        className: "max-w-[260px]",
        cell: (f) =>
          f.n_encargados > 0 ? (
            <span className="flex items-center gap-1 text-xs text-foreground" title={f.encargados ?? ""}>
              <Users className="h-3.5 w-3.5 text-firmavb-blue shrink-0" />
              <span className="truncate">{f.encargados}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        sortValue: (f) => f.n_encargados,
        exportValue: (f) => f.encargados ?? "",
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
        id: "ultima",
        header: "Última compra",
        cell: (f) => <span className="whitespace-nowrap text-xs text-muted-foreground">{fmtFecha(f.ultima_compra)}</span>,
        sortValue: (f) => f.ultima_compra,
        exportValue: (f) => fmtFecha(f.ultima_compra),
      },
      {
        id: "accion",
        header: "",
        cell: (f) => (
          <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => { setOrg(f); setForm({ email: "", nombre: "", cargo: "", telefono: "", consentimiento: false }); }}>
            Gestionar
          </Button>
        ),
        exportValue: () => "",
      },
    ],
    [],
  );

  const cobertura = resumen ? Math.round((Number(resumen.con_contacto) / Math.max(Number(resumen.total_organismos), 1)) * 100) : 0;

  const selectorTipo = (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Tipo
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-10 rounded-md border bg-background px-2 text-sm text-foreground" aria-label="Filtrar por tipo de organismo">
        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <div className="w-full min-w-0 px-4 md:px-6 py-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-firmavb-blue/10 flex items-center justify-center">
            <Landmark className="h-6 w-6 text-firmavb-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fundador — Compradores públicos</h1>
            <p className="text-sm text-muted-foreground">
              Filtra por tipo (ej. Municipalidades), captura correos y exporta la lista. Desliza la tabla en horizontal para ver todo.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadCloud className="h-4 w-4 mr-2" /> Importar correos
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/50"><CardContent className="py-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> Organismos</div>
          <p className="mt-1 text-2xl font-bold text-foreground">{(resumen?.total_organismos ?? filas.length).toLocaleString("es-CL")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="py-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MailCheck className="h-3.5 w-3.5" /> Con correo</div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{(resumen?.con_contacto ?? 0).toLocaleString("es-CL")}<span className="ml-1 text-xs font-normal text-muted-foreground">({cobertura}%)</span></p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="py-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Con consentimiento</div>
          <p className="mt-1 text-2xl font-bold text-foreground">{(resumen?.con_consentimiento ?? 0).toLocaleString("es-CL")}</p>
        </CardContent></Card>
        <Card className="border-border/50"><CardContent className="py-4">
          <div className="text-xs text-muted-foreground">Monto en la vista</div>
          <p className="mt-1 text-2xl font-bold text-foreground">{CLP(montoTotal)}</p>
        </CardContent></Card>
      </div>

      {/* Tabla */}
      <Card className="border-border/50">
        <CardContent className="pt-6 min-w-0">
          <DataTable<Comprador>
            storageKey="fundador-compradores"
            rows={filas}
            rowKey={(f) => f.rut}
            loading={isLoading}
            itemLabel="organismos"
            columns={columnas}
            toolbar={selectorTipo}
            searchText={(f) => `${f.institucion} ${f.rut} ${f.region ?? ""} ${f.encargados ?? ""}`}
            searchPlaceholder="Buscar por institución, RUT, región o encargado…"
            defaultSort={{ id: "monto", dir: "desc" }}
            exportFileName={`compradores-${tipo.toLowerCase()}`}
            emptyMessage={<span className="inline-flex flex-col items-center"><Inbox className="h-10 w-10 mb-3 opacity-40" /><span>Sin organismos para este filtro.</span></span>}
          />
        </CardContent>
      </Card>

      {/* Dialog: gestionar organismo */}
      <Dialog open={!!org} onOpenChange={(o) => !o && setOrg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{org?.institucion}</DialogTitle>
            <DialogDescription>{org?.rut}{org?.region ? ` · ${org.region}` : ""}{org?.tipo ? ` · ${org.tipo}` : ""}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><MailCheck className="h-4 w-4 text-emerald-600" /> Correos para campaña ({contactos.length})</p>
              {contactos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aún no hay correos. Agrégalos abajo.</p>
              ) : (
                <ul className="space-y-1.5">
                  {contactos.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{c.email}</span>
                        {c.consentimiento && <Badge variant="outline" className="ml-2 border-emerald-300 text-emerald-700 text-[10px]">consiente</Badge>}
                        {(c.nombre || c.cargo) && <p className="text-xs text-muted-foreground truncate">{[c.nombre, c.cargo].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => eliminar.mutate(c.id)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {encargados.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Users className="h-4 w-4 text-firmavb-blue" /> Encargados conocidos (Mercado Público)</p>
                <ul className="space-y-1">
                  {encargados.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span><span className="text-foreground">{e.nombre}</span>{e.cargo ? ` · ${e.cargo}` : ""}{e.unidad ? ` · ${e.unidad}` : ""}</span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setForm((s) => ({ ...s, nombre: e.nombre, cargo: e.cargo || "" }))}>usar</Button>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground mt-1">Mercado Público publica el nombre y cargo, no el correo. Complétalo tú abajo.</p>
              </div>
            )}

            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Plus className="h-4 w-4" /> Agregar correo</p>
              <div>
                <Label htmlFor="c-email">Correo institucional</Label>
                <Input id="c-email" type="email" placeholder="adquisiciones@organismo.cl" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="c-nombre">Encargado (opcional)</Label><Input id="c-nombre" value={form.nombre} onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))} /></div>
                <div><Label htmlFor="c-cargo">Cargo (opcional)</Label><Input id="c-cargo" value={form.cargo} onChange={(e) => setForm((s) => ({ ...s, cargo: e.target.value }))} /></div>
              </div>
              <div><Label htmlFor="c-tel">Teléfono (opcional)</Label><Input id="c-tel" value={form.telefono} onChange={(e) => setForm((s) => ({ ...s, telefono: e.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Autorizó recibir comunicaciones</p>
                  <p className="text-xs text-muted-foreground">Márcalo solo si el organismo lo consintió (Ley 19.628).</p>
                </div>
                <Switch checked={form.consentimiento} onCheckedChange={(v) => setForm((s) => ({ ...s, consentimiento: v }))} />
              </div>
              <Button className="w-full" onClick={() => guardar.mutate()} disabled={guardar.isPending || !form.email}>
                {guardar.isPending ? "Guardando…" : "Agregar correo"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrg(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: importar */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar correos</DialogTitle>
            <DialogDescription>
              Una línea por contacto: <strong>RUT, correo, nombre, cargo</strong> (coma o punto y coma). El RUT debe existir en el directorio y el correo es obligatorio.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={8} placeholder={"61.608.700-2, adquisiciones@cenabast.cl, Juan Pérez, Jefe de Compras\n60.104.000-9, contacto@minsal.cl"} value={importTexto} onChange={(e) => setImportTexto(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={() => importar.mutate()} disabled={importar.isPending}>{importar.isPending ? "Importando…" : "Importar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
