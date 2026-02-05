-- =========================================================
-- Tax Declaration Platform
-- PostgreSQL Database Schema
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1. USERS & AUTH
-- =========================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  username TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0,
  used BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_otp_active
  ON otp_codes(user_id)
  WHERE used = false;

-- =========================================================
-- 2. TAX SUBJECTS & ROLES
-- =========================================================

CREATE TABLE tax_subjects (
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

CREATE TABLE user_tax_subjects (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tax_subject_id UUID REFERENCES tax_subjects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'representative', 'accountant')),
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, tax_subject_id)
);

-- =========================================================
-- 3. SOURCE RECORDS (AUDIT TRAIL)
-- =========================================================

CREATE TABLE source_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES tax_subjects(id),
  source_type TEXT CHECK (
    source_type IN ('manual', 'csv', 'excel', 'bank', '1c', 'api')
  ),
  external_id TEXT,
  checksum TEXT,
  raw_payload JSONB,
  imported_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 4. TAX EVENTS (IMMUTABLE FACTS)
-- =========================================================

CREATE TABLE tax_event_types (
  code TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE tax_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES tax_subjects(id),
  source_record_id UUID REFERENCES source_records(id),
  event_type TEXT REFERENCES tax_event_types(code),
  event_date DATE NOT NULL,
  amount NUMERIC(18,2),
  currency CHAR(3),
  metadata JSONB,
  tax_year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM event_date)) STORED,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_tax_events_subject_year
  ON tax_events(subject_id, tax_year);

-- =========================================================
-- 5. LOGICAL TAX MODEL (RULE ENGINE)
-- =========================================================

CREATE TABLE logical_fields (
  code TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE tax_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_code TEXT,
  tax_year INT,
  rule_type TEXT CHECK (
    rule_type IN ('mapping', 'exclusion', 'calculation', 'flag')
  ),
  conditions JSONB,
  actions JSONB,
  priority INT DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tax_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_event_id UUID REFERENCES tax_events(id) ON DELETE CASCADE,
  tax_year INT,
  logical_field TEXT REFERENCES logical_fields(code),
  amount NUMERIC(18,2),
  rule_id UUID REFERENCES tax_rules(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_tax_mappings_year
  ON tax_mappings(tax_year);

-- =========================================================
-- 6. DECLARATIONS
-- =========================================================

CREATE TABLE declaration_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES tax_subjects(id),
  tax_year INT,
  form_code TEXT,
  status TEXT CHECK (
    status IN (
      'draft',
      'validated',
      'awaiting_consent',
      'signed',
      'submitted',
      'accepted',
      'rejected'
    )
  ),
  flags JSONB,
  validated_at TIMESTAMP,
  exported_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE UNIQUE INDEX uq_declaration_subject_year
  ON declaration_drafts(subject_id, tax_year, form_code);

CREATE TABLE declaration_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declaration_drafts(id) ON DELETE CASCADE,
  logical_field TEXT REFERENCES logical_fields(code),
  value NUMERIC(18,2),
  source TEXT DEFAULT 'rule_engine',
  created_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 7. XML EXPORT & SMARTBRIDGE
-- =========================================================

CREATE TABLE xml_field_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_code TEXT,
  application_code TEXT,
  logical_field TEXT REFERENCES logical_fields(code),
  xml_field_name TEXT
);

CREATE UNIQUE INDEX uq_xml_map
  ON xml_field_map(form_code, application_code, xml_field_name);

CREATE TABLE xml_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declaration_drafts(id) ON DELETE CASCADE,
  xml_payload TEXT NOT NULL,
  schema_version TEXT,
  signed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE declaration_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declaration_drafts(id) ON DELETE CASCADE,
  signer_subject_id UUID REFERENCES tax_subjects(id),
  signature_payload TEXT,
  signed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE declaration_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declaration_drafts(id) ON DELETE CASCADE,
  external_system TEXT DEFAULT 'smartbridge',
  external_id TEXT,
  status TEXT,
  response_payload JSONB,
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 8. CONSENTS & NOTIFICATIONS
-- =========================================================

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declaration_drafts(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES tax_subjects(id),
  consent_type TEXT CHECK (consent_type IN ('submission')),
  channel TEXT CHECK (channel IN ('sms', 'email', 'web')),
  given_at TIMESTAMP DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('sms', 'email', 'push')),
  message TEXT,
  sent_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- 9. BACKGROUND JOBS (OPTIONAL)
-- =========================================================

CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT,
  payload JSONB,
  status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP
);
