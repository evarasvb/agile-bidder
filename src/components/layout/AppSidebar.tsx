import {
  Star,
  Package,
  Store,
  Settings,
  User,
  LogOut,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import logoFirmavbBlanco from "@/assets/logo-firmavb-blanco.png";

// Navigation items - Simplified to 5 main routes
const navItems = [
  { title: "Mis Oportunidades", url: "/mis-oportunidades", icon: Star },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Mercado", url: "/mercado", icon: Store },
  { title: "Configuración", url: "/configuracion", icon: Settings },
  { title: "Cuenta", url: "/cuenta", icon: User },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Error during sign out:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || 'U';

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
            const isActive = location.pathname === item.url || 
              (item.url !== '/' && location.pathname.startsWith(item.url));
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
