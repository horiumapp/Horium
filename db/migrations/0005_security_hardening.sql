-- Hardening: bypass anônimo em get_schedule_solution, grants de RPC,
-- escopo de licença por grade/turmas, trigger de solução e DELETE de storage.
-- Aplicar uma vez no SQL Editor. Não reexecutar schema.sql inteiro.

-- ---------------------------------------------------------------------------
-- 1) Paywall: autenticação obrigatória + IS DISTINCT FROM + escopo de turmas
-- ---------------------------------------------------------------------------
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
    v_class_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    SELECT user_id, is_licensed, data,
           jsonb_array_length(COALESCE(data->'classes', '[]'::jsonb))
    INTO v_owner_id, v_is_licensed, v_data, v_class_count
    FROM public.schedules
    WHERE id = p_schedule_id AND deleted_at IS NULL;

    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Horário não encontrado.';
    END IF;

    -- NULL <> uuid é NULL em SQL; IS DISTINCT FROM trata anon/mismatch corretamente.
    IF v_owner_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    IF NOT public.is_admin() THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.licenses l
            WHERE l.payment_status = 'Aprovado'
              AND (l.valid_until IS NULL OR l.valid_until >= public.business_today())
              AND (
                    l.schedule_id = p_schedule_id
                    OR (
                        l.user_id = v_owner_id
                        AND l.schedule_id IS NULL
                        AND COALESCE(l.classes_amount, 0) >= COALESCE(v_class_count, 0)
                    )
              )
        ) THEN
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
            RETURN '[]'::jsonb;
        END IF;
    END IF;

    IF NOT v_is_licensed THEN
        UPDATE public.schedules
        SET is_licensed = true, updated_at = timezone('utc', now())
        WHERE id = p_schedule_id;
    END IF;

    SELECT fixed_lessons INTO v_solution
    FROM public.schedule_solutions
    WHERE schedule_id = p_schedule_id;

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

-- ---------------------------------------------------------------------------
-- 2) Pedido de licença: rejeitar NULL e exigir schedule_id
-- ---------------------------------------------------------------------------
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
    v_pending_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    IF p_schedule_id IS NULL THEN
        RAISE EXCEPTION 'A grade (schedule_id) é obrigatória para solicitar licença.';
    END IF;

    IF p_duration IS NULL OR btrim(p_duration) = '' THEN
        RAISE EXCEPTION 'Duração de plano inválida.';
    END IF;

    IF p_classes_amount IS NULL OR p_classes_amount <= 0 OR p_classes_amount > 100 THEN
        RAISE EXCEPTION 'Quantidade de turmas inválida: %', p_classes_amount;
    END IF;

    SELECT COUNT(*) INTO v_pending_count
    FROM public.licenses
    WHERE user_id = auth.uid()
      AND payment_status IN ('Aguardando', 'under_review');

    IF v_pending_count >= 3 THEN
        RAISE EXCEPTION 'Há pedidos pendentes demais. Aguarde a análise ou cancele um pedido antigo.';
    END IF;

    DECLARE
        v_actual_classes_count INTEGER;
    BEGIN
        SELECT user_id, jsonb_array_length(COALESCE(data->'classes', '[]'::jsonb))
        INTO v_schedule_owner, v_actual_classes_count
        FROM public.schedules
        WHERE id = p_schedule_id;

        IF v_schedule_owner IS NULL OR v_schedule_owner IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'A grade especificada não pertence ao usuário autenticado.';
        END IF;

        IF v_actual_classes_count > 0 AND p_classes_amount < v_actual_classes_count THEN
            RAISE EXCEPTION 'A quantidade contratada (% turmas) não pode ser inferior ao total de turmas cadastradas na grade (% turmas).',
                p_classes_amount, v_actual_classes_count;
        END IF;
    END;

    IF p_duration = '06 meses' THEN
        v_price_per_class := 15.00;
    ELSIF p_duration = '1 ano' THEN
        v_price_per_class := 25.00;
    ELSIF p_duration = '2 anos' THEN
        v_price_per_class := 50.00;
    ELSE
        RAISE EXCEPTION 'Duração de plano inválida: %', p_duration;
    END IF;

    v_total_price := p_classes_amount * v_price_per_class;

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

