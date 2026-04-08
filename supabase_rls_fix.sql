-- =====================================================================
-- CORREÇÃO DE POLÍTICAS RLS — Forum Posts, Replies, Categories e Avatars
-- Execute no Supabase Dashboard → SQL Editor
-- =====================================================================


-- ── forum_posts ───────────────────────────────────────────────────────

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as políticas existentes antes de recriar
DROP POLICY IF EXISTS "Public can see approved posts"     ON forum_posts;
DROP POLICY IF EXISTS "Anyone can read approved posts"   ON forum_posts;
DROP POLICY IF EXISTS "Anon read approved posts"         ON forum_posts;
DROP POLICY IF EXISTS "Authenticated read all posts"     ON forum_posts;
DROP POLICY IF EXISTS "Authenticated insert posts"       ON forum_posts;
DROP POLICY IF EXISTS "Authenticated update posts"       ON forum_posts;
DROP POLICY IF EXISTS "Authenticated delete posts"       ON forum_posts;
DROP POLICY IF EXISTS "Researchers can insert posts"     ON forum_posts;
DROP POLICY IF EXISTS "Admin can update posts"           ON forum_posts;
DROP POLICY IF EXISTS "Admin can delete posts"           ON forum_posts;

-- Visitantes anônimos: só veem posts aprovados
CREATE POLICY "Anon read approved posts" ON forum_posts
  FOR SELECT TO anon
  USING (aprovado = true);

-- Usuários autenticados (pesquisadoras + admin): veem TODOS os posts
CREATE POLICY "Authenticated read all posts" ON forum_posts
  FOR SELECT TO authenticated
  USING (true);

-- Usuários autenticados podem inserir posts
CREATE POLICY "Authenticated insert posts" ON forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Usuários autenticados podem atualizar posts (admin aprova/fixa/fecha)
CREATE POLICY "Authenticated update posts" ON forum_posts
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Usuários autenticados podem deletar posts
CREATE POLICY "Authenticated delete posts" ON forum_posts
  FOR DELETE TO authenticated
  USING (true);


-- ── forum_replies ─────────────────────────────────────────────────────

ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can see approved replies"  ON forum_replies;
DROP POLICY IF EXISTS "Anon read approved replies"       ON forum_replies;
DROP POLICY IF EXISTS "Authenticated read all replies"   ON forum_replies;
DROP POLICY IF EXISTS "Authenticated insert replies"     ON forum_replies;
DROP POLICY IF EXISTS "Authenticated update replies"     ON forum_replies;
DROP POLICY IF EXISTS "Authenticated delete replies"     ON forum_replies;

CREATE POLICY "Anon read approved replies" ON forum_replies
  FOR SELECT TO anon
  USING (aprovado = true);

CREATE POLICY "Authenticated read all replies" ON forum_replies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert replies" ON forum_replies
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update replies" ON forum_replies
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated delete replies" ON forum_replies
  FOR DELETE TO authenticated
  USING (true);


-- ── researcher_id nullable (para tópicos criados pelo admin) ─────────
ALTER TABLE forum_posts ALTER COLUMN researcher_id DROP NOT NULL;


-- ── forum_categories ──────────────────────────────────────────────────

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone read categories"           ON forum_categories;
DROP POLICY IF EXISTS "Authenticated manage categories"  ON forum_categories;

CREATE POLICY "Anyone read categories" ON forum_categories
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated manage categories" ON forum_categories
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── Coluna capa_url na tabela works (capa de livros/obras) ────────────
ALTER TABLE works ADD COLUMN IF NOT EXISTS capa_url TEXT;


-- ── RLS da tabela researchers ─────────────────────────────────────────
-- Problema: pesquisadoras recém-convidadas têm auth_user_id=NULL, então
-- a política padrão (auth_user_id = auth.uid()) as torna invisíveis,
-- impedindo o fallback por email no painel e o link do auth_user_id.
-- Solução: ampliar as políticas para aceitar também email = auth.email().

ALTER TABLE researchers ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas antes de recriar
DROP POLICY IF EXISTS "Researchers can read own profile"        ON researchers;
DROP POLICY IF EXISTS "Researchers can update own profile"      ON researchers;
DROP POLICY IF EXISTS "Public can read researchers"             ON researchers;
DROP POLICY IF EXISTS "Authenticated can read researchers"      ON researchers;

-- Leitura pública: qualquer pessoa pode ver perfis de pesquisadoras
-- (necessário para o portal público exibir os perfis)
CREATE POLICY "Public read researchers" ON researchers
  FOR SELECT TO public
  USING (true);

-- Atualização: pesquisadora pode editar seu próprio registro
-- Aceita tanto auth_user_id (já vinculado) quanto email (primeiro acesso)
CREATE POLICY "Researcher update own profile" ON researchers
  FOR UPDATE TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR lower(email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR lower(email) = lower(auth.jwt() ->> 'email')
  );


-- ── Função para vincular auth_user_id sem depender de RLS ────────────
-- Chamada pelo definir-senha.html após updateUser({ password })
-- SECURITY DEFINER = roda como superusuário, ignora RLS

CREATE OR REPLACE FUNCTION public.link_researcher_auth_id()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE researchers
  SET auth_user_id = auth.uid()
  WHERE lower(email) = lower(auth.jwt() ->> 'email')
    AND (auth_user_id IS NULL OR auth_user_id != auth.uid());
END;
$$;


-- ── Colunas de imagem na tabela blog_posts ────────────────────────────
-- foto_capa  → imagem de capa exibida nos cards e no compartilhamento social
-- foto_header → imagem grande exibida no topo do post aberto
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS foto_capa   TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS foto_header TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS slug        TEXT;


-- ── Storage: bucket avatars (fotos de perfil) ─────────────────────────

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- Remove políticas antigas do bucket avatars
DROP POLICY IF EXISTS "Public upload avatars"          ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars"            ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete avatars"   ON storage.objects;

-- Qualquer pessoa (incluindo inscrições sem login) pode fazer upload
CREATE POLICY "Public upload avatars" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'avatars');

-- Qualquer pessoa pode ler/ver fotos de perfil
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Usuários autenticados podem substituir fotos existentes
CREATE POLICY "Authenticated update avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

-- Usuários autenticados podem apagar fotos
CREATE POLICY "Authenticated delete avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
