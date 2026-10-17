-- Migração 0002. Rode este arquivo no SQL Editor. Não rode schema.sql de novo.
-- Admin passa a valer só por user_id. Auditoria de admin fica somente leitura.
-- A senha mínima de 8 caracteres também precisa estar em Authentication > Providers > Email no painel do Supabase.
-- Este repositório não controla o GoTrue, então o SQL abaixo não altera essa configuração.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

UPDATE public.admin_users au
SET user_id = u.id
FROM auth.users u
WHERE au.user_id IS NULL
  AND au.email IS NOT NULL
  AND lower(au.email) = lower(u.email);

DO $$
DECLARE
    v_unbound integer;
BEGIN
    SELECT count(*) INTO v_unbound FROM public.admin_users WHERE user_id IS NULL;
    IF v_unbound > 0 THEN
        RAISE NOTICE '% linha(s) em admin_users sem user_id. Elas deixam de ser admin até o vínculo com auth.users.', v_unbound;
    END IF;
END $$;

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

CREATE OR REPLACE FUNCTION public.admin_users_require_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        RAISE EXCEPTION 'admin_users.user_id é obrigatório.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_users_require_user_id ON public.admin_users;
CREATE TRIGGER trg_admin_users_require_user_id
BEFORE INSERT OR UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.admin_users_require_user_id();

DROP POLICY IF EXISTS "Admins can manage audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
FOR SELECT TO authenticated
USING (public.is_admin());

INSERT INTO public.schema_migrations (version)
VALUES ('0002_admin_identity_and_audit_immutability')
ON CONFLICT (version) DO NOTHING;
