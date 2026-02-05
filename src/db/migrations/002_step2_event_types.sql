-- =========================================================
-- STEP 2: Tax Event Types for Form 270.00
-- This creates the standardized vocabulary for tax events
-- =========================================================

-- Clear any test data (if exists)
DELETE FROM tax_event_types;

-- =========================================================
-- A. Property Income Events (270.01 Section A)
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_PROPERTY_SALE_KZ', 'Доход от реализации имущества в РК'),
('EV_PROPERTY_SALE_FOREIGN', 'Доход от реализации имущества за пределами РК'),
('EV_PROPERTY_CAPITAL_CONTRIBUTION', 'Доход от передачи имущества в уставный капитал'),
('EV_PROPERTY_RENT_NON_AGENT', 'Доход от аренды без налогового агента'),
('EV_PROPERTY_ASSIGNMENT_RIGHT', 'Доход от уступки права требования'),
('EV_IP_OTHER_ASSET_SALE', 'Доход ИП от реализации прочих активов');

-- =========================================================
-- B. Foreign Income Events (270.01 Section B)
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_FOREIGN_EMPLOYMENT_INCOME', 'Доход из иностранных источников по трудовому договору'),
('EV_FOREIGN_GPC_INCOME', 'Доход из иностранных источников по ГПХ'),
('EV_FOREIGN_WIN_INCOME', 'Выигрыши из иностранных источников'),
('EV_FOREIGN_DIVIDENDS', 'Дивиденды из иностранных источников'),
('EV_FOREIGN_INTEREST', 'Вознаграждения из иностранных источников'),
('EV_FOREIGN_SCHOLARSHIP', 'Стипендии из иностранных источников'),
('EV_FOREIGN_INSURANCE', 'Страховые выплаты из иностранных источников'),
('EV_FOREIGN_PENSION', 'Пенсионные выплаты из иностранных источников'),
('EV_FOREIGN_OTHER', 'Прочие доходы из иностранных источников');

-- =========================================================
-- C. Non-Agent Domestic Income Events (270.01 Section C)
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_DOMESTIC_HELPER_INCOME', 'Доходы домашних работников'),
('EV_CITIZEN_GPC_INCOME', 'Доходы граждан РК по ГПХ'),
('EV_MEDIATOR_INCOME', 'Доходы медиаторов'),
('EV_SUBSIDIARY_FARM_INCOME', 'Доходы от личного подсобного хозяйства'),
('EV_LABOR_MIGRANT_INCOME', 'Доходы трудовых иммигрантов'),
('EV_OTHER_NON_AGENT_INCOME', 'Прочие доходы без налогового агента');

-- =========================================================
-- D. CFC (Controlled Foreign Company) Events (270.07)
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_CFC_PROFIT_BEFORE_TAX', 'Финансовая прибыль КИК до налогообложения'),
('EV_CFC_PROFIT_EXEMPTED', 'Освобожденная финансовая прибыль КИК'),
('EV_CFC_TAX_PAID', 'Налог на прибыль КИК, уплаченный за рубежом'),
('EV_CFC_INCOME_KZ', 'Доход КИК из источников в РК');

-- =========================================================
-- E. Income Adjustment Events
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_ADJUSTMENT_ART_341', 'Корректировка доходов по статье 341 НК'),
('EV_ADJUSTMENT_ART_654', 'Корректировка доходов по статье 654 НК'),
('EV_ADJUSTMENT_TREATY', 'Корректировка по международному договору'),
('EV_ADJUSTMENT_AIFC', 'Корректировка по МФЦА');

-- =========================================================
-- F. Deduction Events
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_DEDUCTION_STANDARD', 'Стандартные налоговые вычеты'),
('EV_DEDUCTION_OTHER', 'Прочие налоговые вычеты');

-- =========================================================
-- G. Foreign Tax Credit Events
-- =========================================================
INSERT INTO tax_event_types (code, description) VALUES
('EV_FOREIGN_TAX_PAID_GENERAL', 'Иностранный налог к зачету (общий)'),
('EV_FOREIGN_TAX_PAID_CFC', 'Иностранный налог КИК к зачету');

-- =========================================================
-- Logical Fields for Form 270.00
-- =========================================================
DELETE FROM logical_fields;

