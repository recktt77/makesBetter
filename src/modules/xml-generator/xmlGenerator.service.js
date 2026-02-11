const crypto = require('crypto');
const xmlGeneratorRepository = require('./xmlGenerator.repository');
const declarationsRepository = require('../declarations/declarations.repository');
const identitiesRepository = require('../identities/identities.repository');

/**
 * XML Generator Service
 * Generates XML in 270.00 format according to Kazakhstan tax authority specifications
 * 
 * Structure:
 * <fno code="270.00" formatVersion="1" version="2">
 *   <form name="form_270_00">
 *     <sheetGroup>
 *       <sheet name="page_270_00_01">
 *         <field name="iin">...</field>
 *       </sheet>
 *     </sheetGroup>
 *   </form>
 * </fno>
 */
const xmlGeneratorService = {
    // ==========================================
    // MAIN XML GENERATION
    // ==========================================

    async generate(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        if (declaration.status === 'draft') {
            throw new Error('Declaration must be validated before generating XML');
        }

        const items = await declarationsRepository.getItemsAsObject(declarationId);
        const xmlContent = this.buildXml(declaration, items);
        const xmlHash = crypto.createHash('sha256').update(xmlContent).digest('hex');
        const version = await xmlGeneratorRepository.getNextVersion(declarationId);

        const savedXml = await xmlGeneratorRepository.saveGeneratedXml({
            declarationId,
            xmlContent,
            xmlHash,
            version,
            generatedBy: userId,
        });

        return {
            id: savedXml.id,
            version,
            xmlHash,
            xmlContent,
            createdAt: savedXml.created_at,
        };
    },

    buildXml(declaration, items) {
        const taxYear = declaration.tax_year;
        const flags = declaration.flags || {};
        const now = new Date();
        const dateStr = this.formatDate(now);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<fno xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" code="270.00" formatVersion="1" version="2">\n`;

        xml += this.buildForm270_00(declaration, taxYear, dateStr, flags);
        xml += this.buildForm270_01(declaration, items, taxYear);
        xml += this.buildForm270_02(declaration, taxYear);
        xml += this.buildForm270_03(declaration, taxYear);
        xml += this.buildForm270_04(declaration, taxYear);
        xml += this.buildForm270_05(declaration, taxYear);
        xml += this.buildForm270_06(declaration, taxYear);
        xml += this.buildForm270_07(declaration, taxYear);

        xml += `</fno>\n`;
        return xml;
    },

    buildForm270_00(declaration, taxYear, dateStr, flags) {
        let xml = `<form name="form_270_00">\n<sheetGroup>\n<sheet name="page_270_00_01">\n`;

        xml += this.field('accept_date', dateStr);
        xml += this.field('agreement', 'false');
        xml += this.field('dt_additional', declaration.declaration_kind === 'additional' ? 'true' : 'false');
        xml += this.field('dt_main', declaration.declaration_kind === 'main' ? 'true' : 'false');
        xml += this.field('dt_notice', declaration.declaration_kind === 'notice' ? 'true' : 'false');
        xml += this.field('dt_regular', declaration.declaration_kind === 'regular' ? 'true' : 'false');
        xml += this.field('dt_w', 'false');
        xml += this.field('email', declaration.email || '');
        xml += this.field('fio1', declaration.fio_last || '');
        xml += this.field('fio2', declaration.fio_first || '');
        xml += this.field('fio3', declaration.fio_middle || '');

        const headName = [declaration.fio_last, declaration.fio_first, declaration.fio_middle].filter(Boolean).join(' ');
        xml += this.field('head_name', headName);

        xml += this.field('iin', declaration.iin || '');
        xml += this.field('iin_legalrepresentative', declaration.iin_legalrepresentative || '');
        xml += this.field('iin_spouse', declaration.iin_spouse || '');
        xml += this.field('in_doc_number', '');
        xml += this.field('payer_phone_number', declaration.payer_phone || '');
        xml += this.field('period_year', taxYear);
        xml += this.field('post_date', '');
        xml += this.field('pril_1', flags.pril_1 ? 'true' : 'false');
        xml += this.field('pril_2', flags.pril_2 ? 'true' : 'false');
        xml += this.field('pril_3', flags.pril_3 ? 'true' : 'false');
        xml += this.field('pril_4', flags.pril_4 ? 'true' : 'false');
        xml += this.field('pril_5', flags.pril_5 ? 'true' : 'false');
        xml += this.field('pril_6', flags.pril_6 ? 'true' : 'false');
        xml += this.field('pril_7', flags.pril_7 ? 'true' : 'false');
        xml += this.field('rating_auth_code', '');
        xml += this.field('receptor_name', '');
        xml += this.field('submit_date', dateStr);

        xml += `</sheet>\n<sheet name="page_270_00_02"/>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_01(declaration, items, taxYear) {
        let xml = `<form name="form_270_01">\n<sheetGroup>\n<sheet name="page_270_01_01">\n`;

        // Section A - Property Income (Доходы от реализации имущества)
        xml += this.field('field_270_01_A', this.formatMoney(items.LF_INCOME_PROPERTY_TOTAL));
        xml += this.field('field_270_01_A_1', this.formatMoney(items.LF_INCOME_PROPERTY_SALE));
        xml += this.field('field_270_01_A_1_1', this.formatMoney(items.LF_INCOME_PROPERTY_KZ));
        xml += this.field('field_270_01_A_1_2', this.formatMoney(items.LF_INCOME_PROPERTY_FOREIGN));
        xml += this.field('field_270_01_A_2', this.formatMoney(items.LF_INCOME_PROPERTY_CAPITAL_CONTRIBUTION));
        xml += this.field('field_270_01_A_3', this.formatMoney(items.LF_INCOME_RENT_NON_AGENT));
        xml += this.field('field_270_01_A_4', this.formatMoney(items.LF_INCOME_ASSIGNMENT_RIGHTS));
        xml += this.field('field_270_01_A_5', this.formatMoney(items.LF_INCOME_IP_OTHER_ASSETS));

        // Section B - Total other income (Прочие доходы)
        xml += this.field('field_270_01_B', this.formatMoney(items.LF_INCOME_OTHER_TOTAL));

        // Section B_1 - Foreign Income (Доходы из источников за пределами РК)
        xml += this.field('field_270_01_B_1', this.formatMoney(items.LF_INCOME_FOREIGN_TOTAL));
        xml += this.field('field_270_01_B_1_1', this.formatMoney(items.LF_INCOME_FOREIGN_EMPLOYMENT));
        xml += this.field('field_270_01_B_1_2', this.formatMoney(items.LF_INCOME_FOREIGN_GPC));
        xml += this.field('field_270_01_B_1_3', this.formatMoney(items.LF_INCOME_FOREIGN_WIN));
        xml += this.field('field_270_01_B_1_4', this.formatMoney(items.LF_INCOME_FOREIGN_DIVIDENDS));
        xml += this.field('field_270_01_B_1_5', this.formatMoney(items.LF_INCOME_FOREIGN_INTEREST));
        xml += this.field('field_270_01_B_1_6', this.formatMoney(items.LF_INCOME_FOREIGN_SCHOLARSHIP));
        xml += this.field('field_270_01_B_1_7', this.formatMoney(items.LF_INCOME_FOREIGN_INSURANCE));
        xml += this.field('field_270_01_B_1_8', this.formatMoney(items.LF_INCOME_FOREIGN_PENSION));
        xml += this.field('field_270_01_B_1_9', this.formatMoney(items.LF_INCOME_FOREIGN_OTHER));

        // Section B_2 - B_7 - Non-agent domestic income
        xml += this.field('field_270_01_B_2', this.formatMoney(items.LF_INCOME_DOMESTIC_HELPERS));
        xml += this.field('field_270_01_B_3', this.formatMoney(items.LF_INCOME_CITIZENS_GPC));
        xml += this.field('field_270_01_B_4', this.formatMoney(items.LF_INCOME_MEDIATOR));
        xml += this.field('field_270_01_B_5', this.formatMoney(items.LF_INCOME_SUBSIDIARY_FARM));
        xml += this.field('field_270_01_B_6', this.formatMoney(items.LF_INCOME_LABOR_MIGRANT));
        xml += this.field('field_270_01_B_7', this.formatMoney(items.LF_INCOME_OTHER_NON_AGENT));

        // Section C - CFC (Доход от прибыли КИК)
        xml += this.field('field_270_01_C', this.formatMoney(items.LF_INCOME_CFC_PROFIT));

        // Section D - Total Income (Итого доходов)
        xml += this.field('field_270_01_D', this.formatMoney(items.LF_INCOME_TOTAL));

        // Section E - Adjustments (Корректировка дохода)
        xml += this.field('field_270_01_E', this.formatMoney(items.LF_ADJUSTMENT_TOTAL));
        xml += this.field('field_270_01_E_1', this.formatMoney(items.LF_ADJUSTMENT_EXCLUDED_ART_341));
        xml += this.field('field_270_01_E_2', this.formatMoney(items.LF_ADJUSTMENT_EXCLUDED_ART_654));
        xml += this.field('field_270_01_E_3', this.formatMoney(items.LF_ADJUSTMENT_EXCLUDED_TREATY));
        xml += this.field('field_270_01_E_4', this.formatMoney(items.LF_ADJUSTMENT_EXCLUDED_AIFC));

        // Section F - Deductions (Налоговые вычеты)
        xml += this.field('field_270_01_F', this.formatMoney(items.LF_DEDUCTION_TOTAL));
        xml += this.field('field_270_01_F_1', this.formatMoney(items.LF_DEDUCTION_STANDARD));
        xml += this.field('field_270_01_F_2', this.formatMoney(items.LF_DEDUCTION_OTHER));

        // Section G - Taxable Income (Облагаемый доход)
        xml += this.field('field_270_01_G', this.formatMoney(items.LF_TAXABLE_INCOME));

        // Section H - Calculated IPN (Исчисленный ИПН)
        xml += this.field('field_270_01_H', this.formatMoney(items.LF_IPN_CALCULATED));

        // Section I - Foreign Tax Credit General (Зачет иностранного налога)
        xml += this.field('field_270_01_I', this.formatMoney(items.LF_FOREIGN_TAX_CREDIT_GENERAL));

        // Section J - Foreign Tax Credit CFC (Зачет иностранного налога с КИК)
        xml += this.field('field_270_01_J', this.formatMoney(items.LF_FOREIGN_TAX_CREDIT_CFC));

        // Section K - IPN Payable (ИПН к уплате)
        xml += this.field('field_270_01_K', this.formatMoney(items.LF_IPN_PAYABLE));

        xml += this.field('field_270_01_bin', '');
        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);

        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_02(declaration, taxYear) {
        let xml = `<form name="form_270_02">\n<sheetGroup>\n<sheet name="page_270_02_01">\n`;

        // Bank details
        xml += this.field('bank_code', '');
        xml += this.field('iik', '');

        // Section B - ИПН, подлежащий уплате
        xml += this.field('field_270_02_B', '');

        // Section C - ИПН, подлежащий возврату  
        xml += this.field('field_270_02_C', '');

        // Payment details row 1
        xml += this.field('field_270_02_kbk_01', '101201');
        xml += this.field('field_270_02_kogd_01', '');
        xml += this.field('field_270_02_tax_01', '');
        xml += this.field('field_270_02_pen_01', '');

        // Payment details row 2
        xml += this.field('field_270_02_kbk_02', '');
        xml += this.field('field_270_02_kogd_02', '');
        xml += this.field('field_270_02_tax_02', '');

        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);
        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_03(declaration, taxYear) {
        let xml = `<form name="form_270_03">\n<sheetGroup>\n<sheet name="page_270_03_01">\n`;

        // Section B - Доходы от налоговых агентов (B_1 to B_12)
        xml += this.field('field_270_03_B', '');
        for (let i = 1; i <= 12; i++) {
            xml += this.field(`field_270_03_B_${i}`, '');
        }

        // Section C - Удержанный ИПН (C_1 to C_12)
        xml += this.field('field_270_03_C', '');
        for (let i = 1; i <= 12; i++) {
            xml += this.field(`field_270_03_C_${i}`, '');
        }

        xml += this.field('field_270_03_bin', '');
        xml += this.field('field_270_03_tax_org', '');
        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);
        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_04(declaration, taxYear) {
        let xml = `<form name="form_270_04">\n<sheetGroup>\n<sheet name="page_270_04_01">\n`;

        // Section B: columns A,B,C,E,F,G,H,I rows 1-6
        const columnsB = ['A', 'B', 'C', 'E', 'F', 'G', 'H', 'I'];
        for (const col of columnsB) {
            for (let i = 1; i <= 6; i++) {
                xml += this.field(`field_270_04_B_${col}_${i}`, '');
            }
        }

        // Section C: columns A,B,C,D,E rows 1-6
        const columnsC = ['A', 'B', 'C', 'D', 'E'];
        for (const col of columnsC) {
            for (let i = 1; i <= 6; i++) {
                xml += this.field(`field_270_04_C_${col}_${i}`, '');
            }
        }

        // Section D: columns A,B,C,D,F,G rows 1-5
        const columnsD = ['A', 'B', 'C', 'D', 'F', 'G'];
        for (const col of columnsD) {
            for (let i = 1; i <= 5; i++) {
                xml += this.field(`field_270_04_D_${col}_${i}`, '');
            }
        }

        // Section E: columns A,B,C,D,E rows 1-5
        const columnsE = ['A', 'B', 'C', 'D', 'E'];
        for (const col of columnsE) {
            for (let i = 1; i <= 5; i++) {
                xml += this.field(`field_270_04_E_${col}_${i}`, '');
            }
        }

        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);
        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_05(declaration, taxYear) {
        let xml = `<form name="form_270_05">\n<sheetGroup>\n<sheet name="page_270_05_01">\n`;

        // Section B: columns A,B,C,D,E,F,G,I,J,K,L rows 1-11
        const columnsB = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L'];
        for (const col of columnsB) {
            for (let i = 1; i <= 11; i++) {
                xml += this.field(`field_270_05_B_${col}_${i}`, '');
            }
        }

        // Section C: columns A,B,C,D,E,F,G,H rows 1-11
        const columnsC = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (const col of columnsC) {
            for (let i = 1; i <= 11; i++) {
                xml += this.field(`field_270_05_C_${col}_${i}`, '');
            }
        }

        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);
        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_06(declaration, taxYear) {
        let xml = `<form name="form_270_06">\n<sheetGroup>\n<sheet name="page_270_06_01">\n`;
        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);

        // Fields: A, B, C, D, F, G
        for (let i = 0; i < 4; i++) {
            xml += `<row>\n`;
            xml += this.field('field_270_06_A', '');
            xml += this.field('field_270_06_B', '');
            xml += this.field('field_270_06_C', '');
            xml += this.field('field_270_06_D', '');
            xml += this.field('field_270_06_F', '');
            xml += this.field('field_270_06_G', '');
            xml += `</row>\n`;
        }

        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    buildForm270_07(declaration, taxYear) {
        let xml = `<form name="form_270_07">\n<sheetGroup>\n<sheet name="page_270_07_01">\n`;
        xml += this.field('iin', declaration.iin || '');
        xml += this.field('page_number', '1');
        xml += this.field('period_year', taxYear);

        // Fields: A, B, C, D, F, M
        for (let i = 0; i < 4; i++) {
            xml += `<row>\n`;
            xml += this.field('field_270_07_A', '');
            xml += this.field('field_270_07_B', '');
            xml += this.field('field_270_07_C', '');
            xml += this.field('field_270_07_D', '');
            xml += this.field('field_270_07_F', '');
            xml += this.field('field_270_07_M', '');
            xml += `</row>\n`;
        }

        xml += `</sheet>\n</sheetGroup>\n</form>\n`;
        return xml;
    },

    // ==========================================
    // HELPER METHODS
    // ==========================================

    field(name, value) {
        const escapedValue = this.escapeXml(value);
        if (escapedValue === '' || escapedValue === null || escapedValue === undefined) {
            return `<field name="${name}"/>\n`;
        }
        return `<field name="${name}">${escapedValue}</field>\n`;
    },

    formatMoney(value) {
        if (value === null || value === undefined) return '';
        const num = parseFloat(value);
        if (isNaN(num) || num === 0) return '';
        return Math.round(num).toString();
    },

    formatDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    },

    escapeXml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    },

    // ==========================================
    // RETRIEVAL
    // ==========================================

    async getLatest(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) throw new Error('Declaration not found');

        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) throw new Error('No access to this declaration');

        return xmlGeneratorRepository.getLatestXml(declarationId);
    },

    async getById(xmlId, userId) {
        const xml = await xmlGeneratorRepository.getXmlById(xmlId);
        if (!xml) throw new Error('XML not found');

        const declaration = await declarationsRepository.findById(xml.declaration_id);
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) throw new Error('No access to this XML');

        return xml;
    },

    async listVersions(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) throw new Error('Declaration not found');

        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) throw new Error('No access to this declaration');

        return xmlGeneratorRepository.listXmlVersions(declarationId);
    },

    validateXmlStructure(xmlContent) {
        const errors = [];
        if (!xmlContent.startsWith('<?xml')) errors.push('Missing XML declaration');
        if (!xmlContent.includes('<fno')) errors.push('Missing root element <fno>');
        if (!xmlContent.includes('form_270_00')) errors.push('Missing form_270_00');
        if (!xmlContent.includes('form_270_01')) errors.push('Missing form_270_01');
        return { isValid: errors.length === 0, errors };
    },

    validateDeclarationData(declaration, items) {
        const errors = [];
        const warnings = [];

        if (!declaration.iin) errors.push('IIN is required');
        else if (declaration.iin.length !== 12) errors.push('IIN must be 12 characters');
        if (!declaration.fio_last) errors.push('Last name (fio1) is required');
        if (!declaration.fio_first) errors.push('First name (fio2) is required');

        const incomeTotal = parseFloat(items.LF_INCOME_TOTAL) || 0;
        const taxableIncome = parseFloat(items.LF_TAXABLE_INCOME) || 0;
        const adjustmentTotal = parseFloat(items.LF_ADJUSTMENT_TOTAL) || 0;
        const deductionTotal = parseFloat(items.LF_DEDUCTION_TOTAL) || 0;

        const expectedTaxable = incomeTotal - adjustmentTotal - deductionTotal;
        if (Math.abs(taxableIncome - expectedTaxable) > 0.01) {
            warnings.push(`Taxable income mismatch: ${taxableIncome} vs expected ${expectedTaxable}`);
        }

        return { isValid: errors.length === 0, errors, warnings };
    },
};

module.exports = xmlGeneratorService;