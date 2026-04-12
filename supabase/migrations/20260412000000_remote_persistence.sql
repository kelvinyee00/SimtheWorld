-- Create models table
CREATE TABLE IF NOT EXISTS public.models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create model_versions table for revision history
CREATE TABLE IF NOT EXISTS public.model_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own models') THEN
        CREATE POLICY "Users can manage their own models" ON public.models
            FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own model versions') THEN
        CREATE POLICY "Users can manage their own model versions" ON public.model_versions
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.models
                    WHERE models.id = model_versions.model_id
                    AND models.user_id = auth.uid()
                )
            );
    END IF;
END
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_models_updated_at ON public.models;
CREATE TRIGGER update_models_updated_at
    BEFORE UPDATE ON public.models
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
