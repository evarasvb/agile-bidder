import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { StatusBar } from "./StatusBar";
import { EvaristoChat } from "@/components/soporte/EvaristoChat";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:rounded-b-md">
        Saltar al contenido principal
      </a>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* En escritorio deja espacio para el sidebar fijo; en móvil ocupa todo */}
      <div className="lg:pl-64">
        {/* Barra superior solo en móvil: logo + botón de menú */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-sidebar border-b border-sidebar-border">
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
        </div>

        <StatusBar />
        <main id="main-content" className="p-4 sm:p-6">{children}</main>
      </div>

      {/* Asistente de soporte con IA, disponible en toda la app */}
      <EvaristoChat />
    </div>
  );
}
