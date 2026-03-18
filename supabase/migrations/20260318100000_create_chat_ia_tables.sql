-- =============================================
-- Chat IA con Bases de Licitación
-- Tables: documentos_licitacion, chat_licitacion
-- Storage bucket: bases-licitacion
-- =============================================

-- 1. Documentos de licitación (uploaded PDFs + extracted text)
CREATE TABLE IF NOT EXISTS public.documentos_licitacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  total_pages integer,
  contenido_texto text,
  secciones jsonb DEFAULT '[]'::jsonb,
  resumen_automatico jsonb,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'ready', 'error')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Chat de licitación (conversation history)
CREATE TABLE IF NOT EXISTS public.chat_licitacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensajes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documentos_licitacion_licitacion_id ON public.documentos_licitacion(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_documentos_licitacion_user_id ON public.documentos_licitacion(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_licitacion_licitacion_id ON public.chat_licitacion(licitacion_id);
CREATE INDEX IF NOT EXISTS idx_chat_licitacion_user_id ON public.chat_licitacion(user_id);

-- RLS
ALTER TABLE public.documentos_licitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_licitacion ENABLE ROW LEVEL SECURITY;

-- Policies: users can CRUD their own records
CREATE POLICY "Users can view own documents" ON public.documentos_licitacion
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documentos_licitacion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documentos_licitacion
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documentos_licitacion
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chats" ON public.chat_licitacion
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats" ON public.chat_licitacion
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats" ON public.chat_licitacion
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats" ON public.chat_licitacion
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Storage bucket for tender PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bases-licitacion',
  'bases-licitacion',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload tender PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bases-licitacion' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view own tender PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bases-licitacion' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete own tender PDFs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bases-licitacion' AND
    auth.uid() IS NOT NULL
  );
