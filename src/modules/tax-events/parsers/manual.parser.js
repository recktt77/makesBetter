/**
 * Manual Input Parser
 * Parses manually entered tax event data
 */

const ManualParser = {
    /**
     * Parse source record with manual input
     * @param {Object} sourceRecord - Source record from DB
     * @returns {Array<Object>} - Array of TaxEventInput
     */
    parse(sourceRecord) {
        const { id: sourceRecordId, tax_identity_id: taxIdentityId, raw_payload: payload } = sourceRecord;

        if (!payload) {
            throw new Error('Manual parser: raw_payload is required');
        }

        const events = [];

        // Single event format
        if (payload.event_type) {
            events.push(this.parseEvent(payload, taxIdentityId, sourceRecordId));
        }

        // Multiple events format
        if (Array.isArray(payload.events)) {
            for (const eventData of payload.events) {
                events.push(this.parseEvent(eventData, taxIdentityId, sourceRecordId));
            }
        }

        // Legacy format with income_type
        if (payload.income_type && !payload.event_type) {
            events.push(this.parseLegacyFormat(payload, taxIdentityId, sourceRecordId));
        }

        if (events.length === 0) {
            throw new Error('Manual parser: no valid events found in payload');
        }

        return events;
    },

    /**
     * Parse single event from payload
     * @param {Object} data - Event data
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @returns {Object} TaxEventInput
     */
    parseEvent(data, taxIdentityId, sourceRecordId) {
        if (!data.event_type) {
            throw new Error('Manual parser: event_type is required');
        }

        if (!data.event_date && !data.date) {
            throw new Error('Manual parser: event_date or date is required');
        }

        const eventDate = this.normalizeDate(data.event_date || data.date);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType: data.event_type,
            eventDate,
            amount: data.amount ? parseFloat(data.amount) : null,
            currency: this.normalizeCurrency(data.currency),
            metadata: this.extractMetadata(data),
        };
    },

    /**
     * Parse legacy format with income_type
     * @param {Object} data
     * @param {string} taxIdentityId
     * @param {string} sourceRecordId
     * @returns {Object} TaxEventInput
     */
    parseLegacyFormat(data, taxIdentityId, sourceRecordId) {
        // Map legacy income types to event types
        const incomeTypeMap = {
            'salary': 'INCOME_OTHER',
            'rent': 'INCOME_RENT',
            'property': 'INCOME_PROPERTY_KZ',
            'property_foreign': 'INCOME_PROPERTY_FOREIGN',
            'foreign': 'INCOME_FOREIGN_GENERAL',
            'assignment': 'INCOME_ASSIGNMENT',
            'private_practice': 'PRIVATE_PRACTICE_INCOME',
            'other': 'INCOME_OTHER',
        };

        const eventType = incomeTypeMap[data.income_type] || 'INCOME_OTHER';
        const eventDate = this.normalizeDate(data.date || data.event_date);

        return {
            taxIdentityId,
            sourceRecordId,
            eventType,
            eventDate,
            amount: data.amount ? parseFloat(data.amount) : null,
            currency: this.normalizeCurrency(data.currency),
            metadata: this.extractMetadata(data),
        };
    },

    /**
     * Normalize date to ISO format
     * @param {string|Date} date
     * @returns {string}
     */
    normalizeDate(date) {
        if (!date) {
            throw new Error('Manual parser: date is required');
        }

        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            throw new Error(`Manual parser: invalid date format: ${date}`);
        }

        return parsed.toISOString().split('T')[0];
    },

    /**
     * Normalize currency code to ISO-4217
     * @param {string} currency
     * @returns {string}
     */
    normalizeCurrency(currency) {
        if (!currency) return 'KZT';

        const normalized = currency.toUpperCase().trim();

        // Common currency mappings
        const currencyMap = {
            'TENGE': 'KZT',
            'ТГ': 'KZT',
            'DOLLAR': 'USD',
            'ДОЛЛАР': 'USD',
            'EURO': 'EUR',
            'ЕВРО': 'EUR',
            'RUBLE': 'RUB',
            'РУБЛЬ': 'RUB',
        };

        return currencyMap[normalized] || normalized;
    },

    /**
     * Extract metadata from payload (excluding core fields)
     * @param {Object} data
     * @returns {Object|null}
     */
    extractMetadata(data) {
        const coreFields = ['event_type', 'event_date', 'date', 'amount', 'currency', 'income_type'];
        const metadata = {};

        for (const [key, value] of Object.entries(data)) {
            if (!coreFields.includes(key) && value !== null && value !== undefined) {
                metadata[key] = value;
            }
        }

        return Object.keys(metadata).length > 0 ? metadata : null;
    },
};

module.exports = ManualParser;
