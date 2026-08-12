import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Al cambiar de página, sube al inicio (o al ancla #id si viene en la URL).
// Sin esto, React Router mantiene la posición de scroll anterior y la página
// nueva aparece "desde el final".
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