-- ---------------------------------------------------------------------------
-- 3) Revogação: licença legada schedule_id NULL só cobre grades dentro do cupo
-- ---------------------------------------------------------------------------
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
              AND (
                    l.schedule_id = s.id
                    OR (
                        l.schedule_id IS NULL
                        AND COALESCE(l.classes_amount, 0) >= jsonb_array_length(COALESCE(s.data->'classes', '[]'::jsonb))
                    )
              )
      );

    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
        v_user_id,
        'Licença não aprovada',
        'Não confirmamos este pagamento. Você pode enviar outro comprovante ou falar com o suporte.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

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
              AND (
                    l.schedule_id = s.id
                    OR (
                        l.schedule_id IS NULL
                        AND COALESCE(l.classes_amount, 0) >= jsonb_array_length(COALESCE(s.data->'classes', '[]'::jsonb))
                    )
              )
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ---------------------------------------------------------------------------
-- 4) Trigger: não sobrescrever solução de outro usuário
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.isolate_schedule_solution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id IS NULL THEN
        NEW.id := gen_random_uuid();
    END IF;

    IF NEW.data ? 'fixedLessons'
       AND jsonb_typeof(NEW.data -> 'fixedLessons') = 'array'
       AND jsonb_array_length(NEW.data -> 'fixedLessons') > 0 THEN
        INSERT INTO public.schedule_solutions (schedule_id, user_id, fixed_lessons, updated_at)
        VALUES (NEW.id, NEW.user_id, NEW.data -> 'fixedLessons', timezone('utc', now()))
        ON CONFLICT (schedule_id) DO UPDATE
        SET fixed_lessons = EXCLUDED.fixed_lessons,
            user_id = EXCLUDED.user_id,
            updated_at = timezone('utc', now())
        WHERE public.schedule_solutions.user_id IS NOT DISTINCT FROM EXCLUDED.user_id
           OR public.is_admin();
    END IF;

    IF NEW.data IS NOT NULL AND jsonb_typeof(NEW.data) = 'object' AND (NEW.data ? 'fixedLessons') THEN
        NEW.data := NEW.data - 'fixedLessons';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ---------------------------------------------------------------------------
-- 5) Storage: dono pode apagar o próprio arquivo (limpeza após falha de pedido)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users and admins can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
CREATE POLICY "Users can delete own receipts" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'receipts'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_admin()
    )
);

DROP POLICY IF EXISTS "Users can delete own ticket attachments" ON storage.objects;
CREATE POLICY "Users can delete own ticket attachments" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'tickets-attachments'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR public.is_admin()
    )
);

-- ---------------------------------------------------------------------------
-- 6) Grants: RPCs sensíveis só para authenticated (não anon/PUBLIC)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    fn text;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'get_schedule_solution(uuid)',
        'request_license_order(uuid, text, integer, text)',
        'approve_license_rpc(uuid, date)',
        'reject_license_rpc(uuid)',
        'delete_license_rpc(uuid)',
        'get_pending_licenses_count_rpc()',
        'get_admin_tickets()',
        'update_ticket_status_rpc(uuid, text)',
        'send_admin_notification(uuid, text, text)',
        'is_current_user_admin()',
        'get_admin_licenses()'
    ]
    LOOP
        BEGIN
            EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
        EXCEPTION WHEN undefined_function THEN
            NULL;
        END;
        BEGIN
            EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
        EXCEPTION WHEN undefined_object OR undefined_function THEN
            NULL;
        END;
        BEGIN
            EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
        EXCEPTION WHEN undefined_function THEN
            NULL;
        END;
    END LOOP;
END $$;

INSERT INTO public.schema_migrations (version)
VALUES ('0005_security_hardening')
ON CONFLICT (version) DO NOTHING;
