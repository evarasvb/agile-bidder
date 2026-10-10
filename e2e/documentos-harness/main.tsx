import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { DocumentosEmpresaCard } from '@/components/settings/DocumentosEmpresaCard';
import '@/index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <main className="mx-auto max-w-3xl p-6"><DocumentosEmpresaCard /></main>
    <Toaster />
  </QueryClientProvider>,
);
