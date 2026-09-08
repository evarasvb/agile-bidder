import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useOpcionesOC } from "@/hooks/useOrdenesCompra";
import { cn } from "@/lib/utils";

/**
 * Desplegable con buscador y multi-selección para el reporte de OC. Las opciones
 * salen de la misma tabla (nombres reales que sí tienen órdenes), así lo que
 * eliges siempre trae resultados. Muestra lo elegido como chips removibles.
 */
export function MultiSelectOC({
  campo, label, placeholder, values, onChange,
}: {
  campo: "proveedor_nombre" | "organismo_comprador";
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: opciones = [], isLoading } = useOpcionesOC(campo, q);

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open}
            className="w-full justify-between font-normal">
            <span className="truncate text-muted-foreground">
              {values.length === 0 ? placeholder : `${values.length} seleccionado${values.length === 1 ? "" : "s"}`}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Escribe para buscar…" value={q} onValueChange={setQ} />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                </div>
              ) : (
                <>
                  <CommandEmpty>{q.length < 2 ? "Escribe al menos 2 letras" : "Sin coincidencias"}</CommandEmpty>
                  <CommandGroup>
                    {opciones.map((op) => (
                      <CommandItem key={op} value={op} onSelect={() => toggle(op)} className="cursor-pointer">
                        <Check className={cn("mr-2 h-4 w-4", values.includes(op) ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{op}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="gap-1 max-w-full">
              <span className="truncate">{v}</span>
              <button type="button" onClick={() => toggle(v)} aria-label={`Quitar ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
