-- Create schedules table
CREATE TABLE IF NOT EXISTS public.schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    is_licensed BOOLEAN DEFAULT false
);

-- Enable RLS for schedules
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for schedules
CREATE POLICY "Users can create their own schedules" ON public.schedules
FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules" ON public.schedules
FOR DELETE TO public USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules" ON public.schedules
FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own schedules" ON public.schedules
FOR SELECT TO public USING (auth.uid() = user_id);

-- Create licenses table
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_date DATE,
    classes_amount INTEGER,
    value_paid NUMERIC,
    payment_method TEXT,
    payment_status TEXT CHECK (payment_status IN ('Aguardando', 'Aprovado', 'Rejeitado')),
    valid_until DATE,
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS for licenses
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Create policies for licenses
CREATE POLICY "Service role can manage all licenses" ON public.licenses
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Wait, the `licenses` policy had roles: `{authenticated}`
CREATE POLICY "Users can view their own licenses" ON public.licenses
FOR SELECT TO authenticated USING (auth.uid() = user_id);
