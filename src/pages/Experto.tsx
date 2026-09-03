import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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

  return (
    <div className="-m-4 sm:-m-6" style={{ height: alto }}>
      <iframe title="Experto FirmaVB" src={src} className="w-full h-full border-0" allow="clipboard-write" />
    </div>
  );
}
