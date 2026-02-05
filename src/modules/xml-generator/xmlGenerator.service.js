const crypto = require('crypto');
const xmlGeneratorRepository = require('./xmlGenerator.repository');
const declarationsRepository = require('../declarations/declarations.repository');
const identitiesRepository = require('../identities/identities.repository');

/**
 * XML Generator Service
 * Generates XML in 270.00 format from declaration data
 */
const xmlGeneratorService = {
    // ==========================================
    // MAIN XML GENERATION
    // ==========================================

    /**
     * Generate XML for declaration
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async generate(declarationId, userId) {
        // Get declaration
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        // Check access
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        // Check status - must be at least validated
        if (declaration.status === 'draft') {
            throw new Error('Declaration must be validated before generating XML');
        }

        // Get declaration items
        const items = await declarationsRepository.getItemsAsObject(declarationId);

        // Get XML field mappings
        const mappings = await xmlGeneratorRepository.getMappingsAsObject(declaration.form_code);

        // Build XML content
        const xmlContent = this.buildXml(declaration, items, mappings);

        // Calculate hash
        const xmlHash = crypto.createHash('sha256').update(xmlContent).digest('hex');

        // Get next version
        const version = await xmlGeneratorRepository.getNextVersion(declarationId);

        // Save to database
        const savedXml = await xmlGeneratorRepository.saveGeneratedXml({
            declarationId,
            xmlContent,
            xmlHash,
            version,
            generatedBy: userId,
        });

        return {
            id: savedXml.id,
            version: parseInt(savedXml.schema_version, 10) || version,
            xmlHash,
            xmlContent,
            createdAt: savedXml.created_at,
        };
    },

    /**
     * Build XML string from declaration data
     * @param {Object} declaration
     * @param {Object} items - field values by logical_field code
     * @param {Object} mappings - XML mappings
     * @returns {string}
     */
    buildXml(declaration, items, mappings) {
        const taxYear = declaration.tax_year;
        const formCode = declaration.form_code;

        // Header info
        const iin = declaration.iin || '';
        const fio = [declaration.fio_last, declaration.fio_first, declaration.fio_middle]
            .filter(Boolean).join(' ');

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<FORM_${formCode.replace('.', '_')} version="1.0">\n`;

        // Header section
        xml += `  <HEADER>\n`;
        xml += `    <TAX_YEAR>${taxYear}</TAX_YEAR>\n`;
        xml += `    <FORM_CODE>${formCode}</FORM_CODE>\n`;
        xml += `    <DECLARATION_KIND>${this.getDeclarationKindCode(declaration.declaration_kind)}</DECLARATION_KIND>\n`;
        xml += `    <IIN>${this.escapeXml(iin)}</IIN>\n`;
        xml += `    <FIO>${this.escapeXml(fio)}</FIO>\n`;
        xml += `    <PHONE>${this.escapeXml(declaration.payer_phone || '')}</PHONE>\n`;
        xml += `    <EMAIL>${this.escapeXml(declaration.email || '')}</EMAIL>\n`;
        xml += `    <GENERATED_AT>${new Date().toISOString()}</GENERATED_AT>\n`;
        xml += `  </HEADER>\n`;

        // Income section (270.01)
        xml += `  <SECTION_270_01>\n`;
        xml += this.buildIncomeSection(items, mappings);
        xml += `  </SECTION_270_01>\n`;

        // Adjustments section (270.02)
        xml += `  <SECTION_270_02>\n`;
        xml += this.buildAdjustmentsSection(items, mappings);
        xml += `  </SECTION_270_02>\n`;

        // Deductions section (270.03)
        xml += `  <SECTION_270_03>\n`;
        xml += this.buildDeductionsSection(items, mappings);
        xml += `  </SECTION_270_03>\n`;

        // Tax calculation section (270.04)
        xml += `  <SECTION_270_04>\n`;
        xml += this.buildTaxSection(items, mappings);
        xml += `  </SECTION_270_04>\n`;

        // Foreign tax credit section (270.05)
        xml += `  <SECTION_270_05>\n`;
        xml += this.buildForeignTaxSection(items, mappings);
        xml += `  </SECTION_270_05>\n`;

        // Flags section
        if (declaration.flags && Object.keys(declaration.flags).length > 0) {
            xml += `  <FLAGS>\n`;
            for (const [key, value] of Object.entries(declaration.flags)) {
                if (value) {
                    xml += `    <FLAG name="${this.escapeXml(key)}">1</FLAG>\n`;
                }
            }
            xml += `  </FLAGS>\n`;
        }

        xml += `</FORM_${formCode.replace('.', '_')}>\n`;

        return xml;
    },

    /**
     * Build income section fields
     */
    buildIncomeSection(items, mappings) {
        const incomeFields = [
            'LF_INCOME_PROPERTY_SALE_KZ',
            'LF_INCOME_PROPERTY_SALE_FOREIGN',
            'LF_INCOME_SECURITIES_SALE',
            'LF_INCOME_SHARE_SALE',
            'LF_INCOME_DIVIDENDS_KZ',
            'LF_INCOME_DIVIDENDS_FOREIGN',
            'LF_INCOME_INTEREST_KZ',
            'LF_INCOME_INTEREST_FOREIGN',
            'LF_INCOME_ROYALTY',
            'LF_INCOME_PRIZE',
            'LF_INCOME_RENT',
            'LF_INCOME_GIFT',
            'LF_INCOME_INSURANCE',
            'LF_INCOME_PENSION_FOREIGN',
            'LF_INCOME_CFC',
            'LF_INCOME_OTHER',
            'LF_INCOME_TOTAL',
        ];

        return this.buildFieldsXml(incomeFields, items, mappings);
    },

    /**
     * Build adjustments section fields
     */
    buildAdjustmentsSection(items, mappings) {
        const adjustmentFields = [
            'LF_ADJUSTMENT_PROPERTY_SALE',
            'LF_ADJUSTMENT_TOTAL',
        ];

        return this.buildFieldsXml(adjustmentFields, items, mappings);
    },

    /**
     * Build deductions section fields
     */
    buildDeductionsSection(items, mappings) {
        const deductionFields = [
            'LF_DEDUCTION_PENSION_CONTRIBUTION',
            'LF_DEDUCTION_MEDICAL',
            'LF_DEDUCTION_EDUCATION',
            'LF_DEDUCTION_MORTGAGE_INTEREST',
            'LF_DEDUCTION_TOTAL',
        ];

        return this.buildFieldsXml(deductionFields, items, mappings);
    },

    /**
     * Build tax calculation section fields
     */
    buildTaxSection(items, mappings) {
        const taxFields = [
            'LF_TAXABLE_INCOME',
            'LF_IPN_RATE',
            'LF_IPN_CALCULATED',
            'LF_IPN_WITHHELD',
            'LF_IPN_PAYABLE',
            'LF_IPN_OVERPAID',
        ];

        return this.buildFieldsXml(taxFields, items, mappings);
    },

    /**
     * Build foreign tax credit section fields
     */
    buildForeignTaxSection(items, mappings) {
        const foreignFields = [
            'LF_FOREIGN_TAX_PAID',
            'LF_FOREIGN_TAX_CREDIT_GENERAL',
            'LF_FOREIGN_TAX_CREDIT_CFC',
        ];

        return this.buildFieldsXml(foreignFields, items, mappings);
    },

    /**
     * Build XML for a list of fields
     */
    buildFieldsXml(fieldCodes, items, mappings) {
        let xml = '';

        for (const code of fieldCodes) {
            const value = items[code];
            const mapping = mappings[code];

            // Get XML field name from mapping or derive from code
            const xmlFieldName = mapping?.xmlFieldName || code.replace('LF_', 'field_270_01_');

            // Format value based on data type
            const formattedValue = this.formatValue(value, mapping?.dataType);

            xml += `    <${xmlFieldName}>${formattedValue}</${xmlFieldName}>\n`;
        }

        return xml;
    },

    /**
     * Format value for XML output
     */
    formatValue(value, dataType) {
        if (value === null || value === undefined) {
            return '0';
        }

        switch (dataType) {
            case 'decimal':
            case 'money':
                return parseFloat(value).toFixed(2);
            case 'integer':
                return Math.round(value).toString();
            case 'percent':
                return (parseFloat(value) * 100).toFixed(2);
            case 'boolean':
                return value ? '1' : '0';
            case 'date':
                return value instanceof Date ? value.toISOString().split('T')[0] : value;
            default:
                return this.escapeXml(String(value));
        }
    },

    /**
     * Escape XML special characters
     */
    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    },

    /**
     * Get declaration kind code for XML
     */
    getDeclarationKindCode(kind) {
        const codes = {
            'main': '1',
            'additional': '2',
            'corrective': '3',
            'liquidation': '4',
        };
        return codes[kind] || '1';
    },

    // ==========================================
    // RETRIEVAL
    // ==========================================

    /**
     * Get latest XML for declaration
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async getLatest(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        return xmlGeneratorRepository.getLatestXml(declarationId);
    },

    /**
     * Get XML by ID
     * @param {string} xmlId
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async getById(xmlId, userId) {
        const xml = await xmlGeneratorRepository.getXmlById(xmlId);
        if (!xml) {
            throw new Error('XML not found');
        }

        const declaration = await declarationsRepository.findById(xml.declaration_id);
        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this XML');
        }

        return xml;
    },

    /**
     * List XML versions for declaration
     * @param {string} declarationId
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async listVersions(declarationId, userId) {
        const declaration = await declarationsRepository.findById(declarationId);
        if (!declaration) {
            throw new Error('Declaration not found');
        }

        const hasAccess = await identitiesRepository.userHasAccess(userId, declaration.tax_identity_id);
        if (!hasAccess) {
            throw new Error('No access to this declaration');
        }

        return xmlGeneratorRepository.listXmlVersions(declarationId);
    },

    // ==========================================
    // VALIDATION
    // ==========================================

    /**
     * Validate XML structure (basic)
     * @param {string} xmlContent
     * @returns {Object}
     */
    validateXmlStructure(xmlContent) {
        const errors = [];

        // Check XML declaration
        if (!xmlContent.startsWith('<?xml')) {
            errors.push('Missing XML declaration');
        }

        // Check for required sections
        const requiredSections = [
            'HEADER',
            'SECTION_270_01',
            'SECTION_270_04',
        ];

        for (const section of requiredSections) {
            if (!xmlContent.includes(`<${section}>`)) {
                errors.push(`Missing required section: ${section}`);
            }
        }

        // Check for required header fields
        const requiredHeaderFields = ['TAX_YEAR', 'FORM_CODE', 'IIN'];
        for (const field of requiredHeaderFields) {
            if (!xmlContent.includes(`<${field}>`)) {
                errors.push(`Missing required header field: ${field}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    },
};

module.exports = xmlGeneratorService;
