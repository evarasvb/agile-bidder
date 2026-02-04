import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/auth/AdminOnlyRoute";
import { ChatWidget } from "@/components/support/ChatWidget";

// Auth
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Mis Oportunidades
import MisOportunidades from "./pages/MisOportunidades";
import LicitacionDetalle from "./pages/LicitacionDetalle";
import Licitaciones from "./pages/Licitaciones";

// Mercado
import Mercado from "./pages/Mercado";
import Instituciones from "./pages/Instituciones";
import ComprasAgiles from "./pages/ComprasAgiles";
import CompraAgilDetalle from "./pages/CompraAgilDetalle";
import OrdenesCompra from "./pages/OrdenesCompra";

// Inventario / Lista de Precios
import Inventory from "./pages/Inventory";

// Dashboard
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import GestionVendedores from "./pages/GestionVendedores";

// Configuracion
import ConfiguracionOportunidades from "./pages/ConfiguracionOportunidades";
import Users from "./pages/Users";

// Cuenta
import Cuenta from "./pages/Cuenta";
import Billing from "./pages/Billing";

// Admin (oculto)
import AdminEvaristo from "./pages/AdminEvaristo";

const queryClient = new QueryClient();

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
          {/* ========== RUTAS PUBLICAS ========== */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Onboarding - sin sidebar */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          
          {/* Admin oculto */}
          <Route path="/admin/evaristo" element={<AdminOnlyRoute><AdminEvaristo /></AdminOnlyRoute>} />

          {/* ========== RUTAS PROTEGIDAS CON LAYOUT ========== */}
          <Route element={<ProtectedLayoutWrapper />}>
            
            {/* ----- MIS OPORTUNIDADES ----- */}
            <Route path="/mis-oportunidades" element={<MisOportunidades />} />
            <Route path="/licitaciones/:id" element={<LicitacionDetalle />} />
                      <Route path="/licitaciones" element={<Licitaciones />} />
            
            {/* ----- MERCADO ----- */}
            <Route path="/mercado" element={<Mercado />} />
            
              {/* ----- COMPRAS AGILES ----- */}
              <Route path="/compras-agiles" element={<ComprasAgiles />} />
              <Route path="/compras-agiles/:codigo" element={<CompraAgilDetalle />} />
            <Route path="/mercado/instituciones" element={<Instituciones />} />
            <Route path="/mercado/ordenes" element={<OrdenesCompra />} />

                        {/* ----- INVENTARIO / LISTA DE PRECIOS ----- */}
            <Route path="/inventario" element={<Inventory />} />
            
            {/* ----- DASHBOARD ----- */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/calendario" element={<Calendar />} />
            <Route path="/dashboard/vendedores" element={<GestionVendedores />} />
            
            {/* ----- CONFIGURACION ----- */}
            <Route path="/configuracion" element={<ConfiguracionOportunidades />} />
            <Route path="/configuracion/equipo" element={<Users />} />
            
            {/* ----- CUENTA ----- */}
            <Route path="/cuenta" element={<Cuenta />} />
            <Route path="/cuenta/facturacion" element={<Billing />} />
            
            {/* Redirects de rutas antiguas */}
            <Route path="/dashboard-old" element={<Navigate to="/mis-oportunidades" replace />} />
            <Route path="/clientes/*" element={<Navigate to="/mis-oportunidades" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
