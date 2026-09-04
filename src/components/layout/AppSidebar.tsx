import {
  LayoutDashboard,
  Kanban,
  Package,
  BarChart3,
  Settings,
  Store,
  User,
  LogOut,
  Building2,
  FileText,
  Calendar,
  Users,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Crosshair,
  TrendingUp,
  Swords,
  FileCheck,
  FileSearch,
  Puzzle,
  GraduationCap,
  Sparkles,
  Shield,
  LifeBuoy,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";
import { useState, useEffect } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  children?: { title: string; url: string; icon?: React.ElementType }[];
}

// Navigation items - organized per requirements
const navItems: NavItem[] = [
  {
    title: "Inicio",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Oportunidades",
    url: "/oportunidades",
    icon: Crosshair,
    children: [
      // Una sola bandeja: licitaciones y compras ágiles juntas, se filtran con
      // un toque. Las vistas "Compras Ágiles" y "Guardadas" redirigen aquí.
      { title: "Bandeja", url: "/oportunidades", icon: Crosshair },
      { title: "Calendario", url: "/calendario", icon: Calendar },
      { title: "Filtros con IA", url: "/configuracion", icon: Sparkles },
    ],
  },
  {
    title: "Experto",
    url: "/experto",
    icon: GraduationCap,
  },
  {
    title: "Postulaciones",
    url: "/pipeline",
    icon: Kanban,
  },
  {
    title: "Inventario",
    url: "/inventario",
    icon: Package,
  },
  {
    adminOnly: true,
    title: "Asesorías",
    url: "/academia/leads",
    icon: GraduationCap,
  },
  {
    title: "Reportes",
    url: "/reportes",
    icon: BarChart3,
  },
  {
    title: "Órdenes de Compra",
    url: "/mercado/ordenes",
    icon: FileText,
  },
  {
    title: "Equipo",
    url: "/equipo",
    icon: Users,
    children: [
      { title: "Miembros", url: "/equipo", icon: Users },
      { title: "Desempeño", url: "/dashboard/vendedores", icon: BarChart3 },
      { title: "Roles y permisos", url: "/configuracion/equipo", icon: Shield },
    ],
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
    children: [
      { title: "Mi empresa", url: "/configuracion/empresa", icon: Building2 },
      { title: "Extensión Chrome", url: "/configuracion/extension", icon: Puzzle },
    ],
  },
  {
    title: "Soporte",
    url: "/soporte",
    icon: LifeBuoy,
  },
];

interface AppSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ open = false, onClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const esAdmin = (user?.email || "").toLowerCase() === "evaras@firmavb.cl";

  // Destino activo = la URL de nav MÁS ESPECÍFICA que calza con la ruta actual
  // (por igualdad o como prefijo de sub-ruta). Usar el match más largo evita que
  // /dashboard/vendedores active "Inicio" (/dashboard) o /configuracion/equipo
  // active "Configuración": gana el hijo exacto, no el prefijo del padre.
  const matchLen = (url: string) =>
    location.pathname === url
      ? url.length
      : url !== "/" && location.pathname.startsWith(url + "/")
      ? url.length
      : -1;
  const allDests = navItems.flatMap((it) => (it.children?.length ? it.children.map((c) => c.url) : [it.url]));
  const bestUrl = allDests.reduce((best, url) => (matchLen(url) > matchLen(best) ? url : best), "");
  const bestLen = matchLen(bestUrl);
  const activeGroup =
    bestLen < 0
      ? undefined
      : navItems.find((it) => (it.children?.length ? it.children : [it]).some((c) => c.url === bestUrl))?.title;

  const [expandedItems, setExpandedItems] = useState<string[]>(
    activeGroup ? [activeGroup] : []
  );

  // Mantener abierto el grupo activo al navegar (sin cerrar los que el usuario abrió).
  useEffect(() => {
    if (activeGroup) {
      setExpandedItems((prev) =>
        prev.includes(activeGroup) ? prev : [...prev, activeGroup]
      );
    }
  }, [activeGroup]);

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      toast.error('Error al cerrar sesion');
    }
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

  const isActive = (url: string) => {
    if (url === "/oportunidades") {
      return location.pathname === "/oportunidades" ||
             location.pathname.startsWith("/oportunidades/") ||
             location.pathname.startsWith("/licitaciones/") ||
             location.pathname.startsWith("/compras-agiles/");
    }
    return location.pathname === url ||
           (url !== '/' && location.pathname.startsWith(url + '/'));
  };

  return (
    <>
      {/* Fondo oscuro al abrir el menú en móvil */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* Logo Header */}
      <div className="flex h-16 items-center justify-center px-5 border-b border-sidebar-border bg-sidebar">
        <img 
          src={logoFirmavbBlanco} 
          alt="FirmaVB" 
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* User Profile */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-sidebar-accent">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email || 'Usuario'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <ul className="space-y-1">
          {navItems.filter((item) => !item.adminOnly || esAdmin).map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.title);
            const isItemActive = hasChildren
              ? activeGroup === item.title
              : item.url === bestUrl && bestLen >= 0;
            
            return (
              <li key={item.title}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.title)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                        isItemActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5 transition-colors",
                        isItemActive ? "text-sidebar-primary-foreground" : "text-sidebar-muted"
                      )} />
                      <span className="flex-1 text-left">{item.title}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {isExpanded && (
                      <ul className="mt-1 ml-4 space-y-1">
                        {item.children?.map((child) => {
                          const ChildIcon = child.icon;
                          const isChildActive = child.url === bestUrl && bestLen >= 0;
                          return (
                            <li key={child.url}>
                              <NavLink
                                to={child.url}
                                onClick={() => onClose?.()}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                  isChildActive
                                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                                )}
                              >
                                {ChildIcon && <ChildIcon className="h-4 w-4" />}
                                {child.title}
                              </NavLink>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.url}
                    onClick={() => onClose?.()}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      isItemActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-5 w-5 transition-colors",
                      isItemActive ? "text-sidebar-primary-foreground" : "text-sidebar-muted"
                    )} />
                    {item.title}
                  </NavLink>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {/* Mi cuenta era huérfana: no existía ninguna entrada del menú hacia
            /cuenta (plan, facturación). */}
        <NavLink
          to="/cuenta"
          onClick={() => onClose?.()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <User className="h-5 w-5" />
          Mi cuenta
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
      </aside>
    </>
  );
}
