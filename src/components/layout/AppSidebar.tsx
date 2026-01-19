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
  ShoppingCart,
  Bot,
  Receipt
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
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionKey: string;
  requiresOdoo?: boolean;
}

// Full navigation items - visibility controlled by RBAC
const navItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, sectionKey: "dashboard" },
  { title: "Licitaciones", url: "/licitaciones", icon: FileSearch, sectionKey: "licitaciones" },
  { title: "Compras Ágiles", url: "/compras-agiles", icon: ShoppingCart, sectionKey: "compras_agiles" },
  { title: "Órdenes de Compra", url: "/ordenes-compra", icon: Receipt, sectionKey: "ordenes_compra" },
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
  { title: "Permisos y Roles", url: "/permisos-roles", icon: Shield, sectionKey: "role_config" },
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
  const { canViewSection, loading: permissionsLoading, isSuperAdmin, isAdmin, permissions } = useRolePermissions();
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

  // Verificar si el usuario es el administrador autorizado de Evaristo
  const isEvaristoAuthorized = user?.email?.toLowerCase() === 'evaras@firmavb.cl';

  // Agregar Evaristo al menú solo para el email autorizado
  const allNavItems: NavItem[] = isEvaristoAuthorized 
    ? [...navItems, { 
        title: "Evaristo", 
        url: "/admin/evaristo", 
        icon: Bot, 
        sectionKey: "evaristo",
        requiresOdoo: false
      }]
    : navItems;

  // Secciones básicas que siempre deben mostrarse a usuarios autenticados
  const basicSections = [
    'dashboard', 
    'licitaciones', 
    'compras_agiles',
    'ordenes_compra',
    'ofertas', 
    'inventory', 
    'settings'
  ];

  // Secciones extendidas para usuarios con permisos adicionales
  const extendedSections = [
    ...basicSections,
    'vendedores',
    'mercadopublico',
    'bi_dashboard',
    'bi_advanced',
    'calendar',
    'extension',
    'history',
    'users',
    'logs'
  ];

  // Dynamic sidebar based on role (RBAC)
  const filteredNavItems = allNavItems.filter(item => {
    // Evaristo solo para email autorizado
    if (item.sectionKey === 'evaristo' && !isEvaristoAuthorized) return false;
    
    // Odoo requires separate flag
    if (item.requiresOdoo && !hasOdoo) return false;
    
    // Evaristo siempre visible para email autorizado
    if (item.sectionKey === 'evaristo' && isEvaristoAuthorized) return true;

    // Super admin sees everything
    if (isSuperAdmin) return true;

    // Admin sees most things except role config
    if (isAdmin && item.sectionKey !== 'role_config') return true;

    // While loading permissions, show basic items
    if (permissionsLoading) {
      return basicSections.includes(item.sectionKey);
    }

    // Si el usuario tiene permisos configurados, verificar
    if (permissions.length > 0) {
      return canViewSection(item.sectionKey);
    }

    // Fallback: si no hay permisos configurados, mostrar secciones básicas
    // Esto permite que usuarios nuevos vean el menú principal
    return basicSections.includes(item.sectionKey);
  });

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const roleLabel = primaryRole ? roleLabels[primaryRole] : 'Usuario';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo Header - FirmaVB Branding */}
      <div className="flex h-16 items-center justify-center px-5 border-b border-sidebar-border bg-sidebar">
        <img 
          src={logoFirmavbBlanco} 
          alt="FirmaVB" 
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* User Profile with Notification Bell */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-sidebar-accent">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm font-medium">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || user?.email || 'Usuario'}
            </p>
            <Badge 
              variant="secondary" 
              className="text-[10px] mt-0.5 bg-sidebar-primary/20 text-sidebar-primary border-0 font-medium"
            >
              {roleLabel}
            </Badge>
          </div>
          <NotificationBell clienteId={cliente?.id} />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
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
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-sidebar-primary-foreground" : "text-sidebar-muted"
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