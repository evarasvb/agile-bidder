import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Licitaciones from "./pages/Licitaciones";
import Onboarding from "./pages/Onboarding";
import Clientes from "./pages/Clientes";
import ClienteOnboarding from "./pages/ClienteOnboarding";
import ClienteDashboard from "./pages/ClienteDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Layout wrapper that uses Outlet for nested routes
const LayoutWrapper = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Cliente routes - standalone */}
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/onboarding" element={<ClienteOnboarding />} />
          <Route path="/clientes/dashboard" element={<ClienteDashboard />} />
          
          {/* Onboarding route - standalone without AppLayout */}
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* All other routes with AppLayout using nested routing */}
          <Route element={<LayoutWrapper />}>
            <Route path="/" element={<Index />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/history" element={<History />} />
            <Route path="/licitaciones" element={<Licitaciones />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
