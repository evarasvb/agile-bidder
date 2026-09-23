import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { StatusBar } from "./StatusBar";
import { EvaristoChat } from "@/components/soporte/EvaristoChat";
import { AvisosBell } from "@/components/notifications/AvisosBell";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* En escritorio deja espacio para el sidebar fijo; en móvil ocupa todo */}
      <div className="lg:pl-64">
        {/* Barra superior móvil: menú + logo + campana */}
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
          <div className="ml-auto">
            <AvisosBell className="text-sidebar-foreground hover:text-sidebar-foreground" />
          </div>
        </div>

        {/* Barra superior escritorio: campana a la derecha */}
        <div className="hidden lg:flex sticky top-0 z-30 items-center justify-end h-12 px-6 bg-background/95 backdrop-blur border-b">
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
  );
}
