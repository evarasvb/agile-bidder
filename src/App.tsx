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
import Academia from "./pages/Academia";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Mis Oportunidades
import MisOportunidades from "./pages/MisOportunidades";
import LicitacionDetalle from "./pages/LicitacionDetalle";
import Licitaciones from "./pages/Licitaciones";
import LicitacionesMP from "./pages/LicitacionesMP";

// Chat IA
import ChatIA from "./pages/ChatIA";

// Oportunidades Panel
import OportunidadesPanel from "./pages/Oportunidades";
import OportunidadDetalle from "./pages/OportunidadDetalle";

// Mercado
import Mercado from "./pages/Mercado";
import Instituciones from "./pages/Instituciones";
import ComprasAgiles from "./pages/ComprasAgiles";
import CompraAgilDetalle from "./pages/CompraAgilDetalle";
import OrdenesCompra from "./pages/OrdenesCompra";

// Inventario / Lista de Precios
import Inventory from "./pages/Inventory";

// Pipeline
import Pipeline from "./pages/Pipeline";

// Dashboard
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import CalendarioIntegrado from "./pages/CalendarioIntegrado";
import GestionVendedores from "./pages/GestionVendedores";

// Equipo
import Equipo from "./pages/Equipo";
import VendedorDetalle from "./pages/VendedorDetalle";

// Configuracion
import ConfiguracionOportunidades from "./pages/ConfiguracionOportunidades";
import Users from "./pages/Users";
import ExtensionConfig from "./pages/ExtensionConfig";

// Cuenta
import Cuenta from "./pages/Cuenta";
import Billing from "./pages/Billing";

// Reportes
import ReportesHub from "./pages/reportes/ReportesHub";
import ReporteProveedores from "./pages/reportes/ReporteProveedores";
import ReporteProductos from "./pages/reportes/ReporteProductos";
import ReporteCompradores from "./pages/reportes/ReporteCompradores";
import ReporteMercado from "./pages/reportes/ReporteMercado";
import ReporteCompetidores from "./pages/reportes/ReporteCompetidores";
import ReporteConvenioMarco from "./pages/reportes/ReporteConvenioMarco";

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
          <Route path="/academia" element={<Academia />} />
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
            <Route path="/licitaciones/:id/chat" element={<ChatIA />} />
            <Route path="/licitaciones" element={<Licitaciones />} />
            <Route path="/licitaciones-nuevas" element={<LicitacionesMP />} />

            {/* ----- OPORTUNIDADES PANEL ----- */}
            <Route path="/oportunidades" element={<OportunidadesPanel />} />
            <Route path="/oportunidades/:tipo/:id" element={<OportunidadDetalle />} />
            <Route path="/oportunidades/:tipo/:id/chat" element={<ChatIA />} />

            {/* ----- MERCADO ----- */}
            <Route path="/mercado" element={<Mercado />} />
            
              {/* ----- COMPRAS AGILES ----- */}
              <Route path="/compras-agiles" element={<ComprasAgiles />} />
              <Route path="/compras-agiles/:codigo" element={<CompraAgilDetalle />} />
            <Route path="/mercado/instituciones" element={<Instituciones />} />
            <Route path="/mercado/ordenes" element={<OrdenesCompra />} />

            {/* ----- PIPELINE ----- */}
            <Route path="/pipeline" element={<Pipeline />} />

            {/* ----- EQUIPO ----- */}
            <Route path="/equipo" element={<Equipo />} />
            <Route path="/equipo/:id" element={<VendedorDetalle />} />

                        {/* ----- INVENTARIO / LISTA DE PRECIOS ----- */}
            <Route path="/inventario" element={<Inventory />} />
            
            {/* ----- DASHBOARD ----- */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/calendario" element={<Calendar />} />
            <Route path="/calendario" element={<CalendarioIntegrado />} />
            <Route path="/dashboard/vendedores" element={<GestionVendedores />} />
            
            {/* ----- REPORTES ----- */}
            <Route path="/reportes" element={<ReportesHub />} />
            <Route path="/reportes/proveedores" element={<ReporteProveedores />} />
            <Route path="/reportes/productos" element={<ReporteProductos />} />
            <Route path="/reportes/compradores" element={<ReporteCompradores />} />
            <Route path="/reportes/mercado" element={<ReporteMercado />} />
            <Route path="/reportes/competidores" element={<ReporteCompetidores />} />
            <Route path="/reportes/convenio-marco" element={<ReporteConvenioMarco />} />

            {/* ----- CONFIGURACION ----- */}
            <Route path="/configuracion" element={<ConfiguracionOportunidades />} />
            <Route path="/configuracion/equipo" element={<Users />} />
            <Route path="/configuracion/extension" element={<ExtensionConfig />} />
            
            {/* ----- CUENTA ----- */}
            <Route path="/cuenta" element={<Cuenta />} />
            <Route path="/cuenta/facturacion" element={<Billing />} />
            
            {/* Redirects de rutas antiguas */}
            <Route path="/dashboard-old" element={<Navigate to="/dashboard" replace />} />
            <Route path="/clientes/*" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
