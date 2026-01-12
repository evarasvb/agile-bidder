import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';

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
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [regions, setRegions] = useState<UserRegion[]>([]);
  const [notifications, setNotifications] = useState<UserNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load onboarding data when user is authenticated
  useEffect(() => {
    if (user) {
      loadOnboardingData(user.id);
    } else {
      setLoading(false);
      setPreferences(null);
      setCategories([]);
      setRegions([]);
      setNotifications(null);
    }
  }, [user]);

  const loadOnboardingData = async (userId: string) => {
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
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_step: step })
        .eq('user_id', user.id);
      
      if (!error) {
        setPreferences(prev => prev ? { ...prev, onboarding_step: step } : null);
      }
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateCompanyName = useCallback(async (companyName: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ company_name: companyName })
        .eq('user_id', user.id);
      
      if (!error) {
        setPreferences(prev => prev ? { ...prev, company_name: companyName } : null);
      }
    } finally {
      setSaving(false);
    }
  }, [user]);

  const toggleCategory = useCallback(async (categoryId: string, categoryName: string) => {
    if (!user) return;
    setSaving(true);
    const exists = categories.find(c => c.category_id === categoryId);
    
    try {
      if (exists) {
        await supabase
          .from('user_categories')
          .delete()
          .eq('user_id', user.id)
          .eq('category_id', categoryId);
        setCategories(prev => prev.filter(c => c.category_id !== categoryId));
      } else {
        const { data } = await supabase
          .from('user_categories')
          .insert({ user_id: user.id, category_id: categoryId, category_name: categoryName })
          .select()
          .single();
        if (data) setCategories(prev => [...prev, data as UserCategory]);
      }
    } finally {
      setSaving(false);
    }
  }, [user, categories]);

  const toggleRegion = useCallback(async (regionCode: string, regionName: string) => {
    if (!user) return;
    setSaving(true);
    const exists = regions.find(r => r.region_code === regionCode);
    
    try {
      if (exists) {
        await supabase
          .from('user_regions')
          .delete()
          .eq('user_id', user.id)
          .eq('region_code', regionCode);
        setRegions(prev => prev.filter(r => r.region_code !== regionCode));
      } else {
        const { data } = await supabase
          .from('user_regions')
          .insert({ user_id: user.id, region_code: regionCode, region_name: regionName })
          .select()
          .single();
        if (data) setRegions(prev => [...prev, data as UserRegion]);
      }
    } finally {
      setSaving(false);
    }
  }, [user, regions]);

  const selectAllRegions = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Delete existing
      await supabase
        .from('user_regions')
        .delete()
        .eq('user_id', user.id);
      
      // Insert all
      const allRegions = CHILE_REGIONS.map(r => ({
        user_id: user.id,
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
  }, [user]);

  const clearAllRegions = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from('user_regions')
        .delete()
        .eq('user_id', user.id);
      setRegions([]);
    } finally {
      setSaving(false);
    }
  }, [user]);

  const updateNotifications = useCallback(async (notifSettings: Partial<UserNotifications>) => {
    if (!user) return;
    setSaving(true);
    try {
      if (notifications) {
        const { error } = await supabase
          .from('user_notifications')
          .update(notifSettings)
          .eq('user_id', user.id);
        if (!error) {
          setNotifications(prev => prev ? { ...prev, ...notifSettings } : null);
        }
      } else {
        const newNotif = {
          user_id: user.id,
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
  }, [user, notifications]);

  const completeOnboarding = useCallback(async () => {
    if (!user) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id);
      
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
  }, [user, toast]);

  return {
    user,
    userId: user?.id,
    isAuthenticated: !!user,
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
