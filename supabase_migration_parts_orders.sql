CREATE TABLE public.parts_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  part_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  location TEXT
);

-- Enable RLS and setup permissive policies if needed
-- ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;
