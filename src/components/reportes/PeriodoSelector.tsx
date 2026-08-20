import { Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PeriodoPreset } from "@/hooks/useBI";

const OPCIONES: { value: PeriodoPreset; label: string }[] = [
  { value: "total", label: "Histórico total" },
  { value: "mes", label: "Este mes" },
  { value: "trimestre", label: "Últimos 3 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "Este año" },
];

/** Selector de período para los reportes. "Histórico total" usa la vista
 *  materializada (instantáneo); los demás consultan por rango de fecha. */
export function PeriodoSelector({
  value,
  onChange,
}: {
  value: PeriodoPreset;
  onChange: (p: PeriodoPreset) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PeriodoPreset)}>
      <SelectTrigger className="h-9 w-[190px] bg-white/15 border-white/25 text-white [&>svg]:text-white/70">
        <Calendar className="h-4 w-4 mr-1.5 opacity-80" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPCIONES.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
