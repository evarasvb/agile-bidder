// @ts-nocheck
import { useMemo, useState } from "react";
import { FileSearch, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { useLicitacionesMP } from "@/hooks/useLicitacionesMP";
import { formatCurrency } from "@/utils/clasificacion";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function LicitacionesMP() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error } = useLicitacionesMP(200);
  const [search, setSearch] = useState("");

  const filtradas = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (l) =>
        (l.nombre ?? "").toLowerCase().includes(q) ||
        (l.institucion_nombre ?? "").toLowerCase().includes(q) ||
        (l.codigo ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileSearch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Licitaciones</h1>
            <p className="text-sm text-muted-foreground">
              Licitaciones frescas de Mercado Público, actualizadas
              automáticamente.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["licitaciones-mp"] })
          }
          disabled={isFetching}
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            {isLoading
              ? "Cargando…"
              : `${filtradas.length} licitaciones`}
          </CardTitle>
          <Input
            placeholder="Buscar por nombre, institución o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-10 text-center text-sm text-destructive">
              No se pudieron cargar las licitaciones. Intenta actualizar en unos
              segundos.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando
              licitaciones…
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay licitaciones que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Institución</TableHead>
                    <TableHead>Región</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                    <TableHead>Ingresada</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((l) => (
                    <TableRow key={l.id ?? l.codigo}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {l.codigo}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="line-clamp-2">{l.nombre}</span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="line-clamp-2 text-muted-foreground">
                          {l.institucion_nombre ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.unidad_compra_region ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {l.presupuesto_estimado
                          ? formatCurrency(l.presupuesto_estimado)
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(l.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(l.fecha_cierre)}
                      </TableCell>
                      <TableCell>
                        {l.estado ? (
                          <Badge variant="secondary">{l.estado}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${l.codigo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary hover:underline"
                          title="Ver en Mercado Público"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
