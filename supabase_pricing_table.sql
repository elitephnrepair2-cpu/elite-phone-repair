-- ====================================================================
-- SUPABASE REPAIR PRICING DATABASE MIGRATION
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.repair_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL,
  price TEXT NOT NULL,
  lcd_price TEXT,
  oled_price TEXT,
  oem_price TEXT,
  UNIQUE(brand, model, category)
);

-- Enable RLS
ALTER TABLE public.repair_prices ENABLE ROW LEVEL SECURITY;

-- Drop old policies if exists
DROP POLICY IF EXISTS "Allow public read of repair_prices" ON public.repair_prices;
DROP POLICY IF EXISTS "Allow write access to repair_prices" ON public.repair_prices;

-- Policies for anonymous/authenticated read & write
CREATE POLICY "Allow public read of repair_prices" ON public.repair_prices FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow write access to repair_prices" ON public.repair_prices FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Insert default prices
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Screen', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Home Button', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Battery', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Back Camera', '$45', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5c', 'Home Button', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5c', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Screen', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Home Button', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Battery', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Back Camera', '$45', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 5s', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Screen', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Home Button', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Battery', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Back Camera', '$45', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Screen', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Home Button', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Back Camera', '$45', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 6 Plus', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Screen', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Home Button', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Back Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Screen', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Back Camera', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 7 Plus', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Screen', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Home Button', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Back Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Back Glass', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8', 'Back Housing Frame', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Screen', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Charging Port', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Back Camera', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Front Camera', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Back Glass', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 8 Plus', 'Back Housing Frame', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone SE', 'Home Button', '$50', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone SE', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone SE', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Screen', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Charging Port', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Back Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone X', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Screen', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Charging Port', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Back Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XR', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Screen', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Charging Port', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Back Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Battery', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Charging Port', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Back Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone XS Max', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Screen', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Battery', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Charging Port', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Back Camera', '$65', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Front Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Screen', '$90', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Battery', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Back Camera', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Front Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro', 'Back Housing Frame', '$200', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Screen', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Battery', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Front Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Earpiece / Loud Speaker', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 11 Pro Max', 'Back Housing Frame', '$200', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Screen', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Battery', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Front Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Back Housing Frame', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Mini', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Back Camera', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Earpiece / Loud Speaker', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12', 'Back Housing Frame', '$180', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Earpiece / Loud Speaker', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro', 'Back Housing Frame', '$200', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Charging Port', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Earpiece / Loud Speaker', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 12 Pro Max', 'Back Housing Frame', '$220', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Mini', 'Screen', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Mini', 'Battery', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Mini', 'Back Glass', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Mini', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Back Camera', '$80', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Front Camera', '$60', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Earpiece / Loud Speaker', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13', 'Back Glass', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Screen', '$100 / $140', '$100', '$140', '$195')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Charging Port', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Screen', '$105 / $140', '$105', '$140', '$195')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Charging Port', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 13 Pro Max', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Screen', '$100 / $140', '$100', '$140', '$195')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Battery', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Back Camera', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Front Camera', '$70', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14', 'Back Glass', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Plus', 'Screen', '$100 / $140', '$100', '$140', '$195')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Plus', 'Charging Port', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Plus', 'Back Camera', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Plus', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Screen', '$105 / $180', '$105', '$180', '$235')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Battery', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Power / Volume Buttons', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Charging Port', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro Max', 'Screen', '$105 / $185', '$105', '$185', '$240')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro Max', 'Charging Port', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro Max', 'Back Camera', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 14 Pro Max', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15', 'Screen', '$100 / $160', '$100', '$160', '$215')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15', 'Battery', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15', 'Charging Port', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Plus', 'Screen', '$100 / $180', '$100', '$180', '$235')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Plus', 'Charging Port', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Plus', 'Back Glass', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro', 'Screen', '$120 / $170', '$120', '$170', '$225')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro', 'Charging Port', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro Max', 'Screen', '$120 / $205', '$120', '$205', '$260')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro Max', 'Charging Port', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 15 Pro Max', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16', 'Screen', '$120 / $160', '$120', '$160', '$215')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16', 'Battery', '$95', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Plus', 'Screen', '$140 / $200', '$140', '$200', '$255')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Plus', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Plus', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro', 'Screen', '$160 / $240', '$160', '$240', '$295')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro Max', 'Screen', '$160 / $240', '$160', '$240', '$295')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16 Pro Max', 'Back Glass', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16e', 'Screen', '$105 / $160', '$105', '$160', '$215')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16e', 'Front Camera', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 16e', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17', 'Screen', '$140 / $180', '$140', '$180', '$235')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Pro', 'Screen', '$140 / $240', '$140', '$240', '$295')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Pro', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Pro Max', 'Screen', '$140 / $240', '$140', '$240', '$295')
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Pro Max', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Air', 'Screen', '$300', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPhone 17 Air', 'Back Camera Glass', '$40', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 1', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 2', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 3', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 4', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 5', 'Screen', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 5', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 6', 'Screen', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 6', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 7', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 7', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 8', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 8', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 9', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 9', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 10', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad 10', 'Battery', '$100', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Air 1', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Air 2', 'Screen', '$185', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Air 3', 'Screen', '$200', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Air 4', 'Screen', '$200', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Air 5', 'Screen', '$205', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Mini 1', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Mini 2', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Mini 3', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Mini 4', 'Screen', '$170', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'iPad Mini 5', 'Screen', '$170', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 1 38mm', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 1 42mm', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 2 38mm', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 2 42mm', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 3 38mm GPS', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 3 38mm LTE', 'Screen', '$105', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 3 42mm GPS', 'Screen', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 3 42mm LTE', 'Screen', '$120', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 4 40mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 4 44mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 5 40mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 5 44mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch SE 40mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch SE 44mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 6 40mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 6 44mm', 'Screen', '$160', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 7 41mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch Series 7 45mm', 'Screen', '$140', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Apple', 'Apple Watch', 'Other', '$40 (Reseal)', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A02s', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A03s', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A12', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A13', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A14', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
INSERT INTO public.repair_prices (brand, model, category, price, lcd_price, oled_price, oem_price)
VALUES ('Samsung', 'Galaxy A20s', 'Screen', '$85', NULL, NULL, NULL)
ON CONFLICT (brand, model, category) DO UPDATE SET
  price = EXCLUDED.price,
  lcd_price = EXCLUDED.lcd_price,
  oled_price = EXCLUDED.oled_price,
  oem_price = EXCLUDED.oem_price;
