import { Link } from "react-router-dom";
import {
  Users,
  Package,
  Building2,
  TrendingUp,
  Swords,
  FileCheck,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const reports = [
  {
    title: "Proveedores",
    description: "Análisis de proveedores adjudicados, ingresos y participación de mercado",
    icon: Users,
    href: "/reportes/proveedores",
    color: "text-firmavb-blue bg-firmavb-blue/10",
  },
  {
    title: "Productos",
    description: "Demanda de productos y servicios en compras públicas",
    icon: Package,
    href: "/reportes/productos",
    color: "text-firmavb-green bg-firmavb-green/10",
  },
  {
    title: "Compradores",
    description: "Instituciones compradoras, volúmenes y conducta de pago",
    icon: Building2,
    href: "/reportes/compradores",
    color: "text-firmavb-amber bg-firmavb-amber/10",
  },
  {
    title: "Mercado",
    description: "Vista general del mercado público: tendencias, regiones y volúmenes",
    icon: TrendingUp,
    href: "/reportes/mercado",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  },
  {
    title: "Competidores",
    description: "Inteligencia competitiva basada en adjudicaciones públicas",
    icon: Swords,
    href: "/reportes/competidores",
    color: "text-firmavb-red bg-firmavb-red/10",
  },
  {
    title: "Convenio Marco",
    description: "Análisis de órdenes de compra por convenio marco",
    icon: FileCheck,
    href: "/reportes/convenio-marco",
    color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30",
  },
];

export default function ReportesHub() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-br from-firmavb-blue to-firmavb-blue/80 text-white p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10"><BarChart3 className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Reportes</h1>
            <p className="text-white/80 text-sm mt-0.5">Inteligencia de mercado público: proveedores, productos, compradores y competidores</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} to={report.href}>
            <Card className="border-border/50 shadow-sm hover:shadow-md transition-all duration-200 h-full group cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg shrink-0 ${report.color}`}>
                    <report.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-heading font-semibold text-foreground mb-1 group-hover:text-firmavb-blue transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {report.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="group-hover:bg-firmavb-blue group-hover:text-white group-hover:border-firmavb-blue transition-colors"
                    tabIndex={-1}
                  >
                    Ver Reporte
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
