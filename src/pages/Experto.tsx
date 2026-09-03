import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen } from "lucide-react";

/**
 * Experto FirmaVB: asesor con fuentes reales (Ley 19.886, Reglamento, directivas,
 * dictámenes CGR, sentencias TCP y datos vivos de Mercado Público).
 * La interfaz vive en /experto.html; aquí solo se enmarca dentro del layout y se
 * le pasa la sesión del usuario para aplicar el plan (gratis vs Pro).
 */
export default function Experto() {
  const { session } = useAuth();
  const location = useLocation();
  const src = useMemo(() => {
    const p = new URLSearchParams(location.search);
    if (session?.access_token) p.set("token", session.access_token);
    const qs = p.toString();
    return `/experto.html${qs ? "?" + qs : ""}`;
  }, [location.search, session?.access_token]);

  useEffect(() => { document.title = "Experto FirmaVB"; }, []);

  // El alto se calcula con el header real (cambia si aparece la franja de la extensión).
  const [alto, setAlto] = useState("calc(100dvh - 4rem)");
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const medir = () => setAlto(`calc(100dvh - ${header.getBoundingClientRect().height}px)`);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const { data: libros = [] } = useQuery({ queryKey: ["experto_mis_libros"], enabled: !!session, queryFn: async () => ((await (supabase as any).rpc("experto_mis_libros")).data ?? []) as any[] });
  const abrir = (c: string) => { const m = c.toUpperCase().match(/\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}/); if (m) navigate(`/experto/libro/${m[0]}`); };

  return (
    <div className="-m-4 sm:-m-6 flex flex-col" style={{ height: alto }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background flex-wrap">
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Libro de trabajo</span>
        <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); abrir(codigo); }}>
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ID de licitación, ej. 2699-35-LE26" className="h-8 w-64" />
          <Button size="sm" type="submit" className="h-8">Abrir</Button>
        </form>
        {libros.slice(0, 5).map((l: any) => (
          <button key={l.codigo} onClick={() => navigate(`/experto/libro/${l.codigo}`)} className="text-xs rounded-full border px-2 py-1 hover:border-primary truncate max-w-[220px]" title={l.nombre ?? ""}>{l.codigo}{l.nombre ? " · " + l.nombre : ""}</button>
        ))}
      </div>
      <iframe title="Experto FirmaVB" src={src} className="w-full flex-1 border-0" allow="clipboard-write" />
    </div>
  );
}
