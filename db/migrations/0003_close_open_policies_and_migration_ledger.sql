-- Migração 0003. Rode este arquivo no SQL Editor. Não rode schema.sql de novo.
-- Fecha regras antigas que liberavam geral, recria licenses e tickets como no schema atual
-- e tira schema_migrations da API pública.
-- Não mexe em porta, senha nem chave. O site continua na API HTTPS.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Garante que o admin antigo, reconhecido só pelo e-mail, continue admin depois
-- que is_admin() passar a olhar apenas user_id.
UPDATE public.admin_users au
SET user_id = u.id
FROM auth.users u
WHERE au.user_id IS NULL
  AND au.email IS NOT NULL
  AND lower(au.email) = lower(u.email);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE au.user_id IS NOT NULL AND au.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Remove policies antigas, inclusive as que citam a coluna inexistente is_admin.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('licenses', 'tickets')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    FOR r IN
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND (
                (tablename = 'profiles' AND policyname = 'Public profiles read')
             OR (tablename = 'audit_logs' AND policyname IN ('Permitir acesso audit_logs', 'Admins can manage audit_logs'))
             OR (
                    tablename IN ('profiles', 'audit_logs')
                AND 'authenticated' = ANY (roles)
                AND COALESCE(qual, with_check, '') IN ('true', '(true)')
                )
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Service role can manage all licenses" ON public.licenses;
CREATE POLICY "Service role can manage all licenses" ON public.licenses
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage all licenses" ON public.licenses;
CREATE POLICY "Admins can manage all licenses" ON public.licenses
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own licenses" ON public.licenses;
CREATE POLICY "Users can view their own licenses" ON public.licenses
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own licenses" ON public.licenses;

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.tickets;
CREATE POLICY "Users can insert their own tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
CREATE POLICY "Admins can update tickets" ON public.tickets
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Trigger legado lia public.profiles.is_admin e quebrava UPDATE em tickets.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS signature
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'protect_ticket_status'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.signature);
    END LOOP;
END $$;

DROP POLICY IF EXISTS "Permitir acesso audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can manage audit_logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Service role can manage audit_logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit_logs" ON public.audit_logs
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'schema_migrations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.schema_migrations', r.policyname);
    END LOOP;
END $$;

REVOKE ALL ON TABLE public.schema_migrations FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.schema_migrations FROM anon';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON TABLE public.schema_migrations FROM authenticated';
    END IF;
END $$;

INSERT INTO public.schema_migrations (version)
VALUES ('0003_close_open_policies_and_migration_ledger')
ON CONFLICT (version) DO NOTHING;
