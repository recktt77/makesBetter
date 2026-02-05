CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- A) AUTH
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
-- B) DOMAIN IDENTITIES (PERSON / BUSINESS) + ROLES
-- =========================================================
CREATE TABLE persons (
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

CREATE TABLE business_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bin CHAR(12) UNIQUE NOT NULL,
  legal_name TEXT NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('IP', 'TOO')) NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tax_identities (
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

CREATE TABLE user_identity_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tax_identity_id UUID REFERENCES tax_identities(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'representative', 'accountant')) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, tax_identity_id)
);

-- =========================================================
-- C) SOURCES (AUDIT) + EVENTS (IMMUTABLE FACTS)
-- =========================================================
CREATE TABLE source_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_identity_id UUID REFERENCES tax_identities(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('manual', 'csv', 'excel', 'bank', '1c', 'api')) NOT NULL,
  external_id TEXT,
  checksum TEXT,
  raw_payload JSONB,
  imported_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tax_event_types (
  code TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE tax_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_identity_id UUID REFERENCES tax_identities(id) ON DELETE CASCADE,
  source_record_id UUID REFERENCES source_records(id) ON DELETE SET NULL,
  event_type TEXT REFERENCES tax_event_types(code),
  event_date DATE NOT NULL,
  amount NUMERIC(18,2),
  currency CHAR(3),
  metadata JSONB,
  tax_year INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM event_date)) STORED,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_tax_events_identity_year
  ON tax_events(tax_identity_id, tax_year);

-- =========================================================
-- D) LOGICAL TAX MODEL (RULE ENGINE)
-- =========================================================
CREATE TABLE logical_fields (
  code TEXT PRIMARY KEY,
  description TEXT
);

CREATE TABLE tax_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_code TEXT,
  tax_year INT,
  rule_type TEXT CHECK (rule_type IN ('mapping', 'exclusion', 'calculation', 'flag')) NOT NULL,
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
-- E) DECLARATIONS (draft/workflow + items + validation)
-- =========================================================
CREATE TABLE declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tax_identity_id UUID REFERENCES tax_identities(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,

  -- e.g. '270.00'
  form_code TEXT NOT NULL,

  -- from rules & XML: dt_main/dt_regular/dt_additional/dt_notice
  declaration_kind TEXT CHECK (declaration_kind IN ('main','regular','additional','notice')) NOT NULL DEFAULT 'main',

  -- workflow
  status TEXT CHECK (
    status IN ('draft','validated','awaiting_consent','signed','submitted','accepted','rejected')
  ) NOT NULL DEFAULT 'draft',

  -- snapshot “шапки” для XML (по твоему XML и правилам)
  iin CHAR(12), -- для 270.00 обязательно PERSON/IIN (дублируем как snapshot)
  fio_last TEXT,
  fio_first TEXT,
  fio_middle TEXT,
  payer_phone TEXT,
  email TEXT,

  iin_spouse CHAR(12),
  iin_legalrepresentative CHAR(12),

  -- приложения / флаги (pril_1..7, прочие флаги)
  flags JSONB,

  validated_at TIMESTAMP,
  exported_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- 1 декларация на год/форму/identity (как правило)
CREATE UNIQUE INDEX uq_decl_identity_year_form
  ON declarations(tax_identity_id, tax_year, form_code);

CREATE TABLE declaration_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  logical_field TEXT REFERENCES logical_fields(code),
  value NUMERIC(18,2),
  source TEXT DEFAULT 'rule_engine',
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(declaration_id, logical_field)
);

-- отчёты валидации: XSD + бизнес-правила
CREATE TABLE validation_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  validation_type TEXT CHECK (validation_type IN ('xsd','business')) NOT NULL,
  is_valid BOOLEAN NOT NULL,
  report JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- F) XML EXPORT (projection)
-- =========================================================
CREATE TABLE xml_field_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_code TEXT NOT NULL,          -- '270.00'
  application_code TEXT NOT NULL,   -- '270.01'..'270.07' or '270.00'
  logical_field TEXT REFERENCES logical_fields(code),
  xml_field_name TEXT NOT NULL,     -- e.g. 'field_270_01_D' or 'iin'
  UNIQUE(form_code, application_code, xml_field_name)
);

CREATE TABLE xml_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  xml_payload TEXT NOT NULL,
  schema_version TEXT,      -- formatVersion/version from XML if нужно
  xml_hash TEXT,
  signed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- G) CONSENT + SIGNING + SMARTBRIDGE
-- =========================================================
CREATE TABLE consent_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('sms','email','web')) NOT NULL,
  destination TEXT,             -- номер/почта
  status TEXT CHECK (status IN ('created','sent','delivered','failed','expired')) NOT NULL DEFAULT 'created',
  provider_payload JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  tax_identity_id UUID REFERENCES tax_identities(id) ON DELETE CASCADE,
  consent_type TEXT CHECK (consent_type IN ('submission','bank_disclosure')) NOT NULL,
  channel TEXT CHECK (channel IN ('sms','email','web')) NOT NULL,
  given_at TIMESTAMP DEFAULT now()
);

CREATE TABLE declaration_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  signed_by_identity_id UUID REFERENCES tax_identities(id) ON DELETE SET NULL,
  signature_type TEXT CHECK (signature_type IN ('eds','otp')) NOT NULL,
  signature_payload TEXT,     -- ds:Signature / контейнер подписи
  signed_at TIMESTAMP DEFAULT now()
);

CREATE TABLE smartbridge_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  declaration_id UUID REFERENCES declarations(id) ON DELETE CASCADE,
  external_system TEXT DEFAULT 'smartbridge',
  external_id TEXT,
  status TEXT,                -- raw status from provider
  response_payload JSONB,
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now()
);

-- =========================================================
-- H) NOTIFICATIONS (optional but useful)
-- =========================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('sms','email','push')) NOT NULL,
  message TEXT,
  provider_payload JSONB,
  sent_at TIMESTAMP DEFAULT now()
);
