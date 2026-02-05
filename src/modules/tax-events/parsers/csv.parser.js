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
        if (!type) return 'INCOME_OTHER';

        const normalized = type.toUpperCase().trim().replace(/\s+/g, '_');

        const typeMap = {
            'INCOME': 'INCOME_OTHER',
            'RENT': 'INCOME_RENT',
            'АРЕНДА': 'INCOME_RENT',
            'PROPERTY': 'INCOME_PROPERTY_KZ',
            'ИМУЩЕСТВО': 'INCOME_PROPERTY_KZ',
            'FOREIGN': 'INCOME_FOREIGN_GENERAL',
            'ИНОСТРАННЫЙ': 'INCOME_FOREIGN_GENERAL',
            'PRIVATE_PRACTICE': 'PRIVATE_PRACTICE_INCOME',
            'ЧАСТНАЯ_ПРАКТИКА': 'PRIVATE_PRACTICE_INCOME',
            'DEBT': 'DEBT_RECEIVABLE',
            'ДОЛГ': 'DEBT_RECEIVABLE',
        };

        // Return mapped type or original if it looks like a valid code
        if (normalized.startsWith('INCOME_') || normalized.startsWith('PRIVATE_') ||
            normalized.startsWith('FOREIGN_') || normalized.startsWith('DEBT_') ||
            normalized.startsWith('CFC_')) {
            return normalized;
        }

        return typeMap[normalized] || 'INCOME_OTHER';
    },

    /**
     * Infer event type from row data
     * @param {Object} row
     * @returns {string}
     */
    inferEventType(row) {
        const description = (row.description || row.описание || '').toLowerCase();

        if (description.includes('аренд')) return 'INCOME_RENT';
        if (description.includes('rent')) return 'INCOME_RENT';
        if (description.includes('имущество')) return 'INCOME_PROPERTY_KZ';
        if (description.includes('property')) return 'INCOME_PROPERTY_KZ';

        return 'INCOME_OTHER';
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
