import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChatWidget } from "@/components/support/ChatWidget";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Licitaciones from "./pages/Licitaciones";
import Onboarding from "./pages/Onboarding";
import Clientes from "./pages/Clientes";
import ClienteOnboarding from "./pages/ClienteOnboarding";
import ClienteDashboard from "./pages/ClienteDashboard";
import ClienteOfertasDashboard from "./pages/ClienteOfertasDashboard";
import ClienteRegistro from "./pages/ClienteRegistro";
import NotFound from "./pages/NotFound";
import OdooDashboard from "./pages/OdooDashboard";
import ExtensionConfig from "./pages/ExtensionConfig";
import AdminOdoo from "./pages/AdminOdoo";
import Calendar from "./pages/Calendar";
import Users from "./pages/Users";
import MercadoPublico from "./pages/MercadoPublico";
import BIDashboard from "./pages/BIDashboard";
import BIAdvanced from "./pages/BIAdvanced";
import GestionVendedores from "./pages/GestionVendedores";

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
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected cliente routes */}
          <Route path="/clientes" element={<ProtectedRoute><Clientes /></ProtectedRoute>} />
          <Route path="/clientes/registro" element={<ProtectedRoute><ClienteRegistro /></ProtectedRoute>} />
          <Route path="/clientes/onboarding" element={<ProtectedRoute><ClienteOnboarding /></ProtectedRoute>} />
          <Route path="/clientes/dashboard" element={<ProtectedRoute><ClienteDashboard /></ProtectedRoute>} />
          <Route path="/clientes/ofertas" element={<ProtectedRoute><ClienteOfertasDashboard /></ProtectedRoute>} />
          
          {/* Onboarding route - standalone without AppLayout */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          
          {/* Odoo Dashboard - protected */}
          <Route path="/odoo/dashboard" element={<ProtectedRoute><OdooDashboard /></ProtectedRoute>} />
          
          {/* Admin Routes - protected */}
          <Route path="/admin" element={<ProtectedRoute><AdminOdoo /></ProtectedRoute>} />
          
          {/* All other routes with AppLayout using nested routing - ALL PROTECTED */}
          <Route element={<ProtectedLayoutWrapper />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/history" element={<History />} />
            <Route path="/licitaciones" element={<Licitaciones />} />
            <Route path="/vendedores" element={<GestionVendedores />} />
            <Route path="/mercadopublico" element={<MercadoPublico />} />
            <Route path="/bi-dashboard" element={<BIDashboard />} />
            <Route path="/bi-advanced" element={<BIAdvanced />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/extension" element={<ExtensionConfig />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/users" element={<Users />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
