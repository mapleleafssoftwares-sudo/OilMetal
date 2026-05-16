-- =========================================================
-- Crear usuario Administrador
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =========================================================

BEGIN;

-- 0. Limpiar si ya existe (evita duplicate key)
DELETE FROM auth.users WHERE email = 'diego@rojas.com';

-- 1. Crear el usuario en Auth
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'diego@rojas.com',
  crypt('123456', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(), NOW(),
  '', '', '', ''
);

-- 2. Crear la identidad (necesaria para el login por email)
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
SELECT
  'diego@rojas.com',
  id,
  format('{"sub":"%s","email":"diego@rojas.com"}', id::text)::jsonb,
  'email',
  NOW(), NOW(), NOW()
FROM auth.users
WHERE email = 'diego@rojas.com';

-- 3. Crear el perfil con rol admin
INSERT INTO public.perfiles (id, rol, nombre)
SELECT id, 'admin', 'Diego Rojas'
FROM auth.users
WHERE email = 'diego@rojas.com';

COMMIT;
