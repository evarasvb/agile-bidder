import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Generate or retrieve user ID from localStorage
const getUserId = (): string => {
  const stored = localStorage.getItem('onboarding_user_id');
  if (stored) return stored;
  
  const newId = crypto.randomUUID();
  localStorage.setItem('onboarding_user_id', newId);
  return newId;
};

export interface UserPreferences {
  id?: string;
  user_id: string;
  company_name?: string;
  onboarding_completed: boolean;
  onboarding_step: number;
}

export interface UserCategory {
  id?: string;
  user_id: string;
  category_id: string;
  category_name: string;
}

export interface UserRegion {
  id?: string;
  user_id: string;
  region_code: string;
  region_name: string;
}

export interface UserNotifications {
  id?: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  notification_frequency: 'immediate' | 'daily' | 'weekly';
}

export const PRODUCT_CATEGORIES = [
  { id: 'medical', name: 'Insumos Médicos', icon: '🏥' },
  { id: 'office', name: 'Material de Oficina', icon: '📎' },
  { id: 'tech', name: 'Equipos Tecnológicos', icon: '💻' },
  { id: 'food', name: 'Alimentos y Bebidas', icon: '🍎' },
  { id: 'cleaning', name: 'Servicios de Limpieza', icon: '🧹' },
  { id: 'construction', name: 'Construcción y Ferretería', icon: '🔨' },
  { id: 'furniture', name: 'Mobiliario', icon: '🪑' },
  { id: 'vehicles', name: 'Vehículos y Transporte', icon: '🚗' },
  { id: 'textiles', name: 'Textiles y Vestuario', icon: '👔' },
  { id: 'chemicals', name: 'Químicos y Laboratorio', icon: '🧪' },
  { id: 'security', name: 'Seguridad', icon: '🔒' },
  { id: 'software', name: 'Software y Licencias', icon: '📀' },
];

export const CHILE_REGIONS = [
  { code: 'XV', name: 'Arica y Parinacota' },
  { code: 'I', name: 'Tarapacá' },
  { code: 'II', name: 'Antofagasta' },
  { code: 'III', name: 'Atacama' },
  { code: 'IV', name: 'Coquimbo' },
  { code: 'V', name: 'Valparaíso' },
  { code: 'RM', name: 'Metropolitana' },
  { code: 'VI', name: "O'Higgins" },
  { code: 'VII', name: 'Maule' },
  { code: 'XVI', name: 'Ñuble' },
  { code: 'VIII', name: 'Biobío' },
  { code: 'IX', name: 'La Araucanía' },
  { code: 'XIV', name: 'Los Ríos' },
  { code: 'X', name: 'Los Lagos' },
  { code: 'XI', name: 'Aysén' },
  { code: 'XII', name: 'Magallanes' },
];

