/**
 * API Parser
 * Parses data received from external APIs (e.g., egov.kz)
 */

const ApiParser = {
    /**
     * Parse source record with API data
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('API parser: raw_payload is required');
        }

        const events = [];

        // Try different API response formats
        const responseData = payload.response_data || payload.data || payload;

        // Format 1: { incomes: [...] }
        if (responseData.incomes && Array.isArray(responseData.incomes)) {
            for (const income of responseData.incomes) {
                const event = this.parseIncomeRecord(income, taxIdentityId, sourceRecordId, payload);
                if (event) events.push(event);
            }
        }

        // Format 2: { items: [...] } or { records: [...] }
        const items = responseData.items || responseData.records || responseData.events;
        if (Array.isArray(items)) {
            for (const item of items) {
                const event = this.parseGenericRecord(item, taxIdentityId, sourceRecordId, payload);
                if (event) events.push(event);
            }
        }

        // Format 3: { assets: [...] } - for foreign assets
        if (responseData.assets && Array.isArray(responseData.assets)) {
            for (const asset of responseData.assets) {
                const event = this.parseAssetRecord(asset, taxIdentityId, sourceRecordId, payload);
                if (event) events.push(event);
            }
        }

        // Format 4: { debts: [...] } - for debts
        if (responseData.debts && Array.isArray(responseData.debts)) {
            for (const debt of responseData.debts) {
                const event = this.parseDebtRecord(debt, taxIdentityId, sourceRecordId, payload);
                if (event) events.push(event);
            }
        }

        // Single record format
        if (!events.length && (responseData.event_type || responseData.type)) {
            const event = this.parseGenericRecord(responseData, taxIdentityId, sourceRecordId, payload);
            if (event) events.push(event);
        }

        if (events.length === 0) {
            throw new Error('API parser: no valid events found in payload');
        }

        return events;
    },

    /**
     * Parse income record from API
     * @param {Object} income
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    parseIncomeRecord(income, taxIdentityId, sourceRecordId, originalPayload) {
        const eventDate = this.extractDate(income);
        if (!eventDate) {
            return null;
        }

        const eventType = this.mapIncomeType(income.source || income.type || income.income_type);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: this.extractAmount(income),
            currency: this.normalizeCurrency(income.currency),
            metadata: {
                source_api: originalPayload.source_api || originalPayload.endpoint,
                payer: income.payer || income.source,
                payer_bin: income.payer_bin || income.bin,
                tax_paid: income.tax_paid || income.tax,
                original: income,
            },
        };
    },

    /**
     * Parse generic record from API
     * @param {Object} item
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    parseGenericRecord(item, taxIdentityId, sourceRecordId, originalPayload) {
        const eventDate = this.extractDate(item);
        if (!eventDate) {
            return null;
        }

        let eventType = item.event_type || item.type;
        if (!eventType) {
            eventType = 'INCOME_OTHER';
        } else {
            eventType = this.normalizeEventType(eventType);
        }

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: this.extractAmount(item),
            currency: this.normalizeCurrency(item.currency),
            metadata: {
                source_api: originalPayload.source_api || originalPayload.endpoint,
                original: item,
            },
        };
    },

    /**
     * Parse asset record (for foreign assets - 270.04)
     * @param {Object} asset
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    parseAssetRecord(asset, taxIdentityId, sourceRecordId, originalPayload) {
        const eventDate = this.extractDate(asset);
        if (!eventDate) {
            return null;
        }

        // Determine if acquisition or disposal
        const action = (asset.action || asset.type || '').toLowerCase();
        let eventType = 'FOREIGN_ASSET_ACQUIRED';

        if (action.includes('dispos') || action.includes('sold') || action.includes('отчужден')) {
            eventType = 'FOREIGN_ASSET_DISPOSED';
        }

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: this.extractAmount(asset),
            currency: this.normalizeCurrency(asset.currency),
            metadata: {
                source_api: originalPayload.source_api,
                asset_type: asset.asset_type || asset.type,
                country: asset.country,
                description: asset.description,
                original: asset,
            },
        };
    },

    /**
     * Parse debt record (270.06)
     * @param {Object} debt
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @param {Object} originalPayload
     * @returns {Object|null}
     */
    parseDebtRecord(debt, taxIdentityId, sourceRecordId, originalPayload) {
        const eventDate = this.extractDate(debt);
        if (!eventDate) {
            return null;
        }

        const type = (debt.debt_type || debt.type || '').toLowerCase();
        let eventType = type.includes('payable') || type.includes('кредитор')
            ? 'DEBT_PAYABLE'
            : 'DEBT_RECEIVABLE';

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: this.extractAmount(debt),
            currency: this.normalizeCurrency(debt.currency),
            metadata: {
                source_api: originalPayload.source_api,
                counterparty: debt.counterparty || debt.debtor || debt.creditor,
                counterparty_bin: debt.counterparty_bin,
                original: debt,
            },
        };
    },

    /**
     * Extract date from record
     * @param {Object} record
     * @returns {string|null}
     */
    extractDate(record) {
        const dateFields = ['event_date', 'date', 'transaction_date', 'report_date', 'period_end', 'as_of_date'];

        for (const field of dateFields) {
            if (record[field]) {
                try {
                    return this.normalizeDate(record[field]);
                } catch {
                    continue;
                }
            }
        }

        // Try year field
        if (record.year || record.tax_year) {
            return `${record.year || record.tax_year}-12-31`;
        }

        return null;
    },

    /**
     * Normalize date
     * @param {string|Date} date
     * @returns {string}
     */
    normalizeDate(date) {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            throw new Error(`invalid date: ${date}`);
        }
        return parsed.toISOString().split('T')[0];
    },

    /**
     * Extract amount from record
     * @param {Object} record
     * @returns {number|null}
     */
    extractAmount(record) {
        const amountFields = ['amount', 'sum', 'value', 'total'];

        for (const field of amountFields) {
            if (record[field] !== undefined && record[field] !== null) {
                const parsed = parseFloat(record[field]);
                if (!isNaN(parsed)) {
                    return parsed;
                }
            }
        }

        return null;
    },

    /**
     * Map income type to event type
     * @param {string} incomeType
     * @returns {string}
     */
    mapIncomeType(incomeType) {
        if (!incomeType) return 'INCOME_OTHER';

        const type = incomeType.toLowerCase();

        const mapping = {
            'salary': 'INCOME_OTHER', // Salary is handled by employer
            'employer': 'INCOME_OTHER',
            'rent': 'INCOME_RENT',
            'аренда': 'INCOME_RENT',
            'property': 'INCOME_PROPERTY_KZ',
            'имущество': 'INCOME_PROPERTY_KZ',
            'foreign': 'INCOME_FOREIGN_GENERAL',
            'иностранный': 'INCOME_FOREIGN_GENERAL',
            'private_practice': 'PRIVATE_PRACTICE_INCOME',
            'частная_практика': 'PRIVATE_PRACTICE_INCOME',
        };

        for (const [key, value] of Object.entries(mapping)) {
            if (type.includes(key)) {
                return value;
            }
        }

        return 'INCOME_OTHER';
    },

    /**
     * Normalize event type
     * @param {string} type
     * @returns {string}
     */
    normalizeEventType(type) {
        const normalized = type.toUpperCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');

        // Check if it's already a valid format
        if (normalized.startsWith('INCOME_') || normalized.startsWith('PRIVATE_') ||
            normalized.startsWith('FOREIGN_') || normalized.startsWith('DEBT_') ||
            normalized.startsWith('CFC_')) {
            return normalized;
        }

        return 'INCOME_OTHER';
    },

    /**
     * Normalize currency
     * @param {string} currency
     * @returns {string}
     */
    normalizeCurrency(currency) {
        if (!currency) return 'KZT';
        return currency.toUpperCase().trim().substring(0, 3);
    },
};

module.exports = ApiParser;
