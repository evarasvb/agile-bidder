import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type AppRole = 'super_admin' | 'admin' | 'user' | 'vendedor' | 'visor';

interface UserRole {
  role: AppRole;
}

export function useProfile() {
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setProfile(null);
      setRoles([]);
      setPrimaryRole(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        } else {
          setProfile(profileData);
        }

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else {
          const typedRoles = (rolesData || []) as UserRole[];
          setRoles(typedRoles);
          
          // Determinar el rol principal (el de mayor jerarquía)
          const roleHierarchy: AppRole[] = ['super_admin', 'admin', 'user', 'vendedor', 'visor'];
          const userRoles = typedRoles.map(r => r.role);
          const primary = roleHierarchy.find(r => userRoles.includes(r)) || null;
          setPrimaryRole(primary);
          
          setIsSuperAdmin(userRoles.includes('super_admin'));
          setIsAdmin(userRoles.includes('admin') || userRoles.includes('super_admin'));
        }
      } catch (error) {
        console.error('Error in fetchProfile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, isAuthenticated]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  return {
    profile,
    roles,
    primaryRole,
    isAdmin,
    isSuperAdmin,
    loading,
    updateProfile,
  };
}
