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
      auto_bid_items: {
        Row: {
          activo: boolean | null
          bids_ganados: number | null
          created_at: string | null
          dashboard_id: string | null
          id: string
          margen_objetivo: number | null
          nombre_producto: string
          precio_maximo: number | null
          precio_minimo: number | null
          producto_id: string | null
          total_bids: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          bids_ganados?: number | null
          created_at?: string | null
          dashboard_id?: string | null
          id?: string
          margen_objetivo?: number | null
          nombre_producto: string
          precio_maximo?: number | null
          precio_minimo?: number | null
          producto_id?: string | null
          total_bids?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          bids_ganados?: number | null
          created_at?: string | null
          dashboard_id?: string | null
          id?: string
          margen_objetivo?: number | null
          nombre_producto?: string
          precio_maximo?: number | null
          precio_minimo?: number | null
          producto_id?: string | null
          total_bids?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_bid_items_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "auto_bids_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_bids_dashboard: {
        Row: {
          activo: boolean | null
          configuracion: Json | null
          created_at: string | null
          id: string
          monto_total_ganado: number | null
          tasa_exito: number | null
          total_bids_enviados: number | null
          total_bids_ganados: number | null
          ultimo_bid_fecha: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          configuracion?: Json | null
          created_at?: string | null
          id?: string
          monto_total_ganado?: number | null
          tasa_exito?: number | null
          total_bids_enviados?: number | null
          total_bids_ganados?: number | null
          ultimo_bid_fecha?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          configuracion?: Json | null
          created_at?: string | null
          id?: string
          monto_total_ganado?: number | null
          tasa_exito?: number | null
          total_bids_enviados?: number | null
          total_bids_ganados?: number | null
          ultimo_bid_fecha?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
          user_id: string
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
          user_id: string
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
          user_id?: string
        }
        Relationships: []
      }
      compras_agiles: {
        Row: {
          codigo: string
          created_at: string
          datos_json: Json | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          id: string
          link_oficial: string | null
          match_encontrado: boolean | null
          match_score: number | null
          monto: number | null
          nombre: string
          organismo: string
          region: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          datos_json?: Json | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          link_oficial?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          monto?: number | null
          nombre: string
          organismo: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          datos_json?: Json | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          link_oficial?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          monto?: number | null
          nombre?: string
          organismo?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      compras_agiles_items: {
        Row: {
          cantidad: number | null
          categoria: string | null
          codigo_compra: string | null
          codigo_producto: string | null
          compra_agil_id: string | null
          created_at: string | null
          descripcion: string | null
          id: string
          nombre_producto: string
          precio_unitario: number | null
          total: number | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          categoria?: string | null
          codigo_compra?: string | null
          codigo_producto?: string | null
          compra_agil_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre_producto: string
          precio_unitario?: number | null
          total?: number | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          categoria?: string | null
          codigo_compra?: string | null
          codigo_producto?: string | null
          compra_agil_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre_producto?: string
          precio_unitario?: number | null
          total?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_agiles_items_compra_agil_id_fkey"
            columns: ["compra_agil_id"]
            isOneToOne: false
            referencedRelation: "compras_agiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conducta_pago: {
        Row: {
          id: string
          institucion_id: string | null
          monto_pendiente: number | null
          ordenes_pagadas_a_tiempo: number | null
          ordenes_pagadas_tardias: number | null
          promedio_dias_pago: number | null
          score_pago: number | null
          ultima_actualizacion: string | null
        }
        Insert: {
          id?: string
          institucion_id?: string | null
          monto_pendiente?: number | null
          ordenes_pagadas_a_tiempo?: number | null
          ordenes_pagadas_tardias?: number | null
          promedio_dias_pago?: number | null
          score_pago?: number | null
          ultima_actualizacion?: string | null
        }
        Update: {
          id?: string
          institucion_id?: string | null
          monto_pendiente?: number | null
          ordenes_pagadas_a_tiempo?: number | null
          ordenes_pagadas_tardias?: number | null
          promedio_dias_pago?: number | null
          score_pago?: number | null
          ultima_actualizacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conducta_pago_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_billing: {
        Row: {
          comision_porcentaje: number
          created_at: string
          direccion_facturacion: string | null
          email_facturacion: string | null
          id: string
          nombre_empresa: string | null
          plan: string
          rut_empresa: string | null
          tarjeta_expiracion: string | null
          tarjeta_marca: string | null
          tarjeta_ultimos_4: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comision_porcentaje?: number
          created_at?: string
          direccion_facturacion?: string | null
          email_facturacion?: string | null
          id?: string
          nombre_empresa?: string | null
          plan?: string
          rut_empresa?: string | null
          tarjeta_expiracion?: string | null
          tarjeta_marca?: string | null
          tarjeta_ultimos_4?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comision_porcentaje?: number
          created_at?: string
          direccion_facturacion?: string | null
          email_facturacion?: string | null
          id?: string
          nombre_empresa?: string | null
          plan?: string
          rut_empresa?: string | null
          tarjeta_expiracion?: string | null
          tarjeta_marca?: string | null
          tarjeta_ultimos_4?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      evaristo_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          mision_file: string | null
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          mision_file?: string | null
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          mision_file?: string | null
          result?: Json | null
          status?: string
          user_id?: string
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
          api_key_hash: string | null
          api_key_prefix: string | null
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
          api_key_hash?: string | null
          api_key_prefix?: string | null
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
          api_key_hash?: string | null
          api_key_prefix?: string | null
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
      facturas_comision: {
        Row: {
          created_at: string
          documento_url: string | null
          estado: string
          fecha_emision: string
          fecha_pago: string | null
          fecha_vencimiento: string | null
          id: string
          metodo_pago: string | null
          numero_factura: string
          periodo: string
          total_comision: number
          total_ventas: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          documento_url?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago?: string | null
          numero_factura: string
          periodo: string
          total_comision?: number
          total_ventas?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          documento_url?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          id?: string
          metodo_pago?: string | null
          numero_factura?: string
          periodo?: string
          total_comision?: number
          total_ventas?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          created_at: string
          error_count: number
          errors: Json | null
          file_name: string
          file_type: string
          id: string
          imported_by: string | null
          inserted_count: number
          status: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          created_at?: string
          error_count?: number
          errors?: Json | null
          file_name: string
          file_type: string
          id?: string
          imported_by?: string | null
          inserted_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          created_at?: string
          error_count?: number
          errors?: Json | null
          file_name?: string
          file_type?: string
          id?: string
          imported_by?: string | null
          inserted_count?: number
          status?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: []
      }
      instituciones: {
        Row: {
          codigo: string | null
          comuna: string | null
          created_at: string
          direccion: string | null
          id: string
          monto_total_compras: number | null
          nombre: string
          region: string | null
          rut: string
          sector: string | null
          tipo: string | null
          total_licitaciones: number | null
          total_ordenes: number | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          monto_total_compras?: number | null
          nombre: string
          region?: string | null
          rut: string
          sector?: string | null
          tipo?: string | null
          total_licitaciones?: number | null
          total_ordenes?: number | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          monto_total_compras?: number | null
          nombre?: string
          region?: string | null
          rut?: string
          sector?: string | null
          tipo?: string | null
          total_licitaciones?: number | null
          total_ordenes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      instituciones_dashboard: {
        Row: {
          categoria_gasto: string | null
          id: string
          institucion_id: string | null
          monto_total_compras: number | null
          promedio_por_compra: number | null
          score_oportunidad: number | null
          tendencia_compras: string | null
          total_compras: number | null
          ultima_compra_fecha: string | null
          updated_at: string | null
        }
        Insert: {
          categoria_gasto?: string | null
          id?: string
          institucion_id?: string | null
          monto_total_compras?: number | null
          promedio_por_compra?: number | null
          score_oportunidad?: number | null
          tendencia_compras?: string | null
          total_compras?: number | null
          ultima_compra_fecha?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria_gasto?: string | null
          id?: string
          institucion_id?: string | null
          monto_total_compras?: number | null
          promedio_por_compra?: number | null
          score_oportunidad?: number | null
          tendencia_compras?: string | null
          total_compras?: number | null
          ultima_compra_fecha?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instituciones_dashboard_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      instituciones_gestion: {
        Row: {
          created_at: string | null
          estado_gestion: string | null
          fecha_ultimo_contacto: string | null
          id: string
          institucion_id: string | null
          notas: string | null
          prioridad: number | null
          proximo_seguimiento: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          estado_gestion?: string | null
          fecha_ultimo_contacto?: string | null
          id?: string
          institucion_id?: string | null
          notas?: string | null
          prioridad?: number | null
          proximo_seguimiento?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          estado_gestion?: string | null
          fecha_ultimo_contacto?: string | null
          id?: string
          institucion_id?: string | null
          notas?: string | null
          prioridad?: number | null
          proximo_seguimiento?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instituciones_gestion_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
        ]
      }
      instituciones_interacciones: {
        Row: {
          created_at: string | null
          descripcion: string | null
          fecha_interaccion: string | null
          gestion_id: string | null
          id: string
          institucion_id: string | null
          resultado: string | null
          tipo_interaccion: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          fecha_interaccion?: string | null
          gestion_id?: string | null
          id?: string
          institucion_id?: string | null
          resultado?: string | null
          tipo_interaccion: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          fecha_interaccion?: string | null
          gestion_id?: string | null
          id?: string
          institucion_id?: string | null
          resultado?: string | null
          tipo_interaccion?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instituciones_interacciones_gestion_id_fkey"
            columns: ["gestion_id"]
            isOneToOne: false
            referencedRelation: "instituciones_gestion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instituciones_interacciones_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
          {
            foreignKeyName: "licitacion_items_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_con_match"
            referencedColumns: ["id_licitacion"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_urgentes"
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
      licitaciones_adjudicaciones: {
        Row: {
          created_at: string
          fecha_adjudicacion: string | null
          id: string
          licitacion_id: string
          moneda: string | null
          monto_adjudicado: number | null
          proveedor_codigo: string | null
          proveedor_nombre: string | null
          proveedor_rut: string | null
        }
        Insert: {
          created_at?: string
          fecha_adjudicacion?: string | null
          id?: string
          licitacion_id: string
          moneda?: string | null
          monto_adjudicado?: number | null
          proveedor_codigo?: string | null
          proveedor_nombre?: string | null
          proveedor_rut?: string | null
        }
        Update: {
          created_at?: string
          fecha_adjudicacion?: string | null
          id?: string
          licitacion_id?: string
          moneda?: string | null
          monto_adjudicado?: number | null
          proveedor_codigo?: string | null
          proveedor_nombre?: string | null
          proveedor_rut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitaciones_adjudicaciones_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_bi"
            referencedColumns: ["id"]
          },
        ]
      }
      licitaciones_bi: {
        Row: {
          codigo: string
          codigo_estado: number | null
          codigo_tipo: number | null
          created_at: string
          descripcion: string | null
          estado: string | null
          etapas: number | null
          fecha_adjudicacion: string | null
          fecha_cierre: string | null
          fecha_cierre_documentos: string | null
          fecha_creacion: string | null
          fecha_publicacion: string | null
          id: string
          institucion_codigo: string | null
          institucion_nombre: string | null
          institucion_rut: string | null
          moneda: string | null
          nombre: string
          presupuesto_estimado: number | null
          raw_data: Json | null
          tiempo_evaluacion_dias: number | null
          tipo: string | null
          unidad_compra: string | null
          unidad_compra_comuna: string | null
          unidad_compra_direccion: string | null
          unidad_compra_region: string | null
          updated_at: string
        }
        Insert: {
          codigo: string
          codigo_estado?: number | null
          codigo_tipo?: number | null
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          etapas?: number | null
          fecha_adjudicacion?: string | null
          fecha_cierre?: string | null
          fecha_cierre_documentos?: string | null
          fecha_creacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          institucion_codigo?: string | null
          institucion_nombre?: string | null
          institucion_rut?: string | null
          moneda?: string | null
          nombre: string
          presupuesto_estimado?: number | null
          raw_data?: Json | null
          tiempo_evaluacion_dias?: number | null
          tipo?: string | null
          unidad_compra?: string | null
          unidad_compra_comuna?: string | null
          unidad_compra_direccion?: string | null
          unidad_compra_region?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          codigo_estado?: number | null
          codigo_tipo?: number | null
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          etapas?: number | null
          fecha_adjudicacion?: string | null
          fecha_cierre?: string | null
          fecha_cierre_documentos?: string | null
          fecha_creacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          institucion_codigo?: string | null
          institucion_nombre?: string | null
          institucion_rut?: string | null
          moneda?: string | null
          nombre?: string
          presupuesto_estimado?: number | null
          raw_data?: Json | null
          tiempo_evaluacion_dias?: number | null
          tipo?: string | null
          unidad_compra?: string | null
          unidad_compra_comuna?: string | null
          unidad_compra_direccion?: string | null
          unidad_compra_region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      licitaciones_bi_items: {
        Row: {
          cantidad: number
          categoria: string | null
          codigo_categoria: string | null
          codigo_producto: string | null
          correlativo: number | null
          created_at: string
          descripcion: string | null
          id: string
          licitacion_id: string
          nombre_producto: string
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          licitacion_id: string
          nombre_producto: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          licitacion_id?: string
          nombre_producto?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitaciones_bi_items_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_bi"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_precios_firmavb: {
        Row: {
          activo: boolean | null
          categoria: string | null
          codigo: string | null
          costo: number | null
          created_at: string
          descripcion: string
          id: string
          margen_comercial: number | null
          precio_venta_neto: number | null
          proveedor: string | null
          unidad: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          costo?: number | null
          created_at?: string
          descripcion: string
          id?: string
          margen_comercial?: number | null
          precio_venta_neto?: number | null
          proveedor?: string | null
          unidad?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          costo?: number | null
          created_at?: string
          descripcion?: string
          id?: string
          margen_comercial?: number | null
          precio_venta_neto?: number | null
          proveedor?: string | null
          unidad?: string | null
          updated_at?: string
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
          {
            foreignKeyName: "ofertas_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_con_match"
            referencedColumns: ["id_licitacion"]
          },
          {
            foreignKeyName: "ofertas_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_urgentes"
            referencedColumns: ["id_licitacion"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          codigo: string
          created_at: string
          descripcion: string | null
          estado: string | null
          fecha_aceptacion: string | null
          fecha_creacion: string | null
          fecha_envio: string | null
          id: string
          institucion_codigo: string | null
          institucion_nombre: string | null
          institucion_rut: string | null
          licitacion_codigo: string | null
          moneda: string | null
          nombre: string
          proveedor_codigo: string | null
          proveedor_comuna: string | null
          proveedor_direccion: string | null
          proveedor_nombre: string | null
          proveedor_region: string | null
          proveedor_rut: string | null
          raw_data: Json | null
          tipo: string | null
          total: number | null
          total_iva: number | null
          total_neto: number | null
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_aceptacion?: string | null
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          institucion_codigo?: string | null
          institucion_nombre?: string | null
          institucion_rut?: string | null
          licitacion_codigo?: string | null
          moneda?: string | null
          nombre: string
          proveedor_codigo?: string | null
          proveedor_comuna?: string | null
          proveedor_direccion?: string | null
          proveedor_nombre?: string | null
          proveedor_region?: string | null
          proveedor_rut?: string | null
          raw_data?: Json | null
          tipo?: string | null
          total?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_aceptacion?: string | null
          fecha_creacion?: string | null
          fecha_envio?: string | null
          id?: string
          institucion_codigo?: string | null
          institucion_nombre?: string | null
          institucion_rut?: string | null
          licitacion_codigo?: string | null
          moneda?: string | null
          nombre?: string
          proveedor_codigo?: string | null
          proveedor_comuna?: string | null
          proveedor_direccion?: string | null
          proveedor_nombre?: string | null
          proveedor_region?: string | null
          proveedor_rut?: string | null
          raw_data?: Json | null
          tipo?: string | null
          total?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ordenes_compra_items: {
        Row: {
          cantidad: number
          categoria: string | null
          codigo_categoria: string | null
          codigo_producto: string | null
          correlativo: number | null
          created_at: string
          descripcion: string | null
          especificacion_comprador: string | null
          especificacion_proveedor: string | null
          id: string
          nombre_producto: string
          orden_compra_id: string
          precio_unitario_neto: number | null
          total_neto: number | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          especificacion_comprador?: string | null
          especificacion_proveedor?: string | null
          id?: string
          nombre_producto: string
          orden_compra_id: string
          precio_unitario_neto?: number | null
          total_neto?: number | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          especificacion_comprador?: string | null
          especificacion_proveedor?: string | null
          id?: string
          nombre_producto?: string
          orden_compra_id?: string
          precio_unitario_neto?: number | null
          total_neto?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_items_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          features: Json | null
          id: string
          limite_licitaciones: number | null
          limite_ofertas: number | null
          limite_usuarios: number | null
          nombre: string
          orden: number | null
          precio_anual: number | null
          precio_mensual: number
          tiene_api: boolean | null
          tiene_auto_bid: boolean | null
          tiene_bi_avanzado: boolean | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          features?: Json | null
          id?: string
          limite_licitaciones?: number | null
          limite_ofertas?: number | null
          limite_usuarios?: number | null
          nombre: string
          orden?: number | null
          precio_anual?: number | null
          precio_mensual: number
          tiene_api?: boolean | null
          tiene_auto_bid?: boolean | null
          tiene_bi_avanzado?: boolean | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          features?: Json | null
          id?: string
          limite_licitaciones?: number | null
          limite_ofertas?: number | null
          limite_usuarios?: number | null
          nombre?: string
          orden?: number | null
          precio_anual?: number | null
          precio_mensual?: number
          tiene_api?: boolean | null
          tiene_auto_bid?: boolean | null
          tiene_bi_avanzado?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          es_principal: boolean | null
          id: string
          image_url: string
          orden: number | null
          product_id: string
          product_type: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          es_principal?: boolean | null
          id?: string
          image_url: string
          orden?: number | null
          product_id: string
          product_type: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          es_principal?: boolean | null
          id?: string
          image_url?: string
          orden?: number | null
          product_id?: string
          product_type?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      productos: {
        Row: {
          activo: boolean | null
          categoria: string | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          id: string
          keywords: string[] | null
          nombre: string
          precio_referencia: number | null
          subcategoria: string | null
          unidad_medida: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          keywords?: string[] | null
          nombre: string
          precio_referencia?: number | null
          subcategoria?: string | null
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          keywords?: string[] | null
          nombre?: string
          precio_referencia?: number | null
          subcategoria?: string | null
          unidad_medida?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about_me: string | null
          avatar_url: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          instagram_username: string | null
          instagram_verified: boolean | null
          last_name: string | null
          phone: string | null
          rut: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          about_me?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          instagram_username?: string | null
          instagram_verified?: boolean | null
          last_name?: string | null
          phone?: string | null
          rut?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          about_me?: string | null
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          instagram_username?: string | null
          instagram_verified?: boolean | null
          last_name?: string | null
          phone?: string | null
          rut?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          actividad_economica: string | null
          comuna: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          monto_total_ordenes: number | null
          nombre: string
          razon_social: string | null
          region: string | null
          rubro: string | null
          rut: string
          tamanio_empresa: string | null
          telefono: string | null
          total_ordenes: number | null
          ultima_orden_fecha: string | null
          updated_at: string
        }
        Insert: {
          actividad_economica?: string | null
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          monto_total_ordenes?: number | null
          nombre: string
          razon_social?: string | null
          region?: string | null
          rubro?: string | null
          rut: string
          tamanio_empresa?: string | null
          telefono?: string | null
          total_ordenes?: number | null
          ultima_orden_fecha?: string | null
          updated_at?: string
        }
        Update: {
          actividad_economica?: string | null
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          monto_total_ordenes?: number | null
          nombre?: string
          razon_social?: string | null
          region?: string | null
          rubro?: string | null
          rut?: string
          tamanio_empresa?: string | null
          telefono?: string | null
          total_ordenes?: number | null
          ultima_orden_fecha?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          section_key: string
          section_name: string
          updated_at: string | null
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          section_key: string
          section_name: string
          updated_at?: string | null
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          section_key?: string
          section_name?: string
          updated_at?: string | null
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
      user_settings: {
        Row: {
          api_key_connected: boolean | null
          api_key_encrypted: string | null
          automation_settings: Json | null
          bidding_settings: Json | null
          company_settings: Json | null
          created_at: string | null
          delivery_settings: Json | null
          id: string
          regions: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key_connected?: boolean | null
          api_key_encrypted?: string | null
          automation_settings?: Json | null
          bidding_settings?: Json | null
          company_settings?: Json | null
          created_at?: string | null
          delivery_settings?: Json | null
          id?: string
          regions?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key_connected?: boolean | null
          api_key_encrypted?: string | null
          automation_settings?: Json | null
          bidding_settings?: Json | null
          company_settings?: Json | null
          created_at?: string | null
          delivery_settings?: Json | null
          id?: string
          regions?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vendedor_asignaciones: {
        Row: {
          created_at: string
          estado: string | null
          fecha_cierre: string | null
          id: string
          licitacion_codigo: string | null
          licitacion_id: string
          monto_estimado: number | null
          notas: string | null
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          licitacion_codigo?: string | null
          licitacion_id: string
          monto_estimado?: number | null
          notas?: string | null
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          estado?: string | null
          fecha_cierre?: string | null
          id?: string
          licitacion_codigo?: string | null
          licitacion_id?: string
          monto_estimado?: number | null
          notas?: string | null
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_calendario: {
        Row: {
          asignacion_id: string | null
          color: string | null
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          tipo_evento: string | null
          titulo: string
          vendedor_id: string
        }
        Insert: {
          asignacion_id?: string | null
          color?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          tipo_evento?: string | null
          titulo: string
          vendedor_id: string
        }
        Update: {
          asignacion_id?: string | null
          color?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          tipo_evento?: string | null
          titulo?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_calendario_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_calendario_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "vendedor_asignaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_indicadores: {
        Row: {
          created_at: string
          id: string
          monto_adjudicado: number | null
          periodo: string
          tasa_adjudicacion: number | null
          total_adjudicadas: number | null
          total_asignadas: number | null
          total_postuladas: number | null
          updated_at: string
          vendedor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          monto_adjudicado?: number | null
          periodo: string
          tasa_adjudicacion?: number | null
          total_adjudicadas?: number | null
          total_asignadas?: number | null
          total_postuladas?: number | null
          updated_at?: string
          vendedor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          monto_adjudicado?: number | null
          periodo?: string
          tasa_adjudicacion?: number | null
          total_adjudicadas?: number | null
          total_asignadas?: number | null
          total_postuladas?: number | null
          updated_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_indicadores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_indicadores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_indicadores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          activo: boolean | null
          created_at: string
          email: string
          id: string
          nombre: string
          rol: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string
          email: string
          id?: string
          nombre: string
          rol?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          rol?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ventas_comisionables: {
        Row: {
          codigo_oc: string
          comision_monto: number | null
          comision_porcentaje: number
          comprador: string | null
          created_at: string
          fecha_aceptacion: string | null
          id: string
          monto_neto: number
          orden_compra_id: string | null
          periodo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          codigo_oc: string
          comision_monto?: number | null
          comision_porcentaje?: number
          comprador?: string | null
          created_at?: string
          fecha_aceptacion?: string | null
          id?: string
          monto_neto?: number
          orden_compra_id?: string | null
          periodo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          codigo_oc?: string
          comision_monto?: number | null
          comision_porcentaje?: number
          comprador?: string | null
          created_at?: string
          fecha_aceptacion?: string | null
          id?: string
          monto_neto?: number
          orden_compra_id?: string | null
          periodo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_comisionables_orden_compra_id_fkey"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bi_oc_negocios_por_institucion: {
        Row: {
          institucion_nombre: string | null
          institucion_rut: string | null
          monto_total: number | null
          promedio_orden: number | null
          proveedores_distintos: number | null
          total_ordenes: number | null
          ultima_orden: string | null
        }
        Relationships: []
      }
      bi_oc_negocios_por_proveedor: {
        Row: {
          instituciones_distintas: number | null
          monto_total: number | null
          promedio_orden: number | null
          proveedor_nombre: string | null
          proveedor_rut: string | null
          total_ordenes: number | null
          ultima_orden: string | null
        }
        Relationships: []
      }
      bi_oc_precios_producto_proveedor: {
        Row: {
          nombre_producto: string | null
          precio_maximo: number | null
          precio_minimo: number | null
          precio_promedio: number | null
          proveedor_nombre: string | null
          proveedor_rut: string | null
          ultima_venta: string | null
          veces_vendido: number | null
        }
        Relationships: []
      }
      bi_oc_productos: {
        Row: {
          cantidad_total: number | null
          categoria: string | null
          monto_total: number | null
          nombre_producto: string | null
          precio_maximo: number | null
          precio_minimo: number | null
          precio_promedio: number | null
          total_ventas: number | null
        }
        Relationships: []
      }
      calendario_eventos: {
        Row: {
          codigo: string | null
          fecha_evento: string | null
          institucion_nombre: string | null
          nombre: string | null
          presupuesto_estimado: number | null
          tipo_evento: string | null
          tipo_proceso: string | null
        }
        Relationships: []
      }
      dashboard_estado: {
        Row: {
          con_match: number | null
          monto_ganado: number | null
          monto_ordenes: number | null
          ofertas_enviadas: number | null
          ofertas_ganadas: number | null
          total_licitaciones: number | null
          total_ofertas: number | null
          total_ordenes: number | null
          urgentes: number | null
        }
        Relationships: []
      }
      licitaciones_con_match: {
        Row: {
          created_at: string | null
          estado: string | null
          fecha_cierre: string | null
          id_licitacion: string | null
          link_oficial: string | null
          match_encontrado: boolean | null
          organismo: string | null
          presupuesto: number | null
          procesada: boolean | null
          score: number | null
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion?: string | null
          link_oficial?: string | null
          match_encontrado?: boolean | null
          organismo?: string | null
          presupuesto?: number | null
          procesada?: boolean | null
          score?: number | null
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion?: string | null
          link_oficial?: string | null
          match_encontrado?: boolean | null
          organismo?: string | null
          presupuesto?: number | null
          procesada?: boolean | null
          score?: number | null
          titulo?: string | null
        }
        Relationships: []
      }
      licitaciones_urgentes: {
        Row: {
          created_at: string | null
          estado: string | null
          fecha_cierre: string | null
          id_licitacion: string | null
          link_oficial: string | null
          match_encontrado: boolean | null
          match_score: number | null
          organismo: string | null
          presupuesto: number | null
          procesada: boolean | null
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion?: string | null
          link_oficial?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          organismo?: string | null
          presupuesto?: number | null
          procesada?: boolean | null
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          id_licitacion?: string | null
          link_oficial?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          organismo?: string | null
          presupuesto?: number | null
          procesada?: boolean | null
          titulo?: string | null
        }
        Relationships: []
      }
      oportunidades_all: {
        Row: {
          codigo: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          institucion_nombre: string | null
          link_oficial: string | null
          match_encontrado: boolean | null
          match_score: number | null
          nombre: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          tipo_proceso: string | null
        }
        Relationships: []
      }
      v_asignaciones_detalle: {
        Row: {
          created_at: string | null
          estado: string | null
          fecha_cierre: string | null
          id: string | null
          licitacion_codigo: string | null
          licitacion_id: string | null
          monto_estimado: number | null
          notas: string | null
          vendedor_email: string | null
          vendedor_id: string | null
          vendedor_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_calendario_vendedor: {
        Row: {
          color: string | null
          estado_asignacion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string | null
          licitacion_codigo: string | null
          monto_estimado: number | null
          tipo_evento: string | null
          titulo: string | null
          vendedor_id: string | null
          vendedor_nombre: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      v_reporte_equipo: {
        Row: {
          adjudicados: number | null
          email: string | null
          monto_adjudicado: number | null
          monto_total: number | null
          nombre: string | null
          postulados: number | null
          rol: string | null
          tasa_adjudicacion: number | null
          total_negocios: number | null
          vendedor_id: string | null
        }
        Relationships: []
      }
      v_vendedor_dashboard: {
        Row: {
          email: string | null
          monto_adjudicado: number | null
          nombre: string | null
          tasa_adjudicacion: number | null
          total_adjudicadas: number | null
          total_asignadas: number | null
          total_postuladas: number | null
          vendedor_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_user_roles_rls_fix: { Args: never; Returns: undefined }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      user_can_access_section: {
        Args: { _section_key: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "vendedor" | "visor"
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
      app_role: ["admin", "user", "super_admin", "vendedor", "visor"],
      notification_frequency: ["immediate", "daily", "weekly"],
    },
  },
} as const
