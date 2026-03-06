-- Run this in your Supabase SQL Editor to add the status column to the tickets table

ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In Queue';

-- Optional: Update existing tickets based on payment status
UPDATE public.tickets 
SET status = 'Completed'
WHERE is_paid = true AND status = 'In Queue';
