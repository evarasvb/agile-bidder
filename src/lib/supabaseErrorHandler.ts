/**
 * Supabase Error Handler
 * Centralized error handling and logging for Supabase operations
 */

import { PostgrestError, AuthError } from '@supabase/supabase-js';
import { ServiceException } from '@/services/types';

export type SupabaseError = PostgrestError | AuthError | Error;

/**
 * Maps Supabase error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'invalid_credentials': 'Credenciales inválidas. Por favor verifica tu email y contraseña.',
  'email_not_confirmed': 'Por favor confirma tu email antes de iniciar sesión.',
  'user_not_found': 'Usuario no encontrado.',
  'weak_password': 'La contraseña debe tener al menos 8 caracteres.',
  
  // Database errors
  'PGRST116': 'No se encontraron resultados.',
  '23505': 'Ya existe un registro con estos datos.',
  '23503': 'No se puede eliminar porque hay datos relacionados.',
  '42P01': 'Error de configuración de base de datos.',
  
  // Network errors
  'ETIMEDOUT': 'Tiempo de espera agotado. Por favor intenta nuevamente.',
  'ECONNREFUSED': 'No se pudo conectar al servidor.',
};

/**
 * Handles Supabase errors and converts them to ServiceException
 */
export function handleSupabaseError(
  error: SupabaseError,
  context?: string
): ServiceException {
  let code = 'UNKNOWN_ERROR';
  let message = 'Ha ocurrido un error inesperado';
  let details: Record<string, unknown> = {};

  // Handle PostgrestError
  if ('code' in error && 'message' in error && 'details' in error) {
    code = error.code || 'DB_ERROR';
    message = ERROR_MESSAGES[code] || error.message;
    details = {
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }
  // Handle AuthError
  else if (error instanceof Error && 'status' in error) {
    const authError = error as AuthError;
    code = authError.status?.toString() || 'AUTH_ERROR';
    message = ERROR_MESSAGES[authError.message] || authError.message;
    details = {
      status: authError.status,
    };
  }
  // Handle generic Error
  else if (error instanceof Error) {
    code = 'ERROR';
    message = error.message;
    details = {
      name: error.name,
      stack: error.stack,
    };
  }

  // Add context if provided
  if (context) {
    details.context = context;
  }

  const exception = new ServiceException(code, message, details);
  
  // Log error for debugging
  console.error(`[Supabase Error] ${context || 'Unknown context'}:`, {
    code,
    message,
    details,
  });

  return exception;
}

/**
 * Logs errors to Supabase system_logs table
 * Non-blocking - won't throw if logging fails
 */
export async function logErrorToSupabase(
  error: ServiceException | Error,
  severity: 'error' | 'warning' | 'info' = 'error',
  additionalData?: Record<string, unknown>
): Promise<void> {
  try {
    // Use dynamic import to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');
    
    const errorData = {
      tipo: 'application_error',
      severidad: severity,
      mensaje: error.message,
      detalles: {
        name: error.name,
        stack: error.stack,
        ...(error instanceof ServiceException ? error.details : {}),
        ...additionalData,
      },
      timestamp: new Date().toISOString(),
    };

    await supabase.from('system_logs').insert(errorData);
  } catch (logError) {
    // Don't throw if logging fails - just console.warn
    console.warn('Failed to log error to Supabase:', logError);
  }
}

/**
 * Validates that Supabase client is properly initialized
 */
export function validateSupabaseClient(): void {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new ServiceException(
      'SUPABASE_NOT_CONFIGURED',
      'Supabase no está configurado correctamente. Por favor contacta al administrador.',
      {
        hasUrl: !!url,
        hasKey: !!key,
      }
    );
  }
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ServiceException) {
        throw error;
      }
      throw handleSupabaseError(error as SupabaseError, context);
    }
  }) as T;
}
