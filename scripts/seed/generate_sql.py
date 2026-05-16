"""
Genera el script SQL para inyectar clientes en Supabase.
Crea: auth.users + auth.identities + public.empresas + public.perfiles
"""

import csv
import uuid
import os

CSV_PATH = os.path.join(os.path.dirname(__file__), "../../clientes.csv")
OUT_PATH = os.path.join(os.path.dirname(__file__), "../../scripts/seed/inject_clientes.sql")

entries = []
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        nombre = row["Cliente"].strip()
        email = row["Usuario Acceso Software"].strip()
        password = row["Password"].strip()
        entries.append(
            {
                "user_id": str(uuid.uuid4()),
                "empresa_id": str(uuid.uuid4()),
                "nombre": nombre,
                "email": email,
                "password": password,
            }
        )

def esc(s: str) -> str:
    """Escapa comillas simples para SQL."""
    return s.replace("'", "''")


lines = []
lines.append("-- =========================================================")
lines.append("-- Data Injection: Usuarios y Empresas")
lines.append(f"-- Total: {len(entries)} registros")
lines.append("-- Ejecutar en: Supabase Dashboard → SQL Editor")
lines.append("-- =========================================================")
lines.append("")
lines.append("BEGIN;")
lines.append("")

# ── 1. Empresas ──────────────────────────────────────────────────────────────
lines.append("-- ── 1. EMPRESAS ──────────────────────────────────────────")
lines.append("INSERT INTO public.empresas (id, nombre) VALUES")
empresa_rows = []
for e in entries:
    empresa_rows.append(f"  ('{e['empresa_id']}', '{esc(e['nombre'])}')")
lines.append(",\n".join(empresa_rows) + ";")
lines.append("")

# ── 2. auth.users ─────────────────────────────────────────────────────────────
lines.append("-- ── 2. AUTH USERS ────────────────────────────────────────")
lines.append("INSERT INTO auth.users (")
lines.append("  instance_id, id, aud, role, email, encrypted_password,")
lines.append("  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,")
lines.append("  created_at, updated_at,")
lines.append("  confirmation_token, email_change, email_change_token_new, recovery_token")
lines.append(") VALUES")
auth_rows = []
for e in entries:
    auth_rows.append(
        f"  ('00000000-0000-0000-0000-000000000000', '{e['user_id']}', "
        f"'authenticated', 'authenticated', '{esc(e['email'])}', "
        f"crypt('{esc(e['password'])}', gen_salt('bf')), "
        f"NOW(), "
        f"'{{\"provider\":\"email\",\"providers\":[\"email\"]}}', "
        f"'{{}}', "
        f"NOW(), NOW(), '', '', '', '')"
    )
lines.append(",\n".join(auth_rows) + ";")
lines.append("")

# ── 3. auth.identities ────────────────────────────────────────────────────────
lines.append("-- ── 3. AUTH IDENTITIES ───────────────────────────────────")
lines.append("INSERT INTO auth.identities (")
lines.append("  provider_id, user_id, identity_data, provider,")
lines.append("  last_sign_in_at, created_at, updated_at")
lines.append(") VALUES")
identity_rows = []
for e in entries:
    identity_data = (
        f'{{\"sub\":\"{e["user_id"]}\",\"email\":\"{esc(e["email"])}\"}}'
    )
    identity_rows.append(
        f"  ('{esc(e['email'])}', '{e['user_id']}', "
        f"'{identity_data}'::jsonb, 'email', "
        f"NOW(), NOW(), NOW())"
    )
lines.append(",\n".join(identity_rows) + ";")
lines.append("")

# ── 4. perfiles ───────────────────────────────────────────────────────────────
lines.append("-- ── 4. PERFILES (vincula usuario ↔ empresa) ─────────────")
lines.append("INSERT INTO public.perfiles (id, rol, nombre, empresa_id) VALUES")
perfil_rows = []
for e in entries:
    perfil_rows.append(
        f"  ('{e['user_id']}', 'consultor', '{esc(e['nombre'])}', '{e['empresa_id']}')"
    )
lines.append(",\n".join(perfil_rows) + ";")
lines.append("")
lines.append("COMMIT;")
lines.append("")
lines.append(f"-- Fin: {len(entries)} usuarios y empresas creados.")

sql = "\n".join(lines)

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w", encoding="utf-8") as f:
    f.write(sql)

print(f"✓ SQL generado: {OUT_PATH}")
print(f"  Registros: {len(entries)}")
