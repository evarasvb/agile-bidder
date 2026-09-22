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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academia_accesos: {
        Row: {
          asignado_at: string | null
          codigo: string
          created_at: string
          curso_slug: string
          email: string | null
          estado: string
          id: string
          mp_payment_id: string | null
        }
        Insert: {
          asignado_at?: string | null
          codigo: string
          created_at?: string
          curso_slug: string
          email?: string | null
          estado?: string
          id?: string
          mp_payment_id?: string | null
        }
        Update: {
          asignado_at?: string | null
          codigo?: string
          created_at?: string
          curso_slug?: string
          email?: string | null
          estado?: string
          id?: string
          mp_payment_id?: string | null
        }
        Relationships: []
      }
      academia_contenido: {
        Row: {
          modulos: Json
          slug: string
          updated_at: string
        }
        Insert: {
          modulos: Json
          slug: string
          updated_at?: string
        }
        Update: {
          modulos?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      academia_leads: {
        Row: {
          atendido: boolean
          created_at: string
          dolor: string | null
          email: string | null
          estado_debe: string | null
          id: string
          nombre_contacto: string | null
          nombre_empresa: string | null
          notas: string | null
          rut_empresa: string | null
          vende_estado: string | null
          whatsapp: string | null
        }
        Insert: {
          atendido?: boolean
          created_at?: string
          dolor?: string | null
          email?: string | null
          estado_debe?: string | null
          id?: string
          nombre_contacto?: string | null
          nombre_empresa?: string | null
          notas?: string | null
          rut_empresa?: string | null
          vende_estado?: string | null
          whatsapp?: string | null
        }
        Update: {
          atendido?: boolean
          created_at?: string
          dolor?: string | null
          email?: string | null
          estado_debe?: string | null
          id?: string
          nombre_contacto?: string | null
          nombre_empresa?: string | null
          notas?: string | null
          rut_empresa?: string | null
          vende_estado?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      agendamientos_meet: {
        Row: {
          email: string
          empresa: string
          estado: string | null
          fecha_agendamiento: string | null
          fecha_meet: string
          id: number
          link_meet: string | null
          nombre: string
          notas_adicionales: string | null
          preferencia_comunicacion: string | null
          prospecto_id: number | null
          telefono: string
          temas: string[] | null
        }
        Insert: {
          email: string
          empresa: string
          estado?: string | null
          fecha_agendamiento?: string | null
          fecha_meet: string
          id?: number
          link_meet?: string | null
          nombre: string
          notas_adicionales?: string | null
          preferencia_comunicacion?: string | null
          prospecto_id?: number | null
          telefono: string
          temas?: string[] | null
        }
        Update: {
          email?: string
          empresa?: string
          estado?: string | null
          fecha_agendamiento?: string | null
          fecha_meet?: string
          id?: number
          link_meet?: string | null
          nombre?: string
          notas_adicionales?: string | null
          preferencia_comunicacion?: string | null
          prospecto_id?: number | null
          telefono?: string
          temas?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamientos_meet_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos_cm2239"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamientos_meet_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "vista_contacto_prospectos"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_enviadas: {
        Row: {
          clave: string
          detalle: string | null
          enviada_at: string
        }
        Insert: {
          clave: string
          detalle?: string | null
          enviada_at?: string
        }
        Update: {
          clave?: string
          detalle?: string | null
          enviada_at?: string
        }
        Relationships: []
      }
      analisis_competencia: {
        Row: {
          benchmark_precio: number | null
          competidores_data: Json | null
          created_at: string
          desviacion_estandar: number | null
          fecha_analisis: string
          id: string
          participantes_activos: number | null
          precio_maximo: number | null
          precio_mediano: number | null
          precio_minimo: number | null
          precio_promedio: number | null
          proceso_codigo: string
          proceso_nombre: string | null
          proceso_tipo: string
          procesos_similares: number | null
          tendencia_precios: string | null
          total_participantes: number | null
          updated_at: string
        }
        Insert: {
          benchmark_precio?: number | null
          competidores_data?: Json | null
          created_at?: string
          desviacion_estandar?: number | null
          fecha_analisis?: string
          id?: string
          participantes_activos?: number | null
          precio_maximo?: number | null
          precio_mediano?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          proceso_codigo: string
          proceso_nombre?: string | null
          proceso_tipo: string
          procesos_similares?: number | null
          tendencia_precios?: string | null
          total_participantes?: number | null
          updated_at?: string
        }
        Update: {
          benchmark_precio?: number | null
          competidores_data?: Json | null
          created_at?: string
          desviacion_estandar?: number | null
          fecha_analisis?: string
          id?: string
          participantes_activos?: number | null
          precio_maximo?: number | null
          precio_mediano?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          proceso_codigo?: string
          proceso_nombre?: string | null
          proceso_tipo?: string
          procesos_similares?: number | null
          tendencia_precios?: string | null
          total_participantes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      asignaciones_licitaciones: {
        Row: {
          asignado_por: string | null
          comentarios: Json | null
          created_at: string
          estado: string | null
          fecha_asignacion: string
          fecha_limite_oferta: string | null
          fecha_limite_revision: string | null
          id: string
          licitacion_codigo: string
          licitacion_tipo: string
          notas: string | null
          prioridad: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          asignado_por?: string | null
          comentarios?: Json | null
          created_at?: string
          estado?: string | null
          fecha_asignacion?: string
          fecha_limite_oferta?: string | null
          fecha_limite_revision?: string | null
          id?: string
          licitacion_codigo: string
          licitacion_tipo?: string
          notas?: string | null
          prioridad?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          asignado_por?: string | null
          comentarios?: Json | null
          created_at?: string
          estado?: string | null
          fecha_asignacion?: string
          fecha_limite_oferta?: string | null
          fecha_limite_revision?: string | null
          id?: string
          licitacion_codigo?: string
          licitacion_tipo?: string
          notas?: string | null
          prioridad?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      auto_bid_items: {
        Row: {
          auto_bid_id: string
          cantidad: number | null
          created_at: string | null
          ficha_tecnica_url: string | null
          id: string
          imagen_url: string | null
          inventario_producto_id: string | null
          item_index: number
          match_confidence: number | null
          match_method: string | null
          nombre_oferta: string | null
          notas: string | null
          precio_unitario: number | null
          proveedor: string | null
          requerimiento: string | null
          sku: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          auto_bid_id: string
          cantidad?: number | null
          created_at?: string | null
          ficha_tecnica_url?: string | null
          id?: string
          imagen_url?: string | null
          inventario_producto_id?: string | null
          item_index: number
          match_confidence?: number | null
          match_method?: string | null
          nombre_oferta?: string | null
          notas?: string | null
          precio_unitario?: number | null
          proveedor?: string | null
          requerimiento?: string | null
          sku?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_bid_id?: string
          cantidad?: number | null
          created_at?: string | null
          ficha_tecnica_url?: string | null
          id?: string
          imagen_url?: string | null
          inventario_producto_id?: string | null
          item_index?: number
          match_confidence?: number | null
          match_method?: string | null
          nombre_oferta?: string | null
          notas?: string | null
          precio_unitario?: number | null
          proveedor?: string | null
          requerimiento?: string | null
          sku?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auto_bid_items_auto_bid_id_fkey"
            columns: ["auto_bid_id"]
            isOneToOne: false
            referencedRelation: "auto_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_bid_items_auto_bid_id_fkey"
            columns: ["auto_bid_id"]
            isOneToOne: false
            referencedRelation: "auto_bids_dashboard"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_bid_opportunities: {
        Row: {
          asignado_a: string | null
          codigo_licitacion: string
          costo_envio: number | null
          created_at: string | null
          descripcion_cotizacion: string | null
          descripcion_licitacion: string | null
          direccion_entrega: string | null
          documentos_adjuntos: Json | null
          estado: string | null
          fecha_cierre: string | null
          fecha_creacion: string | null
          fecha_publicacion: string | null
          id: string
          institucion: string | null
          items: Json | null
          iva_porcentaje: number | null
          monto_ofertado: number | null
          nombre_licitacion: string
          plazo_entrega_dias: number | null
          porcentaje_matching: number | null
          presupuesto: number | null
          productos_matched: number | null
          productos_total: number | null
          total_con_iva: number | null
          total_iva: number | null
          total_neto: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asignado_a?: string | null
          codigo_licitacion: string
          costo_envio?: number | null
          created_at?: string | null
          descripcion_cotizacion?: string | null
          descripcion_licitacion?: string | null
          direccion_entrega?: string | null
          documentos_adjuntos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_creacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          institucion?: string | null
          items?: Json | null
          iva_porcentaje?: number | null
          monto_ofertado?: number | null
          nombre_licitacion: string
          plazo_entrega_dias?: number | null
          porcentaje_matching?: number | null
          presupuesto?: number | null
          productos_matched?: number | null
          productos_total?: number | null
          total_con_iva?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asignado_a?: string | null
          codigo_licitacion?: string
          costo_envio?: number | null
          created_at?: string | null
          descripcion_cotizacion?: string | null
          descripcion_licitacion?: string | null
          direccion_entrega?: string | null
          documentos_adjuntos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_creacion?: string | null
          fecha_publicacion?: string | null
          id?: string
          institucion?: string | null
          items?: Json | null
          iva_porcentaje?: number | null
          monto_ofertado?: number | null
          nombre_licitacion?: string
          plazo_entrega_dias?: number | null
          porcentaje_matching?: number | null
          presupuesto?: number | null
          productos_matched?: number | null
          productos_total?: number | null
          total_con_iva?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auto_bids: {
        Row: {
          codigo_proceso: string
          convocatoria: string | null
          created_at: string | null
          departamento: string | null
          descripcion: string | null
          estado: string
          fecha_cierre: string | null
          fecha_publicacion: string | null
          id: string
          iva: number | null
          moneda: string | null
          notas: string | null
          organismo: string | null
          presupuesto_total: number | null
          raw_json: Json | null
          rut_institucion: string | null
          tipo_proceso: string
          titulo: string | null
          total: number | null
          total_neto: number | null
          unidad_compra: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_proceso: string
          convocatoria?: string | null
          created_at?: string | null
          departamento?: string | null
          descripcion?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          id?: string
          iva?: number | null
          moneda?: string | null
          notas?: string | null
          organismo?: string | null
          presupuesto_total?: number | null
          raw_json?: Json | null
          rut_institucion?: string | null
          tipo_proceso: string
          titulo?: string | null
          total?: number | null
          total_neto?: number | null
          unidad_compra?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_proceso?: string
          convocatoria?: string | null
          created_at?: string | null
          departamento?: string | null
          descripcion?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          id?: string
          iva?: number | null
          moneda?: string | null
          notas?: string | null
          organismo?: string | null
          presupuesto_total?: number | null
          raw_json?: Json | null
          rut_institucion?: string | null
          tipo_proceso?: string
          titulo?: string | null
          total?: number | null
          total_neto?: number | null
          unidad_compra?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bases_licitacion: {
        Row: {
          archivo: string | null
          caracteres: number | null
          codigo: string
          creado_en: string
          id: string
          paginas: number | null
          resumen: Json | null
          resumen_intentos: number
          secciones: Json | null
          storage_path: string | null
          subido_por: string | null
          texto: string | null
          tipo: string
        }
        Insert: {
          archivo?: string | null
          caracteres?: number | null
          codigo: string
          creado_en?: string
          id?: string
          paginas?: number | null
          resumen?: Json | null
          resumen_intentos?: number
          secciones?: Json | null
          storage_path?: string | null
          subido_por?: string | null
          texto?: string | null
          tipo?: string
        }
        Update: {
          archivo?: string | null
          caracteres?: number | null
          codigo?: string
          creado_en?: string
          id?: string
          paginas?: number | null
          resumen?: Json | null
          resumen_intentos?: number
          secciones?: Json | null
          storage_path?: string | null
          subido_por?: string | null
          texto?: string | null
          tipo?: string
        }
        Relationships: []
      }
      ca_item_matches: {
        Row: {
          cantidad: number | null
          cliente_id: string
          compra_agil_codigo: string
          fecha_cierre: string | null
          id: string
          inventario_id: string | null
          item_id: string
          nombre_producto: string | null
          nombre_solicitado: string | null
          precio_unitario: number | null
          score: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          cantidad?: number | null
          cliente_id: string
          compra_agil_codigo: string
          fecha_cierre?: string | null
          id?: string
          inventario_id?: string | null
          item_id: string
          nombre_producto?: string | null
          nombre_solicitado?: string | null
          precio_unitario?: number | null
          score?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number | null
          cliente_id?: string
          compra_agil_codigo?: string
          fecha_cierre?: string | null
          id?: string
          inventario_id?: string | null
          item_id?: string
          nombre_producto?: string | null
          nombre_solicitado?: string | null
          precio_unitario?: number | null
          score?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ca_matches: {
        Row: {
          cliente_id: string
          compra_agil_codigo: string
          created_at: string | null
          fecha_cierre: string | null
          id: number
          inventario_id: string | null
          listo: boolean | null
          nombre_pedido: string | null
          nombre_producto: string | null
          precio_unitario: number | null
          score: number | null
        }
        Insert: {
          cliente_id: string
          compra_agil_codigo: string
          created_at?: string | null
          fecha_cierre?: string | null
          id?: never
          inventario_id?: string | null
          listo?: boolean | null
          nombre_pedido?: string | null
          nombre_producto?: string | null
          precio_unitario?: number | null
          score?: number | null
        }
        Update: {
          cliente_id?: string
          compra_agil_codigo?: string
          created_at?: string | null
          fecha_cierre?: string | null
          id?: never
          inventario_id?: string | null
          listo?: boolean | null
          nombre_pedido?: string | null
          nombre_producto?: string | null
          precio_unitario?: number | null
          score?: number | null
        }
        Relationships: []
      }
      categorias_firmavb: {
        Row: {
          activo: boolean | null
          categoria: string
          created_at: string | null
          id: number
          palabras_clave: string[]
        }
        Insert: {
          activo?: boolean | null
          categoria: string
          created_at?: string | null
          id?: number
          palabras_clave: string[]
        }
        Update: {
          activo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: number
          palabras_clave?: string[]
        }
        Relationships: []
      }
      client_keywords: {
        Row: {
          created_at: string | null
          id: string
          is_ia_suggested: boolean | null
          is_relevant: boolean | null
          keyword: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_ia_suggested?: boolean | null
          is_relevant?: boolean | null
          keyword: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_ia_suggested?: boolean | null
          is_relevant?: boolean | null
          keyword?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_negative_keywords: {
        Row: {
          created_at: string | null
          id: string
          keyword: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_negative_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_negative_keywords_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_organism_categories: {
        Row: {
          category_code: string
          category_name: string
          created_at: string | null
          id: string
          profile_id: string
        }
        Insert: {
          category_code: string
          category_name: string
          created_at?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          category_code?: string
          category_name?: string
          created_at?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_organism_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_organism_categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_organisms: {
        Row: {
          created_at: string | null
          id: string
          organism_code: string | null
          organism_name: string
          organism_rut: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organism_code?: string | null
          organism_name: string
          organism_rut?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organism_code?: string | null
          organism_name?: string
          organism_rut?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_organisms_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_organisms_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_regions: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          region_code: string
          region_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          region_code: string
          region_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          region_code?: string
          region_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_regions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_regions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_rubros: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          rubro_code: string | null
          rubro_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          rubro_code?: string | null
          rubro_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          rubro_code?: string | null
          rubro_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rubros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_rubros_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      client_search_profiles: {
        Row: {
          client_id: string
          created_at: string | null
          ia_enabled: boolean | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          ia_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          ia_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_search_types: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string
          search_compras_agiles: boolean | null
          search_consultas_mercado: boolean | null
          search_convenio_marco: boolean | null
          search_cotizaciones: boolean | null
          search_licitaciones: boolean | null
          search_tratos_directos: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id: string
          search_compras_agiles?: boolean | null
          search_consultas_mercado?: boolean | null
          search_convenio_marco?: boolean | null
          search_cotizaciones?: boolean | null
          search_licitaciones?: boolean | null
          search_tratos_directos?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string
          search_compras_agiles?: boolean | null
          search_consultas_mercado?: boolean | null
          search_convenio_marco?: boolean | null
          search_cotizaciones?: boolean | null
          search_licitaciones?: boolean | null
          search_tratos_directos?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_search_types_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "client_search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_search_types_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_client_search_config"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      cliente_documentos: {
        Row: {
          archivo_url: string
          cliente_id: string
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          archivo_url: string
          cliente_id: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          archivo_url?: string
          cliente_id?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_exclusiones: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          producto_excluido: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          producto_excluido: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          producto_excluido?: string
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
      cliente_filtros_oportunidades: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          monto_max: number | null
          monto_min: number | null
          palabras_excluir: string[] | null
          palabras_ia_descartadas: string[]
          palabras_incluir: string[] | null
          palabras_incluir_ia: Json | null
          regiones_activas: string[] | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          monto_max?: number | null
          monto_min?: number | null
          palabras_excluir?: string[] | null
          palabras_ia_descartadas?: string[]
          palabras_incluir?: string[] | null
          palabras_incluir_ia?: Json | null
          regiones_activas?: string[] | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          monto_max?: number | null
          monto_min?: number | null
          palabras_excluir?: string[] | null
          palabras_ia_descartadas?: string[]
          palabras_incluir?: string[] | null
          palabras_incluir_ia?: Json | null
          regiones_activas?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_filtros_oportunidades_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_inventario: {
        Row: {
          busqueda_match: string | null
          categoria: string | null
          cliente_id: string
          codigo_producto: string | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          marca: string | null
          margen_minimo: number
          nombre: string
          nombre_norm: string | null
          nombre_producto: string
          palabras_clave: string[] | null
          precio_licitacion: number | null
          precio_unitario: number
          proveedor: string | null
          sku: string
          stock_disponible: number
          tiempo_entrega: number
          unidad_medida: string | null
          updated_at: string
        }
        Insert: {
          busqueda_match?: string | null
          categoria?: string | null
          cliente_id: string
          codigo_producto?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          margen_minimo?: number
          nombre?: string
          nombre_norm?: string | null
          nombre_producto?: string
          palabras_clave?: string[] | null
          precio_licitacion?: number | null
          precio_unitario?: number
          proveedor?: string | null
          sku: string
          stock_disponible?: number
          tiempo_entrega?: number
          unidad_medida?: string | null
          updated_at?: string
        }
        Update: {
          busqueda_match?: string | null
          categoria?: string | null
          cliente_id?: string
          codigo_producto?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          margen_minimo?: number
          nombre?: string
          nombre_norm?: string | null
          nombre_producto?: string
          palabras_clave?: string[] | null
          precio_licitacion?: number | null
          precio_unitario?: number
          proveedor?: string | null
          sku?: string
          stock_disponible?: number
          tiempo_entrega?: number
          unidad_medida?: string | null
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
          dias_activos: number[] | null
          email_instantaneo: boolean
          horario_desde: string | null
          horario_hasta: string | null
          horas_antes_cierre: number | null
          id: string
          notificaciones_24_7: boolean
          presupuesto_minimo: number | null
          push_notificaciones: boolean
          regiones_interes: string[] | null
          resumen_diario: boolean
          resumen_semanal: boolean
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
          dias_activos?: number[] | null
          email_instantaneo?: boolean
          horario_desde?: string | null
          horario_hasta?: string | null
          horas_antes_cierre?: number | null
          id?: string
          notificaciones_24_7?: boolean
          presupuesto_minimo?: number | null
          push_notificaciones?: boolean
          regiones_interes?: string[] | null
          resumen_diario?: boolean
          resumen_semanal?: boolean
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
          dias_activos?: number[] | null
          email_instantaneo?: boolean
          horario_desde?: string | null
          horario_hasta?: string | null
          horas_antes_cierre?: number | null
          id?: string
          notificaciones_24_7?: boolean
          presupuesto_minimo?: number | null
          push_notificaciones?: boolean
          regiones_interes?: string[] | null
          resumen_diario?: boolean
          resumen_semanal?: boolean
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
      cliente_reportes: {
        Row: {
          cliente_id: string
          created_at: string
          dia_mensual: number | null
          dia_semanal: number | null
          hora_mensual: string | null
          hora_semanal: string | null
          id: string
          reporte_mensual: boolean | null
          reporte_semanal: boolean | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          dia_mensual?: number | null
          dia_semanal?: number | null
          hora_mensual?: string | null
          hora_semanal?: string | null
          id?: string
          reporte_mensual?: boolean | null
          reporte_semanal?: boolean | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          dia_mensual?: number | null
          dia_semanal?: number | null
          hora_mensual?: string | null
          hora_semanal?: string | null
          id?: string
          reporte_mensual?: boolean | null
          reporte_semanal?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_reportes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_rubros_config: {
        Row: {
          activo: boolean | null
          cliente_id: string
          created_at: string | null
          id: string
          keywords_adicionales: string[] | null
          keywords_excluir: string[] | null
          presupuesto_maximo: number | null
          presupuesto_minimo: number | null
          regiones_interes: string[] | null
          rubros_activos: number[] | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          cliente_id: string
          created_at?: string | null
          id?: string
          keywords_adicionales?: string[] | null
          keywords_excluir?: string[] | null
          presupuesto_maximo?: number | null
          presupuesto_minimo?: number | null
          regiones_interes?: string[] | null
          rubros_activos?: number[] | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          cliente_id?: string
          created_at?: string | null
          id?: string
          keywords_adicionales?: string[] | null
          keywords_excluir?: string[] | null
          presupuesto_maximo?: number | null
          presupuesto_minimo?: number | null
          regiones_interes?: string[] | null
          rubros_activos?: number[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cliente_senales: {
        Row: {
          cliente_id: string
          codigo: string | null
          created_at: string
          id: string
          meta: Json | null
          oportunidad_tipo: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          cliente_id: string
          codigo?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          oportunidad_tipo?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          cliente_id?: string
          codigo?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          oportunidad_tipo?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_senales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          categoria_negocio: string | null
          created_at: string
          direccion: string | null
          email: string
          email_contacto: string | null
          empresa_nombre: string
          giros: string | null
          id: string
          industrias: string[] | null
          logo_url: string | null
          nombre_responsable: string | null
          onboarding_completado: boolean
          onboarding_step: number
          palabras_clave_busqueda: string[] | null
          plan: string
          region: string | null
          representante_nombre: string | null
          representante_rut: string | null
          rut: string | null
          telefono: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activo?: boolean
          categoria_negocio?: string | null
          created_at?: string
          direccion?: string | null
          email: string
          email_contacto?: string | null
          empresa_nombre: string
          giros?: string | null
          id?: string
          industrias?: string[] | null
          logo_url?: string | null
          nombre_responsable?: string | null
          onboarding_completado?: boolean
          onboarding_step?: number
          palabras_clave_busqueda?: string[] | null
          plan?: string
          region?: string | null
          representante_nombre?: string | null
          representante_rut?: string | null
          rut?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activo?: boolean
          categoria_negocio?: string | null
          created_at?: string
          direccion?: string | null
          email?: string
          email_contacto?: string | null
          empresa_nombre?: string
          giros?: string | null
          id?: string
          industrias?: string[] | null
          logo_url?: string | null
          nombre_responsable?: string | null
          onboarding_completado?: boolean
          onboarding_step?: number
          palabras_clave_busqueda?: string[] | null
          plan?: string
          region?: string | null
          representante_nombre?: string | null
          representante_rut?: string | null
          rut?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cluster_metadata: {
        Row: {
          avg_purchase_value: number | null
          cluster_description: string | null
          cluster_id: number
          cluster_name: string
          created_at: string | null
          customer_count: number | null
          fecha_creacion: string | null
          id: string
          key_characteristics: string | null
          recommended_messaging: string | null
          regions: Json | null
          sectors: Json | null
          total_purchases: number | null
          ultima_actualizacion: string | null
          updated_at: string | null
        }
        Insert: {
          avg_purchase_value?: number | null
          cluster_description?: string | null
          cluster_id: number
          cluster_name: string
          created_at?: string | null
          customer_count?: number | null
          fecha_creacion?: string | null
          id?: string
          key_characteristics?: string | null
          recommended_messaging?: string | null
          regions?: Json | null
          sectors?: Json | null
          total_purchases?: number | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Update: {
          avg_purchase_value?: number | null
          cluster_description?: string | null
          cluster_id?: number
          cluster_name?: string
          created_at?: string | null
          customer_count?: number | null
          fecha_creacion?: string | null
          id?: string
          key_characteristics?: string | null
          recommended_messaging?: string | null
          regions?: Json | null
          sectors?: Json | null
          total_purchases?: number | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      clustering_log: {
        Row: {
          clientes_procesados: number | null
          clusters_generados: number | null
          created_at: string | null
          detalles: Json | null
          fecha_clustering: string | null
          id: string
          status: string | null
          tiempo_segundos: number | null
        }
        Insert: {
          clientes_procesados?: number | null
          clusters_generados?: number | null
          created_at?: string | null
          detalles?: Json | null
          fecha_clustering?: string | null
          id?: string
          status?: string | null
          tiempo_segundos?: number | null
        }
        Update: {
          clientes_procesados?: number | null
          clusters_generados?: number | null
          created_at?: string | null
          detalles?: Json | null
          fecha_clustering?: string | null
          id?: string
          status?: string | null
          tiempo_segundos?: number | null
        }
        Relationships: []
      }
      compras_agiles: {
        Row: {
          asignado_a: string | null
          buen_pagador: boolean | null
          categoria: string | null
          codigo: string
          conducta_pago: string | null
          created_at: string | null
          datos_json: Json | null
          descripcion: string | null
          detalle_actualizado_at: string | null
          detalle_scrapeado: boolean | null
          direccion_entrega: string | null
          documentos: Json | null
          estado: string | null
          fecha_cierre: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_publicacion: string | null
          id: number
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string
          nombre_organismo: string | null
          ofertas_recibidas: number | null
          organismo_rut: string | null
          pago_promedio_dias: number | null
          plazo_entrega: string | null
          region: string | null
          tipo_presupuesto: string | null
          tipo_proceso: string | null
          unidad_compra: string | null
          updated_at: string | null
          url_ficha: string | null
        }
        Insert: {
          asignado_a?: string | null
          buen_pagador?: boolean | null
          categoria?: string | null
          codigo: string
          conducta_pago?: string | null
          created_at?: string | null
          datos_json?: Json | null
          descripcion?: string | null
          detalle_actualizado_at?: string | null
          detalle_scrapeado?: boolean | null
          direccion_entrega?: string | null
          documentos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_publicacion?: string | null
          id?: number
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre: string
          nombre_organismo?: string | null
          ofertas_recibidas?: number | null
          organismo_rut?: string | null
          pago_promedio_dias?: number | null
          plazo_entrega?: string | null
          region?: string | null
          tipo_presupuesto?: string | null
          tipo_proceso?: string | null
          unidad_compra?: string | null
          updated_at?: string | null
          url_ficha?: string | null
        }
        Update: {
          asignado_a?: string | null
          buen_pagador?: boolean | null
          categoria?: string | null
          codigo?: string
          conducta_pago?: string | null
          created_at?: string | null
          datos_json?: Json | null
          descripcion?: string | null
          detalle_actualizado_at?: string | null
          detalle_scrapeado?: boolean | null
          direccion_entrega?: string | null
          documentos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_publicacion?: string | null
          id?: number
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string
          nombre_organismo?: string | null
          ofertas_recibidas?: number | null
          organismo_rut?: string | null
          pago_promedio_dias?: number | null
          plazo_entrega?: string | null
          region?: string | null
          tipo_presupuesto?: string | null
          tipo_proceso?: string | null
          unidad_compra?: string | null
          updated_at?: string | null
          url_ficha?: string | null
        }
        Relationships: []
      }
      compras_agiles_items: {
        Row: {
          cantidad: number
          categoria: string | null
          codigo_producto: string | null
          codigo_producto_inventario: string | null
          compra_agil_id: number
          created_at: string
          descripcion_producto: string | null
          id: string
          id_producto_inventario: string | null
          match_confidence: number | null
          match_method: string | null
          nombre_norm: string | null
          nombre_producto: string
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          categoria?: string | null
          codigo_producto?: string | null
          codigo_producto_inventario?: string | null
          compra_agil_id: number
          created_at?: string
          descripcion_producto?: string | null
          id?: string
          id_producto_inventario?: string | null
          match_confidence?: number | null
          match_method?: string | null
          nombre_norm?: string | null
          nombre_producto: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          categoria?: string | null
          codigo_producto?: string | null
          codigo_producto_inventario?: string | null
          compra_agil_id?: number
          created_at?: string
          descripcion_producto?: string | null
          id?: string
          id_producto_inventario?: string | null
          match_confidence?: number | null
          match_method?: string | null
          nombre_norm?: string | null
          nombre_producto?: string
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
          {
            foreignKeyName: "compras_agiles_items_id_producto_inventario_fkey"
            columns: ["id_producto_inventario"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      conducta_pago: {
        Row: {
          created_at: string | null
          dias_promedio_pago: number | null
          fuente: string | null
          id: string
          institucion: string | null
          muestras: number | null
          periodo: string
          porcentaje_morosidad: number | null
          raw_json: Json | null
          rut_institucion: string | null
          unidad_compra: string | null
        }
        Insert: {
          created_at?: string | null
          dias_promedio_pago?: number | null
          fuente?: string | null
          id?: string
          institucion?: string | null
          muestras?: number | null
          periodo: string
          porcentaje_morosidad?: number | null
          raw_json?: Json | null
          rut_institucion?: string | null
          unidad_compra?: string | null
        }
        Update: {
          created_at?: string | null
          dias_promedio_pago?: number | null
          fuente?: string | null
          id?: string
          institucion?: string | null
          muestras?: number | null
          periodo?: string
          porcentaje_morosidad?: number | null
          raw_json?: Json | null
          rut_institucion?: string | null
          unidad_compra?: string | null
        }
        Relationships: []
      }
      contact_data_sources: {
        Row: {
          actualizado_en: string
          configuracion: Json | null
          creado_en: string
          descripcion: string | null
          estado: string | null
          id: string
          nombre: string
          proxima_sincronizacion: string | null
          registros_obtenidos: number | null
          tipo_fuente: string | null
          ultima_sincronizacion: string | null
        }
        Insert: {
          actualizado_en?: string
          configuracion?: Json | null
          creado_en?: string
          descripcion?: string | null
          estado?: string | null
          id?: string
          nombre: string
          proxima_sincronizacion?: string | null
          registros_obtenidos?: number | null
          tipo_fuente?: string | null
          ultima_sincronizacion?: string | null
        }
        Update: {
          actualizado_en?: string
          configuracion?: Json | null
          creado_en?: string
          descripcion?: string | null
          estado?: string | null
          id?: string
          nombre?: string
          proxima_sincronizacion?: string | null
          registros_obtenidos?: number | null
          tipo_fuente?: string | null
          ultima_sincronizacion?: string | null
        }
        Relationships: []
      }
      contact_enrichment_logs: {
        Row: {
          errores: number | null
          estado: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          mensaje_error: string | null
          metadata: Json | null
          proceso: string
          registros_actualizados: number | null
          registros_nuevos: number | null
          registros_procesados: number | null
        }
        Insert: {
          errores?: number | null
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          mensaje_error?: string | null
          metadata?: Json | null
          proceso: string
          registros_actualizados?: number | null
          registros_nuevos?: number | null
          registros_procesados?: number | null
        }
        Update: {
          errores?: number | null
          estado?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          mensaje_error?: string | null
          metadata?: Json | null
          proceso?: string
          registros_actualizados?: number | null
          registros_nuevos?: number | null
          registros_procesados?: number | null
        }
        Relationships: []
      }
      customer_clusters: {
        Row: {
          ai_profile: string | null
          characteristics: Json | null
          cluster_description: string | null
          cluster_id: number
          cluster_name: string
          created_at: string | null
          customer_name: string | null
          customer_rut: string
          customer_type: string | null
          fecha_clustering: string | null
          id: string
          purchase_history: Json | null
          ultima_actualizacion: string | null
          updated_at: string | null
        }
        Insert: {
          ai_profile?: string | null
          characteristics?: Json | null
          cluster_description?: string | null
          cluster_id: number
          cluster_name: string
          created_at?: string | null
          customer_name?: string | null
          customer_rut: string
          customer_type?: string | null
          fecha_clustering?: string | null
          id?: string
          purchase_history?: Json | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_profile?: string | null
          characteristics?: Json | null
          cluster_description?: string | null
          cluster_id?: number
          cluster_name?: string
          created_at?: string | null
          customer_name?: string | null
          customer_rut?: string
          customer_type?: string | null
          fecha_clustering?: string | null
          id?: string
          purchase_history?: Json | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_templates: {
        Row: {
          descripcion: string | null
          html: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          descripcion?: string | null
          html: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          descripcion?: string | null
          html?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      empresas_billing: {
        Row: {
          comision_porcentaje: number
          created_at: string
          id: string
          nombre_empresa: string | null
          plan: string | null
          tarjeta_expiracion: string | null
          tarjeta_marca: string | null
          tarjeta_ultimos_4: string | null
          tope_comision: number
          user_id: string
        }
        Insert: {
          comision_porcentaje?: number
          created_at?: string
          id?: string
          nombre_empresa?: string | null
          plan?: string | null
          tarjeta_expiracion?: string | null
          tarjeta_marca?: string | null
          tarjeta_ultimos_4?: string | null
          tope_comision?: number
          user_id: string
        }
        Update: {
          comision_porcentaje?: number
          created_at?: string
          id?: string
          nombre_empresa?: string | null
          plan?: string | null
          tarjeta_expiracion?: string | null
          tarjeta_marca?: string | null
          tarjeta_ultimos_4?: string | null
          tope_comision?: number
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          component_name: string | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          id: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      estudios_mercado: {
        Row: {
          categoria_producto: string
          created_at: string
          crecimiento_anual: number | null
          fecha_fin: string
          fecha_inicio: string
          id: string
          insights: Json | null
          instituciones_activas: number | null
          instituciones_top: Json | null
          participantes_top: Json | null
          precio_maximo: number | null
          precio_mediano: number | null
          precio_minimo: number | null
          precio_promedio: number | null
          promedio_monto: number | null
          subcategoria: string | null
          tendencia_precios: string | null
          tendencia_volumen: string | null
          total_monto: number | null
          total_participantes_unicos: number | null
          total_procesos: number | null
          updated_at: string
        }
        Insert: {
          categoria_producto: string
          created_at?: string
          crecimiento_anual?: number | null
          fecha_fin: string
          fecha_inicio: string
          id?: string
          insights?: Json | null
          instituciones_activas?: number | null
          instituciones_top?: Json | null
          participantes_top?: Json | null
          precio_maximo?: number | null
          precio_mediano?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          promedio_monto?: number | null
          subcategoria?: string | null
          tendencia_precios?: string | null
          tendencia_volumen?: string | null
          total_monto?: number | null
          total_participantes_unicos?: number | null
          total_procesos?: number | null
          updated_at?: string
        }
        Update: {
          categoria_producto?: string
          created_at?: string
          crecimiento_anual?: number | null
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          insights?: Json | null
          instituciones_activas?: number | null
          instituciones_top?: Json | null
          participantes_top?: Json | null
          precio_maximo?: number | null
          precio_mediano?: number | null
          precio_minimo?: number | null
          precio_promedio?: number | null
          promedio_monto?: number | null
          subcategoria?: string | null
          tendencia_precios?: string | null
          tendencia_volumen?: string | null
          total_monto?: number | null
          total_participantes_unicos?: number | null
          total_procesos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      evaristo_acciones: {
        Row: {
          actualizado_en: string
          api_key_id: string | null
          cliente_id: string | null
          codigo: string | null
          conversacion_id: string | null
          creada_por: string
          creado_en: string
          error: string | null
          estado: string
          id: string
          iniciada_en: string | null
          payload: Json
          resultado: Json | null
          terminada_en: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          actualizado_en?: string
          api_key_id?: string | null
          cliente_id?: string | null
          codigo?: string | null
          conversacion_id?: string | null
          creada_por?: string
          creado_en?: string
          error?: string | null
          estado?: string
          id?: string
          iniciada_en?: string | null
          payload?: Json
          resultado?: Json | null
          terminada_en?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          actualizado_en?: string
          api_key_id?: string | null
          cliente_id?: string | null
          codigo?: string | null
          conversacion_id?: string | null
          creada_por?: string
          creado_en?: string
          error?: string | null
          estado?: string
          id?: string
          iniciada_en?: string | null
          payload?: Json
          resultado?: Json | null
          terminada_en?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaristo_acciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaristo_acciones_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "evaristo_conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      evaristo_conversaciones: {
        Row: {
          actualizado_en: string
          canal: string
          cliente_id: string | null
          contexto: Json | null
          creado_en: string
          id: string
          titulo: string | null
          user_id: string
        }
        Insert: {
          actualizado_en?: string
          canal?: string
          cliente_id?: string | null
          contexto?: Json | null
          creado_en?: string
          id?: string
          titulo?: string | null
          user_id: string
        }
        Update: {
          actualizado_en?: string
          canal?: string
          cliente_id?: string | null
          contexto?: Json | null
          creado_en?: string
          id?: string
          titulo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      evaristo_logs: {
        Row: {
          command: string
          created_at: string | null
          id: string
          response: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          command: string
          created_at?: string | null
          id?: string
          response?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          command?: string
          created_at?: string | null
          id?: string
          response?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      evaristo_mensajes: {
        Row: {
          adjuntos: Json | null
          contenido: string
          conversacion_id: string
          creado_en: string
          id: number
          meta: Json | null
          rol: string
          user_id: string
        }
        Insert: {
          adjuntos?: Json | null
          contenido: string
          conversacion_id: string
          creado_en?: string
          id?: number
          meta?: Json | null
          rol: string
          user_id: string
        }
        Update: {
          adjuntos?: Json | null
          contenido?: string
          conversacion_id?: string
          creado_en?: string
          id?: number
          meta?: Json | null
          rol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaristo_mensajes_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "evaristo_conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_calendario: {
        Row: {
          asignado_a: string | null
          color: string | null
          created_at: string
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          oportunidad_id: string | null
          oportunidad_tipo: string | null
          recordatorio_minutos: number | null
          repetir: string
          tipo: string
          titulo: string
          todo_el_dia: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          asignado_a?: string | null
          color?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          oportunidad_id?: string | null
          oportunidad_tipo?: string | null
          recordatorio_minutos?: number | null
          repetir?: string
          tipo?: string
          titulo: string
          todo_el_dia?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          asignado_a?: string | null
          color?: string | null
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          oportunidad_id?: string | null
          oportunidad_tipo?: string | null
          recordatorio_minutos?: number | null
          repetir?: string
          tipo?: string
          titulo?: string
          todo_el_dia?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      experto_anexos: {
        Row: {
          codigo: string
          contenido: string
          creado_en: string
          faltantes: Json | null
          id: string
          user_id: string
        }
        Insert: {
          codigo: string
          contenido: string
          creado_en?: string
          faltantes?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          codigo?: string
          contenido?: string
          creado_en?: string
          faltantes?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      experto_bajo_agua_cuotas: {
        Row: {
          informes: number | null
          periodo: string
          plan: string
          updated_at: string
        }
        Insert: {
          informes?: number | null
          periodo?: string
          plan: string
          updated_at?: string
        }
        Update: {
          informes?: number | null
          periodo?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      experto_compartidos: {
        Row: {
          codigo: string | null
          contenido: string
          creado_en: string
          empresa: string | null
          id: string
          tipo: string
          titulo: string | null
          token: string
          user_id: string
          vistas: number
        }
        Insert: {
          codigo?: string | null
          contenido: string
          creado_en?: string
          empresa?: string | null
          id?: string
          tipo: string
          titulo?: string | null
          token?: string
          user_id: string
          vistas?: number
        }
        Update: {
          codigo?: string | null
          contenido?: string
          creado_en?: string
          empresa?: string | null
          id?: string
          tipo?: string
          titulo?: string | null
          token?: string
          user_id?: string
          vistas?: number
        }
        Relationships: []
      }
      experto_fuentes_cache: {
        Row: {
          actualizado_en: string
          clave: string
          datos: Json
        }
        Insert: {
          actualizado_en?: string
          clave: string
          datos: Json
        }
        Update: {
          actualizado_en?: string
          clave?: string
          datos?: Json
        }
        Relationships: []
      }
      experto_pagos: {
        Row: {
          created_at: string
          email: string | null
          estado: string
          factura_id: string | null
          id: string
          moneda: string
          monto: number
          mp_payment_id: string | null
          mp_preference_id: string | null
          producto: string
          raw: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          estado?: string
          factura_id?: string | null
          id?: string
          moneda?: string
          monto: number
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          producto: string
          raw?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          estado?: string
          factura_id?: string | null
          id?: string
          moneda?: string
          monto?: number
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          producto?: string
          raw?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experto_pagos_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_comision"
            referencedColumns: ["id"]
          },
        ]
      }
      experto_pro: {
        Row: {
          hasta: string
          nivel: string
          origen: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          hasta: string
          nivel?: string
          origen?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          hasta?: string
          nivel?: string
          origen?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      experto_pruebas: {
        Row: {
          hasta: string
          iniciada_en: string
          user_id: string
        }
        Insert: {
          hasta: string
          iniciada_en?: string
          user_id: string
        }
        Update: {
          hasta?: string
          iniciada_en?: string
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
          api_key: string | null
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
          api_key?: string | null
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
          api_key?: string | null
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
          cliente_id: string | null
          cobro_preapproval_id: string | null
          cobro_programado_en: string | null
          cobro_revertido_en: string | null
          created_at: string
          detalle: Json | null
          documento_url: string | null
          estado: string
          fecha_emision: string
          fecha_pago: string | null
          fecha_vencimiento: string | null
          fijo_monto: number
          id: string
          iva_comision: number
          iva_fijo: number
          numero_factura: string | null
          periodo: string
          por_suscripcion: boolean
          total: number
          total_comision: number
          total_ventas: number
          user_id: string
          validacion_hasta: string | null
        }
        Insert: {
          cliente_id?: string | null
          cobro_preapproval_id?: string | null
          cobro_programado_en?: string | null
          cobro_revertido_en?: string | null
          created_at?: string
          detalle?: Json | null
          documento_url?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          fijo_monto?: number
          id?: string
          iva_comision?: number
          iva_fijo?: number
          numero_factura?: string | null
          periodo: string
          por_suscripcion?: boolean
          total?: number
          total_comision?: number
          total_ventas?: number
          user_id: string
          validacion_hasta?: string | null
        }
        Update: {
          cliente_id?: string | null
          cobro_preapproval_id?: string | null
          cobro_programado_en?: string | null
          cobro_revertido_en?: string | null
          created_at?: string
          detalle?: Json | null
          documento_url?: string | null
          estado?: string
          fecha_emision?: string
          fecha_pago?: string | null
          fecha_vencimiento?: string | null
          fijo_monto?: number
          id?: string
          iva_comision?: number
          iva_fijo?: number
          numero_factura?: string | null
          periodo?: string
          por_suscripcion?: boolean
          total?: number
          total_comision?: number
          total_ventas?: number
          user_id?: string
          validacion_hasta?: string | null
        }
        Relationships: []
      }
      guardian_checks: {
        Row: {
          check_key: string
          created_at: string
          detalle: Json | null
          id: number
          mensaje: string | null
          run_id: string | null
          severidad: string
          umbral: number | null
          valor: number | null
        }
        Insert: {
          check_key: string
          created_at?: string
          detalle?: Json | null
          id?: number
          mensaje?: string | null
          run_id?: string | null
          severidad: string
          umbral?: number | null
          valor?: number | null
        }
        Update: {
          check_key?: string
          created_at?: string
          detalle?: Json | null
          id?: number
          mensaje?: string | null
          run_id?: string | null
          severidad?: string
          umbral?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_checks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "guardian_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_config: {
        Row: {
          accion: string | null
          activo: boolean
          auto_reparar: boolean
          check_key: string
          comparador: string
          cooldown_min: number
          descripcion: string | null
          max_intentos: number
          ruta: string | null
          severidad: string
          tipo: string
          umbral: number | null
        }
        Insert: {
          accion?: string | null
          activo?: boolean
          auto_reparar?: boolean
          check_key: string
          comparador?: string
          cooldown_min?: number
          descripcion?: string | null
          max_intentos?: number
          ruta?: string | null
          severidad?: string
          tipo?: string
          umbral?: number | null
        }
        Update: {
          accion?: string | null
          activo?: boolean
          auto_reparar?: boolean
          check_key?: string
          comparador?: string
          cooldown_min?: number
          descripcion?: string | null
          max_intentos?: number
          ruta?: string | null
          severidad?: string
          tipo?: string
          umbral?: number | null
        }
        Relationships: []
      }
      guardian_incidents: {
        Row: {
          abierto_en: string
          cerrado_en: string | null
          check_key: string
          detalle: Json | null
          estado: string
          id: string
          intentos: number
          mejor_valor: number | null
          mensaje: string | null
          notificado_en: string | null
          severidad: string
          sin_progreso: number
          ultima_reparacion: string | null
          valor_actual: number | null
          valor_inicial: number | null
        }
        Insert: {
          abierto_en?: string
          cerrado_en?: string | null
          check_key: string
          detalle?: Json | null
          estado?: string
          id?: string
          intentos?: number
          mejor_valor?: number | null
          mensaje?: string | null
          notificado_en?: string | null
          severidad: string
          sin_progreso?: number
          ultima_reparacion?: string | null
          valor_actual?: number | null
          valor_inicial?: number | null
        }
        Update: {
          abierto_en?: string
          cerrado_en?: string | null
          check_key?: string
          detalle?: Json | null
          estado?: string
          id?: string
          intentos?: number
          mejor_valor?: number | null
          mensaje?: string | null
          notificado_en?: string | null
          severidad?: string
          sin_progreso?: number
          ultima_reparacion?: string | null
          valor_actual?: number | null
          valor_inicial?: number | null
        }
        Relationships: []
      }
      guardian_runs: {
        Row: {
          checks_error: number | null
          checks_ok: number | null
          checks_warn: number | null
          created_at: string
          duracion_ms: number | null
          id: string
          reparaciones: number | null
          snapshot: Json | null
        }
        Insert: {
          checks_error?: number | null
          checks_ok?: number | null
          checks_warn?: number | null
          created_at?: string
          duracion_ms?: number | null
          id?: string
          reparaciones?: number | null
          snapshot?: Json | null
        }
        Update: {
          checks_error?: number | null
          checks_ok?: number | null
          checks_warn?: number | null
          created_at?: string
          duracion_ms?: number | null
          id?: string
          reparaciones?: number | null
          snapshot?: Json | null
        }
        Relationships: []
      }
      historial_compradores: {
        Row: {
          created_at: string
          cumplimiento_pagos: number | null
          id: string
          indice_reclamos: number | null
          institucion_codigo: string | null
          institucion_nombre: string
          institucion_rut: string
          promedio_dias_pago: number | null
          promedio_monto_adjudicacion: number | null
          reclamos_resueltos: number | null
          score_confiabilidad: number | null
          total_adjudicaciones: number | null
          total_monto_adjudicado: number | null
          total_reclamos: number | null
          ultima_adjudicacion: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cumplimiento_pagos?: number | null
          id?: string
          indice_reclamos?: number | null
          institucion_codigo?: string | null
          institucion_nombre: string
          institucion_rut: string
          promedio_dias_pago?: number | null
          promedio_monto_adjudicacion?: number | null
          reclamos_resueltos?: number | null
          score_confiabilidad?: number | null
          total_adjudicaciones?: number | null
          total_monto_adjudicado?: number | null
          total_reclamos?: number | null
          ultima_adjudicacion?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cumplimiento_pagos?: number | null
          id?: string
          indice_reclamos?: number | null
          institucion_codigo?: string | null
          institucion_nombre?: string
          institucion_rut?: string
          promedio_dias_pago?: number | null
          promedio_monto_adjudicacion?: number | null
          reclamos_resueltos?: number | null
          score_confiabilidad?: number | null
          total_adjudicaciones?: number | null
          total_monto_adjudicado?: number | null
          total_reclamos?: number | null
          ultima_adjudicacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      imagenes_pexels: {
        Row: {
          actualizado_en: string
          clave: string
          consulta: string
          creado_en: string
          fotos: Json
          orientacion: string
          total: number
          usos: number
        }
        Insert: {
          actualizado_en?: string
          clave: string
          consulta: string
          creado_en?: string
          fotos?: Json
          orientacion?: string
          total?: number
          usos?: number
        }
        Update: {
          actualizado_en?: string
          clave?: string
          consulta?: string
          creado_en?: string
          fotos?: Json
          orientacion?: string
          total?: number
          usos?: number
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
      ingesta_ca_estado: {
        Row: {
          clave: string
          insertadas_ultima: number | null
          pagina_actual: number
          pasadas_completas: number
          total_paginas: number | null
          ttl_ms: number
          ultima_corrida: string | null
          ultimo_error: string | null
          ultimo_exito: string | null
          updated_at: string | null
        }
        Insert: {
          clave: string
          insertadas_ultima?: number | null
          pagina_actual?: number
          pasadas_completas?: number
          total_paginas?: number | null
          ttl_ms?: number
          ultima_corrida?: string | null
          ultimo_error?: string | null
          ultimo_exito?: string | null
          updated_at?: string | null
        }
        Update: {
          clave?: string
          insertadas_ultima?: number | null
          pagina_actual?: number
          pasadas_completas?: number
          total_paginas?: number | null
          ttl_ms?: number
          ultima_corrida?: string | null
          ultimo_error?: string | null
          ultimo_exito?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ingesta_estado: {
        Row: {
          clave: string
          updated_at: string
          valor: Json
        }
        Insert: {
          clave: string
          updated_at?: string
          valor?: Json
        }
        Update: {
          clave?: string
          updated_at?: string
          valor?: Json
        }
        Relationships: []
      }
      institucion_pago_snapshot: {
        Row: {
          created_at: string
          fecha: string
          fuente_licitacion: string | null
          id: number
          plazo_pago: string | null
          reclamos_12m: number | null
          rut: string
        }
        Insert: {
          created_at?: string
          fecha?: string
          fuente_licitacion?: string | null
          id?: number
          plazo_pago?: string | null
          reclamos_12m?: number | null
          rut: string
        }
        Update: {
          created_at?: string
          fecha?: string
          fuente_licitacion?: string | null
          id?: number
          plazo_pago?: string | null
          reclamos_12m?: number | null
          rut?: string
        }
        Relationships: []
      }
      institucion_riesgo: {
        Row: {
          created_at: string
          dias_pago_promedio: number | null
          id: number
          institucion_codigo: string | null
          nivel_riesgo: string | null
          reclamos_12m: number | null
        }
        Insert: {
          created_at?: string
          dias_pago_promedio?: number | null
          id?: number
          institucion_codigo?: string | null
          nivel_riesgo?: string | null
          reclamos_12m?: number | null
        }
        Update: {
          created_at?: string
          dias_pago_promedio?: number | null
          id?: number
          institucion_codigo?: string | null
          nivel_riesgo?: string | null
          reclamos_12m?: number | null
        }
        Relationships: []
      }
      instituciones: {
        Row: {
          codigo_entidad: string | null
          comuna: string | null
          conducta_pago: string | null
          correo: string | null
          created_at: string | null
          division: string | null
          domicilio_legal: string | null
          last_seen_at: string | null
          meta: Json | null
          nombre: string | null
          oc_monto_total: number | null
          oc_total: number | null
          oc_ultima_fecha: string | null
          pago_actualizado_el: string | null
          pago_fuente: string | null
          pago_promedio_dias: number | null
          pago_sigfe: boolean | null
          plazo_pago_texto: string | null
          reclamos_total: number | null
          reclamos_ultima_fecha: string | null
          region: string | null
          rut: string
          sector: string | null
          sitio_web: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          codigo_entidad?: string | null
          comuna?: string | null
          conducta_pago?: string | null
          correo?: string | null
          created_at?: string | null
          division?: string | null
          domicilio_legal?: string | null
          last_seen_at?: string | null
          meta?: Json | null
          nombre?: string | null
          oc_monto_total?: number | null
          oc_total?: number | null
          oc_ultima_fecha?: string | null
          pago_actualizado_el?: string | null
          pago_fuente?: string | null
          pago_promedio_dias?: number | null
          pago_sigfe?: boolean | null
          plazo_pago_texto?: string | null
          reclamos_total?: number | null
          reclamos_ultima_fecha?: string | null
          region?: string | null
          rut: string
          sector?: string | null
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo_entidad?: string | null
          comuna?: string | null
          conducta_pago?: string | null
          correo?: string | null
          created_at?: string | null
          division?: string | null
          domicilio_legal?: string | null
          last_seen_at?: string | null
          meta?: Json | null
          nombre?: string | null
          oc_monto_total?: number | null
          oc_total?: number | null
          oc_ultima_fecha?: string | null
          pago_actualizado_el?: string | null
          pago_fuente?: string | null
          pago_promedio_dias?: number | null
          pago_sigfe?: boolean | null
          plazo_pago_texto?: string | null
          reclamos_total?: number | null
          reclamos_ultima_fecha?: string | null
          region?: string | null
          rut?: string
          sector?: string | null
          sitio_web?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instituciones_gestion: {
        Row: {
          asignado_a: string | null
          bloqueada: boolean
          created_at: string
          estado: string
          etiquetas: string[] | null
          meta: Json | null
          motivo_bloqueo: string | null
          notas: string | null
          prioridad: number
          rut: string
          updated_at: string
        }
        Insert: {
          asignado_a?: string | null
          bloqueada?: boolean
          created_at?: string
          estado?: string
          etiquetas?: string[] | null
          meta?: Json | null
          motivo_bloqueo?: string | null
          notas?: string | null
          prioridad?: number
          rut: string
          updated_at?: string
        }
        Update: {
          asignado_a?: string | null
          bloqueada?: boolean
          created_at?: string
          estado?: string
          etiquetas?: string[] | null
          meta?: Json | null
          motivo_bloqueo?: string | null
          notas?: string | null
          prioridad?: number
          rut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instituciones_gestion_rut_fkey"
            columns: ["rut"]
            isOneToOne: true
            referencedRelation: "instituciones"
            referencedColumns: ["rut"]
          },
          {
            foreignKeyName: "instituciones_gestion_rut_fkey"
            columns: ["rut"]
            isOneToOne: true
            referencedRelation: "instituciones_dashboard"
            referencedColumns: ["rut"]
          },
        ]
      }
      instituciones_interacciones: {
        Row: {
          created_at: string
          id: string
          meta: Json | null
          proxima_accion: string | null
          proxima_fecha: string | null
          resultado: string | null
          resumen: string | null
          rut: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta?: Json | null
          proxima_accion?: string | null
          proxima_fecha?: string | null
          resultado?: string | null
          resumen?: string | null
          rut: string
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          meta?: Json | null
          proxima_accion?: string | null
          proxima_fecha?: string | null
          resultado?: string | null
          resumen?: string | null
          rut?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "instituciones_interacciones_rut_fkey"
            columns: ["rut"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["rut"]
          },
          {
            foreignKeyName: "instituciones_interacciones_rut_fkey"
            columns: ["rut"]
            isOneToOne: false
            referencedRelation: "instituciones_dashboard"
            referencedColumns: ["rut"]
          },
        ]
      }
      instituciones_publicas: {
        Row: {
          cantidad_compras: number | null
          comuna: string | null
          created_at: string | null
          direccion: string | null
          email_contacto: string | null
          fecha_extraccion: string | null
          id: string
          monto_total_compras: number | null
          nombre: string
          region: string | null
          rut: string
          telefono: string | null
          tipo_institucion: string | null
          ultima_actualizacion: string | null
          ultima_compra_fecha: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          cantidad_compras?: number | null
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          email_contacto?: string | null
          fecha_extraccion?: string | null
          id?: string
          monto_total_compras?: number | null
          nombre: string
          region?: string | null
          rut: string
          telefono?: string | null
          tipo_institucion?: string | null
          ultima_actualizacion?: string | null
          ultima_compra_fecha?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          cantidad_compras?: number | null
          comuna?: string | null
          created_at?: string | null
          direccion?: string | null
          email_contacto?: string | null
          fecha_extraccion?: string | null
          id?: string
          monto_total_compras?: number | null
          nombre?: string
          region?: string | null
          rut?: string
          telefono?: string | null
          tipo_institucion?: string | null
          ultima_actualizacion?: string | null
          ultima_compra_fecha?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          activo: boolean | null
          categoria: string | null
          costo_neto: number
          created_at: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          keywords: string[] | null
          keywords_text: string | null
          margen_comercial: number | null
          margen_minimo: number | null
          margen_objetivo: number | null
          nombre: string | null
          nombre_producto: string | null
          organization_id: string | null
          precio: number | null
          precio_unitario: number | null
          proveedor: string | null
          sku: string
          stock_disponible: number | null
          tiempo_entrega_dias: number | null
          unidad: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activo?: boolean | null
          categoria?: string | null
          costo_neto?: number
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          keywords?: string[] | null
          keywords_text?: string | null
          margen_comercial?: number | null
          margen_minimo?: number | null
          margen_objetivo?: number | null
          nombre?: string | null
          nombre_producto?: string | null
          organization_id?: string | null
          precio?: number | null
          precio_unitario?: number | null
          proveedor?: string | null
          sku: string
          stock_disponible?: number | null
          tiempo_entrega_dias?: number | null
          unidad?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activo?: boolean | null
          categoria?: string | null
          costo_neto?: number
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          keywords?: string[] | null
          keywords_text?: string | null
          margen_comercial?: number | null
          margen_minimo?: number | null
          margen_objetivo?: number | null
          nombre?: string | null
          nombre_producto?: string | null
          organization_id?: string | null
          precio?: number | null
          precio_unitario?: number | null
          proveedor?: string | null
          sku?: string
          stock_disponible?: number | null
          tiempo_entrega_dias?: number | null
          unidad?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lic_item_matches: {
        Row: {
          cantidad: number | null
          cliente_id: string
          fecha_cierre: string | null
          id: string
          inventario_id: string | null
          item_id: string
          licitacion_codigo: string
          nombre_producto: string | null
          nombre_solicitado: string | null
          precio_unitario: number | null
          score: number | null
          sku: string | null
          updated_at: string
        }
        Insert: {
          cantidad?: number | null
          cliente_id: string
          fecha_cierre?: string | null
          id?: string
          inventario_id?: string | null
          item_id: string
          licitacion_codigo: string
          nombre_producto?: string | null
          nombre_solicitado?: string | null
          precio_unitario?: number | null
          score?: number | null
          sku?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number | null
          cliente_id?: string
          fecha_cierre?: string | null
          id?: string
          inventario_id?: string | null
          item_id?: string
          licitacion_codigo?: string
          nombre_producto?: string | null
          nombre_solicitado?: string | null
          precio_unitario?: number | null
          score?: number | null
          sku?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      licitacion_documentos: {
        Row: {
          created_at: string | null
          descargado: boolean | null
          id: number
          licitacion_codigo: string
          nombre: string | null
          tipo_documento: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          descargado?: boolean | null
          id?: number
          licitacion_codigo: string
          nombre?: string | null
          tipo_documento?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          descargado?: boolean | null
          id?: number
          licitacion_codigo?: string
          nombre?: string | null
          tipo_documento?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_institucion"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_items"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_all"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_con_match"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sin_productos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sospechosas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_documentos_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_urgentes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      licitacion_items: {
        Row: {
          cantidad: string | null
          created_at: string | null
          descripcion: string | null
          id: number
          id_producto_inventario: string | null
          incluido_en_oferta: boolean | null
          item_index: number
          licitacion_codigo: string
          margen_estimado: number | null
          match_confidence: number | null
          match_method: string | null
          match_procesado: boolean | null
          nombre: string | null
          notas: string | null
          precio_total_sugerido: number | null
          precio_unitario_sugerido: number | null
          producto_id: string | null
          unidad: string | null
        }
        Insert: {
          cantidad?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          id_producto_inventario?: string | null
          incluido_en_oferta?: boolean | null
          item_index: number
          licitacion_codigo: string
          margen_estimado?: number | null
          match_confidence?: number | null
          match_method?: string | null
          match_procesado?: boolean | null
          nombre?: string | null
          notas?: string | null
          precio_total_sugerido?: number | null
          precio_unitario_sugerido?: number | null
          producto_id?: string | null
          unidad?: string | null
        }
        Update: {
          cantidad?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: number
          id_producto_inventario?: string | null
          incluido_en_oferta?: boolean | null
          item_index?: number
          licitacion_codigo?: string
          margen_estimado?: number | null
          match_confidence?: number | null
          match_method?: string | null
          match_procesado?: boolean | null
          nombre?: string | null
          notas?: string | null
          precio_total_sugerido?: number | null
          precio_unitario_sugerido?: number | null
          producto_id?: string | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_institucion"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_items"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_all"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_con_match"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sin_productos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sospechosas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "licitacion_items_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_urgentes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      licitaciones: {
        Row: {
          categoria: string | null
          categoria_match: string | null
          codigo: string
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          id: number
          last_scraped_at: string | null
          link_detalle: string | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          categoria_match?: string | null
          codigo: string
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          id?: number
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre: string
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          categoria_match?: string | null
          codigo?: string
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          id?: number
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
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
      licitaciones_adjuntos: {
        Row: {
          bajado_en: string
          bases_id: string | null
          bases_intento_en: string | null
          bases_intentos: number
          bases_pendiente: boolean
          bytes: number | null
          codigo: string
          content_type: string | null
          descripcion: string | null
          es_bases: boolean
          fecha_adjunto: string | null
          id: string
          nombre: string
          ocr_hecho: boolean
          ocr_pendiente: boolean
          storage_path: string | null
          tipo: string | null
        }
        Insert: {
          bajado_en?: string
          bases_id?: string | null
          bases_intento_en?: string | null
          bases_intentos?: number
          bases_pendiente?: boolean
          bytes?: number | null
          codigo: string
          content_type?: string | null
          descripcion?: string | null
          es_bases?: boolean
          fecha_adjunto?: string | null
          id?: string
          nombre: string
          ocr_hecho?: boolean
          ocr_pendiente?: boolean
          storage_path?: string | null
          tipo?: string | null
        }
        Update: {
          bajado_en?: string
          bases_id?: string | null
          bases_intento_en?: string | null
          bases_intentos?: number
          bases_pendiente?: boolean
          bytes?: number | null
          codigo?: string
          content_type?: string | null
          descripcion?: string | null
          es_bases?: boolean
          fecha_adjunto?: string | null
          id?: string
          nombre?: string
          ocr_hecho?: boolean
          ocr_pendiente?: boolean
          storage_path?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      licitaciones_adjuntos_estado: {
        Row: {
          adjuntos_mp_solo_captcha: boolean | null
          archivos: number
          codigo: string
          error: string | null
          pendientes: number
          revisado_en: string
          url_adjuntos_mp: string | null
        }
        Insert: {
          adjuntos_mp_solo_captcha?: boolean | null
          archivos?: number
          codigo: string
          error?: string | null
          pendientes?: number
          revisado_en?: string
          url_adjuntos_mp?: string | null
        }
        Update: {
          adjuntos_mp_solo_captcha?: boolean | null
          archivos?: number
          codigo?: string
          error?: string | null
          pendientes?: number
          revisado_en?: string
          url_adjuntos_mp?: string | null
        }
        Relationships: []
      }
      licitaciones_api: {
        Row: {
          codigo: string
          created_at: string | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          last_scraped_at: string | null
          link_detalle: string | null
          organismo: string | null
          presupuesto_estimado: number | null
          stale: boolean
          stale_marked_at: string | null
          titulo: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          organismo?: string | null
          presupuesto_estimado?: number | null
          stale?: boolean
          stale_marked_at?: string | null
          titulo?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          organismo?: string | null
          presupuesto_estimado?: number | null
          stale?: boolean
          stale_marked_at?: string | null
          titulo?: string | null
        }
        Relationships: []
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
          match_encontrado: boolean
          match_score: number | null
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
          match_encontrado?: boolean
          match_score?: number | null
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
          match_encontrado?: boolean
          match_score?: number | null
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
          codigo_producto_inventario: string | null
          correlativo: number | null
          created_at: string
          descripcion: string | null
          id: string
          id_producto_inventario: string | null
          licitacion_id: string
          match_confidence: number | null
          match_method: string | null
          nombre_norm: string | null
          nombre_producto: string
          unidad: string | null
        }
        Insert: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          codigo_producto_inventario?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          id_producto_inventario?: string | null
          licitacion_id: string
          match_confidence?: number | null
          match_method?: string | null
          nombre_norm?: string | null
          nombre_producto: string
          unidad?: string | null
        }
        Update: {
          cantidad?: number
          categoria?: string | null
          codigo_categoria?: string | null
          codigo_producto?: string | null
          codigo_producto_inventario?: string | null
          correlativo?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          id_producto_inventario?: string | null
          licitacion_id?: string
          match_confidence?: number | null
          match_method?: string | null
          nombre_norm?: string | null
          nombre_producto?: string
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "licitaciones_bi_items_id_producto_inventario_fkey"
            columns: ["id_producto_inventario"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "licitaciones_bi_items_licitacion_id_fkey"
            columns: ["licitacion_id"]
            isOneToOne: false
            referencedRelation: "licitaciones_bi"
            referencedColumns: ["id"]
          },
        ]
      }
      licitaciones_logs: {
        Row: {
          created_at: string | null
          detalle: Json | null
          estado: string | null
          id: number
          monto: string | null
          nombre_licitacion: string | null
        }
        Insert: {
          created_at?: string | null
          detalle?: Json | null
          estado?: string | null
          id?: number
          monto?: string | null
          nombre_licitacion?: string | null
        }
        Update: {
          created_at?: string | null
          detalle?: Json | null
          estado?: string | null
          id?: number
          monto?: string | null
          nombre_licitacion?: string | null
        }
        Relationships: []
      }
      lista_precios_firmavb: {
        Row: {
          activo: boolean | null
          CATEGORIA: string | null
          CODIGO: string | null
          COSTO: string | null
          created_at: string | null
          DESCRIPCION: string | null
          id: number
          "Mg Comercial": string | null
          "Precio de venta neto": string | null
          PROVEEDOR: string | null
          Unidad: string | null
        }
        Insert: {
          activo?: boolean | null
          CATEGORIA?: string | null
          CODIGO?: string | null
          COSTO?: string | null
          created_at?: string | null
          DESCRIPCION?: string | null
          id?: number
          "Mg Comercial"?: string | null
          "Precio de venta neto"?: string | null
          PROVEEDOR?: string | null
          Unidad?: string | null
        }
        Update: {
          activo?: boolean | null
          CATEGORIA?: string | null
          CODIGO?: string | null
          COSTO?: string | null
          created_at?: string | null
          DESCRIPCION?: string | null
          id?: number
          "Mg Comercial"?: string | null
          "Precio de venta neto"?: string | null
          PROVEEDOR?: string | null
          Unidad?: string | null
        }
        Relationships: []
      }
      marketing_campanas: {
        Row: {
          actualizado_en: string
          audiencia_estimada: number | null
          audiencia_estimada_final: number | null
          canal_primario: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          meta_asistencia: number | null
          meta_conversiones: number | null
          meta_registros: number | null
          nombre: string
          notas: string | null
          objetivo: string
          presupuesto: number | null
          segmentos_seleccionados: string[] | null
        }
        Insert: {
          actualizado_en?: string
          audiencia_estimada?: number | null
          audiencia_estimada_final?: number | null
          canal_primario?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          meta_asistencia?: number | null
          meta_conversiones?: number | null
          meta_registros?: number | null
          nombre: string
          notas?: string | null
          objetivo: string
          presupuesto?: number | null
          segmentos_seleccionados?: string[] | null
        }
        Update: {
          actualizado_en?: string
          audiencia_estimada?: number | null
          audiencia_estimada_final?: number | null
          canal_primario?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          meta_asistencia?: number | null
          meta_conversiones?: number | null
          meta_registros?: number | null
          nombre?: string
          notas?: string | null
          objetivo?: string
          presupuesto?: number | null
          segmentos_seleccionados?: string[] | null
        }
        Relationships: []
      }
      marketing_contactos: {
        Row: {
          actualizado_en: string
          campos_adicionales: Json | null
          categoria: string | null
          ciudad: string | null
          consentimiento_fecha: string | null
          consentimiento_marketing: boolean | null
          creado_en: string
          datos_enriquecimiento: Json | null
          email: string
          email_validado: boolean | null
          empresa: string | null
          estado_contacto: string
          estado_email: string | null
          estado_suscripcion: string | null
          etiquetas: string[] | null
          frecuencia_contacto: string | null
          fuente_datos: string | null
          fuente_primaria: string | null
          id: string
          intentos_validacion: number | null
          nombre: string | null
          origen: string | null
          pais: string | null
          puntuacion_relevancia: number | null
          rubro: string | null
          telefono: string | null
          telefono_pais: string | null
          ultima_validacion: string | null
          ultimo_contacto_en: string | null
        }
        Insert: {
          actualizado_en?: string
          campos_adicionales?: Json | null
          categoria?: string | null
          ciudad?: string | null
          consentimiento_fecha?: string | null
          consentimiento_marketing?: boolean | null
          creado_en?: string
          datos_enriquecimiento?: Json | null
          email: string
          email_validado?: boolean | null
          empresa?: string | null
          estado_contacto?: string
          estado_email?: string | null
          estado_suscripcion?: string | null
          etiquetas?: string[] | null
          frecuencia_contacto?: string | null
          fuente_datos?: string | null
          fuente_primaria?: string | null
          id?: string
          intentos_validacion?: number | null
          nombre?: string | null
          origen?: string | null
          pais?: string | null
          puntuacion_relevancia?: number | null
          rubro?: string | null
          telefono?: string | null
          telefono_pais?: string | null
          ultima_validacion?: string | null
          ultimo_contacto_en?: string | null
        }
        Update: {
          actualizado_en?: string
          campos_adicionales?: Json | null
          categoria?: string | null
          ciudad?: string | null
          consentimiento_fecha?: string | null
          consentimiento_marketing?: boolean | null
          creado_en?: string
          datos_enriquecimiento?: Json | null
          email?: string
          email_validado?: boolean | null
          empresa?: string | null
          estado_contacto?: string
          estado_email?: string | null
          estado_suscripcion?: string | null
          etiquetas?: string[] | null
          frecuencia_contacto?: string | null
          fuente_datos?: string | null
          fuente_primaria?: string | null
          id?: string
          intentos_validacion?: number | null
          nombre?: string | null
          origen?: string | null
          pais?: string | null
          puntuacion_relevancia?: number | null
          rubro?: string | null
          telefono?: string | null
          telefono_pais?: string | null
          ultima_validacion?: string | null
          ultimo_contacto_en?: string | null
        }
        Relationships: []
      }
      marketing_contactos_auditoria: {
        Row: {
          accion: string
          cantidad_afectada: number | null
          detalles: Json | null
          fuente: string | null
          id: string
          realizado_en: string | null
          realizado_por: string | null
        }
        Insert: {
          accion: string
          cantidad_afectada?: number | null
          detalles?: Json | null
          fuente?: string | null
          id?: string
          realizado_en?: string | null
          realizado_por?: string | null
        }
        Update: {
          accion?: string
          cantidad_afectada?: number | null
          detalles?: Json | null
          fuente?: string | null
          id?: string
          realizado_en?: string | null
          realizado_por?: string | null
        }
        Relationships: []
      }
      marketing_ejecucion: {
        Row: {
          abierto: boolean | null
          clicks: number | null
          contacto_id: string | null
          conversiones: number | null
          creado_en: string
          email: string | null
          estado: string
          fecha_envio: string | null
          fecha_respuesta: string | null
          id: string
          id_externo: string | null
          pieza_id: string
          respuesta_codigo: number | null
          respuesta_mensaje: string | null
        }
        Insert: {
          abierto?: boolean | null
          clicks?: number | null
          contacto_id?: string | null
          conversiones?: number | null
          creado_en?: string
          email?: string | null
          estado?: string
          fecha_envio?: string | null
          fecha_respuesta?: string | null
          id?: string
          id_externo?: string | null
          pieza_id: string
          respuesta_codigo?: number | null
          respuesta_mensaje?: string | null
        }
        Update: {
          abierto?: boolean | null
          clicks?: number | null
          contacto_id?: string | null
          conversiones?: number | null
          creado_en?: string
          email?: string | null
          estado?: string
          fecha_envio?: string | null
          fecha_respuesta?: string | null
          id?: string
          id_externo?: string | null
          pieza_id?: string
          respuesta_codigo?: number | null
          respuesta_mensaje?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_ejecucion_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "marketing_contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ejecucion_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "marketing_contactos_segmentados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_ejecucion_pieza_id_fkey"
            columns: ["pieza_id"]
            isOneToOne: false
            referencedRelation: "marketing_piezas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_metricas: {
        Row: {
          actualizado_en: string
          campana_id: string
          fecha: string
          id: string
          tasa_apertura: number | null
          tasa_click: number | null
          tasa_conversion: number | null
          tasa_entrega: number | null
          total_abiertos: number | null
          total_clicks: number | null
          total_conversiones: number | null
          total_entregados: number | null
          total_enviados: number | null
        }
        Insert: {
          actualizado_en?: string
          campana_id: string
          fecha: string
          id?: string
          tasa_apertura?: number | null
          tasa_click?: number | null
          tasa_conversion?: number | null
          tasa_entrega?: number | null
          total_abiertos?: number | null
          total_clicks?: number | null
          total_conversiones?: number | null
          total_entregados?: number | null
          total_enviados?: number | null
        }
        Update: {
          actualizado_en?: string
          campana_id?: string
          fecha?: string
          id?: string
          tasa_apertura?: number | null
          tasa_click?: number | null
          tasa_conversion?: number | null
          tasa_entrega?: number | null
          total_abiertos?: number | null
          total_clicks?: number | null
          total_conversiones?: number | null
          total_entregados?: number | null
          total_enviados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_metricas_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "marketing_campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_piezas: {
        Row: {
          asunto: string | null
          campana_id: string
          canal: string
          cantidad_objetivo: number | null
          contenido: string
          creado_en: string
          estado: string
          hashtags: string | null
          id: string
          imagen_url: string | null
          nombre: string
          programado_para: string | null
          tipo: string
          url_tracking: string | null
        }
        Insert: {
          asunto?: string | null
          campana_id: string
          canal: string
          cantidad_objetivo?: number | null
          contenido: string
          creado_en?: string
          estado?: string
          hashtags?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          programado_para?: string | null
          tipo: string
          url_tracking?: string | null
        }
        Update: {
          asunto?: string | null
          campana_id?: string
          canal?: string
          cantidad_objetivo?: number | null
          contenido?: string
          creado_en?: string
          estado?: string
          hashtags?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          programado_para?: string | null
          tipo?: string
          url_tracking?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_piezas_campana_id_fkey"
            columns: ["campana_id"]
            isOneToOne: false
            referencedRelation: "marketing_campanas"
            referencedColumns: ["id"]
          },
        ]
      }
      match_overrides: {
        Row: {
          accion: string
          cliente_id: string
          codigo: string
          created_at: string
          id: string
          inventario_id: string | null
          item_nombre: string | null
          item_ref: string
          proceso_tipo: string
          score_manual: number | null
          updated_at: string
        }
        Insert: {
          accion: string
          cliente_id?: string
          codigo: string
          created_at?: string
          id?: string
          inventario_id?: string | null
          item_nombre?: string | null
          item_ref: string
          proceso_tipo?: string
          score_manual?: number | null
          updated_at?: string
        }
        Update: {
          accion?: string
          cliente_id?: string
          codigo?: string
          created_at?: string
          id?: string
          inventario_id?: string | null
          item_nombre?: string | null
          item_ref?: string
          proceso_tipo?: string
          score_manual?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      medios_menciones: {
        Row: {
          consulta: string | null
          creado_en: string
          fecha: string | null
          id: number
          licitacion_codigo: string | null
          medio: string | null
          organismo: string
          organismo_norm: string
          resumen: string | null
          tipo_medio: string
          titulo: string
          url: string
        }
        Insert: {
          consulta?: string | null
          creado_en?: string
          fecha?: string | null
          id?: never
          licitacion_codigo?: string | null
          medio?: string | null
          organismo: string
          organismo_norm: string
          resumen?: string | null
          tipo_medio?: string
          titulo: string
          url: string
        }
        Update: {
          consulta?: string | null
          creado_en?: string
          fecha?: string | null
          id?: never
          licitacion_codigo?: string | null
          medio?: string | null
          organismo?: string
          organismo_norm?: string
          resumen?: string | null
          tipo_medio?: string
          titulo?: string
          url?: string
        }
        Relationships: []
      }
      medios_organismos_estado: {
        Row: {
          error: string | null
          menciones: number
          organismo: string
          organismo_norm: string
          revisado_en: string
        }
        Insert: {
          error?: string | null
          menciones?: number
          organismo: string
          organismo_norm: string
          revisado_en?: string
        }
        Update: {
          error?: string | null
          menciones?: number
          organismo?: string
          organismo_norm?: string
          revisado_en?: string
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
      notification_preferences: {
        Row: {
          created_at: string | null
          driver_arrived: boolean | null
          email_enabled: boolean | null
          id: string
          in_app_enabled: boolean | null
          new_chat_message: boolean | null
          push_enabled: boolean | null
          trip_cancelled: boolean | null
          trip_completed: boolean | null
          trip_reminder_10min: boolean | null
          trip_status_change: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          driver_arrived?: boolean | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          new_chat_message?: boolean | null
          push_enabled?: boolean | null
          trip_cancelled?: boolean | null
          trip_completed?: boolean | null
          trip_reminder_10min?: boolean | null
          trip_status_change?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          driver_arrived?: boolean | null
          email_enabled?: boolean | null
          id?: string
          in_app_enabled?: boolean | null
          new_chat_message?: boolean | null
          push_enabled?: boolean | null
          trip_cancelled?: boolean | null
          trip_completed?: boolean | null
          trip_reminder_10min?: boolean | null
          trip_status_change?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      oc_lineas: {
        Row: {
          cantidad: number | null
          categoria: string | null
          codigo: string
          correlativo: number | null
          created_at: string | null
          fecha: string | null
          linea_id: string
          moneda: string | null
          monto_linea: number | null
          organismo: string | null
          precio_neto: number | null
          producto: string | null
          proveedor_nombre: string | null
          rubro_n1: string | null
          rut_organismo: string | null
          rut_proveedor: string | null
          tipo: string | null
        }
        Insert: {
          cantidad?: number | null
          categoria?: string | null
          codigo: string
          correlativo?: number | null
          created_at?: string | null
          fecha?: string | null
          linea_id: string
          moneda?: string | null
          monto_linea?: number | null
          organismo?: string | null
          precio_neto?: number | null
          producto?: string | null
          proveedor_nombre?: string | null
          rubro_n1?: string | null
          rut_organismo?: string | null
          rut_proveedor?: string | null
          tipo?: string | null
        }
        Update: {
          cantidad?: number | null
          categoria?: string | null
          codigo?: string
          correlativo?: number | null
          created_at?: string | null
          fecha?: string | null
          linea_id?: string
          moneda?: string | null
          monto_linea?: number | null
          organismo?: string | null
          precio_neto?: number | null
          producto?: string | null
          proveedor_nombre?: string | null
          rubro_n1?: string | null
          rut_organismo?: string | null
          rut_proveedor?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      ocds_meses: {
        Row: {
          anio: number
          completo: boolean
          mes: number
          offset_leido: number
          total: number | null
          updated_at: string
        }
        Insert: {
          anio: number
          completo?: boolean
          mes: number
          offset_leido?: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          anio?: number
          completo?: boolean
          mes?: number
          offset_leido?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ocds_procesos: {
        Row: {
          adjudicatarios: Json | null
          award_leido_en: string | null
          codigo: string
          comprador_id: string | null
          comprador_nombre: string | null
          comprador_rut: string | null
          created_at: string
          estado_award: string | null
          estado_tender: string | null
          fecha_adjudicacion: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          items: Json | null
          metodo: string | null
          moneda: string | null
          monto_adjudicado: number | null
          monto_estimado: number | null
          num_oferentes: number | null
          ocid: string | null
          oferentes: Json | null
          tender_leido_en: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          adjudicatarios?: Json | null
          award_leido_en?: string | null
          codigo: string
          comprador_id?: string | null
          comprador_nombre?: string | null
          comprador_rut?: string | null
          created_at?: string
          estado_award?: string | null
          estado_tender?: string | null
          fecha_adjudicacion?: string | null
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          items?: Json | null
          metodo?: string | null
          moneda?: string | null
          monto_adjudicado?: number | null
          monto_estimado?: number | null
          num_oferentes?: number | null
          ocid?: string | null
          oferentes?: Json | null
          tender_leido_en?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          adjudicatarios?: Json | null
          award_leido_en?: string | null
          codigo?: string
          comprador_id?: string | null
          comprador_nombre?: string | null
          comprador_rut?: string | null
          created_at?: string
          estado_award?: string | null
          estado_tender?: string | null
          fecha_adjudicacion?: string | null
          fecha_cierre?: string | null
          fecha_publicacion?: string | null
          items?: Json | null
          metodo?: string | null
          moneda?: string | null
          monto_adjudicado?: number | null
          monto_estimado?: number | null
          num_oferentes?: number | null
          ocid?: string | null
          oferentes?: Json | null
          tender_leido_en?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ofertas: {
        Row: {
          adjudicada: boolean | null
          estado: string | null
          fecha_creacion: string | null
          fecha_envio: string | null
          fecha_resultado: string | null
          id: number
          licitacion_codigo: string
          monto_total: number | null
          notas: string | null
          oferta_id: string | null
        }
        Insert: {
          adjudicada?: boolean | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_envio?: string | null
          fecha_resultado?: string | null
          id?: number
          licitacion_codigo: string
          monto_total?: number | null
          notas?: string | null
          oferta_id?: string | null
        }
        Update: {
          adjudicada?: boolean | null
          estado?: string | null
          fecha_creacion?: string | null
          fecha_envio?: string | null
          fecha_resultado?: string | null
          id?: number
          licitacion_codigo?: string
          monto_total?: number | null
          notas?: string | null
          oferta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_institucion"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "compras_agiles_con_items"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_all"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_con_match"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sin_productos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_sospechosas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ofertas_licitacion_codigo_fkey"
            columns: ["licitacion_codigo"]
            isOneToOne: false
            referencedRelation: "licitaciones_urgentes"
            referencedColumns: ["codigo"]
          },
        ]
      }
      orden_compra_items: {
        Row: {
          cantidad: number | null
          created_at: string | null
          descripcion: string | null
          id: string
          item_index: number
          nombre_producto: string | null
          orden_compra_codigo: string
          orden_compra_id: number | null
          precio_unitario: number | null
          producto_id: string | null
          subtotal: number | null
          unidad: string | null
        }
        Insert: {
          cantidad?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          item_index: number
          nombre_producto?: string | null
          orden_compra_codigo: string
          orden_compra_id?: number | null
          precio_unitario?: number | null
          producto_id?: string | null
          subtotal?: number | null
          unidad?: string | null
        }
        Update: {
          cantidad?: number | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          item_index?: number
          nombre_producto?: string | null
          orden_compra_codigo?: string
          orden_compra_id?: number | null
          precio_unitario?: number | null
          producto_id?: string | null
          subtotal?: number | null
          unidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orden_compra_items_codigo"
            columns: ["orden_compra_codigo"]
            isOneToOne: false
            referencedRelation: "oc_enriquecidas"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "fk_orden_compra_items_codigo"
            columns: ["orden_compra_codigo"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "orden_compra_items_orden_fk"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "oc_enriquecidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_compra_items_orden_fk"
            columns: ["orden_compra_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_compra: {
        Row: {
          codigo: string
          created_at: string | null
          datos_json: Json | null
          demandante: string | null
          estado: string | null
          fecha_emision: string | null
          fecha_envio_oc: string | null
          id: number
          iva: number | null
          last_scraped_at: string | null
          link_oficial: string | null
          moneda: string | null
          monto_total: number | null
          neto: number | null
          nombre: string
          numero_licitacion: string | null
          numero_oc: string | null
          organismo_comprador: string | null
          proveedor: string | null
          proveedor_nombre: string | null
          raw_json: Json | null
          relevante: boolean
          rut_demandante: string | null
          rut_proveedor: string | null
          stale: boolean
          stale_marked_at: string | null
          subtotal: number | null
          total: number | null
          unidad_compra: string | null
          updated_at: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          datos_json?: Json | null
          demandante?: string | null
          estado?: string | null
          fecha_emision?: string | null
          fecha_envio_oc?: string | null
          id?: number
          iva?: number | null
          last_scraped_at?: string | null
          link_oficial?: string | null
          moneda?: string | null
          monto_total?: number | null
          neto?: number | null
          nombre: string
          numero_licitacion?: string | null
          numero_oc?: string | null
          organismo_comprador?: string | null
          proveedor?: string | null
          proveedor_nombre?: string | null
          raw_json?: Json | null
          relevante?: boolean
          rut_demandante?: string | null
          rut_proveedor?: string | null
          stale?: boolean
          stale_marked_at?: string | null
          subtotal?: number | null
          total?: number | null
          unidad_compra?: string | null
          updated_at?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          datos_json?: Json | null
          demandante?: string | null
          estado?: string | null
          fecha_emision?: string | null
          fecha_envio_oc?: string | null
          id?: number
          iva?: number | null
          last_scraped_at?: string | null
          link_oficial?: string | null
          moneda?: string | null
          monto_total?: number | null
          neto?: number | null
          nombre?: string
          numero_licitacion?: string | null
          numero_oc?: string | null
          organismo_comprador?: string | null
          proveedor?: string | null
          proveedor_nombre?: string | null
          raw_json?: Json | null
          relevante?: boolean
          rut_demandante?: string | null
          rut_proveedor?: string | null
          stale?: boolean
          stale_marked_at?: string | null
          subtotal?: number | null
          total?: number | null
          unidad_compra?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ordenes_compra_items: {
        Row: {
          cantidad: number | null
          cargos: number | null
          codigo_producto: string | null
          created_at: string | null
          descuento: number | null
          especificaciones: string | null
          id: string
          numero_oc: string | null
          precio_unitario: number | null
          producto: string | null
          producto_norm: string | null
          raw_json: Json | null
          unidad: string | null
          valor_total: number | null
        }
        Insert: {
          cantidad?: number | null
          cargos?: number | null
          codigo_producto?: string | null
          created_at?: string | null
          descuento?: number | null
          especificaciones?: string | null
          id?: string
          numero_oc?: string | null
          precio_unitario?: number | null
          producto?: string | null
          producto_norm?: string | null
          raw_json?: Json | null
          unidad?: string | null
          valor_total?: number | null
        }
        Update: {
          cantidad?: number | null
          cargos?: number | null
          codigo_producto?: string | null
          created_at?: string | null
          descuento?: number | null
          especificaciones?: string | null
          id?: string
          numero_oc?: string | null
          precio_unitario?: number | null
          producto?: string | null
          producto_norm?: string | null
          raw_json?: Json | null
          unidad?: string | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_compra_items_numero_oc_fkey"
            columns: ["numero_oc"]
            isOneToOne: false
            referencedRelation: "oc_enriquecidas"
            referencedColumns: ["numero_oc"]
          },
          {
            foreignKeyName: "ordenes_compra_items_numero_oc_fkey"
            columns: ["numero_oc"]
            isOneToOne: false
            referencedRelation: "ordenes_compra"
            referencedColumns: ["numero_oc"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pending_extension_sync: {
        Row: {
          attempts: number | null
          completed_at: string | null
          context: Json | null
          first_seen_at: string | null
          id: number
          identifier: string
          kind: string
          last_attempt_at: string | null
          last_error: string | null
          payload: Json | null
          reason: string | null
          status: string | null
          url: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          context?: Json | null
          first_seen_at?: string | null
          id?: number
          identifier: string
          kind: string
          last_attempt_at?: string | null
          last_error?: string | null
          payload?: Json | null
          reason?: string | null
          status?: string | null
          url?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          context?: Json | null
          first_seen_at?: string | null
          id?: number
          identifier?: string
          kind?: string
          last_attempt_at?: string | null
          last_error?: string | null
          payload?: Json | null
          reason?: string | null
          status?: string | null
          url?: string | null
        }
        Relationships: []
      }
      pipeline: {
        Row: {
          archivos: Json | null
          asignado_a: string | null
          created_at: string | null
          etapa: Database["public"]["Enums"]["pipeline_etapa"]
          etapa_historial: Json | null
          fecha_cierre: string | null
          id: string
          institucion: string | null
          match_score: number | null
          monto_estimado: number | null
          notas: string | null
          oportunidad_id: string
          oportunidad_tipo: string
          posicion: number | null
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archivos?: Json | null
          asignado_a?: string | null
          created_at?: string | null
          etapa?: Database["public"]["Enums"]["pipeline_etapa"]
          etapa_historial?: Json | null
          fecha_cierre?: string | null
          id?: string
          institucion?: string | null
          match_score?: number | null
          monto_estimado?: number | null
          notas?: string | null
          oportunidad_id: string
          oportunidad_tipo?: string
          posicion?: number | null
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archivos?: Json | null
          asignado_a?: string | null
          created_at?: string | null
          etapa?: Database["public"]["Enums"]["pipeline_etapa"]
          etapa_historial?: Json | null
          fecha_cierre?: string | null
          id?: string
          institucion?: string | null
          match_score?: number | null
          monto_estimado?: number | null
          notas?: string | null
          oportunidad_id?: string
          oportunidad_tipo?: string
          posicion?: number | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      planes: {
        Row: {
          activo: boolean | null
          comision_porcentaje: number | null
          comision_tope_mensual: number | null
          id: string
          inventario_max: number | null
          licitaciones_dia: number | null
          matching_ia: boolean | null
          max_usuarios: number | null
          nombre: string
          precio_mensual: number | null
        }
        Insert: {
          activo?: boolean | null
          comision_porcentaje?: number | null
          comision_tope_mensual?: number | null
          id: string
          inventario_max?: number | null
          licitaciones_dia?: number | null
          matching_ia?: boolean | null
          max_usuarios?: number | null
          nombre: string
          precio_mensual?: number | null
        }
        Update: {
          activo?: boolean | null
          comision_porcentaje?: number | null
          comision_tope_mensual?: number | null
          id?: string
          inventario_max?: number | null
          licitaciones_dia?: number | null
          matching_ia?: boolean | null
          max_usuarios?: number | null
          nombre?: string
          precio_mensual?: number | null
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
      prospect_logs: {
        Row: {
          accion: string
          created_at: string | null
          detalles: Json | null
          fecha: string | null
          id: string
          prospect_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string | null
          detalles?: Json | null
          fecha?: string | null
          id?: string
          prospect_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string | null
          detalles?: Json | null
          fecha?: string | null
          id?: string
          prospect_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_cm_prospect_etapa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_cola_envio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_logs_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "v_seguimiento"
            referencedColumns: ["id"]
          },
        ]
      }
      prospectos_cm2239: {
        Row: {
          admisible: boolean | null
          anexo4: boolean | null
          categorias: string[] | null
          ciberseguridad: boolean | null
          cloud_anexo3: boolean | null
          contrato_acreditacion: boolean | null
          coord_email: string | null
          coord_nombre: string | null
          coord_telefono: string | null
          descuento: number | null
          deudas_laborales: boolean | null
          es_utp: boolean | null
          estado: string | null
          factura_acreditacion: boolean | null
          fecha_validacion: string | null
          gaps: string[] | null
          garantia_meses: number | null
          id: number
          notas: string | null
          programa_integridad: boolean | null
          puntaje_acreditacion: number | null
          razon_social: string
          rep_legal_email: string
          rep_legal_nombre: string
          rep_legal_telefono: string
          rut_empresa: string
          sla_onsite_dias: number | null
          sla_respuesta_horas: number | null
          verificacion_integridad: boolean | null
        }
        Insert: {
          admisible?: boolean | null
          anexo4?: boolean | null
          categorias?: string[] | null
          ciberseguridad?: boolean | null
          cloud_anexo3?: boolean | null
          contrato_acreditacion?: boolean | null
          coord_email?: string | null
          coord_nombre?: string | null
          coord_telefono?: string | null
          descuento?: number | null
          deudas_laborales?: boolean | null
          es_utp?: boolean | null
          estado?: string | null
          factura_acreditacion?: boolean | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          garantia_meses?: number | null
          id?: number
          notas?: string | null
          programa_integridad?: boolean | null
          puntaje_acreditacion?: number | null
          razon_social: string
          rep_legal_email: string
          rep_legal_nombre: string
          rep_legal_telefono: string
          rut_empresa: string
          sla_onsite_dias?: number | null
          sla_respuesta_horas?: number | null
          verificacion_integridad?: boolean | null
        }
        Update: {
          admisible?: boolean | null
          anexo4?: boolean | null
          categorias?: string[] | null
          ciberseguridad?: boolean | null
          cloud_anexo3?: boolean | null
          contrato_acreditacion?: boolean | null
          coord_email?: string | null
          coord_nombre?: string | null
          coord_telefono?: string | null
          descuento?: number | null
          deudas_laborales?: boolean | null
          es_utp?: boolean | null
          estado?: string | null
          factura_acreditacion?: boolean | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          garantia_meses?: number | null
          id?: number
          notas?: string | null
          programa_integridad?: boolean | null
          puntaje_acreditacion?: number | null
          razon_social?: string
          rep_legal_email?: string
          rep_legal_nombre?: string
          rep_legal_telefono?: string
          rut_empresa?: string
          sla_onsite_dias?: number | null
          sla_respuesta_horas?: number | null
          verificacion_integridad?: boolean | null
        }
        Relationships: []
      }
      prospectos_cm2239_5: {
        Row: {
          advertencias: number | null
          bloqueos: number | null
          cat_instalacion: boolean | null
          cat_productos: boolean | null
          comunas_despacho: string | null
          contacto_email: string
          contacto_nombre: string
          contacto_telefono: string | null
          despacho_rural: boolean | null
          estado: string | null
          factura_electronica: boolean | null
          fecha_validacion: string | null
          gaps: string[] | null
          giro_ferreteria: boolean | null
          id: number
          inicio_actividades: boolean | null
          lineas_instalacion: string[] | null
          notas: string | null
          razon_social: string
          region: string | null
          registro_hab: string | null
          rut_empresa: string
          semaforo: string | null
          sin_deudas_laborales: boolean | null
          sin_inhabilidades: boolean | null
          user_agent: string | null
          vende_al_estado: boolean | null
        }
        Insert: {
          advertencias?: number | null
          bloqueos?: number | null
          cat_instalacion?: boolean | null
          cat_productos?: boolean | null
          comunas_despacho?: string | null
          contacto_email: string
          contacto_nombre: string
          contacto_telefono?: string | null
          despacho_rural?: boolean | null
          estado?: string | null
          factura_electronica?: boolean | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          giro_ferreteria?: boolean | null
          id?: number
          inicio_actividades?: boolean | null
          lineas_instalacion?: string[] | null
          notas?: string | null
          razon_social: string
          region?: string | null
          registro_hab?: string | null
          rut_empresa: string
          semaforo?: string | null
          sin_deudas_laborales?: boolean | null
          sin_inhabilidades?: boolean | null
          user_agent?: string | null
          vende_al_estado?: boolean | null
        }
        Update: {
          advertencias?: number | null
          bloqueos?: number | null
          cat_instalacion?: boolean | null
          cat_productos?: boolean | null
          comunas_despacho?: string | null
          contacto_email?: string
          contacto_nombre?: string
          contacto_telefono?: string | null
          despacho_rural?: boolean | null
          estado?: string | null
          factura_electronica?: boolean | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          giro_ferreteria?: boolean | null
          id?: number
          inicio_actividades?: boolean | null
          lineas_instalacion?: string[] | null
          notas?: string | null
          razon_social?: string
          region?: string | null
          registro_hab?: string | null
          rut_empresa?: string
          semaforo?: string | null
          sin_deudas_laborales?: boolean | null
          sin_inhabilidades?: boolean | null
          user_agent?: string | null
          vende_al_estado?: boolean | null
        }
        Relationships: []
      }
      prospects: {
        Row: {
          campana: string
          created_at: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_creacion: string | null
          fecha_invitacion: string | null
          fecha_meet: string | null
          fecha_propuesta: string | null
          fuente: string | null
          id: string
          industria: string | null
          linkedin_url: string | null
          monto_propuesta: number | null
          nombre: string | null
          notas: string | null
          pagado_50_adjudicacion: boolean | null
          pagado_50_inicial: boolean | null
          region: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          campana?: string
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_creacion?: string | null
          fecha_invitacion?: string | null
          fecha_meet?: string | null
          fecha_propuesta?: string | null
          fuente?: string | null
          id?: string
          industria?: string | null
          linkedin_url?: string | null
          monto_propuesta?: number | null
          nombre?: string | null
          notas?: string | null
          pagado_50_adjudicacion?: boolean | null
          pagado_50_inicial?: boolean | null
          region?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          campana?: string
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_creacion?: string | null
          fecha_invitacion?: string | null
          fecha_meet?: string | null
          fecha_propuesta?: string | null
          fuente?: string | null
          id?: string
          industria?: string | null
          linkedin_url?: string | null
          monto_propuesta?: number | null
          nombre?: string | null
          notas?: string | null
          pagado_50_adjudicacion?: boolean | null
          pagado_50_inicial?: boolean | null
          region?: string | null
          telefono?: string | null
          updated_at?: string | null
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
      proveedores_consolidados: {
        Row: {
          actividad_economica: string | null
          comuna: string | null
          created_at: string | null
          descripcion: string | null
          direccion: string | null
          email: string | null
          fecha_extraccion: string | null
          fuente_datos: string | null
          id: string
          nombre: string
          razon_social: string | null
          region: string | null
          rubro: string | null
          rut: string
          sitio_web: string | null
          tamanio_empresa: string | null
          telefono: string | null
          ultima_actualizacion: string | null
          updated_at: string | null
        }
        Insert: {
          actividad_economica?: string | null
          comuna?: string | null
          created_at?: string | null
          descripcion?: string | null
          direccion?: string | null
          email?: string | null
          fecha_extraccion?: string | null
          fuente_datos?: string | null
          id?: string
          nombre: string
          razon_social?: string | null
          region?: string | null
          rubro?: string | null
          rut: string
          sitio_web?: string | null
          tamanio_empresa?: string | null
          telefono?: string | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Update: {
          actividad_economica?: string | null
          comuna?: string | null
          created_at?: string | null
          descripcion?: string | null
          direccion?: string | null
          email?: string | null
          fecha_extraccion?: string | null
          fuente_datos?: string | null
          id?: string
          nombre?: string
          razon_social?: string | null
          region?: string | null
          rubro?: string | null
          rut?: string
          sitio_web?: string | null
          tamanio_empresa?: string | null
          telefono?: string | null
          ultima_actualizacion?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_info: Json | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_info?: Json | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_info?: Json | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recargos_region: {
        Row: {
          activo: boolean
          cliente_id: string
          created_at: string
          id: string
          recargo_fijo: number
          recargo_porcentaje: number
          region_codigo: string
          region_nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          created_at?: string
          id?: string
          recargo_fijo?: number
          recargo_porcentaje?: number
          region_codigo: string
          region_nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          created_at?: string
          id?: string
          recargo_fijo?: number
          recargo_porcentaje?: number
          region_codigo?: string
          region_nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      reclamos_compradores: {
        Row: {
          comprador_id: string
          created_at: string
          descripcion: string | null
          estado: string | null
          fecha_reclamo: string
          fecha_resolucion: string | null
          id: string
          proceso_codigo: string | null
          proceso_tipo: string | null
          severidad: string | null
          tipo_reclamo: string | null
          updated_at: string
        }
        Insert: {
          comprador_id: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_reclamo?: string
          fecha_resolucion?: string | null
          id?: string
          proceso_codigo?: string | null
          proceso_tipo?: string | null
          severidad?: string | null
          tipo_reclamo?: string | null
          updated_at?: string
        }
        Update: {
          comprador_id?: string
          created_at?: string
          descripcion?: string | null
          estado?: string | null
          fecha_reclamo?: string
          fecha_resolucion?: string | null
          id?: string
          proceso_codigo?: string | null
          proceso_tipo?: string | null
          severidad?: string | null
          tipo_reclamo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamos_compradores_comprador_id_fkey"
            columns: ["comprador_id"]
            isOneToOne: false
            referencedRelation: "historial_compradores"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamos_mp: {
        Row: {
          created_at: string
          estado: string | null
          fecha: string
          id_reclamo: string
          organismo_nombre: string | null
          organismo_rut: string | null
          proceso_codigo: string | null
          reclamante: string | null
          tipo: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string | null
          fecha: string
          id_reclamo: string
          organismo_nombre?: string | null
          organismo_rut?: string | null
          proceso_codigo?: string | null
          reclamante?: string | null
          tipo: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string | null
          fecha?: string
          id_reclamo?: string
          organismo_nombre?: string | null
          organismo_rut?: string | null
          proceso_codigo?: string | null
          reclamante?: string | null
          tipo?: number
          updated_at?: string
        }
        Relationships: []
      }
      reclamos_mp_dias: {
        Row: {
          cargados: number
          completo: boolean
          fecha: string
          intentos: number
          tipo: number
          total: number | null
          updated_at: string
        }
        Insert: {
          cargados?: number
          completo?: boolean
          fecha: string
          intentos?: number
          tipo: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          cargados?: number
          completo?: boolean
          fecha?: string
          intentos?: number
          tipo?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ref_regiones_chile: {
        Row: {
          codigo: string
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          codigo: string
          id?: number
          nombre: string
          orden: number
        }
        Update: {
          codigo?: string
          id?: number
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      revisiones_oc_items: {
        Row: {
          created_at: string
          diferencia_porcentaje: number | null
          diferencia_precio: number | null
          estado: string | null
          id: string
          observaciones: string | null
          orden_compra_item_id: string | null
          producto_inventario_id: string | null
          revision_id: string
          tiene_match_inventario: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diferencia_porcentaje?: number | null
          diferencia_precio?: number | null
          estado?: string | null
          id?: string
          observaciones?: string | null
          orden_compra_item_id?: string | null
          producto_inventario_id?: string | null
          revision_id: string
          tiene_match_inventario?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diferencia_porcentaje?: number | null
          diferencia_precio?: number | null
          estado?: string | null
          id?: string
          observaciones?: string | null
          orden_compra_item_id?: string | null
          producto_inventario_id?: string | null
          revision_id?: string
          tiene_match_inventario?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisiones_oc_items_orden_compra_item_id_fkey"
            columns: ["orden_compra_item_id"]
            isOneToOne: false
            referencedRelation: "ordenes_compra_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisiones_oc_items_producto_inventario_id_fkey"
            columns: ["producto_inventario_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revisiones_oc_items_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "revisiones_ordenes_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      revisiones_ordenes_compra: {
        Row: {
          comentarios: Json | null
          created_at: string
          diferencia_monto: number | null
          diferencia_porcentaje: number | null
          estado: string | null
          fecha_limite: string | null
          fecha_revision: string | null
          id: string
          items_aprobados: number | null
          items_observados: number | null
          items_rechazados: number | null
          items_revisados: number | null
          observaciones: string | null
          oferta_propia_codigo: string | null
          orden_compra_codigo: string
          resultado: string | null
          revisor_id: string
          tiene_oferta_propia: boolean | null
          updated_at: string
        }
        Insert: {
          comentarios?: Json | null
          created_at?: string
          diferencia_monto?: number | null
          diferencia_porcentaje?: number | null
          estado?: string | null
          fecha_limite?: string | null
          fecha_revision?: string | null
          id?: string
          items_aprobados?: number | null
          items_observados?: number | null
          items_rechazados?: number | null
          items_revisados?: number | null
          observaciones?: string | null
          oferta_propia_codigo?: string | null
          orden_compra_codigo: string
          resultado?: string | null
          revisor_id: string
          tiene_oferta_propia?: boolean | null
          updated_at?: string
        }
        Update: {
          comentarios?: Json | null
          created_at?: string
          diferencia_monto?: number | null
          diferencia_porcentaje?: number | null
          estado?: string | null
          fecha_limite?: string | null
          fecha_revision?: string | null
          id?: string
          items_aprobados?: number | null
          items_observados?: number | null
          items_rechazados?: number | null
          items_revisados?: number | null
          observaciones?: string | null
          oferta_propia_codigo?: string | null
          orden_compra_codigo?: string
          resultado?: string | null
          revisor_id?: string
          tiene_oferta_propia?: boolean | null
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
      rubros_mercado_publico: {
        Row: {
          activo: boolean | null
          codigo: string
          created_at: string | null
          id: number
          keywords: string[] | null
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          codigo: string
          created_at?: string | null
          id?: number
          keywords?: string[] | null
          nombre: string
        }
        Update: {
          activo?: boolean | null
          codigo?: string
          created_at?: string | null
          id?: number
          keywords?: string[] | null
          nombre?: string
        }
        Relationships: []
      }
      scraper_health_log: {
        Row: {
          block_reasons: Json | null
          blocks_encountered: number | null
          circuit_breaker_opened: boolean | null
          created_at: string
          duracion_ms: number | null
          error_message: string | null
          errores: string | null
          execution_time_ms: number | null
          fallback_used: boolean | null
          id: string
          items_obtenidos: number | null
          meta: Json | null
          metadata: Json | null
          records_new: number | null
          records_processed: number | null
          records_updated: number | null
          run_timestamp: string | null
          scraper_name: string
          status: string
          tipo_scraper: string | null
        }
        Insert: {
          block_reasons?: Json | null
          blocks_encountered?: number | null
          circuit_breaker_opened?: boolean | null
          created_at?: string
          duracion_ms?: number | null
          error_message?: string | null
          errores?: string | null
          execution_time_ms?: number | null
          fallback_used?: boolean | null
          id?: string
          items_obtenidos?: number | null
          meta?: Json | null
          metadata?: Json | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          run_timestamp?: string | null
          scraper_name: string
          status: string
          tipo_scraper?: string | null
        }
        Update: {
          block_reasons?: Json | null
          blocks_encountered?: number | null
          circuit_breaker_opened?: boolean | null
          created_at?: string
          duracion_ms?: number | null
          error_message?: string | null
          errores?: string | null
          execution_time_ms?: number | null
          fallback_used?: boolean | null
          id?: string
          items_obtenidos?: number | null
          meta?: Json | null
          metadata?: Json | null
          records_new?: number | null
          records_processed?: number | null
          records_updated?: number | null
          run_timestamp?: string | null
          scraper_name?: string
          status?: string
          tipo_scraper?: string | null
        }
        Relationships: []
      }
      seguimiento_prospectos: {
        Row: {
          fecha_contacto: string | null
          fecha_proxima: string | null
          id: number
          prospecto_id: number | null
          proxima_accion: string | null
          resultado: string | null
          tipo_contacto: string | null
        }
        Insert: {
          fecha_contacto?: string | null
          fecha_proxima?: string | null
          id?: number
          prospecto_id?: number | null
          proxima_accion?: string | null
          resultado?: string | null
          tipo_contacto?: string | null
        }
        Update: {
          fecha_contacto?: string | null
          fecha_proxima?: string | null
          id?: number
          prospecto_id?: number | null
          proxima_accion?: string | null
          resultado?: string | null
          tipo_contacto?: string | null
        }
        Relationships: []
      }
      sii_contribuyentes: {
        Row: {
          actividades: Json | null
          actualizado_en: string
          codigos_actividad: string[] | null
          documentos_timbrados: Json | null
          dv: string | null
          excepcion_dte: boolean | null
          fecha_inicio_actividades: string | null
          inicio_actividades: boolean | null
          moneda_extranjera: boolean | null
          obligacion_dte: boolean | null
          observaciones: Json | null
          pro_pyme: boolean | null
          raw: Json | null
          razon_social: string | null
          rut: number
          rut_formateado: string | null
          tiene_observaciones: boolean | null
        }
        Insert: {
          actividades?: Json | null
          actualizado_en?: string
          codigos_actividad?: string[] | null
          documentos_timbrados?: Json | null
          dv?: string | null
          excepcion_dte?: boolean | null
          fecha_inicio_actividades?: string | null
          inicio_actividades?: boolean | null
          moneda_extranjera?: boolean | null
          obligacion_dte?: boolean | null
          observaciones?: Json | null
          pro_pyme?: boolean | null
          raw?: Json | null
          razon_social?: string | null
          rut: number
          rut_formateado?: string | null
          tiene_observaciones?: boolean | null
        }
        Update: {
          actividades?: Json | null
          actualizado_en?: string
          codigos_actividad?: string[] | null
          documentos_timbrados?: Json | null
          dv?: string | null
          excepcion_dte?: boolean | null
          fecha_inicio_actividades?: string | null
          inicio_actividades?: boolean | null
          moneda_extranjera?: boolean | null
          obligacion_dte?: boolean | null
          observaciones?: Json | null
          pro_pyme?: boolean | null
          raw?: Json | null
          razon_social?: string | null
          rut?: number
          rut_formateado?: string | null
          tiene_observaciones?: boolean | null
        }
        Relationships: []
      }
      soporte_tickets: {
        Row: {
          asunto: string | null
          canal: string
          cliente_id: string | null
          conversacion: Json
          created_at: string
          email: string
          empresa: string | null
          estado: string
          id: string
          mensaje: string | null
          nombre: string | null
          numero: number
          origen: string
          pantalla: string | null
          telefono: string | null
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asunto?: string | null
          canal?: string
          cliente_id?: string | null
          conversacion?: Json
          created_at?: string
          email: string
          empresa?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          nombre?: string | null
          numero?: number
          origen?: string
          pantalla?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asunto?: string | null
          canal?: string
          cliente_id?: string | null
          conversacion?: Json
          created_at?: string
          email?: string
          empresa?: string | null
          estado?: string
          id?: string
          mensaje?: string | null
          nombre?: string | null
          numero?: number
          origen?: string
          pantalla?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soporte_tickets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      suscripciones: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          estado: string | null
          id: string
          moneda: string | null
          monto: number | null
          mp_preapproval_id: string | null
          plan: string
          proximo_cobro: string | null
          raw: Json | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          mp_preapproval_id?: string | null
          plan?: string
          proximo_cobro?: string | null
          raw?: Json | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          mp_preapproval_id?: string | null
          plan?: string
          proximo_cobro?: string | null
          raw?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suscripciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_proveedores_log: {
        Row: {
          cantidad_actualizados: number | null
          cantidad_errores: number | null
          cantidad_nuevos: number | null
          cantidad_procesados: number | null
          created_at: string | null
          detalles: Json | null
          fecha_sync: string | null
          id: string
          status: string | null
          tiempo_segundos: number | null
          tipo_sync: string | null
        }
        Insert: {
          cantidad_actualizados?: number | null
          cantidad_errores?: number | null
          cantidad_nuevos?: number | null
          cantidad_procesados?: number | null
          created_at?: string | null
          detalles?: Json | null
          fecha_sync?: string | null
          id?: string
          status?: string | null
          tiempo_segundos?: number | null
          tipo_sync?: string | null
        }
        Update: {
          cantidad_actualizados?: number | null
          cantidad_errores?: number | null
          cantidad_nuevos?: number | null
          cantidad_procesados?: number | null
          created_at?: string | null
          detalles?: Json | null
          fecha_sync?: string | null
          id?: string
          status?: string | null
          tiempo_segundos?: number | null
          tipo_sync?: string | null
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
        Relationships: []
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
          regiones_config: Json | null
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
          regiones_config?: Json | null
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
          regiones_config?: Json | null
          regions?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users_extended: {
        Row: {
          created_at: string | null
          email: string
          id: string
          organization_id: string | null
          permissions: Json | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          organization_id?: string | null
          permissions?: Json | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          organization_id?: string | null
          permissions?: Json | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_extended_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      validador_email_queue: {
        Row: {
          created_at: string | null
          error_msg: string | null
          estado: string | null
          id: number
          intentos: number | null
          prospecto_id: number
          sent_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_msg?: string | null
          estado?: string | null
          id?: number
          intentos?: number | null
          prospecto_id: number
          sent_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_msg?: string | null
          estado?: string | null
          id?: number
          intentos?: number | null
          prospecto_id?: number
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validador_email_queue_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "prospectos_cm2239"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validador_email_queue_prospecto_id_fkey"
            columns: ["prospecto_id"]
            isOneToOne: false
            referencedRelation: "vista_contacto_prospectos"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_asignaciones: {
        Row: {
          asignado_por: string | null
          created_at: string | null
          estado: string | null
          fecha_asignacion: string | null
          fecha_cierre: string | null
          id: string
          licitacion_codigo: string | null
          licitacion_id: string
          monto_estimado: number | null
          notas: string | null
          prioridad: string | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          asignado_por?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_asignacion?: string | null
          fecha_cierre?: string | null
          id?: string
          licitacion_codigo?: string | null
          licitacion_id: string
          monto_estimado?: number | null
          notas?: string | null
          prioridad?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          asignado_por?: string | null
          created_at?: string | null
          estado?: string | null
          fecha_asignacion?: string | null
          fecha_cierre?: string | null
          id?: string
          licitacion_codigo?: string | null
          licitacion_id?: string
          monto_estimado?: number | null
          notas?: string | null
          prioridad?: string | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_asignaciones_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "v_equipo_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "v_reporte_equipo"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "v_vendedor_dashboard"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_asignado_por_fkey"
            columns: ["asignado_por"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_asignaciones_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_equipo_dashboard"
            referencedColumns: ["vendedor_id"]
          },
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
          completado: boolean | null
          created_at: string | null
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          tipo_evento: string | null
          titulo: string
          vendedor_id: string | null
        }
        Insert: {
          asignacion_id?: string | null
          color?: string | null
          completado?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          tipo_evento?: string | null
          titulo: string
          vendedor_id?: string | null
        }
        Update: {
          asignacion_id?: string | null
          color?: string | null
          completado?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          tipo_evento?: string | null
          titulo?: string
          vendedor_id?: string | null
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
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_equipo_dashboard"
            referencedColumns: ["vendedor_id"]
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
          created_at: string | null
          id: string
          monto_adjudicado: number | null
          periodo: string | null
          tasa_adjudicacion: number | null
          tasa_postulacion: number | null
          total_adjudicadas: number | null
          total_asignadas: number | null
          total_no_adjudicadas: number | null
          total_postuladas: number | null
          updated_at: string | null
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          monto_adjudicado?: number | null
          periodo?: string | null
          tasa_adjudicacion?: number | null
          tasa_postulacion?: number | null
          total_adjudicadas?: number | null
          total_asignadas?: number | null
          total_no_adjudicadas?: number | null
          total_postuladas?: number | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          monto_adjudicado?: number | null
          periodo?: string | null
          tasa_adjudicacion?: number | null
          tasa_postulacion?: number | null
          total_adjudicadas?: number | null
          total_asignadas?: number | null
          total_no_adjudicadas?: number | null
          total_postuladas?: number | null
          updated_at?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_indicadores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_indicadores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_equipo_dashboard"
            referencedColumns: ["vendedor_id"]
          },
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
          avatar_url: string | null
          created_at: string | null
          email: string | null
          estado_invitacion: string
          id: string
          invitado_por: string | null
          invite_token: string | null
          invited_at: string | null
          nombre: string
          rol: string | null
          telefono: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          estado_invitacion?: string
          id?: string
          invitado_por?: string | null
          invite_token?: string | null
          invited_at?: string | null
          nombre: string
          rol?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          estado_invitacion?: string
          id?: string
          invitado_por?: string | null
          invite_token?: string | null
          invited_at?: string | null
          nombre?: string
          rol?: string | null
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ventas_comisionables: {
        Row: {
          cliente_id: string | null
          codigo_oc: string | null
          comision_monto: number
          comision_pct: number
          comprador: string | null
          created_at: string
          estado: string
          estado_oc: string | null
          factura_id: string | null
          fecha_aceptacion: string | null
          id: string
          monto_neto: number
          numero_licitacion: string | null
          oc_id: number | null
          oferta_id: string | null
          periodo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          codigo_oc?: string | null
          comision_monto?: number
          comision_pct?: number
          comprador?: string | null
          created_at?: string
          estado?: string
          estado_oc?: string | null
          factura_id?: string | null
          fecha_aceptacion?: string | null
          id?: string
          monto_neto?: number
          numero_licitacion?: string | null
          oc_id?: number | null
          oferta_id?: string | null
          periodo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          codigo_oc?: string | null
          comision_monto?: number
          comision_pct?: number
          comprador?: string | null
          created_at?: string
          estado?: string
          estado_oc?: string | null
          factura_id?: string | null
          fecha_aceptacion?: string | null
          id?: string
          monto_neto?: number
          numero_licitacion?: string | null
          oc_id?: number | null
          oferta_id?: string | null
          periodo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_comisionables_factura_id_fkey"
            columns: ["factura_id"]
            isOneToOne: false
            referencedRelation: "facturas_comision"
            referencedColumns: ["id"]
          },
        ]
      }
      viral_agent_calendario: {
        Row: {
          caption: string
          cta: string
          dia: number
          estado: string
          formato: string
          hashtags: string
          imagen_url: string
          pilar: string
          publicado_at: string | null
          red: string
          tema_imagen: string | null
        }
        Insert: {
          caption: string
          cta: string
          dia: number
          estado?: string
          formato: string
          hashtags: string
          imagen_url: string
          pilar: string
          publicado_at?: string | null
          red: string
          tema_imagen?: string | null
        }
        Update: {
          caption?: string
          cta?: string
          dia?: number
          estado?: string
          formato?: string
          hashtags?: string
          imagen_url?: string
          pilar?: string
          publicado_at?: string | null
          red?: string
          tema_imagen?: string | null
        }
        Relationships: []
      }
      viral_agent_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      viral_agent_log: {
        Row: {
          detalle: string | null
          dia: number | null
          id: number
          ok: boolean
          red: string | null
          ts: string
        }
        Insert: {
          detalle?: string | null
          dia?: number | null
          id?: number
          ok: boolean
          red?: string | null
          ts?: string
        }
        Update: {
          detalle?: string | null
          dia?: number | null
          id?: number
          ok?: boolean
          red?: string | null
          ts?: string
        }
        Relationships: []
      }
      webinar_inscripciones: {
        Row: {
          creado_en: string
          email: string
          empresa: string | null
          evento_slug: string
          id: string
          nombre: string
          notificado: boolean
          whatsapp: string | null
        }
        Insert: {
          creado_en?: string
          email: string
          empresa?: string | null
          evento_slug?: string
          id?: string
          nombre: string
          notificado?: boolean
          whatsapp?: string | null
        }
        Update: {
          creado_en?: string
          email?: string
          empresa?: string | null
          evento_slug?: string
          id?: string
          nombre?: string
          notificado?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      webinar_invitacion: {
        Row: {
          campana: string
          creado_en: string
          email: string
          empresa: string | null
          enviado_en: string | null
          error: string | null
          estado: string
          id: string
          intentos: number
          nombre: string | null
        }
        Insert: {
          campana?: string
          creado_en?: string
          email: string
          empresa?: string | null
          enviado_en?: string | null
          error?: string | null
          estado?: string
          id?: string
          intentos?: number
          nombre?: string | null
        }
        Update: {
          campana?: string
          creado_en?: string
          email?: string
          empresa?: string | null
          enviado_en?: string | null
          error?: string | null
          estado?: string
          id?: string
          intentos?: number
          nombre?: string | null
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          access_token: string | null
          actualizado_en: string
          canal_id: string
          creado_en: string
          descripcion: string | null
          estado: string
          foto_perfil: string | null
          id: string
          nombre: string
          refresh_token: string | null
          suscriptores_estimados: number | null
          token_expira_en: string | null
          ultima_sincronizacion: string | null
          url_canal: string | null
        }
        Insert: {
          access_token?: string | null
          actualizado_en?: string
          canal_id: string
          creado_en?: string
          descripcion?: string | null
          estado?: string
          foto_perfil?: string | null
          id?: string
          nombre: string
          refresh_token?: string | null
          suscriptores_estimados?: number | null
          token_expira_en?: string | null
          ultima_sincronizacion?: string | null
          url_canal?: string | null
        }
        Update: {
          access_token?: string | null
          actualizado_en?: string
          canal_id?: string
          creado_en?: string
          descripcion?: string | null
          estado?: string
          foto_perfil?: string | null
          id?: string
          nombre?: string
          refresh_token?: string | null
          suscriptores_estimados?: number | null
          token_expira_en?: string | null
          ultima_sincronizacion?: string | null
          url_canal?: string | null
        }
        Relationships: []
      }
      youtube_subscribers: {
        Row: {
          canal_id: string
          channel_user_id: string
          contacto_id: string | null
          creado_en: string
          email: string | null
          estado_suscripcion: string | null
          fecha_suscripcion: string | null
          foto_perfil: string | null
          id: string
          nombre: string | null
          ultima_actividad: string | null
        }
        Insert: {
          canal_id: string
          channel_user_id: string
          contacto_id?: string | null
          creado_en?: string
          email?: string | null
          estado_suscripcion?: string | null
          fecha_suscripcion?: string | null
          foto_perfil?: string | null
          id?: string
          nombre?: string | null
          ultima_actividad?: string | null
        }
        Update: {
          canal_id?: string
          channel_user_id?: string
          contacto_id?: string | null
          creado_en?: string
          email?: string | null
          estado_suscripcion?: string | null
          fecha_suscripcion?: string | null
          foto_perfil?: string | null
          id?: string
          nombre?: string | null
          ultima_actividad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_subscribers_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "youtube_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_subscribers_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "marketing_contactos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_subscribers_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "marketing_contactos_segmentados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      auto_bids_dashboard: {
        Row: {
          codigo_proceso: string | null
          convocatoria: string | null
          created_at: string | null
          departamento: string | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          id: string | null
          items_emparejados: number | null
          iva: number | null
          match_percent: number | null
          moneda: string | null
          notas: string | null
          organismo: string | null
          presupuesto_total: number | null
          raw_json: Json | null
          rut_institucion: string | null
          tipo_proceso: string | null
          titulo: string | null
          total: number | null
          total_items: number | null
          total_neto: number | null
          unidad_compra: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      auto_bids_lista: {
        Row: {
          asignado_a: string | null
          codigo_licitacion: string | null
          costo_envio: number | null
          created_at: string | null
          descripcion_cotizacion: string | null
          descripcion_licitacion: string | null
          direccion_entrega: string | null
          documentos_adjuntos: Json | null
          estado: string | null
          fecha_cierre: string | null
          fecha_cierre_fmt: string | null
          fecha_creacion: string | null
          fecha_creacion_fmt: string | null
          fecha_publicacion: string | null
          horas_para_cierre: number | null
          id: string | null
          institucion: string | null
          items: Json | null
          iva_porcentaje: number | null
          monto_ofertado: number | null
          nombre_licitacion: string | null
          plazo_entrega_dias: number | null
          porcentaje_matching: number | null
          presupuesto: number | null
          productos_matched: number | null
          productos_total: number | null
          total_con_iva: number | null
          total_iva: number | null
          total_neto: number | null
          updated_at: string | null
          urgencia: string | null
          user_id: string | null
        }
        Insert: {
          asignado_a?: string | null
          codigo_licitacion?: string | null
          costo_envio?: number | null
          created_at?: string | null
          descripcion_cotizacion?: string | null
          descripcion_licitacion?: string | null
          direccion_entrega?: string | null
          documentos_adjuntos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_fmt?: never
          fecha_creacion?: string | null
          fecha_creacion_fmt?: never
          fecha_publicacion?: string | null
          horas_para_cierre?: never
          id?: string | null
          institucion?: string | null
          items?: Json | null
          iva_porcentaje?: number | null
          monto_ofertado?: number | null
          nombre_licitacion?: string | null
          plazo_entrega_dias?: number | null
          porcentaje_matching?: number | null
          presupuesto?: number | null
          productos_matched?: number | null
          productos_total?: number | null
          total_con_iva?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string | null
          urgencia?: never
          user_id?: string | null
        }
        Update: {
          asignado_a?: string | null
          codigo_licitacion?: string | null
          costo_envio?: number | null
          created_at?: string | null
          descripcion_cotizacion?: string | null
          descripcion_licitacion?: string | null
          direccion_entrega?: string | null
          documentos_adjuntos?: Json | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_fmt?: never
          fecha_creacion?: string | null
          fecha_creacion_fmt?: never
          fecha_publicacion?: string | null
          horas_para_cierre?: never
          id?: string | null
          institucion?: string | null
          items?: Json | null
          iva_porcentaje?: number | null
          monto_ofertado?: number | null
          nombre_licitacion?: string | null
          plazo_entrega_dias?: number | null
          porcentaje_matching?: number | null
          presupuesto?: number | null
          productos_matched?: number | null
          productos_total?: number | null
          total_con_iva?: number | null
          total_iva?: number | null
          total_neto?: number | null
          updated_at?: string | null
          urgencia?: never
          user_id?: string | null
        }
        Relationships: []
      }
      auto_bids_summary: {
        Row: {
          monto_activo: number | null
          monto_total_ofertado: number | null
          oportunidades_activas: number | null
          oportunidades_adjudicadas: number | null
          oportunidades_enviadas: number | null
          presupuesto_total: number | null
          promedio_matching: number | null
          proximo_cierre: string | null
          total_oportunidades: number | null
          user_id: string | null
        }
        Relationships: []
      }
      bi_oc_negocios_por_institucion: {
        Row: {
          cantidad_ordenes: number | null
          cantidad_proveedores: number | null
          demandante: string | null
          monto_total: number | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      bi_oc_negocios_por_proveedor: {
        Row: {
          cantidad_instituciones: number | null
          cantidad_ordenes: number | null
          monto_total: number | null
          proveedor: string | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      bi_oc_precios_producto_proveedor: {
        Row: {
          codigo_producto: string | null
          muestras: number | null
          precio_max: number | null
          precio_min: number | null
          precio_prom: number | null
          producto: string | null
          proveedor: string | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      bi_oc_productos: {
        Row: {
          codigo_producto: string | null
          instituciones: number | null
          lineas: number | null
          monto_total: number | null
          precio_unitario_max: number | null
          precio_unitario_min: number | null
          precio_unitario_prom: number | null
          producto: string | null
          proveedores: number | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      calendario_eventos: {
        Row: {
          codigo: string | null
          fecha: string | null
          link_detalle: string | null
          tipo_evento: string | null
          tipo_proceso: string | null
          titulo: string | null
        }
        Relationships: []
      }
      compras_agiles_con_institucion: {
        Row: {
          codigo: string | null
          estado: string | null
          finaliza_el: string | null
          institucion_bloqueada: boolean | null
          institucion_comuna: string | null
          institucion_division: string | null
          institucion_estado_gestion: string | null
          institucion_nombre: string | null
          institucion_prioridad: number | null
          institucion_region: string | null
          link_detalle: string | null
          presupuesto_estimado: number | null
          publicada_el: string | null
          rut_institucion: string | null
          titulo: string | null
        }
        Relationships: []
      }
      compras_agiles_con_items: {
        Row: {
          categoria: string | null
          codigo: string | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_extraccion: string | null
          items: Json | null
          items_count: number | null
          match_encontrado: boolean | null
          match_score: number | null
          organismo: string | null
          palabras_encontradas: Json | null
          rut_institucion: string | null
          titulo: string | null
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_extraccion?: string | null
          items?: never
          items_count?: never
          match_encontrado?: boolean | null
          match_score?: number | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          rut_institucion?: string | null
          titulo?: string | null
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          descripcion?: string | null
          estado?: string | null
          fecha_cierre?: string | null
          fecha_extraccion?: string | null
          items?: never
          items_count?: never
          match_encontrado?: boolean | null
          match_score?: number | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          rut_institucion?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      cubo_lic: {
        Row: {
          adjudicatario: string | null
          codigo: string | null
          comprador: string | null
          comprador_rut: string | null
          fecha_adjudicacion: string | null
          mes: string | null
          metodo: string | null
          monto_adjudicado: number | null
          monto_estimado: number | null
          num_oferentes: number | null
          rubro: string | null
          rut_adjudicatario: string | null
          titulo: string | null
        }
        Relationships: []
      }
      cubo_oc: {
        Row: {
          cantidad: number | null
          categoria: string | null
          lineas: number | null
          mes: string | null
          monto: number | null
          organismo: string | null
          precio_max: number | null
          precio_med: number | null
          precio_min: number | null
          producto: string | null
          producto_key: string | null
          proveedor: string | null
          rut_organismo: string | null
          rut_proveedor: string | null
          tipo: string | null
        }
        Relationships: []
      }
      cubo_oc_1d: {
        Row: {
          cantidad: number | null
          clave: string | null
          dim: string | null
          etiqueta: string | null
          lineas: number | null
          monto: number | null
          organismos: number | null
          precio_max: number | null
          precio_med: number | null
          precio_min: number | null
          productos: number | null
          proveedores: number | null
          tipo: string | null
        }
        Relationships: []
      }
      cubo_oc_tot: {
        Row: {
          cantidad: number | null
          lineas: number | null
          monto: number | null
          organismos: number | null
          precio_max: number | null
          precio_med: number | null
          precio_min: number | null
          productos: number | null
          proveedores: number | null
          tipo: string | null
        }
        Relationships: []
      }
      dashboard_estado: {
        Row: {
          con_match: number | null
          monto_con_match: number | null
          monto_total_oportunidades: number | null
          ofertas_enviadas: number | null
          procesadas: number | null
          total_licitaciones: number | null
        }
        Relationships: []
      }
      instituciones_dashboard: {
        Row: {
          asignado_a: string | null
          bloqueada: boolean | null
          comuna: string | null
          correo: string | null
          division: string | null
          domicilio_legal: string | null
          estado_gestion: string | null
          etiquetas: string[] | null
          gestion_updated_at: string | null
          last_seen_at: string | null
          link_ficha_comprador: string | null
          motivo_bloqueo: string | null
          nombre: string | null
          notas: string | null
          oc_monto_total: number | null
          oc_total: number | null
          oc_ultima_fecha: string | null
          pago_promedio_dias: number | null
          pago_sigfe: boolean | null
          prioridad: number | null
          reclamos_total: number | null
          region: string | null
          rut: string | null
          sector: string | null
          sitio_web: string | null
          telefono: string | null
        }
        Relationships: []
      }
      instituciones_stats: {
        Row: {
          actualizado_at: string | null
          licitaciones_activas: number | null
          licitaciones_adjudicadas: number | null
          licitaciones_cerradas: number | null
          monto_promedio: number | null
          monto_total_estimado: number | null
          nombre_institucion: string | null
          primera_licitacion: string | null
          total_licitaciones: number | null
          ultima_licitacion: string | null
        }
        Relationships: []
      }
      licitaciones_all: {
        Row: {
          categoria: string | null
          categoria_match: string | null
          codigo: string | null
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          id: number | null
          last_scraped_at: string | null
          link_detalle: string | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string | null
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean | null
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          categoria_match?: string | null
          codigo?: string | null
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          id?: number | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string | null
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean | null
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          categoria_match?: string | null
          codigo?: string | null
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          id?: number | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string | null
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean | null
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      licitaciones_con_match: {
        Row: {
          categoria: string | null
          categoria_match: string | null
          codigo: string | null
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          id: number | null
          items_con_match: number | null
          last_scraped_at: string | null
          link_detalle: string | null
          match_confidence_promedio: number | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          monto_total_estimado: number | null
          nombre: string | null
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean | null
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          total_items: number | null
          unidad: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      licitaciones_sin_productos: {
        Row: {
          codigo: string | null
          created_at: string | null
          fecha_cierre: string | null
          nombre: string | null
          num_items: number | null
          organismo: string | null
        }
        Relationships: []
      }
      licitaciones_sospechosas: {
        Row: {
          codigo: string | null
          created_at: string | null
          fecha_cierre: string | null
          nombre: string | null
          num_items: number | null
          organismo: string | null
        }
        Relationships: []
      }
      licitaciones_urgentes: {
        Row: {
          categoria: string | null
          categoria_match: string | null
          codigo: string | null
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          horas_restantes: number | null
          id: number | null
          last_scraped_at: string | null
          link_detalle: string | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string | null
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean | null
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          unidad: string | null
          updated_at: string | null
        }
        Insert: {
          categoria?: string | null
          categoria_match?: string | null
          codigo?: string | null
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          horas_restantes?: never
          id?: number | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string | null
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean | null
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Update: {
          categoria?: string | null
          categoria_match?: string | null
          codigo?: string | null
          comuna?: string | null
          created_at?: string | null
          datos_json?: Json | null
          departamento?: string | null
          descripcion?: string | null
          direccion?: string | null
          direccion_entrega?: string | null
          estado?: string | null
          estado_detallado?: string | null
          fecha_cierre?: string | null
          fecha_cierre_primer_llamado?: string | null
          fecha_cierre_segundo_llamado?: string | null
          fecha_extraccion?: string | null
          fecha_publicacion?: string | null
          finaliza_el?: string | null
          horas_restantes?: never
          id?: number | null
          last_scraped_at?: string | null
          link_detalle?: string | null
          match_encontrado?: boolean | null
          match_score?: number | null
          moneda?: string | null
          monto_estimado?: number | null
          nombre?: string | null
          nombre_organismo?: string | null
          oferta_enviada?: boolean | null
          oferta_id?: string | null
          organismo?: string | null
          palabras_encontradas?: Json | null
          plazo_entrega?: string | null
          presupuesto_estimado?: number | null
          procesada?: boolean | null
          publicada_el?: string | null
          region?: string | null
          rut_institucion?: string | null
          stale?: boolean | null
          stale_marked_at?: string | null
          tiene_adjuntos?: boolean | null
          tipo?: string | null
          tipo_presupuesto?: string | null
          titulo?: string | null
          unidad?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lista_precios_view: {
        Row: {
          categoria: string | null
          codigo: string | null
          costo: string | null
          created_at: string | null
          descripcion: string | null
          id: number | null
          margen_comercial: string | null
          precio_venta_neto: string | null
          unidad: string | null
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          costo?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: number | null
          margen_comercial?: string | null
          precio_venta_neto?: string | null
          unidad?: string | null
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          costo?: string | null
          created_at?: string | null
          descripcion?: string | null
          id?: number | null
          margen_comercial?: string | null
          precio_venta_neto?: string | null
          unidad?: string | null
        }
        Relationships: []
      }
      marketing_contactos_segmentados: {
        Row: {
          categoria: string | null
          consentimiento_marketing: boolean | null
          email: string | null
          empresa: string | null
          estado_contacto: string | null
          estado_suscripcion: string | null
          etiquetas: string[] | null
          fuente_datos: string | null
          id: string | null
          nombre: string | null
          origen: string | null
          puntuacion_relevancia: number | null
          telefono: string | null
          total_registros: number | null
          ultimo_contacto_en: string | null
        }
        Relationships: []
      }
      mv_bi_comprador: {
        Row: {
          comprador: string | null
          monto_total: number | null
          ordenes: number | null
          proveedores: number | null
          ultima: string | null
        }
        Relationships: []
      }
      mv_bi_proveedor: {
        Row: {
          compradores: number | null
          monto_total: number | null
          ordenes: number | null
          proveedor: string | null
          ultima: string | null
        }
        Relationships: []
      }
      mv_cm_producto: {
        Row: {
          codigo_producto: string | null
          compradores: number | null
          lineas: number | null
          monto_total: number | null
          precio_max: number | null
          precio_min: number | null
          precio_prom: number | null
          producto: string | null
          producto_key: string | null
          proveedores: number | null
          tipo_origen: string | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      mv_cm_producto_comprador: {
        Row: {
          comprador: string | null
          lineas: number | null
          monto_total: number | null
          precio_prom: number | null
          producto_key: string | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      mv_cm_producto_mes: {
        Row: {
          mes: string | null
          monto_total: number | null
          ordenes: number | null
          precio_max: number | null
          precio_min: number | null
          precio_prom: number | null
          producto_key: string | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      mv_cm_producto_proveedor: {
        Row: {
          lineas: number | null
          monto_total: number | null
          precio_max: number | null
          precio_min: number | null
          precio_prom: number | null
          producto_key: string | null
          proveedor: string | null
          tipo_origen: string | null
        }
        Relationships: []
      }
      mv_prov_institucion: {
        Row: {
          organismo_comprador: string | null
          rut_proveedor: string | null
        }
        Relationships: []
      }
      mv_prov_rubro: {
        Row: {
          rubro_n1: string | null
          rut_proveedor: string | null
        }
        Relationships: []
      }
      mv_proveedores_estado: {
        Row: {
          monto_2026: number | null
          monto_total: number | null
          n_ocs: number | null
          n_ocs_2026: number | null
          proveedor_nombre: string | null
          rut_proveedor: string | null
          ultima_fecha: string | null
        }
        Relationships: []
      }
      oc_enriquecidas: {
        Row: {
          codigo: string | null
          created_at: string | null
          datos_json: Json | null
          demandante: string | null
          estado: string | null
          fecha_emision: string | null
          fecha_envio_oc: string | null
          id: number | null
          iva: number | null
          last_scraped_at: string | null
          moneda: string | null
          monto_total: number | null
          neto: number | null
          nombre: string | null
          numero_licitacion: string | null
          numero_oc: string | null
          organismo_comprador: string | null
          proveedor: string | null
          proveedor_nombre: string | null
          raw_json: Json | null
          rut_demandante: string | null
          rut_proveedor: string | null
          stale: boolean | null
          stale_marked_at: string | null
          subtotal: number | null
          tipo_origen: string | null
          total: number | null
          unidad_compra: string | null
        }
        Relationships: []
      }
      oportunidades_all: {
        Row: {
          categoria_match: string | null
          codigo: string | null
          created_at: string | null
          descripcion: string | null
          estado: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          link_detalle: string | null
          match_score: number | null
          organismo: string | null
          presupuesto_estimado: number | null
          tipo_proceso: string | null
          titulo: string | null
        }
        Relationships: []
      }
      users_dashboard: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          organization_name: string | null
          organization_plan: string | null
          permissions: Json | null
          role: string | null
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
        Relationships: []
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
            referencedRelation: "v_asignaciones_detalle"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "vendedor_calendario_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "v_equipo_dashboard"
            referencedColumns: ["vendedor_id"]
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
      v_client_search_config: {
        Row: {
          client_id: string | null
          ia_enabled: boolean | null
          is_active: boolean | null
          keywords: string[] | null
          negative_keywords: string[] | null
          profile_id: string | null
          profile_name: string | null
          region_codes: string[] | null
          rubros: string[] | null
          search_compras_agiles: boolean | null
          search_consultas_mercado: boolean | null
          search_convenio_marco: boolean | null
          search_cotizaciones: boolean | null
          search_licitaciones: boolean | null
          search_tratos_directos: boolean | null
        }
        Relationships: []
      }
      v_cm_embudo: {
        Row: {
          etapa: string | null
          etapa_num: number | null
          total: number | null
        }
        Relationships: []
      }
      v_cm_prospect_etapa: {
        Row: {
          created_at: string | null
          dias_sin_avanzar: number | null
          email: string | null
          empresa: string | null
          estado: string | null
          etapa: string | null
          etapa_num: number | null
          fecha_cierre: string | null
          fecha_invitacion: string | null
          fecha_meet: string | null
          fecha_propuesta: string | null
          fuente: string | null
          id: string | null
          industria: string | null
          meet_agendado_en: string | null
          monto_propuesta: number | null
          nombre: string | null
          pagado_50_adjudicacion: boolean | null
          pagado_50_inicial: boolean | null
          puntaje_acreditacion: number | null
          validador_admisible: boolean | null
        }
        Relationships: []
      }
      v_cola_envio: {
        Row: {
          cargado_el: string | null
          email: string | null
          empresa: string | null
          fuente: string | null
          id: string | null
          industria: string | null
          nombre: string | null
        }
        Insert: {
          cargado_el?: never
          email?: string | null
          empresa?: string | null
          fuente?: never
          id?: string | null
          industria?: string | null
          nombre?: string | null
        }
        Update: {
          cargado_el?: never
          email?: string | null
          empresa?: string | null
          fuente?: never
          id?: string | null
          industria?: string | null
          nombre?: string | null
        }
        Relationships: []
      }
      v_equipo_dashboard: {
        Row: {
          activo: boolean | null
          adjudicadas: number | null
          avatar_url: string | null
          email: string | null
          ingresos_generados: number | null
          monto_total: number | null
          nombre: string | null
          postuladas: number | null
          rol: string | null
          tasa_exito: number | null
          telefono: string | null
          total_asignadas: number | null
          vendedor_id: string | null
        }
        Relationships: []
      }
      v_pipeline: {
        Row: {
          dias_sin_movimiento: number | null
          email: string | null
          empresa: string | null
          etapa: string | null
          fecha_invitacion: string | null
          fuente: string | null
          id: string | null
          industria: string | null
          nombre: string | null
          notas: string | null
          ultimo_cambio: string | null
        }
        Insert: {
          dias_sin_movimiento?: never
          email?: string | null
          empresa?: string | null
          etapa?: never
          fecha_invitacion?: never
          fuente?: never
          id?: string | null
          industria?: string | null
          nombre?: string | null
          notas?: string | null
          ultimo_cambio?: never
        }
        Update: {
          dias_sin_movimiento?: never
          email?: string | null
          empresa?: string | null
          etapa?: never
          fecha_invitacion?: never
          fuente?: never
          id?: string | null
          industria?: string | null
          nombre?: string | null
          notas?: string | null
          ultimo_cambio?: never
        }
        Relationships: []
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
      v_resumen_pipeline: {
        Row: {
          cantidad: number | null
          estado: string | null
          ultimo_movimiento: string | null
        }
        Relationships: []
      }
      v_seguimiento: {
        Row: {
          dias_desde_invitacion: number | null
          email: string | null
          empresa: string | null
          id: string | null
          industria: string | null
          invitado_el: string | null
          nombre: string | null
        }
        Insert: {
          dias_desde_invitacion?: never
          email?: string | null
          empresa?: string | null
          id?: string | null
          industria?: string | null
          invitado_el?: never
          nombre?: string | null
        }
        Update: {
          dias_desde_invitacion?: never
          email?: string | null
          empresa?: string | null
          id?: string | null
          industria?: string | null
          invitado_el?: never
          nombre?: string | null
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
      v_viral_agent_salud: {
        Row: {
          errores_7d: number | null
          pendientes: number | null
          publicados: number | null
          ultimo_error: string | null
          ultimo_error_detalle: string | null
          ultimo_exito: string | null
        }
        Relationships: []
      }
      vista_contacto_prospectos: {
        Row: {
          admisible: boolean | null
          categorias: string[] | null
          contacto: string | null
          coord_email: string | null
          coord_nombre: string | null
          coord_telefono: string | null
          email: string | null
          empresa: string | null
          estado: string | null
          fecha_validacion: string | null
          gaps: string[] | null
          id: number | null
          puntaje: number | null
          rut_empresa: string | null
          telefono: string | null
        }
        Insert: {
          admisible?: boolean | null
          categorias?: string[] | null
          contacto?: string | null
          coord_email?: string | null
          coord_nombre?: string | null
          coord_telefono?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          id?: number | null
          puntaje?: number | null
          rut_empresa?: string | null
          telefono?: string | null
        }
        Update: {
          admisible?: boolean | null
          categorias?: string[] | null
          contacto?: string | null
          coord_email?: string | null
          coord_nombre?: string | null
          coord_telefono?: string | null
          email?: string | null
          empresa?: string | null
          estado?: string | null
          fecha_validacion?: string | null
          gaps?: string[] | null
          id?: number | null
          puntaje?: number | null
          rut_empresa?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      vw_matches_pendientes: {
        Row: {
          asignado_a: string | null
          cantidad: string | null
          categoria: string | null
          codigo_oportunidad: string | null
          codigo_producto: string | null
          descripcion_oportunidad: string | null
          descripcion_producto: string | null
          fecha_cierre: string | null
          item_id: string | null
          monto_estimado: number | null
          nombre_oportunidad: string | null
          nombre_producto: string | null
          organismo: string | null
          precio_total_sugerido: number | null
          precio_unitario_sugerido: number | null
          region: string | null
          tipo: string | null
          unidad: string | null
        }
        Relationships: []
      }
      vw_oportunidades_unificadas: {
        Row: {
          activo_inventario: boolean | null
          asignado_a: string | null
          cantidad_item: number | null
          categoria: string | null
          categoria_inventario: string | null
          codigo_oportunidad: string | null
          codigo_producto: string | null
          codigo_producto_inventario: string | null
          descripcion_oportunidad: string | null
          descripcion_producto: string | null
          direccion_entrega: string | null
          fecha_cierre: string | null
          fecha_publicacion: string | null
          id_inventario: string | null
          id_producto_inventario: string | null
          item_id: string | null
          keywords_text: string | null
          match_confidence: number | null
          match_encontrado: boolean | null
          match_method: string | null
          match_score: number | null
          monto_estimado: number | null
          nombre_inventario: string | null
          nombre_oportunidad: string | null
          nombre_producto: string | null
          organismo: string | null
          plazo_entrega: string | null
          precio: number | null
          region: string | null
          sku: string | null
          stock_disponible: number | null
          tiempo_entrega_dias: number | null
          tipo: string | null
          unidad_item: string | null
        }
        Relationships: []
      }
      vw_resumen_matches: {
        Row: {
          asignado_a: string | null
          avg_match_confidence: number | null
          codigo_compra_agil: string | null
          estado_match: string | null
          fecha_cierre: string | null
          items_matcheados: number | null
          items_pendientes: number | null
          match_encontrado: boolean | null
          monto_estimado: number | null
          nombre_compra_agil: string | null
          region: string | null
          total_items: number | null
        }
        Relationships: []
      }
      vw_webinar_contacts: {
        Row: {
          categoria: string | null
          creado_en: string | null
          email: string | null
          empresa: string | null
          estado_suscripcion: string | null
          fuente_datos: string | null
          id: string | null
          nombre: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _test_norm: { Args: { txt: string }; Returns: string }
      add_keyword: {
        Args: { p_keyword: string; p_profile_id: string }
        Returns: string
      }
      add_negative_keyword: {
        Args: { p_keyword: string; p_profile_id: string }
        Returns: string
      }
      add_region: {
        Args: { p_profile_id: string; p_region_code: string }
        Returns: string
      }
      admin_campanas_resumen: { Args: never; Returns: Json }
      admin_clientes_actividad: {
        Args: { lim?: number }
        Returns: {
          created_at: string
          email: string
          empresa_nombre: string
          id: string
          industrias: string[]
          items_inventario: number
          last_sign_in_at: string
          ofertas: number
          palabras_clave_busqueda: string[]
          plan: string
        }[]
      }
      admin_clientes_nuevos: {
        Args: { dias?: number; lim?: number }
        Returns: {
          created_at: string
          email: string
          empresa_nombre: string
          id: string
          industrias: string[]
          items_inventario: number
          last_sign_in_at: string
          ofertas: number
          palabras_clave_busqueda: string[]
          plan: string
        }[]
      }
      admin_clientes_para_importar: {
        Args: never
        Returns: {
          email: string
          empresa_nombre: string
          nombre_responsable: string
          rut: string
        }[]
      }
      admin_evaristo_conversaciones: {
        Args: { dias?: number; lim?: number }
        Returns: {
          actualizado_en: string
          canal: string
          email: string
          empresa_nombre: string
          id: string
          mensajes: number
          titulo: string
          ultima_pregunta: string
          user_id: string
        }[]
      }
      admin_evaristo_mensajes: {
        Args: { p_conversacion_id: string }
        Returns: {
          contenido: string
          creado_en: string
          id: number
          rol: string
        }[]
      }
      admin_experto_consultas: {
        Args: { buscar?: string; dias?: number; lim?: number }
        Returns: {
          creado_en: string
          email: string
          empresa_nombre: string
          huella: string
          id: number
          licitacion: string
          modo: string
          ms: number
          pregunta: string
          respuesta: string
          user_id: string
        }[]
      }
      admin_experto_resumen: { Args: never; Returns: Json }
      admin_marketing_contactos_cruce: {
        Args: never
        Returns: {
          campanas_enviadas: number
          contacto_id: string
          es_cliente: boolean
        }[]
      }
      admin_traccion_resumen: { Args: never; Returns: Json }
      alerta_ingesta_ca: { Args: never; Returns: string }
      alerta_ingesta_compras_agiles: { Args: never; Returns: string }
      apply_user_roles_rls_fix: { Args: never; Returns: Json }
      bi_comprador_detalle: {
        Args: { limite?: number; p_nombre: string }
        Returns: Json
      }
      bi_mercado_stats: { Args: never; Returns: Json }
      bi_proveedor_detalle: {
        Args: { limite?: number; p_nombre: string }
        Returns: Json
      }
      bi_stats: { Args: never; Returns: Json }
      bi_stats_rango: {
        Args: { p_desde?: string; p_hasta?: string }
        Returns: Json
      }
      bi_top_compradores: {
        Args: { limite?: number; termino?: string }
        Returns: Json
      }
      bi_top_compradores_rango: {
        Args: {
          limite?: number
          p_desde?: string
          p_hasta?: string
          termino?: string
        }
        Returns: Json
      }
      bi_top_proveedores: {
        Args: { limite?: number; termino?: string }
        Returns: Json
      }
      bi_top_proveedores_rango: {
        Args: {
          limite?: number
          p_desde?: string
          p_hasta?: string
          termino?: string
        }
        Returns: Json
      }
      buscar_licitaciones: {
        Args: { busqueda: string }
        Returns: {
          cantidad: string | null
          created_at: string | null
          descripcion: string | null
          id: number
          id_producto_inventario: string | null
          incluido_en_oferta: boolean | null
          item_index: number
          licitacion_codigo: string
          margen_estimado: number | null
          match_confidence: number | null
          match_method: string | null
          match_procesado: boolean | null
          nombre: string | null
          notas: string | null
          precio_total_sugerido: number | null
          precio_unitario_sugerido: number | null
          producto_id: string | null
          unidad: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "licitacion_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      buscar_licitaciones_keywords: {
        Args: { limite?: number; terminos: string[] }
        Returns: Json
      }
      buscar_oportunidades: {
        Args: {
          p_incluir_cerradas?: boolean
          p_limite?: number
          p_texto: string
        }
        Returns: {
          codigo: string
          coincidencia: string
          relevancia: number
          tipo: string
        }[]
      }
      buscar_teaser_licitaciones: {
        Args: { limite?: number; termino: string }
        Returns: Json
      }
      ca_hora_chile: { Args: { p: string }; Returns: string }
      calcular_buen_pagador: {
        Args: { organismo_nombre: string }
        Returns: boolean
      }
      calcular_margen_comercial: {
        Args: { costo_neto: number; precio_unitario: number }
        Returns: number
      }
      cerrar_compras_agiles_vencidas: { Args: never; Returns: number }
      cliente_afinidad: { Args: never; Returns: Json }
      cliente_aprendizaje: {
        Args: { p_cliente: string; p_dias?: number }
        Returns: Json
      }
      cliente_inventario_resumen: { Args: never; Returns: Json }
      cliente_owner_id: { Args: never; Returns: string }
      cm_buscar_productos: {
        Args: {
          desplazamiento?: number
          limite?: number
          p_tipo?: string
          termino?: string
        }
        Returns: Json
      }
      cm_mi_competitividad: {
        Args: { p_tipo?: string; umbral?: number }
        Returns: Json
      }
      cm_producto_detalle: {
        Args: { p_producto_key: string; p_tipo?: string }
        Returns: Json
      }
      cm_producto_tendencia: {
        Args: { p_producto_key: string; p_tipo?: string }
        Returns: Json
      }
      cm_stats: { Args: { p_tipo?: string }; Returns: Json }
      comisiones_atribuir: { Args: never; Returns: number }
      comisiones_cerrar_mes: {
        Args: { p_periodo?: string }
        Returns: {
          cliente_id: string
          comision: number
          email: string
          fijo: number
          ocs: number
          periodo: string
          total: number
          user_id: string
        }[]
      }
      comisiones_confirmar_preformas: { Args: never; Returns: number }
      comisiones_por_cobrar: {
        Args: never
        Returns: {
          cliente_id: string
          cobro_preapproval_id: string
          cobro_programado_en: string
          cobro_revertido_en: string
          estado: string
          factura_id: string
          fijo: number
          mp_preapproval_id: string
          periodo: string
          susc_estado: string
          total: number
          total_comision: number
        }[]
      }
      compras_agiles_pendientes_items: {
        Args: { p_limit?: number }
        Returns: {
          codigo: string
          id: number
        }[]
      }
      compras_agiles_unidades_activas: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          prefijo: string
          sufijo: string
          ultima_publicacion: string
          ultimo_seq: number
        }[]
      }
      create_default_search_profile: {
        Args: { user_id: string }
        Returns: string
      }
      cubo_consultar: {
        Args: {
          p_desc?: boolean
          p_desde?: string
          p_dims?: string[]
          p_filtros?: Json
          p_fuente?: string
          p_hasta?: string
          p_limite?: number
          p_offset?: number
          p_orden?: string
        }
        Returns: Json
      }
      cubo_opciones: {
        Args: {
          p_dim?: string
          p_fuente?: string
          p_limite?: number
          p_texto?: string
          p_tipo?: string
        }
        Returns: Json
      }
      cubo_refrescar: { Args: never; Returns: undefined }
      cubo_refrescar_1d: { Args: never; Returns: undefined }
      dashboard_kpis: {
        Args: never
        Returns: {
          match_score_promedio: number
          monto_en_pipeline: number
          oportunidades_activas: number
          tasa_exito: number
        }[]
      }
      dashboard_pipeline_por_estado: {
        Args: never
        Returns: {
          cantidad: number
          estado: string
          monto: number
        }[]
      }
      debe_enviar_notificacion: {
        Args: {
          cliente_id_param: string
          dia_semana_actual?: number
          hora_actual?: string
        }
        Returns: boolean
      }
      estadisticas_licitaciones: {
        Args: never
        Returns: {
          con_productos: number
          promedio_productos: number
          sin_productos: number
          sospechosas: number
          total_licitaciones: number
          total_productos: number
        }[]
      }
      evaristo_accion_decidir: {
        Args: { p_confirmar: boolean; p_id: string }
        Returns: Json
      }
      evaristo_acciones_recientes: {
        Args: { p_limite?: number }
        Returns: Json
      }
      evaristo_contexto: { Args: { p_codigo?: string }; Returns: Json }
      exec_sql: { Args: { sql_text: string }; Returns: Json }
      experto_activar_pro:
        | {
            Args: { p_dias: number; p_origen: string; p_user_id: string }
            Returns: string
          }
        | {
            Args: {
              p_dias: number
              p_nivel?: string
              p_origen: string
              p_user_id: string
            }
            Returns: string
          }
      experto_adjudicaciones: {
        Args: {
          cantidad?: number
          meses?: number
          p_rut?: string
          texto?: string
        }
        Returns: {
          adjudicatario: string
          adjudicatario_rut: string
          codigo: string
          comprador: string
          fecha_adjudicacion: string
          monto_adjudicado: number
          monto_estimado: number
          num_oferentes: number
          oferentes: string
          titulo: string
        }[]
      }
      experto_anexo_word_borrar: {
        Args: { p_id: string; p_user_id: string }
        Returns: string
      }
      experto_anexo_word_insertar: {
        Args: {
          p_campos: Json
          p_campos_validar: number
          p_codigo: string
          p_documento_id: string
          p_nombre: string
          p_storage_path: string
          p_user_id: string
        }
        Returns: string
      }
      experto_anexos_texto: {
        Args: { p_codigo: string }
        Returns: {
          archivo: string
          caracteres: number
          creado_en: string
          id: string
          paginas: number
          secciones: Json
        }[]
      }
      experto_anexos_word_listar: {
        Args: { p_codigo: string; p_user_id: string }
        Returns: {
          campos: Json
          campos_validar: number
          creado_en: string
          id: string
          nombre: string
          storage_path: string
        }[]
      }
      experto_bajo_agua_cuota: {
        Args: { p_user_id: string }
        Returns: {
          maximo: number
          periodo: string
          plan: string
          usados: number
        }[]
      }
      experto_bajo_agua_datos: { Args: { p_codigo: string }; Returns: Json }
      experto_bajo_agua_mi_cuota: {
        Args: never
        Returns: {
          maximo: number
          periodo: string
          plan: string
          usados: number
        }[]
      }
      experto_bases_estado: {
        Args: { p_codigo: string }
        Returns: {
          archivos: number
          paginas: number
          ultimo: string
        }[]
      }
      experto_bases_secreto: { Args: { p_nombre: string }; Returns: string }
      experto_bases_texto: {
        Args: { p_codigo: string }
        Returns: {
          archivo: string
          caracteres: number
          creado_en: string
          id: string
          paginas: number
          resumen: Json
          secciones: Json
        }[]
      }
      experto_buscar: {
        Args: { cantidad?: number; consulta_embedding: string; umbral?: number }
        Returns: {
          fuente: string
          id: number
          seccion: string
          similitud: number
          texto: string
          url: string
        }[]
      }
      experto_buscar_or: {
        Args: { cantidad?: number; consulta: string }
        Returns: {
          fuente: string
          id: number
          relevancia: number
          seccion: string
          texto: string
          url: string
        }[]
      }
      experto_buscar_organismo: { Args: { p_texto: string }; Returns: string }
      experto_buscar_texto: {
        Args: { cantidad?: number; consulta: string }
        Returns: {
          fuente: string
          id: number
          relevancia: number
          seccion: string
          texto: string
          url: string
        }[]
      }
      experto_compartido: {
        Args: { p_token: string }
        Returns: {
          codigo: string
          contenido: string
          creado_en: string
          empresa: string
          tipo: string
          titulo: string
          vistas: number
        }[]
      }
      experto_compartir: {
        Args: {
          p_codigo: string
          p_contenido: string
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      experto_competencia: {
        Args: { cantidad?: number; meses?: number; texto: string }
        Returns: {
          compradores: number
          monto: number
          ordenes: number
          precio_unit_mediano: number
          proveedor: string
          rut: string
        }[]
      }
      experto_competencia_licitacion: {
        Args: { cantidad?: number; meses?: number; p_codigo: string }
        Returns: {
          compradores: number
          monto: number
          ordenes: number
          precio_unit_mediano: number
          proveedor: string
          rut: string
        }[]
      }
      experto_compras_agiles: {
        Args: {
          cantidad?: number
          dias?: number
          p_region?: string
          solo_abiertas?: boolean
          texto: string
        }
        Returns: {
          cierra: string
          codigo: string
          conducta_pago: string
          estado: string
          monto: number
          nombre: string
          organismo: string
          pago_dias: number
          publicada: string
          region: string
          url: string
        }[]
      }
      experto_cuota: {
        Args: { p_ip: string }
        Returns: {
          anon_24h: number
          ip_anon_24h: number
          ip_hora: number
        }[]
      }
      experto_documento_borrar: {
        Args: { p_id: string; p_user_id: string }
        Returns: string
      }
      experto_documento_insertar: {
        Args: {
          p_codigo: string
          p_nombre: string
          p_storage_path: string
          p_texto: string
          p_tipo: string
          p_user_id: string
        }
        Returns: string
      }
      experto_documento_ruta: {
        Args: { p_id: string; p_user_id: string }
        Returns: {
          codigo: string
          id: string
          nombre: string
          storage_path: string
          tipo: string
        }[]
      }
      experto_documentos_cupo: {
        Args: { p_codigo: string; p_user_id: string }
        Returns: {
          max_mb: number
          maximo: number
          plan: string
          usados: number
        }[]
      }
      experto_documentos_listar: {
        Args: { p_codigo: string; p_user_id: string }
        Returns: {
          caracteres: number
          codigo: string
          creado_en: string
          id: string
          nombre: string
          tipo: string
        }[]
      }
      experto_documentos_texto: {
        Args: { p_codigo: string; p_max?: number; p_user_id: string }
        Returns: {
          creado_en: string
          id: string
          nombre: string
          texto: string
          tipo: string
        }[]
      }
      experto_entregables_texto: {
        Args: { p_codigo: string; p_user_id: string }
        Returns: {
          creado_en: string
          modo: string
          respuesta: string
        }[]
      }
      experto_estudio_organismo: {
        Args: {
          p_cantidad?: number
          p_meses?: number
          p_rut: string
          p_texto: string
        }
        Returns: {
          adjudicatario: string
          adjudicatario_rut: string
          codigo: string
          estado: string
          fecha: string
          fuente: string
          monto_adjudicado: number
          monto_estimado: number
          num_oferentes: number
          oferentes: string
          similitud: number
          titulo: string
        }[]
      }
      experto_existe_fuente: { Args: { p_fuente: string }; Returns: boolean }
      experto_feedback: {
        Args: {
          p_comentario?: string
          p_huella: string
          p_pregunta: string
          p_util: boolean
        }
        Returns: undefined
      }
      experto_ficha_licitacion: { Args: { p_codigo: string }; Returns: Json }
      experto_fragmentacion_organismo: {
        Args: { p_codigo_licitacion: string; p_dias_ventana?: number }
        Returns: {
          codigo: string
          dias_desde: number
          estado: string
          fecha_publicacion: string
          moneda: string
          nombre: string
          presupuesto_estimado: number
          señal: string
        }[]
      }
      experto_insertar: { Args: { filas: Json }; Returns: number }
      experto_libro: { Args: { p_codigo: string }; Returns: Json }
      experto_libro_archivar: {
        Args: { p_archivado?: boolean; p_codigo: string }
        Returns: undefined
      }
      experto_licitaciones: {
        Args: {
          cantidad?: number
          dias?: number
          p_region?: string
          solo_abiertas?: boolean
          texto: string
        }
        Returns: {
          cierra: string
          codigo: string
          coincidencia: string
          estado: string
          institucion: string
          moneda: string
          nombre: string
          presupuesto: number
          publicada: string
          region: string
          tipo: string
          url: string
        }[]
      }
      experto_licitaciones_similares: {
        Args: { p_cantidad?: number; p_codigo: string; p_meses?: number }
        Returns: {
          adjudicatario_nombre: string
          adjudicatario_rut: string
          codigo: string
          fecha_cierre: string
          institucion: string
          monto_adjudicado: number
          monto_estimado: number
          tipo_producto: string
          titulo: string
        }[]
      }
      experto_matriz_guardar: {
        Args: { p_codigo: string; p_matriz: Json }
        Returns: undefined
      }
      experto_memoria: {
        Args: { p_huella: string; p_user_id: string }
        Returns: {
          comentario: string
          creado_en: string
          pregunta: string
          util: boolean
        }[]
      }
      experto_mi_plan: { Args: never; Returns: string }
      experto_mis_libros: {
        Args: { p_archivados?: boolean; p_buscar?: string }
        Returns: {
          archivado: boolean
          cierre: string
          codigo: string
          consultas: number
          institucion: string
          nombre: string
          ultima: string
        }[]
      }
      experto_noticias: {
        Args: { cantidad?: number; consulta: string }
        Returns: {
          fecha: string
          fuente: string
          id: number
          relevancia: number
          seccion: string
          texto: string
          url: string
        }[]
      }
      experto_organismo: {
        Args: { nombre_o_rut: string }
        Returns: {
          conducta_pago: string
          dato_pago_al: string
          institucion: string
          licitaciones_abiertas: number
          monto_12m: number
          oc_12m: number
          oc_monto_total: number
          oc_total: number
          pago_promedio_dias: number
          plazo_pago: string
          procesos_12m: number
          reclamantes_pago_12m: number
          reclamos: number
          reclamos_desde: string
          reclamos_hace_90d: number
          reclamos_pago_12m: number
          reclamos_pago_90d: number
          reclamos_pago_por_100_procesos: number
          reclamos_proceso_12m: number
          region: string
          rut: string
          top_proveedores: Json
          top_reclamante: string
          top_reclamante_pct: number
        }[]
      }
      experto_panorama: {
        Args: { dias?: number; texto: string }
        Returns: {
          compras_agiles_abiertas: number
          compras_agiles_periodo: number
          licitaciones_abiertas: number
          licitaciones_periodo: number
          presupuesto_total: number
          top_instituciones: Json
          top_regiones: Json
        }[]
      }
      experto_panorama_licitacion: {
        Args: { p_codigo: string; p_user_id?: string }
        Returns: Json
      }
      experto_patrones_licitacion: {
        Args: { p_anos_atras?: number; p_codigo_licitacion: string }
        Returns: {
          codigo: string
          dias_desde: number
          estado: string
          fecha_publicacion: string
          moneda: string
          nombre: string
          presupuesto_estimado: number
          señal: string
          veces_licitado: number
        }[]
      }
      experto_plus_checklist: {
        Args: { p_user_id?: string }
        Returns: {
          item: string
          listo: boolean
          obligatorio: boolean
        }[]
      }
      experto_proveedor: {
        Args: { nombre_o_rut: string }
        Returns: {
          monto_12m: number
          ordenes_12m: number
          primera_oc: string
          productos_frecuentes: Json
          proveedor: string
          rut: string
          top_compradores: Json
          ultima_oc: string
        }[]
      }
      experto_prueba_estado: {
        Args: never
        Returns: {
          disponible: boolean
          hasta: string
          usada_en: string
        }[]
      }
      experto_prueba_iniciar: { Args: never; Returns: string }
      experto_registrar_consulta: {
        Args: { p_fuentes: Json; p_pregunta: string; p_respuesta: string }
        Returns: undefined
      }
      experto_registrar_uso: {
        Args: {
          p_fuentes: Json
          p_huella: string
          p_ip?: string
          p_licitacion: string
          p_modo: string
          p_ms: number
          p_pregunta: string
          p_respuesta: string
          p_user_id: string
        }
        Returns: undefined
      }
      experto_texto_competencia: {
        Args: { p_codigo: string; p_modo?: number }
        Returns: string
      }
      experto_top_adjudicatarios: {
        Args: { cantidad?: number; meses?: number; p_rut: string }
        Returns: {
          adjudicatario: string
          licitaciones: number
          monto: number
          participaciones: number
          rut: string
        }[]
      }
      experto_uso_mes: {
        Args: { p_huella: string; p_user_id: string }
        Returns: {
          consultas: number
          informes: number
          plan: string
        }[]
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      facturas_admin: {
        Args: never
        Returns: {
          comision: number
          documento_url: string
          email: string
          empresa: string
          estado: string
          fijo: number
          id: string
          numero_factura: string
          ocs: number
          periodo: string
          total: number
          validacion_hasta: string
        }[]
      }
      facturas_marcar_emitida: {
        Args: { p_id: string; p_numero: string; p_url?: string }
        Returns: undefined
      }
      ferreteria_panorama: {
        Args: { p_region?: string }
        Returns: {
          alcance: string
          dias_pago_promedio: number
          monto_millones: number
          ocs: number
          organismos: number
          region_usada: string
          top_organismos: Json
        }[]
      }
      generar_matches_ca: {
        Args: { p_cliente: string; p_umbral?: number }
        Returns: number
      }
      generar_matches_ca_items: {
        Args: { p_cliente: string; p_umbral?: number }
        Returns: number
      }
      generar_matches_ca_items_todos: { Args: never; Returns: number }
      generar_matches_ca_para_mi: { Args: never; Returns: number }
      generar_matches_ca_todos: { Args: never; Returns: number }
      generar_matches_lic: {
        Args: { p_bucket?: number; p_buckets?: number; p_umbral?: number }
        Returns: number
      }
      generar_matches_lic_bg: { Args: never; Returns: number }
      generar_matches_lic_items:
        | { Args: { p_umbral?: number }; Returns: number }
        | {
            Args: { p_bucket?: number; p_buckets?: number; p_umbral?: number }
            Returns: number
          }
      generar_matches_lic_items_cliente: {
        Args: { p_cliente: string; p_umbral?: number }
        Returns: number
      }
      generar_matches_lic_items_todos: { Args: never; Returns: number }
      generar_matches_lic_pendientes: {
        Args: { p_limite?: number; p_umbral?: number }
        Returns: number
      }
      generar_matches_lic_todo: { Args: never; Returns: number }
      generar_matches_lic_todo_bg: { Args: never; Returns: number }
      generar_matches_todos: { Args: never; Returns: number }
      generar_ofertas_desde_matches: {
        Args: { p_max_ofertas?: number; p_score_min?: number }
        Returns: Json
      }
      get_compra_agil_items: {
        Args: { p_codigo: string }
        Returns: {
          cantidad: number
          descripcion: string
          id: number
          item_index: number
          nombre: string
          producto_id: number
          unidad: string
        }[]
      }
      get_compras_agiles_filtradas: {
        Args: { p_cliente_id: string }
        Returns: {
          codigo: string
          descripcion: string
          detalle_scrapeado: boolean
          estado: string
          fecha_cierre: string
          fecha_publicacion: string
          id: number
          match_score: number
          moneda: string
          monto_estimado: number
          nombre: string
          nombre_organismo: string
          region: string
          url_ficha: string
        }[]
      }
      get_licitaciones_filtradas: {
        Args: { p_cliente_id: string }
        Returns: {
          categoria: string | null
          categoria_match: string | null
          codigo: string
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          id: number
          last_scraped_at: string | null
          link_detalle: string | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          unidad: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "licitaciones"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_licitaciones_filtradas_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          categoria: string | null
          categoria_match: string | null
          codigo: string
          comuna: string | null
          created_at: string | null
          datos_json: Json | null
          departamento: string | null
          descripcion: string | null
          direccion: string | null
          direccion_entrega: string | null
          estado: string | null
          estado_detallado: string | null
          fecha_cierre: string | null
          fecha_cierre_primer_llamado: string | null
          fecha_cierre_segundo_llamado: string | null
          fecha_extraccion: string | null
          fecha_publicacion: string | null
          finaliza_el: string | null
          id: number
          last_scraped_at: string | null
          link_detalle: string | null
          match_encontrado: boolean | null
          match_score: number | null
          moneda: string | null
          monto_estimado: number | null
          nombre: string
          nombre_organismo: string | null
          oferta_enviada: boolean | null
          oferta_id: string | null
          organismo: string | null
          palabras_encontradas: Json | null
          plazo_entrega: string | null
          presupuesto_estimado: number | null
          procesada: boolean | null
          publicada_el: string | null
          region: string | null
          rut_institucion: string | null
          stale: boolean
          stale_marked_at: string | null
          tiene_adjuntos: boolean | null
          tipo: string | null
          tipo_presupuesto: string | null
          titulo: string | null
          unidad: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "licitaciones"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_match_percentage: {
        Args: { p_cliente_id: string; p_licitacion_codigo: string }
        Returns: {
          items_con_match: number
          porcentaje_match: number
          total_items: number
        }[]
      }
      get_matching_products: {
        Args: { p_cliente_id: string; p_licitacion_codigo: string }
        Returns: {
          item_cantidad: string
          item_index: number
          item_nombre: string
          item_unidad: string
          match_score: number
          producto_id: number
          producto_nombre: string
          producto_precio: number
          producto_sku: string
          producto_stock: number
        }[]
      }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_role: { Args: never; Returns: string }
      guardian_fix_detalle_flag: { Args: never; Returns: number }
      guardian_fix_lic_match_flag: { Args: never; Returns: number }
      guardian_fix_match_flag: { Args: never; Returns: number }
      guardian_items_para_ia: { Args: { p_max?: number }; Returns: Json[] }
      guardian_lic_items_para_ia: { Args: { p_max?: number }; Returns: Json[] }
      guardian_match_items: { Args: { p_limite?: number }; Returns: Json }
      guardian_match_lic_items: { Args: { p_limite?: number }; Returns: Json }
      guardian_normalizar_matching: { Args: { txt: string }; Returns: string }
      guardian_reporte_ejecutivo: { Args: { p_dias?: number }; Returns: Json }
      guardian_snapshot: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      imagen_rubro: {
        Args: { p_orientacion?: string; p_semilla?: string; p_texto: string }
        Returns: {
          alt: string
          fotografo: string
          fotografo_url: string
          pexels_url: string
          termino: string
          url_grande: string
          url_mediana: string
          url_pequena: string
        }[]
      }
      inicializar_filtros_oportunidades: { Args: never; Returns: undefined }
      inicializar_preferencias_reportes: { Args: never; Returns: undefined }
      institucion_reclamos_resumen: {
        Args: { p_dias?: number; p_rut: string }
        Returns: {
          desde: string
          pago: number
          pago_90d: number
          pago_por_100_procesos: number
          proceso: number
          procesos_publicados: number
          reclamantes_pago: number
          top_reclamante: string
          top_reclamante_pct: number
        }[]
      }
      instituciones_pendientes_pago: {
        Args: { p_dias?: number; p_limit?: number }
        Returns: {
          codigos: string[]
          nombre: string
          rut: string
        }[]
      }
      inteligencia_oc_oportunidad: {
        Args: { p_codigo: string; p_limit?: number; p_tipo: string }
        Returns: {
          cantidad: number
          fecha: string
          oc_codigo: string
          organismo: string
          precio_unitario: number
          producto: string
          proveedor: string
          rut_proveedor: string
          score: number
          valor_total: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      licitaciones_adjuntos_pendientes: {
        Args: { p_limite?: number }
        Returns: {
          codigo: string
        }[]
      }
      licitaciones_adjuntos_vencidos: {
        Args: { p_dias?: number; p_limite?: number }
        Returns: {
          codigo: string
        }[]
      }
      licitaciones_pendientes_items: {
        Args: { p_limit?: number }
        Returns: {
          codigo: string
          id: string
        }[]
      }
      limpiar_duplicados_contactos: {
        Args: never
        Returns: {
          eliminados: number
          procesados: number
        }[]
      }
      marcar_intento_pago: { Args: { p_rut: string }; Returns: undefined }
      marketing_actualizar_ultimo_contacto: {
        Args: { p_contacto_id: string }
        Returns: undefined
      }
      marketing_calcular_metricas: {
        Args: { campana_id_in: string; fecha_in: string }
        Returns: undefined
      }
      marketing_importar_contactos: {
        Args: { p_cantidad?: number; p_fuente: string; p_tabla_origen: string }
        Returns: {
          duplicados: number
          errores: number
          importados: number
        }[]
      }
      marketing_importar_webinars: {
        Args: never
        Returns: {
          duplicados: number
          errores: number
          importados: number
        }[]
      }
      marketing_registrar_auditoria: {
        Args: {
          p_accion: string
          p_cantidad: number
          p_detalles?: Json
          p_fuente: string
        }
        Returns: string
      }
      match_compra_items: {
        Args: { p_titulo: string }
        Returns: {
          inventory_id: string
          match_score: number
          nombre_producto: string
          precio_unitario: number
        }[]
      }
      match_sim: {
        Args: {
          p_inv_cod: string
          p_inv_norm: string
          p_item_cod: string
          p_item_norm: string
        }
        Returns: number
      }
      medios_norm: { Args: { p: string }; Returns: string }
      medios_organismo: {
        Args: { p_cantidad?: number; p_codigo?: string; p_organismo?: string }
        Returns: {
          fecha: string
          id: number
          medio: string
          organismo: string
          resumen: string
          revisado_en: string
          tipo_medio: string
          titulo: string
          url: string
        }[]
      }
      medios_organismo_de: { Args: { p_codigo: string }; Returns: string }
      medios_organismos_pendientes: {
        Args: { p_limite?: number }
        Returns: {
          organismo: string
        }[]
      }
      mp_tipo_oc: { Args: { codigo: string }; Returns: string }
      noticias_insertar: { Args: { p_filas: Json }; Returns: number }
      ocds_codigos_pendientes: {
        Args: { p_max?: number }
        Returns: {
          codigo: string
        }[]
      }
      ocds_marcar_mes: {
        Args: {
          p_anio: number
          p_completo: boolean
          p_mes: number
          p_offset: number
          p_total: number
        }
        Returns: undefined
      }
      ocds_mes_pendiente: {
        Args: never
        Returns: {
          anio: number
          mes: number
          offset_leido: number
          total: number
        }[]
      }
      ocds_upsert: { Args: { p_filas: Json }; Returns: number }
      onboarding_resumen: {
        Args: { p_candidatas: string[]; p_incluidas: string[] }
        Returns: Json
      }
      organismo_riesgo: {
        Args: { p_codigo?: string; p_nombre?: string }
        Returns: {
          conducta_pago: string
          dato_pago_al: string
          institucion: string
          nivel: string
          pago_por_100_procesos: number
          pago_promedio_dias: number
          plazo_pago: string
          procesos_12m: number
          reclamantes_pago: number
          reclamos_desde: string
          reclamos_ficha: number
          reclamos_pago_12m: number
          reclamos_pago_90d: number
          reclamos_proceso_12m: number
          rut: string
          top_reclamante_pct: number
        }[]
      }
      pexels_termino_rubro: { Args: { p_texto: string }; Returns: string }
      precio_mercado: {
        Args: { p_texto: string }
        Returns: {
          lider: string
          lider_precio: number
          ordenes: number
          precio_max: number
          precio_mediano: number
          precio_min: number
          proveedores: number
        }[]
      }
      process_validador_email_queue: {
        Args: never
        Returns: {
          errores: number
          procesados: number
        }[]
      }
      proveedor_estado_detalle: { Args: { p_rut: string }; Returns: Json }
      proveedores_estado: {
        Args: {
          institucion?: string
          lim?: number
          off?: number
          q?: string
          rubro?: string
        }
        Returns: {
          monto_2026: number | null
          monto_total: number | null
          n_ocs: number | null
          n_ocs_2026: number | null
          proveedor_nombre: string | null
          rut_proveedor: string | null
          ultima_fecha: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mv_proveedores_estado"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      public_landing_stats: { Args: never; Returns: Json }
      quitar_acentos: { Args: { t: string }; Returns: string }
      recalcular_indicadores_vendedores: {
        Args: { p_periodo?: string }
        Returns: number
      }
      reclamos_mp_dias_pendientes: {
        Args: { p_max?: number }
        Returns: {
          fecha: string
          tipo: number
        }[]
      }
      reclamos_mp_marcar_dia: {
        Args: {
          p_cargados: number
          p_completo: boolean
          p_fecha: string
          p_tipo: number
          p_total: number
        }
        Returns: undefined
      }
      reclamos_mp_upsert: { Args: { p_filas: Json }; Returns: number }
      refrescar_cm_bi: { Args: never; Returns: undefined }
      registrar_conducta_pago: {
        Args: {
          p_codigo: string
          p_plazo: string
          p_reclamos: number
          p_rut: string
        }
        Returns: undefined
      }
      registrar_enriquecimiento_log: {
        Args: {
          p_errores?: number
          p_mensaje_error?: string
          p_metadata?: Json
          p_proceso: string
          p_registros_actualizados: number
          p_registros_nuevos: number
          p_registros_procesados: number
        }
        Returns: string
      }
      revisar_datos_prueba_licitaciones: {
        Args: never
        Returns: {
          accion_sugerida: string
          codigo: string
          created_at: string
          nombre: string
          num_items: number
          organismo: string
          tipo: string
        }[]
      }
      rubros_estado: {
        Args: never
        Returns: {
          rubro: string
        }[]
      }
      rut_cuerpo: { Args: { p: string }; Returns: string }
      rut_formatear: { Args: { p: string }; Returns: string }
      secreto_vault: { Args: { p_nombre: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_compras_agiles_match_flags: { Args: never; Returns: number }
      tsq_oportunidad: { Args: { texto: string }; Returns: unknown }
      tsv_oportunidad: { Args: { a: string; b: string }; Returns: unknown }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_compras_agiles_batch: {
        Args: { compras_data: Json }
        Returns: Json
      }
      user_can_access_section: {
        Args: { _section_key: string; _user_id: string }
        Returns: boolean
      }
      validar_email_basico: { Args: { p_email: string }; Returns: string }
      youtube_sincronizar_suscriptores: {
        Args: { p_canal_id: string }
        Returns: {
          duplicados: number
          errores: number
          sincronizados: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "vendedor" | "visor"
      notification_frequency: "immediate" | "daily" | "weekly"
      pipeline_etapa:
        | "descubierta"
        | "seguimiento"
        | "preparacion"
        | "postulada"
        | "evaluacion"
        | "adjudicada"
        | "oc_emitida"
        | "pagada"
        | "perdida"
        | "no_participaremos"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      pipeline_etapa: [
        "descubierta",
        "seguimiento",
        "preparacion",
        "postulada",
        "evaluacion",
        "adjudicada",
        "oc_emitida",
        "pagada",
        "perdida",
        "no_participaremos",
      ],
    },
  },
} as const
