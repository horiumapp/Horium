-- ==============================================================================
-- HORIUM - SCHEMA COMPLETO DO BANCO DE DADOS (SUPABASE POSTGRESQL)
-- ==============================================================================

-- 1. TABELA DE ADMINISTRADORES (ADMIN_USERS) COM RLS
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO AUXILIAR DE SEGURANÇA (ADMIN) DINÂMICA
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE (user_id IS NOT NULL AND user_id = auth.uid())
           OR (email IS NOT NULL AND LOWER(email) = LOWER(auth.jwt() ->> 'email'))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. TABELA SCHEDULES (Horários Escolares)
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    data JSONB,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_schedule_license ON public.schedules;
CREATE TRIGGER trg_protect_schedule_license
BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.protect_schedule_license_status();


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

DROP POLICY IF EXISTS "Users can insert their own licenses" ON public.licenses;
CREATE POLICY "Users can insert their own licenses" ON public.licenses
FOR INSERT TO authenticated 
WITH CHECK (
    auth.uid() = user_id 
    AND (payment_status IN ('Aguardando', 'under_review') OR payment_status IS NULL)
);


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

DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());


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


-- 6. FUNÇÕES SEGURAS PARA ADMINISTRAÇÃO (RPC COM SECURITY DEFINER)

-- RPC para buscar todas as licenças com e-mail dos usuários
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para aprovar licença e sincronizar o horário de forma atômica
CREATE OR REPLACE FUNCTION public.approve_license_rpc(
    p_license_id UUID,
    p_valid_until DATE
)
RETURNS VOID AS $$
DECLARE
    v_schedule_id UUID;
    v_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem aprovar licenças.';
    END IF;

    -- Atualiza o status e a data de validade da licença
    UPDATE public.licenses
    SET 
        payment_status = 'Aprovado',
        valid_until = p_valid_until
    WHERE id = p_license_id
    RETURNING schedule_id, user_id INTO v_schedule_id, v_user_id;

    -- Sincroniza a tabela schedules se schedule_id estiver vinculado
    IF v_schedule_id IS NOT NULL THEN
        UPDATE public.schedules
        SET 
            is_licensed = true,
            updated_at = timezone('utc', now())
        WHERE id = v_schedule_id;
    END IF;

    -- Cria notificação para o usuário informado
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message)
        VALUES (
            v_user_id,
            'Licença Aprovada! 🎊',
            'Seu pagamento foi confirmado. Sua licença ficará ativa até ' || to_char(p_valid_until, 'DD/MM/YYYY') || '.'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para excluir licença permanentemente (Admin)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para obter a contagem de licenças pendentes (Admin)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. CONFIGURAÇÃO DE STORAGE BUCKETS (PRIVADOS E ISOLADOS)
-- Criação dos buckets privados para comprovantes e anexos de suporte
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('receipts', 'receipts', false),
    ('tickets-attachments', 'tickets-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

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
-- Otimização de consultas, filtros frequentes e chaves estrangeiras
CREATE INDEX IF NOT EXISTS idx_schedules_user_deleted ON public.schedules(user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_deleted_at ON public.schedules(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_schedule_id ON public.licenses(schedule_id);
CREATE INDEX IF NOT EXISTS idx_licenses_pending ON public.licenses(payment_status) WHERE payment_status IN ('Aguardando', 'under_review');
CREATE INDEX IF NOT EXISTS idx_licenses_valid_until ON public.licenses(valid_until);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id, created_at DESC);

