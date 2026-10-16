-- Migração 0001. Rode este arquivo no SQL Editor. Não rode schema.sql de novo.
-- Fecha a leitura pública de profiles e avisa o usuário quando o pedido de licença entra ou é recusado.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

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
        CURRENT_DATE,
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
              AND (l.valid_until IS NULL OR l.valid_until >= CURRENT_DATE)
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

INSERT INTO public.schema_migrations (version)
VALUES ('0001_profiles_rls_and_license_notices')
ON CONFLICT (version) DO NOTHING;
