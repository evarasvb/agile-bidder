import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HeroKpi {
  label: string;
  value: string;
  icon: LucideIcon;
}

/** Header hero con identidad de marca + strip de KPIs, reutilizable por todos
 *  los reportes del Power BI para un look consistente. */
export function ReportHero({
  title, subtitle, icon: Icon, kpis, backTo = "/reportes", right,
}: {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  kpis?: (HeroKpi | null)[];
  backTo?: string;
  right?: React.ReactNode;
}) {
  const visibles = (kpis ?? []).filter(Boolean) as HeroKpi[];
  return (
    <div className="rounded-2xl bg-gradient-to-br from-firmavb-blue to-firmavb-blue/80 text-white p-6 shadow-lg">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Link to={backTo}>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 -ml-2"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          {Icon && <div className="p-2.5 rounded-xl bg-white/10 hidden sm:block"><Icon className="h-6 w-6" /></div>}
          <div>
            <h1 className="text-2xl font-bold leading-tight">{title}</h1>
            <p className="text-white/80 text-sm mt-0.5 max-w-2xl">{subtitle}</p>
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {visibles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {visibles.map((k) => (
            <div key={k.label} className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
              <k.icon className="h-5 w-5 text-white/80 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-white/70">{k.label}</p>
                <p className="text-lg font-bold leading-tight truncate">{k.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
