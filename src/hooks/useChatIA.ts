import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// ============================================================================
// DOCUMENTS HOOK
// ============================================================================

export function useDocumentosLicitacion(licitacionId: string | null) {
  return useQuery({
    queryKey: ['documentos-licitacion', licitacionId],
    queryFn: async (): Promise<DocumentoLicitacion[]> => {
      if (!licitacionId) return [];

      const { data, error } = await (supabase as any)
        .from('documentos_licitacion')
        .select('id, licitacion_id, filename, storage_path, file_size, total_pages, status, error_message, resumen_automatico, processed_at, created_at')
        .eq('licitacion_id', licitacionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
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
      const { data: doc, error: insertError } = await (supabase as any)
        .from('documentos_licitacion')
        .insert({
          licitacion_id: licitacionId,
          user_id: user.id,
          filename: file.name,
          storage_path: storagePath,
          file_size: file.size,
          status: 'processing',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

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
      const { error } = await (supabase as any)
        .from('documentos_licitacion')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
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

      const { data, error } = await (supabase as any)
        .from('chat_licitacion')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
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
      const { error } = await (supabase as any)
        .from('chat_licitacion')
        .delete()
        .eq('id', chatId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-licitacion', licitacionId] });
      toast.success('Conversación eliminada');
    },
  });
}
