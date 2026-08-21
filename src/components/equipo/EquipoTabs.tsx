import { NavLink } from "react-router-dom";
import { Users, BarChart3, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

// Sub-navegación compartida entre las páginas de equipo. Antes eran 3 destinos
// desconectados y sin enlace entre sí; ahora se moverse entre ellos es un clic.
const TABS = [
  { to: "/equipo", label: "Miembros", icon: Users, adminOnly: false },
  { to: "/dashboard/vendedores", label: "Desempeño", icon: BarChart3, adminOnly: false },
  { to: "/configuracion/equipo", label: "Roles y permisos", icon: Shield, adminOnly: true },
];

export function EquipoTabs() {
  // "Roles y permisos" está reservado a admin (la página bloquea con "Acceso
  // Restringido"); ocultamos el tab a quien no es admin para no llevarlo a un muro.
  const { isAdmin } = useProfile();
  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          <t.icon className="h-4 w-4" />
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
