import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/auth/AdminOnlyRoute";
import { ChatWidget } from "@/components/support/ChatWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Licitaciones from "./pages/Licitaciones";
import LicitacionDetalle from "./pages/LicitacionDetalle";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import OdooDashboard from "./pages/OdooDashboard";
import ExtensionConfig from "./pages/ExtensionConfig";
import AdminOdoo from "./pages/AdminOdoo";
import AdminEvaristo from "./pages/AdminEvaristo";
import Calendar from "./pages/Calendar";
import Users from "./pages/Users";
import MercadoPublico from "./pages/MercadoPublico";
import BIDashboard from "./pages/BIDashboard";
import BIAdvanced from "./pages/BIAdvanced";
import GestionVendedores from "./pages/GestionVendedores";
import RoleConfig from "./pages/RoleConfig";
import PermisosRoles from "./pages/PermisosRoles";
import Ofertas from "./pages/Ofertas";
import OfertaDetalle from "./pages/OfertaDetalle";
import ComprasAgilesMatch from "./pages/ComprasAgilesMatch";
import ComprasAgiles from "./pages/ComprasAgiles";
import CompraAgilDetalle from "./pages/CompraAgilDetalle";
import OrdenesCompra from "./pages/OrdenesCompra";
import AuthCallback from "./pages/AuthCallback";
import Billing from "./pages/Billing";
import Opportunities from "./pages/Opportunities";
import MyBids from "./pages/MyBids";
import Instituciones from "./pages/Instituciones";
import AutoBids from "./pages/AutoBids";
import Planes from "./pages/Planes";
import MisOportunidades from "./pages/MisOportunidades";
import ConfiguracionOportunidades from "./pages/ConfiguracionOportunidades";
import MiInventario from "./pages/MiInventario";

const queryClient = new QueryClient();

// Layout wrapper that uses Outlet for nested routes with protection
const ProtectedLayoutWrapper = () => (
  <ProtectedRoute>
    <AppLayout>
      <Outlet />
    </AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ChatWidget />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth" element={<Auth />} />
          
          {/* Redirect old cliente routes to dashboard */}
          <Route path="/clientes/*" element={<Navigate to="/dashboard" replace />} />
          
          {/* Onboarding route - standalone without AppLayout */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          
          {/* Odoo Dashboard - protected but without sidebar layout for now */}
          <Route path="/odoo/dashboard" element={<ProtectedRoute><OdooDashboard /></ProtectedRoute>} />
          
          {/* Admin Routes - protected */}
          <Route path="/admin" element={<ProtectedRoute><AdminOdoo /></ProtectedRoute>} />
          <Route path="/admin/evaristo" element={<AdminOnlyRoute><AdminEvaristo /></AdminOnlyRoute>} />
          
          {/* All other routes with AppLayout using nested routing - ALL PROTECTED */}
          <Route element={<ProtectedLayoutWrapper />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/history" element={<History />} />
            <Route path="/licitaciones" element={<Licitaciones />} />
            <Route path="/licitaciones/:id" element={<LicitacionDetalle />} />
            <Route path="/compras-agiles" element={<ComprasAgiles />} />
            <Route path="/compras-agiles/:codigo" element={<CompraAgilDetalle />} />
            <Route path="/ordenes-compra" element={<OrdenesCompra />} />
            <Route path="/ofertas" element={<Ofertas />} />
            <Route path="/ofertas/:id" element={<OfertaDetalle />} />
                        <Route path="/compras-agiles-match" element={<ComprasAgilesMatch />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/my-bids" element={<MyBids />} />
            <Route path="/vendedores" element={<GestionVendedores />} />
            <Route path="/mercadopublico" element={<MercadoPublico />} />
            <Route path="/bi-dashboard" element={<BIDashboard />} />
            <Route path="/bi-advanced" element={<BIAdvanced />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/extension" element={<ExtensionConfig />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/users" element={<Users />} />
            <Route path="/role-config" element={<RoleConfig />} />
            <Route path="/permisos-roles" element={<PermisosRoles />} />
            <Route path="/instituciones" element={<Instituciones />} />
            <Route path="/auto-bids" element={<AutoBids />} />
            <Route path="/planes" element={<Planes />} />
            <Route path="/mis-oportunidades" element={<MisOportunidades />} />
            <Route path="/configuracion-oportunidades" element={<ConfiguracionOportunidades />} />
            <Route path="/mi-inventario" element={<MiInventario />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
