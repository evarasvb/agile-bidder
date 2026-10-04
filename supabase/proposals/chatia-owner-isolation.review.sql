-- REVIEW ONLY: never apply the old ChatIA migration. No production execution authorized by this file.
-- Preconditions: both ChatIA tables absent; storage policy catalog matches reviewed snapshot.
BEGIN;
DO $$ BEGIN
 IF to_regclass('public.documentos_licitacion') IS NOT NULL OR to_regclass('public.chat_licitacion') IS NOT NULL THEN
  RAISE EXCEPTION 'ChatIA tables already exist: inspect schema and prepare an exact migration';
 END IF;
 IF
  (SELECT coalesce(jsonb_agg(jsonb_build_object('policyname',policyname,'permissive',permissive,'roles',roles::text,'cmd',cmd,'qual',qual,'with_check',with_check) ORDER BY policyname), '[]'::jsonb)
   FROM pg_policies WHERE schemaname='storage' AND tablename='objects') <> '[{"policyname":"Public can view product images","permissive":"PERMISSIVE","roles":"{public}","cmd":"SELECT","qual":"(bucket_id = ''product-images''::text)","with_check":null},{"policyname":"Users can delete own product images","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"DELETE","qual":"((bucket_id = ''product-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))","with_check":null},{"policyname":"Users can update own product images","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"UPDATE","qual":"((bucket_id = ''product-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))","with_check":null},{"policyname":"Users can upload product images","permissive":"PERMISSIVE","roles":"{authenticated}","cmd":"INSERT","qual":null,"with_check":"((bucket_id = ''product-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"},{"policyname":"documentos_empresa_delete","permissive":"PERMISSIVE","roles":"{public}","cmd":"DELETE","qual":"((bucket_id = ''documentos-empresa''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))","with_check":null},{"policyname":"documentos_empresa_insert","permissive":"PERMISSIVE","roles":"{public}","cmd":"INSERT","qual":null,"with_check":"((bucket_id = ''documentos-empresa''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))"},{"policyname":"documentos_empresa_select","permissive":"PERMISSIVE","roles":"{public}","cmd":"SELECT","qual":"((bucket_id = ''documentos-empresa''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))","with_check":null}]'::jsonb THEN
  RAISE EXCEPTION 'Existing storage policies require catalog review; this proposal must not compose with unknown permissive policies';
 END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='bases-licitacion' AND
   (public IS DISTINCT FROM false OR file_size_limit IS DISTINCT FROM 52428800
    OR allowed_mime_types IS DISTINCT FROM ARRAY['application/pdf']::text[])) THEN
  RAISE EXCEPTION 'Existing ChatIA bucket configuration differs from reviewed private PDF contract';
 END IF;
END $$;
-- =============================================
-- Chat IA con Bases de Licitación
-- Tables: documentos_licitacion, chat_licitacion
-- Storage bucket: bases-licitacion
-- =============================================

-- 1. Documentos de licitación (uploaded PDFs + extracted text)
CREATE TABLE public.documentos_licitacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL CHECK (split_part(storage_path, '/', 1)=user_id::text),
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
CREATE TABLE public.chat_licitacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  licitacion_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mensajes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_documentos_licitacion_licitacion_id ON public.documentos_licitacion(licitacion_id);
CREATE INDEX idx_documentos_licitacion_user_id ON public.documentos_licitacion(user_id);
CREATE INDEX idx_chat_licitacion_licitacion_id ON public.chat_licitacion(licitacion_id);
CREATE INDEX idx_chat_licitacion_user_id ON public.chat_licitacion(user_id);

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


-- Restrict table privileges explicitly. RLS retains the existing per-user ownership rule.
REVOKE ALL ON public.documentos_licitacion, public.chat_licitacion FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_licitacion, public.chat_licitacion TO authenticated;
-- Object key contract used by frontend: <user UUID>/<licitacion ID>/<filename>.
CREATE POLICY "ChatIA owner upload" ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='bases-licitacion' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "ChatIA owner read" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='bases-licitacion' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
CREATE POLICY "ChatIA owner delete" ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='bases-licitacion' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
-- No storage UPDATE: the application uploads without upsert and cannot rename/transfer files.
COMMIT;