export function useOnboarding() {
  const userId = getUserId();
  const { toast } = useToast();
  
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [regions, setRegions] = useState<UserRegion[]>([]);
  const [notifications, setNotifications] = useState<UserNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load initial data
  useEffect(() => {
    loadOnboardingData();
  }, []);

  const loadOnboardingData = async () => {
    setLoading(true);
    try {
      // Load preferences
      const { data: prefData } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (prefData) {
        setPreferences(prefData as UserPreferences);
      } else {
        // Create initial preferences
        const newPref: UserPreferences = {
          user_id: userId,
          onboarding_completed: false,
          onboarding_step: 1,
        };
        const { data: created } = await supabase
          .from('user_preferences')
          .insert(newPref)
          .select()
          .single();
        if (created) setPreferences(created as UserPreferences);
      }

      // Load categories
      const { data: catData } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', userId);
      if (catData) setCategories(catData as UserCategory[]);

      // Load regions
      const { data: regData } = await supabase
        .from('user_regions')
        .select('*')
        .eq('user_id', userId);
      if (regData) setRegions(regData as UserRegion[]);

      // Load notifications
      const { data: notifData } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (notifData) {
        setNotifications(notifData as UserNotifications);
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStep = useCallback(async (step: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_step: step })
        .eq('user_id', userId);
      
      if (!error) {
        setPreferences(prev => prev ? { ...prev, onboarding_step: step } : null);
      }
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const updateCompanyName = useCallback(async (companyName: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ company_name: companyName })
        .eq('user_id', userId);
      
      if (!error) {
        setPreferences(prev => prev ? { ...prev, company_name: companyName } : null);
      }
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const toggleCategory = useCallback(async (categoryId: string, categoryName: string) => {
    setSaving(true);
    const exists = categories.find(c => c.category_id === categoryId);
    
    try {
      if (exists) {
        await supabase
          .from('user_categories')
          .delete()
          .eq('user_id', userId)
          .eq('category_id', categoryId);
        setCategories(prev => prev.filter(c => c.category_id !== categoryId));
      } else {
        const { data } = await supabase
          .from('user_categories')
          .insert({ user_id: userId, category_id: categoryId, category_name: categoryName })
          .select()
          .single();
        if (data) setCategories(prev => [...prev, data as UserCategory]);
      }
    } finally {
      setSaving(false);
    }
  }, [userId, categories]);

  const toggleRegion = useCallback(async (regionCode: string, regionName: string) => {
    setSaving(true);
    const exists = regions.find(r => r.region_code === regionCode);
    
    try {
      if (exists) {
        await supabase
          .from('user_regions')
          .delete()
          .eq('user_id', userId)
          .eq('region_code', regionCode);
        setRegions(prev => prev.filter(r => r.region_code !== regionCode));
      } else {
        const { data } = await supabase
          .from('user_regions')
          .insert({ user_id: userId, region_code: regionCode, region_name: regionName })
          .select()
          .single();
        if (data) setRegions(prev => [...prev, data as UserRegion]);
      }
    } finally {
      setSaving(false);
    }
  }, [userId, regions]);

  const selectAllRegions = useCallback(async () => {
    setSaving(true);
    try {
      // Delete existing
      await supabase
        .from('user_regions')
        .delete()
        .eq('user_id', userId);
      
      // Insert all
      const allRegions = CHILE_REGIONS.map(r => ({
        user_id: userId,
        region_code: r.code,
        region_name: r.name,
      }));
      
      const { data } = await supabase
        .from('user_regions')
        .insert(allRegions)
        .select();
      
      if (data) setRegions(data as UserRegion[]);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const clearAllRegions = useCallback(async () => {
    setSaving(true);
    try {
      await supabase
        .from('user_regions')
        .delete()
        .eq('user_id', userId);
      setRegions([]);
    } finally {
      setSaving(false);
    }
  }, [userId]);

  const updateNotifications = useCallback(async (notifSettings: Partial<UserNotifications>) => {
    setSaving(true);
    try {
      if (notifications) {
        const { error } = await supabase
          .from('user_notifications')
          .update(notifSettings)
          .eq('user_id', userId);
        if (!error) {
          setNotifications(prev => prev ? { ...prev, ...notifSettings } : null);
        }
      } else {
        const newNotif = {
          user_id: userId,
          email_notifications: true,
          push_notifications: false,
          notification_frequency: 'daily' as const,
          ...notifSettings,
        };
        const { data } = await supabase
          .from('user_notifications')
          .insert(newNotif)
          .select()
          .single();
        if (data) setNotifications(data as UserNotifications);
      }
    } finally {
      setSaving(false);
    }
  }, [userId, notifications]);

  const completeOnboarding = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_completed: true })
        .eq('user_id', userId);
      
      if (!error) {
        setPreferences(prev => prev ? { ...prev, onboarding_completed: true } : null);
        toast({
          title: "¡Configuración completada!",
          description: "Tus preferencias han sido guardadas exitosamente.",
        });
        return true;
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId, toast]);

  return {
    userId,
    preferences,
    categories,
    regions,
    notifications,
    loading,
    saving,
    updateStep,
    updateCompanyName,
    toggleCategory,
    toggleRegion,
    selectAllRegions,
    clearAllRegions,
    updateNotifications,
    completeOnboarding,
    PRODUCT_CATEGORIES,
    CHILE_REGIONS,
  };
}
