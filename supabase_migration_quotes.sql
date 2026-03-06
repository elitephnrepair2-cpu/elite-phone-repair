-- Add repair_type and estimated_cost columns to the tickets table
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS repair_type TEXT,
ADD COLUMN IF NOT EXISTS estimated_cost TEXT;

-- Update the TypeScript types equivalent
-- See types.ts updates
