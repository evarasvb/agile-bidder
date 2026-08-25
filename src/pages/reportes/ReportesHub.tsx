import { Link } from "react-router-dom";
import {
  Users,
  Package,
  Building2,
  TrendingUp,
  Swords,
  FileCheck,
  BarChart3,
  DollarSign,
  FileText,
  Landmark,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useBIStats } from "@/hooks/useBI";
import { formatCompact, formatNumber } from "@/hooks/useReportes";

type Accent = "blue" | "green" | "orange" | "violet" | "red" | "celeste";

const ACCENT: Record<Accent, { icon: string; ring: string; bar: string; text: string }> = {
  blue:    { icon: "text-firmavb-blue bg-firmavb-blue/10", ring: "hover:ring-firmavb-blue/30", bar: "from-firmavb-blue to-firmavb-celeste", text: "group-hover:text-firmavb-blue" },
  green:   { icon: "text-emerald-600 bg-emerald-500/10",   ring: "hover:ring-emerald-500/30", bar: "from-emerald-500 to-emerald-300",       text: "group-hover:text-emerald-600" },
  orange:  { icon: "text-amber-600 bg-amber-500/10",       ring: "hover:ring-amber-500/30",   bar: "from-amber-500 to-amber-300",           text: "group-hover:text-amber-600" },
  violet:  { icon: "text-violet-600 bg-violet-500/10",     ring: "hover:ring-violet-500/30",  bar: "from-violet-600 to-violet-400",         text: "group-hover:text-violet-600" },
  red:     { icon: "text-rose-600 bg-rose-500/10",         ring: "hover:ring-rose-500/30",    bar: "from-rose-600 to-rose-400",             text: "group-hover:text-rose-600" },
  celeste: { icon: "text-sky-600 bg-sky-500/10",           ring: "hover:ring-sky-500/30",     bar: "from-sky-500 to-sky-300",               text: "group-hover:text-sky-600" },
};

const reports: {
  title: string;
  description: string;
  icon: typeof Users;
  href: string;
  accent: Accent;
}[] = [
  // Cada reporte se presenta como la PREGUNTA que responde (un dueño de PYME
  // busca decisiones, no "rankings"). El más accionable va primero: Convenio
  // Marco trae "Mi competitividad" (Ganas / Competitivo / Caro por producto).
  { title: "¿Estoy caro o barato?", description: "Compara tus precios contra el mercado, producto por producto: Ganas · Competitivo · Caro", icon: FileCheck, href: "/reportes/convenio-marco", accent: "celeste" },
  { title: "¿Quién me está ganando?", description: "Tus competidores: quiénes se adjudican las compras de tu rubro y qué tan concentrado está", icon: Swords, href: "/reportes/competidores", accent: "red" },
  { title: "¿Quién compra lo que vendo?", description: "Las instituciones que más compran tu tipo de producto, para enfocar tus postulaciones", icon: Building2, href: "/reportes/compradores", accent: "orange" },
  { title: "¿Qué pide el Estado?", description: "Los productos más demandados, su precio de referencia y quién los vende", icon: Package, href: "/reportes/productos", accent: "green" },
  { title: "¿Quién le vende al Estado?", description: "Ranking de proveedores por monto adjudicado y participación de mercado", icon: Users, href: "/reportes/proveedores", accent: "blue" },
  { title: "¿Cómo se mueve el mercado?", description: "Tendencias, regiones, volúmenes y tipos de compra pública", icon: TrendingUp, href: "/reportes/mercado", accent: "violet" },
];

export default function ReportesHub() {
  const { data: stats } = useBIStats();

  const kpis = [
    { label: "Transado", value: stats ? formatCompact(stats.monto_total) : "…", icon: DollarSign },
    { label: "Órdenes", value: stats ? formatNumber(stats.ordenes) : "…", icon: FileText },
    { label: "Proveedores", value: stats ? formatNumber(stats.proveedores) : "…", icon: Users },
    { label: "Compradores", value: stats ? formatNumber(stats.compradores) : "…", icon: Landmark },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero de marca con KPIs globales en vivo */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-firmavb-blue via-firmavb-blue to-indigo-900 text-white p-6 shadow-lg animate-slide-in">
        <div className="pointer-events-none absolute -top-24 -right-10 h-64 w-64 rounded-full bg-firmavb-celeste/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 ring-1 ring-white/15"><BarChart3 className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">Reportes</h1>
              <p className="text-white/80 text-sm mt-0.5">Inteligencia de mercado público: proveedores, productos, compradores y competidores</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {kpis.map((k, i) => {
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
                    <p key={k.value} className={`text-lg font-bold leading-tight truncate ${loading ? "animate-pulse-soft" : "animate-count-up"}`}>{k.value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report, i) => {
          const a = ACCENT[report.accent];
          return (
            <Link key={report.href} to={report.href} className="animate-count-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}>
              <Card className={`relative overflow-hidden border-border/50 shadow-sm ring-1 ring-transparent transition-all duration-200 h-full group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${a.ring}`}>
                {/* Barra de acento superior */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${a.bar} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg shrink-0 transition-transform group-hover:scale-110 ${a.icon}`}>
                      <report.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-base font-heading font-semibold text-foreground mb-1 transition-colors ${a.text}`}>
                        {report.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1.5 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Ver reporte
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
