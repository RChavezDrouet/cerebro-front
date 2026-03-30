-- =======================================================
-- HRCloud Base — Asistencia (AISLADO)
-- 001_attendance_schema.sql
-- Crea schema + enums (NO toca public.*)
-- =======================================================

create extension if not exists pgcrypto;

create schema if not exists attendance;

-- Enums del dominio de asistencia

do $$ begin
  create type attendance.turn_type as enum ('diurno', 'vespertino', 'nocturno');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance.employee_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance.mode as enum ('biometric', 'web');
exception when duplicate_object then null; end $$;
