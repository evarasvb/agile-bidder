import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  History, 
  FileText,
  FileSearch,
  Zap,
  LogOut,
  Link2,
  Chrome,
  CalendarDays,
  Users,
  Globe,
  BarChart3,
  Lightbulb
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClienteConfig } from "@/hooks/useClienteConfig";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useCliente } from "@/hooks/useCliente";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOdoo?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Licitaciones", url: "/licitaciones", icon: FileSearch },
  { title: "MercadoPúblico", url: "/mercadopublico", icon: Globe },
  { title: "BI Dashboard", url: "/bi-dashboard", icon: BarChart3 },
  { title: "BI Avanzado", url: "/bi-advanced", icon: Lightbulb },
  { title: "Calendario", url: "/calendar", icon: CalendarDays },
  { title: "Inventario", url: "/inventory", icon: Package },
  { title: "Odoo CRM", url: "/odoo/dashboard", icon: Link2, requiresOdoo: true },
  { title: "Extensión Chrome", url: "/extension", icon: Chrome },
  { title: "Historial", url: "/history", icon: History },
  { title: "Usuarios", url: "/users", icon: Users, adminOnly: true },
  { title: "Logs", url: "/logs", icon: FileText, adminOnly: true },
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { hasOdoo } = useClienteConfig();
  const { profile, isAdmin } = useProfile();
  const { data: cliente } = useCliente();

  const handleLogout = async () => {
    try {
      console.log('Attempting to sign out...');
      await signOut();
      console.log('Sign out successful, navigating to /auth');
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  // Filtrar items de navegación según permisos
  const filteredNavItems = navItems.filter(item => {
    if (item.requiresOdoo && !hasOdoo) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Zap className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">FirmaVB</h1>
          <p className="text-xs text-sidebar-muted">Procurement Engine</p>
        </div>
      </div>

      {/* User Profile with Notification Bell */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || user?.email || 'Usuario'}
            </p>
            <p className="text-xs text-sidebar-muted truncate">
              {isAdmin ? 'Administrador' : 'Usuario'}
            </p>
          </div>
          <NotificationBell clienteId={cliente?.id} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <li key={item.title}>
                <NavLink
                  to={item.url}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-sidebar-primary" : "text-sidebar-muted"
                  )} />
                  {item.title}
                </NavLink>
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
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