-- Property income fields (270.01 A)
INSERT INTO logical_fields (code, description) VALUES
('LF_INCOME_PROPERTY_KZ', 'Доход от реализации имущества в РК (строка A1)'),
('LF_INCOME_PROPERTY_FOREIGN', 'Доход от реализации имущества за рубежом (строка A2)'),
('LF_INCOME_PROPERTY_CAPITAL_CONTRIBUTION', 'Доход от передачи имущества в уставный капитал (строка A3)'),
('LF_INCOME_PROPERTY_TOTAL', 'Итого доход от имущества (A1+A2+A3)'),
('LF_INCOME_RENT_NON_AGENT', 'Доход от аренды без агента (строка A4)'),
('LF_INCOME_ASSIGNMENT_RIGHTS', 'Доход от уступки права требования (строка A5)'),
('LF_INCOME_IP_OTHER_ASSETS', 'Доход ИП от прочих активов (строка A6)');

-- Foreign income fields (270.01 B)
INSERT INTO logical_fields (code, description) VALUES
('LF_INCOME_FOREIGN_EMPLOYMENT', 'Доход по трудовому договору из-за рубежа (B1.1)'),
('LF_INCOME_FOREIGN_GPC', 'Доход по ГПХ из-за рубежа (B1.2)'),
('LF_INCOME_FOREIGN_WIN', 'Выигрыши из-за рубежа (B1.3)'),
('LF_INCOME_FOREIGN_DIVIDENDS', 'Дивиденды из-за рубежа (B1.4)'),
('LF_INCOME_FOREIGN_INTEREST', 'Вознаграждения из-за рубежа (B1.5)'),
('LF_INCOME_FOREIGN_SCHOLARSHIP', 'Стипендии из-за рубежа (B1.6)'),
('LF_INCOME_FOREIGN_INSURANCE', 'Страховые выплаты из-за рубежа (B1.7)'),
('LF_INCOME_FOREIGN_PENSION', 'Пенсионные выплаты из-за рубежа (B1.8)'),
('LF_INCOME_FOREIGN_OTHER', 'Прочие доходы из-за рубежа (B1.9)'),
('LF_INCOME_FOREIGN_TOTAL', 'Итого иностранные доходы (сумма B1)');

-- Non-agent income fields (270.01 C)
INSERT INTO logical_fields (code, description) VALUES
('LF_INCOME_DOMESTIC_HELPERS', 'Доходы домашних работников (C1)'),
('LF_INCOME_CITIZENS_GPC', 'Доходы граждан РК по ГПХ (C2)'),
('LF_INCOME_MEDIATOR', 'Доходы медиаторов (C3)'),
('LF_INCOME_SUBSIDIARY_FARM', 'Доходы от личного подсобного хозяйства (C4)'),
('LF_INCOME_LABOR_MIGRANT', 'Доходы трудовых иммигрантов (C5)'),
('LF_INCOME_OTHER_NON_AGENT', 'Прочие доходы без налогового агента (C6)');

-- CFC fields (270.07)
INSERT INTO logical_fields (code, description) VALUES
('LF_INCOME_CFC_PROFIT', 'Прибыль КИК до налогообложения'),
('LF_INCOME_CFC_EXEMPTED', 'Освобожденная прибыль КИК'),
('LF_INCOME_CFC_TAXABLE', 'Налогооблагаемая прибыль КИК');

-- Adjustment fields
INSERT INTO logical_fields (code, description) VALUES
('LF_ADJUSTMENT_EXCLUDED_ART_341', 'Корректировка по ст.341 НК'),
('LF_ADJUSTMENT_EXCLUDED_ART_654', 'Корректировка по ст.654 НК'),
('LF_ADJUSTMENT_EXCLUDED_TREATY', 'Корректировка по международному договору'),
('LF_ADJUSTMENT_EXCLUDED_AIFC', 'Корректировка по МФЦА'),
('LF_ADJUSTMENT_TOTAL', 'Итого корректировки');

-- Deduction fields
INSERT INTO logical_fields (code, description) VALUES
('LF_DEDUCTION_STANDARD', 'Стандартные налоговые вычеты'),
('LF_DEDUCTION_OTHER', 'Прочие налоговые вычеты'),
('LF_DEDUCTION_TOTAL', 'Итого вычеты');

