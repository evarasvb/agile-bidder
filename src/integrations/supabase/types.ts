export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cliente_exclusiones: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          tipo_exclusion: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          tipo_exclusion: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          tipo_exclusion?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_exclusiones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_inventario: {
        Row: {
          activo: boolean | null
          categoria: string | null
          cliente_id: string
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          margen_minimo: number | null
          nombre: string
          palabras_clave: string[] | null
          precio_unitario: number
          sku: string
          stock: number | null
          tiempo_entrega_dias: number | null
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          categoria?: string | null
          cliente_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          margen_minimo?: number | null
          nombre: string
          palabras_clave?: string[] | null
          precio_unitario?: number
          sku: string
          stock?: number | null
          tiempo_entrega_dias?: number | null
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          categoria?: string | null
          cliente_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          margen_minimo?: number | null
          nombre?: string
          palabras_clave?: string[] | null
          precio_unitario?: number
          sku?: string
          stock?: number | null
          tiempo_entrega_dias?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_inventario_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_notificaciones: {
        Row: {
          alerta_cambios_guardadas: boolean | null
          alerta_cierre_proximo: boolean | null
          alerta_nuevos_matches: boolean | null
          cliente_id: string
          created_at: string
          email_instantaneo: boolean | null
          horas_antes_cierre: number | null
          id: string
          presupuesto_minimo: number | null
          push_notifications: boolean | null
          resumen_diario: boolean | null
          resumen_semanal: boolean | null
          score_minimo_alerta: number | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          alerta_cambios_guardadas?: boolean | null
          alerta_cierre_proximo?: boolean | null
          alerta_nuevos_matches?: boolean | null
          cliente_id: string
          created_at?: string
          email_instantaneo?: boolean | null
          horas_antes_cierre?: number | null
          id?: string
          presupuesto_minimo?: number | null
          push_notifications?: boolean | null
          resumen_diario?: boolean | null
          resumen_semanal?: boolean | null
          score_minimo_alerta?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          alerta_cambios_guardadas?: boolean | null
          alerta_cierre_proximo?: boolean | null
          alerta_nuevos_matches?: boolean | null
          cliente_id?: string
          created_at?: string
          email_instantaneo?: boolean | null
          horas_antes_cierre?: number | null
          id?: string
          presupuesto_minimo?: number | null
          push_notifications?: boolean | null
          resumen_diario?: boolean | null
          resumen_semanal?: boolean | null
          score_minimo_alerta?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_notificaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_ofertas: {
        Row: {
          cliente_id: string
          created_at: string
          estado: string | null
          id: string
          licitacion_id: string
          margen_total: number | null
          match_score: number | null
          notas: string | null
          productos_ofertados: Json | null
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          estado?: string | null
          id?: string
          licitacion_id: string
          margen_total?: number | null
          match_score?: number | null
          notas?: string | null
          productos_ofertados?: Json | null
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          estado?: string | null
          id?: string
          licitacion_id?: string
          margen_total?: number | null
          match_score?: number | null
          notas?: string | null
          productos_ofertados?: Json | null
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_ofertas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean | null
          categoria_negocio: string | null
          created_at: string
          email: string
          empresa_nombre: string
          id: string
          nombre_responsable: string
          odoo_db: string | null
          odoo_enabled: boolean | null
          odoo_url: string | null
          onboarding_completado: boolean | null
          onboarding_step: number | null
          plan: string | null
          region: string
          rut: string
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria_negocio?: string | null
          created_at?: string
          email: string
          empresa_nombre: string
          id?: string
          nombre_responsable: string
          odoo_db?: string | null
          odoo_enabled?: boolean | null
          odoo_url?: string | null
          onboarding_completado?: boolean | null
          onboarding_step?: number | null
          plan?: string | null
          region: string
          rut: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria_negocio?: string | null
          created_at?: string
          email?: string
          empresa_nombre?: string
          id?: string
          nombre_responsable?: string
          odoo_db?: string | null
          odoo_enabled?: boolean | null
          odoo_url?: string | null
          onboarding_completado?: boolean | null
          onboarding_step?: number | null
          plan?: string | null
          region?: string
          rut?: string
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      extension_activity_log: {
        Row: {
          action: string
          api_key_id: string | null
          cliente_id: string
          created_at: string
          detalles: Json | null
          id: string
          ip_address: string | null
          licitacion_id: string | null
          oferta_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          api_key_id?: string | null
          cliente_id: string
          created_at?: string
          detalles?: Json | null
          id?: string
          ip_address?: string | null
          licitacion_id?: string | null
          oferta_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          api_key_id?: string | null
          cliente_id?: string
          created_at?: string
          detalles?: Json | null
          id?: string
          ip_address?: string | null
          licitacion_id?: string | null
          oferta_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extension_activity_log_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "extension_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_activity_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_api_keys: {
        Row: {
          activa: boolean
          api_key: string
          cliente_id: string
          created_at: string
          id: string
          last_used: string | null
          nombre: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          api_key: string
          cliente_id: string
          created_at?: string
          id?: string
          last_used?: string | null
          nombre?: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          api_key?: string
          cliente_id?: string
          created_at?: string
          id?: string
          last_used?: string | null
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_api_keys_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          keywords: string[] | null
          margen_minimo: number
          margen_objetivo: number
          nombre_producto: string
          precio_unitario: number
          proveedor: string | null
          sku: string
          stock_disponible: number
          tiempo_entrega_dias: number
          unidad_medida: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          keywords?: string[] | null
          margen_minimo?: number
          margen_objetivo?: number
          nombre_producto: string
          precio_unitario?: number
          proveedor?: string | null
          sku: string
          stock_disponible?: number
          tiempo_entrega_dias?: number
          unidad_medida?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          keywords?: string[] | null
          margen_minimo?: number
          margen_objetivo?: number
          nombre_producto?: string
          precio_unitario?: number
          proveedor?: string | null
          sku?: string
          stock_disponible?: number
          tiempo_entrega_dias?: number
          unidad_medida?: string
          updated_at?: string
        }
        Relationships: []
      }
      licitacion_items: {
        Row: {
          cantidad: number | null
          descripcion: string | null
          id: number
          licitacion_id: string
          nombre_producto: string
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          descripcion?: string | null
          id?: number
          licitacion_id: string
          nombre_producto: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          descripcion?: string | null
          id?: number
          licitacion_id?: string
          nombre_producto?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacion_items_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones"
            referencedColumns: ["id_licitacion"]
          },
        ]
      }
      licitaciones: {
        Row: {
          created_at: string
          estado: string | null
          fecha_cierre: string | null
          id_licitacion: string
          link_oficial: string | null
          match_encontrado: boolean
          match_score: number | null
          organismo: string
          presupuesto: number | null
          procesada: boolean
          titulo: string
        }
        Insert: {
          created_at?: string
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion: string
          link_oficial?: string | null
          match_encontrado?: boolean
          match_score?: number | null
          organismo: string
          presupuesto?: number | null
          procesada?: boolean
          titulo: string
        }
        Update: {
          created_at?: string
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion?: string
          link_oficial?: string | null
          match_encontrado?: boolean
          match_score?: number | null
          organismo?: string
          presupuesto?: number | null
          procesada?: boolean
          titulo?: string
        }
        Relationships: []
      }
      notificaciones_log: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          datos: Json | null
          email_enviado: boolean | null
          id: string
          licitacion_id: string | null
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          datos?: Json | null
          email_enviado?: boolean | null
          id?: string
          licitacion_id?: string | null
          tipo: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          datos?: Json | null
          email_enviado?: boolean | null
          id?: string
          licitacion_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_log_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      ofertas: {
        Row: {
          created_at: string
          created_by: string | null
          documento_oferta_url: string | null
          estado: string
          fecha_envio: string | null
          id: string
          licitacion_id: string
          margen_total: number
          match_score: number | null
          notas_internas: string | null
          productos_ofertados: Json
          respuesta_mp: Json | null
          updated_at: string
          valor_total_oferta: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          documento_oferta_url?: string | null
          estado?: string
          fecha_envio?: string | null
          id?: string
          licitacion_id: string
          margen_total?: number
          match_score?: number | null
          notas_internas?: string | null
          productos_ofertados?: Json
          respuesta_mp?: Json | null
          updated_at?: string
          valor_total_oferta?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          documento_oferta_url?: string | null
          estado?: string
          fecha_envio?: string | null
          id?: string
          licitacion_id?: string
          margen_total?: number
          match_score?: number | null
          notas_internas?: string | null
          productos_ofertados?: Json
          respuesta_mp?: Json | null
          updated_at?: string
          valor_total_oferta?: number
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones"
            referencedColumns: ["id_licitacion"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          detalles: Json | null
          id: string
          licitacion_id: string | null
          mensaje: string
          oferta_id: string | null
          severidad: string
          tipo: string
        }
        Insert: {
          created_at?: string
          detalles?: Json | null
          id?: string
          licitacion_id?: string | null
          mensaje: string
          oferta_id?: string | null
          severidad?: string
          tipo: string
        }
        Update: {
          created_at?: string
          detalles?: Json | null
          id?: string
          licitacion_id?: string | null
          mensaje?: string
          oferta_id?: string | null
          severidad?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_categories: {
        Row: {
          category_id: string
          category_name: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          category_name: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          category_name?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          notification_frequency: Database["public"]["Enums"]["notification_frequency"]
          push_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"]
          push_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          notification_frequency?: Database["public"]["Enums"]["notification_frequency"]
          push_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          onboarding_completed: boolean
          onboarding_step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          onboarding_completed?: boolean
          onboarding_step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_regions: {
        Row: {
          created_at: string
          id: string
          region_code: string
          region_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          region_code: string
          region_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          region_code?: string
          region_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      notification_frequency: "immediate" | "daily" | "weekly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      notification_frequency: ["immediate", "daily", "weekly"],
    },
  },
} as const
