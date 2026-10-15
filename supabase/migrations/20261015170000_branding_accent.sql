-- Club colours: primary_color already exists; add an accent (e.g. gold) for highlights.
ALTER TABLE public.club_branding
  ADD COLUMN IF NOT EXISTS accent_color text CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$');
