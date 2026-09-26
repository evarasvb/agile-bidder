import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { StatusBar } from "./StatusBar";
import { EvaristoChat } from "@/components/soporte/EvaristoChat";
import { AvisosBell } from "@/components/notifications/AvisosBell";
import { BusquedaGlobalProvider, BusquedaGlobalTrigger } from "@/components/busqueda/BusquedaGlobal";
import { cn } from "@/lib/utils";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";

interface AppLayoutProps {
  children: ReactNode;
}

const SIDEBAR_COLLAPSED_KEY = "firmavb-sidebar-collapsed";

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Preferencia de menú achicado (solo escritorio), guardada en el navegador.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // localStorage puede fallar (modo privado, cuota); no es crítico.
      }
      return next;
    });
  };

  return (
    <BusquedaGlobalProvider>
      <div className="min-h-screen bg-background">
        <AppSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />

        {/* En escritorio deja espacio para el sidebar fijo; en móvil ocupa todo */}
        <div className={cn("transition-[padding] duration-200", sidebarCollapsed ? "lg:pl-[4.5rem]" : "lg:pl-64")}>
          {/* Barra superior móvil: menú + logo + buscador + campana */}
          <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-sidebar border-b border-sidebar-border text-sidebar-foreground">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-sidebar-foreground rounded-md hover:bg-sidebar-accent"
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>
            <img
              src={logoFirmavbBlanco}
              alt="FirmaVB"
              className="h-7 w-auto object-contain"
            />
            <div className="ml-auto flex items-center gap-1">
              <BusquedaGlobalTrigger variant="icono" className="text-sidebar-foreground hover:text-sidebar-foreground" />
              <AvisosBell className="text-sidebar-foreground hover:text-sidebar-foreground" />
            </div>
          </div>

          {/* Barra superior escritorio: buscador a la izquierda, campana a la derecha */}
          <div className="hidden lg:flex sticky top-0 z-30 items-center justify-between h-12 px-6 bg-background/95 backdrop-blur border-b">
            <BusquedaGlobalTrigger variant="barra" />
            <AvisosBell />
          </div>

          <StatusBar />
          {/* pb generoso: deja aire para que la burbuja flotante de Evaristo
              (abajo a la derecha) nunca tape la última fila de contenido */}
          <main id="main-content" className="p-4 sm:p-6 pb-24 sm:pb-28">{children}</main>
        </div>

        {/* Asistente de soporte con IA, disponible en toda la app */}
        <EvaristoChat />
      </div>
    </BusquedaGlobalProvider>
  );
}
