import { Link } from "react-router-dom";
import { Search, BookOpen, Send, Banknote, Sparkles, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANES } from "@/data/planes";

// Landing: el camino completo de vender al Estado (encontrar, estudiar, postular,
// cobrar) y qué cubre cada plan en cada etapa, con el precio al lado. Hablamos
// solo de lo nuestro. La IA viene incluida: sin claves ni cuentas aparte.

const ETAPAS = [
  { icono: Search, titulo: "Encontrar", texto: "Oportunidades de tu rubro cada día, sigue a tus instituciones y recibe en tu panel lo que pasa con ellas: prensa, reclamos, compras y adjudicaciones." },
  { icono: BookOpen, titulo: "Estudiar", texto: "El Libro de cada licitación: informe, matriz de adjudicación, historial del organismo, quién gana y riesgo de pago. Mirar donde otros no miran." },
  { icono: Send, titulo: "Postular", texto: "Sala de postulación, preguntas al foro, anexos completados con los datos y documentos de tu empresa, y la extensión para cotizar." },
  { icono: Banknote, titulo: "Cobrar", texto: "Facturas con su plazo legal, nota de cobro, cálculo de intereses y el Abogado para escalar. Si no hay pago, no hay negocio." },
] as const;

type Celda = { ok: boolean; texto: string };
// Filas de la tabla: qué entrega cada plan en cada etapa (ids de PLANES: free, pro_30, plus_30, erp).
const FILAS: { etapa: string; celdas: Record<string, Celda> }[] = [
  { etapa: "Encontrar", celdas: {
    free: { ok: true, texto: "Oportunidades de tu rubro, instituciones seguidas y avisos" },
    pro_30: { ok: true, texto: "Todo lo de Gratis" },
    plus_30: { ok: true, texto: "Todo lo de Gratis" },
    erp: { ok: true, texto: "Todo lo de Gratis, más la extensión en Mercado Público" },
  } },
  { etapa: "Estudiar", celdas: {
    free: { ok: true, texto: "3 preguntas y 1 informe al mes; 1 Bajo el Agua para probar" },
    pro_30: { ok: true, texto: "Sin límite: matriz, historial del organismo, quién gana, riesgo de pago; 10 Bajo el Agua al mes" },
    plus_30: { ok: true, texto: "Todo lo de Pro; 30 Bajo el Agua al mes" },
    erp: { ok: true, texto: "Todo lo de Plus; Bajo el Agua sin límite" },
  } },
  { etapa: "Postular", celdas: {
    free: { ok: false, texto: "Postulas por tu cuenta con lo que estudiaste" },
    pro_30: { ok: true, texto: "Sala de postulación y matriz con Excel de fórmulas" },
    plus_30: { ok: true, texto: "Anexos completados con los datos y documentos de tu empresa" },
    erp: { ok: true, texto: "Postular y autocompletar cotizaciones con la extensión" },
  } },
  { etapa: "Cobrar", celdas: {
    free: { ok: true, texto: "Registro de facturas con su plazo legal" },
    pro_30: { ok: true, texto: "Nota de cobro, intereses y Abogado sin límite" },
    plus_30: { ok: true, texto: "Todo lo de Pro" },
    erp: { ok: true, texto: "Todo lo de Plus, más órdenes de compra y reportes" },
  } },
  { etapa: "IA incluida", celdas: {
    free: { ok: true, texto: "Sin configurar nada" },
    pro_30: { ok: true, texto: "Sin configurar nada" },
    plus_30: { ok: true, texto: "Sin configurar nada" },
    erp: { ok: true, texto: "Sin configurar nada" },
  } },
];

const PRECIO_CORTO: Record<string, string> = { free: "$0", pro_30: "$50.000 por 30 días", plus_30: "$100.000 por 30 días", erp: "$149.990 + IVA al mes" };

export function CaminoCompleto({ conTitulo = true, conCta = true }: { conTitulo?: boolean; conCta?: boolean }) {
  return (
    <section className="py-20 px-6 bg-muted/30" aria-labelledby="camino-completo">
      <div className="max-w-6xl mx-auto">
        {conTitulo && (
          <div className="text-center mb-12">
            <h2 id="camino-completo" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Encontrar es solo el primer paso
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Vender al Estado tiene cuatro etapas. FirmaVB te acompaña en las cuatro, y el precio de cada plan dice exactamente hasta dónde llega.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-12">
          {ETAPAS.map((e, i) => {
            const Icono = e.icono;
            return (
              <div key={e.titulo} className="rounded-2xl border border-border/60 bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-firmavb-blue/10 text-firmavb-blue">
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-foreground"><span className="text-muted-foreground mr-1">{i + 1}.</span>{e.titulo}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{e.texto}</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Qué incluye cada plan en cada etapa</caption>
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th scope="col" className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Etapa</th>
                {PLANES.map((p) => (
                  <th key={p.id} scope="col" className="p-3 text-left align-top">
                    <p className="font-semibold text-foreground">{p.nombre}</p>
                    <p className="text-xs font-normal text-muted-foreground">{PRECIO_CORTO[p.id]}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FILAS.map((f) => (
                <tr key={f.etapa} className="border-b border-border/40 last:border-0 align-top">
                  <th scope="row" className="p-3 text-left font-semibold text-foreground whitespace-nowrap">
                    {f.etapa === "IA incluida" ? <span className="inline-flex items-center gap-1"><Sparkles className="h-4 w-4 text-firmavb-blue" aria-hidden="true" />IA incluida</span> : f.etapa}
                  </th>
                  {PLANES.map((p) => {
                    const c = f.celdas[p.id];
                    return (
                      <td key={p.id} className="p-3">
                        <div className="flex items-start gap-2">
                          {c.ok
                            ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" aria-label="Incluido" />
                            : <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="No incluido" />}
                          <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.texto}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          La inteligencia artificial viene incluida en todos los planes: sin claves, sin cuentas en otros servicios, sin configurar nada. Experto Pro y Plus son pagos únicos por 30 días; el ERP se cancela cuando quieras.
        </p>

        {conCta && (
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" asChild className="bg-firmavb-blue hover:bg-firmavb-blue/90">
              <Link to="/auth?tab=signup">Crear cuenta gratis</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/planes">Ver planes en detalle</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default CaminoCompleto;
