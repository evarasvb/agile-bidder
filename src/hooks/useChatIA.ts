import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { chatIaRequest, isRecord } from '@/lib/chatIaTransport';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  pages_referenced?: number[];
}

export interface DocumentoLicitacion {
  id: string;
  licitacion_id: string;
  filename: string;
  storage_path: string;
  file_size: number | null;
  total_pages: number | null;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  resumen_automatico: any | null;
  processed_at: string | null;
  created_at: string;
}

export interface ChatLicitacion {
  id: string;
  licitacion_id: string;
  mensajes: ChatMessage[];
  created_at: string;
  updated_at: string;
}

function nullableString(value: unknown): boolean { return value === null || typeof value === 'string'; }
function nullableNumber(value: unknown): boolean { return value === null || typeof value === 'number' && Number.isFinite(value); }
function isSummary(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  if (!['objeto', 'presupuesto'].every(k => value[k] === undefined || value[k] === null || typeof value[k] === 'string')) return false;
  if (value.requisitos_tecnicos !== undefined && value.requisitos_tecnicos !== null
    && (!Array.isArray(value.requisitos_tecnicos) || !value.requisitos_tecnicos.every(r => typeof r === 'string'))) return false;
  return value.garantias === undefined || value.garantias === null || isRecord(value.garantias)
    && ['seriedad', 'fiel_cumplimiento'].every(k => value.garantias[k] === undefined || value.garantias[k] === null || typeof value.garantias[k] === 'string');
}
export function isDocumentoLicitacion(value: unknown): value is DocumentoLicitacion {
  return isRecord(value) && ['id', 'licitacion_id', 'filename', 'storage_path', 'created_at'].every(k => typeof value[k] === 'string')
    && nullableNumber(value.file_size) && nullableNumber(value.total_pages)
    && ['uploading', 'processing', 'ready', 'error'].includes(String(value.status))
    && nullableString(value.error_message) && nullableString(value.processed_at)
    && isSummary(value.resumen_automatico);
}
export function isChatLicitacion(value: unknown): value is ChatLicitacion {
  return isRecord(value) && ['id', 'licitacion_id', 'created_at', 'updated_at'].every(k => typeof value[k] === 'string')
    && Array.isArray(value.mensajes) && value.mensajes.every(m => isRecord(m)
      && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && typeof m.timestamp === 'string'
      && (m.pages_referenced === undefined || Array.isArray(m.pages_referenced) && m.pages_referenced.every(p => typeof p === 'number' && Number.isFinite(p))));
}

// ============================================================================
// DOCUMENTS HOOK
// ============================================================================

export function useDocumentosLicitacion(licitacionId: string | null) {
  return useQuery({
    queryKey: ['documentos-licitacion', licitacionId],
    queryFn: async (): Promise<DocumentoLicitacion[]> => {
      if (!licitacionId) return [];

      const data = await chatIaRequest('documentos_licitacion', {
        select: 'id,licitacion_id,filename,storage_path,file_size,total_pages,status,error_message,resumen_automatico,processed_at,created_at',
        licitacion_id: `eq.${licitacionId}`, order: 'created_at.asc',
      });
      if (!Array.isArray(data) || !data.every(isDocumentoLicitacion)) {
        throw new Error('La respuesta de documentos de Chat IA no es válida.');
      }
      return data;
    },
    enabled: !!licitacionId,
    refetchInterval: (query) => {
      // Poll every 3s while any document is processing
      const docs = query.state.data as DocumentoLicitacion[] | undefined;
      if (docs?.some(d => d.status === 'processing' || d.status === 'uploading')) {
        return 3000;
      }
      return false;
    },
  });
}

// ============================================================================
// UPLOAD HOOK
// ============================================================================

export function useUploadDocument(licitacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const storagePath = `${user.id}/${licitacionId}/${Date.now()}_${file.name}`;

      // 1. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('bases-licitacion')
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // 2. Create document record
      const created = await chatIaRequest('documentos_licitacion', { select: 'id' }, {
        method: 'POST', body: {
          licitacion_id: licitacionId, user_id: user.id, filename: file.name,
          storage_path: storagePath, file_size: file.size, status: 'processing',
        },
      });
      if (!Array.isArray(created) || created.length !== 1 || !isRecord(created[0]) || typeof created[0].id !== 'string') {
        throw new Error('No se pudo confirmar el documento de Chat IA.');
      }
      const doc = { id: created[0].id };

      // 3. Trigger processing edge function
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-tender-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          document_id: doc.id,
          storage_path: storagePath,
          licitacion_id: licitacionId,
        }),
      });

      if (!processResponse.ok) {
        const errData = await processResponse.json().catch(() => ({}));
        console.error('Processing error:', errData);
        // Don't throw — document is uploaded, processing just failed
        // The polling will show the error status
      }

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-licitacion', licitacionId] });
    },
    onError: (error) => {
      toast.error(`Error al subir documento: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    },
  });
}

// ============================================================================
// DELETE DOCUMENT HOOK
// ============================================================================

export function useDeleteDocument(licitacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, storagePath }: { documentId: string; storagePath: string }) => {
      // Delete from storage
      await supabase.storage.from('bases-licitacion').remove([storagePath]);

      // Delete from DB
      await chatIaRequest('documentos_licitacion', { id: `eq.${documentId}` }, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-licitacion', licitacionId] });
      toast.success('Documento eliminado');
    },
  });
}

// ============================================================================
// CHAT HOOK
// ============================================================================

export function useChatLicitacion(licitacionId: string | null) {
  return useQuery({
    queryKey: ['chat-licitacion', licitacionId],
    queryFn: async (): Promise<ChatLicitacion | null> => {
      if (!licitacionId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const data = await chatIaRequest('chat_licitacion', {
        select: 'id,licitacion_id,mensajes,created_at,updated_at',
        licitacion_id: `eq.${licitacionId}`, user_id: `eq.${user.id}`,
        order: 'updated_at.desc', limit: '1',
      });
      if (!Array.isArray(data) || data.length > 1 || !data.every(isChatLicitacion)) {
        throw new Error('La respuesta de conversación de Chat IA no es válida.');
      }
      return data[0] || null;
    },
    enabled: !!licitacionId,
  });
}

export function useSendChatMessage(licitacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ question, chatId }: { question: string; chatId?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No autenticado');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/chat-tender-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          licitacion_id: licitacionId,
          question,
          chat_id: chatId || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-licitacion', licitacionId] });
    },
    onError: (error) => {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Error al enviar mensaje'}`);
    },
  });
}

// ============================================================================
// CLEAR CHAT HOOK
// ============================================================================

export function useClearChat(licitacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (chatId: string) => {
      await chatIaRequest('chat_licitacion', { id: `eq.${chatId}` }, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-licitacion', licitacionId] });
      toast.success('Conversación eliminada');
    },
  });
}
