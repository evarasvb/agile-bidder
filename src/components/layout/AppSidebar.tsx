import { 
  LayoutDashboard, 
  Package, 
  Settings, 
  History, 
  FileText,
  FileSearch,
  LogOut,
  Link2,
  Chrome,
  CalendarDays,
  Users,
  Globe,
  BarChart3,
  Lightbulb,
  Shield,
  ShoppingCart
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClienteConfig } from "@/hooks/useClienteConfig";
import { useProfile } from "@/hooks/useProfile";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useCliente } from "@/hooks/useCliente";
import { Badge } from "@/components/ui/badge";
import firmavbLogo from "@/assets/firmavb-logo.png";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionKey: string;
  requiresOdoo?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, sectionKey: "dashboard" },
  { title: "Licitaciones", url: "/licitaciones", icon: FileSearch, sectionKey: "licitaciones" },
  { title: "Compras Ágiles", url: "/compras-agiles", icon: ShoppingCart, sectionKey: "compras_agiles" },
  { title: "Mis Ofertas", url: "/ofertas", icon: FileText, sectionKey: "ofertas" },
  { title: "Gestión Vendedores", url: "/vendedores", icon: Users, sectionKey: "vendedores" },
  { title: "MercadoPúblico", url: "/mercadopublico", icon: Globe, sectionKey: "mercadopublico" },
  { title: "BI Dashboard", url: "/bi-dashboard", icon: BarChart3, sectionKey: "bi_dashboard" },
  { title: "BI Avanzado", url: "/bi-advanced", icon: Lightbulb, sectionKey: "bi_advanced" },
  { title: "Calendario", url: "/calendar", icon: CalendarDays, sectionKey: "calendar" },
  { title: "Inventario", url: "/inventory", icon: Package, sectionKey: "inventory" },
  { title: "Odoo CRM", url: "/odoo/dashboard", icon: Link2, sectionKey: "odoo", requiresOdoo: true },
  { title: "Extensión Chrome", url: "/extension", icon: Chrome, sectionKey: "extension" },
  { title: "Historial", url: "/history", icon: History, sectionKey: "history" },
  { title: "Configuración", url: "/settings", icon: Settings, sectionKey: "settings" },
  { title: "Usuarios", url: "/users", icon: Users, sectionKey: "users" },
  { title: "Logs", url: "/logs", icon: FileText, sectionKey: "logs" },
  { title: "Configurar Roles", url: "/role-config", icon: Shield, sectionKey: "role_config" },
];

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  user: 'Usuario',
  vendedor: 'Vendedor',
  visor: 'Visor',
};

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { hasOdoo } = useClienteConfig();
  const { profile, primaryRole } = useProfile();
  const { canViewSection, loading: permissionsLoading } = useRolePermissions();
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
    // Si los permisos están cargando, mostrar items básicos
    if (permissionsLoading) return ['dashboard', 'licitaciones'].includes(item.sectionKey);
    // Verificar si el usuario puede ver esta sección
    return canViewSection(item.sectionKey);
  });

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const roleLabel = primaryRole ? roleLabels[primaryRole] : 'Usuario';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo - FirmaVB Branding */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <img 
          src={firmavbLogo} 
          alt="FirmaVB Logo" 
          className="h-9 w-9 rounded-full object-cover shadow-sm"
        />
        <div>
          <h1 className="text-lg font-heading font-bold text-sidebar-foreground">FirmaVB</h1>
          <p className="text-[10px] text-sidebar-muted font-medium tracking-wide">Inteligencia para Ganar Más</p>
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
            <Badge variant="secondary" className="text-xs mt-0.5">
              {roleLabel}
            </Badge>
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