-- Summary fields
INSERT INTO logical_fields (code, description) VALUES
('LF_INCOME_TOTAL', 'Общий доход (сумма всех категорий)'),
('LF_TAXABLE_INCOME', 'Облагаемый доход (доход - корректировки - вычеты)'),
('LF_IPN_CALCULATED', 'Исчисленный ИПН (облагаемый доход × 10%)'),
('LF_FOREIGN_TAX_CREDIT_GENERAL', 'Зачет иностранного налога (общий)'),
('LF_FOREIGN_TAX_CREDIT_CFC', 'Зачет иностранного налога КИК'),
('LF_IPN_PAYABLE', 'ИПН к уплате (исчисленный - зачет)');

-- =========================================================
-- Mapping Rules: Event Types → Logical Fields
-- These are the default rules for 2024+
-- =========================================================
DELETE FROM tax_rules;

-- Property income mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_PROPERTY_SALE_KZ', 2024, 'mapping',
 '{"event_type": {"=": "EV_PROPERTY_SALE_KZ"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_PROPERTY_KZ", "amount_source": "event.amount"}]',
 100, true),
 
('MAP_PROPERTY_SALE_FOREIGN', 2024, 'mapping',
 '{"event_type": {"=": "EV_PROPERTY_SALE_FOREIGN"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_PROPERTY_FOREIGN", "amount_source": "event.amount"}]',
 100, true),

('MAP_PROPERTY_CAPITAL', 2024, 'mapping',
 '{"event_type": {"=": "EV_PROPERTY_CAPITAL_CONTRIBUTION"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_PROPERTY_CAPITAL_CONTRIBUTION", "amount_source": "event.amount"}]',
 100, true),

('MAP_PROPERTY_RENT', 2024, 'mapping',
 '{"event_type": {"=": "EV_PROPERTY_RENT_NON_AGENT"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_RENT_NON_AGENT", "amount_source": "event.amount"}]',
 100, true),

('MAP_ASSIGNMENT_RIGHT', 2024, 'mapping',
 '{"event_type": {"=": "EV_PROPERTY_ASSIGNMENT_RIGHT"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_ASSIGNMENT_RIGHTS", "amount_source": "event.amount"}]',
 100, true),

('MAP_IP_OTHER_ASSET', 2024, 'mapping',
 '{"event_type": {"=": "EV_IP_OTHER_ASSET_SALE"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_IP_OTHER_ASSETS", "amount_source": "event.amount"}]',
 100, true);

-- Foreign income mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_FOREIGN_EMPLOYMENT', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_EMPLOYMENT_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_EMPLOYMENT", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_GPC', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_GPC_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_GPC", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_WIN', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_WIN_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_WIN", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_DIVIDENDS', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_DIVIDENDS"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_DIVIDENDS", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_INTEREST', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_INTEREST"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_INTEREST", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_SCHOLARSHIP', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_SCHOLARSHIP"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_SCHOLARSHIP", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_INSURANCE', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_INSURANCE"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_INSURANCE", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_PENSION', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_PENSION"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_PENSION", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_OTHER', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_OTHER"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_FOREIGN_OTHER", "amount_source": "event.amount"}]',
 100, true);

-- Non-agent domestic income mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_DOMESTIC_HELPER', 2024, 'mapping',
 '{"event_type": {"=": "EV_DOMESTIC_HELPER_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_DOMESTIC_HELPERS", "amount_source": "event.amount"}]',
 100, true),

('MAP_CITIZEN_GPC', 2024, 'mapping',
 '{"event_type": {"=": "EV_CITIZEN_GPC_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_CITIZENS_GPC", "amount_source": "event.amount"}]',
 100, true),

('MAP_MEDIATOR', 2024, 'mapping',
 '{"event_type": {"=": "EV_MEDIATOR_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_MEDIATOR", "amount_source": "event.amount"}]',
 100, true),

('MAP_SUBSIDIARY_FARM', 2024, 'mapping',
 '{"event_type": {"=": "EV_SUBSIDIARY_FARM_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_SUBSIDIARY_FARM", "amount_source": "event.amount"}]',
 100, true),

('MAP_LABOR_MIGRANT', 2024, 'mapping',
 '{"event_type": {"=": "EV_LABOR_MIGRANT_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_LABOR_MIGRANT", "amount_source": "event.amount"}]',
 100, true),

('MAP_OTHER_NON_AGENT', 2024, 'mapping',
 '{"event_type": {"=": "EV_OTHER_NON_AGENT_INCOME"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_OTHER_NON_AGENT", "amount_source": "event.amount"}]',
 100, true);

