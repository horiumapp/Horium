-- ==============================================================================
-- HORIUM - SCHEMA COMPLETO DO BANCO DE DADOS (SUPABASE POSTGRESQL)
-- Versão com Hardening de Segurança, Prevenção de BOLA, Paywall Server-Side e Idempotência
-- ==============================================================================

-- 1. TABELA DE ADMINISTRADORES (ADMIN_USERS) COM RLS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO AUXILIAR DE SEGURANÇA (ADMIN) DINÂMICA E PROTEGIDA
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    v_user_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

    RETURN EXISTS (
        SELECT 1 FROM public.admin_users au
        WHERE (au.user_id IS NOT NULL AND au.user_id = auth.uid())
           OR (au.email IS NOT NULL AND LOWER(au.email) = v_user_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Gerenciamento de Administradores:
-- O papel de administrador é dinâmico e determinado unicamente por registros na tabela admin_users.
-- Exemplo para cadastrar administradores:
-- INSERT INTO public.admin_users (email) VALUES ('admin@dominio.com') ON CONFLICT (email) DO NOTHING;

-- Políticas de RLS para admin_users (Apenas admins gerenciam/visualizam)
DROP POLICY IF EXISTS "Admins can manage admin_users" ON public.admin_users;
CREATE POLICY "Admins can manage admin_users" ON public.admin_users
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RPC para o frontend consultar status de admin do usuário autenticado de forma segura
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;


-- 2. TABELA SCHEDULES (Horários Escolares)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    data JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_licensed BOOLEAN DEFAULT false
);

-- Habilitar RLS para schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para schedules
DROP POLICY IF EXISTS "Users can create their own schedules" ON public.schedules;
CREATE POLICY "Users can create their own schedules" ON public.schedules
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own schedules" ON public.schedules;
CREATE POLICY "Users can delete their own schedules" ON public.schedules
FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own schedules" ON public.schedules;
CREATE POLICY "Users can update their own schedules" ON public.schedules
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can view their own schedules" ON public.schedules;
CREATE POLICY "Users can view their own schedules" ON public.schedules
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Trigger para impedir que usuários comuns alterem ou insiram 'is_licensed' diretamente
CREATE OR REPLACE FUNCTION public.protect_schedule_license_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_licensed := false; -- Força false na criação para não-admins
        ELSIF TG_OP = 'UPDATE' AND NEW.is_licensed IS DISTINCT FROM OLD.is_licensed THEN
            NEW.is_licensed := OLD.is_licensed; -- Força manter o valor anterior
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_schedule_license ON public.schedules;
CREATE TRIGGER trg_protect_schedule_license
BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.protect_schedule_license_status();


-- 2.1 TABELA SCHEDULE_SOLUTIONS (Soluções de Horários Segregadas com Paywall Server-Side)
CREATE TABLE IF NOT EXISTS public.schedule_solutions (
    schedule_id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    fixed_lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    CONSTRAINT fk_schedule_solutions_schedule
        FOREIGN KEY (schedule_id)
        REFERENCES public.schedules(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED
);

-- Habilitar RLS para schedule_solutions (Leitura pública bloqueada, acesso apenas via RPC get_schedule_solution)
ALTER TABLE public.schedule_solutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage schedule_solutions" ON public.schedule_solutions;
CREATE POLICY "Admins can manage schedule_solutions" ON public.schedule_solutions
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Trigger para isolar fixedLessons e impedir vazamento no SELECT da tabela schedules
CREATE OR REPLACE FUNCTION public.isolate_schedule_solution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;

    -- Se o payload contiver fixedLessons com itens alocados, salva na tabela protegida schedule_solutions
    IF NEW.data ? 'fixedLessons' AND jsonb_array_length(COALESCE(NEW.data -> 'fixedLessons', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.schedule_solutions (schedule_id, user_id, fixed_lessons, updated_at)
        VALUES (NEW.id, NEW.user_id, NEW.data -> 'fixedLessons', timezone('utc', now()))
        ON CONFLICT (schedule_id) DO UPDATE 
        SET fixed_lessons = EXCLUDED.fixed_lessons,
            user_id = EXCLUDED.user_id,
            updated_at = timezone('utc', now());
    END IF;

    -- Remove fixedLessons de schedules.data para grades sem licença ativa (proteção contra vazamento via SELECT *)
    IF NOT COALESCE(NEW.is_licensed, false) THEN
        NEW.data := NEW.data - 'fixedLessons';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

DROP TRIGGER IF EXISTS trg_isolate_schedule_solution ON public.schedules;
CREATE TRIGGER trg_isolate_schedule_solution
BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.isolate_schedule_solution();


-- 3. TABELA LICENSES (Licenças de Turmas e Planos)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
    payment_date DATE,
    classes_amount INTEGER,
    value_paid NUMERIC,
    payment_method TEXT,
    payment_status TEXT CHECK (payment_status IN ('Aguardando', 'Aprovado', 'Rejeitado', 'under_review')),
    valid_until DATE,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS chk_licenses_positive_values;
ALTER TABLE public.licenses ADD CONSTRAINT chk_licenses_positive_values CHECK (
    (value_paid IS NULL OR value_paid > 0) AND 
    (classes_amount IS NULL OR classes_amount > 0)
);

ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS chk_licenses_receipt_url_safe;
ALTER TABLE public.licenses ADD CONSTRAINT chk_licenses_receipt_url_safe CHECK (
    receipt_url IS NULL OR 
    receipt_url ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_\.\-]+\.(png|jpe?g|webp|pdf)$' OR
    receipt_url ~* '^https://[a-zA-Z0-9\.\-]+/storage/v1/object/(public|sign)/receipts/.+'
);

-- Habilitar RLS para licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para licenses
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

-- Remoção de INSERT direto para usuários comuns: novos pedidos devem ser criados exclusivamente
-- via RPC segura request_license_order para garantir cálculo oficial de preços e auditoria no servidor.
DROP POLICY IF EXISTS "Users can insert their own licenses" ON public.licenses;


-- 4. TABELA NOTIFICATIONS (Notificações do Usuário)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Habilitar RLS para notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- INSERT restrito: apenas admins e service_role podem criar notificações.
-- Notificações para usuários comuns são criadas via RPCs SECURITY DEFINER (ex: approve_license_rpc).
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" ON public.notifications
FOR INSERT TO service_role WITH CHECK (true);


-- 5. TABELA TICKETS (Chamados de Suporte)
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'fechado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Habilitar RLS para tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.tickets;
CREATE POLICY "Users can insert their own tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update tickets" ON public.tickets;
CREATE POLICY "Admins can update tickets" ON public.tickets
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 6. TABELA AUDIT_LOGS (Logs de Auditoria de Operações)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT,
    record_id UUID,
    action TEXT,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    client_ip TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Garante retrocompatibilidade se a tabela já existir sem a coluna client_ip
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS client_ip TEXT;


-- Habilitar RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS restritivas para audit_logs (Isolamento Multi-Tenant e Imutabilidade para Usuários Comuns)
DROP POLICY IF EXISTS "Permitir acesso audit_logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Service role can manage audit_logs" ON public.audit_logs;
CREATE POLICY "Service role can manage audit_logs" ON public.audit_logs
FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can manage audit_logs" ON public.audit_logs
FOR ALL TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view their own audit_logs" ON public.audit_logs;
CREATE POLICY "Users can view their own audit_logs" ON public.audit_logs
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);


-- 7. FUNÇÕES SEGURAS PARA ADMINISTRAÇÃO E REGRAS DE NEGÓCIO (RPC COM SECURITY DEFINER)

-- RPC para buscar todas as licenças com e-mail dos usuários
DROP FUNCTION IF EXISTS public.get_admin_licenses();
CREATE OR REPLACE FUNCTION public.get_admin_licenses()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_email TEXT,
    payment_date DATE,
    classes_amount INTEGER,
    value_paid NUMERIC,
    payment_method TEXT,
    payment_status TEXT,
    valid_until DATE,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    schedule_id UUID,
    schedule_name TEXT
) AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem acessar esta função.';
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.user_id,
        u.email::TEXT AS user_email,
        l.payment_date,
        l.classes_amount,
        l.value_paid,
        l.payment_method,
        l.payment_status,
        l.valid_until,
        l.receipt_url,
        l.created_at,
        l.schedule_id,
        s.name AS schedule_name
    FROM public.licenses l
    LEFT JOIN auth.users u ON u.id = l.user_id
    LEFT JOIN public.schedules s ON s.id = l.schedule_id
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para aprovação idempotente de licença
DROP FUNCTION IF EXISTS public.approve_license_rpc(UUID, DATE);
CREATE OR REPLACE FUNCTION public.approve_license_rpc(
    p_license_id UUID,
    p_valid_until DATE
)
RETURNS VOID AS $$
DECLARE
    v_schedule_id UUID;
    v_user_id UUID;
    v_already_approved BOOLEAN;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem aprovar licenças.';
    END IF;

    -- Trava e verificação de idempotência
    SELECT payment_status = 'Aprovado' INTO v_already_approved
    FROM public.licenses
    WHERE id = p_license_id
    FOR UPDATE;

    IF v_already_approved IS TRUE THEN
        -- Já aprovado: operação idempotente
        RETURN;
    END IF;

    -- Atualiza o status e a data de validade da licença
    UPDATE public.licenses
    SET 
        payment_status = 'Aprovado',
        valid_until = p_valid_until
    WHERE id = p_license_id
    RETURNING schedule_id, user_id INTO v_schedule_id, v_user_id;

    -- Sincroniza a tabela schedules (mesmo se schedule_id era NULL originalmente na solicitação)
    IF v_schedule_id IS NULL AND v_user_id IS NOT NULL THEN
        SELECT id INTO v_schedule_id
        FROM public.schedules
        WHERE user_id = v_user_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_schedule_id IS NOT NULL THEN
            UPDATE public.licenses
            SET schedule_id = v_schedule_id
            WHERE id = p_license_id;
        END IF;
    END IF;

    IF v_schedule_id IS NOT NULL THEN
        UPDATE public.schedules
        SET 
            is_licensed = true,
            updated_at = timezone('utc', now())
        WHERE id = v_schedule_id;
    ELSIF v_user_id IS NOT NULL THEN
        UPDATE public.schedules
        SET 
            is_licensed = true,
            updated_at = timezone('utc', now())
        WHERE user_id = v_user_id AND deleted_at IS NULL;
    END IF;

    -- Cria notificação única para o usuário
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
            v_user_id,
            'Licença Aprovada! 🎊',
            'Seu pagamento foi confirmado. Sua licença ficará ativa até ' || to_char(p_valid_until, 'DD/MM/YYYY') || '.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para excluir licença permanentemente (Admin)
DROP FUNCTION IF EXISTS public.delete_license_rpc(UUID);
CREATE OR REPLACE FUNCTION public.delete_license_rpc(
    p_license_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem excluir licenças.';
    END IF;

    DELETE FROM public.licenses
    WHERE id = p_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para contagem de licenças pendentes (Admin)
DROP FUNCTION IF EXISTS public.get_pending_licenses_count_rpc();
CREATE OR REPLACE FUNCTION public.get_pending_licenses_count_rpc()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN 0;
    END IF;

    SELECT COALESCE(COUNT(*), 0) INTO v_count
    FROM public.licenses
    WHERE payment_status IN ('Aguardando', 'under_review');

    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para solicitar compra de licença com cálculo seguro de preço no servidor (Prevenção de BOLA / Tampering)
DROP FUNCTION IF EXISTS public.request_license_order(UUID, TEXT, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.request_license_order(
    p_schedule_id UUID,
    p_duration TEXT,
    p_classes_amount INTEGER,
    p_receipt_path TEXT
)
RETURNS UUID AS $$
DECLARE
    v_schedule_owner UUID;
    v_price_per_class NUMERIC;
    v_total_price NUMERIC;
    v_license_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Se schedule_id for fornecido, valida propriedade
    IF p_schedule_id IS NOT NULL THEN
        SELECT user_id INTO v_schedule_owner
        FROM public.schedules
        WHERE id = p_schedule_id;

        IF v_schedule_owner IS NULL OR v_schedule_owner <> auth.uid() THEN
            RAISE EXCEPTION 'A grade especificada não pertence ao usuário autenticado.';
        END IF;
    END IF;

    -- Validação da duração e determinação do preço unitário oficial
    IF p_duration = '06 meses' THEN
        v_price_per_class := 15.00;
    ELSIF p_duration = '1 ano' THEN
        v_price_per_class := 25.00;
    ELSIF p_duration = '2 anos' THEN
        v_price_per_class := 50.00;
    ELSE
        RAISE EXCEPTION 'Duração de plano inválida: %', p_duration;
    END IF;

    IF p_classes_amount <= 0 OR p_classes_amount > 100 THEN
        RAISE EXCEPTION 'Quantidade de turmas inválida: %', p_classes_amount;
    END IF;

    v_total_price := p_classes_amount * v_price_per_class;

    -- Validação de segurança do caminho do comprovante (Prevenção de XSS / Injeção)
    IF p_receipt_path IS NOT NULL AND p_receipt_path <> '' THEN
        IF NOT (
            p_receipt_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_\.\-]+\.(png|jpe?g|webp|pdf)$'
            OR p_receipt_path ~* '^https://[a-zA-Z0-9\.\-]+/storage/v1/object/(public|sign)/receipts/.+'
        ) THEN
            RAISE EXCEPTION 'Caminho de comprovante inválido ou inseguro.';
        END IF;
    END IF;

    -- Insere a licença com valor e dados auditados no servidor
    INSERT INTO public.licenses (
        user_id,
        schedule_id,
        payment_date,
        classes_amount,
        value_paid,
        payment_method,
        payment_status,
        receipt_url
    ) VALUES (
        auth.uid(),
        p_schedule_id,
        CURRENT_DATE,
        p_classes_amount,
        v_total_price,
        'PIX',
        'Aguardando',
        p_receipt_path
    ) RETURNING id INTO v_license_id;

    RETURN v_license_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC de Paywall Seguro: Entrega a solução da grade apenas se houver licença ativa
DROP FUNCTION IF EXISTS public.get_schedule_solution(UUID);
CREATE OR REPLACE FUNCTION public.get_schedule_solution(
    p_schedule_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_owner_id UUID;
    v_is_licensed BOOLEAN;
    v_data JSONB;
    v_solution JSONB;
BEGIN
    SELECT user_id, is_licensed, data INTO v_owner_id, v_is_licensed, v_data
    FROM public.schedules
    WHERE id = p_schedule_id AND deleted_at IS NULL;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Horário não encontrado.';
    END IF;

    -- Apenas o proprietário ou um admin podem acessar
    IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- Validação do Paywall no Servidor
    IF NOT v_is_licensed AND NOT EXISTS (
        SELECT 1 FROM public.licenses
        WHERE (schedule_id = p_schedule_id OR (user_id = v_owner_id AND (schedule_id IS NULL OR schedule_id = p_schedule_id)))
          AND payment_status = 'Aprovado'
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
    ) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Para visualizar as tabelas e exportar os resultados, é necessário possuir uma licença ativa para esta grade.';
    END IF;

    -- Auto-sincronização caso o horário ainda não estivesse marcado como licenciado
    IF NOT v_is_licensed THEN
        UPDATE public.schedules
        SET is_licensed = true, updated_at = timezone('utc', now())
        WHERE id = p_schedule_id;
    END IF;

    -- Busca a solução prioritariamente na tabela protegida schedule_solutions
    SELECT fixed_lessons INTO v_solution
    FROM public.schedule_solutions
    WHERE schedule_id = p_schedule_id;

    -- Fallback para retrocompatibilidade caso ainda esteja no campo data de schedules
    IF v_solution IS NULL 
       OR jsonb_typeof(v_solution) <> 'array' 
       OR jsonb_array_length(v_solution) = 0 THEN
        IF v_data ? 'fixedLessons' AND jsonb_typeof(v_data -> 'fixedLessons') = 'array' THEN
            v_solution := v_data -> 'fixedLessons';
        ELSE
            v_solution := '[]'::jsonb;
        END IF;
    END IF;

    RETURN v_solution;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;


-- 7. CONFIGURAÇÃO DE STORAGE BUCKETS (PRIVADOS, RESTRITOS E ISOLADOS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('receipts', 'receipts', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
    ('tickets-attachments', 'tickets-attachments', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

-- Políticas de Storage para Comprovantes (receipts)
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
FOR INSERT TO authenticated 
WITH CHECK (
    bucket_id = 'receipts' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read receipts" ON storage.objects;
CREATE POLICY "Users can read receipts" ON storage.objects
FOR SELECT TO authenticated 
USING (
    bucket_id = 'receipts' 
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
);

DROP POLICY IF EXISTS "Users and admins can delete receipts" ON storage.objects;
CREATE POLICY "Users and admins can delete receipts" ON storage.objects
FOR DELETE TO authenticated 
USING (
    bucket_id = 'receipts' 
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
);

-- Políticas de Storage para Anexos de Tickets (tickets-attachments)
DROP POLICY IF EXISTS "Authenticated users can upload ticket attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload ticket attachments" ON storage.objects
FOR INSERT TO authenticated 
WITH CHECK (
    bucket_id = 'tickets-attachments' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can read ticket attachments" ON storage.objects;
CREATE POLICY "Users can read ticket attachments" ON storage.objects
FOR SELECT TO authenticated 
USING (
    bucket_id = 'tickets-attachments' 
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
);


-- 8. ÍNDICES DE PERFORMANCE E ESCALABILIDADE (POSTGRESQL)
CREATE INDEX IF NOT EXISTS idx_schedules_user_deleted ON public.schedules(user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON public.schedules(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_schedule_id ON public.licenses(schedule_id);
CREATE INDEX IF NOT EXISTS idx_licenses_pending ON public.licenses(payment_status) WHERE payment_status IN ('Aguardando', 'under_review');
CREATE INDEX IF NOT EXISTS idx_licenses_valid_until ON public.licenses(valid_until);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id, created_at DESC);


-- 10. RPC para envio seguro de notificação administrativa
DROP FUNCTION IF EXISTS public.send_admin_notification(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.send_admin_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem enviar notificações.';
    END IF;

    IF p_user_id IS NULL OR p_title IS NULL OR p_message IS NULL THEN
        RAISE EXCEPTION 'Parâmetros user_id, title e message são obrigatórios.';
    END IF;

    INSERT INTO public.notifications (user_id, title, message)
    VALUES (p_user_id, p_title, p_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;


-- 9. MIGRAÇÃO DE RETROCOMPATIBILIDADE: Segregar fixedLessons legadas existentes
DO $$
BEGIN
    -- 1. Copiar fixedLessons existentes em schedules para schedule_solutions (se houver dados)
    INSERT INTO public.schedule_solutions (schedule_id, user_id, fixed_lessons, updated_at)
    SELECT 
        s.id, 
        s.user_id, 
        s.data -> 'fixedLessons', 
        timezone('utc', now())
    FROM public.schedules s
    WHERE s.data ? 'fixedLessons'
      AND jsonb_typeof(s.data -> 'fixedLessons') = 'array'
      AND jsonb_array_length(s.data -> 'fixedLessons') > 0
    ON CONFLICT (schedule_id) DO UPDATE
    SET fixed_lessons = EXCLUDED.fixed_lessons,
        updated_at = timezone('utc', now());

    -- 2. Sanitizar a coluna data de schedules para horários sem licença ativa
    UPDATE public.schedules
    SET data = data - 'fixedLessons'
    WHERE (is_licensed IS DISTINCT FROM true)
      AND data ? 'fixedLessons';
END;
$$;

