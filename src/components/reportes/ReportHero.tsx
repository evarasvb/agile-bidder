import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HeroKpi {
  label: string;
  value: string;
  icon: LucideIcon;
}

/** Familia de acentos: cada reporte tiene su color de identidad, pero todos
 *  resuelven hacia el azul de marca -> se ven distintos y armónicos a la vez.
 *  Clases literales para que el JIT de Tailwind las conserve. */
export type ReportAccent =
  | "blue" | "violet" | "celeste" | "green" | "orange" | "red";

const ACCENTS: Record<ReportAccent, { grad: string; glow: string }> = {
  blue:    { grad: "from-firmavb-blue via-firmavb-blue to-indigo-900", glow: "bg-firmavb-celeste/40" },
  violet:  { grad: "from-violet-700 via-violet-700 to-indigo-900",     glow: "bg-violet-400/40" },
  celeste: { grad: "from-firmavb-celeste via-blue-600 to-firmavb-blue", glow: "bg-sky-300/40" },
  green:   { grad: "from-emerald-600 via-emerald-700 to-firmavb-blue", glow: "bg-emerald-300/40" },
  orange:  { grad: "from-amber-600 via-orange-700 to-firmavb-blue",    glow: "bg-amber-300/40" },
  red:     { grad: "from-rose-600 via-rose-700 to-firmavb-blue",       glow: "bg-rose-300/40" },
};

/** Header hero con identidad de marca + strip de KPIs, reutilizable por todos
 *  los reportes del Power BI para un look consistente, pro y dinámico. */
export function ReportHero({
  title, subtitle, icon: Icon, kpis, backTo = "/reportes", right, accent = "blue",
}: {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  kpis?: (HeroKpi | null)[];
  backTo?: string;
  right?: React.ReactNode;
  accent?: ReportAccent;
}) {
  const visibles = (kpis ?? []).filter(Boolean) as HeroKpi[];
  const a = ACCENTS[accent] ?? ACCENTS.blue;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.grad} text-white p-6 shadow-lg animate-slide-in`}>
      {/* Capa decorativa (glow + textura) — puramente estética */}
      <div className={`pointer-events-none absolute -top-24 -right-10 h-64 w-64 rounded-full ${a.glow} blur-3xl`} />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <Link to={backTo}>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/15 -ml-2"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            {Icon && <div className="p-2.5 rounded-xl bg-white/10 ring-1 ring-white/15 hidden sm:block"><Icon className="h-6 w-6" /></div>}
            <div>
              <h1 className="text-2xl font-bold leading-tight">{title}</h1>
              <p className="text-white/80 text-sm mt-0.5 max-w-2xl">{subtitle}</p>
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>

        {visibles.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {visibles.map((k, i) => {
              const loading = k.value === "…";
              return (
                <div
                  key={k.label}
                  className="rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur-sm px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.16] animate-count-up"
                  style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
                >
                  <k.icon className="h-5 w-5 text-white/80 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-white/70">{k.label}</p>
                    {/* key={value} -> re-anima el número cuando llega la data */}
                    <p
                      key={k.value}
                      className={`text-lg font-bold leading-tight truncate ${loading ? "animate-pulse-soft" : "animate-count-up"}`}
                    >
                      {k.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
