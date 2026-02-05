/**
 * CSV Parser
 * Parses CSV-imported data into tax events
 */

const CsvParser = {
    /**
     * Parse source record with CSV data
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('CSV parser: raw_payload is required');
        }

        const events = [];

        // Expected format: { rows: [...], filename: '...', headers: [...] }
        const rows = payload.rows || payload.data || [];

        if (!Array.isArray(rows)) {
            throw new Error('CSV parser: rows array is required in payload');
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const event = this.parseRow(row, taxIdentityId, sourceRecordId, i);
                if (event) {
                    events.push(event);
                }
            } catch (error) {
                throw new Error(`CSV parser: row ${i + 1} - ${error.message}`);
            }
        }

        return events;
    },

    /**
     * Parse single CSV row
     * @param {Object} row - Row data
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {number} rowIndex
     * @returns {Object|null} TaxEventInput
     */
    parseRow(row, taxIdentityId, sourceRecordId, rowIndex) {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
            return null;
        }

        // Try to find date field
        const dateField = this.findField(row, ['date', 'event_date', 'дата', 'transaction_date']);
        if (!dateField) {
            throw new Error('date field not found');
        }

        const eventDate = this.normalizeDate(row[dateField]);

        // Try to find event type or infer from data
        const typeField = this.findField(row, ['event_type', 'type', 'тип', 'category']);
        let eventType = typeField ? this.normalizeEventType(row[typeField]) : this.inferEventType(row);

        // Try to find amount
        const amountField = this.findField(row, ['amount', 'sum', 'сумма', 'value']);
        const amount = amountField ? this.normalizeAmount(row[amountField]) : null;

        // Try to find currency
        const currencyField = this.findField(row, ['currency', 'валюта', 'ccy']);
        const currency = currencyField ? this.normalizeCurrency(row[currencyField]) : 'KZT';

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount,
            currency,
            metadata: {
                ...row,
                _row_index: rowIndex,
            },
        };
    },

    /**
     * Find field by possible names
     * @param {Object} row
     * @param {Array<string>} possibleNames
     * @returns {string|null}
     */
    findField(row, possibleNames) {
        const rowKeys = Object.keys(row).map(k => k.toLowerCase());

        for (const name of possibleNames) {
            const lowerName = name.toLowerCase();
            const foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerName);
            if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '') {
                return foundKey;
            }
        }
        return null;
    },

    /**
     * Normalize event type from CSV value
     * @param {string} type
     * @returns {string}
     */
    normalizeEventType(type) {
        if (!type) return 'EV_OTHER_NON_AGENT_INCOME';

        const normalized = type.toUpperCase().trim().replace(/\s+/g, '_');

        const typeMap = {
            // Property income
            'INCOME': 'EV_OTHER_NON_AGENT_INCOME',
            'RENT': 'EV_PROPERTY_RENT_NON_AGENT',
            'АРЕНДА': 'EV_PROPERTY_RENT_NON_AGENT',
            'PROPERTY': 'EV_PROPERTY_SALE_KZ',
            'ИМУЩЕСТВО': 'EV_PROPERTY_SALE_KZ',
            'PROPERTY_KZ': 'EV_PROPERTY_SALE_KZ',
            'PROPERTY_FOREIGN': 'EV_PROPERTY_SALE_FOREIGN',
            'CAPITAL_CONTRIBUTION': 'EV_PROPERTY_CAPITAL_CONTRIBUTION',
            'ASSIGNMENT': 'EV_PROPERTY_ASSIGNMENT_RIGHT',
            'IP_ASSET': 'EV_IP_OTHER_ASSET_SALE',

            // Foreign income
            'FOREIGN': 'EV_FOREIGN_OTHER',
            'ИНОСТРАННЫЙ': 'EV_FOREIGN_OTHER',
            'FOREIGN_EMPLOYMENT': 'EV_FOREIGN_EMPLOYMENT_INCOME',
            'FOREIGN_GPC': 'EV_FOREIGN_GPC_INCOME',
            'FOREIGN_DIVIDENDS': 'EV_FOREIGN_DIVIDENDS',
            'FOREIGN_INTEREST': 'EV_FOREIGN_INTEREST',
            'FOREIGN_PENSION': 'EV_FOREIGN_PENSION',
            'ДИВИДЕНДЫ': 'EV_FOREIGN_DIVIDENDS',

            // Non-agent domestic income
            'PRIVATE_PRACTICE': 'EV_OTHER_NON_AGENT_INCOME',
            'ЧАСТНАЯ_ПРАКТИКА': 'EV_OTHER_NON_AGENT_INCOME',
            'DOMESTIC_HELPER': 'EV_DOMESTIC_HELPER_INCOME',
            'CITIZEN_GPC': 'EV_CITIZEN_GPC_INCOME',
            'MEDIATOR': 'EV_MEDIATOR_INCOME',
            'SUBSIDIARY_FARM': 'EV_SUBSIDIARY_FARM_INCOME',
            'LABOR_MIGRANT': 'EV_LABOR_MIGRANT_INCOME',

            // CFC
            'CFC': 'EV_CFC_PROFIT_BEFORE_TAX',
            'CFC_PROFIT': 'EV_CFC_PROFIT_BEFORE_TAX',
            'CFC_EXEMPTED': 'EV_CFC_PROFIT_EXEMPTED',

            // Adjustments
            'ADJUSTMENT': 'EV_ADJUSTMENT_ART_341',
            'ADJUSTMENT_341': 'EV_ADJUSTMENT_ART_341',
            'ADJUSTMENT_654': 'EV_ADJUSTMENT_ART_654',
            'ADJUSTMENT_TREATY': 'EV_ADJUSTMENT_TREATY',

            // Deductions
            'DEDUCTION': 'EV_DEDUCTION_STANDARD',
            'DEDUCTION_STANDARD': 'EV_DEDUCTION_STANDARD',
            'DEDUCTION_OTHER': 'EV_DEDUCTION_OTHER',
            'ВЫЧЕТ': 'EV_DEDUCTION_STANDARD',

            // Foreign tax
            'FOREIGN_TAX': 'EV_FOREIGN_TAX_PAID_GENERAL',
            'FOREIGN_TAX_CFC': 'EV_FOREIGN_TAX_PAID_CFC',
        };

        // Return if already EV_* format
        if (normalized.startsWith('EV_')) {
            return normalized;
        }

        return typeMap[normalized] || 'EV_OTHER_NON_AGENT_INCOME';
    },

    /**
     * Infer event type from row data
     * @param {Object} row
     * @returns {string}
     */
    inferEventType(row) {
        const description = (row.description || row.описание || '').toLowerCase();

        if (description.includes('аренд')) return 'EV_PROPERTY_RENT_NON_AGENT';
        if (description.includes('rent')) return 'EV_PROPERTY_RENT_NON_AGENT';
        if (description.includes('имущество')) return 'EV_PROPERTY_SALE_KZ';
        if (description.includes('property')) return 'EV_PROPERTY_SALE_KZ';
        if (description.includes('дивиденд')) return 'EV_FOREIGN_DIVIDENDS';
        if (description.includes('dividend')) return 'EV_FOREIGN_DIVIDENDS';
        if (description.includes('зарплат')) return 'EV_FOREIGN_EMPLOYMENT_INCOME';
        if (description.includes('salary')) return 'EV_FOREIGN_EMPLOYMENT_INCOME';

        return 'EV_OTHER_NON_AGENT_INCOME';
    },

    /**
     * Normalize date
     * @param {string|Date} date
     * @returns {string}
     */
    normalizeDate(date) {
        if (!date) {
            throw new Error('date is required');
        }

        // Handle DD.MM.YYYY format (common in Kazakhstan)
        if (typeof date === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(date)) {
            const [day, month, year] = date.split('.');
            date = `${year}-${month}-${day}`;
        }

        // Handle DD/MM/YYYY format
        if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
            const [day, month, year] = date.split('/');
            date = `${year}-${month}-${day}`;
        }

        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            throw new Error(`invalid date format: ${date}`);
        }

        return parsed.toISOString().split('T')[0];
    },

    /**
     * Normalize amount
     * @param {string|number} amount
     * @returns {number|null}
     */
    normalizeAmount(amount) {
        if (amount === null || amount === undefined || amount === '') {
            return null;
        }

        // Remove spaces and replace comma with dot
        const cleaned = String(amount).replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);

        if (isNaN(parsed)) {
            return null;
        }

        return parsed;
    },

    /**
     * Normalize currency
     * @param {string} currency
     * @returns {string}
     */
    normalizeCurrency(currency) {
        if (!currency) return 'KZT';

        const normalized = currency.toUpperCase().trim();

        const currencyMap = {
            'TENGE': 'KZT',
            'ТГ': 'KZT',
            'ТЕНГЕ': 'KZT',
            'DOLLAR': 'USD',
            'ДОЛЛАР': 'USD',
            '$': 'USD',
            'EURO': 'EUR',
            'ЕВРО': 'EUR',
            '€': 'EUR',
            'RUBLE': 'RUB',
            'РУБЛЬ': 'RUB',
            '₽': 'RUB',
        };

        return currencyMap[normalized] || normalized;
    },
};

module.exports = CsvParser;
