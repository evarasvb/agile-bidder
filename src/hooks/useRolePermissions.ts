import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'super_admin' | 'admin' | 'user' | 'vendedor' | 'visor';

export interface RolePermission {
  id: string;
  role: AppRole;
  section_key: string;
  section_name: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserPermissions {
  role: AppRole | null;
  permissions: RolePermission[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isVendedor: boolean;
  isVisor: boolean;
}

export function useRolePermissions() {
  const { user, isAuthenticated } = useAuth();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setUserRole(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Obtener el rol del usuario
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (roleError) {
          console.error('Error fetching user role:', roleError);
          setLoading(false);
          return;
        }

        const role = roleData?.role as AppRole | null;
        setUserRole(role);

        if (role) {
          // Obtener los permisos para ese rol
          const { data: permData, error: permError } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role', role);

          if (permError) {
            console.error('Error fetching permissions:', permError);
          } else {
            setPermissions(permData as RolePermission[] || []);
          }
        }
      } catch (error) {
        console.error('Error in fetchPermissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user, isAuthenticated]);

  const canViewSection = useCallback((sectionKey: string): boolean => {
    if (userRole === 'super_admin') return true;
    const permission = permissions.find(p => p.section_key === sectionKey);
    return permission?.can_view ?? false;
  }, [permissions, userRole]);

  const canEditSection = useCallback((sectionKey: string): boolean => {
    if (userRole === 'super_admin') return true;
    const permission = permissions.find(p => p.section_key === sectionKey);
    return permission?.can_edit ?? false;
  }, [permissions, userRole]);

  const canDeleteSection = useCallback((sectionKey: string): boolean => {
    if (userRole === 'super_admin') return true;
    const permission = permissions.find(p => p.section_key === sectionKey);
    return permission?.can_delete ?? false;
  }, [permissions, userRole]);

  const updatePermission = async (permissionId: string, updates: Partial<RolePermission>) => {
    const { error } = await supabase
      .from('role_permissions')
      .update(updates)
      .eq('id', permissionId);

    if (!error) {
      setPermissions(prev => 
        prev.map(p => p.id === permissionId ? { ...p, ...updates } : p)
      );
    }

    return { error };
  };

  const getAllPermissions = async () => {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role', { ascending: true })
      .order('section_key', { ascending: true });

    return { data: data as RolePermission[] | null, error };
  };

  return {
    userRole,
    permissions,
    loading,
    canViewSection,
    canEditSection,
    canDeleteSection,
    updatePermission,
    getAllPermissions,
    isSuperAdmin: userRole === 'super_admin',
    isAdmin: userRole === 'admin' || userRole === 'super_admin',
    isVendedor: userRole === 'vendedor',
    isVisor: userRole === 'visor',
  };
}
