import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Bloque } from "@/data/academiaCursos";

type BloqueGrafico = Extract<Bloque, { tipo: "grafico" }>;

const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString("es-CL", { maximumFractionDigits: 0 }) : v.toLocaleString("es-CL", { maximumFractionDigits: 1 }));

// Se carga con lazy() desde BloquesX10 para que recharts no entre al bundle de
// la Academia si la lección no tiene gráficos.
export default function GraficoRecharts({ bloque }: { bloque: BloqueGrafico }) {
  const datos = bloque.datos.map((d) => ({ etiqueta: d.etiqueta, [bloque.serie || "valor"]: d.valor, ...(d.valor2 != null ? { [bloque.serie2 || "valor2"]: d.valor2 } : {}) }));
  const s1 = bloque.serie || "valor";
  const s2 = bloque.serie2 || "valor2";
  const dos = bloque.datos.some((d) => d.valor2 != null);
  const ejes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} interval={0} angle={bloque.datos.length > 8 ? -35 : 0} textAnchor={bloque.datos.length > 8 ? "end" : "middle"} height={bloque.datos.length > 8 ? 60 : 30} />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={56} />
      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12 }} />
      {dos && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {bloque.subtipo === "lineas" ? (
          <LineChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            {ejes}
            <Line type="monotone" dataKey={s1} stroke="hsl(var(--firmavb-blue, 215 85% 45%))" strokeWidth={2} dot={{ r: 3 }} />
            {dos && <Line type="monotone" dataKey={s2} stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        ) : (
          <BarChart data={datos} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            {ejes}
            <Bar dataKey={s1} fill="hsl(var(--firmavb-blue, 215 85% 45%))" radius={[4, 4, 0, 0]} />
            {dos && <Bar dataKey={s2} fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
