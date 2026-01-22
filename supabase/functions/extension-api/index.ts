import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Input validation schemas and helpers
const MAX_STRING_LENGTH = {
  id_licitacion: 100,
  titulo: 500,
  organismo: 200,
  link_oficial: 2000,
  estado: 50,
  item_nombre: 500,
  item_descripcion: 2000,
  item_unidad: 50,
};

const VALID_ESTADOS = ['publicada', 'cerrada', 'desierta', 'adjudicada', 'en_evaluacion'];

interface ValidationError {
  field: string;
  message: string;
}

function validateString(value: any, maxLength: number, fieldName: string, required: boolean = false): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    if (required) {
      return { field: fieldName, message: `${fieldName} es requerido` };
    }
    return null;
  }
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} debe ser texto` };
  }
  if (value.length > maxLength) {
    return { field: fieldName, message: `${fieldName} excede el límite de ${maxLength} caracteres` };
  }
  return null;
}

function validateNumber(value: any, fieldName: string, options: { min?: number; max?: number; required?: boolean } = {}): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    if (options.required) {
      return { field: fieldName, message: `${fieldName} es requerido` };
    }
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return { field: fieldName, message: `${fieldName} debe ser un número válido` };
  }
  if (options.min !== undefined && num < options.min) {
    return { field: fieldName, message: `${fieldName} debe ser mayor o igual a ${options.min}` };
  }
  if (options.max !== undefined && num > options.max) {
    return { field: fieldName, message: `${fieldName} debe ser menor o igual a ${options.max}` };
  }
  return null;
}

function validateUrl(value: any, fieldName: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} debe ser texto` };
  }
  if (value.length > MAX_STRING_LENGTH.link_oficial) {
    return { field: fieldName, message: `${fieldName} excede el límite de ${MAX_STRING_LENGTH.link_oficial} caracteres` };
  }
  try {
    new URL(value);
  } catch {
    return { field: fieldName, message: `${fieldName} debe ser una URL válida` };
  }
  return null;
}

function validateDate(value: any, fieldName: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return { field: fieldName, message: `${fieldName} debe ser texto` };
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { field: fieldName, message: `${fieldName} debe ser una fecha válida` };
  }
  return null;
}

interface LicitacionInput {
  id_licitacion: string;
  titulo?: string;
  organismo?: string;
  presupuesto?: number | null;
  fecha_cierre?: string | null;
  link_oficial?: string | null;
  estado?: string;
}

interface ItemInput {
  nombre?: string;
  nombre_producto?: string;
  descripcion?: string | null;
  cantidad?: number;
  unidad?: string;
}

function validateLicitacionInput(licitacion: any): { valid: boolean; errors: ValidationError[]; sanitized: LicitacionInput | null } {
  const errors: ValidationError[] = [];
  
  if (!licitacion || typeof licitacion !== 'object') {
    errors.push({ field: 'licitacion', message: 'Objeto licitacion inválido' });
    return { valid: false, errors, sanitized: null };
  }

  // Required field
  const idError = validateString(licitacion.id_licitacion, MAX_STRING_LENGTH.id_licitacion, 'id_licitacion', true);
  if (idError) errors.push(idError);

  // Optional fields with validation
  const tituloError = validateString(licitacion.titulo, MAX_STRING_LENGTH.titulo, 'titulo');
  if (tituloError) errors.push(tituloError);

  const organismoError = validateString(licitacion.organismo, MAX_STRING_LENGTH.organismo, 'organismo');
  if (organismoError) errors.push(organismoError);

  const presupuestoError = validateNumber(licitacion.presupuesto, 'presupuesto', { min: 0, max: 999999999999 });
  if (presupuestoError) errors.push(presupuestoError);

  const fechaError = validateDate(licitacion.fecha_cierre, 'fecha_cierre');
  if (fechaError) errors.push(fechaError);

  const linkError = validateUrl(licitacion.link_oficial, 'link_oficial');
  if (linkError) errors.push(linkError);

  if (licitacion.estado && !VALID_ESTADOS.includes(licitacion.estado)) {
    errors.push({ field: 'estado', message: `estado debe ser uno de: ${VALID_ESTADOS.join(', ')}` });
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      id_licitacion: String(licitacion.id_licitacion).trim().substring(0, MAX_STRING_LENGTH.id_licitacion),
      titulo: licitacion.titulo ? String(licitacion.titulo).trim().substring(0, MAX_STRING_LENGTH.titulo) : undefined,
      organismo: licitacion.organismo ? String(licitacion.organismo).trim().substring(0, MAX_STRING_LENGTH.organismo) : undefined,
      presupuesto: licitacion.presupuesto !== null && licitacion.presupuesto !== undefined ? Number(licitacion.presupuesto) : null,
      fecha_cierre: licitacion.fecha_cierre || null,
      link_oficial: licitacion.link_oficial ? String(licitacion.link_oficial).trim().substring(0, MAX_STRING_LENGTH.link_oficial) : null,
      estado: licitacion.estado || undefined,
    }
  };
}

