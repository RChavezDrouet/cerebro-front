-- Migration 006: Employee extended fields for Ecuador standard HR form
-- Adds personal, contact, labor, IESS, disability, and academic columns to public.employees
-- Run directly in Supabase SQL Editor

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS identification_type  text    DEFAULT 'CEDULA'
    CHECK (identification_type IN ('CEDULA','PASAPORTE')),
  ADD COLUMN IF NOT EXISTS birth_date           date,
  ADD COLUMN IF NOT EXISTS gender               text
    CHECK (gender IN ('MASCULINO','FEMENINO','OTRO')),
  ADD COLUMN IF NOT EXISTS civil_status         text
    CHECK (civil_status IN ('SOLTERO','CASADO','UNION_LIBRE','DIVORCIADO','VIUDO')),
  ADD COLUMN IF NOT EXISTS nationality          text,
  ADD COLUMN IF NOT EXISTS birth_place          text,
  -- Contacto adicional
  ADD COLUMN IF NOT EXISTS phone_home                 text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name     text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone    text,
  -- Información laboral adicional
  ADD COLUMN IF NOT EXISTS position             text,
  ADD COLUMN IF NOT EXISTS contract_type        text
    CHECK (contract_type IN ('INDEFINIDO','PLAZO_FIJO','OBRA','PRUEBA','PART_TIME','HONORARIOS')),
  ADD COLUMN IF NOT EXISTS labor_regime         text
    CHECK (labor_regime IN ('CODIGO_TRABAJO','LOSEP','EPE')),
  -- IESS y tributaria
  ADD COLUMN IF NOT EXISTS iess_number          text,
  ADD COLUMN IF NOT EXISTS iess_entry_date      date,
  ADD COLUMN IF NOT EXISTS ruc                  text,
  ADD COLUMN IF NOT EXISTS children_count       integer DEFAULT 0
    CHECK (children_count >= 0),
  -- Discapacidad
  ADD COLUMN IF NOT EXISTS has_disability       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disability_type      text
    CHECK (disability_type IN ('FISICA','INTELECTUAL','VISUAL','AUDITIVA','MENTAL','MULTIPLE')),
  ADD COLUMN IF NOT EXISTS conadis_number       text,
  ADD COLUMN IF NOT EXISTS disability_percentage integer
    CHECK (disability_percentage BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS disability_card_issued  date,
  ADD COLUMN IF NOT EXISTS disability_card_expires date,
  ADD COLUMN IF NOT EXISTS disability_grade     text
    CHECK (disability_grade IN ('LEVE','MODERADO','GRAVE','MUY_GRAVE')),
  -- Información académica
  ADD COLUMN IF NOT EXISTS education_level      text
    CHECK (education_level IN ('PRIMARIA','SECUNDARIA','TECNICO','SUPERIOR','POSGRADO')),
  ADD COLUMN IF NOT EXISTS degree_title         text,
  ADD COLUMN IF NOT EXISTS education_institution text;

NOTIFY pgrst, 'reload schema';

-- Columns added to public.employees:
--   identification_type, birth_date, gender, civil_status, nationality, birth_place
--   phone_home, emergency_contact_name, emergency_contact_phone
--   position, contract_type, labor_regime
--   iess_number, iess_entry_date, ruc, children_count
--   has_disability, disability_type, conadis_number, disability_percentage,
--   disability_card_issued, disability_card_expires, disability_grade
--   education_level, degree_title, education_institution
-- Total: 27 new columns