-- CFC mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_CFC_PROFIT', 2024, 'mapping',
 '{"event_type": {"=": "EV_CFC_PROFIT_BEFORE_TAX"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_CFC_PROFIT", "amount_source": "event.amount"}]',
 100, true),

('MAP_CFC_EXEMPTED', 2024, 'mapping',
 '{"event_type": {"=": "EV_CFC_PROFIT_EXEMPTED"}}',
 '[{"type": "map", "logical_field": "LF_INCOME_CFC_EXEMPTED", "amount_source": "event.amount"}]',
 100, true);

-- Adjustment mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_ADJUST_341', 2024, 'mapping',
 '{"event_type": {"=": "EV_ADJUSTMENT_ART_341"}}',
 '[{"type": "map", "logical_field": "LF_ADJUSTMENT_EXCLUDED_ART_341", "amount_source": "event.amount"}]',
 100, true),

('MAP_ADJUST_654', 2024, 'mapping',
 '{"event_type": {"=": "EV_ADJUSTMENT_ART_654"}}',
 '[{"type": "map", "logical_field": "LF_ADJUSTMENT_EXCLUDED_ART_654", "amount_source": "event.amount"}]',
 100, true),

('MAP_ADJUST_TREATY', 2024, 'mapping',
 '{"event_type": {"=": "EV_ADJUSTMENT_TREATY"}}',
 '[{"type": "map", "logical_field": "LF_ADJUSTMENT_EXCLUDED_TREATY", "amount_source": "event.amount"}]',
 100, true),

('MAP_ADJUST_AIFC', 2024, 'mapping',
 '{"event_type": {"=": "EV_ADJUSTMENT_AIFC"}}',
 '[{"type": "map", "logical_field": "LF_ADJUSTMENT_EXCLUDED_AIFC", "amount_source": "event.amount"}]',
 100, true);

-- Deduction mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_DEDUCTION_STANDARD', 2024, 'mapping',
 '{"event_type": {"=": "EV_DEDUCTION_STANDARD"}}',
 '[{"type": "map", "logical_field": "LF_DEDUCTION_STANDARD", "amount_source": "event.amount"}]',
 100, true),

('MAP_DEDUCTION_OTHER', 2024, 'mapping',
 '{"event_type": {"=": "EV_DEDUCTION_OTHER"}}',
 '[{"type": "map", "logical_field": "LF_DEDUCTION_OTHER", "amount_source": "event.amount"}]',
 100, true);

-- Foreign tax credit mappings
INSERT INTO tax_rules (rule_code, tax_year, rule_type, conditions, actions, priority, is_active) VALUES
('MAP_FOREIGN_TAX_GENERAL', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_TAX_PAID_GENERAL"}}',
 '[{"type": "map", "logical_field": "LF_FOREIGN_TAX_CREDIT_GENERAL", "amount_source": "event.amount"}]',
 100, true),

('MAP_FOREIGN_TAX_CFC', 2024, 'mapping',
 '{"event_type": {"=": "EV_FOREIGN_TAX_PAID_CFC"}}',
 '[{"type": "map", "logical_field": "LF_FOREIGN_TAX_CREDIT_CFC", "amount_source": "event.amount"}]',
 100, true);

-- =========================================================
-- XML Field Mapping for Form 270.00
-- Maps logical_fields to XML field names
-- =========================================================
DELETE FROM xml_field_map WHERE form_code = '270.00';

-- 270.00 Main form fields (page_270_00_01)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.00', NULL, 'iin'),
('270.00', '270.00', NULL, 'period_year'),
('270.00', '270.00', NULL, 'fio1'),
('270.00', '270.00', NULL, 'fio2'),
('270.00', '270.00', NULL, 'fio3'),
('270.00', '270.00', NULL, 'payer_phone_number'),
('270.00', '270.00', NULL, 'email'),
('270.00', '270.00', NULL, 'iin_spouse'),
('270.00', '270.00', NULL, 'iin_legalrepresentative'),
('270.00', '270.00', NULL, 'dt_main'),
('270.00', '270.00', NULL, 'dt_regular'),
('270.00', '270.00', NULL, 'dt_additional'),
('270.00', '270.00', NULL, 'dt_notice'),
('270.00', '270.00', NULL, 'pril_1'),
('270.00', '270.00', NULL, 'pril_2'),
('270.00', '270.00', NULL, 'pril_3'),
('270.00', '270.00', NULL, 'pril_4'),
('270.00', '270.00', NULL, 'pril_5'),
('270.00', '270.00', NULL, 'pril_6'),
('270.00', '270.00', NULL, 'pril_7');