function validateItemsInput(items: any): { valid: boolean; errors: ValidationError[]; sanitized: ItemInput[] } {
  const errors: ValidationError[] = [];
  const sanitized: ItemInput[] = [];

  if (!items) {
    return { valid: true, errors: [], sanitized: [] };
  }

  if (!Array.isArray(items)) {
    errors.push({ field: 'items', message: 'items debe ser un array' });
    return { valid: false, errors, sanitized: [] };
  }

  if (items.length > 1000) {
    errors.push({ field: 'items', message: 'Máximo 1000 items permitidos' });
    return { valid: false, errors, sanitized: [] };
  }

  items.forEach((item: any, index: number) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `items[${index}]`, message: 'Item inválido' });
      return;
    }

    const nombre = item.nombre || item.nombre_producto;
    const nombreError = validateString(nombre, MAX_STRING_LENGTH.item_nombre, `items[${index}].nombre`);
    if (nombreError) errors.push(nombreError);

    const descripcionError = validateString(item.descripcion, MAX_STRING_LENGTH.item_descripcion, `items[${index}].descripcion`);
    if (descripcionError) errors.push(descripcionError);

    const cantidadError = validateNumber(item.cantidad, `items[${index}].cantidad`, { min: 0.001, max: 999999999 });
    if (cantidadError) errors.push(cantidadError);

    const unidadError = validateString(item.unidad, MAX_STRING_LENGTH.item_unidad, `items[${index}].unidad`);
    if (unidadError) errors.push(unidadError);

    if (errors.filter(e => e.field.startsWith(`items[${index}]`)).length === 0) {
      sanitized.push({
        nombre: nombre ? String(nombre).trim().substring(0, MAX_STRING_LENGTH.item_nombre) : undefined,
        descripcion: item.descripcion ? String(item.descripcion).trim().substring(0, MAX_STRING_LENGTH.item_descripcion) : null,
        cantidad: item.cantidad !== undefined ? Number(item.cantidad) : undefined,
        unidad: item.unidad ? String(item.unidad).trim().substring(0, MAX_STRING_LENGTH.item_unidad) : undefined,
      });
    }
  });

  return { valid: errors.length === 0, errors, sanitized };
}

interface ApiKeyData {
  id: string;
  cliente_id: string;
  activa: boolean;
}

interface ClienteData {
  id: string;
  empresa_nombre: string;
  categoria_negocio: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    
    // Validate API key for all actions except 'verify'
    let clienteId: string | null = null;
    let apiKeyId: string | null = null;

