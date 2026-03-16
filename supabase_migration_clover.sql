-- Create an integration_settings table to store secure keys like Clover tokens
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    provider TEXT NOT NULL UNIQUE, -- e.g., 'clover'
    access_token TEXT,             -- The permanent OAuth access token
    merchant_id TEXT,              -- The Clover Merchant ID connected
    selected_device_id TEXT,       -- The physical Clover terminal ID to route payments to
    is_connected BOOLEAN DEFAULT false
);

-- Protect the table using RLS (Row Level Security)
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read integration_settings
CREATE POLICY "Allow authenticated read access" ON public.integration_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to update integration_settings
CREATE POLICY "Allow authenticated update access" ON public.integration_settings
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow authenticated users to insert integration_settings
CREATE POLICY "Allow authenticated insert access" ON public.integration_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to delete integration_settings
CREATE POLICY "Allow authenticated delete access" ON public.integration_settings
    FOR DELETE
    TO authenticated
    USING (true);

-- Insert a default row for Clover so we can just update it later
INSERT INTO public.integration_settings (provider, is_connected)
VALUES ('clover', false)
ON CONFLICT (provider) DO NOTHING;
