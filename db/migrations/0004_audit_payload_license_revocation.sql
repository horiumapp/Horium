-- Auditoria sem o JSON da grade, revogação de licença que permanece gravada,
-- validade no dia de Brasília e índices usados pelo RLS.
-- Aplicar uma vez no SQL Editor. Não reexecutar schema.sql inteiro.

-- Dia civil em Brasília. CURRENT_DATE no servidor é UTC e vira o dia seguinte às 21h.
CREATE OR REPLACE FUNCTION public.business_today()
RETURNS DATE AS $$
    SELECT (timezone('America/Sao_Paulo', now()))::date;
$$ LANGUAGE sql STABLE SET search_path = public, pg_temp;

-- Triggers automáticos para auditoria de operações em licenças e horários
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, user_id, created_at)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        -- O JSON da grade fica em schedules.data. A auditoria guarda o evento, não uma cópia inteira a cada auto-save.
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) - 'data' ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) - 'data' ELSE NULL END,
        auth.uid(),
        timezone('utc', now())
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para rejeitar licença e revogar a solução já gravada (Admin)
DROP FUNCTION IF EXISTS public.reject_license_rpc(UUID);
CREATE OR REPLACE FUNCTION public.reject_license_rpc(
    p_license_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem rejeitar licenças.';
    END IF;

    UPDATE public.licenses
    SET payment_status = 'Rejeitado',
        valid_until = NULL
    WHERE id = p_license_id
    RETURNING user_id INTO v_user_id;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Grades que não tenham outra licença aprovada e vigente perdem a solução.
    UPDATE public.schedules s
    SET is_licensed = false,
        data = CASE
            WHEN s.data ? 'fixedLessons' THEN s.data - 'fixedLessons'
            ELSE s.data
        END,
        updated_at = timezone('utc', now())
    WHERE s.user_id = v_user_id
      AND NOT EXISTS (
            SELECT 1
            FROM public.licenses l
            WHERE l.user_id = v_user_id
              AND l.payment_status = 'Aprovado'
              AND (l.valid_until IS NULL OR l.valid_until >= public.business_today())
              AND (l.schedule_id = s.id OR l.schedule_id IS NULL)
      );

    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
        v_user_id,
        'Licença não aprovada',
        'Não confirmamos este pagamento. Você pode enviar outro comprovante ou falar com o suporte.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- RPC para excluir licença permanentemente (Admin)
DROP FUNCTION IF EXISTS public.delete_license_rpc(UUID);
CREATE OR REPLACE FUNCTION public.delete_license_rpc(
    p_license_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem excluir licenças.';
    END IF;

    SELECT user_id INTO v_user_id
    FROM public.licenses
    WHERE id = p_license_id;

    DELETE FROM public.licenses
    WHERE id = p_license_id;

    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.schedules s
    SET is_licensed = false,
        data = CASE
            WHEN s.data ? 'fixedLessons' THEN s.data - 'fixedLessons'
            ELSE s.data
        END,
        updated_at = timezone('utc', now())
    WHERE s.user_id = v_user_id
      AND NOT EXISTS (
            SELECT 1
            FROM public.licenses l
            WHERE l.user_id = v_user_id
              AND l.payment_status = 'Aprovado'
              AND (l.valid_until IS NULL OR l.valid_until >= public.business_today())
              AND (l.schedule_id = s.id OR l.schedule_id IS NULL)
      );
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

    -- Se schedule_id for fornecido, valida propriedade e quantidade mínima de turmas
    IF p_schedule_id IS NOT NULL THEN
        DECLARE
            v_actual_classes_count INTEGER;
        BEGIN
            SELECT user_id, jsonb_array_length(COALESCE(data->'classes', '[]'::jsonb))
            INTO v_schedule_owner, v_actual_classes_count
            FROM public.schedules
            WHERE id = p_schedule_id;

            IF v_schedule_owner IS NULL OR v_schedule_owner <> auth.uid() THEN
                RAISE EXCEPTION 'A grade especificada não pertence ao usuário autenticado.';
            END IF;

            IF v_actual_classes_count > 0 AND p_classes_amount < v_actual_classes_count THEN
                RAISE EXCEPTION 'A quantidade contratada (% turmas) não pode ser inferior ao total de turmas cadastradas na grade (% turmas).',
                    p_classes_amount, v_actual_classes_count;
            END IF;
        END;
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

    -- Só caminho relativo na pasta do usuário autenticado. URL absoluta é recusada.
    IF p_receipt_path IS NOT NULL AND p_receipt_path <> '' THEN
        IF p_receipt_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-zA-Z0-9_\.\-]+\.(png|jpe?g|webp|pdf)$'
           OR split_part(p_receipt_path, '/', 1) IS DISTINCT FROM auth.uid()::text THEN
            RAISE EXCEPTION 'Caminho de comprovante inválido ou inseguro.';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM storage.objects o
            WHERE o.bucket_id = 'receipts'
              AND o.name = p_receipt_path
        ) THEN
            RAISE EXCEPTION 'Comprovante não encontrado no armazenamento do usuário.';
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
        public.business_today(),
        p_classes_amount,
        v_total_price,
        'PIX',
        'Aguardando',
        p_receipt_path
    ) RETURNING id INTO v_license_id;

    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
        auth.uid(),
        'Pedido de licença recebido',
        'Recebemos seu comprovante. A análise leva até 2 dias úteis. Avisaremos quando a licença for aprovada ou recusada.'
    );

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

    -- Validação do Paywall no Servidor (Valida estritamente vigência na tabela licenses)
    IF NOT public.is_admin() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.licenses
            WHERE (schedule_id = p_schedule_id OR (user_id = v_owner_id AND schedule_id IS NULL))
              AND payment_status = 'Aprovado'
              AND (valid_until IS NULL OR valid_until >= public.business_today())
        ) THEN
            -- Revogação efetiva: a flag e qualquer cópia legada da solução saem no mesmo UPDATE.
            UPDATE public.schedules
            SET is_licensed = false,
                data = CASE
                    WHEN data ? 'fixedLessons' THEN data - 'fixedLessons'
                    ELSE data
                END,
                updated_at = timezone('utc', now())
            WHERE id = p_schedule_id
              AND (
                    is_licensed IS DISTINCT FROM false
                    OR (data ? 'fixedLessons')
              );
            -- Retorna vazio em vez de lançar erro: um RAISE EXCEPTION desfaz o UPDATE acima.
            RETURN '[]'::jsonb;
        END IF;
    END IF;

    -- Auto-sincronização caso a licença esteja ativa mas o campo is_licensed ainda estivesse false
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

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_solutions_user_id ON public.schedule_solutions(user_id);

INSERT INTO public.schema_migrations (version)
VALUES ('0004_audit_payload_license_revocation')
ON CONFLICT (version) DO NOTHING;
