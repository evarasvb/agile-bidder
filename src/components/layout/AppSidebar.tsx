import {
  Star,
  Store,
  LayoutDashboard,
  Settings,
  User,
  LogOut,
  Building2,
  FileText,
  Calendar,
  Users,
  CreditCard,
    Package,
  ChevronDown,
  ChevronRight,
  Crosshair,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";
import { useState } from "react";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  children?: { title: string; url: string; icon?: React.ElementType }[];
}

// Navigation items - 5 main sections with submenus
const navItems: NavItem[] = [
  {
    title: "Mis Oportunidades",
    url: "/mis-oportunidades",
    icon: Star
  },
  {
    title: "Oportunidades",
    url: "/oportunidades",
    icon: Crosshair
  },
  {
    title: "Mercado", 
    url: "/mercado", 
    icon: Store,
    children: [
      { title: "Explorador", url: "/mercado", icon: Store },
      { title: "Instituciones", url: "/mercado/instituciones", icon: Building2 },
      { title: "Ordenes de Compra", url: "/mercado/ordenes", icon: FileText },
    ]
  },
    { 
    title: "Lista de Precios", 
    url: "/inventario", 
    icon: Package
  },
  { 
    title: "Dashboard", 
    url: "/dashboard", 
    icon: LayoutDashboard,
    children: [
      { title: "Resumen", url: "/dashboard", icon: LayoutDashboard },
      { title: "Calendario", url: "/dashboard/calendario", icon: Calendar },
      { title: "Vendedores", url: "/dashboard/vendedores", icon: Users },
    ]
  },
  { 
    title: "Configuracion", 
    url: "/configuracion", 
    icon: Settings,
    children: [
      { title: "Oportunidades", url: "/configuracion", icon: Settings },
      { title: "Equipo", url: "/configuracion/equipo", icon: Users },
    ]
  },
  { 
    title: "Cuenta", 
    url: "/cuenta", 
    icon: User,
    children: [
      { title: "Mi Perfil", url: "/cuenta", icon: User },
      { title: "Facturacion", url: "/cuenta/facturacion", icon: CreditCard },
    ]
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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
    if (url === "/mis-oportunidades") {
      return location.pathname === url ||
             location.pathname.startsWith("/licitaciones/") ||
             location.pathname.startsWith("/compras-agiles/");
    }
    if (url === "/oportunidades") {
      return location.pathname === "/oportunidades" ||
             location.pathname.startsWith("/oportunidades/");
    }
    return location.pathname === url ||
           (url !== '/' && location.pathname.startsWith(url + '/'));
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
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
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isExpanded = expandedItems.includes(item.title);
            const isItemActive = isActive(item.url) || 
              (hasChildren && item.children?.some(child => location.pathname === child.url));
            
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
                          const isChildActive = location.pathname === child.url;
                          return (
                            <li key={child.url}>
                              <NavLink
                                to={child.url}
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
      <div className="border-t border-sidebar-border p-3">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesion
        </button>
      </div>
    </aside>
  );
}
