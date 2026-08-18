import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/auth/AdminOnlyRoute";
import { ChatWidget } from "@/components/support/ChatWidget";
import { ScrollToTop } from "@/components/ScrollToTop";

import { useCliente } from "@/hooks/useCliente";
import { UpgradeProProvider } from "@/components/pro/UpgradeProProvider";

// Páginas con carga diferida (code-splitting): aligera el bundle inicial
// (~3.3MB en un solo chunk) y acelera el primer render. Cada página se descarga
// recién cuando se visita su ruta.
const Index = lazy(() => import("./pages/Index"));
const Academia = lazy(() => import("./pages/Academia"));
const AcademiaCurso = lazy(() => import("./pages/AcademiaCurso"));
const AcademiaLeads = lazy(() => import("./pages/AcademiaLeads"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ClienteOnboarding = lazy(() => import("./pages/ClienteOnboarding"));
const Activar = lazy(() => import("./pages/Activar"));
const NotFound = lazy(() => import("./pages/NotFound"));

const MisOportunidades = lazy(() => import("./pages/MisOportunidades"));
const LicitacionDetalle = lazy(() => import("./pages/LicitacionDetalle"));
const Licitaciones = lazy(() => import("./pages/Licitaciones"));
const LicitacionesMP = lazy(() => import("./pages/LicitacionesMP"));

const ChatIA = lazy(() => import("./pages/ChatIA"));

const OportunidadesPanel = lazy(() => import("./pages/Oportunidades"));
const OportunidadDetalle = lazy(() => import("./pages/OportunidadDetalle"));

const Mercado = lazy(() => import("./pages/Mercado"));
const Instituciones = lazy(() => import("./pages/Instituciones"));
const ComprasAgiles = lazy(() => import("./pages/ComprasAgiles"));
const CompraAgilDetalle = lazy(() => import("./pages/CompraAgilDetalle"));
const OrdenesCompra = lazy(() => import("./pages/OrdenesCompra"));

const Inventory = lazy(() => import("./pages/Inventory"));

const Pipeline = lazy(() => import("./pages/Pipeline"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendar = lazy(() => import("./pages/Calendar"));
const CalendarioIntegrado = lazy(() => import("./pages/CalendarioIntegrado"));
const GestionVendedores = lazy(() => import("./pages/GestionVendedores"));

const Equipo = lazy(() => import("./pages/Equipo"));
const VendedorDetalle = lazy(() => import("./pages/VendedorDetalle"));

const ConfiguracionOportunidades = lazy(() => import("./pages/ConfiguracionOportunidades"));
const Users = lazy(() => import("./pages/Users"));
const ExtensionConfig = lazy(() => import("./pages/ExtensionConfig"));

const Cuenta = lazy(() => import("./pages/Cuenta"));
const Billing = lazy(() => import("./pages/Billing"));

const ReportesHub = lazy(() => import("./pages/reportes/ReportesHub"));
const ReporteProveedores = lazy(() => import("./pages/reportes/ReporteProveedores"));
const ReporteProductos = lazy(() => import("./pages/reportes/ReporteProductos"));
const ReporteCompradores = lazy(() => import("./pages/reportes/ReporteCompradores"));
const ReporteMercado = lazy(() => import("./pages/reportes/ReporteMercado"));
const ReporteCompetidores = lazy(() => import("./pages/reportes/ReporteCompetidores"));
const ReporteConvenioMarco = lazy(() => import("./pages/reportes/ReporteConvenioMarco"));

const AdminEvaristo = lazy(() => import("./pages/AdminEvaristo"));

const queryClient = new QueryClient();

// Manda al onboarding a los clientes que aún no lo completaron. No genera bucle
// porque la ruta /onboarding está FUERA de este wrapper. Si el cliente aún no
// cargó (o no existe), no redirige: deja pasar (evita lockouts).
const OnboardingGate = ({ children }: { children: React.ReactNode }) => {
  const { data: cliente, isLoading } = useCliente();
  if (!isLoading && cliente && cliente.onboarding_completado === false) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
};

const ProtectedLayoutWrapper = () => (
  <ProtectedRoute>
    <OnboardingGate>
      <UpgradeProProvider>
        <AppLayout>
          <Outlet />
        </AppLayout>
      </UpgradeProProvider>
    </OnboardingGate>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ChatWidget />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
        <Routes>
          {/* ========== RUTAS PUBLICAS ========== */}
          <Route path="/" element={<Index />} />
          <Route path="/academia" element={<Academia />} />
          <Route path="/academia/curso/:slug" element={<AcademiaCurso />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/activar" element={<Activar />} />
          
          {/* Onboarding - sin sidebar */}
          <Route path="/onboarding" element={<ProtectedRoute><ClienteOnboarding /></ProtectedRoute>} />
          
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

            {/* ----- ACADEMIA (contactos del formulario público) ----- */}
            <Route path="/academia/leads" element={<AcademiaLeads />} />

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
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
