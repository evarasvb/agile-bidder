import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ImportHistoryRecord {
  id: string;
  created_at: string;
  file_name: string;
  file_type: 'xlsx' | 'xls' | 'csv';
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  error_count: number;
  status: 'completed' | 'partial' | 'failed';
  errors: any[];
  imported_by: string | null;
}

export interface CreateImportHistoryParams {
  file_name: string;
  file_type: 'xlsx' | 'xls' | 'csv';
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  error_count: number;
  status: 'completed' | 'partial' | 'failed';
  errors?: any[];
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['import-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ImportHistoryRecord[];
    }
  });
}

export function useCreateImportHistory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: CreateImportHistoryParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('import_history')
        .insert({
          file_name: params.file_name,
          file_type: params.file_type,
          total_rows: params.total_rows,
          inserted_count: params.inserted_count,
          updated_count: params.updated_count,
          error_count: params.error_count,
          status: params.status,
          errors: params.errors || [],
          imported_by: user?.id || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ImportHistoryRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    }
  });
}
