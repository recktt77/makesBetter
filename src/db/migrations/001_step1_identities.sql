-- 001_step1_identities.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------
-- PERSONS (физлицо) — по документам 270.00: ИИН + ФИО + контакты (по желанию)
-- -----------------------------
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iin CHAR(12) UNIQUE NOT NULL,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  email TEXT,
  phone TEXT,
  residency_status TEXT CHECK (residency_status IN ('resident', 'non_resident')),
  marital_status TEXT CHECK (marital_status IN ('single', 'married')),
  tax_obligation_start_year INT,
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- BUSINESS ENTITIES (ИП/ТОО) — сейчас можно заложить, чтобы не ломать потом
-- -----------------------------
CREATE TABLE IF NOT EXISTS business_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bin CHAR(12) UNIQUE NOT NULL,
  legal_name TEXT NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('IP', 'TOO')) NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- -----------------------------
-- TAX IDENTITIES (унификация PERSON/BUSINESS)
-- Это ключевая сущность "за кого подают", а не "кто вошел"
-- -----------------------------
CREATE TABLE IF NOT EXISTS tax_identities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_type TEXT CHECK (identity_type IN ('PERSON', 'BUSINESS')) NOT NULL,
  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  business_id UUID REFERENCES business_entities(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT chk_exactly_one_ref CHECK (
    (identity_type = 'PERSON' AND person_id IS NOT NULL AND business_id IS NULL)
    OR
    (identity_type = 'BUSINESS' AND business_id IS NOT NULL AND person_id IS NULL)
  )
);

-- -----------------------------
-- ROLES: user ↔ tax_identity (owner/representative/accountant)
-- -----------------------------
CREATE TABLE IF NOT EXISTS user_identity_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tax_identity_id UUID NOT NULL REFERENCES tax_identities(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'representative', 'accountant')) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, tax_identity_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identity_roles_user
  ON user_identity_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_identity_roles_identity
  ON user_identity_roles(tax_identity_id);
