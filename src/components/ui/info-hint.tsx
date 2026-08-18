import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Icono de información con tooltip. Se usa junto a métricas/sugerencias para
 * explicar en lenguaje simple CÓMO se calculó ese número (transparencia).
 */
export function InfoHint({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Cómo se calcula"
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors align-middle",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
