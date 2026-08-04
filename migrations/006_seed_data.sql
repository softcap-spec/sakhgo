-- SakhGO · 006 — Seed data (demo admin + sample users)
-- Uses ON CONFLICT DO NOTHING to be idempotent.

-- Help content defaults
INSERT INTO public.help_content (key, content) VALUES
  ('howItWorks',  ''),
  ('faq',         ''),
  ('cancelPolicy',''),
  ('support',     ''),
  ('hostInfo',    ''),
  ('rules',       '')
ON CONFLICT (key) DO NOTHING;

-- Demo profiles
INSERT INTO public.profiles (id, name, email, phone, role, location_tag) VALUES
  ('a0000000-0000-0000-0000-000000000001',
   'Администратор', 'admin@sakhgo.ru',   '+79990000000', 'admin', 'Южно-Сахалинск'),
  ('a0000000-0000-0000-0000-000000000002',
   'Елена М.',      'elena@example.com', '+79020000001', 'user',  'Южно-Сахалинск'),
  ('a0000000-0000-0000-0000-000000000003',
   'Сергей К.',     'sergey@example.com','+79020000002', 'user',  'Корсаков')
ON CONFLICT (id) DO NOTHING;
