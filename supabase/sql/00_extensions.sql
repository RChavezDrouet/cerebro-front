-- CEREBRO / HRCloud - Extensiones requeridas
-- Ejecutar en Supabase SQL Editor.

-- UUIDs + utilidades criptográficas
create extension if not exists pgcrypto;

-- Vault/Secrets (Opción A para SMTP):
-- En Supabase Dashboard: Database > Extensions, habilitar "Vault".
-- Según versión, el nombre puede aparecer como "supabase_vault".
-- Nota: por seguridad, el secret se lee únicamente desde Edge Functions con Service Role.