    if (apiKey) {
      // Extract prefix for lookup (first 12 chars: "fvb_ext_XXXX")
      const apiKeyPrefix = apiKey.substring(0, 12);
      
      // Hash the provided API key using SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const providedKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // First try to find by hash (new secure method)
      let keyData: ApiKeyData | null = null;
      let keyError: any = null;
      
      // Look up by prefix first, then verify hash
      const { data: candidateKeys, error: lookupError } = await supabase
        .from('extension_api_keys')
        .select('id, cliente_id, activa, api_key_hash, api_key')
        .eq('api_key_prefix', apiKeyPrefix);
      
      if (!lookupError && candidateKeys && candidateKeys.length > 0) {
        // Find matching key by hash
        for (const candidate of candidateKeys) {
          if (candidate.api_key_hash === providedKeyHash) {
            keyData = { id: candidate.id, cliente_id: candidate.cliente_id, activa: candidate.activa };
            break;
          }
        }
      }
      
      // Fallback: Check plain text api_key for backwards compatibility (migration period)
      if (!keyData) {
        const { data: legacyKeyData, error: legacyError } = await supabase
          .from('extension_api_keys')
          .select('id, cliente_id, activa')
          .eq('api_key', apiKey)
          .single();
        
        if (!legacyError && legacyKeyData) {
          keyData = legacyKeyData;
          
          // Migrate this key to hashed storage
          await supabase
            .from('extension_api_keys')
            .update({ 
              api_key_hash: providedKeyHash,
              api_key_prefix: apiKeyPrefix,
              api_key: '[MIGRATED]' // Clear plaintext after migration
            })
            .eq('id', legacyKeyData.id);
        }
      }

      if (!keyData) {
        return new Response(
          JSON.stringify({ error: 'API key inválida' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!keyData.activa) {
        return new Response(
          JSON.stringify({ error: 'API key desactivada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      clienteId = keyData.cliente_id;
      apiKeyId = keyData.id;

      // Update last_used
      await supabase
        .from('extension_api_keys')
        .update({ last_used: new Date().toISOString() })
        .eq('id', keyData.id);
    }

    // Route by action
    switch (action) {
      case 'verify': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get client info
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id, empresa_nombre, categoria_negocio')
          .eq('id', clienteId)
          .single();

        return new Response(
          JSON.stringify({ 
            success: true, 
            cliente: {
              id: cliente?.id,
              empresa: cliente?.empresa_nombre,
              categoria: cliente?.categoria_negocio
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-matches': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitaciones with matches for this client
        const { data: ofertas, error: ofertasError } = await supabase
          .from('cliente_ofertas')
          .select(`
            id,
            licitacion_id,
            match_score,
            estado,
            valor_total,
            created_at
          `)
          .eq('cliente_id', clienteId)
          .in('estado', ['pendiente', 'borrador'])
          .order('match_score', { ascending: false });

        if (ofertasError) {
          console.error('Error fetching ofertas:', ofertasError);
          return new Response(
            JSON.stringify({ error: 'Error obteniendo matches' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitacion details for each oferta
        const licitacionIds = ofertas?.map(o => o.licitacion_id) || [];
        
        const { data: licitaciones } = await supabase
          .from('licitaciones')
          .select('id_licitacion, titulo, organismo, presupuesto, fecha_cierre, link_oficial')
          .in('id_licitacion', licitacionIds);

        // Combine data
        const matches = ofertas?.map(oferta => {
          const licitacion = licitaciones?.find(l => l.id_licitacion === oferta.licitacion_id);
          return {
            oferta_id: oferta.id,
            licitacion_id: oferta.licitacion_id,
            match_score: oferta.match_score,
            estado: oferta.estado,
            valor_total: oferta.valor_total,
            titulo: licitacion?.titulo,
            organismo: licitacion?.organismo,
            presupuesto: licitacion?.presupuesto,
            fecha_cierre: licitacion?.fecha_cierre,
            link_oficial: licitacion?.link_oficial
          };
        }) || [];

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'get-matches', null, null, {
          count: matches.length
        }, req);

        return new Response(
          JSON.stringify({ success: true, matches }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-offer': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { oferta_id, licitacion_id } = body;

        if (!oferta_id && !licitacion_id) {
          return new Response(
            JSON.stringify({ error: 'oferta_id o licitacion_id requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get oferta
        let query = supabase
          .from('cliente_ofertas')
          .select('*')
          .eq('cliente_id', clienteId);

        if (oferta_id) {
          query = query.eq('id', oferta_id);
        } else {
          query = query.eq('licitacion_id', licitacion_id);
        }

        const { data: oferta, error: ofertaError } = await query.single();

        if (ofertaError || !oferta) {
          return new Response(
            JSON.stringify({ error: 'Oferta no encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get licitacion details
        const { data: licitacion } = await supabase
          .from('licitaciones')
          .select('*')
          .eq('id_licitacion', oferta.licitacion_id)
          .single();

        // Get licitacion items
        const { data: items } = await supabase
          .from('licitacion_items')
          .select('*')
          .eq('licitacion_id', oferta.licitacion_id);

        // Format for Chrome extension auto-fill
        const ofertaFormateada = {
          oferta_id: oferta.id,
          licitacion_id: oferta.licitacion_id,
          nombre_oferta: `Oferta ${oferta.licitacion_id} - FirmaVB`,
          productos: oferta.productos_ofertados,
          items_licitacion: items,
          valor_total: oferta.valor_total,
          margen_total: oferta.margen_total,
          observaciones: oferta.notas || 'Oferta generada con FirmaVB Postulador',
          licitacion: {
            titulo: licitacion?.titulo,
            organismo: licitacion?.organismo,
            presupuesto: licitacion?.presupuesto,
            fecha_cierre: licitacion?.fecha_cierre
          }
        };

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'get-offer', oferta.licitacion_id, oferta.id, {
          valor_total: oferta.valor_total
        }, req);

        return new Response(
          JSON.stringify({ success: true, oferta: ofertaFormateada }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'submit-result': {
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await req.json();
        const { oferta_id, success, numero_oferta_mp, mensaje, error_detalle } = body;

        if (!oferta_id) {
          return new Response(
            JSON.stringify({ error: 'oferta_id requerido' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify oferta belongs to client
        const { data: oferta } = await supabase
          .from('cliente_ofertas')
          .select('id, cliente_id, licitacion_id')
          .eq('id', oferta_id)
          .eq('cliente_id', clienteId)
          .single();

        if (!oferta) {
          return new Response(
            JSON.stringify({ error: 'Oferta no encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update oferta status
        const nuevoEstado = success ? 'enviada' : 'error';
        const notas = success 
          ? `Enviada via extensión. Número MP: ${numero_oferta_mp || 'N/A'}`
          : `Error al enviar: ${error_detalle || mensaje || 'Error desconocido'}`;

        await supabase
          .from('cliente_ofertas')
          .update({ 
            estado: nuevoEstado,
            notas: notas,
            updated_at: new Date().toISOString()
          })
          .eq('id', oferta_id);

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'submit-result', oferta.licitacion_id, oferta_id, {
          success,
          numero_oferta_mp,
          mensaje,
          error_detalle
        }, req);

        return new Response(
          JSON.stringify({ success: true, estado: nuevoEstado }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'sync-licitacion': {
        // Require API key authentication
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Parse and validate input
        let body: any;
        try {
          body = await req.json();
        } catch (parseError) {
          return new Response(
            JSON.stringify({ error: 'JSON inválido en el cuerpo de la solicitud' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { licitacion, items } = body;

        // Validate licitacion input
        const licitacionValidation = validateLicitacionInput(licitacion);
        if (!licitacionValidation.valid) {
          console.log('Licitacion validation errors:', licitacionValidation.errors);
          return new Response(
            JSON.stringify({ 
              error: 'Datos de licitación inválidos', 
              validation_errors: licitacionValidation.errors 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate items input
        const itemsValidation = validateItemsInput(items);
        if (!itemsValidation.valid) {
          console.log('Items validation errors:', itemsValidation.errors);
          return new Response(
            JSON.stringify({ 
              error: 'Datos de items inválidos', 
              validation_errors: itemsValidation.errors 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const sanitizedLicitacion = licitacionValidation.sanitized!;
        const sanitizedItems = itemsValidation.sanitized;

        console.log(`Syncing licitacion ${sanitizedLicitacion.id_licitacion} with ${sanitizedItems.length} items`);

        // Upsert licitacion with sanitized data
        const { error: licError } = await supabase
          .from('licitaciones')
          .upsert({
            id_licitacion: sanitizedLicitacion.id_licitacion,
            titulo: sanitizedLicitacion.titulo || `Licitación ${sanitizedLicitacion.id_licitacion}`,
            organismo: sanitizedLicitacion.organismo || 'Organismo no especificado',
            presupuesto: sanitizedLicitacion.presupuesto,
            fecha_cierre: sanitizedLicitacion.fecha_cierre,
            link_oficial: sanitizedLicitacion.link_oficial,
            estado: sanitizedLicitacion.estado || 'publicada',
            procesada: false,
            match_encontrado: false
          }, { onConflict: 'id_licitacion' });

        if (licError) {
          console.error('Error upserting licitacion:', licError);
          return new Response(
            JSON.stringify({ error: 'Error guardando licitación', details: licError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete existing items and insert new ones
        if (sanitizedItems.length > 0) {
          await supabase
            .from('licitacion_items')
            .delete()
            .eq('licitacion_id', sanitizedLicitacion.id_licitacion);

          const itemsToInsert = sanitizedItems.map((item) => ({
            licitacion_id: sanitizedLicitacion.id_licitacion,
            nombre_producto: item.nombre || 'Producto sin nombre',
            descripcion: item.descripcion || null,
            cantidad: item.cantidad !== undefined ? item.cantidad : 1,
            unidad: item.unidad || 'UN'
          }));

          const { error: itemsError } = await supabase
            .from('licitacion_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error inserting items:', itemsError);
          }
        }

        // Log activity
        if (clienteId && apiKeyId) {
          await logActivity(supabase, apiKeyId, clienteId, 'sync-licitacion', sanitizedLicitacion.id_licitacion, null, {
            items_count: sanitizedItems.length,
            titulo: sanitizedLicitacion.titulo
          }, req);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Licitación sincronizada con ${sanitizedItems.length} items`,
            licitacion_id: sanitizedLicitacion.id_licitacion
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-licitaciones': {
        // Require API key authentication
        if (!clienteId) {
          return new Response(
            JSON.stringify({ error: 'API key requerida para acceder a licitaciones' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get recent licitaciones for the extension to show
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        
        // Get licitaciones that have matches for this client
        const { data: clienteOfertas } = await supabase
          .from('cliente_ofertas')
          .select('licitacion_id')
          .eq('cliente_id', clienteId);

        const matchedLicitacionIds = clienteOfertas?.map(o => o.licitacion_id) || [];

        const { data: licitaciones, error } = await supabase
          .from('licitaciones')
          .select(`
            id_licitacion,
            titulo,
            organismo,
            presupuesto,
            fecha_cierre,
            link_oficial,
            estado,
            match_encontrado,
            match_score
          `)
          .in('id_licitacion', matchedLicitacionIds.length > 0 ? matchedLicitacionIds : ['__none__'])
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Error fetching licitaciones:', error);
          return new Response(
            JSON.stringify({ error: 'Error obteniendo licitaciones' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log activity
        await logActivity(supabase, apiKeyId, clienteId, 'get-licitaciones', null, null, {
          count: licitaciones?.length || 0,
          limit
        }, req);

        return new Response(
          JSON.stringify({ success: true, licitaciones: licitaciones || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida. Acciones: verify, get-matches, get-offer, submit-result, sync-licitacion, get-licitaciones' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Extension API error:', error);
    // Don't expose internal error details to clients
    console.error('Extension API internal error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function logActivity(
  supabase: any,
  apiKeyId: string | null,
  clienteId: string,
  action: string,
  licitacionId: string | null,
  ofertaId: string | null,
  detalles: Record<string, any>,
  req: Request
) {
  try {
    await supabase.from('extension_activity_log').insert({
      api_key_id: apiKeyId,
      cliente_id: clienteId,
      action,
      licitacion_id: licitacionId,
      oferta_id: ofertaId,
      detalles,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}
