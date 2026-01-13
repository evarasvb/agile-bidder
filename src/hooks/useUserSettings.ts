import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Types for settings
export interface CompanySettings {
  rut: string;
  razonSocial: string;
  codigoOrganismo: string;
  emailContacto: string;
}

export interface BiddingSettings {
  montoMaximoUTM: number;
  margenMinimoGlobal: number;
}

export interface DeliverySettings {
  plazoEntrega: string;
  tipoDespacho: string;
}

export interface AutomationSettings {
  autoMatch: boolean;
  autoBid: boolean;
}

export interface UserSettings {
  id?: string;
  user_id?: string;
  company_settings: CompanySettings;
  bidding_settings: BiddingSettings;
  delivery_settings: DeliverySettings;
  automation_settings: AutomationSettings;
  regions: string[];
  api_key_encrypted: string | null;
  api_key_connected: boolean;
}

export const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'user_id'> = {
  company_settings: {
    rut: '',
    razonSocial: '',
    codigoOrganismo: '',
    emailContacto: '',
  },
  bidding_settings: {
    montoMaximoUTM: 30,
    margenMinimoGlobal: 10,
  },
  delivery_settings: {
    plazoEntrega: '24',
    tipoDespacho: 'delivery',
  },
  automation_settings: {
    autoMatch: true,
    autoBid: false,
  },
  regions: ['Metropolitana', 'Valparaíso'],
  api_key_encrypted: null,
  api_key_connected: false,
};

export function useUserSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async (): Promise<UserSettings> => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        throw error;
      }

      // If no settings exist, return defaults
      if (!data) {
        return { ...DEFAULT_SETTINGS };
      }

      // Map database fields to our interface with proper type casting
      return {
        id: data.id,
        user_id: data.user_id,
        company_settings: (data.company_settings as unknown as CompanySettings) || DEFAULT_SETTINGS.company_settings,
        bidding_settings: (data.bidding_settings as unknown as BiddingSettings) || DEFAULT_SETTINGS.bidding_settings,
        delivery_settings: (data.delivery_settings as unknown as DeliverySettings) || DEFAULT_SETTINGS.delivery_settings,
        automation_settings: (data.automation_settings as unknown as AutomationSettings) || DEFAULT_SETTINGS.automation_settings,
        regions: data.regions || DEFAULT_SETTINGS.regions,
        api_key_encrypted: data.api_key_encrypted,
        api_key_connected: data.api_key_connected || false,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSaveUserSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: Omit<UserSettings, 'id' | 'user_id'>) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Check if settings already exist
      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Cast settings to JSON-compatible format for Supabase
      const settingsData = {
        user_id: user.id,
        company_settings: JSON.parse(JSON.stringify(settings.company_settings)),
        bidding_settings: JSON.parse(JSON.stringify(settings.bidding_settings)),
        delivery_settings: JSON.parse(JSON.stringify(settings.delivery_settings)),
        automation_settings: JSON.parse(JSON.stringify(settings.automation_settings)),
        regions: settings.regions,
        api_key_encrypted: settings.api_key_encrypted,
        api_key_connected: settings.api_key_connected,
      };

      if (existing) {
        // Update existing settings
        const { error } = await supabase
          .from('user_settings')
          .update(settingsData)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new settings
        const { error } = await supabase
          .from('user_settings')
          .insert([settingsData]);

        if (error) throw error;
      }

      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-settings', user?.id] });
      toast.success('Configuración guardada correctamente');
    },
    onError: (error: Error) => {
      console.error('Error saving settings:', error);
      toast.error(`Error al guardar: ${error.message}`);
    },
  });
}
