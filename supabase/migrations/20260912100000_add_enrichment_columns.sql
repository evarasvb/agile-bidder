-- Agregar columnas faltantes para enriquecimiento de contactos

ALTER TABLE IF EXISTS public.marketing_contactos
ADD COLUMN IF NOT EXISTS fuente_primaria text, -- mercadopublico, proveedores_estado, webinar, youtube, clientes
ADD COLUMN IF NOT EXISTS rubro text, -- tecnologia, ferreteria, alimentos, articulos_oficina, servicios, empresas_extranjeras
ADD COLUMN IF NOT EXISTS email_validado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estado_email text, -- valido, invalido, bounce, no_verificado
ADD COLUMN IF NOT EXISTS ultima_validacion timestamptz,
ADD COLUMN IF NOT EXISTS intentos_validacion int DEFAULT 0,
ADD COLUMN IF NOT EXISTS datos_enriquecimiento jsonb DEFAULT '{}'::jsonb;

-- Crear índices para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_email_validado ON public.marketing_contactos(email_validado);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_rubro ON public.marketing_contactos(rubro);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_fuente_primaria ON public.marketing_contactos(fuente_primaria);
CREATE INDEX IF NOT EXISTS idx_marketing_contactos_estado_email ON public.marketing_contactos(estado_email);
