import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

interface OdooSyncError {
  id: string;
  oferta_id: string;
  licitacion_id: string;
  licitacion_titulo: string;
  error_message: string;
  created_at: string;
  dismissed: boolean;
}

// Local storage key for Odoo sync errors
const ODOO_SYNC_ERRORS_KEY = 'odoo_sync_errors';

/**
 * Get all Odoo sync errors from local storage
 */
function getOdooSyncErrors(): OdooSyncError[] {
  try {
    const stored = localStorage.getItem(ODOO_SYNC_ERRORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Add a new Odoo sync error to local storage
 */
function addOdooSyncError(error: Omit<OdooSyncError, 'id' | 'created_at' | 'dismissed'>): OdooSyncError {
  const errors = getOdooSyncErrors();
  const newError: OdooSyncError = {
    ...error,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    dismissed: false,
  };
  
  // Keep only last 50 errors
  const updatedErrors = [newError, ...errors].slice(0, 50);
  localStorage.setItem(ODOO_SYNC_ERRORS_KEY, JSON.stringify(updatedErrors));
  
  return newError;
}

/**
 * Dismiss an Odoo sync error
 */
function dismissOdooSyncError(errorId: string) {
  const errors = getOdooSyncErrors();
  const updatedErrors = errors.map(e => 
    e.id === errorId ? { ...e, dismissed: true } : e
  );
  localStorage.setItem(ODOO_SYNC_ERRORS_KEY, JSON.stringify(updatedErrors));
}

/**
 * Dismiss all Odoo sync errors
 */
function dismissAllOdooSyncErrors() {
  const errors = getOdooSyncErrors();
  const updatedErrors = errors.map(e => ({ ...e, dismissed: true }));
  localStorage.setItem(ODOO_SYNC_ERRORS_KEY, JSON.stringify(updatedErrors));
}

/**
 * Clear all Odoo sync errors
 */
function clearOdooSyncErrors() {
  localStorage.removeItem(ODOO_SYNC_ERRORS_KEY);
}

/**
 * Hook to manage Odoo sync error notifications
 */
export function useOdooSyncErrors() {
  const [errors, setErrors] = useState<OdooSyncError[]>([]);
  const [undismissedCount, setUndismissedCount] = useState(0);

  // Load errors on mount and listen for changes
  useEffect(() => {
    const loadErrors = () => {
      const storedErrors = getOdooSyncErrors();
      setErrors(storedErrors);
      setUndismissedCount(storedErrors.filter(e => !e.dismissed).length);
    };

    loadErrors();

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ODOO_SYNC_ERRORS_KEY) {
        loadErrors();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addError = (error: Omit<OdooSyncError, 'id' | 'created_at' | 'dismissed'>) => {
    const newError = addOdooSyncError(error);
    setErrors(prev => [newError, ...prev].slice(0, 50));
    setUndismissedCount(prev => prev + 1);
    return newError;
  };

  const dismissError = (errorId: string) => {
    dismissOdooSyncError(errorId);
    setErrors(prev => prev.map(e => 
      e.id === errorId ? { ...e, dismissed: true } : e
    ));
    setUndismissedCount(prev => Math.max(0, prev - 1));
  };

  const dismissAll = () => {
    dismissAllOdooSyncErrors();
    setErrors(prev => prev.map(e => ({ ...e, dismissed: true })));
    setUndismissedCount(0);
  };

  const clearAll = () => {
    clearOdooSyncErrors();
    setErrors([]);
    setUndismissedCount(0);
  };

  const retrySync = (errorId: string) => {
    const error = errors.find(e => e.id === errorId);
    if (error) {
      // Dismiss this error when retrying
      dismissError(errorId);
      return error;
    }
    return null;
  };

  return {
    errors,
    undismissedErrors: errors.filter(e => !e.dismissed),
    undismissedCount,
    addError,
    dismissError,
    dismissAll,
    clearAll,
    retrySync,
  };
}

/**
 * Log Odoo sync error to database for persistence
 */
export function useLogOdooSyncError() {
  return useMutation({
    mutationFn: async ({
      ofertaId,
      licitacionId,
      licitacionTitulo,
      errorMessage,
      clienteId,
    }: {
      ofertaId: string;
      licitacionId: string;
      licitacionTitulo: string;
      errorMessage: string;
      clienteId?: string;
    }) => {
      const { error } = await supabase.from('system_logs').insert({
        tipo: 'odoo_sync_error',
        severidad: 'error',
        mensaje: `Error sincronizando oferta ${ofertaId} con Odoo: ${errorMessage}`,
        licitacion_id: licitacionId,
        oferta_id: ofertaId,
        detalles: {
          licitacion_titulo: licitacionTitulo,
          cliente_id: clienteId,
          error_message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      if (error) {
        console.error('Error logging Odoo sync error:', error);
      }
    },
  });
}
