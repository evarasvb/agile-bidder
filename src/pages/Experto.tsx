import { useEffect, useMemo } from "react";
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

  return (
    <div className="h-[calc(100vh-4rem)] -m-4 md:-m-6">
      <iframe title="Experto FirmaVB" src={src} className="w-full h-full border-0" allow="clipboard-write" />
    </div>
  );
}
