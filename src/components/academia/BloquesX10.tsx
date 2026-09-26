import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, HelpCircle, Video, Wrench, ClipboardList, Table2 } from "lucide-react";
import type { Bloque } from "@/data/academiaCursos";

// Bloques "x10" de la Academia: gráficos, tablas, video, quiz, herramienta y
// ejercicio. Los gráficos cargan recharts solo cuando aparece uno en pantalla,
// para no engordar la página de cursos.

type BloqueGrafico = Extract<Bloque, { tipo: "grafico" }>;
type BloqueTabla = Extract<Bloque, { tipo: "tabla" }>;
type BloqueVideo = Extract<Bloque, { tipo: "video" }>;
type BloqueQuiz = Extract<Bloque, { tipo: "quiz" }>;
type BloqueHerramienta = Extract<Bloque, { tipo: "herramienta" }>;
type BloqueEjercicio = Extract<Bloque, { tipo: "ejercicio" }>;

const GraficoRecharts = lazy(() => import("./GraficoRecharts"));

export function GraficoView({ bloque }: { bloque: BloqueGrafico }) {
  return (
    <figure className="my-5 rounded-xl border border-border/60 bg-card p-4">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-foreground">{bloque.titulo}</p>
        {bloque.unidad && <p className="text-xs text-muted-foreground">{bloque.unidad}</p>}
      </figcaption>
      <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-muted/40" aria-hidden="true" />}>
        <GraficoRecharts bloque={bloque} />
      </Suspense>
      {bloque.lectura && <p className="mt-3 text-sm text-foreground"><span className="font-semibold">Cómo leerlo: </span>{bloque.lectura}</p>}
      {bloque.fuente && <p className="mt-1 text-xs text-muted-foreground">Fuente: {bloque.fuente}</p>}
    </figure>
  );
}

export function TablaView({ bloque }: { bloque: BloqueTabla }) {
  return (
    <figure className="my-5 rounded-xl border border-border/60 bg-card p-4">
      {bloque.titulo && (
        <figcaption className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Table2 className="h-4 w-4 text-firmavb-blue" aria-hidden="true" />{bloque.titulo}
        </figcaption>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              {bloque.columnas.map((c, i) => <th key={i} className={`py-2 pr-3 ${i > 0 ? "text-right" : ""}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {bloque.filas.map((f, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0">
                {f.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "text-right font-mono text-xs" : "text-foreground"}`}>{typeof c === "number" ? c.toLocaleString("es-CL") : c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bloque.lectura && <p className="mt-3 text-sm text-foreground"><span className="font-semibold">Cómo leerlo: </span>{bloque.lectura}</p>}
      {bloque.fuente && <p className="mt-1 text-xs text-muted-foreground">Fuente: {bloque.fuente}</p>}
    </figure>
  );
}

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function VideoView({ bloque }: { bloque: BloqueVideo }) {
  const src = bloque.url ? embedUrl(bloque.url) : null;
  return (
    <div className="my-5 rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Video className="h-4 w-4 text-firmavb-blue" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Clase en video · {bloque.titulo}</span>
        {bloque.minutos ? <span className="text-xs text-muted-foreground">· {bloque.minutos} min</span> : null}
      </div>
      {src ? (
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <iframe src={src} title={bloque.titulo} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      ) : bloque.url ? (
        <a href={bloque.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-firmavb-blue hover:underline">Ver la clase (abre en nueva pestaña)</a>
      ) : (
        <p className="text-sm text-muted-foreground">Video en producción. Mientras tanto, el contenido completo de esta clase está en el texto de la lección.</p>
      )}
      {bloque.resumen && <p className="mt-2 text-sm text-muted-foreground">{bloque.resumen}</p>}
    </div>
  );
}

export function QuizView({ bloque }: { bloque: BloqueQuiz }) {
  const [elegida, setElegida] = useState<number | null>(null);
  const acierto = elegida !== null && elegida === bloque.correcta;
  return (
    <div className="my-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Ponte a prueba</span>
      </div>
      <p className="mb-3 text-sm font-semibold text-foreground">{bloque.pregunta}</p>
      <div className="space-y-2" role="radiogroup" aria-label={bloque.pregunta}>
        {bloque.opciones.map((op, i) => {
          const marcada = elegida === i;
          const esCorrecta = i === bloque.correcta;
          const estilo = elegida === null ? "border-border/60 hover:bg-muted/40" : esCorrecta ? "border-emerald-500/50 bg-emerald-500/10" : marcada ? "border-red-500/50 bg-red-500/10" : "border-border/40 opacity-70";
          return (
            <button key={i} type="button" role="radio" aria-checked={marcada} disabled={elegida !== null} onClick={() => setElegida(i)}
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm text-foreground transition ${estilo}`}>
              {elegida !== null && esCorrecta ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : elegida !== null && marcada ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" /> : <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden="true" />}
              <span>{op}</span>
            </button>
          );
        })}
      </div>
      {elegida !== null && (
        <p className="mt-3 text-sm text-foreground" role="status">
          <span className={`font-semibold ${acierto ? "text-emerald-700" : "text-red-700"}`}>{acierto ? "Correcto. " : "No exactamente. "}</span>
          {bloque.explicacion}
        </p>
      )}
    </div>
  );
}

export function HerramientaView({ bloque }: { bloque: BloqueHerramienta }) {
  const externa = /^https?:\/\//.test(bloque.ruta);
  const clase = "my-4 flex items-start gap-3 rounded-xl border border-firmavb-blue/30 bg-firmavb-blue/5 p-4 transition hover:bg-firmavb-blue/10";
  const contenido = (
    <>
      <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-firmavb-blue" aria-hidden="true" />
      <span>
        <span className="block text-sm font-semibold text-firmavb-blue">Hazlo en FirmaVB: {bloque.texto}</span>
        {bloque.detalle && <span className="block text-sm text-muted-foreground">{bloque.detalle}</span>}
      </span>
    </>
  );
  return externa
    ? <a href={bloque.ruta} target="_blank" rel="noopener noreferrer" className={clase}>{contenido}</a>
    : <Link to={bloque.ruta} className={clase}>{contenido}</Link>;
}

export function EjercicioView({ bloque }: { bloque: BloqueEjercicio }) {
  return (
    <div className="my-5 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-violet-600" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wide text-violet-700">Ejercicio · {bloque.titulo}</span>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground">
        {bloque.pasos.map((p, i) => <li key={i}>{p}</li>)}
      </ol>
      {bloque.entregable && <p className="mt-3 text-sm text-muted-foreground"><span className="font-semibold text-foreground">Entregable: </span>{bloque.entregable}</p>}
    </div>
  );
}