-- 270.01 Section A - Property Income (Имущественный доход)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_INCOME_PROPERTY_KZ', 'field_270_01_A1_1'),
('270.00', '270.01', 'LF_INCOME_PROPERTY_FOREIGN', 'field_270_01_A1_2'),
('270.00', '270.01', 'LF_INCOME_PROPERTY_CAPITAL_CONTRIBUTION', 'field_270_01_A2'),
('270.00', '270.01', 'LF_INCOME_RENT_NON_AGENT', 'field_270_01_A3'),
('270.00', '270.01', 'LF_INCOME_ASSIGNMENT_RIGHTS', 'field_270_01_A4'),
('270.00', '270.01', 'LF_INCOME_IP_OTHER_ASSETS', 'field_270_01_A5'),
('270.00', '270.01', 'LF_INCOME_PROPERTY_TOTAL', 'field_270_01_A');

-- 270.01 Section B - Foreign Income (Иностранные доходы)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_INCOME_FOREIGN_EMPLOYMENT', 'field_270_01_B1_1'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_GPC', 'field_270_01_B1_2'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_WIN', 'field_270_01_B1_3'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_DIVIDENDS', 'field_270_01_B1_4'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_INTEREST', 'field_270_01_B1_5'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_SCHOLARSHIP', 'field_270_01_B1_6'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_INSURANCE', 'field_270_01_B1_7'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_PENSION', 'field_270_01_B1_8'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_OTHER', 'field_270_01_B1_9'),
('270.00', '270.01', 'LF_INCOME_FOREIGN_TOTAL', 'field_270_01_B1');

-- 270.01 Section B2-B7 - Non-agent domestic income
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_INCOME_DOMESTIC_HELPERS', 'field_270_01_B2'),
('270.00', '270.01', 'LF_INCOME_CITIZENS_GPC', 'field_270_01_B3'),
('270.00', '270.01', 'LF_INCOME_MEDIATOR', 'field_270_01_B4'),
('270.00', '270.01', 'LF_INCOME_SUBSIDIARY_FARM', 'field_270_01_B5'),
('270.00', '270.01', 'LF_INCOME_LABOR_MIGRANT', 'field_270_01_B6'),
('270.00', '270.01', 'LF_INCOME_OTHER_NON_AGENT', 'field_270_01_B7');

-- 270.01 Section C - CFC (КИК)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_INCOME_CFC_PROFIT', 'field_270_01_C');

-- 270.01 Section D - Total Income
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_INCOME_TOTAL', 'field_270_01_D');

-- 270.01 Section E - Adjustments (Корректировки)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_ADJUSTMENT_EXCLUDED_ART_341', 'field_270_01_E1'),
('270.00', '270.01', 'LF_ADJUSTMENT_EXCLUDED_ART_654', 'field_270_01_E2'),
('270.00', '270.01', 'LF_ADJUSTMENT_EXCLUDED_TREATY', 'field_270_01_E3'),
('270.00', '270.01', 'LF_ADJUSTMENT_EXCLUDED_AIFC', 'field_270_01_E4'),
('270.00', '270.01', 'LF_ADJUSTMENT_TOTAL', 'field_270_01_E');

-- 270.01 Section F - Deductions (Вычеты)
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_DEDUCTION_STANDARD', 'field_270_01_F1'),
('270.00', '270.01', 'LF_DEDUCTION_OTHER', 'field_270_01_F2'),
('270.00', '270.01', 'LF_DEDUCTION_TOTAL', 'field_270_01_F');

-- 270.01 Section G-K - Tax calculation
INSERT INTO xml_field_map (form_code, application_code, logical_field, xml_field_name) VALUES
('270.00', '270.01', 'LF_TAXABLE_INCOME', 'field_270_01_G'),
('270.00', '270.01', 'LF_IPN_CALCULATED', 'field_270_01_H'),
('270.00', '270.01', 'LF_FOREIGN_TAX_CREDIT_GENERAL', 'field_270_01_I'),
('270.00', '270.01', 'LF_FOREIGN_TAX_CREDIT_CFC', 'field_270_01_J'),
('270.00', '270.01', 'LF_IPN_PAYABLE', 'field_270_01_K');
