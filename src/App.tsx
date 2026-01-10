import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Logs from "./pages/Logs";
import Licitaciones from "./pages/Licitaciones";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper component for routes with AppLayout
const AppRoutes = () => (
  <AppLayout>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/history" element={<History />} />
      <Route path="/licitaciones" element={<Licitaciones />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/logs" element={<Logs />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Onboarding route - standalone without AppLayout */}
          <Route path="/onboarding" element={<Onboarding />} />
          
          {/* All other routes with AppLayout */}
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
